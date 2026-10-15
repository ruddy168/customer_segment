import json
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

import src.ai_retention as ai
from src.main import app


client = TestClient(app)

PAYLOAD = {
    "overview": {
        "total_customers": 100,
        "active_customers": 40,
        "at_risk_customers": 30,
        "inactive_customers": 30,
        "total_revenue": 10000,
        "total_orders": 250,
        "average_order_value": 40,
    },
    "segments": [
        {
            "segment": "High-Value / Frequent",
            "customer_count": 20,
            "average_recency": 5,
            "average_frequency": 8,
            "average_monetary": 500,
        },
        {
            "segment": "Mid-Value / Lapsing",
            "customer_count": 30,
            "average_recency": 60,
            "average_frequency": 3,
            "average_monetary": 150,
        },
    ],
}


def valid_ai_response():
    return {
        "executive_summary": "Several customer groups may benefit from targeted retention experiments.",
        "key_observations": [
            "The overview contains 100 customers.",
            "The supplied segment metrics describe two customer groups.",
            "The overview reports 250 orders.",
        ],
        "priorities": [
            {
                "priority": "HIGH",
                "title": "Test a reactivation campaign",
                "target_segment": "Mid-Value / Lapsing",
                "rationale": "This segment has an average recency of 60.",
                "actions": ["Send a targeted email", "Measure repeat orders"],
                "success_metric": "Repeat purchase rate",
            },
            {
                "priority": "MEDIUM",
                "title": "Test a loyalty offer",
                "target_segment": "High-Value / Frequent",
                "rationale": "This segment has an average frequency of 8.",
                "actions": ["Test a loyalty benefit", "Compare repeat purchases"],
                "success_metric": "Repeat purchase rate",
            },
            {
                "priority": "LOW",
                "title": "Evaluate campaign engagement",
                "target_segment": "Mid-Value / Lapsing",
                "rationale": "A small campaign can test customer response.",
                "actions": ["Send a campaign", "Review engagement results"],
                "success_metric": "Campaign engagement rate",
            },
        ],
        "caveats": "These are hypotheses to test, not guaranteed outcomes.",
    }


def mock_gemini(monkeypatch, response_text=None, error=None):
    """Replace the Gemini client so no real API call is made."""
    from google import genai

    fake_response = MagicMock()
    fake_response.text = response_text

    fake_client = MagicMock()
    if error is not None:
        fake_client.models.generate_content.side_effect = error
    else:
        fake_client.models.generate_content.return_value = fake_response

    monkeypatch.setattr(genai, "Client", lambda **kwargs: fake_client)
    return fake_client


def test_ai_health_reports_configuration(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setenv("GEMINI_MODEL", "test-model")

    response = client.get("/ai/health")

    assert response.status_code == 200
    assert response.json() == {
        "configured": True,
        "model": "test-model",
    }


def test_ai_health_reports_missing_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)

    response = client.get("/ai/health")

    assert response.status_code == 200
    assert response.json()["configured"] is False


def test_ai_request_rejects_missing_required_overview():
    response = client.post(
        "/ai/retention-insights",
        json={"segments": PAYLOAD["segments"]},
    )

    assert response.status_code == 422


def test_ai_request_rejects_empty_segments():
    payload = {**PAYLOAD, "segments": []}

    response = client.post("/ai/retention-insights", json=payload)

    assert response.status_code == 422


def test_ai_response_schema_rejects_invalid_priority():
    result = valid_ai_response()
    result["priorities"][0]["priority"] = "URGENT"

    with pytest.raises(ValidationError):
        ai.RetentionInsightsResponse.model_validate(result)


def test_ai_missing_api_key_returns_503(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)

    response = client.post("/ai/retention-insights", json=PAYLOAD)

    assert response.status_code == 503


def test_ai_returns_validated_response(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setenv("GEMINI_MODEL", "test-model")

    expected = valid_ai_response()
    fake_client = mock_gemini(
        monkeypatch,
        response_text=json.dumps(expected),
    )

    response = client.post("/ai/retention-insights", json=PAYLOAD)

    assert response.status_code == 200
    assert response.json() == expected
    fake_client.models.generate_content.assert_called_once()


def test_ai_malformed_json_returns_502(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    mock_gemini(monkeypatch, response_text="not valid JSON")

    response = client.post("/ai/retention-insights", json=PAYLOAD)

    assert response.status_code == 502
    assert "invalid response" in response.json()["detail"].lower()


def test_ai_unknown_segment_returns_502(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")

    result = valid_ai_response()
    result["priorities"][0]["target_segment"] = "Segment not supplied"

    mock_gemini(monkeypatch, response_text=json.dumps(result))

    response = client.post("/ai/retention-insights", json=PAYLOAD)

    assert response.status_code == 502


def test_ai_rate_limit_returns_429(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    mock_gemini(
        monkeypatch,
        error=RuntimeError("429 RESOURCE_EXHAUSTED"),
    )

    response = client.post("/ai/retention-insights", json=PAYLOAD)

    assert response.status_code == 429


def test_ai_provider_failure_returns_502(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    mock_gemini(
        monkeypatch,
        error=RuntimeError("Simulated provider failure"),
    )

    response = client.post("/ai/retention-insights", json=PAYLOAD)

    assert response.status_code == 502
    assert "request failed" in response.json()["detail"].lower()
