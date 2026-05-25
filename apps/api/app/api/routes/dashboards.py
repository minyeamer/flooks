"""Dashboard CRUD routes backed by the metadata persistence schema."""

from __future__ import annotations

from weakref import WeakSet

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.models import DashboardRecord, DashboardVersionRecord
from app.db.session import get_db_session
from app.domain.dashboard import (
    STARTER_DASHBOARD_SLUG,
    DashboardCreateRequest,
    DashboardDocument,
    DashboardResponse,
    DashboardSummary,
    DashboardUpdateRequest,
    DashboardVersionSummary,
    build_starter_dashboard_document,
)
from app.domain.persistence import DashboardVersionStatus, PrincipalKind

router = APIRouter(tags=["dashboards"])
_SEEDED_DASHBOARD_BINDS: WeakSet[object] = WeakSet()
_STARTER_DASHBOARD_CREATED_BY = "system-bootstrap"
_STARTER_DASHBOARD_DESCRIPTION = "Starter executive dashboard seeded for the first runtime session."
_AUTO_MANAGED_STARTER_SUMMARIES = {
    "Bootstrap starter dashboard seeded automatically.",
    "Canonical starter dashboard refreshed automatically.",
}


@router.get(
    "/dashboards",
    response_model=list[DashboardSummary],
    summary="List dashboards",
)
async def list_dashboards(session: Session = Depends(get_db_session)) -> list[DashboardSummary]:
    _ensure_starter_dashboard_seeded(session)

    records = session.scalars(
        select(DashboardRecord)
        .options(selectinload(DashboardRecord.versions))
        .order_by(DashboardRecord.updated_at.desc())
    ).all()

    return [_to_dashboard_summary(record) for record in records]


@router.post(
    "/dashboards",
    response_model=DashboardResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create dashboard",
)
async def create_dashboard(
    request: DashboardCreateRequest,
    session: Session = Depends(get_db_session),
) -> DashboardResponse:
    _mark_dashboard_store_initialized(session)
    _ensure_document_key_matches_slug(request.slug, request.document.key)

    existing_record = session.scalar(select(DashboardRecord.id).where(DashboardRecord.slug == request.slug))
    if existing_record is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"field": "slug", "message": f"Dashboard slug '{request.slug}' already exists."},
        )

    document = request.document.model_copy(update={"key": request.slug, "version": 1})
    version_record = DashboardVersionRecord(
        version_number=1,
        status=request.status,
        document=document.model_dump(mode="json", by_alias=True),
        summary=request.summary,
        created_by=request.created_by,
    )
    dashboard_record = DashboardRecord(
        slug=request.slug,
        title=document.title,
        description=request.description,
        owner_principal_kind=request.owner_principal_kind,
        owner_principal_key=request.owner_principal_key,
        latest_version_number=1,
        versions=[version_record],
    )

    session.add(dashboard_record)
    session.commit()

    return _load_dashboard_response(session, request.slug)


@router.get(
    "/dashboards/{slug}",
    response_model=DashboardResponse,
    summary="Get dashboard",
)
async def get_dashboard(
    slug: str,
    version: int | None = Query(default=None, ge=1),
    session: Session = Depends(get_db_session),
) -> DashboardResponse:
    return _load_dashboard_response(session, slug, version)


@router.post(
    "/dashboards/{slug}/refresh-starter",
    response_model=DashboardResponse,
    summary="Refresh starter dashboard",
)
async def refresh_starter_dashboard(
    slug: str,
    session: Session = Depends(get_db_session),
) -> DashboardResponse:
    _mark_dashboard_store_initialized(session)

    if slug != STARTER_DASHBOARD_SLUG:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "field": "slug",
                "message": f"Starter refresh is only supported for dashboard '{STARTER_DASHBOARD_SLUG}'.",
            },
        )

    _seed_or_refresh_starter_dashboard(session)

    return _load_dashboard_response(session, slug)


