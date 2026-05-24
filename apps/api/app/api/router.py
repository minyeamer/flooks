"""API router composition for the FLooks FastAPI service."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.routes import health, identity, metadata, overview, query, system

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(identity.router)
api_router.include_router(metadata.router)
api_router.include_router(overview.router)
api_router.include_router(query.router)
api_router.include_router(system.router)
