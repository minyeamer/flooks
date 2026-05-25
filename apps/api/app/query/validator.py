"""Semantic QuerySpec validation for the governed query bootstrap.

The bootstrap validator focuses on checks that are independent of actual SQL
execution: dataset existence, field allowlists, aggregate compatibility, sort
allowlists, and limit normalization. Query translation and connector execution
stay out of scope for this phase.
"""

from __future__ import annotations

from collections.abc import Mapping

from app.domain.query import DatasetManifest, ExecutionPlanPreview, QueryFilterSpec, QuerySpec, QueryValidationResponse
from app.query.registry import get_dataset_manifest_registry


class QuerySpecValidationError(ValueError):
    """Raised when a QuerySpec payload violates the manifest contract."""

    def __init__(self, field: str, message: str) -> None:
        super().__init__(message)
        self.field = field
        self.message = message


def validate_query_spec(
    query_spec: QuerySpec,
    *,
    registry: Mapping[str, DatasetManifest] | None = None,
) -> QueryValidationResponse:
    """Validate a QuerySpec against the in-memory dataset manifest registry."""

    manifest = _get_manifest(query_spec.dataset_key, registry=registry)
    _validate_dimensions(manifest, query_spec)
    _validate_metrics(manifest, query_spec)
    _validate_filters(manifest, query_spec)
    _validate_sorts(manifest, query_spec)

    enforced_limit = query_spec.limit or manifest.limit_policy.default_rows
    enforced_limit = min(enforced_limit, manifest.limit_policy.max_rows)
    default_filters = [
        QueryFilterSpec(field=filter_spec.field, op=filter_spec.op, value=filter_spec.value)
        for filter_spec in manifest.default_filters
    ]
    normalized_spec = QuerySpec(
        dataset_key=query_spec.dataset_key,
        dimensions=query_spec.dimensions,
        metrics=query_spec.metrics,
        filters=[*default_filters, *query_spec.filters],
        sort=query_spec.sort,
        limit=enforced_limit,
    )

    return QueryValidationResponse(
        valid=True,
        manifest=manifest,
        normalized_spec=normalized_spec,
        execution_plan=ExecutionPlanPreview(
            dataset_key=manifest.key,
            connector_kind=manifest.source.kind,
            relation=manifest.source.relation,
            enforced_limit=enforced_limit,
            default_filter_count=len(manifest.default_filters),
            selected_dimension_count=len(query_spec.dimensions),
            selected_metric_count=len(query_spec.metrics),
        ),
    )


def _get_manifest(
    dataset_key: str,
    *,
    registry: Mapping[str, DatasetManifest] | None = None,
) -> DatasetManifest:
    manifest_registry = registry or get_dataset_manifest_registry()
    manifest = manifest_registry.get(dataset_key)

    if manifest is None:
        raise QuerySpecValidationError("datasetKey", f"Unknown dataset '{dataset_key}'.")

    return manifest


def _validate_dimensions(manifest: DatasetManifest, query_spec: QuerySpec) -> None:
    allowed_dimensions = {dimension.key for dimension in manifest.dimensions}

    for dimension_key in query_spec.dimensions:
        if dimension_key not in allowed_dimensions:
            raise QuerySpecValidationError(
                "dimensions",
                f"Dimension '{dimension_key}' is not declared in dataset '{manifest.key}'.",
            )


def _validate_metrics(manifest: DatasetManifest, query_spec: QuerySpec) -> None:
    allowed_metrics = {metric.key: metric for metric in manifest.metrics}

    for metric_spec in query_spec.metrics:
        metric_manifest = allowed_metrics.get(metric_spec.key)
        if metric_manifest is None:
            raise QuerySpecValidationError(
                "metrics",
                f"Metric '{metric_spec.key}' is not declared in dataset '{manifest.key}'.",
            )
        if metric_spec.aggregate not in metric_manifest.supported_aggregates:
            raise QuerySpecValidationError(
                "metrics",
                f"Aggregate '{metric_spec.aggregate.value}' is not allowed for metric '{metric_spec.key}'.",
            )


def _validate_filters(manifest: DatasetManifest, query_spec: QuerySpec) -> None:
    allowed_dimensions = {dimension.key: dimension for dimension in manifest.dimensions}

    for filter_spec in query_spec.filters:
        dimension_manifest = allowed_dimensions.get(filter_spec.field)
        if dimension_manifest is None:
            raise QuerySpecValidationError(
                "filters",
                f"Filter field '{filter_spec.field}' is not declared as a filterable dimension in dataset '{manifest.key}'.",
            )
        if filter_spec.op not in dimension_manifest.filter_operators:
            raise QuerySpecValidationError(
                "filters",
                f"Operator '{filter_spec.op.value}' is not allowed for field '{filter_spec.field}'.",
            )


def _validate_sorts(manifest: DatasetManifest, query_spec: QuerySpec) -> None:
    allowed_sorts = set(manifest.sorts)

    for sort_spec in query_spec.sort:
        if sort_spec.field not in allowed_sorts:
            raise QuerySpecValidationError(
                "sort",
                f"Sort field '{sort_spec.field}' is not declared in dataset '{manifest.key}'.",
            )