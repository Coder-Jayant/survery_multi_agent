"""
api/main.py
-----------
FastAPI server for MiniSense Phase 2.

Original endpoints (unchanged):
  POST /ask          — synchronous JSON answer
  GET  /stream       — Server-Sent Events (real-time agent trace)
  GET  /health       — health check
  GET  /demo         — run a preset demo question (sync)

New Phase 2 endpoints (via routers):
  GET  /api/dashboard
  GET  /api/analytics/trends|compare|channels
  GET  /api/knowledge/chunks|list
  POST /api/knowledge/retrieve|rebuild
  GET  /api/agents/prompts
  PUT  /api/agents/prompts/{agent}
  GET  /api/config
  PUT  /api/config
  GET  /api/eval/results
  POST /api/eval/run
  GET  /api/data/list
  POST /api/data/generate
  GET  /api/history
"""
from __future__ import annotations

import json
import os
import queue
import sys
import threading
import time
import uuid

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from agents.orchestrator import ask

load_dotenv()

app = FastAPI(title="MiniSense API", version="2.0.0")


@app.on_event("startup")
async def _ensure_data():
    """
    Safety net for Railway / fresh deployments:
    If survey_responses.json or the FAISS index are missing, generate them.
    Normally they are committed to git so this is instant (files exist).
    """
    import asyncio, subprocess

    _ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data_path  = os.path.join(_ROOT, "data", "survey_responses.json")
    index_path = os.path.join(_ROOT, "rag", "vector_store", "faq_index.faiss")

    if not os.path.exists(data_path):
        print("[startup] survey_responses.json missing — generating dataset…")
        try:
            subprocess.run([sys.executable, os.path.join(_ROOT, "data", "generate_data.py")],
                           check=True, timeout=120)
            print("[startup] dataset generated.")
        except Exception as e:
            print(f"[startup] dataset generation failed: {e}")

    if not os.path.exists(index_path):
        print("[startup] FAISS index missing — building from FAQ…")
        try:
            subprocess.run([sys.executable, os.path.join(_ROOT, "rag", "ingest.py")],
                           check=True, timeout=120,
                           env={**os.environ, "PYTHONIOENCODING": "utf-8"})
            print("[startup] FAISS index built.")
        except Exception as e:
            print(f"[startup] FAISS build failed: {e}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register Phase 2 routers ──────────────────────────────────────────────────
from api.routes_dashboard import router as dashboard_router
from api.routes_analytics import router as analytics_router
from api.routes_knowledge import router as knowledge_router
from api.routes_agents import router as agents_router
from api.routes_config import router as config_router
from api.routes_eval import router as eval_router
from api.routes_data import router as data_router
from api.routes_history import router as history_router
from api.routes_chatbot import router as chatbot_router

app.include_router(dashboard_router)
app.include_router(analytics_router)
app.include_router(knowledge_router)
app.include_router(agents_router)
app.include_router(config_router)
app.include_router(eval_router)
app.include_router(data_router)
app.include_router(history_router)
app.include_router(chatbot_router)


class QuestionRequest(BaseModel):
    question: str


# ── Synchronous endpoint ──────────────────────────────────────────────────────

@app.post("/ask")
def ask_endpoint(req: QuestionRequest):
    t0 = time.time()
    result = ask(req.question)
    latency_ms = int((time.time() - t0) * 1000)
    _log_run(req.question, result, latency_ms)
    return {
        "question": result.question,
        "narrative": result.narrative,
        "supporting_data": result.supporting_data,
        "sources": result.sources,
        "agent_trace": result.agent_trace,
    }


# ── SSE streaming endpoint ────────────────────────────────────────────────────

@app.get("/stream")
def stream_endpoint(question: str):
    """
    Server-Sent Events endpoint.
    Runs the orchestrator in a background thread and streams events as they fire.
    """
    event_queue: queue.Queue = queue.Queue()
    final_result_holder: list = []
    t0 = time.time()

    def run_agent():
        try:
            result = ask(question, verbose=False, trace_callback=event_queue.put)
            final_result_holder.append(result)
        except Exception as e:
            event_queue.put({"type": "error", "message": str(e)})
        finally:
            event_queue.put(None)  # sentinel

    thread = threading.Thread(target=run_agent, daemon=True)
    thread.start()

    def generate():
        while True:
            event = event_queue.get()
            if event is None:
                break
            yield f"data: {json.dumps(event)}\n\n"
        # Log run after completion
        if final_result_holder:
            latency_ms = int((time.time() - t0) * 1000)
            _log_run(question, final_result_holder[0], latency_ms)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ── Utility endpoints ─────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "MiniSense", "version": "2.0.0"}


DEMO_QUESTION = "What are the top complaints in May 2026 and how do they compare to April?"

@app.get("/demo")
def demo():
    result = ask(DEMO_QUESTION)
    return {
        "question": result.question,
        "narrative": result.narrative,
        "supporting_data": result.supporting_data,
        "sources": result.sources,
        "agent_trace": result.agent_trace,
    }


# ── Run logging ───────────────────────────────────────────────────────────────

def _log_run(question: str, result, latency_ms: int):
    """Log a completed run to config/run_history.jsonl."""
    try:
        from api.config_manager import append_run
        append_run({
            "id": str(uuid.uuid4())[:8],
            "question": question,
            "agent_trace": result.agent_trace,
            "narrative_preview": result.narrative[:120] if result.narrative else "",
            "latency_ms": latency_ms,
            "supporting_data": result.supporting_data,
            "sources": result.sources,
        })
    except Exception:
        pass


# ── Serve React frontend (production build) ───────────────────────────────────

_FRONTEND_DIST = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "frontend", "dist"
)

if os.path.isdir(_FRONTEND_DIST):
    app.mount("/", StaticFiles(directory=_FRONTEND_DIST, html=True), name="frontend")
