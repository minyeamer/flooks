"""Connector dispatch for executing governed queries against analytics marts."""

from __future__ import annotations

import time
from typing import Any

from sqlalchemy import text
from sqlalchemy.exc import OperationalError, ProgrammingError, SQLAlchemyError

from app.domain.enums import DataSourceKind
from app.domain.query import DatasetManifest, QueryExecutionResponse
from app.db.session import get_analytics_engine
from app.query.exceptions import QueryExecutionError, UnsupportedQueryConnectorError


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

    engine = get_analytics_engine()
    start_time = time.time()

    try:
        with engine.connect() as connection:
            result = connection.execute(text(sql), params)
            column_names = list(result.keys())
            rows = [dict(zip(column_names, row)) for row in result]
    except (ProgrammingError, OperationalError) as error:
        raise _translate_query_execution_error(error) from error
    except SQLAlchemyError as error:
        raise QueryExecutionError(
            field="datasetKey",
            message="Governed query execution failed on the configured analytics database.",
            status_code=502,
        ) from error

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


def _translate_query_execution_error(error: ProgrammingError | OperationalError) -> QueryExecutionError:
    message = str(error).lower()

    if "does not exist" in message or "no such table" in message:
        return QueryExecutionError(
            field="datasetKey",
            message="The requested dataset relation is not available on the configured analytics database.",
            status_code=503,
        )

    return QueryExecutionError(
        field="analyticsDatabaseUrl",
        message="The configured analytics database is unavailable for governed query execution.",
        status_code=503,
    )
