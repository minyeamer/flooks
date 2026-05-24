"""Overview routes that describe the current FLooks bootstrap state."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import settings
from app.domain.enums import DataSourceKind, ModuleKey, SystemRole

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

    return OverviewResponse(
        product="FLooks",
        environment=settings.env,
        headline="Bootstrap slice is live",
        summary=(
            "The web shell now has a live API surface for roadmap, readiness, and service links "
            "while the identity, metadata, and governed-query layers are added."
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
                label="Live endpoints",
                value="6",
                note="Health, system, identity bootstrap, metadata bootstrap, overview, and OpenAPI docs are now runnable surfaces.",
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
                status="in_progress",
                outcome="Dataset manifests and QuerySpec execution are now the next runtime slice for panels and AI tools.",
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