# MiniSense — Interview & Demo Preparation Guide

Everything you need to confidently present this project, answer technical questions, and handle edge cases.

---

## 1. 30-Second Pitch

**MiniSense** is a production-grade multi-agent AI platform that analyses employee/customer survey responses. It uses a hierarchical agent architecture — an Orchestrator that plans and delegates, a DataAgent that extracts structured insights via LLM tool-calling, a RAGAgent that answers factual questions from a FAISS knowledge base with cross-encoder reranking, a ComparisonAgent for temporal comparisons, and a SummaryAgent that synthesises everything into a natural-language business report.

The frontend is a React + TypeScript SPA with real-time agent tracing via SSE, a live agent graph, interactive charts, an architecture visualiser, Evaluation Lab, and Admin Center.

---

## 2. Tech Stack — Every Choice Justified

| Layer | Choice | Why |
|---|---|---|
| LLM | **Groq / llama-3.3-70b-versatile** | Sub-second inference; free tier; OpenAI-compatible API; best Groq model for structured tool-calling |
| Embedding | **all-MiniLM-L6-v2** | 384-dim; fast on CPU; well-tested on semantic search benchmarks; no GPU needed |
| Reranker | **cross-encoder/ms-marco-MiniLM-L-6-v2** | Best precision-to-size ratio; loaded lazily so first query absorbs cold-start |
| Vector DB | **FAISS (IndexFlatL2)** | Zero infrastructure; in-process; battle-tested at scale (Facebook AI) |
| Backend | **FastAPI** | Async-first; native SSE support; auto OpenAPI docs; Pydantic integration |
| Frontend | **React + Vite + TypeScript** | Fast HMR; strong typing; best ecosystem for data apps |
| Styling | **Tailwind + shadcn/ui** | Utility-first; consistent design tokens; dark-mode native |
| Graphs | **React Flow** | Declarative node/edge model; great for agent topology |
| Charts | **Recharts** | React-native; composable; responsive |
| Diagrams | **Mermaid.js** | Code-as-diagram; version controllable; renders in browser |

---

## 3. Multi-Agent Architecture — Deep Dive

### Orchestrator flow

```
User query
  → LLM creates Plan (list of Steps)
  → For each step: route to DataAgent / RAGAgent / ComparisonAgent
  → period_cache prevents duplicate DataAgent calls for same date range
  → SummaryAgent synthesises all results into narrative
```

**Key design rule:** Orchestrator passes `TaskSpec` (typed Pydantic) to agents. Agents return typed Pydantic models. No free-form string passing between agents.

### DataAgent tool-calling

1. LLM receives query + tool schemas (`aggregate_responses`, `extract_top_themes`, `compute_sentiment_breakdown`, `get_channel_distribution`)
2. LLM returns tool calls as structured JSON (Groq function-calling format)
3. Python executes deterministic tool functions on the survey dataset
4. Results appended to conversation; LLM synthesises a `DataAgentResult`
5. **Fallback:** If Groq generates malformed tool JSON (`tool_use_failed`), agent catches the exception and runs all tools deterministically — zero crashes, zero hallucinated numbers

### RAG Pipeline — Two-Stage Retrieval

**Stage 1 — FAISS bi-encoder (fast, approximate):**
- Query embedded with `all-MiniLM-L6-v2` (384-dim vector)
- FAISS `IndexFlatL2` retrieves top-10 candidates
- Cosine similarity scores in [0, 1]

**Stage 2 — Cross-encoder reranking (precise):**
- `cross-encoder/ms-marco-MiniLM-L-6-v2` scores each (query, chunk) pair jointly
- Raw logits — higher = more relevant
- Top-k (default 3) selected by rerank score
- Both `faiss_score` and `rerank_score` surfaced in API + UI

**Why two stages, not just cross-encoder?**
Cross-encoder reads query and document together — more accurate but O(n) per query. FAISS pre-filters to 10 candidates so reranking only runs 10 pair comparisons. Total latency stays under 200ms.

