"""System metadata routes for the FLooks API."""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict, Field

from app import __version__
from app.core.config import settings
from app.domain.enums import DataSourceKind, ModuleKey, SystemRole


class SystemMetadataResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str
    version: str
    environment: str
    api_prefix: str = Field(serialization_alias="apiPrefix")
    roles: list[SystemRole]
    data_sources: list[DataSourceKind] = Field(serialization_alias="dataSources")
    modules: list[ModuleKey]

router = APIRouter(tags=["system"])


@router.get("/system", response_model=SystemMetadataResponse, summary="Bootstrap metadata")
async def get_system_metadata() -> SystemMetadataResponse:
    return SystemMetadataResponse(
        name=settings.app_name,
        version=__version__,
        environment=settings.env,
        api_prefix=settings.api_v1_prefix,
        roles=list(SystemRole),
        data_sources=list(DataSourceKind),
        modules=list(ModuleKey),
    )
