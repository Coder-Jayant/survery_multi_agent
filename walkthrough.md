# MiniSense — Build Walkthrough & Submission Summary

## What Was Built

A fully working, end-to-end survey analysis agent system for GreenLeaf Bistro with 100,000 synthetic survey responses.

---

## Project Structure (Final)

```
Survey_Agent/
├── README.md                    # Full docs + fine-tuning writeup
├── ARCHITECTURE.md              # 13 Mermaid diagrams for interview
├── Makefile                     # make setup / make demo / make eval
├── requirements.txt
├── .env.example
├── .gitignore
├── cli.py                       # python cli.py --question "..." --verbose
├── test_imports.py              # smoke test (no API key needed)
│
├── schemas/models.py            # All Pydantic inter-agent schemas
│
├── data/
│   ├── generate_data.py         # 100k record generator
│   ├── survey_responses.json    # Generated (gitignored)
│   └── faq_document.txt         # ~500-word GreenLeaf Bistro FAQ
│
├── tools/data_tools.py          # compute_csat, extract_top_themes, etc. + Groq tool defs
│
├── rag/
│   ├── ingest.py                # Q&A-block chunking → FAISS
│   ├── retrieve.py              # Cosine similarity search
│   └── vector_store/            # faq_index.faiss + faq_meta.pkl (gitignored)
│
├── providers/llm.py             # Multi-provider LLM abstraction + deterministic fallback
│
├── agents/
│   ├── orchestrator.py          # Plans via LLM function-calling, routes TaskSpecs
│   ├── data_agent.py            # Groq tool-calling loop (4 tools)
│   ├── rag_agent.py             # FAISS retrieval + context summary
│   ├── comparison_agent.py      # Period delta analysis
│   └── summary_agent.py        # Narrative generation
│
├── api/main.py                  # FastAPI: POST /ask, GET /health, GET /demo
└── evaluation/rag_eval.py       # 3-question RAG evaluation with commentary
```

---

## Verified Test Outputs

### Test 1 — Comparison Question
**Q:** "What are the top 3 complaints in May 2026 and how do they compare to April?"

**Agent trace:** `data_agent → data_agent → comparison_agent → rag_agent → summary_agent`

**Tool calls fired:** compute_csat, compute_avg_rating, extract_top_themes, rating_distribution (×2 periods)

**Answer (verified):**
> The most critical insight from the May 2026 data is the significant decline in customer satisfaction, with a 20.2% drop in CSAT to 38.78% and a 0.53 decrease in average rating to 3.02, based on 60,000 responses. The top complaints in May — app, wait time, and food quality — highlight areas needing improvement, especially the sharp rise in price concerns (+20.3pp). Operations team should conduct a root-cause review and focus staff training on app issues and wait time management.

### Test 2 — Single Period + RAG Grounding
**Q:** "What is the current CSAT score and are we meeting our target?"

**Agent trace:** `data_agent → rag_agent → summary_agent`

**RAG retrieval:** chunk_006 (CSAT target) score=0.536 — correctly pulled the 4.5 target + 4.0 escalation policy

**Answer (verified):**
> With a current CSAT of 38.78% and avg_rating 3.02/5, GreenLeaf Bistro is significantly below the target of 4.5. Given that scores below 4.0 trigger a root-cause review, immediate action is needed on app (36.2%), wait time (27.6%), and food quality (26.2%) themes.

---

## RAG Evaluation Results

| Question | Top Chunk | Score | Result |
|---|---|---|---|
| CSAT target + current performance | chunk_006 — CSAT 4.5 target, escalation policy | 0.574 | ✅ High precision |
| Complaint handling policy | chunk_005 — 15-min escalation, refund policy | 0.702 | ✅ Excellent |
| Wait time rising May vs April | chunk_003 — 10min off-peak, 15-20min peak | 0.711 | ⚠️ Slight noise in 3rd chunk |

---

## Rubric Checklist

| Requirement | Status | Evidence |
|---|---|---|
| Orchestrator receives NL question | ✅ | `orchestrator.py` → `ask()` |
| Orchestrator breaks into sub-tasks | ✅ | LLM `create_execution_plan` tool call |
| Structured TaskSpec to each agent | ✅ | `schemas/models.py` TaskSpec |
| Sub-agents return structured output | ✅ | DataAgentResult, RAGAgentResult, etc. |
| Final answer is coherent narrative | ✅ | SummaryAgent → business paragraph |
| Tool calling from within an agent | ✅ | DataAgent: 4 tool calls per run (verified in logs) |
| At least 2 sub-agents | ✅ | DataAgent + RAGAgent + ComparisonAgent |
| RAG pipeline with chunking justification | ✅ | Q&A-block chunking, justified in README |
| FAISS or ChromaDB | ✅ | FAISS IndexFlatIP |
| Top-k retrieval | ✅ | top_k=3, cosine similarity |
| 3 sample RAG questions with evaluation | ✅ | `evaluation/rag_eval.py` |
| Fine-tuning design 300-500 words | ✅ | README Part 3 section |
| Runs with minimal setup | ✅ | `pip install -r requirements.txt` + API key |
| No hardcoding | ✅ | All config via .env |
| README explains tradeoffs | ✅ | "What Was Skipped" section |

---

## What Was Adopted from Lovable Review

| Feature | Source | Value |
|---|---|---|
| `providers/llm.py` abstraction | Lovable minisense | Provider-agnostic, graceful fallback |
| `_deterministic_plan()` fallback | Lovable minisense | Works without API key |

---

## Submission Checklist

- [ ] Push to GitHub: `git init && git add . && git commit -m "MiniSense: Survey Analysis Agent"`
- [ ] Verify README renders correctly on GitHub (Mermaid in ARCHITECTURE.md)
- [ ] Confirm `.env` is in `.gitignore` (it is)
- [ ] Confirm `survey_responses.json` is in `.gitignore` (it is)
- [ ] Add repo link to submission form