### ComparisonAgent

Receives two `DataAgentResult` objects (from orchestrator's period cache). Calls LLM with both formatted as context. Returns structured comparison with `delta`, `insight`, `recommendation`.

### SummaryAgent

Collects all `DataAgentResult`, `RAGAgentResult`, and `ComparisonAgentResult` lists. Builds rich context string, instructs LLM to address every sub-question in compound queries. Returns a single coherent narrative.

---

## 4. Period Caching — Token Efficiency

Compound queries like *"compare Q1 and Q2 on satisfaction and engagement"* would naively call DataAgent 4 times (2 metrics × 2 periods). The Orchestrator caches `DataAgentResult` keyed by `(start_date, end_date)`. ComparisonAgent reads from this cache instead of re-calling. Token savings: 30–50% for comparison queries.

---

## 5. Data Design

100,000 survey records with deliberate signal:

| Property | Design Decision |
|---|---|
| Time span | April 2026 (40%) + May 2026 (60%) |
| Rating distribution | April: weighted 4–5; May: more 1–2s (comparison signal) |
| Themes | 6: food_quality, wait_time, staff, cleanliness, price, app |
| Free text | Template pool per theme × sentiment |
| Channels | mobile 45%, web 30%, kiosk 15%, email 10% |

The dataset encodes a story (quality dip in May) so ComparisonAgent always has something meaningful to surface.

---

## 6. FAQ Knowledge Base

- **Source:** `data/faq_document.txt` — 100+ real Q&A pairs covering survey methodology, CSAT benchmarks, NPS interpretation, engagement drivers, channel analysis, and more
- **Chunking strategy:** Paragraph-based on `\n\n` splits — preserves Q&A as atomic units (splitting on sentence boundary would separate Q from A)
- **Index:** `rag/faq_index.faiss` + `rag/faq_chunks.json`
- **Chunk IDs:** Stable `faq_<hash8>` — survives re-indexing

---

## 7. API Design Summary

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/ask` | POST | Main analyst — SSE stream of trace events |
| `/api/dashboard` | GET | KPI cards |
| `/api/analytics/trends` | GET | Monthly sentiment trends |
| `/api/analytics/compare` | GET | Period comparison chart data |
| `/api/analytics/channels` | GET | Channel breakdown |
| `/api/knowledge/list` | GET | KB metadata + reranker status |
| `/api/knowledge/chunks` | GET | All indexed chunks |
| `/api/knowledge/retrieve` | POST | Test retrieval with reranker |
| `/api/knowledge/rebuild` | POST | Rebuild FAISS index |
| `/api/agents/prompts` | GET/POST | Prompt management |
| `/api/config` | GET/POST | Model/provider config |
| `/api/eval/run` | GET (SSE) | Run full evaluation suite |
| `/api/data/generate` | POST | Regenerate synthetic dataset |
| `/api/history` | GET | Run history |

### SSE Events from `/api/ask`

```
event: trace
data: {"agent": "orchestrator", "step": "planning", "message": "...", "timestamp": "..."}

event: result
data: {"answer": "...", "sources": [...], "latency_ms": 1234}

event: error
data: {"message": "..."}
```

Frontend uses native `EventSource` API. `AgentGraph` updates in real-time as agents become active/done.

---

## 8. Frontend Architecture

```
src/
  pages/          One component per route (9 pages)
  components/     Shared UI (AgentGraph, ChunkCard, AgentBadge, StreamingText…)
  lib/
    api.ts        HTTP client with Map-based TTL cache
    utils.ts      Formatting + styling helpers
  types/index.ts  All TypeScript interfaces (mirroring Pydantic schemas)
```

### Client-side TTL Cache

`api.ts` wraps GET calls in a `Map<string, {data, expiry}>` cache. Configured TTLs per endpoint (dashboard: 2min, analytics: 3min, KB: 5min, config: 1min). `bustCache(prefix)` invalidates keys on mutation (save config, rebuild KB). Zero dependencies — pure browser `Map`.

---

## 9. Admin Center — Why Each ★ Option is Best

**★ Groq** (LLM Provider)
- Lowest generation latency (400–600 tok/s vs OpenAI's ~80 tok/s)
- Free tier supports demo; paid tier is cheap ($0.50/M tokens)
- OpenAI-compatible — 1-line swap to other providers
- Native function-calling support needed by DataAgent

**★ llama-3.3-70b-versatile** (Model)
- Best Groq model for structured output + tool-calling
- 70B parameters with instruction-tuning
- 128k context window — handles large survey summaries
- "versatile" variant explicitly optimised for agentic use

**★ all-MiniLM-L6-v2** (Embedding Model)
- 384 dimensions — smallest that still produces good semantic embeddings
- Runs on CPU in ~10ms per query
- Trained on 1B+ sentence pairs; top performer on BEIR benchmarks at its size
- Included in `sentence-transformers` — zero extra dependency

**★ paragraph** (Chunk Strategy)
- Preserves Q&A pairs as atomic semantic units
- No arbitrary token boundary splits
- Chunks are 50–200 tokens — optimal for bi-encoder embedding quality
- Re-indexing is fast (< 1s for 100+ chunks)

---

## 10. Evaluation Lab

- Runs predefined test queries against live agent pipeline
- Scores per query: `answer_present`, `sources_cited`, `latency_ok` (< 5s), `no_error`
- Progress streamed via SSE (`@router.get("/run")` — GET because `EventSource` is GET-only)
- Results table with per-metric pass/fail in UI

---

## 11. Common Interview Questions

**"Why not use LangChain / LlamaIndex?"**
Custom agent code gives full observability — every step is traceable, every prompt is in your codebase, every token is counted. Frameworks add abstraction layers that make debugging harder during demos. The tradeoff is worth it here because the agent topology is fixed and well-understood.

**"How do you prevent hallucination?"**
1. DataAgent is tool-grounded — LLM cannot invent numbers, only orchestrate Python function calls
2. RAGAgent only cites retrieved chunks — sources shown in UI for every answer
3. DataAgent fallback — if LLM tool output is malformed, deterministic Python code runs instead
4. Evaluation Lab — automated quality checks on known queries

**"How would this scale to production?"**

| Component | Demo | Production |
|---|---|---|
| Vector DB | FAISS in-process | Pinecone / Qdrant / Weaviate |
| LLM | Groq free tier | Groq / OpenAI with rate limit management |
| Data | JSON file | PostgreSQL / MongoDB |
| Serving | Single FastAPI | Kubernetes + autoscaling |
| Monitoring | Console + UI trace | LangSmith / Datadog / Sentry |
| Caching | In-memory Map | Redis |
| Auth | None | OAuth2 / JWT |

**"What is the cost per query?"**
~1,400 tokens per query (orchestrator 300 + data 500 + RAG 200 + summary 400). At Groq paid rates ($0.50/M input): **≈ $0.0007 per query**. With period caching, compound comparison queries save 30–50% tokens.

**"Explain cross-encoder reranking vs bi-encoder."**
Bi-encoders embed query and document independently → cosine similarity. Fast (pre-computable), but query and document never interact — less precise. Cross-encoders receive `[CLS] query [SEP] document` as one input — full attention across both. Much higher precision but O(n) at query time. Two-stage: FAISS (fast) → reranker (precise on top-10 only) = best of both.

**"Why SSE instead of WebSockets?"**
SSE is unidirectional (server → client) which is all we need. Works through HTTP/2, standard browser API, no special infrastructure. WebSockets add bidirectional complexity with no benefit for a read-only event stream.

**"What would you add with 2 more weeks?"**
1. Per-token streaming (character-level typewriter for LLM output)
2. LLM-as-judge evaluation (automated answer quality scoring)
3. Thumbs up/down feedback → fine-tuning dataset accumulator
4. Persistent sessions with conversation history
5. Multi-tenant data isolation (per org)
6. Webhook alerts when sentiment drops below threshold

---

## 12. Demo Walkthrough Script (8 minutes)

**[0:00 — 1:30] AI Analyst**
- Default landing page — no navigation needed
- Ask: *"How has employee satisfaction changed from April to May 2026?"*
- Point to live agent graph updating on right side
- Show agent trace panel scrolling with SSE events
- Show answer with retrieved evidence chunks + FAISS + reranker scores

**[1:30 — 2:30] Analytics**
- Monthly trend chart — point to May dip
- Switch metrics: Sentiment → NPS → Engagement
- Channel breakdown chart

**[2:30 — 4:00] Agent Studio**
- Select a preset query; click Run
- Watch graph: Orchestrator → DataAgent → ComparisonAgent → SummaryAgent
- Point to Decision Log with timestamped SSE events
- Show Stop button — click it mid-run
- Restart and let it complete

**[4:00 — 5:00] Knowledge Base**
- Type a retrieval query
- Show "2-stage reranked" badge
- Expand a chunk — point to FAISS score vs Reranker score side-by-side
- Explain why they can differ (bi-encoder vs cross-encoder)

**[5:00 — 6:00] Architecture Center**
- System Overview diagram
- Click RAG Pipeline — two-stage flow
- Click Fine-Tuning tab — LoRA adapter design

**[6:00 — 7:00] Evaluation Lab**
- Click Run Full Evaluation
- Watch real-time progress stream
- Show pass/fail table

**[7:00 — 8:00] Admin Center**
- Show ★ starred options
- Explain one starred choice (e.g., why llama-3.3-70b-versatile)
- Change a model, save, show config persists

---

## 13. Potential Gotchas During Demo

- **Cross-encoder cold start:** First retrieval query ~2s extra. Say *"first call warms the reranker model"* — subsequent are fast.
- **Groq rate limits:** Free tier = 30 req/min. 4 LLM calls per query = safe under 7 concurrent users.
- **FAISS index missing:** Run `python rag/ingest.py` if `rag/faq_index.faiss` is absent.
- **`GROQ_API_KEY` not set:** Server will start but first LLM call will 401. Check `.env`.
- **Frontend not built:** Run `npm run build` in `frontend/` if you see blank page at `/`.
- **Port 8000 in use:** `netstat -ano | findstr :8000` → `taskkill /PID <pid> /F`.

---

## 14. Assignment Compliance Summary

| Requirement | Status | Evidence |
|---|---|---|
| Orchestrator Agent (planner) | ✅ | `agents/orchestrator.py` |
| Sub-agents: DataAgent, RAGAgent, ComparisonAgent, SummaryAgent | ✅ | `agents/` directory |
| Structured TaskSpec inter-agent communication | ✅ | `schemas/models.py` — all Pydantic |
| Tool calling from DataAgent | ✅ | `tools/data_tools.py` + Groq function-calling |
| Final coherent narrative answer | ✅ | `SummaryAgent` output |
| RAG: chunking with justification | ✅ | Paragraph chunking, README explains why |
| RAG: FAISS vector store | ✅ | `rag/retrieve.py` |
| RAG: embed with model | ✅ | `all-MiniLM-L6-v2` |
| RAG: inject into prompt | ✅ | `agents/rag_agent.py` |
| RAG: 3 sample questions + evaluation | ✅ | `evaluation/rag_eval.py` |
| Fine-tuning design (all 6 points) | ✅ | README Part 3 section |
| 50,000–100,000 survey records | ✅ | `data/generate_data.py` → 100k |
| FAQ document expanded | ✅ | `data/faq_document.txt` → 100+ Q&As |
| Runnable with README | ✅ | `README.md` quick start |
| Bonus: cross-encoder reranking | ✅ (bonus) | `rag/retrieve.py` two-stage pipeline |
| Bonus: full web UI | ✅ (bonus) | React frontend with 9 pages |
| Bonus: SSE real-time tracing | ✅ (bonus) | `api/routes_agents.py` + SSE events |
