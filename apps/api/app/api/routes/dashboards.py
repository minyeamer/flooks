"""Dashboard CRUD routes backed by the metadata persistence schema."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.models import DashboardRecord, DashboardVersionRecord
from app.db.session import get_db_session
from app.domain.dashboard import (
    DashboardCreateRequest,
    DashboardDocument,
    DashboardResponse,
    DashboardSummary,
    DashboardUpdateRequest,
    DashboardVersionSummary,
)

router = APIRouter(tags=["dashboards"])


@router.get(
    "/dashboards",
    response_model=list[DashboardSummary],
    summary="List dashboards",
)
async def list_dashboards(session: Session = Depends(get_db_session)) -> list[DashboardSummary]:
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
    dashboard_record = _get_dashboard_record(session, slug)

    session.delete(dashboard_record)
    session.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _load_dashboard_response(session: Session, slug: str, version: int | None = None) -> DashboardResponse:
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
    latest_version = _get_version_record(dashboard_record, None)

    return DashboardSummary(
        id=str(dashboard_record.id),
        slug=dashboard_record.slug,
        title=dashboard_record.title,
        description=dashboard_record.description,
        owner_principal_kind=dashboard_record.owner_principal_kind,
        owner_principal_key=dashboard_record.owner_principal_key,
        latest_version_number=dashboard_record.latest_version_number,
        latest_version_status=latest_version.status,
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