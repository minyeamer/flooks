"""Database engine and session helpers for FLooks persistence contracts.

Metadata persistence and governed query execution can share one database URL or
use separate URLs. This module centralizes both engine paths so runtime code,
tests, and Alembic stay aligned.
"""

from __future__ import annotations

from collections.abc import Generator
from functools import lru_cache

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.engine.url import URL, make_url
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings


@lru_cache
def get_engine() -> Engine:
    return create_engine(settings.database_url, pool_pre_ping=True)


@lru_cache
def get_analytics_engine() -> Engine:
    return create_engine(
        get_analytics_database_url().render_as_string(hide_password=False),
        pool_pre_ping=True,
    )


@lru_cache
def get_session_factory() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), class_=Session, autoflush=False, expire_on_commit=False)


def get_database_url() -> URL:
    return make_url(settings.database_url)


def get_analytics_database_url() -> URL:
    return make_url(settings.analytics_database_url or settings.database_url)


def get_db_session() -> Generator[Session, None, None]:
    session_factory = get_session_factory()
    session = session_factory()
    try:
        yield session
    finally:
        session.close()