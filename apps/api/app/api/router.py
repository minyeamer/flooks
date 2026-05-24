from fastapi import APIRouter

from .routes import health, overview, system

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(overview.router)
api_router.include_router(system.router)
