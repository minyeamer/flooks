"""Overview routes that describe the current FLooks bootstrap state."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import settings
from app.domain.enums import DataSourceKind, ModuleKey, SystemRole
from app.query.registry import list_dataset_manifests

router = APIRouter(tags=["overview"])


class OverviewMetric(BaseModel):
    label: str
    value: str
    note: str


class DeliveryStep(BaseModel):
    id: str
    title: str
    status: Literal["done", "in_progress", "next"]
    outcome: str


class ServiceLink(BaseModel):
    label: str
    href: str
    description: str


class OverviewResponse(BaseModel):
    product: str
    environment: str
    headline: str
    summary: str
    metrics: list[OverviewMetric]
    execution_plan: list[DeliveryStep]
    service_links: list[ServiceLink]


@router.get(
    "/overview",
    response_model=OverviewResponse,
    summary="Bootstrap overview for the live web shell",
)
async def get_overview() -> OverviewResponse:
    api_prefix = settings.api_v1_prefix
    dataset_count = len(list_dataset_manifests())

    return OverviewResponse(
        product="FLooks",
        environment=settings.env,
        headline="Bootstrap slice is live",
        summary=(
            "The web shell now has a live API surface for roadmap, readiness, service links, "
            "human-readable API reference data, and dashboard CRUD/versioning while the identity, "
            "metadata, and governed-query layers are added."
        ),
        metrics=[
            OverviewMetric(
                label="System roles",
                value=str(len(SystemRole)),
                note="Permission baselines already exposed by the API contract.",
            ),
            OverviewMetric(
                label="Data sources",
                value=str(len(DataSourceKind)),
                note="Linkmerce PostgreSQL remains the first governed connector path.",
            ),
            OverviewMetric(
                label="Platform modules",
                value=str(len(ModuleKey)),
                note="Auth, dashboards, catalog, discussions, and AI stay separated.",
            ),
            OverviewMetric(
                label="Metadata tables",
                value="4",
                note="Dashboards, versions, ACL entries, and dataset grants now have relational storage models.",
            ),
            OverviewMetric(
                label="Governed datasets",
                value=str(dataset_count),
                note="Starter dataset manifests now define the allowed fields, metrics, and limits for QuerySpec validation.",
            ),
            OverviewMetric(
                label="Live endpoints",
                value="14",
                note="Health, system, identity bootstrap, metadata bootstrap, query bootstrap, query validation, dashboard list/create/detail/update/delete, overview, API reference, and OpenAPI docs are now runnable surfaces.",
            ),
        ],
        execution_plan=[
            DeliveryStep(
                id="live-bootstrap",
                title="Live bootstrap overview",
                status="done",
                outcome="The web shell can render live API data instead of only static seed content.",
            ),
            DeliveryStep(
                id="identity-and-permissions",
                title="Identity and permissions skeleton",
                status="done",
                outcome="Bootstrap policy routes now expose email auth, approval stages, and permission evaluation rules.",
            ),
            DeliveryStep(
                id="metadata-persistence",
                title="Metadata persistence",
                status="done",
                outcome="SQLAlchemy models and an Alembic baseline now define the first dashboard and access-control tables.",
            ),
            DeliveryStep(
                id="governed-query",
                title="Governed query execution",
                status="done",
                outcome="Dataset manifests and QuerySpec validation now define the governed query contract before connector execution is added.",
            ),
            DeliveryStep(
                id="dashboard-crud",
                title="Dashboard CRUD and persistence",
                status="done",
                outcome="Dashboard create, list, read, version creation, and delete routes now persist versioned dashboard documents on top of the metadata schema.",
            ),
            DeliveryStep(
                id="connector-query-execution",
                title="Connector-backed query execution",
                status="in_progress",
                outcome="The next runtime slice is turning validated QuerySpec requests into connector executions against the first database-backed marts.",
            ),
        ],
        service_links=[
            ServiceLink(
                label="Health",
                href=f"{api_prefix}/health",
                description="Fast smoke test for the API container.",
            ),
            ServiceLink(
                label="System",
                href=f"{api_prefix}/system",
                description="Static bootstrap metadata used by clients and docs.",
            ),
            ServiceLink(
                label="Identity Bootstrap",
                href=f"{api_prefix}/identity/bootstrap",
                description="Identity, approval, and permission policy baseline for future auth flows.",
            ),
            ServiceLink(
                label="Metadata Bootstrap",
                href=f"{api_prefix}/metadata/bootstrap",
                description="Persistence baseline for SQLAlchemy models and the first Alembic revision.",
            ),
            ServiceLink(
                label="Dashboards",
                href=f"{api_prefix}/dashboards",
                description="Dashboard CRUD collection endpoint for versioned dashboard documents.",
            ),
            ServiceLink(
                label="Query Bootstrap",
                href=f"{api_prefix}/query/bootstrap",
                description="Starter dataset manifest registry for the governed query contract.",
            ),
            ServiceLink(
                label="Query Validate",
                href="/docs#/query/validate_query_validate_post",
                description="Submit a QuerySpec payload to validate it against the manifest registry.",
            ),
            ServiceLink(
                label="API Reference",
                href=f"{api_prefix}/reference/apis",
                description="Structured endpoint documentation for parameters, response fields, and payload examples.",
            ),
            ServiceLink(
                label="Overview",
                href=f"{api_prefix}/overview",
                description="Live bootstrap payload consumed by the web shell.",
            ),
            ServiceLink(
                label="OpenAPI",
                href="/docs",
                description="Interactive API documentation for manual inspection.",
            ),
        ],
    )