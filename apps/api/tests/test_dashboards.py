"""Tests for dashboard CRUD and versioned document persistence routes."""

from __future__ import annotations

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db_session
from app.domain.dashboard import STARTER_DASHBOARD_SLUG
from app.main import app


@pytest.fixture()
def dashboard_client() -> Generator[TestClient, None, None]:
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
        yield client

    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def test_dashboard_crud_and_versioning(dashboard_client: TestClient) -> None:
    create_payload = {
        "slug": "commerce-home",
        "description": "Primary executive dashboard.",
        "ownerPrincipalKind": "user",
        "ownerPrincipalKey": "owner-1",
        "createdBy": "owner-1",
        "summary": "Initial bootstrap version.",
        "document": _build_dashboard_document(version=99, title="Commerce Home"),
    }

    create_response = dashboard_client.post("/api/v1/dashboards", json=create_payload)

    assert create_response.status_code == 201
    created_body = create_response.json()
    assert created_body["slug"] == "commerce-home"
    assert created_body["document"]["version"] == 1
    assert created_body["document"]["title"] == "Commerce Home"
    assert created_body["latestVersionNumber"] == 1
    assert created_body["latestVersionStatus"] == "draft"
    assert created_body["versions"][0]["summary"] == "Initial bootstrap version."
    assert created_body["document"]["panelLibrary"][0]["query"] == {
        "datasetKey": "mart_commerce_daily",
        "dimensions": [],
        "metrics": [{"key": "gmv", "aggregate": "sum"}],
        "sort": [],
        "limit": 1,
    }
    assert created_body["document"]["panelLibrary"][0]["scorecard"] == {
        "description": "Total GMV from the stored dashboard document.",
        "valueField": "gmv",
        "valuePrefix": "$",
        "valueSuffix": None,
    }
    assert created_body["document"]["panelLibrary"][2]["table"] == {
        "description": "Top channels by revenue from the stored dashboard document.",
        "columns": ["channel_name", "revenue"],
    }

    list_response = dashboard_client.get("/api/v1/dashboards")

    assert list_response.status_code == 200
    list_body = list_response.json()
    assert len(list_body) == 1
    assert list_body[0]["slug"] == "commerce-home"
    assert list_body[0]["latestVersionNumber"] == 1

    update_payload = {
        "createdBy": "owner-2",
        "summary": "Add scorecard page layout.",
        "status": "published",
        "description": "Published executive dashboard.",
        "document": _build_dashboard_document(version=1, title="Commerce Home Published"),
    }

    update_response = dashboard_client.put("/api/v1/dashboards/commerce-home", json=update_payload)

    assert update_response.status_code == 200
    updated_body = update_response.json()
    assert updated_body["title"] == "Commerce Home Published"
    assert updated_body["description"] == "Published executive dashboard."
    assert updated_body["document"]["id"] == created_body["document"]["id"]
    assert updated_body["document"]["version"] == 2
    assert updated_body["latestVersionNumber"] == 2
    assert updated_body["latestVersionStatus"] == "published"
    assert [version["versionNumber"] for version in updated_body["versions"]] == [1, 2]
    assert updated_body["document"]["panelLibrary"][0]["scorecard"]["valueField"] == "gmv"
    assert updated_body["document"]["panelLibrary"][2]["query"]["sort"] == [
        {"field": "revenue", "direction": "desc"}
    ]

    version_one_response = dashboard_client.get("/api/v1/dashboards/commerce-home", params={"version": 1})

    assert version_one_response.status_code == 200
    version_one_body = version_one_response.json()
    assert version_one_body["document"]["title"] == "Commerce Home"
    assert version_one_body["document"]["version"] == 1

    delete_response = dashboard_client.delete("/api/v1/dashboards/commerce-home")

    assert delete_response.status_code == 204

    missing_response = dashboard_client.get("/api/v1/dashboards/commerce-home")

    assert missing_response.status_code == 404
    assert missing_response.json()["detail"] == {
        "field": "slug",
        "message": "Dashboard 'commerce-home' was not found.",
    }


