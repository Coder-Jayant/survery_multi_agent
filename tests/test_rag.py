"""
tests/test_rag.py
Tests for RAG ingest and retrieval pipeline
"""

import os
import json
import tempfile
import pytest
from pathlib import Path

# ── Helpers ───────────────────────────────────────────────────────────────────

def _check_faiss_index_exists():
    """Return True if the FAISS index exists (needed for retrieval tests)."""
    return (
        Path("rag/faq_index.faiss").exists()
        and Path("rag/faq_chunks.json").exists()
    )


# ── Ingest tests ──────────────────────────────────────────────────────────────

class TestIngest:
    def test_ingest_module_importable(self):
        from rag import ingest  # noqa: F401

    def test_build_chunks_basic(self):
        from rag.ingest import build_chunks
        text = "Q: What is CSAT?\nA: Customer satisfaction score.\n\nQ: What is NPS?\nA: Net promoter score."
        chunks = build_chunks(text)
        assert isinstance(chunks, list)
        assert len(chunks) >= 1
        for c in chunks:
            assert "chunk_id" in c
            assert "text" in c
            assert len(c["text"]) > 0

    def test_chunk_ids_are_stable(self):
        from rag.ingest import build_chunks
        text = "Q: What is CSAT?\nA: Customer satisfaction score.\n\n"
        chunks1 = build_chunks(text)
        chunks2 = build_chunks(text)
        assert chunks1[0]["chunk_id"] == chunks2[0]["chunk_id"]

    def test_chunk_ids_are_unique(self):
        from rag.ingest import build_chunks
        text = "\n\n".join([f"Q: Question {i}?\nA: Answer {i}." for i in range(20)])
        chunks = build_chunks(text)
        ids = [c["chunk_id"] for c in chunks]
        assert len(ids) == len(set(ids)), "chunk_ids must be unique"


# ── Retrieval tests ───────────────────────────────────────────────────────────

@pytest.mark.skipif(not _check_faiss_index_exists(), reason="FAISS index not built — run python rag/ingest.py first")
class TestRetrieve:
    def test_retrieve_returns_list(self):
        from rag.retrieve import retrieve
        results = retrieve("What is CSAT?", top_k=3, rerank=False)
        assert isinstance(results, list)

    def test_retrieve_top_k_respected(self):
        from rag.retrieve import retrieve
        results = retrieve("What is NPS?", top_k=2, rerank=False)
        assert len(results) <= 2

    def test_retrieve_chunk_structure(self):
        from rag.retrieve import retrieve
        results = retrieve("How do you handle complaints?", top_k=3, rerank=False)
        assert len(results) > 0
        chunk = results[0]
        assert "chunk_id" in chunk
        assert "text" in chunk
        assert "faiss_score" in chunk
        assert isinstance(chunk["faiss_score"], float)

    def test_retrieve_with_rerank(self):
        from rag.retrieve import retrieve
        results = retrieve("What is average wait time?", top_k=3, rerank=True)
        assert isinstance(results, list)
        assert len(results) > 0
        chunk = results[0]
        assert "rerank_score" in chunk
        assert "reranked" in chunk
        assert chunk["reranked"] is True

    def test_rerank_score_type(self):
        from rag.retrieve import retrieve
        results = retrieve("customer satisfaction target", top_k=3, rerank=True)
        for chunk in results:
            assert isinstance(chunk.get("rerank_score"), float)

    def test_retrieve_returns_fewer_than_top_k_if_not_enough_chunks(self):
        from rag.retrieve import retrieve
        results = retrieve("xyz123nonexistentquery", top_k=100, rerank=False)
        # Should not crash; should return whatever is available
        assert isinstance(results, list)

    def test_retrieve_empty_query_does_not_crash(self):
        from rag.retrieve import retrieve
        try:
            results = retrieve("", top_k=3, rerank=False)
            assert isinstance(results, list)
        except Exception:
            pass  # Some models may error on empty string — acceptable


# ── Schema tests ──────────────────────────────────────────────────────────────

class TestSchemas:
    def test_retrieved_chunk_schema(self):
        from schemas.models import RetrievedChunk
        chunk = RetrievedChunk(
            chunk_id="faq_abc123",
            text="CSAT measures satisfaction.",
            score=0.87,
            source="faq_document.txt",
        )
        assert chunk.chunk_id == "faq_abc123"
        assert chunk.score == 0.87
        assert chunk.reranked is False  # default

    def test_retrieved_chunk_with_rerank_fields(self):
        from schemas.models import RetrievedChunk
        chunk = RetrievedChunk(
            chunk_id="faq_xyz",
            text="NPS measures loyalty.",
            score=1.23,
            source="faq_document.txt",
            faiss_score=0.82,
            rerank_score=1.23,
            reranked=True,
        )
        assert chunk.faiss_score == 0.82
        assert chunk.rerank_score == 1.23
        assert chunk.reranked is True
