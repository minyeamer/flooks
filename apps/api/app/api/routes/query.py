"""Governed query bootstrap routes for dataset manifests and QuerySpec validation.

These routes expose the initial manifest registry and semantic validation layer.
They do not execute SQL yet; they only describe and validate the contract that
panels and AI tools will use in later phases.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.domain.query import (
    QueryBootstrapResponse,
    QueryBootstrapRules,
    QueryExecutionResponse,
    QuerySpec,
    QueryValidationResponse,
)
from app.query.connector import execute_postgres_query
from app.query.registry import list_dataset_manifests
from app.query.translator import translate_query_spec
from app.query.validator import QuerySpecValidationError, validate_query_spec

router = APIRouter(tags=["query"])


@router.get(
    "/query/bootstrap",
    response_model=QueryBootstrapResponse,
    summary="Governed query bootstrap",
)
async def get_query_bootstrap() -> QueryBootstrapResponse:
    datasets = list_dataset_manifests()

    return QueryBootstrapResponse(
        datasets=datasets,
        rules=QueryBootstrapRules(
            raw_sql_allowed=False,
            dataset_manifest_required=True,
            execution_preview_only=False,
        ),
    )


@router.post(
    "/query/validate",
    response_model=QueryValidationResponse,
    summary="Validate a QuerySpec payload",
)
async def validate_query(query_spec: QuerySpec) -> QueryValidationResponse:
    try:
        return validate_query_spec(query_spec)
    except QuerySpecValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"field": error.field, "message": error.message},
        ) from error


@router.post(
    "/query/execute",
    response_model=QueryExecutionResponse,
    summary="Execute a QuerySpec request",
)
async def execute_query(query_spec: QuerySpec) -> QueryExecutionResponse:
    # 1. Validate and normalize the query spec
    try:
        validation = validate_query_spec(query_spec)
    except QuerySpecValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"field": error.field, "message": error.message},
        ) from error

    # 2. Translate to SQL
    sql, params = translate_query_spec(validation.manifest, validation.normalized_spec)

    # 3. TODO: Check dataset grants for the current user

    # 4. Execute the query
    # In this phase, we only support POSTGRES (formerly LINKMERCE_POSTGRES)
    return execute_postgres_query(sql, params)