from decimal import Decimal
from unittest.mock import MagicMock

from fastapi.testclient import TestClient

import src.main as main


client = TestClient(main.app)


def mock_database(monkeypatch, execute):
    """Mock database connections without touching PostgreSQL."""
    connection = MagicMock()
    connection.execute.side_effect = execute

    context = MagicMock()
    context.__enter__.return_value = connection
    context.__exit__.return_value = False

    monkeypatch.setattr(main.engine, "connect", lambda: context)
    return connection


def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["docs"] == "/docs"


def test_health_success(monkeypatch):
    mock_database(monkeypatch, lambda *args, **kwargs: MagicMock())

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "healthy",
        "database": "connected",
    }


def test_health_database_failure(monkeypatch):
    def fail(*args, **kwargs):
        raise RuntimeError("Simulated database failure")

    mock_database(monkeypatch, fail)

    response = client.get("/health")

    assert response.status_code == 503
    assert response.json()["detail"]["database"] == "disconnected"


def test_customers_rejects_invalid_activity_status():
    response = client.get(
        "/customers",
        params={"activity_status": "Unknown"},
    )
    assert response.status_code == 400


def test_customers_rejects_invalid_limit():
    response = client.get("/customers", params={"limit": 0})
    assert response.status_code == 422


def test_customers_returns_empty_result(monkeypatch):
    def execute(statement, params=None):
        result = MagicMock()

        if "COUNT(*)" in str(statement):
            result.scalar_one.return_value = 0
        else:
            result.mappings.return_value.all.return_value = []

        return result

    mock_database(monkeypatch, execute)

    response = client.get("/customers")

    assert response.status_code == 200
    assert response.json() == {
        "total": 0,
        "returned": 0,
        "limit": 25,
        "offset": 0,
        "customers": [],
    }


def test_customers_filter_parameters_reach_database(monkeypatch):
    calls = []

    def execute(statement, params=None):
        calls.append((str(statement), params or {}))
        result = MagicMock()

        if "COUNT(*)" in str(statement):
            result.scalar_one.return_value = 1
        else:
            result.mappings.return_value.all.return_value = [
                {
                    "customer_id": 101,
                    "recency": 12,
                    "frequency": 4,
                    "monetary": Decimal("250.50"),
                    "cluster": 1,
                    "activity_status": "At Risk",
                    "segment": "Mid-Value / Lapsing",
                }
            ]

        return result

    mock_database(monkeypatch, execute)

    response = client.get(
        "/customers",
        params={
            "activity_status": "At Risk",
            "segment": "Mid-Value / Lapsing",
            "search": 101,
            "limit": 10,
            "offset": 0,
        },
    )

    assert response.status_code == 200
    assert response.json()["returned"] == 1
    assert response.json()["customers"][0]["monetary"] == 250.5

    query_params = calls[0][1]
    assert query_params["activity_status"] == "At Risk"
    assert query_params["segment"] == "Mid-Value / Lapsing"
    assert query_params["search"] == 101


def test_at_risk_customers(monkeypatch):
    expected = [
        {
            "customer_id": 101,
            "activity_status": "At Risk",
            "segment": "Mid-Value / Lapsing",
        }
    ]

    monkeypatch.setattr(
        main,
        "fetch_customers_by_status",
        lambda status, limit: expected,
    )

    response = client.get("/customers/at-risk?limit=10")

    assert response.status_code == 200
    assert response.json()["count"] == 1
    assert response.json()["customers"] == expected


def test_inactive_customers(monkeypatch):
    monkeypatch.setattr(
        main,
        "fetch_customers_by_status",
        lambda status, limit: [],
    )

    response = client.get("/customers/inactive")

    assert response.status_code == 200
    assert response.json() == {"count": 0, "customers": []}


def test_missing_customer_returns_404(monkeypatch):
    def execute(*args, **kwargs):
        result = MagicMock()
        result.mappings.return_value.first.return_value = None
        return result

    mock_database(monkeypatch, execute)

    response = client.get("/customers/999999999")

    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_segment_analytics_empty_result(monkeypatch):
    def execute(*args, **kwargs):
        result = MagicMock()
        result.mappings.return_value.all.return_value = []
        return result

    mock_database(monkeypatch, execute)

    response = client.get("/analytics/segments")

    assert response.status_code == 200
    assert response.json() == {"total_segments": 0, "segments": []}


def test_overview_analytics(monkeypatch):
    overview = {
        "total_customers": 10,
        "active_customers": 4,
        "at_risk_customers": 3,
        "inactive_customers": 3,
        "transaction_lines": 50,
        "total_orders": 20,
        "total_revenue": Decimal("1200.50"),
        "average_order_value": Decimal("60.025"),
    }

    def execute(*args, **kwargs):
        result = MagicMock()
        result.mappings.return_value.one.return_value = overview
        return result

    mock_database(monkeypatch, execute)

    response = client.get("/analytics/overview")

    assert response.status_code == 200
    assert response.json()["total_customers"] == 10
    assert response.json()["total_orders"] == 20
    assert response.json()["total_revenue"] == 1200.5
    assert response.json()["average_order_value"] == 60.025
