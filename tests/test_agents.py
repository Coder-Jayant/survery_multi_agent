"""
tests/test_agents.py
Tests for agent schemas, structures, and deterministic logic.
LLM-dependent agent runs are skipped unless GROQ_API_KEY is set.
"""

import os
import pytest

GROQ_KEY_SET = bool(os.environ.get("GROQ_API_KEY", "").strip())
SURVEY_EXISTS = os.path.exists("data/survey_responses.json")
FAISS_EXISTS = os.path.exists("rag/faq_index.faiss") and os.path.exists("rag/faq_chunks.json")


# ── Schema / model tests ──────────────────────────────────────────────────────

class TestPydanticSchemas:
    def test_task_spec_importable(self):
        from schemas.models import TaskSpec, DateRange
        spec = TaskSpec(
            task_id="t1",
            agent="data_agent",
            intent="Compute CSAT for April",
            filters={"date_range": {"start": "2026-04-01", "end": "2026-04-30"}},
        )
        assert spec.agent == "data_agent"

    def test_date_range_model(self):
        from schemas.models import DateRange
        dr = DateRange(start="2026-04-01", end="2026-04-30")
        assert dr.start == "2026-04-01"

    def test_theme_count_model(self):
        from schemas.models import ThemeCount
        t = ThemeCount(theme="food_quality", count=300, percentage=30.0)
        assert t.theme == "food_quality"

    def test_data_agent_result(self):
        from schemas.models import DataAgentResult, DateRange, ThemeCount
        result = DataAgentResult(
            period_label="April 2026",
            date_range=DateRange(start="2026-04-01", end="2026-04-30"),
            total_responses=1000,
            avg_rating=4.2,
            csat_score=72.5,
            top_themes=[ThemeCount(theme="food_quality", count=300, percentage=30.0)],
            rating_distribution={"1": 0, "2": 50, "3": 100, "4": 400, "5": 450},
        )
        assert result.csat_score == 72.5

    def test_retrieved_chunk_default_reranked(self):
        from schemas.models import RetrievedChunk
        chunk = RetrievedChunk(chunk_id="faq_abc", text="hello", score=0.87)
        assert chunk.reranked is False
        assert chunk.source == "faq_document.txt"

    def test_retrieved_chunk_with_reranking(self):
        from schemas.models import RetrievedChunk
        chunk = RetrievedChunk(
            chunk_id="faq_xyz",
            text="NPS measures loyalty.",
            score=1.23,
            faiss_score=0.82,
            rerank_score=1.23,
            reranked=True,
        )
        assert chunk.reranked is True
        assert chunk.faiss_score == 0.82

    def test_rag_agent_result(self):
        from schemas.models import RAGAgentResult, RetrievedChunk
        chunk = RetrievedChunk(chunk_id="c1", text="hello", score=0.9)
        result = RAGAgentResult(
            query="test",
            retrieved_chunks=[chunk],
            context_summary="A summary.",
        )
        assert len(result.retrieved_chunks) == 1

    def test_comparison_agent_result(self):
        from schemas.models import ComparisonAgentResult, DataAgentResult, DateRange
        def _make_dar(label):
            return DataAgentResult(
                period_label=label,
                date_range=DateRange(start="2026-04-01", end="2026-04-30"),
                total_responses=1000,
                avg_rating=4.0,
                csat_score=70.0,
                top_themes=[],
                rating_distribution={"1": 0, "2": 0, "3": 100, "4": 500, "5": 400},
            )
        result = ComparisonAgentResult(
            period_a=_make_dar("April 2026"),
            period_b=_make_dar("May 2026"),
            delta_csat=-5.2,
            delta_avg_rating=-0.3,
            insight_summary="Ratings dropped in May.",
        )
        assert result.delta_csat == pytest.approx(-5.2)

    def test_final_answer_model(self):
        from schemas.models import FinalAnswer
        ans = FinalAnswer(
            question="What is CSAT?",
            narrative="CSAT improved this month.",
        )
        assert ans.question == "What is CSAT?"


# ── DataAgent deterministic fallback ─────────────────────────────────────────

