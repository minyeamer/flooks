"""Tests for identity bootstrap and dataset grant management routes."""

from __future__ import annotations

from collections.abc import Generator

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db_session
from app.domain.dashboard import build_starter_dashboard_document
from app.main import app


def _build_identity_client() -> Generator[TestClient, None, None]:
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


def test_dataset_grant_crud_flow() -> None:
    client_generator = _build_identity_client()
    client = next(client_generator)

    try:
        empty_response = client.get("/api/v1/identity/dataset-grants")

        assert empty_response.status_code == 200
        payload = empty_response.json()
        assert payload["grants"] == []
        assert [dataset["key"] for dataset in payload["catalog_datasets"]] == [
            "mart_channel_performance",
            "mart_commerce_daily",
        ]
        assert all(
            dataset["usage_summary"]
            == {"dashboard_count": 0, "panel_count": 0, "sample_panels": []}
            for dataset in payload["catalog_datasets"]
        )

        create_response = client.put(
            "/api/v1/identity/dataset-grants",
            json={
                "dataset_key": "mart_commerce_daily",
                "grant_axis": "workspace",
                "subject_key": "primary",
                "granted_by": "owner-1",
            },
        )

        assert create_response.status_code == 201
        created_payload = create_response.json()
        assert created_payload["dataset_key"] == "mart_commerce_daily"
        assert created_payload["grant_axis"] == "workspace"
        assert created_payload["subject_key"] == "primary"
        assert created_payload["granted_by"] == "owner-1"

        reuse_response = client.put(
            "/api/v1/identity/dataset-grants",
            json={
                "dataset_key": "mart_commerce_daily",
                "grant_axis": "workspace",
                "subject_key": "primary",
                "granted_by": "owner-2",
            },
        )

        assert reuse_response.status_code == 200
        assert reuse_response.json()["id"] == created_payload["id"]
        assert reuse_response.json()["granted_by"] == "owner-1"

        list_response = client.get("/api/v1/identity/dataset-grants")

        assert list_response.status_code == 200
        assert [dataset["key"] for dataset in list_response.json()["catalog_datasets"]] == [
            "mart_channel_performance",
            "mart_commerce_daily",
        ]
        assert [grant["id"] for grant in list_response.json()["grants"]] == [created_payload["id"]]

        delete_response = client.delete(f"/api/v1/identity/dataset-grants/{created_payload['id']}")

        assert delete_response.status_code == 204
        final_payload = client.get("/api/v1/identity/dataset-grants").json()
        assert final_payload["grants"] == []
        assert [dataset["key"] for dataset in final_payload["catalog_datasets"]] == [
            "mart_channel_performance",
            "mart_commerce_daily",
        ]
    finally:
        client_generator.close()


def test_dataset_grant_rejects_unknown_dataset() -> None:
    client_generator = _build_identity_client()
    client = next(client_generator)

    try:
        response = client.put(
            "/api/v1/identity/dataset-grants",
            json={
                "dataset_key": "missing_dataset",
                "grant_axis": "workspace",
                "subject_key": "primary",
                "granted_by": "owner-1",
            },
        )

        assert response.status_code == 400
        assert response.json()["detail"] == {
            "field": "dataset_key",
            "message": "Unknown dataset 'missing_dataset'.",
        }
    finally:
        client_generator.close()


def test_dataset_grant_controls_query_bootstrap_visibility() -> None:
    client_generator = _build_identity_client()
    client = next(client_generator)

    try:
        first_grant = client.put(
            "/api/v1/identity/dataset-grants",
            json={
                "dataset_key": "mart_commerce_daily",
                "grant_axis": "workspace",
                "subject_key": "primary",
                "granted_by": "owner-1",
            },
        )
        second_grant = client.put(
            "/api/v1/identity/dataset-grants",
            json={
                "dataset_key": "mart_channel_performance",
                "grant_axis": "workspace",
                "subject_key": "secondary",
                "granted_by": "owner-1",
            },
        )

        assert first_grant.status_code == 201
        assert second_grant.status_code == 201

        bootstrap_response = client.get(
            "/api/v1/query/bootstrap",
            headers={"X-FLooks-Workspace": "primary"},
        )

        assert bootstrap_response.status_code == 200
        assert [dataset["key"] for dataset in bootstrap_response.json()["datasets"]] == [
            "mart_commerce_daily"
        ]
    finally:
        client_generator.close()


def test_dataset_grant_list_reports_latest_dashboard_usage_summary() -> None:
    client_generator = _build_identity_client()
    client = next(client_generator)

    try:
        document = build_starter_dashboard_document(
            key="commerce-home-usage",
            title="Commerce Usage Dashboard",
        ).model_dump(mode="json", by_alias=True)

        create_response = client.post(
            "/api/v1/dashboards",
            json={
                "slug": "commerce-home-usage",
                "description": "Dashboard used to verify dataset usage impact summaries.",
                "ownerPrincipalKind": "user",
                "ownerPrincipalKey": "owner-1",
                "createdBy": "owner-1",
                "summary": "Seed usage impact dashboard.",
                "document": document,
            },
        )

        assert create_response.status_code == 201

        response = client.get("/api/v1/identity/dataset-grants")

        assert response.status_code == 200
        payload = response.json()
        commerce_daily = next(
            dataset
            for dataset in payload["catalog_datasets"]
            if dataset["key"] == "mart_commerce_daily"
        )

        assert commerce_daily["usage_summary"]["dashboard_count"] == 1
        assert commerce_daily["usage_summary"]["panel_count"] == 7
        assert commerce_daily["usage_summary"]["sample_panels"][0] == {
            "dashboard_slug": "commerce-home-usage",
            "dashboard_title": "Commerce Usage Dashboard",
            "panel_id": "panel-gmv",
            "panel_title": "GMV",
            "panel_kind": "scorecard",
        }
    finally:
        client_generator.close()