"""Application entrypoint for the FLooks FastAPI service."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app import __version__
from app.api.router import api_router
from app.core.config import settings
from app.query.dev_seed import bootstrap_development_analytics_marts


class LivenessResponse(BaseModel):
    status: str


@asynccontextmanager
async def app_lifespan(_app: FastAPI):
    if settings.bootstrap_dev_analytics:
        bootstrap_development_analytics_marts()

    yield


app = FastAPI(
    title=settings.app_name,
    version=__version__,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=app_lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.get("/livez", response_model=LivenessResponse, summary="Liveness probe")
async def livez() -> LivenessResponse:
    return LivenessResponse(status="alive")
