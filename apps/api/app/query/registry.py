"""Static dataset manifest registry for the governed query bootstrap.

The first bootstrap keeps manifests in code so the API can validate QuerySpec
payloads before catalog management exists in the database. The registry can move
behind persistence later without changing the API surface.
"""

from __future__ import annotations

from functools import lru_cache

from app.domain.enums import DataSourceKind
from app.domain.identity import DatasetGrantAxis
from app.domain.query import (
    DatasetCachePolicy,
    DatasetDimension,
    DatasetLimitPolicy,
    DatasetManifest,
    DatasetMaskingPolicy,
    DatasetMetric,
    DatasetSource,
    DatasetVisibilityPolicy,
    FieldDataType,
    FilterOperator,
    ManifestFilter,
    MetricAggregate,
)

STARTER_DATASET_MANIFESTS: tuple[DatasetManifest, ...] = (
    DatasetManifest(
        key="mart_commerce_daily",
        label="Commerce Daily",
        description="Daily Linkmerce commerce performance aggregated by date, channel, and store.",
        source=DatasetSource(
            kind=DataSourceKind.POSTGRES,
            relation="analytics.mart_commerce_daily",
        ),
        dimensions=[
            DatasetDimension(
                key="order_date",
                label="Order Date",
                data_type=FieldDataType.DATE,
                filter_operators=[FilterOperator.EQ, FilterOperator.BETWEEN, FilterOperator.GTE, FilterOperator.LTE],
            ),
            DatasetDimension(
                key="channel_name",
                label="Channel",
                data_type=FieldDataType.STRING,
                filter_operators=[FilterOperator.EQ, FilterOperator.IN],
            ),
            DatasetDimension(
                key="store_name",
                label="Store",
                data_type=FieldDataType.STRING,
                filter_operators=[FilterOperator.EQ, FilterOperator.IN],
            ),
            DatasetDimension(
                key="workspace_key",
                label="Workspace",
                data_type=FieldDataType.STRING,
                filter_operators=[FilterOperator.EQ],
            ),
        ],
        metrics=[
            DatasetMetric(
                key="revenue",
                label="Revenue",
                default_aggregate=MetricAggregate.SUM,
                supported_aggregates=[MetricAggregate.SUM, MetricAggregate.AVG, MetricAggregate.MAX],
            ),
            DatasetMetric(
                key="orders",
                label="Orders",
                default_aggregate=MetricAggregate.COUNT,
                supported_aggregates=[MetricAggregate.COUNT, MetricAggregate.SUM],
            ),
            DatasetMetric(
                key="gmv",
                label="GMV",
                default_aggregate=MetricAggregate.SUM,
                supported_aggregates=[MetricAggregate.SUM, MetricAggregate.AVG, MetricAggregate.MAX],
            ),
        ],
        default_filters=[
            ManifestFilter(field="workspace_key", op=FilterOperator.EQ, value="primary"),
        ],
        sorts=["order_date", "channel_name", "revenue", "orders", "gmv"],
        visibility=DatasetVisibilityPolicy(
            grant_axes=list(DatasetGrantAxis),
            hidden_behavior="Hide datasets and linked resources when grant evaluation fails.",
        ),
        cache=DatasetCachePolicy(ttl_seconds=300, stale_while_revalidate_seconds=60),
        masking=DatasetMaskingPolicy(masked_fields=[]),
        limit_policy=DatasetLimitPolicy(default_rows=200, max_rows=5000),
    ),
    DatasetManifest(
        key="mart_channel_performance",
        label="Channel Performance",
        description="Channel-level Linkmerce performance for campaign monitoring and diagnostics.",
        source=DatasetSource(
            kind=DataSourceKind.POSTGRES,
            relation="analytics.mart_channel_performance",
        ),
        dimensions=[
            DatasetDimension(
                key="report_date",
                label="Report Date",
                data_type=FieldDataType.DATE,
                filter_operators=[FilterOperator.EQ, FilterOperator.BETWEEN, FilterOperator.GTE, FilterOperator.LTE],
            ),
            DatasetDimension(
                key="channel_name",
                label="Channel",
                data_type=FieldDataType.STRING,
                filter_operators=[FilterOperator.EQ, FilterOperator.IN],
            ),
            DatasetDimension(
                key="campaign_name",
                label="Campaign",
                data_type=FieldDataType.STRING,
                filter_operators=[FilterOperator.EQ, FilterOperator.IN],
            ),
            DatasetDimension(
                key="workspace_key",
                label="Workspace",
                data_type=FieldDataType.STRING,
                filter_operators=[FilterOperator.EQ],
            ),
        ],
        metrics=[
            DatasetMetric(
                key="ad_spend",
                label="Ad Spend",
                default_aggregate=MetricAggregate.SUM,
                supported_aggregates=[MetricAggregate.SUM, MetricAggregate.AVG, MetricAggregate.MAX],
            ),
            DatasetMetric(
                key="clicks",
                label="Clicks",
                default_aggregate=MetricAggregate.SUM,
                supported_aggregates=[MetricAggregate.SUM, MetricAggregate.COUNT],
            ),
            DatasetMetric(
                key="roas",
                label="ROAS",
                default_aggregate=MetricAggregate.AVG,
                supported_aggregates=[MetricAggregate.AVG, MetricAggregate.MAX, MetricAggregate.MIN],
            ),
        ],
        default_filters=[
            ManifestFilter(field="workspace_key", op=FilterOperator.EQ, value="primary"),
        ],
        sorts=["report_date", "channel_name", "campaign_name", "ad_spend", "clicks", "roas"],
        visibility=DatasetVisibilityPolicy(
            grant_axes=list(DatasetGrantAxis),
            hidden_behavior="Hide datasets and linked resources when grant evaluation fails.",
        ),
        cache=DatasetCachePolicy(ttl_seconds=300, stale_while_revalidate_seconds=60),
        masking=DatasetMaskingPolicy(masked_fields=[]),
        limit_policy=DatasetLimitPolicy(default_rows=100, max_rows=3000),
    ),
)


@lru_cache
def get_dataset_manifest_registry() -> dict[str, DatasetManifest]:
    """Return the starter dataset manifests keyed by dataset identifier."""

    return {manifest.key: manifest for manifest in STARTER_DATASET_MANIFESTS}


def list_dataset_manifests() -> list[DatasetManifest]:
    """Return the starter dataset manifests in a stable key order."""

    registry = get_dataset_manifest_registry()
    return [registry[key] for key in sorted(registry.keys())]