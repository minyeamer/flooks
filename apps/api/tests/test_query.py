"""Tests for the governed query bootstrap routes.

These tests focus on manifest exposure and QuerySpec validation behavior so the
bootstrap contract stays stable while connector execution is still pending.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


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