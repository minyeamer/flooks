"""Tests for the FLooks bootstrap API routes."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import app


client = TestClient(app)


def test_health() -> None:
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_system_metadata() -> None:
    response = client.get("/api/v1/system")

    assert response.status_code == 200
    payload = response.json()

    assert payload["name"] == "FLooks API"
    assert "LINKMERCE_POSTGRES" in payload["dataSources"]
    assert "OWNER" in payload["roles"]


def test_overview() -> None:
    response = client.get("/api/v1/overview")

    assert response.status_code == 200
    payload = response.json()

    assert payload["product"] == "FLooks"
    assert payload["environment"] == "development"
    assert any(metric["label"] == "Metadata tables" and metric["value"] == "4" for metric in payload["metrics"])
    assert any(metric["label"] == "Governed datasets" and metric["value"] == "2" for metric in payload["metrics"])
    assert any(metric["label"] == "Live endpoints" and metric["value"] == "8" for metric in payload["metrics"])
    assert any(link["href"] == "/api/v1/overview" for link in payload["service_links"])
    assert any(link["href"] == "/api/v1/identity/bootstrap" for link in payload["service_links"])
    assert any(link["href"] == "/api/v1/metadata/bootstrap" for link in payload["service_links"])
    assert any(link["href"] == "/api/v1/query/bootstrap" for link in payload["service_links"])


def test_identity_bootstrap() -> None:
    response = client.get("/api/v1/identity/bootstrap")

    assert response.status_code == 200
    payload = response.json()

    assert payload["identity"]["email_verification_required"] is True
    assert payload["identity"]["admin_approval_required"] is True
    assert payload["identity"]["default_role"] == "VIEWER"
    assert payload["permissions"]["dataset_grant_axes"] == [
        "user",
        "team",
        "department",
        "role",
        "workspace",
    ]


def test_metadata_bootstrap() -> None:
    response = client.get("/api/v1/metadata/bootstrap")

    assert response.status_code == 200
    payload = response.json()

    assert payload["dialect"] == "postgresql"
    assert payload["driver"] == "psycopg"
    assert payload["expected_revision"] == "20260524_0001"
    assert [table["name"] for table in payload["tables"]] == [
        "dashboard",
        "dashboard_version",
        "dataset_grant",
        "resource_acl_entry",
    ]


def test_settings_accept_comma_separated_allowed_origins() -> None:
    settings = Settings(
        _env_file=None,
        allowed_origins="http://localhost:5173, http://127.0.0.1:4173/",
    )

    assert settings.allowed_origins == ["http://localhost:5173", "http://127.0.0.1:4173"]


def test_settings_accept_database_url() -> None:
    settings = Settings(_env_file=None, database_url=" postgresql+psycopg://flooks:flooks@localhost:5432/flooks_meta ")

    assert settings.database_url == "postgresql+psycopg://flooks:flooks@localhost:5432/flooks_meta"