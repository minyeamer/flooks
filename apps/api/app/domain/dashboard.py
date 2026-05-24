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


class DashboardPanelRef(DashboardModel):
    id: str
    key: str
    kind: PanelKind
    title: str
    dataset_key: str
    by_reference: bool


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