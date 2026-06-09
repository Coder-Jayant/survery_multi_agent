"""
agents/rag_agent.py
--------------------
RAGAgent: Retrieves relevant FAQ context for a given query.

Receives a TaskSpec with an intent/query, hits the FAISS vector store,
and returns a RAGAgentResult with the top-k chunks and a short context summary.

Uses the unified LLM abstraction (providers.llm.get_llm()) so it works with
Groq, Gemini, OpenAI, or Anthropic. Falls back to a concatenated chunk summary
if no LLM is available.
"""

from __future__ import annotations

import os
import sys

from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from providers.llm import get_llm
from schemas.models import RAGAgentResult, RetrievedChunk, TaskSpec
from rag.retrieve import retrieve

load_dotenv()


def run(task: TaskSpec) -> RAGAgentResult:
    """Execute the RAGAgent for a given TaskSpec."""
    query = task.intent
    top_k = task.context.get("top_k", 3)

    # ── Step 1: Two-stage retrieval (FAISS + cross-encoder reranking) ────────
    raw_chunks = retrieve(query, top_k=top_k, rerank=True)

    retrieved_chunks = [
        RetrievedChunk(
            chunk_id=c["chunk_id"],
            text=c["text"],
            score=c["score"],
            source=c["source"],
            faiss_score=c.get("faiss_score"),
            rerank_score=c.get("rerank_score"),
            reranked=c.get("reranked", False),
        )
        for c in raw_chunks
    ]

    # ── Step 2: Summarize retrieved context with LLM ─────────────────────────
    if not retrieved_chunks:
        return RAGAgentResult(
            query=query,
            retrieved_chunks=[],
            context_summary="No relevant FAQ context found for this query.",
        )

    chunks_text = "\n\n---\n\n".join(
        f"[{c.chunk_id}] {c.text}" for c in retrieved_chunks
    )
    summary_prompt = (
        f"You are a business context summarizer. "
        f"Given the following FAQ excerpts retrieved for the query: '{query}'\n\n"
        f"{chunks_text}\n\n"
        "Summarize the most relevant business context in 2–3 concise sentences. "
        "Focus on facts, targets, and policies relevant to the query."
    )

    context_summary = ""
    try:
        llm = get_llm()
        if llm.available:
            resp = llm.chat(messages=[{"role": "user", "content": summary_prompt}])
            context_summary = resp.content.strip()
    except Exception as e:
        print(f"[RAGAgent] LLM error: {e}")

    if not context_summary:
        # Deterministic fallback: concatenate top chunk texts
        context_summary = " | ".join(c.text[:150] for c in retrieved_chunks[:2])

    return RAGAgentResult(
        query=query,
        retrieved_chunks=retrieved_chunks,
        context_summary=context_summary,
    )
