# MiniSense — Multi-Agent Customer Intelligence Platform

A production-grade AI system that answers business questions about survey feedback using **multi-agent orchestration**, **RAG with reranking**, and **full observability**.

Built for: GreenLeaf Bistro (fictional business) | Dataset: 60,000+ survey responses

> **Assignment reviewers:** Start with **[ASSIGNMENT_SUBMISSION.md](./ASSIGNMENT_SUBMISSION.md)** — approach, assumptions, setup, and doc index.

---

## Quick Start (Web Platform)

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Configure API key (or use Admin Center in the UI after launch)
cp .env.example .env
# Add GROQ_API_KEY=... (free at console.groq.com)

# 3. Run server (serves API + pre-built React frontend)
python -m uvicorn api.main:app --host 0.0.0.0 --port 8000

# 4. Open http://localhost:8000
#    → AI Analyst tab: ask business questions with live agent trace
#    → Admin Center: paste API key if not in .env
```

Dataset (`data/survey_responses.json`) and FAISS index (`rag/vector_store/`) are **included** in the repo. Regenerate only if missing:

```bash
python data/generate_data.py
python rag/ingest.py
```

### CLI & Tests (optional)

```bash
python cli.py --question "What are the top complaints in May 2026?" --verbose
python evaluation/rag_eval.py
pytest tests/
```

---

## Architecture

```
User Question
     │
     ▼
┌─────────────────────────────────┐
│        OrchestratorAgent        │  ← LLM (Groq) plans execution
│  • Parses question intent        │    via function-calling
│  • Creates list of TaskSpecs     │
│  • Routes to sub-agents          │
│  • Synthesizes final answer      │
└──────┬──────┬──────┬────────────┘
       │      │      │
       ▼      ▼      ▼
  ┌────────┐ ┌────────────┐ ┌──────────────────┐
  │  Data  │ │    RAG     │ │   Comparison     │
  │ Agent  │ │  Agent     │ │     Agent        │
  │        │ │            │ │                  │
  │ Tool   │ │ FAISS      │ │ Runs DataAgent   │
  │ calls: │ │ vector     │ │ for 2 periods,   │
  │ CSAT,  │ │ search     │ │ computes deltas  │
  │ themes,│ │ (FAQ docs) │ │                  │
  │ dist.  │ │            │ │                  │
  └────────┘ └────────────┘ └──────────────────┘
       │           │                 │
       └─────┬─────┘─────────────────┘
             ▼
     ┌───────────────┐
     │ SummaryAgent  │  ← Narrative generation
     │               │    from structured inputs
     └───────┬───────┘
             ▼
    FinalAnswer (narrative
    + metrics + sources)
