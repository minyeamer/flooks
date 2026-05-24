"""Metadata persistence bootstrap routes for the FLooks API.

These routes expose the first relational storage slice so the frontend, humans,
and automated tooling can inspect which metadata tables and Alembic baseline are
expected before richer CRUD endpoints arrive.
"""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from app.db.base import Base
from app.db import models as metadata_models
from app.db.session import get_database_url

EXPECTED_METADATA_REVISION = "20260524_0001"

router = APIRouter(tags=["metadata"])


class MetadataTable(BaseModel):
    name: str


class MetadataBootstrapResponse(BaseModel):
    dialect: str
    driver: str
    host: str | None
    database: str | None
    expected_revision: str
    tables: list[MetadataTable]


@router.get(
    "/metadata/bootstrap",
    response_model=MetadataBootstrapResponse,
    summary="Metadata persistence baseline",
)
async def get_metadata_bootstrap() -> MetadataBootstrapResponse:
    _ = metadata_models
    database_url = get_database_url()
    table_names = sorted(Base.metadata.tables.keys())

    return MetadataBootstrapResponse(
        dialect=database_url.get_backend_name(),
        driver=database_url.get_driver_name(),
        host=database_url.host,
        database=database_url.database,
        expected_revision=EXPECTED_METADATA_REVISION,
        tables=[MetadataTable(name=table_name) for table_name in table_names],
    )