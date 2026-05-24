"""Governed query bootstrap routes for dataset manifests, validation, and execution."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.domain.query import (
    QueryBootstrapResponse,
    QueryBootstrapRules,
    QueryExecutionResponse,
    QuerySpec,
    QueryValidationResponse,
)
from app.query.connector import execute_query_via_connector
from app.query.exceptions import UnsupportedQueryConnectorError
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
    try:
        validation = validate_query_spec(query_spec)
    except QuerySpecValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"field": error.field, "message": error.message},
        ) from error

    try:
        sql, params = translate_query_spec(validation.manifest, validation.normalized_spec)
        return execute_query_via_connector(validation.manifest, sql, params)
    except UnsupportedQueryConnectorError as error:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail={
                "field": "datasetKey",
                "message": str(error),
            },
        ) from error