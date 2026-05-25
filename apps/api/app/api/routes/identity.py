"""Identity and permissions bootstrap routes for the FLooks API."""

from __future__ import annotations

from collections import defaultdict
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.models import DashboardRecord, DashboardVersionRecord, DatasetGrantRecord
from app.db.session import get_db_session
from app.domain.dashboard import DashboardDocument
from app.domain.enums import SystemRole
from app.domain.identity import (
    ApprovalStage,
    AuthenticationMethod,
    DatasetGrantAxis,
    DatasetGrantCatalogEntry,
    DatasetGrantEntry,
    DatasetGrantListResponse,
    DatasetUsagePanelEntry,
    DatasetUsageSummary,
    DatasetGrantUpsertRequest,
    HiddenResourceBehavior,
    IdentityBootstrapResponse,
    IdentityPolicy,
    PermissionPolicy,
    ResourceAclTarget,
    SessionPolicy,
    SessionTransport,
)
from app.query.registry import get_dataset_manifest_registry, list_dataset_manifests

router = APIRouter(tags=["identity"])


@router.get(
    "/identity/bootstrap",
    response_model=IdentityBootstrapResponse,
    summary="Identity and permission baseline",
)
async def get_identity_bootstrap() -> IdentityBootstrapResponse:
    return IdentityBootstrapResponse(
        identity=IdentityPolicy(
            authentication_methods=[AuthenticationMethod.EMAIL_PASSWORD],
            approval_stages=[ApprovalStage.EMAIL_VERIFICATION, ApprovalStage.ADMIN_APPROVAL],
            email_verification_required=True,
            admin_approval_required=True,
            self_signup_enabled=True,
            default_role=SystemRole.VIEWER,
            session_policy=SessionPolicy(
                access_token_transport=SessionTransport.HTTP_ONLY_COOKIE,
                access_token_ttl_minutes=15,
                refresh_token_ttl_days=14,
                rotate_refresh_tokens=True,
            ),
        ),
        permissions=PermissionPolicy(
            system_roles=list(SystemRole),
            resource_acl_targets=list(ResourceAclTarget),
            dataset_grant_axes=list(DatasetGrantAxis),
            hidden_resource_behavior=HiddenResourceBehavior(
                discovery="Hide unauthorized resources from discovery and list views.",
                editor="Do not expose unauthorized resources in reusable object pickers.",
                ai="Exclude unauthorized datasets and resources from AI tool context.",
            ),
        ),
    )


@router.get(
    "/identity/dataset-grants",
    response_model=DatasetGrantListResponse,
    summary="List dataset grants",
)
async def list_dataset_grants(
    session: Session = Depends(get_db_session),
) -> DatasetGrantListResponse:
    grants = session.scalars(select(DatasetGrantRecord)).all()
    dataset_usage_by_key = _build_dataset_usage_summary_by_key(session)
    ordered_grants = sorted(
        grants,
        key=lambda grant: (
            grant.dataset_key,
            grant.grant_axis.value,
            grant.subject_key,
            grant.created_at,
        ),
    )

    return DatasetGrantListResponse(
        catalog_datasets=[
            _to_dataset_grant_catalog_entry(
                manifest,
                dataset_usage_by_key.get(manifest.key, DatasetUsageSummary(dashboard_count=0, panel_count=0, sample_panels=[])),
            )
            for manifest in list_dataset_manifests()
        ],
        grants=[_to_dataset_grant_entry(grant) for grant in ordered_grants],
    )