def test_dashboard_create_rejects_mismatched_document_key(dashboard_client: TestClient) -> None:
    payload = {
        "slug": "commerce-home",
        "description": "Primary executive dashboard.",
        "ownerPrincipalKind": "user",
        "ownerPrincipalKey": "owner-1",
        "createdBy": "owner-1",
        "document": _build_dashboard_document(version=1, key="other-dashboard"),
    }

    response = dashboard_client.post("/api/v1/dashboards", json=payload)

    assert response.status_code == 400
    assert response.json()["detail"] == {
        "field": "document.key",
        "message": "Dashboard document key 'other-dashboard' must match slug 'commerce-home'.",
    }


def test_dashboard_list_bootstraps_starter_dashboard_when_store_is_empty(
    dashboard_client: TestClient,
) -> None:
    response = dashboard_client.get("/api/v1/dashboards")

    assert response.status_code == 200
    body = response.json()

    assert len(body) == 1
    assert body[0]["slug"] == STARTER_DASHBOARD_SLUG
    assert body[0]["latestVersionNumber"] == 1


def test_dashboard_get_bootstraps_starter_dashboard_when_store_is_empty(
    dashboard_client: TestClient,
) -> None:
    response = dashboard_client.get(f"/api/v1/dashboards/{STARTER_DASHBOARD_SLUG}")

    assert response.status_code == 200
    body = response.json()

    assert body["slug"] == STARTER_DASHBOARD_SLUG
    assert body["document"]["title"] == "Commerce Executive Overview"
    assert body["document"]["panelLibrary"][0]["title"] == "GMV"
    assert body["document"]["panelLibrary"][1]["title"] == "Revenue"
    assert body["document"]["panelLibrary"][2]["title"] == "Revenue by Channel"
    assert body["document"]["panelLibrary"][3]["title"] == "Revenue Mix by Channel"
    assert body["document"]["panelLibrary"][4]["title"] == "Orders Share by Channel"
    assert body["document"]["panelLibrary"][5]["title"] == "Revenue Trend"
    assert body["document"]["panelLibrary"][6]["title"] == "Operations Notice"
    assert body["versions"][0]["createdBy"] == "system-bootstrap"


