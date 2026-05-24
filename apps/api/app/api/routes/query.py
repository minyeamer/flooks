"""Governed query bootstrap routes for dataset manifests and QuerySpec validation.

These routes expose the initial manifest registry and semantic validation layer.
They do not execute SQL yet; they only describe and validate the contract that
panels and AI tools will use in later phases.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.domain.query import QueryBootstrapResponse, QueryBootstrapRules, QuerySpec, QueryValidationResponse
from app.query.registry import list_dataset_manifests
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
            execution_preview_only=True,
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