@pytest.mark.skipif(not SURVEY_EXISTS, reason="survey_responses.json not generated")
class TestDataAgentFallback:
    def test_direct_tool_call_produces_valid_result(self):
        import json
        from tools.data_tools import (
            filter_by_period, compute_csat, compute_avg_rating,
            extract_top_themes, responses_by_channel,
        )
        with open("data/survey_responses.json") as f:
            data = json.load(f)
        responses = data if isinstance(data, list) else data.get("responses", [])

        filtered = filter_by_period(responses, "2026-04-01", "2026-04-30")
        assert len(filtered) > 0

        assert 0 <= compute_csat(filtered) <= 100
        assert 1 <= compute_avg_rating(filtered) <= 5
        assert isinstance(extract_top_themes(filtered, n=5), list)
        assert isinstance(responses_by_channel(filtered), dict)


# ── Module-level function structure tests ─────────────────────────────────────

class TestAgentModuleStructure:
    def test_orchestrator_ask_exists(self):
        from agents import orchestrator
        assert callable(orchestrator.ask)

    def test_orchestrator_trace_callback_supported(self):
        """ask() accepts trace_callback kwarg for SSE streaming (wired in api/main.py)."""
        from agents import orchestrator
        import inspect
        sig = inspect.signature(orchestrator.ask)
        assert "trace_callback" in sig.parameters

    def test_rag_agent_run_exists(self):
        from agents import rag_agent
        assert callable(rag_agent.run)

    def test_summary_agent_run_exists(self):
        from agents import summary_agent
        assert callable(summary_agent.run)

    def test_comparison_agent_run_exists(self):
        from agents import comparison_agent
        assert callable(comparison_agent.run)

    def test_data_agent_importable(self):
        from agents import data_agent  # noqa: F401
        assert hasattr(data_agent, "run")


# ── RAG ingest functions ──────────────────────────────────────────────────────

class TestIngestFunctions:
    def test_ingest_importable(self):
        from rag import ingest  # noqa: F401

    def test_split_into_qa_blocks(self):
        from rag.ingest import split_into_qa_blocks
        text = "Q: What is CSAT?\nA: Customer satisfaction score.\n\nQ: What is NPS?\nA: Net Promoter Score."
        blocks = split_into_qa_blocks(text)
        assert isinstance(blocks, list)
        assert len(blocks) >= 1

    def test_build_chunks_returns_list(self):
        from rag.ingest import build_chunks
        text = "Q: What is CSAT?\nA: Customer satisfaction score.\n\nQ: What is NPS?\nA: Net Promoter Score."
        chunks = build_chunks(text)
        assert isinstance(chunks, list)
        assert all("chunk_id" in c for c in chunks)
        assert all("text" in c for c in chunks)

    def test_chunk_ids_are_unique(self):
        from rag.ingest import build_chunks
        text = "\n\n".join([f"Q: Question {i}?\nA: Answer {i}." for i in range(20)])
        chunks = build_chunks(text)
        ids = [c["chunk_id"] for c in chunks]
        assert len(ids) == len(set(ids))

    def test_chunk_ids_stable_across_calls(self):
        from rag.ingest import build_chunks
        text = "Q: What is CSAT?\nA: Score.\n\n"
        assert build_chunks(text)[0]["chunk_id"] == build_chunks(text)[0]["chunk_id"]

    def test_approximate_tokens(self):
        from rag.ingest import approximate_tokens
        text = "hello world this is a test sentence"
        tokens = approximate_tokens(text)
        assert isinstance(tokens, int)
        assert tokens > 0


# ── RAG retrieval (requires built index) ─────────────────────────────────────

@pytest.mark.skipif(not FAISS_EXISTS, reason="FAISS index not built — run python rag/ingest.py first")
class TestRetrieve:
    def test_retrieve_returns_list(self):
        from rag.retrieve import retrieve
        results = retrieve("What is CSAT?", top_k=3, rerank=False)
        assert isinstance(results, list)

    def test_retrieve_chunk_has_required_keys(self):
        from rag.retrieve import retrieve
        results = retrieve("customer complaints", top_k=3, rerank=False)
        for r in results:
            assert "chunk_id" in r
            assert "text" in r
            assert "faiss_score" in r

    def test_retrieve_top_k_respected(self):
        from rag.retrieve import retrieve
        results = retrieve("NPS score", top_k=2, rerank=False)
        assert len(results) <= 2

    def test_retrieve_with_rerank(self):
        from rag.retrieve import retrieve
        results = retrieve("average wait time", top_k=3, rerank=True)
        assert len(results) > 0
        assert results[0]["reranked"] is True

    def test_rerank_score_is_float(self):
        from rag.retrieve import retrieve
        results = retrieve("satisfaction target", top_k=3, rerank=True)
        for r in results:
            assert isinstance(r.get("rerank_score"), float)
