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
    assert any(metric["label"] == "System roles" and metric["value"] == "4" for metric in payload["metrics"])
    assert any(link["href"] == "/api/v1/overview" for link in payload["service_links"])


def test_settings_accept_comma_separated_allowed_origins() -> None:
    settings = Settings(
        _env_file=None,
        allowed_origins="http://localhost:5173, http://127.0.0.1:4173/",
    )

    assert settings.allowed_origins == ["http://localhost:5173", "http://127.0.0.1:4173"]