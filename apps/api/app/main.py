"""Application entrypoint for the FLooks FastAPI service."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app import __version__
from app.api.router import api_router
from app.core.config import settings


class LivenessResponse(BaseModel):
    status: str

app = FastAPI(
    title=settings.app_name,
    version=__version__,
    docs_url="/docs",
    redoc_url="/redoc",
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
