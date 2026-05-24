"""Health-check routes for the FLooks API."""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    service: str

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse, summary="Health check")
async def get_health() -> HealthResponse:
    return HealthResponse(status="ok", service="flooks-api")
