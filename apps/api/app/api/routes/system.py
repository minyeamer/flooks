from fastapi import APIRouter

from ... import __version__
from ...core.config import settings
from ...domain.enums import DataSourceKind, ModuleKey, SystemRole

router = APIRouter(tags=["system"])


@router.get("/system", summary="Bootstrap metadata")
async def get_system_metadata() -> dict[str, object]:
    return {
        "name": settings.app_name,
        "version": __version__,
        "environment": settings.env,
        "apiPrefix": settings.api_v1_prefix,
        "roles": [role.value for role in SystemRole],
        "dataSources": [kind.value for kind in DataSourceKind],
        "modules": [module.value for module in ModuleKey],
    }
