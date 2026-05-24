"""Governed query domain models for dataset manifests and QuerySpec requests.

These models define the contract shared by the future dashboard runtime, AI
tools, and the current bootstrap validation endpoints. The public shape is kept
explicit so connector execution can evolve later without changing the request
and validation model.
"""

from __future__ import annotations

from enum import StrEnum
from typing import TypeAlias

from pydantic import BaseModel, ConfigDict, Field

from app.domain.enums import DataSourceKind
from app.domain.identity import DatasetGrantAxis

QueryScalarValue: TypeAlias = str | int | float | bool
QueryValue: TypeAlias = QueryScalarValue | list[QueryScalarValue]


def to_camel(value: str) -> str:
    """Convert `snake_case` field names into `camelCase` aliases."""

    head, *tail = value.split("_")
    return head + "".join(part.capitalize() for part in tail)


class QueryModel(BaseModel):
    """Base model that serializes the governed query contract in camelCase."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class FieldDataType(StrEnum):
    STRING = "string"
    NUMBER = "number"
    DATE = "date"
    BOOLEAN = "boolean"


class MetricAggregate(StrEnum):
    SUM = "sum"
    COUNT = "count"
    AVG = "avg"
    MIN = "min"
    MAX = "max"


class FilterOperator(StrEnum):
    EQ = "eq"
    IN = "in"
    BETWEEN = "between"
    GTE = "gte"
    LTE = "lte"


class SortDirection(StrEnum):
    ASC = "asc"
    DESC = "desc"


class DatasetSource(QueryModel):
    kind: DataSourceKind
    relation: str


class DatasetDimension(QueryModel):
    key: str
    label: str
    data_type: FieldDataType
    filter_operators: list[FilterOperator]


class DatasetMetric(QueryModel):
    key: str
    label: str
    data_type: FieldDataType = FieldDataType.NUMBER
    default_aggregate: MetricAggregate
    supported_aggregates: list[MetricAggregate]


class ManifestFilter(QueryModel):
    field: str
    op: FilterOperator
    value: QueryValue


class DatasetVisibilityPolicy(QueryModel):
    grant_axes: list[DatasetGrantAxis]
    hidden_behavior: str


class DatasetCachePolicy(QueryModel):
    ttl_seconds: int
    stale_while_revalidate_seconds: int


class DatasetMaskingPolicy(QueryModel):
    masked_fields: list[str]


class DatasetLimitPolicy(QueryModel):
    default_rows: int = Field(ge=1)
    max_rows: int = Field(ge=1)


class DatasetManifest(QueryModel):
    key: str
    label: str
    description: str
    source: DatasetSource
    dimensions: list[DatasetDimension]
    metrics: list[DatasetMetric]
    default_filters: list[ManifestFilter]
    sorts: list[str]
    visibility: DatasetVisibilityPolicy
    cache: DatasetCachePolicy
    masking: DatasetMaskingPolicy
    limit_policy: DatasetLimitPolicy


class QueryMetricSpec(QueryModel):
    key: str
    aggregate: MetricAggregate


class QueryFilterSpec(QueryModel):
    field: str
    op: FilterOperator
    value: QueryValue


class QuerySortSpec(QueryModel):
    field: str
    direction: SortDirection


class QuerySpec(QueryModel):
    dataset_key: str
    dimensions: list[str] = Field(default_factory=list)
    metrics: list[QueryMetricSpec] = Field(min_length=1)
    filters: list[QueryFilterSpec] = Field(default_factory=list)
    sort: list[QuerySortSpec] = Field(default_factory=list)
    limit: int | None = Field(default=None, ge=1, le=50_000)


class QueryBootstrapRules(QueryModel):
    raw_sql_allowed: bool
    dataset_manifest_required: bool
    execution_preview_only: bool


class QueryBootstrapResponse(QueryModel):
    datasets: list[DatasetManifest]
    rules: QueryBootstrapRules


class ExecutionPlanPreview(QueryModel):
    dataset_key: str
    connector_kind: DataSourceKind
    relation: str
    enforced_limit: int
    default_filter_count: int
    selected_dimension_count: int
    selected_metric_count: int


class QueryValidationResponse(QueryModel):
    valid: bool
    manifest: DatasetManifest
    normalized_spec: QuerySpec
    execution_plan: ExecutionPlanPreview


class QueryExecutionResponse(QueryModel):
    results: list[dict[str, QueryScalarValue]]
    column_names: list[str]
    row_count: int
    execution_metadata: dict[str, QueryScalarValue] = Field(default_factory=dict)