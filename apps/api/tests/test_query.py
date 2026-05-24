"""Tests for the governed query bootstrap routes and connector guards."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.pool import StaticPool

from app.api.routes import query as query_routes
from app.domain.enums import DataSourceKind
from app.domain.identity import DatasetGrantAxis
from app.domain.query import (
    DatasetCachePolicy,
    DatasetLimitPolicy,
    DatasetManifest,
    DatasetMaskingPolicy,
    DatasetMetric,
    DatasetSource,
    DatasetVisibilityPolicy,
    ExecutionPlanPreview,
    MetricAggregate,
    QueryMetricSpec,
    QuerySpec,
    QueryValidationResponse,
)
from app.main import app
from app.query import connector as query_connector
from app.query.connector import execute_query_via_connector
from app.query.exceptions import UnsupportedQueryConnectorError
from app.query.translator import translate_query_spec

client = TestClient(app)


def build_test_manifest(
    source_kind: DataSourceKind,
    relation: str = "analytics.warehouse_orders",
) -> DatasetManifest:
    return DatasetManifest(
        key="warehouse_orders",
        label="Warehouse Orders",
        description="Test manifest for connector dispatch.",
        source=DatasetSource(kind=source_kind, relation=relation),
        dimensions=[],
        metrics=[
            DatasetMetric(
                key="revenue",
                label="Revenue",
                default_aggregate=MetricAggregate.SUM,
                supported_aggregates=[MetricAggregate.SUM],
            )
        ],
        default_filters=[],
        sorts=["revenue"],
        visibility=DatasetVisibilityPolicy(
            grant_axes=list(DatasetGrantAxis),
            hidden_behavior="Hide datasets when grant evaluation fails.",
        ),
        cache=DatasetCachePolicy(ttl_seconds=300, stale_while_revalidate_seconds=60),
        masking=DatasetMaskingPolicy(masked_fields=[]),
        limit_policy=DatasetLimitPolicy(default_rows=100, max_rows=1000),
    )


def build_test_spec(dataset_key: str) -> QuerySpec:
    return QuerySpec(
        dataset_key=dataset_key,
        metrics=[QueryMetricSpec(key="revenue", aggregate=MetricAggregate.SUM)],
        limit=100,
    )


def test_query_bootstrap() -> None:
    response = client.get("/api/v1/query/bootstrap")

    assert response.status_code == 200
    payload = response.json()

    assert payload["rules"]["rawSqlAllowed"] is False
    assert payload["rules"]["datasetManifestRequired"] is True
    assert payload["rules"]["executionPreviewOnly"] is False
    assert [dataset["key"] for dataset in payload["datasets"]] == [
        "mart_channel_performance",
        "mart_commerce_daily",
    ]


def test_query_validate_normalizes_limit_and_default_filters() -> None:
    payload = {
        "datasetKey": "mart_commerce_daily",
        "dimensions": ["order_date", "channel_name"],
        "metrics": [{"key": "revenue", "aggregate": "sum"}],
        "filters": [
            {"field": "channel_name", "op": "in", "value": ["smartstore", "coupang"]},
        ],
        "sort": [{"field": "revenue", "direction": "desc"}],
        "limit": 9999,
    }

    response = client.post("/api/v1/query/validate", json=payload)

    assert response.status_code == 200
    body = response.json()

    assert body["valid"] is True
    assert body["normalizedSpec"]["limit"] == 5000
    assert body["executionPlan"]["defaultFilterCount"] == 1
    assert body["executionPlan"]["connectorKind"] == "POSTGRES"
    assert body["normalizedSpec"]["filters"][0] == {
        "field": "workspace_key",
        "op": "eq",
        "value": "primary",
    }


def test_query_validate_rejects_unknown_metric() -> None:
    payload = {
        "datasetKey": "mart_channel_performance",
        "metrics": [{"key": "unknown_metric", "aggregate": "sum"}],
    }

    response = client.post("/api/v1/query/validate", json=payload)

    assert response.status_code == 400
    assert response.json()["detail"] == {
        "field": "metrics",
        "message": "Metric 'unknown_metric' is not declared in dataset 'mart_channel_performance'.",
    }


def test_translate_query_spec_rejects_unsupported_connector() -> None:
    manifest = build_test_manifest(DataSourceKind.BIGQUERY)
    query_spec = build_test_spec(manifest.key)

    with pytest.raises(UnsupportedQueryConnectorError, match="BIGQUERY"):
        translate_query_spec(manifest, query_spec)


def test_execute_query_via_connector_rejects_unsupported_connector() -> None:
    manifest = build_test_manifest(DataSourceKind.CLICKHOUSE)

    with pytest.raises(UnsupportedQueryConnectorError, match="CLICKHOUSE"):
        execute_query_via_connector(manifest, "SELECT 1", {})


def test_query_execute_returns_rows_for_supported_connector(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    manifest = build_test_manifest(DataSourceKind.POSTGRES, relation="warehouse_orders")
    query_spec = build_test_spec(manifest.key)
    validation = QueryValidationResponse(
        valid=True,
        manifest=manifest,
        normalized_spec=query_spec,
        execution_plan=ExecutionPlanPreview(
            dataset_key=manifest.key,
            connector_kind=manifest.source.kind,
            relation=manifest.source.relation,
            enforced_limit=query_spec.limit or 100,
            default_filter_count=len(manifest.default_filters),
            selected_dimension_count=len(query_spec.dimensions),
            selected_metric_count=len(query_spec.metrics),
        ),
    )

    with engine.begin() as connection:
        connection.execute(text('CREATE TABLE warehouse_orders (revenue INTEGER NOT NULL)'))
        connection.execute(text('INSERT INTO warehouse_orders (revenue) VALUES (100), (25)'))

    def fake_validate_query_spec(_: QuerySpec) -> QueryValidationResponse:
        return validation

    monkeypatch.setattr(query_routes, "validate_query_spec", fake_validate_query_spec)
    monkeypatch.setattr(query_connector, "get_engine", lambda: engine)

    try:
        response = client.post(
            "/api/v1/query/execute",
            json=query_spec.model_dump(by_alias=True, exclude_none=True),
        )
    finally:
        engine.dispose()

    assert response.status_code == 200
    assert response.json()["results"] == [{"revenue": 125}]
    assert response.json()["columnNames"] == ["revenue"]
    assert response.json()["rowCount"] == 1
    assert response.json()["executionMetadata"]["connector"] == "POSTGRES"


def test_query_execute_returns_not_implemented_for_unsupported_connector(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    manifest = build_test_manifest(DataSourceKind.BIGQUERY)
    query_spec = build_test_spec(manifest.key)
    validation = QueryValidationResponse(
        valid=True,
        manifest=manifest,
        normalized_spec=query_spec,
        execution_plan=ExecutionPlanPreview(
            dataset_key=manifest.key,
            connector_kind=manifest.source.kind,
            relation=manifest.source.relation,
            enforced_limit=query_spec.limit or 100,
            default_filter_count=len(manifest.default_filters),
            selected_dimension_count=len(query_spec.dimensions),
            selected_metric_count=len(query_spec.metrics),
        ),
    )

    def fake_validate_query_spec(_: QuerySpec) -> QueryValidationResponse:
        return validation

    monkeypatch.setattr(query_routes, "validate_query_spec", fake_validate_query_spec)

    response = client.post(
        "/api/v1/query/execute",
        json=query_spec.model_dump(by_alias=True, exclude_none=True),
    )

    assert response.status_code == 501
    assert response.json()["detail"] == {
        "field": "datasetKey",
        "message": "Connector 'BIGQUERY' is not supported by the current query execution path.",
    }