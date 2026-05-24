"""SQL translation logic for turning governed QuerySpec into dialector-ready SQL.

The translator takes a validated QuerySpec and its backing DatasetManifest to
produce a parameterized SQL statement. It handles dimension grouping, metric
aggregation, filtering with operators, and sorting.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import ColumnElement, Table, and_, desc, select, text
from sqlalchemy.sql import Select

from app.domain.query import DatasetManifest, QuerySpec, FilterOperator, SortDirection


def translate_query_spec(manifest: DatasetManifest, spec: QuerySpec) -> tuple[str, dict[str, Any]]:
    """Translate a QuerySpec into a SQL string and its parameters.

    This first implementation uses a simple SQL builder logic. Future versions
    will use SQLAlchemy's full expression language with proper reflection.
    """

    table_name = manifest.source.relation
    
    # Selection
    columns: list[str] = []
    groups: list[str] = []
    
    for dim_key in spec.dimensions:
        columns.append(f'"{dim_key}"')
        groups.append(f'"{dim_key}"')
        
    for metric_spec in spec.metrics:
        agg = metric_spec.aggregate.value.upper()
        columns.append(f'{agg}("{metric_spec.key}") AS "{metric_spec.key}"')
        
    query_parts = [f"SELECT {', '.join(columns)}"]
    query_parts.append(f"FROM {table_name}")
    
    # Filters
    params: dict[str, Any] = {}
    where_clauses: list[str] = []
    
    for i, filter_spec in enumerate(spec.filters):
        p_name = f"p{i}"
        field = f'"{filter_spec.field}"'
        
        if filter_spec.op == FilterOperator.EQ:
            where_clauses.append(f"{field} = :{p_name}")
            params[p_name] = filter_spec.value
        elif filter_spec.op == FilterOperator.IN:
            where_clauses.append(f"{field} IN :{p_name}")
            params[p_name] = tuple(filter_spec.value) if isinstance(filter_spec.value, list) else (filter_spec.value,)
        elif filter_spec.op == FilterOperator.GTE:
            where_clauses.append(f"{field} >= :{p_name}")
            params[p_name] = filter_spec.value
        elif filter_spec.op == FilterOperator.LTE:
            where_clauses.append(f"{field} <= :{p_name}")
            params[p_name] = filter_spec.value
        elif filter_spec.op == FilterOperator.BETWEEN:
            p_name_1 = f"{p_name}_1"
            p_name_2 = f"{p_name}_2"
            where_clauses.append(f"{field} BETWEEN :{p_name_1} AND :{p_name_2}")
            if isinstance(filter_spec.value, list) and len(filter_spec.value) == 2:
                params[p_name_1] = filter_spec.value[0]
                params[p_name_2] = filter_spec.value[1]
            else:
                # Fallback if value is not a list of 2
                params[p_name_1] = filter_spec.value
                params[p_name_2] = filter_spec.value

    if where_clauses:
        query_parts.append(f"WHERE {' AND '.join(where_clauses)}")
        
    # Grouping
    if groups:
        query_parts.append(f"GROUP BY {', '.join(groups)}")
        
    # Sorting
    if spec.sort:
        sort_clauses: list[str] = []
        for sort_spec in spec.sort:
            direction = "ASC" if sort_spec.direction == SortDirection.ASC else "DESC"
            sort_clauses.append(f'"{sort_spec.field}" {direction}')
        query_parts.append(f"ORDER BY {', '.join(sort_clauses)}")
        
    # Limit
    if spec.limit:
        query_parts.append(f"LIMIT {spec.limit}")
        
    return "\n".join(query_parts), params
