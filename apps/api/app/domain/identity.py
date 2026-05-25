"""Identity and permission domain models for the FLooks API."""

from __future__ import annotations

from enum import StrEnum
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.domain.enums import SystemRole


class AuthenticationMethod(StrEnum):
    EMAIL_PASSWORD = "email_password"


class ApprovalStage(StrEnum):
    EMAIL_VERIFICATION = "email_verification"
    ADMIN_APPROVAL = "admin_approval"


class SessionTransport(StrEnum):
    HTTP_ONLY_COOKIE = "http_only_cookie"


class ResourceAclTarget(StrEnum):
    DASHBOARD = "dashboard"
    LIBRARY_ITEM = "library-item"
    DISCUSSION = "discussion"
    REQUEST = "request"


class DatasetGrantAxis(StrEnum):
    USER = "user"
    TEAM = "team"
    DEPARTMENT = "department"
    ROLE = "role"
    WORKSPACE = "workspace"


class SessionPolicy(BaseModel):
    access_token_transport: SessionTransport
    access_token_ttl_minutes: int
    refresh_token_ttl_days: int
    rotate_refresh_tokens: bool


class IdentityPolicy(BaseModel):
    authentication_methods: list[AuthenticationMethod]
    approval_stages: list[ApprovalStage]
    email_verification_required: bool
    admin_approval_required: bool
    self_signup_enabled: bool
    default_role: SystemRole
    session_policy: SessionPolicy


class HiddenResourceBehavior(BaseModel):
    discovery: str
    editor: str
    ai: str


class PermissionPolicy(BaseModel):
    system_roles: list[SystemRole]
    resource_acl_targets: list[ResourceAclTarget]
    dataset_grant_axes: list[DatasetGrantAxis]
    hidden_resource_behavior: HiddenResourceBehavior


class IdentityBootstrapResponse(BaseModel):
    identity: IdentityPolicy
    permissions: PermissionPolicy


class DatasetGrantEntry(BaseModel):
    id: UUID
    dataset_key: str
    grant_axis: DatasetGrantAxis
    subject_key: str
    granted_by: str | None
    created_at: datetime


class DatasetUsagePanelEntry(BaseModel):
    dashboard_slug: str
    dashboard_title: str
    panel_id: str
    panel_title: str
    panel_kind: str


class DatasetUsageSummary(BaseModel):
    dashboard_count: int
    panel_count: int
    sample_panels: list[DatasetUsagePanelEntry]


class DatasetGrantCatalogEntry(BaseModel):
    key: str
    label: str
    description: str
    grant_axes: list[DatasetGrantAxis]
    usage_summary: DatasetUsageSummary


class DatasetGrantListResponse(BaseModel):
    catalog_datasets: list[DatasetGrantCatalogEntry]
    grants: list[DatasetGrantEntry]


class DatasetGrantUpsertRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    dataset_key: str = Field(min_length=1)
    grant_axis: DatasetGrantAxis
    subject_key: str = Field(min_length=1)
    granted_by: str | None = Field(default=None, min_length=1)