"""Identity and permissions bootstrap routes for the FLooks API."""

from __future__ import annotations

from fastapi import APIRouter

from app.domain.enums import SystemRole
from app.domain.identity import (
    ApprovalStage,
    AuthenticationMethod,
    DatasetGrantAxis,
    HiddenResourceBehavior,
    IdentityBootstrapResponse,
    IdentityPolicy,
    PermissionPolicy,
    ResourceAclTarget,
    SessionPolicy,
    SessionTransport,
)

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