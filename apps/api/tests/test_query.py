"""Tests for the governed query bootstrap routes and connector guards."""

from __future__ import annotations

from collections.abc import Generator
from dataclasses import dataclass

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes import query as query_routes
from app.db.base import Base
from app.db.models import DatasetGrantRecord
from app.db.session import get_db_session
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


@dataclass(frozen=True)
class QueryTestContext:
    client: TestClient
    session_factory: sessionmaker[Session]


@pytest.fixture()
def query_context() -> Generator[QueryTestContext, None, None]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    session_factory = sessionmaker(bind=engine, class_=Session, autoflush=False, expire_on_commit=False)
    Base.metadata.create_all(bind=engine)

    def override_get_db_session() -> Generator[Session, None, None]:
        session = session_factory()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db_session] = override_get_db_session

    with TestClient(app) as client:
        yield QueryTestContext(client=client, session_factory=session_factory)

    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


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


def test_query_bootstrap(query_context: QueryTestContext) -> None:
    response = query_context.client.get("/api/v1/query/bootstrap")

    assert response.status_code == 200
    payload = response.json()

    assert payload["rules"]["rawSqlAllowed"] is False
    assert payload["rules"]["datasetManifestRequired"] is True
    assert payload["rules"]["executionPreviewOnly"] is False
    assert [dataset["key"] for dataset in payload["datasets"]] == [
        "mart_channel_performance",
        "mart_commerce_daily",
    ]


def test_query_validate_normalizes_limit_and_default_filters(query_context: QueryTestContext) -> None:
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

    response = query_context.client.post("/api/v1/query/validate", json=payload)

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


def test_query_validate_rejects_unknown_metric(query_context: QueryTestContext) -> None:
    payload = {
        "datasetKey": "mart_channel_performance",
        "metrics": [{"key": "unknown_metric", "aggregate": "sum"}],
    }

    response = query_context.client.post("/api/v1/query/validate", json=payload)

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
    query_context: QueryTestContext,
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

    def fake_validate_query_spec(_: QuerySpec, *, registry=None) -> QueryValidationResponse:
        return validation

    monkeypatch.setattr(query_routes, "validate_query_spec", fake_validate_query_spec)
    monkeypatch.setattr(query_connector, "get_analytics_engine", lambda: engine)

    try:
        response = query_context.client.post(
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


def test_query_execute_returns_service_unavailable_for_missing_relation(
    query_context: QueryTestContext,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    manifest = build_test_manifest(DataSourceKind.POSTGRES, relation="missing_orders")
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

    def fake_validate_query_spec(_: QuerySpec, *, registry=None) -> QueryValidationResponse:
        return validation

    monkeypatch.setattr(query_routes, "validate_query_spec", fake_validate_query_spec)
    monkeypatch.setattr(query_connector, "get_analytics_engine", lambda: engine)

    try:
        response = query_context.client.post(
            "/api/v1/query/execute",
            json=query_spec.model_dump(by_alias=True, exclude_none=True),
        )
    finally:
        engine.dispose()

    assert response.status_code == 503
    assert response.json()["detail"] == {
        "field": "datasetKey",
        "message": "The requested dataset relation is not available on the configured analytics database.",
    }


def test_query_execute_returns_not_implemented_for_unsupported_connector(
    query_context: QueryTestContext,
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

    def fake_validate_query_spec(_: QuerySpec, *, registry=None) -> QueryValidationResponse:
        return validation

    monkeypatch.setattr(query_routes, "validate_query_spec", fake_validate_query_spec)

    response = query_context.client.post(
        "/api/v1/query/execute",
        json=query_spec.model_dump(by_alias=True, exclude_none=True),
    )

    assert response.status_code == 501
    assert response.json()["detail"] == {
        "field": "datasetKey",
        "message": "Connector 'BIGQUERY' is not supported by the current query execution path.",
    }


def test_query_bootstrap_filters_datasets_by_matching_grant(query_context: QueryTestContext) -> None:
    with query_context.session_factory() as session:
        session.add_all(
            [
                DatasetGrantRecord(
                    dataset_key="mart_commerce_daily",
                    grant_axis=DatasetGrantAxis.WORKSPACE,
                    subject_key="primary",
                    granted_by="seed",
                ),
                DatasetGrantRecord(
                    dataset_key="mart_channel_performance",
                    grant_axis=DatasetGrantAxis.WORKSPACE,
                    subject_key="secondary",
                    granted_by="seed",
                ),
            ]
        )
        session.commit()

    response = query_context.client.get(
        "/api/v1/query/bootstrap",
        headers={"X-FLooks-Workspace": "primary"},
    )

    assert response.status_code == 200
    assert [dataset["key"] for dataset in response.json()["datasets"]] == ["mart_commerce_daily"]


def test_query_validate_hides_unauthorized_dataset_as_unknown(query_context: QueryTestContext) -> None:
    with query_context.session_factory() as session:
        session.add(
            DatasetGrantRecord(
                dataset_key="mart_commerce_daily",
                grant_axis=DatasetGrantAxis.WORKSPACE,
                subject_key="secondary",
                granted_by="seed",
            )
        )
        session.commit()

    response = query_context.client.post(
        "/api/v1/query/validate",
        json={
            "datasetKey": "mart_commerce_daily",
            "metrics": [{"key": "revenue", "aggregate": "sum"}],
        },
        headers={"X-FLooks-Workspace": "primary"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == {
        "field": "datasetKey",
        "message": "Unknown dataset 'mart_commerce_daily'.",
    }


def test_query_execute_hides_unauthorized_dataset_as_unknown(query_context: QueryTestContext) -> None:
    with query_context.session_factory() as session:
        session.add(
            DatasetGrantRecord(
                dataset_key="mart_commerce_daily",
                grant_axis=DatasetGrantAxis.WORKSPACE,
                subject_key="secondary",
                granted_by="seed",
            )
        )
        session.commit()

    response = query_context.client.post(
        "/api/v1/query/execute",
        json={
            "datasetKey": "mart_commerce_daily",
            "metrics": [{"key": "revenue", "aggregate": "sum"}],
        },
        headers={"X-FLooks-Workspace": "primary"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == {
        "field": "datasetKey",
        "message": "Unknown dataset 'mart_commerce_daily'.",
    }