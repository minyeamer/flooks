"""Configuration models and settings loaders for the FLooks API."""

from __future__ import annotations

from functools import lru_cache
from typing import Annotated, Any

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration for the FLooks API service.

    The service currently supports local development defaults and Docker Compose
    overrides. Metadata persistence uses `database_url`, while governed query
    execution can optionally use a separate `analytics_database_url`. Both can
    point to the local host during direct execution or to Compose services
    inside the container network.
    """

    app_name: str = "FLooks API"
    env: str = "development"
    api_v1_prefix: str = "/api/v1"
    allowed_origins: Annotated[list[str], NoDecode] = ["http://localhost:5173"]
    database_url: str = "postgresql+psycopg://flooks:flooks@localhost:5432/flooks_meta"
    analytics_database_url: str | None = None
    bootstrap_dev_analytics: bool = False

    model_config = SettingsConfigDict(
        env_prefix="FLOOKS_",
        env_file=".env",
        env_file_encoding="utf-8",
    )

    @field_validator("api_v1_prefix")
    @classmethod
    def validate_api_v1_prefix(cls, value: str) -> str:
        if not value.startswith("/"):
            raise ValueError("api_v1_prefix must start with '/'")
        return value.rstrip("/") or "/"

    @field_validator("database_url", "analytics_database_url")
    @classmethod
    def validate_database_url(cls, value: str | None) -> str | None:
        if value is None:
            return None

        normalized_value = value.strip()
        if not normalized_value:
            raise ValueError("database_url must not be empty")
        return normalized_value

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def validate_allowed_origins(cls, value: Any) -> list[str]:
        if isinstance(value, str):
            origins = [origin.strip().rstrip("/") for origin in value.split(",") if origin.strip()]
            if not origins:
                raise ValueError("allowed_origins must contain at least one origin")
            return origins

        if isinstance(value, list):
            origins = [str(origin).strip().rstrip("/") for origin in value if str(origin).strip()]
            if not origins:
                raise ValueError("allowed_origins must contain at least one origin")
            return origins

        raise TypeError("allowed_origins must be a comma-separated string or list of strings")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
