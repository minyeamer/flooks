"""Postgres connector for executing governed queries against analytics marts.

The connector is responsible for executing the translated SQL against the
target database and packaging the results into a standard QueryExecutionResponse.
"""

from __future__ import annotations

import time
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.domain.query import QueryExecutionResponse
from app.db.session import get_engine


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
