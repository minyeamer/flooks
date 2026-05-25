"""Dashboard document and CRUD API models for versioned persistence.

These models mirror the first shared dashboard document contract closely enough
for the backend to persist and return typed dashboard revisions while the full
frontend editing flow is still being built.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.domain.enums import DataSourceKind, SystemRole
from app.domain.persistence import DashboardVersionStatus, PrincipalKind
from app.domain.query import MetricAggregate, SortDirection

PanelKind = Literal["table", "scorecard", "line", "bar", "pie", "notice"]


def to_camel(value: str) -> str:
    """Convert `snake_case` field names into `camelCase` aliases."""

    head, *tail = value.split("_")
    return head + "".join(part.capitalize() for part in tail)


class DashboardModel(BaseModel):
    """Base model that serializes dashboard contracts in camelCase."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class DashboardSnapGrid(DashboardModel):
    column_width: int = Field(ge=1)
    row_height: int = Field(ge=1)


class DashboardPanelPlacement(DashboardModel):
    panel_id: str
    x: int = Field(ge=0)
    y: int = Field(ge=0)
    width: int = Field(ge=1)
    height: int = Field(ge=1)
    z_index: int = Field(ge=0)


class DashboardPage(DashboardModel):
    id: str
    title: str
    width: int = Field(ge=1)
    height: int = Field(ge=1)
    snap_grid: DashboardSnapGrid
    placements: list[DashboardPanelPlacement] = Field(default_factory=list)


class DashboardPanelMetricSpec(DashboardModel):
    key: str
    aggregate: MetricAggregate


class DashboardPanelSortSpec(DashboardModel):
    field: str
    direction: SortDirection


class DashboardPanelQuerySpec(DashboardModel):
    dataset_key: str
    dimensions: list[str] = Field(default_factory=list)
    metrics: list[DashboardPanelMetricSpec] = Field(min_length=1)
    sort: list[DashboardPanelSortSpec] = Field(default_factory=list)
    limit: int | None = Field(default=None, ge=1, le=50_000)


class DashboardScorecardPanelConfig(DashboardModel):
    description: str
    value_field: str
    value_prefix: str | None = None
    value_suffix: str | None = None


class DashboardTablePanelConfig(DashboardModel):
    description: str
    columns: list[str] = Field(min_length=1)


class DashboardPanelRef(DashboardModel):
    id: str
    key: str
    kind: PanelKind
    title: str
    dataset_key: str
    by_reference: bool
    query: DashboardPanelQuerySpec | None = None
    scorecard: DashboardScorecardPanelConfig | None = None
    table: DashboardTablePanelConfig | None = None


class DashboardDocument(DashboardModel):
    id: str
    key: str
    title: str
    version: int = Field(ge=1)
    owner_role_boundary: SystemRole
    supported_data_sources: list[DataSourceKind] = Field(min_length=1)
    pages: list[DashboardPage] = Field(min_length=1)
    panel_library: list[DashboardPanelRef] = Field(default_factory=list)


class DashboardVersionSummary(DashboardModel):
    version_number: int
    status: DashboardVersionStatus
    summary: str | None
    created_by: str
    created_at: datetime


class DashboardSummary(DashboardModel):
    id: str
    slug: str
    title: str
    description: str | None
    owner_principal_kind: PrincipalKind
    owner_principal_key: str
    latest_version_number: int
    latest_version_status: DashboardVersionStatus
    latest_version_summary: str | None
    published_version_count: int
    latest_published_version_number: int | None
    archived_version_count: int
    latest_archived_version_number: int | None
    created_at: datetime
    updated_at: datetime


class DashboardResponse(DashboardSummary):
    document: DashboardDocument
    versions: list[DashboardVersionSummary]


class DashboardCreateRequest(DashboardModel):
    slug: str
    description: str | None = None
    owner_principal_kind: PrincipalKind
    owner_principal_key: str
    created_by: str
    summary: str | None = None
    status: DashboardVersionStatus = DashboardVersionStatus.DRAFT
    document: DashboardDocument


class DashboardUpdateRequest(DashboardModel):
    created_by: str
    summary: str | None = None
    status: DashboardVersionStatus = DashboardVersionStatus.DRAFT
    description: str | None = None
    document: DashboardDocument


STARTER_DASHBOARD_ID = "db-home"
STARTER_DASHBOARD_SLUG = "commerce-home"


