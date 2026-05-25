"""Dataset manifest visibility helpers for governed-query routes."""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass

from fastapi import Header
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import DatasetGrantRecord
from app.domain.identity import DatasetGrantAxis
from app.domain.query import DatasetManifest
from app.query.registry import list_dataset_manifests


@dataclass(frozen=True)
class DatasetAccessContext:
    user_keys: tuple[str, ...] = ()
    team_keys: tuple[str, ...] = ()
    department_keys: tuple[str, ...] = ()
    role_keys: tuple[str, ...] = ()
    workspace_keys: tuple[str, ...] = ()

    def subjects_for_axis(self, axis: DatasetGrantAxis) -> tuple[str, ...]:
        if axis is DatasetGrantAxis.USER:
            return self.user_keys
        if axis is DatasetGrantAxis.TEAM:
            return self.team_keys
        if axis is DatasetGrantAxis.DEPARTMENT:
            return self.department_keys
        if axis is DatasetGrantAxis.ROLE:
            return self.role_keys

        return self.workspace_keys


def get_dataset_access_context(
    user_key: str | None = Header(default=None, alias="X-FLooks-User"),
    team_keys: str | None = Header(default=None, alias="X-FLooks-Teams"),
    department_key: str | None = Header(default=None, alias="X-FLooks-Department"),
    role_key: str | None = Header(default=None, alias="X-FLooks-Role"),
    workspace_key: str | None = Header(default=None, alias="X-FLooks-Workspace"),
) -> DatasetAccessContext:
    return DatasetAccessContext(
        user_keys=_parse_header_values(user_key),
        team_keys=_parse_header_values(team_keys),
        department_keys=_parse_header_values(department_key),
        role_keys=_parse_header_values(role_key),
        workspace_keys=_parse_header_values(workspace_key),
    )


def list_accessible_dataset_manifests(
    session: Session,
    access_context: DatasetAccessContext,
) -> list[DatasetManifest]:
    manifests = list_dataset_manifests()
    grants_by_dataset = _load_dataset_grants(session, (manifest.key for manifest in manifests))

    return [
        manifest
        for manifest in manifests
        if _manifest_is_accessible(manifest, grants_by_dataset.get(manifest.key, []), access_context)
    ]


def get_accessible_dataset_manifest_registry(
    session: Session,
    access_context: DatasetAccessContext,
) -> dict[str, DatasetManifest]:
    return {
        manifest.key: manifest
        for manifest in list_accessible_dataset_manifests(session, access_context)
    }


def _parse_header_values(raw_value: str | None) -> tuple[str, ...]:
    if raw_value is None:
        return ()

    values = [value.strip() for value in raw_value.split(",") if value.strip()]
    return tuple(values)


def _load_dataset_grants(
    session: Session,
    dataset_keys: Iterable[str],
) -> dict[str, list[DatasetGrantRecord]]:
    keys = tuple(dataset_keys)
    if not keys:
        return {}

    rows = session.scalars(
        select(DatasetGrantRecord).where(DatasetGrantRecord.dataset_key.in_(keys))
    ).all()
    grants_by_dataset: dict[str, list[DatasetGrantRecord]] = defaultdict(list)

    for row in rows:
        grants_by_dataset[row.dataset_key].append(row)

    return grants_by_dataset


def _manifest_is_accessible(
    manifest: DatasetManifest,
    grants: list[DatasetGrantRecord],
    access_context: DatasetAccessContext,
) -> bool:
    if not grants:
        return True

    allowed_axes = set(manifest.visibility.grant_axes)
    scoped_grants = [grant for grant in grants if grant.grant_axis in allowed_axes]

    if not scoped_grants:
        return True

    return any(
        grant.subject_key in access_context.subjects_for_axis(grant.grant_axis)
        for grant in scoped_grants
    )