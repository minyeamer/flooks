"""Connector dispatch for executing governed queries against analytics marts."""

from __future__ import annotations

import time
from typing import Any

from sqlalchemy import text

from app.domain.enums import DataSourceKind
from app.domain.query import DatasetManifest, QueryExecutionResponse
from app.db.session import get_engine
from app.query.exceptions import UnsupportedQueryConnectorError


def execute_query_via_connector(
    manifest: DatasetManifest,
    sql: str,
    params: dict[str, Any],
) -> QueryExecutionResponse:
    """Dispatch a translated query to the supported connector implementation."""

    if manifest.source.kind == DataSourceKind.POSTGRES:
        return execute_postgres_query(sql, params)

    raise UnsupportedQueryConnectorError(manifest.source.kind)


def execute_postgres_query(sql: str, params: dict[str, Any]) -> QueryExecutionResponse:
    """Execute the translated SQL against the Postgres database."""

    engine = get_engine()
    start_time = time.time()
    
    with engine.connect() as connection:
        result = connection.execute(text(sql), params)
        column_names = list(result.keys())
        rows = [dict(zip(column_names, row)) for row in result]
        
    duration_ms = int((time.time() - start_time) * 1000)
    
    return QueryExecutionResponse(
        results=rows,
        column_names=column_names,
        row_count=len(rows),
        execution_metadata={
            "duration_ms": duration_ms,
            "connector": "POSTGRES",
        }
    )