def build_starter_dashboard_document(
    *,
    version: int = 1,
    title: str = "Commerce Executive Overview",
    key: str = STARTER_DASHBOARD_SLUG,
) -> DashboardDocument:
    """Return the canonical starter dashboard document used for bootstrap flows."""

    return DashboardDocument(
        id=STARTER_DASHBOARD_ID,
        key=key,
        title=title,
        version=version,
        owner_role_boundary=SystemRole.ADMIN,
        supported_data_sources=[DataSourceKind.POSTGRES],
        pages=[
            DashboardPage(
                id="page-overview",
                title="Overview",
                width=1600,
                height=900,
                snap_grid=DashboardSnapGrid(column_width=20, row_height=20),
                placements=[
                    DashboardPanelPlacement(
                        panel_id="panel-gmv",
                        x=40,
                        y=40,
                        width=300,
                        height=180,
                        z_index=1,
                    ),
                    DashboardPanelPlacement(
                        panel_id="panel-revenue",
                        x=360,
                        y=40,
                        width=300,
                        height=180,
                        z_index=1,
                    ),
                    DashboardPanelPlacement(
                        panel_id="panel-ops-notice",
                        x=680,
                        y=40,
                        width=880,
                        height=180,
                        z_index=1,
                    ),
                    DashboardPanelPlacement(
                        panel_id="panel-channel-table",
                        x=40,
                        y=240,
                        width=720,
                        height=260,
                        z_index=1,
                    ),
                    DashboardPanelPlacement(
                        panel_id="panel-channel-bar",
                        x=780,
                        y=240,
                        width=360,
                        height=260,
                        z_index=1,
                    ),
                    DashboardPanelPlacement(
                        panel_id="panel-channel-pie",
                        x=1160,
                        y=240,
                        width=400,
                        height=260,
                        z_index=1,
                    ),
                    DashboardPanelPlacement(
                        panel_id="panel-revenue-trend",
                        x=40,
                        y=520,
                        width=1520,
                        height=280,
                        z_index=1,
                    ),
                ],
            )
        ],
        panel_library=[
            DashboardPanelRef(
                id="panel-gmv",
                key="gmv-scorecard",
                kind="scorecard",
                title="GMV",
                dataset_key="mart_commerce_daily",
                by_reference=True,
                query=DashboardPanelQuerySpec(
                    dataset_key="mart_commerce_daily",
                    dimensions=[],
                    metrics=[DashboardPanelMetricSpec(key="gmv", aggregate=MetricAggregate.SUM)],
                    limit=1,
                ),
                scorecard=DashboardScorecardPanelConfig(
                    description="Total GMV returned by the governed query execution path.",
                    value_field="gmv",
                    value_prefix="$",
                ),
            ),
            DashboardPanelRef(
                id="panel-revenue",
                key="revenue-scorecard",
                kind="scorecard",
                title="Revenue",
                dataset_key="mart_commerce_daily",
                by_reference=True,
                query=DashboardPanelQuerySpec(
                    dataset_key="mart_commerce_daily",
                    dimensions=[],
                    metrics=[DashboardPanelMetricSpec(key="revenue", aggregate=MetricAggregate.SUM)],
                    limit=1,
                ),
                scorecard=DashboardScorecardPanelConfig(
                    description="Net revenue total executed from the starter dashboard document.",
                    value_field="revenue",
                    value_prefix="$",
                ),
            ),
            DashboardPanelRef(
                id="panel-channel-table",
                key="channel-revenue-table",
                kind="table",
                title="Revenue by Channel",
                dataset_key="mart_commerce_daily",
                by_reference=True,
                query=DashboardPanelQuerySpec(
                    dataset_key="mart_commerce_daily",
                    dimensions=["channel_name"],
                    metrics=[DashboardPanelMetricSpec(key="revenue", aggregate=MetricAggregate.SUM)],
                    sort=[DashboardPanelSortSpec(field="revenue", direction=SortDirection.DESC)],
                    limit=5,
                ),
                table=DashboardTablePanelConfig(
                    description="Top channels ranked by revenue from the live governed query response.",
                    columns=["channel_name", "revenue"],
                ),
            ),
            DashboardPanelRef(
                id="panel-channel-bar",
                key="channel-revenue-bar",
                kind="bar",
                title="Revenue Mix by Channel",
                dataset_key="mart_commerce_daily",
                by_reference=True,
                query=DashboardPanelQuerySpec(
                    dataset_key="mart_commerce_daily",
                    dimensions=["channel_name"],
                    metrics=[DashboardPanelMetricSpec(key="revenue", aggregate=MetricAggregate.SUM)],
                    sort=[DashboardPanelSortSpec(field="revenue", direction=SortDirection.DESC)],
                    limit=5,
                ),
            ),
            DashboardPanelRef(
                id="panel-channel-pie",
                key="channel-orders-pie",
                kind="pie",
                title="Orders Share by Channel",
                dataset_key="mart_commerce_daily",
                by_reference=True,
                query=DashboardPanelQuerySpec(
                    dataset_key="mart_commerce_daily",
                    dimensions=["channel_name"],
                    metrics=[DashboardPanelMetricSpec(key="orders", aggregate=MetricAggregate.SUM)],
                    sort=[DashboardPanelSortSpec(field="orders", direction=SortDirection.DESC)],
                    limit=5,
                ),
            ),
            DashboardPanelRef(
                id="panel-revenue-trend",
                key="revenue-trend-line",
                kind="line",
                title="Revenue Trend",
                dataset_key="mart_commerce_daily",
                by_reference=True,
                query=DashboardPanelQuerySpec(
                    dataset_key="mart_commerce_daily",
                    dimensions=["order_date"],
                    metrics=[DashboardPanelMetricSpec(key="revenue", aggregate=MetricAggregate.SUM)],
                    sort=[DashboardPanelSortSpec(field="order_date", direction=SortDirection.ASC)],
                    limit=7,
                ),
            ),
            DashboardPanelRef(
                id="panel-ops-notice",
                key="ops-notice",
                kind="notice",
                title="Operations Notice",
                dataset_key="mart_commerce_daily",
                by_reference=True,
                query=DashboardPanelQuerySpec(
                    dataset_key="mart_commerce_daily",
                    dimensions=["channel_name"],
                    metrics=[DashboardPanelMetricSpec(key="orders", aggregate=MetricAggregate.SUM)],
                    sort=[DashboardPanelSortSpec(field="orders", direction=SortDirection.DESC)],
                    limit=1,
                ),
            ),
        ],
    )