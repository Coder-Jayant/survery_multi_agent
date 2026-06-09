"""
tests/test_api.py
FastAPI route tests using TestClient (no running server needed).
"""

import os
import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def client():
    from api.main import app
    return TestClient(app)


# ── Health / root ─────────────────────────────────────────────────────────────

class TestRoot:
    def test_root_or_frontend_serves(self, client):
        response = client.get("/")
        # Either serves HTML (frontend build) or 404 if not built
        assert response.status_code in (200, 404)


# ── Dashboard ─────────────────────────────────────────────────────────────────

@pytest.mark.skipif(
    not os.path.exists("data/survey_responses.json"),
    reason="survey_responses.json not generated",
)
class TestDashboard:
    def test_dashboard_returns_200(self, client):
        response = client.get("/api/dashboard")
        assert response.status_code == 200

    def test_dashboard_has_required_fields(self, client):
        response = client.get("/api/dashboard")
        data = response.json()
        # Dashboard returns nested structure with kpis sub-object
        kpis = data.get("kpis", data)  # support both flat and nested
        assert "avg_rating" in kpis or "avg_rating" in data
        assert "csat_score" in kpis or "csat" in kpis or "csat" in data

    def test_dashboard_values_in_range(self, client):
        data = client.get("/api/dashboard").json()
        kpis = data.get("kpis", data)
        avg = kpis.get("avg_rating", data.get("avg_rating"))
        csat = kpis.get("csat_score", kpis.get("csat", data.get("csat")))
        assert avg is not None and 1.0 <= float(avg) <= 5.0
        assert csat is not None and 0.0 <= float(csat) <= 100.0


# ── Analytics ─────────────────────────────────────────────────────────────────

@pytest.mark.skipif(
    not os.path.exists("data/survey_responses.json"),
    reason="survey_responses.json not generated",
)
class TestAnalytics:
    def test_trends_returns_200(self, client):
        response = client.get("/api/analytics/trends")
        assert response.status_code == 200

    def test_trends_has_data(self, client):
        data = client.get("/api/analytics/trends").json()
        # May return {"months": [...]} or a list directly
        items = data if isinstance(data, list) else data.get("months", data.get("data", []))
        assert len(items) > 0

    def test_channels_returns_200(self, client):
        response = client.get("/api/analytics/channels")
        assert response.status_code == 200

    def test_compare_with_dates(self, client):
        response = client.get(
            "/api/analytics/compare",
            params={"start_a": "2026-04-01", "end_a": "2026-04-30",
                    "start_b": "2026-05-01", "end_b": "2026-05-31"},
        )
        assert response.status_code == 200


# ── Knowledge Base ─────────────────────────────────────────────────────────────

@pytest.mark.skipif(
    not (os.path.exists("rag/faq_index.faiss") and os.path.exists("rag/faq_chunks.json")),
    reason="FAISS index not built",
)
class TestKnowledgeBase:
    def test_kb_list_returns_200(self, client):
        response = client.get("/api/knowledge/list")
        assert response.status_code == 200

    def test_kb_list_has_kbs(self, client):
        data = client.get("/api/knowledge/list").json()
        assert "knowledge_bases" in data
        assert len(data["knowledge_bases"]) > 0

    def test_kb_reranker_info_present(self, client):
        data = client.get("/api/knowledge/list").json()
        kb = data["knowledge_bases"][0]
        assert "reranker_active" in kb

    def test_kb_chunks_returns_200(self, client):
        response = client.get("/api/knowledge/chunks")
        assert response.status_code == 200

    def test_kb_retrieve_post(self, client):
        response = client.post(
            "/api/knowledge/retrieve",
            json={"query": "What is CSAT?", "top_k": 3, "rerank": True},
        )
        assert response.status_code == 200
        data = response.json()
        assert "chunks" in data
        assert isinstance(data["chunks"], list)

    def test_kb_retrieve_has_rerank_scores(self, client):
        response = client.post(
            "/api/knowledge/retrieve",
            json={"query": "average wait time", "top_k": 3, "rerank": True},
        )
        data = response.json()
        assert data.get("reranked") is True
        chunk = data["chunks"][0]
        assert "rerank_score" in chunk
        assert "faiss_score" in chunk


# ── Config ────────────────────────────────────────────────────────────────────

class TestConfig:
    def test_get_config_returns_200(self, client):
        response = client.get("/api/config")
        assert response.status_code == 200

    def test_config_has_provider_field(self, client):
        data = client.get("/api/config").json()
        assert "provider" in data

    def test_config_has_model_field(self, client):
        data = client.get("/api/config").json()
        assert "model" in data


# ── History ───────────────────────────────────────────────────────────────────

class TestHistory:
    def test_history_returns_200(self, client):
        response = client.get("/api/history")
        assert response.status_code == 200

    def test_history_has_runs_key(self, client):
        data = client.get("/api/history").json()
        assert "runs" in data
        assert isinstance(data["runs"], list)