def _build_dashboard_document(*, version: int, title: str = "Commerce Home", key: str = "commerce-home") -> dict[str, object]:
    return {
        "id": "db-home",
        "key": key,
        "title": title,
        "version": version,
        "ownerRoleBoundary": "ADMIN",
        "supportedDataSources": ["POSTGRES"],
        "pages": [
            {
                "id": "page-overview",
                "title": "Overview",
                "width": 1600,
                "height": 900,
                "snapGrid": {"columnWidth": 20, "rowHeight": 20},
                "placements": [
                    {
                        "panelId": "panel-gmv",
                        "x": 40,
                        "y": 40,
                        "width": 300,
                        "height": 180,
                        "zIndex": 1,
                    },
                    {
                        "panelId": "panel-revenue",
                        "x": 360,
                        "y": 40,
                        "width": 300,
                        "height": 180,
                        "zIndex": 1,
                    },
                    {
                        "panelId": "panel-ops-notice",
                        "x": 680,
                        "y": 40,
                        "width": 880,
                        "height": 180,
                        "zIndex": 1,
                    },
                    {
                        "panelId": "panel-channel-table",
                        "x": 40,
                        "y": 240,
                        "width": 720,
                        "height": 260,
                        "zIndex": 1,
                    },
                    {
                        "panelId": "panel-channel-bar",
                        "x": 780,
                        "y": 240,
                        "width": 360,
                        "height": 260,
                        "zIndex": 1,
                    },
                    {
                        "panelId": "panel-channel-pie",
                        "x": 1160,
                        "y": 240,
                        "width": 400,
                        "height": 260,
                        "zIndex": 1,
                    },
                    {
                        "panelId": "panel-revenue-trend",
                        "x": 40,
                        "y": 520,
                        "width": 1520,
                        "height": 280,
                        "zIndex": 1,
                    }
                ],
            }
        ],
        "panelLibrary": [
            {
                "id": "panel-gmv",
                "key": "gmv-scorecard",
                "kind": "scorecard",
                "title": "GMV",
                "datasetKey": "mart_commerce_daily",
                "byReference": True,
                "query": {
                    "datasetKey": "mart_commerce_daily",
                    "dimensions": [],
                    "metrics": [{"key": "gmv", "aggregate": "sum"}],
                    "limit": 1,
                },
                "scorecard": {
                    "description": "Total GMV from the stored dashboard document.",
                    "valueField": "gmv",
                    "valuePrefix": "$",
                },
            },
            {
                "id": "panel-revenue",
                "key": "revenue-scorecard",
                "kind": "scorecard",
                "title": "Revenue",
                "datasetKey": "mart_commerce_daily",
                "byReference": True,
                "query": {
                    "datasetKey": "mart_commerce_daily",
                    "dimensions": [],
                    "metrics": [{"key": "revenue", "aggregate": "sum"}],
                    "limit": 1,
                },
                "scorecard": {
                    "description": "Net revenue total executed from the starter dashboard document.",
                    "valueField": "revenue",
                    "valuePrefix": "$",
                },
            },
            {
                "id": "panel-channel-table",
                "key": "channel-revenue-table",
                "kind": "table",
                "title": "Revenue by Channel",
                "datasetKey": "mart_commerce_daily",
                "byReference": True,
                "query": {
                    "datasetKey": "mart_commerce_daily",
                    "dimensions": ["channel_name"],
                    "metrics": [{"key": "revenue", "aggregate": "sum"}],
                    "sort": [{"field": "revenue", "direction": "desc"}],
                    "limit": 5,
                },
                "table": {
                    "description": "Top channels by revenue from the stored dashboard document.",
                    "columns": ["channel_name", "revenue"],
                },
            },
            {
                "id": "panel-channel-bar",
                "key": "channel-revenue-bar",
                "kind": "bar",
                "title": "Revenue Mix by Channel",
                "datasetKey": "mart_commerce_daily",
                "byReference": True,
                "query": {
                    "datasetKey": "mart_commerce_daily",
                    "dimensions": ["channel_name"],
                    "metrics": [{"key": "revenue", "aggregate": "sum"}],
                    "sort": [{"field": "revenue", "direction": "desc"}],
                    "limit": 5,
                },
            },
            {
                "id": "panel-channel-pie",
                "key": "channel-orders-pie",
                "kind": "pie",
                "title": "Orders Share by Channel",
                "datasetKey": "mart_commerce_daily",
                "byReference": True,
                "query": {
                    "datasetKey": "mart_commerce_daily",
                    "dimensions": ["channel_name"],
                    "metrics": [{"key": "orders", "aggregate": "sum"}],
                    "sort": [{"field": "orders", "direction": "desc"}],
                    "limit": 5,
                },
            },
            {
                "id": "panel-revenue-trend",
                "key": "revenue-trend-line",
                "kind": "line",
                "title": "Revenue Trend",
                "datasetKey": "mart_commerce_daily",
                "byReference": True,
                "query": {
                    "datasetKey": "mart_commerce_daily",
                    "dimensions": ["order_date"],
                    "metrics": [{"key": "revenue", "aggregate": "sum"}],
                    "sort": [{"field": "order_date", "direction": "asc"}],
                    "limit": 7,
                },
            },
            {
                "id": "panel-ops-notice",
                "key": "ops-notice",
                "kind": "notice",
                "title": "Operations Notice",
                "datasetKey": "mart_commerce_daily",
                "byReference": True,
                "query": {
                    "datasetKey": "mart_commerce_daily",
                    "dimensions": ["channel_name"],
                    "metrics": [{"key": "orders", "aggregate": "sum"}],
                    "sort": [{"field": "orders", "direction": "desc"}],
                    "limit": 1,
                },
            }
        ],
    }