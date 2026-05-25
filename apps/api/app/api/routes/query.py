"""Governed query bootstrap routes for dataset manifests, validation, and execution."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db_session
from app.domain.query import (
    QueryBootstrapResponse,
    QueryBootstrapRules,
    QueryExecutionResponse,
    QuerySpec,
    QueryValidationResponse,
)
from app.query.access import (
    DatasetAccessContext,
    get_accessible_dataset_manifest_registry,
    get_dataset_access_context,
    list_accessible_dataset_manifests,
)
from app.query.connector import execute_query_via_connector
from app.query.exceptions import QueryExecutionError, UnsupportedQueryConnectorError
from app.query.translator import translate_query_spec
from app.query.validator import QuerySpecValidationError, validate_query_spec

router = APIRouter(tags=["query"])


@router.get(
    "/query/bootstrap",
    response_model=QueryBootstrapResponse,
    summary="Governed query bootstrap",
)
async def get_query_bootstrap(
    session: Session = Depends(get_db_session),
    access_context: DatasetAccessContext = Depends(get_dataset_access_context),
) -> QueryBootstrapResponse:
    datasets = list_accessible_dataset_manifests(session, access_context)

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
async def validate_query(
    query_spec: QuerySpec,
    session: Session = Depends(get_db_session),
    access_context: DatasetAccessContext = Depends(get_dataset_access_context),
) -> QueryValidationResponse:
    try:
        registry = get_accessible_dataset_manifest_registry(session, access_context)
        return validate_query_spec(query_spec, registry=registry)
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
async def execute_query(
    query_spec: QuerySpec,
    session: Session = Depends(get_db_session),
    access_context: DatasetAccessContext = Depends(get_dataset_access_context),
) -> QueryExecutionResponse:
    try:
        registry = get_accessible_dataset_manifest_registry(session, access_context)
        validation = validate_query_spec(query_spec, registry=registry)
    except QuerySpecValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"field": error.field, "message": error.message},
        ) from error

    try:
        sql, params = translate_query_spec(validation.manifest, validation.normalized_spec)
        return execute_query_via_connector(validation.manifest, sql, params)
    except QueryExecutionError as error:
        raise HTTPException(
            status_code=error.status_code,
            detail={
                "field": error.field,
                "message": str(error),
            },
        ) from error
    except UnsupportedQueryConnectorError as error:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail={
                "field": "datasetKey",
                "message": str(error),
            },
        ) from error