@router.put(
    "/identity/dataset-grants",
    response_model=DatasetGrantEntry,
    summary="Create or reuse dataset grant",
)
async def upsert_dataset_grant(
    request: DatasetGrantUpsertRequest,
    response: Response,
    session: Session = Depends(get_db_session),
) -> DatasetGrantEntry:
    _ensure_dataset_manifest_exists(request.dataset_key)

    existing_grant = session.scalar(
        select(DatasetGrantRecord).where(
            DatasetGrantRecord.dataset_key == request.dataset_key,
            DatasetGrantRecord.grant_axis == request.grant_axis,
            DatasetGrantRecord.subject_key == request.subject_key,
        )
    )

    if existing_grant is not None:
        response.status_code = status.HTTP_200_OK
        return _to_dataset_grant_entry(existing_grant)

    grant_record = DatasetGrantRecord(
        dataset_key=request.dataset_key,
        grant_axis=request.grant_axis,
        subject_key=request.subject_key,
        granted_by=request.granted_by,
    )
    session.add(grant_record)
    session.commit()
    session.refresh(grant_record)
    response.status_code = status.HTTP_201_CREATED

    return _to_dataset_grant_entry(grant_record)


@router.delete(
    "/identity/dataset-grants/{grant_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete dataset grant",
)
async def delete_dataset_grant(
    grant_id: UUID,
    session: Session = Depends(get_db_session),
) -> Response:
    grant_record = session.get(DatasetGrantRecord, grant_id)
    if grant_record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "field": "grant_id",
                "message": f"Dataset grant '{grant_id}' was not found.",
            },
        )

    session.delete(grant_record)
    session.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _ensure_dataset_manifest_exists(dataset_key: str) -> None:
    manifest_registry = get_dataset_manifest_registry()
    if dataset_key not in manifest_registry:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "field": "dataset_key",
                "message": f"Unknown dataset '{dataset_key}'.",
            },
        )


def _to_dataset_grant_entry(grant_record: DatasetGrantRecord) -> DatasetGrantEntry:
    return DatasetGrantEntry(
        id=grant_record.id,
        dataset_key=grant_record.dataset_key,
        grant_axis=grant_record.grant_axis,
        subject_key=grant_record.subject_key,
        granted_by=grant_record.granted_by,
        created_at=grant_record.created_at,
    )


def _to_dataset_grant_catalog_entry(manifest, usage_summary: DatasetUsageSummary) -> DatasetGrantCatalogEntry:
    return DatasetGrantCatalogEntry(
        key=manifest.key,
        label=manifest.label,
        description=manifest.description,
        grant_axes=manifest.visibility.grant_axes,
        usage_summary=usage_summary,
    )


def _build_dataset_usage_summary_by_key(session: Session) -> dict[str, DatasetUsageSummary]:
    dashboard_records = session.scalars(
        select(DashboardRecord).options(selectinload(DashboardRecord.versions))
    ).all()
    dashboards_by_dataset_key: dict[str, set[str]] = defaultdict(set)
    panels_by_dataset_key: dict[str, list[DatasetUsagePanelEntry]] = defaultdict(list)

    for dashboard_record in dashboard_records:
        latest_version_record = _find_latest_dashboard_version_record(dashboard_record)
        if latest_version_record is None:
            continue

        document = DashboardDocument.model_validate(latest_version_record.document)

        for panel in document.panel_library:
            dataset_keys = {panel.dataset_key}
            if panel.query is not None:
                dataset_keys.add(panel.query.dataset_key)

            for dataset_key in dataset_keys:
                dashboards_by_dataset_key[dataset_key].add(dashboard_record.slug)
                panels_by_dataset_key[dataset_key].append(
                    DatasetUsagePanelEntry(
                        dashboard_slug=dashboard_record.slug,
                        dashboard_title=dashboard_record.title,
                        panel_id=panel.id,
                        panel_title=panel.title,
                        panel_kind=panel.kind,
                    )
                )

    return {
        dataset_key: DatasetUsageSummary(
            dashboard_count=len(dashboards_by_dataset_key[dataset_key]),
            panel_count=len(panel_entries),
            sample_panels=panel_entries[:3],
        )
        for dataset_key, panel_entries in panels_by_dataset_key.items()
    }


def _find_latest_dashboard_version_record(
    dashboard_record: DashboardRecord,
) -> DashboardVersionRecord | None:
    for version_record in dashboard_record.versions:
        if version_record.version_number == dashboard_record.latest_version_number:
            return version_record

    return None