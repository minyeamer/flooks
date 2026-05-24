"""Identity and permission domain models for the FLooks API."""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel

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