@router.put(
    "/dashboards/{slug}",
    response_model=DashboardResponse,
    summary="Create dashboard version",
)
async def update_dashboard(
    slug: str,
    request: DashboardUpdateRequest,
    session: Session = Depends(get_db_session),
) -> DashboardResponse:
    _mark_dashboard_store_initialized(session)
    _ensure_document_key_matches_slug(slug, request.document.key)

    dashboard_record = _get_dashboard_record(session, slug)
    current_version_record = _get_version_record(dashboard_record, None)
    current_document = _parse_dashboard_document(current_version_record)
    next_version_number = dashboard_record.latest_version_number + 1
    next_document = request.document.model_copy(
        update={
            "id": current_document.id,
            "key": slug,
            "version": next_version_number,
        }
    )

    dashboard_record.title = next_document.title
    if request.description is not None:
        dashboard_record.description = request.description
    dashboard_record.latest_version_number = next_version_number
    dashboard_record.versions.append(
        DashboardVersionRecord(
            version_number=next_version_number,
            status=request.status,
            document=next_document.model_dump(mode="json", by_alias=True),
            summary=request.summary,
            created_by=request.created_by,
        )
    )

    session.add(dashboard_record)
    session.commit()

    return _load_dashboard_response(session, slug)


@router.delete(
    "/dashboards/{slug}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete dashboard",
)
async def delete_dashboard(slug: str, session: Session = Depends(get_db_session)) -> Response:
    _mark_dashboard_store_initialized(session)
    dashboard_record = _get_dashboard_record(session, slug)

    session.delete(dashboard_record)
    session.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _load_dashboard_response(session: Session, slug: str, version: int | None = None) -> DashboardResponse:
    _ensure_starter_dashboard_seeded(session, slug)

    dashboard_record = _get_dashboard_record(session, slug)
    version_record = _get_version_record(dashboard_record, version)

    return DashboardResponse(
        **_to_dashboard_summary(dashboard_record).model_dump(),
        document=_parse_dashboard_document(version_record),
        versions=[_to_dashboard_version_summary(record) for record in _sorted_versions(dashboard_record)],
    )


def _get_dashboard_record(session: Session, slug: str) -> DashboardRecord:
    dashboard_record = session.scalar(
        select(DashboardRecord)
        .options(selectinload(DashboardRecord.versions))
        .where(DashboardRecord.slug == slug)
    )

    if dashboard_record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"field": "slug", "message": f"Dashboard '{slug}' was not found."},
        )

    return dashboard_record


def _get_version_record(dashboard_record: DashboardRecord, version: int | None) -> DashboardVersionRecord:
    versions = _sorted_versions(dashboard_record)

    if version is None:
        return versions[-1]

    for version_record in versions:
        if version_record.version_number == version:
            return version_record

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={
            "field": "version",
            "message": f"Dashboard '{dashboard_record.slug}' does not have version '{version}'.",
        },
    )


def _sorted_versions(dashboard_record: DashboardRecord) -> list[DashboardVersionRecord]:
    return sorted(dashboard_record.versions, key=lambda version_record: version_record.version_number)


def _to_dashboard_summary(dashboard_record: DashboardRecord) -> DashboardSummary:
    versions = _sorted_versions(dashboard_record)
    latest_version = versions[-1]
    published_versions = [
        version_record for version_record in versions if version_record.status == DashboardVersionStatus.PUBLISHED
    ]
    archived_versions = [
        version_record for version_record in versions if version_record.status == DashboardVersionStatus.ARCHIVED
    ]

    return DashboardSummary(
        id=str(dashboard_record.id),
        slug=dashboard_record.slug,
        title=dashboard_record.title,
        description=dashboard_record.description,
        owner_principal_kind=dashboard_record.owner_principal_kind,
        owner_principal_key=dashboard_record.owner_principal_key,
        latest_version_number=dashboard_record.latest_version_number,
        latest_version_status=latest_version.status,
        published_version_count=len(published_versions),
        latest_published_version_number=
        published_versions[-1].version_number if published_versions else None,
        archived_version_count=len(archived_versions),
        latest_archived_version_number=
        archived_versions[-1].version_number if archived_versions else None,
        created_at=dashboard_record.created_at,
        updated_at=dashboard_record.updated_at,
    )


def _to_dashboard_version_summary(version_record: DashboardVersionRecord) -> DashboardVersionSummary:
    return DashboardVersionSummary(
        version_number=version_record.version_number,
        status=version_record.status,
        summary=version_record.summary,
        created_by=version_record.created_by,
        created_at=version_record.created_at,
    )


def _parse_dashboard_document(version_record: DashboardVersionRecord) -> DashboardDocument:
    return DashboardDocument.model_validate(version_record.document)


def _ensure_document_key_matches_slug(slug: str, document_key: str) -> None:
    if slug != document_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "field": "document.key",
                "message": f"Dashboard document key '{document_key}' must match slug '{slug}'.",
            },
        )


