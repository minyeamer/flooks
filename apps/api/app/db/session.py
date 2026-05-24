"""Database engine and session helpers for FLooks metadata persistence.

The API and Alembic environment both resolve the same `database_url` contract.
This module centralizes engine creation so future repository code and request
dependencies do not drift from the migration setup.
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
def get_session_factory() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), class_=Session, autoflush=False, expire_on_commit=False)


def get_database_url() -> URL:
    return make_url(settings.database_url)


def get_db_session() -> Generator[Session, None, None]:
    session_factory = get_session_factory()
    session = session_factory()
    try:
        yield session
    finally:
        session.close()