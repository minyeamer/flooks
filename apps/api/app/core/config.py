from functools import lru_cache
from typing import Annotated, Any

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "FLooks API"
    env: str = "development"
    api_v1_prefix: str = "/api/v1"
    allowed_origins: Annotated[list[str], NoDecode] = ["http://localhost:5173"]

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