```

**Key design principles:**
- Orchestrator always passes `TaskSpec` objects to agents — never raw text
- Sub-agents always return typed Pydantic models — never free-form strings
- Tool calling is explicit and traceable (DataAgent uses Groq function-calling)
- SummaryAgent only does prose; all computation is done upstream

---

## Project Structure

```
Survey_Agent/
├── agents/
│   ├── orchestrator.py       # Planner + synthesizer
│   ├── data_agent.py         # Metrics via Groq tool-calling
│   ├── rag_agent.py          # FAISS retrieval + context summary
│   ├── comparison_agent.py   # Period-over-period comparison
│   └── summary_agent.py      # Narrative generation
├── rag/
│   ├── ingest.py             # Chunk, embed, index FAQ
│   └── retrieve.py           # Query vector store
├── tools/
│   └── data_tools.py         # compute_csat, extract_top_themes, etc.
├── schemas/
│   └── models.py             # All Pydantic inter-agent schemas
├── data/
│   ├── generate_data.py      # 100k record generator
│   ├── survey_responses.json # Generated (gitignored)
│   └── faq_document.txt      # ~500-word GreenLeaf Bistro FAQ
├── evaluation/
│   └── rag_eval.py           # 3-question RAG evaluation
├── api/
│   └── main.py               # FastAPI server
├── cli.py                    # CLI entry point
└── requirements.txt
```

---

## Data Generation Design

The 100,000 survey records are generated with deliberate signal:

| Property | Design Decision |
|---|---|
| **Time span** | April 2026 (40%) + May 2026 (60%) |
| **Rating distribution** | April: weighted toward 4–5. May: more 1–2s to create comparison signal |
| **Themes** | 6 themes: food_quality, wait_time, staff, cleanliness, price, app |
| **Free text** | Template pool per theme × sentiment (positive/negative/neutral) |
| **Channels** | mobile 45%, web 30%, kiosk 15%, email 10% |

This is intentionally not random noise — the dataset encodes a story (slight quality dip in May) so the ComparisonAgent has something meaningful to surface.

---

## RAG Pipeline

**Chunking strategy: Sentence-aware with Q&A block preservation**

1. Split FAQ on `Q:` boundaries → preserves question-answer pairs as atomic units
2. Sentence-split blocks exceeding ~150 tokens
3. Embed with `sentence-transformers/all-MiniLM-L6-v2` (local, free, 384-dim)
4. Store in FAISS with cosine similarity (L2-normalized inner product)
5. Retrieve top-3 chunks per query; LLM summarizes into context block

**Why this chunking?** Fixed-size risks splitting a question from its answer. Semantic clustering is overkill for a 500-word document. Q&A block chunking maps directly to user query intents.

---

## Part 3 — Fine-Tuning Design

### The Problem
GreenLeaf Bistro (and by extension, omniSense) needs to classify 10,000 free-text survey responses per day into 8 sentiment+topic categories (e.g., *Positive – Food Quality*, *Negative – Wait Time*, *Neutral – Staff*). GPT-4o achieves high accuracy but costs ~$0.15 per 1,000 tokens — at this scale, that's $450–$900/day, which doesn't scale. The goal is a fine-tuned smaller model that matches frontier accuracy at 10–20× lower inference cost.

### 1. Data Strategy
Use GPT-4o to label an initial batch of 3,000–5,000 responses with a carefully engineered classification prompt (few-shot with 2 examples per class). Human reviewers spot-check 10–15% of labels, focusing on ambiguous cases (e.g., "The wait was fine but the food was cold" spanning two categories). Target: ~300–500 examples per class (2,400–4,000 total). Augment with back-translation (English → French → English) for underrepresented classes. This gives enough signal for LoRA fine-tuning without needing thousands of examples per class.

### 2. Model & Technique Selection
**Base model:** `google/flan-t5-base` (250M params) or `mistralai/Mistral-7B-Instruct-v0.3`. Prefer Flan-T5 if inference latency is the constraint (encoder-decoder, fast classification), or Mistral-7B if the organization already runs a 7B serving stack and wants one unified model family.

**Technique:** LoRA (r=8, alpha=16, dropout=0.1) on the attention layers. **Rationale:** Full fine-tuning on 7B params requires 4× A100s and is hard to version-control. QLoRA adds quantization noise that hurts precision on an 8-class classifier. LoRA gives 95% of full-FT quality at 1–2% of the trainable parameter count, and the adapter is a ~10MB file that's trivial to version and swap.

### 3. Training Pipeline
**Tooling:** HuggingFace `Trainer` + `PEFT` library (for LoRA) + `datasets` for data loading. Optionally Axolotl for config-driven training if the team wants reproducible YAML-based jobs. Training job structure: tokenize inputs as `"Classify: {free_text}"` → label as one of 8 category strings. Use `Seq2SeqTrainer` for Flan-T5 or `SFTTrainer` for Mistral. Train for 3–5 epochs on 4,000 examples (~30 min on a single A10G). Use cosine LR schedule with warmup.

### 4. Evaluation
Track **macro-F1** (primary — treats all 8 classes equally regardless of frequency), per-class precision/recall, and a confusion matrix. Also track inference latency (p50/p95) and cost-per-1000-requests. **Ready-to-replace threshold:** macro-F1 ≥ 0.90 on held-out test set (10% split), with no individual class F1 below 0.80. Shadow deploy for 48 hours (run both models, compare outputs) before full cutover.

### 5. Serving
Use **vLLM** with LoRA adapter support (`--enable-lora`). The adapter is mounted as a named lora module alongside the base model — requests to the classification route specify `lora_request=LoRARequest("survey_classifier", ...)`. This keeps the base LLM serving other routes (e.g., chat, summarization) untouched. No restart required to add/swap adapters.

### 6. Future-Proofing
The pipeline is made input-agnostic by: (a) a config-driven category list (YAML/JSON) so adding or renaming categories doesn't require code changes, (b) a schema-agnostic input formatter that maps any `{field: value}` survey record to a classification prompt using a template, (c) versioned adapters stored in object storage with semantic versioning, and (d) a labeling pipeline abstracted behind an interface so GPT-4o can be swapped for a different frontier model as labeler without changing the training code.

---

## What Was Skipped and Why

| Feature | Status | Reason |
|---|---|---|
| Streaming API responses | **Implemented (bonus)** | SSE real-time agent tracing in `/api/ask` and Evaluation Lab |
| Re-ranker (cross-encoder) | **Implemented (bonus)** | Two-stage FAISS → cross-encoder reranking in `rag/retrieve.py`; scores shown in UI |
| Full web UI | **Implemented (bonus)** | React + TypeScript SPA with 9 pages, live agent graph, charts |
| Persistent database (PostgreSQL) | Skipped | JSON file is sufficient at 100k records; scope constraint |
| Authentication on FastAPI | Skipped | Out of scope for assessment |
| Async agent execution | Skipped | DataAgent + RAGAgent could run in parallel, but serial execution is clearer for evaluation |
| BM25 hybrid retrieval | Skipped | Dense-only retrieval is sufficient; reranking already improves precision significantly |

---

## Dependencies

| Library | Purpose |
|---|---|
| `groq` | LLM API (Llama 3.3 70B with function calling) |
| `pydantic` | Typed inter-agent schemas |
| `faiss-cpu` | Vector similarity search |
| `sentence-transformers` | Local embeddings (all-MiniLM-L6-v2) |
| `fastapi` + `uvicorn` | REST API server |
| `python-dotenv` | Environment variable management |
| `tqdm` | Progress bars during data generation |
