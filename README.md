# MiniSense — Multi-Agent Customer Intelligence Platform

> A production-grade AI system that answers complex business questions about survey feedback using **hierarchical multi-agent orchestration**, **RAG with two-stage reranking**, **7 deterministic analytics tools**, and **real-time observability**.

**Live Demo:** [http://49.50.117.67:8001](http://49.50.117.67:8001)  
**Business:** GreenLeaf Bistro (fictional) | **Dataset:** 195,000 survey responses (Jan–May 2026)

---

## Quick Start

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Configure API key
cp .env.example .env
# Add your key: GROQ_API_KEY=... or GEMINI_API_KEY=... etc.
# (Or configure via Admin Center in the UI after launch)

# 3. Run server — serves API + pre-built React frontend on one port
python -m uvicorn api.main:app --host 0.0.0.0 --port 8001

# 4. Open http://localhost:8001
```

Dataset (`data/survey_responses.json`) and FAISS index (`rag/faq_index.faiss`) are **included**. Regenerate only if needed:

```bash
python data/generate_data.py   # regenerates 195,000 records
python rag/ingest.py           # rebuilds FAISS index from FAQ
```

### CLI (optional)

```bash
python cli.py --question "What are the top complaints in May 2026?" --verbose
python evaluation/rag_eval.py
pytest tests/
```

---

## Architecture

```
User Question (HTTP → SSE stream)
        │
        ▼
┌──────────────────────────────────────────┐
│              OrchestratorAgent           │
│  • LLM creates execution Plan            │
│  • Routes TaskSpec objects to sub-agents │
│  • period_cache deduplicates DataAgent   │
│  • Emits SSE trace events in real-time   │
└──────┬──────────┬──────────┬─────────────┘
       │          │          │
       ▼          ▼          ▼
  ┌─────────┐ ┌────────┐ ┌──────────────┐
  │  Data   │ │  RAG   │ │  Comparison  │
  │  Agent  │ │  Agent │ │    Agent     │
  │         │ │        │ │              │
  │ 7 tools │ │ FAISS  │ │ A vs B delta │
  │ via LLM │ │ +cross │ │ CSAT,rating, │
  │ calling │ │encoder │ │ themes       │
  └────┬────┘ └───┬────┘ └──────┬───────┘
       │          │             │
       └──────────┴──────┬──────┘
                         ▼
                ┌──────────────┐
                │ SummaryAgent │  narrative + VizSpec
                └──────┬───────┘
                       ▼
              FinalAnswer (SSE done event)
              narrative + metrics + sources + visualization
```

**Design invariants:**
- Orchestrator passes typed `TaskSpec` (Pydantic) → agents return typed Pydantic models. No free-form string passing between agents.
- All computation is deterministic Python. LLM orchestrates *which* tools to call, never the math.
- `period_cache` (keyed by date range) prevents duplicate DataAgent calls — 30–50% token savings on comparison queries.
- If LLM is unavailable or rate-limited, a `llm_warning` SSE event fires and the UI shows an amber banner. DataAgent falls back to full deterministic mode automatically.

---

## DataAgent — 7 Analytics Tools

The LLM receives all tool schemas and decides which to call. Python executes the computation.

| Tool | What it computes | Example query |
|---|---|---|
| `compute_csat` | % of ratings ≥ 4 | "What was CSAT in April?" |
| `compute_avg_rating` | Mean rating (1–5) | "Average score for May?" |
| `extract_top_themes` | Top-N themes by keyword frequency | "What are the top complaints?" |
| `rating_distribution` | Count per star (1–5) | "Show rating breakdown" |
| `csat_by_segment` | CSAT filtered by channel + theme + rating range | "CSAT for mobile users complaining about staff in May?" |
| `weekly_trend` | Metric per ISO week in a date range | "Which week in May had the worst ratings?" |
| `compare_themes` | CSAT + avg_rating per theme, ranked worst-first | "Is food quality or wait time causing more dissatisfaction?" |

**Fallback:** If the LLM generates malformed tool JSON, all metrics are computed deterministically — zero crashes, zero hallucinated numbers.

---

## RAG Pipeline — Two-Stage Retrieval

**Stage 1 — FAISS bi-encoder (fast, exact):**
- Query embedded with `all-MiniLM-L6-v2` (384-dim, CPU, ~10ms)
- `IndexFlatL2` exact search across ~100 FAQ chunks
- Returns top-10 candidates with cosine similarity scores

**Stage 2 — Cross-encoder reranking (precise):**
- `cross-encoder/ms-marco-MiniLM-L-6-v2` scores each `[CLS] query [SEP] chunk` pair jointly
- Full attention across both texts — much higher precision than bi-encoder alone
- Top-3 by rerank score surfaced in API and UI (both scores shown)

**Why two stages?** Cross-encoder is O(n) at query time. FAISS filters to 10 candidates first, so reranking runs exactly 10 pair comparisons. Total RAG latency stays under 200ms.

**Chunking:** Paragraph-based on `\n\n` splits — preserves Q&A pairs as atomic units. Chunks are 50–200 tokens, optimal for bi-encoder embedding quality.

---

## Visualization — Data-Shape Driven

Visualization is selected **entirely by what data is present**, not by keyword guessing. Zero LLM calls, zero tokens.

| Data present | Chart rendered |
|---|---|
| `weekly_data` (from `weekly_trend` tool) | **Line/area chart** with gradient fill + 50% reference line |
| `theme_comparison_data` (from `compare_themes` tool) | **HeatBar** — ranked list with inline red→amber→green CSAT bars |
| `segment_data` (from `csat_by_segment` tool) | **Scorecard** — metric tile grid with segment highlight |
| Multiple comparison periods (3+) | **Line chart** (CSAT arc across months) |
| Two comparison periods | **Table** with delta column (green = improved, red = declined) |
| Single period — themes | **Horizontal bar** |

---

## Dataset — 195,000 Records, Jan–May 2026

Deliberately engineered narrative arc:

| Month | Records | Target CSAT | Story |
|---|---|---|---|
| January | 32,000 | ~72% | Strong start — loyal post-holiday crowd |
| February | 28,000 | ~68% | Valentine's rush causes wait time complaints |
| March | 35,000 | ~74% | **Peak** — spring menu + staff retraining |
| April | 40,000 | ~59% | Mobile app update introduces latency bugs |
| May | 60,000 | ~39% | **Crisis** — app crashes go viral, volume surges |

6 themes: `food_quality`, `wait_time`, `staff`, `cleanliness`, `price`, `app`  
4 channels: `mobile` (45% → growing), `web` (30%), `kiosk` (15%), `email` (10%)

---

## Project Structure

```
Survey_Agent/
├── agents/
│   ├── orchestrator.py        # Planner + period_cache + SSE emitter
│   ├── data_agent.py          # 7 tools via LLM function-calling + deterministic fallback
│   ├── rag_agent.py           # Two-stage FAISS → cross-encoder retrieval
│   ├── comparison_agent.py    # A vs B delta with LLM insight generation
│   └── summary_agent.py       # Narrative + calls viz_builder
├── providers/
│   └── llm.py                 # Universal LLM interface (Groq/Gemini/OpenAI/Anthropic)
├── tools/
│   ├── data_tools.py          # All 7 deterministic analytics functions + tool schemas
│   └── viz_builder.py         # Data-shape-driven VizSpec selector (no LLM)
├── schemas/
│   └── models.py              # All Pydantic schemas (TaskSpec, DataAgentResult, VizSpec…)
├── rag/
│   ├── ingest.py              # Chunk, embed, index FAQ → FAISS
│   ├── retrieve.py            # Two-stage retrieval with reranking
│   ├── faq_index.faiss        # Pre-built FAISS index (included)
│   └── faq_chunks.json        # Chunk text + stable faq_<hash8> IDs
├── api/
│   ├── main.py                # FastAPI app — serves API + built frontend static files
│   ├── routes_agents.py       # GET /stream (SSE), POST /api/ask
│   ├── routes_analytics.py    # GET /api/analytics/trends|compare|channels
│   ├── routes_dashboard.py    # GET /api/dashboard
│   ├── routes_knowledge.py    # GET/POST /api/knowledge/*
│   ├── routes_config.py       # GET/PUT /api/config
│   ├── routes_eval.py         # GET /api/eval/run (SSE)
│   ├── routes_data.py         # POST /api/data/generate
│   ├── routes_history.py      # GET /api/history
│   └── config_manager.py      # Reads/writes config.json
├── data/
│   ├── generate_data.py       # 195k record generator with narrative arc
│   ├── survey_responses.json  # Generated dataset (included)
│   └── faq_document.txt       # 100+ Q&A pairs (FAQ knowledge base)
├── evaluation/
│   └── rag_eval.py            # RAG evaluation suite
├── scripts/
│   ├── update_server.py       # One-command VPS deploy (git pull + restart)
│   └── test_new_tools.py      # Smoke tests for csat_by_segment, weekly_trend, compare_themes
├── frontend/                  # React + Vite + TypeScript SPA
│   ├── src/
│   │   ├── pages/             # 12 pages (see UI section below)
│   │   ├── components/        # AgentGraph, AnswerViz, ChunkCard, StreamingText…
│   │   ├── lib/api.ts         # HTTP client with TTL cache + SSE stream factory
│   │   └── types/index.ts     # TypeScript interfaces mirroring Pydantic schemas
│   └── dist/                  # Pre-built, served by FastAPI
├── config/config.json         # Runtime config (provider, model, keys) — gitignored for secrets
├── cli.py                     # CLI entry point
└── requirements.txt
```

---

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/stream` | GET (SSE) | Main analyst — streams `plan`, `agent_start`, `tool_call`, `tool_result`, `agent_done`, `done`, `llm_warning` events |
| `/api/dashboard` | GET | KPI cards + AI executive brief |
| `/api/analytics/trends` | GET | Monthly CSAT/rating trends (all 5 months) |
| `/api/analytics/compare` | GET | Period comparison chart data |
| `/api/analytics/channels` | GET | Channel breakdown |
| `/api/knowledge/list` | GET | KB metadata + reranker warmup status |
| `/api/knowledge/chunks` | GET | All indexed chunks with stable IDs |
| `/api/knowledge/retrieve` | POST | Test two-stage retrieval live |
| `/api/knowledge/rebuild` | POST | Rebuild FAISS index from FAQ |
| `/api/agents/prompts` | GET/POST | Read/write prompt registry |
| `/api/config` | GET/PUT | Read/write model/provider config |
| `/api/eval/run` | GET (SSE) | Run full evaluation suite (streams results) |
| `/api/data/generate` | POST | Regenerate synthetic dataset |
| `/api/data/list` | GET | List available datasets |
| `/api/history` | GET | Past run records |
| `/health` | GET | Server health check |

### SSE Events from `/stream`

```
event: plan          → {tasks: [{agent, intent}], count: N}
event: agent_start   → {agent, step, total, intent}
event: tool_call     → {agent, tool, args}
event: tool_result   → {agent, tool, result}
event: agent_done    → {agent, step, result}
event: llm_warning   → {message}            ← rate limit / unavailable LLM
event: done          → {answer: {narrative, metrics, sources, trace, visualization}}
event: error         → {message}
```

---

## Frontend — 12 Pages

| Page | Route | What it does |
|---|---|---|
| AI Analyst | `/` | Multi-agent Q&A with live agent graph + SSE trace + evidence panel |
| Dashboard | `/dashboard` | KPI cards, AI executive brief, trend charts |
| Analytics | `/analytics` | Monthly trend charts, channel breakdown, metric switcher |
| Agent Studio | `/studio` | Preset queries, full decision log, stop/restart controls |
| Knowledge Base | `/knowledge` | Browse chunks, test retrieval, see FAISS vs rerank scores |
| Architecture Center | `/architecture` | System diagrams (Mermaid), RAG pipeline, data flow |
| Fine-Tuning | `/finetune` | LoRA adapter design, training pipeline, evaluation design |
| Evaluation Lab | `/eval` | Run full test suite, SSE progress, pass/fail table |
| Admin Center | `/admin` | Model/provider config, API keys, embedding model, retrieval settings |
| About Project | `/about` | Project overview and tech stack |
| About Developer | `/developer` | Developer profile |
| Download Source | `/download` | Source code download |

---

## LLM Provider — Universal Interface

All agents use `providers/llm.py → get_llm()`. One-line swap between providers via Admin Center:

| Provider | Notes |
|---|---|
| **Groq** | Lowest latency (400–600 tok/s). Best for demos. `llama-3.3-70b-versatile` recommended. |
| **Gemini** | Google AI Studio key. `gemini-2.5-flash` or `gemini-2.0-flash`. |
| **OpenAI** | Standard. `gpt-4o-mini` is most cost-efficient. |
| **Anthropic** | Claude models via Anthropic API. |

If the selected LLM errors or hits a rate limit:
1. DataAgent falls back to deterministic Python computation
2. Orchestrator emits `llm_warning` SSE event
3. Frontend renders amber dismissible banner

---

## Part 3: Fine-Tuning Design

**Problem Context:** OmniSense processes 10,000 survey responses/day, requiring classification into 8 sentiment+topic categories (e.g., Positive — Food Quality). Using GPT-4o is highly accurate but cost-prohibitive at this scale. 

To transition from a frontier model to a cost-effective, self-hosted solution, I would implement the following fine-tuning pipeline:

### 1. Data Strategy
**Curation:** I would use "LLM-as-a-Judge" distillation. We route a random sample of production traffic to GPT-4o with a highly engineered few-shot prompt to generate initial labels. Human annotators would spot-check a 10% stratified sample to correct errors and catch edge cases (like sarcasm).  
**Volume:** For an 8-class problem, we need roughly 500 high-quality examples per class. I would target a dataset of **4,000 to 5,000 labeled examples**. If certain classes (like "Neutral - Staff") are underrepresented, I would oversample or use back-translation augmentation to balance the dataset, preventing minority-class collapse.

### 2. Model & Technique Selection
**Base Model:** I would choose **Llama-3-8B-Instruct**. It possesses strong baseline reasoning and language comprehension, making it highly capable of nuanced classification out-of-the-box, while being small enough to run on a single commodity GPU (like an L4 or A10G) in production.  
**Technique:** I would use **QLoRA** (Quantized Low-Rank Adaptation). Full fine-tuning is unnecessary for a classification task and risks catastrophic forgetting of the model's baseline language skills. QLoRA loads the base model in 4-bit precision and trains tiny 16-bit adapters on the attention matrices (`q_proj`, `v_proj`). This achieves ~98% of full fine-tuning performance but requires only 10GB of VRAM to train, drastically reducing compute costs.

### 3. Training Pipeline
**Tooling:** I would use **Unsloth** for training, as it offers 2x faster LoRA training and significant VRAM savings compared to standard HuggingFace `PEFT`. If a UI-driven approach is preferred for the MLOps team, **Axolotl** is a fantastic declarative alternative.  
**Structure:** The data would be formatted into ChatML. The training job would run for 3-5 epochs using a cosine learning rate scheduler, a batch size of 16, and an AdamW 8-bit optimizer to save memory. 20% of the data would be held out for validation.

### 4. Evaluation
**Metrics:** Accuracy is misleading for imbalanced datasets, so the primary metric would be **Macro F1-Score**. I would set a hard gate: the model must achieve a Macro-F1 of ≥ 0.90, with no individual class falling below 0.80.  
**Cutover Strategy:** Once the offline metrics are hit, I would use **Shadow Deployment**. The fine-tuned model processes live traffic asynchronously without affecting the user, while GPT-4o continues serving the actual response. After 48 hours, if the fine-tuned model's predictions align with GPT-4o >95% of the time, we route 10% of live traffic to it (Canary deployment), eventually scaling to 100%.

### 5. Serving
I would use **vLLM** with `--enable-lora`. vLLM supports **Multi-LoRA serving**, meaning we load the 8B base model into VRAM exactly once. The fine-tuned classification adapter (which is only ~50MB) is loaded on top. If we later fine-tune a *different* adapter for a different task, vLLM can dynamically route requests to the correct adapter on the fly without duplicating the base model memory.

### 6. Future Proofing
To ensure the pipeline is agnostic to input changes, the system will decouple the schema from the model. Categories will be defined in an external `categories.yaml` file injected into the system prompt, rather than hardcoding class indices into a classification head. The adapter will output structured JSON. If new categories are added, we simply update the YAML, generate 500 new synthetic examples via GPT-4o, and incrementally train a new LoRA adapter version without changing any infrastructure code.

---

## Production Roadmap

| Component | Current (Demo) | Production |
|---|---|---|
| Vector DB | FAISS in-process | Pinecone / Qdrant / Weaviate (metadata filtering, CRUD, HA) |
| Data store | JSON file | PostgreSQL / MongoDB |
| LLM | Groq free tier / Admin Center config | Groq / OpenAI with rate limit management + fallback chain |
| Serving | Single FastAPI process | Kubernetes + autoscaling |
| Monitoring | SSE trace + UI | LangSmith / Datadog / Sentry |
| Caching | In-memory (`lru_cache` + TTL Map) | Redis |
| Auth | None | OAuth2 / JWT |
| Cost/query | ~$0.0007 (1,400 tokens @ Groq paid rate) | Further reduced by period_cache + smaller models |

---

## Dependencies

| Library | Purpose |
|---|---|
| `fastapi` + `uvicorn` | Async REST API server + SSE streaming |
| `groq` | Groq LLM client (OpenAI-compatible) |
| `google-generativeai` | Gemini provider |
| `openai` | OpenAI provider |
| `anthropic` | Anthropic/Claude provider |
| `pydantic` | Typed inter-agent schemas |
| `faiss-cpu` | Vector similarity search (IndexFlatL2) |
| `sentence-transformers` | Local bi-encoder embeddings (all-MiniLM-L6-v2) |
| `transformers` | Cross-encoder reranker (ms-marco-MiniLM-L-6-v2) |
| `python-dotenv` | Environment variable management |
| `paramiko` | VPS deployment SSH client |
| `tqdm` | Progress bars during data generation |

---

## Deployment

**VPS:** `49.50.117.67:2232` (root) | Managed by `systemctl survey-agent`

```bash
# One-command deploy from local machine
python scripts/update_server.py
# → git stash + git pull + systemctl restart survey-agent + health check
```

---

*Assignment submission materials: see [ASSIGNMENT_SUBMISSION.md](./ASSIGNMENT_SUBMISSION.md)*  
*Deep architecture diagrams: see [ARCHITECTURE.md](./ARCHITECTURE.md)*  
*Interview Q&A prep: see [INTERVIEW_PREP.md](./INTERVIEW_PREP.md)*