def _ensure_starter_dashboard_seeded(session: Session, slug: str | None = None) -> None:
    bind = session.get_bind()

    if slug is not None and slug != STARTER_DASHBOARD_SLUG:
        return

    starter_record = _get_starter_dashboard_record(session)

    if starter_record is not None:
        if _should_refresh_starter_dashboard(starter_record):
            _refresh_starter_dashboard(session, starter_record)

        _SEEDED_DASHBOARD_BINDS.add(bind)
        return

    has_any_dashboards = session.scalar(select(DashboardRecord.id).limit(1)) is not None

    if has_any_dashboards:
        _SEEDED_DASHBOARD_BINDS.add(bind)
        return

    if bind in _SEEDED_DASHBOARD_BINDS:
        return

    _create_starter_dashboard(session)
    _SEEDED_DASHBOARD_BINDS.add(bind)


def _mark_dashboard_store_initialized(session: Session) -> None:
    _SEEDED_DASHBOARD_BINDS.add(session.get_bind())


def _get_starter_dashboard_record(session: Session) -> DashboardRecord | None:
    return session.scalar(
        select(DashboardRecord)
        .options(selectinload(DashboardRecord.versions))
        .where(DashboardRecord.slug == STARTER_DASHBOARD_SLUG)
    )


def _create_starter_dashboard(session: Session) -> None:
    starter_document = build_starter_dashboard_document()
    starter_version = DashboardVersionRecord(
        version_number=1,
        status=DashboardVersionStatus.DRAFT,
        document=starter_document.model_dump(mode="json", by_alias=True),
        summary="Bootstrap starter dashboard seeded automatically.",
        created_by=_STARTER_DASHBOARD_CREATED_BY,
    )
    starter_record = DashboardRecord(
        slug=STARTER_DASHBOARD_SLUG,
        title=starter_document.title,
        description=_STARTER_DASHBOARD_DESCRIPTION,
        owner_principal_kind=PrincipalKind.USER,
        owner_principal_key=_STARTER_DASHBOARD_CREATED_BY,
        latest_version_number=1,
        versions=[starter_version],
    )

    session.add(starter_record)
    session.commit()


def _seed_or_refresh_starter_dashboard(session: Session) -> None:
    starter_record = _get_starter_dashboard_record(session)

    if starter_record is None:
        _create_starter_dashboard(session)
        return

    if not _is_auto_managed_starter_dashboard(starter_record):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "field": "slug",
                "message": f"Starter dashboard '{STARTER_DASHBOARD_SLUG}' is user-managed and cannot be refreshed from the canonical seed.",
            },
        )

    if _should_refresh_starter_dashboard(starter_record):
        _refresh_starter_dashboard(session, starter_record)


def _should_refresh_starter_dashboard(dashboard_record: DashboardRecord) -> bool:
    if not _is_auto_managed_starter_dashboard(dashboard_record):
        return False

    versions = _sorted_versions(dashboard_record)
    latest_version = versions[-1]
    current_document = _parse_dashboard_document(latest_version)
    expected_document = build_starter_dashboard_document(version=latest_version.version_number)

    return current_document != expected_document


def _is_auto_managed_starter_dashboard(dashboard_record: DashboardRecord) -> bool:
    versions = _sorted_versions(dashboard_record)

    return (
        len(versions) > 0
        and dashboard_record.owner_principal_kind == PrincipalKind.USER
        and dashboard_record.owner_principal_key == _STARTER_DASHBOARD_CREATED_BY
        and all(_is_auto_managed_starter_version(version) for version in versions)
    )


def _is_auto_managed_starter_version(version_record: DashboardVersionRecord) -> bool:
    return (
        version_record.created_by == _STARTER_DASHBOARD_CREATED_BY
        and version_record.summary in _AUTO_MANAGED_STARTER_SUMMARIES
    )


def _refresh_starter_dashboard(session: Session, dashboard_record: DashboardRecord) -> None:
    latest_version = _get_version_record(dashboard_record, None)
    next_version_number = dashboard_record.latest_version_number + 1
    starter_document = build_starter_dashboard_document(version=next_version_number)

    dashboard_record.title = starter_document.title
    dashboard_record.description = _STARTER_DASHBOARD_DESCRIPTION
    dashboard_record.latest_version_number = next_version_number
    dashboard_record.versions.append(
        DashboardVersionRecord(
            version_number=next_version_number,
            status=latest_version.status,
            document=starter_document.model_dump(mode="json", by_alias=True),
            summary="Canonical starter dashboard refreshed automatically.",
            created_by=_STARTER_DASHBOARD_CREATED_BY,
        )
    )

    session.add(dashboard_record)
    session.commit()