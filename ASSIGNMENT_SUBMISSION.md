# AI Engineer Assignment — Submission Package

**Candidate:** Jayant Verma  
**Email:** jayantmailac@gmail.com  
**Project:** MiniSense — Multi-Agent Customer Intelligence Platform  
**Company:** GreenLeaf Bistro (fictional dataset per assignment brief)

---

## 1. How to Access This Submission

| What | Where |
|------|--------|
| **Live demo (web app)** | Provided in submission email — open in **desktop browser** for best experience |
| **Complete source code** | Live site → sidebar → **Download Source Code** → `Jayant_Assignment_Minisense.zip` |
| **This guide** | Root of the ZIP: `ASSIGNMENT_SUBMISSION.md` (start here) |

The ZIP contains all source code, documentation, setup instructions, and supporting materials. API keys and virtual environments are **not** included (configure locally — see §4).

---

## 2. Documentation Index (read in this order)

| File | Purpose |
|------|---------|
| **ASSIGNMENT_SUBMISSION.md** (this file) | Submission overview, approach, assumptions, compliance checklist |
| **README.md** | Setup, run locally, project structure, RAG & fine-tuning design |
| **ARCHITECTURE.md** | Deep technical architecture with Mermaid diagrams |
| **INTERVIEW_PREP.md** | Design rationale, tradeoffs, demo script, Q&A prep |
| **walkthrough.md** | Build summary and verified test outputs |

---

## 3. Approach Summary

MiniSense answers natural-language business questions about customer survey data using a **hierarchical multi-agent system**:

1. **Orchestrator** — Uses LLM function-calling to decompose the user question into a plan (`TaskSpec` list) and route work to specialists.
2. **DataAgent** — Computes exact metrics (CSAT, ratings, themes, distributions) via Groq tool-calling with **deterministic Python fallback** if the LLM fails.
3. **RAGAgent** — Two-stage retrieval: FAISS bi-encoder (fast) + cross-encoder reranker (precise) over a 100+ FAQ knowledge base.
4. **ComparisonAgent** — Period-over-period analysis with delta metrics.
5. **SummaryAgent** — Synthesises structured outputs into an executive narrative.

The **web platform** (React + FastAPI) adds real-time **SSE agent tracing**, live agent graph, Evaluation Lab, Architecture Center, Fine-Tuning use-case tab, Knowledge Base inspector, and Admin Center for provider switching.

---

## 4. Setup Instructions (Local)

### Prerequisites
- Python 3.11+
- Groq API key (free tier at [console.groq.com](https://console.groq.com)) or Gemini API key

### Steps

```bash
# 1. Extract ZIP and install dependencies
pip install -r requirements.txt

# 2. Environment (optional — keys can also be set in Admin Center UI)
cp .env.example .env
# Edit .env: GROQ_API_KEY=your_key_here

# 3. Dataset & RAG index (included in ZIP; regenerate only if missing)
# python data/generate_data.py
# python rag/ingest.py

# 4. Run full stack (API + pre-built frontend)
python -m uvicorn api.main:app --host 0.0.0.0 --port 8000

# 5. Open browser
# http://localhost:8000
```

**Configure LLM:** Admin Center → select provider (Groq ★ recommended, or Gemini 2.5 Flash) → paste API key → Save.

**CLI (optional):** `python cli.py --question "What are the top complaints in May 2026?" --verbose`

**Tests:** `pytest tests/`

---

## 5. Assumptions

| Area | Assumption |
|------|------------|
| Business context | GreenLeaf Bistro is fictional; survey data is synthetic but encodes realistic trends (Apr vs May 2026 dip) |
| Dataset size | ~60,000 responses committed for deployment; generator supports 100k+ |
| LLM availability | Groq free tier or Gemini; deterministic fallbacks keep core metrics working without LLM |
| Storage | JSON + FAISS on disk — no PostgreSQL (assignment scope) |
| Auth | None — internal demo / assessment tool |
| Deployment | Single Railway service serves FastAPI + static React build |
| Mobile | Functional but not fully optimised (time constraint); desktop recommended for demo |

---

## 6. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Typed Pydantic schemas between agents | Prevents string-passing bugs; every agent returns structured data |
| Tool-calling for metrics, not LLM math | Numbers are computed in Python — auditable and correct |
| Two-stage RAG (FAISS + reranker) | Balance latency (~200ms) vs precision |
| Q&A-block chunking for FAQ | Keeps question–answer pairs atomic |
| SSE streaming for agent trace | Real-time observability without WebSocket complexity |
| Period cache in orchestrator | Avoids duplicate DataAgent calls in compound queries |
| OpenAI-compatible LLM abstraction | Swap Groq / Gemini / self-hosted vLLM with zero agent code changes |
| Pre-built `frontend/dist` in repo | Reliable Railway deployment without Node build on server |
| API keys server-side only | Chatbot and agents never expose keys in browser bundle |

---

## 7. Assignment Compliance Checklist

| Requirement | Delivered |
|-------------|-----------|
| Complete source code | ✅ ZIP + live demo |
| Setup instructions | ✅ README.md + §4 above |
| Architecture documentation | ✅ ARCHITECTURE.md + Architecture tab in UI |
| Approach & design decisions | ✅ This file + INTERVIEW_PREP.md |
| Fine-tuning use case | ✅ README Part 3 + Fine-Tuning tab in UI |
| RAG pipeline | ✅ `rag/` + Knowledge Base tab |
| Multi-agent system | ✅ 5 agents with orchestration |
| Supporting materials | ✅ FAQ dataset, survey data, eval suite, tests |
| AI tools disclosure | ✅ §8 below |

---

## 8. AI Tools & External Resources Disclosure

| Tool / Resource | How used |
|-----------------|----------|
| **Cursor IDE** | AI-assisted code editing and refactoring during development |
| **Groq API** | Primary LLM (llama-3.3-70b-versatile) for agent reasoning |
| **Google Gemini API** | Optional provider (gemini-2.5-flash) via Admin Center |
| **Open-source libraries** | FastAPI, React, FAISS, sentence-transformers, cross-encoder, Recharts, React Flow, Mermaid — see `requirements.txt` and `frontend/package.json` |
| **Assignment brief** | Business scenario (GreenLeaf Bistro), dataset requirements, fine-tuning question |

All agent logic, schemas, UI, and integration code were implemented and reviewed for this submission.

---

## 9. Suggested Demo Flow (5 minutes)

1. **AI Analyst** — Ask: *"Compare April vs May 2026 CSAT and explain why ratings dropped"*
   - Watch live agent trace (plan → DataAgent tools → RAG → Summary)
2. **Knowledge Base** — Run a retrieval test; show FAISS + rerank scores
3. **Architecture** — Walk through system / RAG / fine-tuning diagrams
4. **Evaluation Lab** — Run eval suite
5. **Fine-Tuning** — Explain QLoRA strategy for domain classification
6. **Download Source Code** — Show ZIP for offline review

---

## 10. Contact

**Jayant Verma**  
Email: jayantmailac@gmail.com  
Portfolio: https://jvt.connect-jv-dev.workers.dev/
