"""
===============================================================================
FILE: tests/test_api_contract.py
===============================================================================

PURPOSE
-------
Integration tests verifying all FastAPI management endpoints, response shapes,
health probe compatibility, and error handling.

===============================================================================
"""

import pytest
from fastapi.testclient import TestClient
from api.server import app

client = TestClient(app)


def test_api_health_endpoint():
    """Verify /health returns 200, status=ok, mode=LIVE, and component list."""
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["mode"] == "LIVE"
    assert data["connected"] is True
    assert "components" in data
    assert len(data["components"]) >= 4

    comp_ids = [c["id"] for c in data["components"]]
    assert "frontend" in comp_ids
    assert "api" in comp_ids
    assert "classifier" in comp_ids
    assert "enforcement" in comp_ids


def test_api_status_endpoint():
    """Verify /api/v1/status."""
    res = client.get("/api/v1/status")
    assert res.status_code == 200
    data = res.json()
    assert data["mode"] == "LIVE"
    assert data["provenance"] == "MEASURED_LIVE"


def test_api_metrics_endpoints():
    """Verify /api/v1/metrics/current and history."""
    res_curr = client.get("/api/v1/metrics/current")
    assert res_curr.status_code == 200
    assert "throughputMbps" in res_curr.json()

    res_hist = client.get("/api/v1/metrics/history?limit=10")
    assert res_hist.status_code == 200
    assert isinstance(res_hist.json(), list)


def test_api_flows_endpoint():
    """Verify /api/v1/flows returns FlowRecords."""
    res = client.get("/api/v1/flows")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    if data:
        flow = data[0]
        assert "sourceEndpoint" in flow
        assert "predictedClass" in flow
        assert "confidence" in flow


def test_api_capacity_endpoint():
    """Verify /api/v1/capacity returns distinct capacity figures."""
    res = client.get("/api/v1/capacity")
    assert res.status_code == 200
    data = res.json()
    assert "estimatedWanMbps" in data
    assert "configuredShapingMbps" in data
    assert "observedThroughputMbps" in data


def test_api_policies_endpoints():
    """Verify /api/v1/policies, preview, and apply."""
    res_pols = client.get("/api/v1/policies")
    assert res_pols.status_code == 200
    assert len(res_pols.json()) == 7

    res_prev = client.post(
        "/api/v1/policies/preview",
        json={"policies": {"pol-video-call": {"minSharePct": 20.0, "maxRateMbps": 100.0}}},
    )
    assert res_prev.status_code == 200
    assert "previewId" in res_prev.json()

    res_apply = client.post(
        "/api/v1/policies/apply",
        json={"policies": {"pol-video-call": {"minSharePct": 20.0, "maxRateMbps": 100.0}}, "reason": "Test apply"},
    )
    assert res_apply.status_code == 200
    assert res_apply.json()["decision"] == "APPLY_ADAPTIVE_QOS"


def test_api_intents_lifecycle():
    """Verify create, get, and cancel intent."""
    res_create = client.post(
        "/api/v1/intents",
        json={
            "name": "Live Streaming Test",
            "trafficClass": "Streaming",
            "durationMinutes": 45,
            "priorityTier": 2,
        },
    )
    assert res_create.status_code == 201
    intent = res_create.json()
    assert intent["name"] == "Live Streaming Test"

    res_list = client.get("/api/v1/intents")
    assert res_list.status_code == 200
    assert any(i["id"] == intent["id"] for i in res_list.json())

    res_del = client.delete(f"/api/v1/intents/{intent['id']}")
    assert res_del.status_code == 200
    assert res_del.json()["cancelled"] is True


def test_api_model_insights():
    """Verify /api/v1/model returns evaluation metadata."""
    res = client.get("/api/v1/model")
    assert res.status_code == 200
    data = res.json()
    assert "overallAccuracy" in data
    assert "perClassMetrics" in data
    assert "confusionMatrix" in data
