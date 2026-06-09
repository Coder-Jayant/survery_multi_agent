"""
api/routes_knowledge.py
------------------------
GET  /api/knowledge/chunks
POST /api/knowledge/retrieve
GET  /api/knowledge/list
POST /api/knowledge/rebuild
Reuses rag/retrieve.py and rag/ingest.py directly.
"""
from __future__ import annotations

import os
import sys

from fastapi import APIRouter
from pydantic import BaseModel

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

router = APIRouter(prefix="/api/knowledge")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KB_DIR = os.path.join(ROOT, "rag", "vector_store")
DEFAULT_KB_META = os.path.join(KB_DIR, "faq_meta.pkl")


class RetrieveRequest(BaseModel):
    query: str
    top_k: int = 3
    rerank: bool = True


def _list_chunks() -> list[dict]:
    """Load chunk metadata from FAISS pkl file."""
    try:
        import pickle
        with open(DEFAULT_KB_META, "rb") as f:
            meta = pickle.load(f)
        chunks = []
        for i, chunk in enumerate(meta):
            text = chunk.get("text", "")
            words = text.split()
            chunks.append({
                "chunk_id": chunk.get("chunk_id", f"chunk_{i:03d}"),
                "text": text,
                "source": chunk.get("source", "faq_document.txt"),
                "token_count": len(words),
            })
        return chunks
    except FileNotFoundError:
        return []
    except Exception as e:
        print(f"[knowledge] Error loading chunks: {e}")
        return []


@router.get("/chunks")
def get_chunks():
    return {"chunks": _list_chunks()}


@router.post("/retrieve")
def retrieve_chunks(req: RetrieveRequest):
    try:
        from rag.retrieve import retrieve
        results = retrieve(req.query, top_k=req.top_k, rerank=req.rerank)
        chunks = [
            {
                "chunk_id": r["chunk_id"],
                "text": r["text"],
                "score": r["score"],
                "faiss_score": r.get("faiss_score", r["score"]),
                "rerank_score": r.get("rerank_score"),
                "reranked": r.get("reranked", False),
                "source": r["source"],
            }
            for r in results
        ]
        return {
            "query": req.query,
            "chunks": chunks,
            "reranked": req.rerank and any(c["reranked"] for c in chunks),
        }
    except Exception as e:
        return {"query": req.query, "chunks": [], "error": str(e), "reranked": False}


@router.get("/list")
def list_kbs():
    chunks = _list_chunks()
    kbs = [
        {
            "name": "default",
            "active": True,
            "chunk_count": len(chunks),
            "embedding_model": "all-MiniLM-L6-v2",
            "index_type": "FAISS IndexFlatIP",
            "source_file": "faq_document.txt",
            "reranker_model": "cross-encoder/ms-marco-MiniLM-L-6-v2",
            "reranker_active": True,
        }
    ]
    return {"knowledge_bases": kbs}


@router.post("/rebuild")
def rebuild_index():
    try:
        import subprocess
        import sys as _sys
        faq_path = os.path.join(ROOT, "data", "faq_document.txt")
        ingest_path = os.path.join(ROOT, "rag", "ingest.py")
        result = subprocess.run(
            [_sys.executable, ingest_path],
            capture_output=True, text=True, timeout=120
        )
        if result.returncode == 0:
            return {"message": "FAISS index rebuilt successfully."}
        return {"message": f"Rebuild failed: {result.stderr[:200]}"}
    except Exception as e:
        return {"message": f"Error: {str(e)}"}
