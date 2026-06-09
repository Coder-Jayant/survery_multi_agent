# MiniSense — Architecture Deep Dive

> A complete technical reference for explaining the system in an interview.
> All diagrams are Mermaid — render in any markdown viewer or GitHub.

---

## 1. System Overview

MiniSense is a **two-level multi-agent AI system** that answers natural language business questions about survey data. It combines:

- **Agentic reasoning** (Orchestrator plans, sub-agents execute)
- **Tool calling** (LLM decides what metrics to compute, deterministic functions do the math)
- **RAG** (FAISS vector store grounds answers in business policy)
- **Structured inter-agent communication** (Pydantic models, never raw strings)

---

## 2. High-Level Architecture

```mermaid
graph TB
    User["👤 User / API Client"]

    subgraph Entry["Entry Points"]
        CLI["cli.py\n--question flag\n--verbose flag"]
        API["FastAPI\nPOST /ask\nGET /demo"]
    end

    subgraph Core["Core Agent System"]
        Orch["🧠 OrchestratorAgent\norchestrator.py\n\nPlans via LLM function-calling\nRoutes TaskSpec objects\nSynthesizes FinalAnswer"]

        subgraph SubAgents["Sub-Agents"]
            DA["📊 DataAgent\ndata_agent.py\n\nGroq tool-calling loop\nComputes CSAT, themes\navg_rating, distribution"]
            RA["🔍 RAGAgent\nrag_agent.py\n\nFAISS similarity search\nContext summary via LLM"]
            CA["📈 ComparisonAgent\ncomparison_agent.py\n\nRuns DataAgent × 2\nComputes period deltas\nEmerging/declining themes"]
            SA["✍️ SummaryAgent\nsummary_agent.py\n\nNarrative generation\nFinal business paragraph"]
        end
    end

    subgraph Data["Data Layer"]
        JSON["survey_responses.json\n100,000 records\nApril + May 2026"]
        Tools["tools/data_tools.py\ncompute_csat()\nextract_top_themes()\nrating_distribution()"]
        FAISS["FAISS Vector Store\nfaq_index.faiss\n11 FAQ chunks\n384-dim embeddings"]
        FAQ["data/faq_document.txt\n~500 words\nGreenLeaf Bistro FAQ"]
        EMB["sentence-transformers\nall-MiniLM-L6-v2\nLocal, free, 384-dim"]
    end

    subgraph LLM["LLM Layer (Groq)"]
        Groq["Groq API\nllama-3.3-70b-versatile\nFunction calling enabled"]
    end

    subgraph Schemas["Schema Layer"]
        Models["schemas/models.py\nTaskSpec\nDataAgentResult\nRAGAgentResult\nComparisonAgentResult\nFinalAnswer"]
    end

    User --> CLI
    User --> API
    CLI --> Orch
    API --> Orch

    Orch -->|"TaskSpec"| DA
    Orch -->|"TaskSpec"| RA
    Orch -->|"TaskSpec"| CA
    Orch -->|"TaskSpec + all results"| SA

    DA -->|"DataAgentResult"| Orch
    RA -->|"RAGAgentResult"| Orch
    CA -->|"ComparisonAgentResult"| Orch
    SA -->|"SummaryAgentResult"| Orch

    DA --> Tools
    DA --> JSON
    CA --> DA
    RA --> FAISS
    FAISS --> FAQ
    FAISS --> EMB

    Orch --> Groq
    DA --> Groq
    RA --> Groq
    CA --> Groq
    SA --> Groq

    Orch -.->|"uses"| Models
    DA -.->|"uses"| Models
    RA -.->|"uses"| Models
    CA -.->|"uses"| Models
    SA -.->|"uses"| Models
```

---

## 3. Request Lifecycle — Step by Step

```mermaid
sequenceDiagram
    actor User
    participant CLI as cli.py
    participant Orch as OrchestratorAgent
    participant Groq as Groq LLM
    participant DA as DataAgent
    participant CA as ComparisonAgent
    participant RA as RAGAgent
    participant SA as SummaryAgent
    participant FAISS as FAISS Store
    participant Tools as data_tools.py

    User->>CLI: python cli.py --question "Top complaints May vs April?"
    CLI->>Orch: ask(question)

    Note over Orch,Groq: Step 1 — Planning
    Orch->>Groq: system_prompt + question + create_execution_plan tool
    Groq-->>Orch: tool_call: create_execution_plan([task1, task2, task3, task4])
    Orch-->>Orch: Builds list of TaskSpec objects

    Note over Orch,DA: Step 2 — DataAgent (May)
    Orch->>DA: TaskSpec(agent=data_agent, filters={date_range: May})
    DA->>Groq: prompt + TOOL_DEFINITIONS (compute_csat, avg_rating, themes...)
    Groq-->>DA: tool_calls: [compute_csat, compute_avg_rating, extract_top_themes, rating_distribution]
    DA->>Tools: compute_csat(filtered_responses)
    Tools-->>DA: 38.78%
    DA->>Tools: extract_top_themes(filtered_responses, n=3)
    Tools-->>DA: [app, wait_time, food_quality]
    DA-->>Orch: DataAgentResult(csat=38.78%, avg=3.02, themes=[...])

    Note over Orch,DA: Step 3 — DataAgent (April)
    Orch->>DA: TaskSpec(agent=data_agent, filters={date_range: April})
    DA->>Groq: same tool loop
    DA->>Tools: tool executions
    DA-->>Orch: DataAgentResult(csat=58.96%, avg=3.55, themes=[...])

    Note over Orch,CA: Step 4 — ComparisonAgent
    Orch->>CA: TaskSpec(agent=comparison_agent, filters={period_a: May, period_b: April})
    CA->>DA: Internally runs DataAgent × 2
    CA-->>CA: delta_csat = -20.18pp (DECLINED)
    CA->>Groq: Generate insight_summary
    Groq-->>CA: "CSAT declined 20.2pp from April to May..."
    CA-->>Orch: ComparisonAgentResult(delta=-20.18, emerging=[price], declining=[cleanliness])

    Note over Orch,RA: Step 5 — RAGAgent
    Orch->>RA: TaskSpec(agent=rag_agent, intent="business context for complaints")
    RA->>FAISS: embed(query) → similarity search
    FAISS-->>RA: [chunk_005(complaints), chunk_006(CSAT target), chunk_010(staff)]
    RA->>Groq: Summarize chunks into context_summary
    Groq-->>RA: "GreenLeaf targets CSAT 4.5+, escalates within 15 min..."
    RA-->>Orch: RAGAgentResult(chunks=[...], context_summary="...")

    Note over Orch,SA: Step 6 — SummaryAgent
    Orch->>SA: TaskSpec + DataAgentResult + ComparisonAgentResult + RAGAgentResult
    SA->>Groq: Full context prompt → generate narrative
    Groq-->>SA: "CSAT declined 20.2pp to 38.78% in May, driven by app, wait time..."
    SA-->>Orch: SummaryAgentResult(narrative="...", key_metrics={...})

    Orch-->>CLI: FinalAnswer(narrative, supporting_data, sources, agent_trace)
    CLI-->>User: Formatted output
```

---

## 4. Agent Communication Protocol

> **Key design principle**: No agent ever passes or receives raw text. All communication uses typed Pydantic models.

```mermaid
classDiagram
    class TaskSpec {
        +str task_id
        +str agent
        +str intent
        +dict filters
        +dict context
    }

    class DataAgentResult {
        +str period_label
        +DateRange date_range
        +int total_responses
        +float avg_rating
        +float csat_score
        +list~ThemeCount~ top_themes
        +dict rating_distribution
        +list~str~ tool_trace
    }

    class RAGAgentResult {
        +str query
        +list~RetrievedChunk~ retrieved_chunks
        +str context_summary
    }

    class ComparisonAgentResult {
        +DataAgentResult period_a
        +DataAgentResult period_b
        +float delta_csat
        +float delta_avg_rating
        +list~str~ emerging_themes
        +list~str~ declining_themes
        +str insight_summary
    }

    class SummaryAgentResult {
        +str narrative
        +dict key_metrics
    }

    class FinalAnswer {
        +str question
        +str narrative
        +dict supporting_data
        +list~str~ sources
        +list~str~ agent_trace
    }

    class ThemeCount {
        +str theme
        +int count
        +float percentage
    }

    class RetrievedChunk {
        +str chunk_id
        +str text
        +float score
        +str source
    }

    TaskSpec --> DataAgentResult : DataAgent produces
    TaskSpec --> RAGAgentResult : RAGAgent produces
    TaskSpec --> ComparisonAgentResult : ComparisonAgent produces
    DataAgentResult --> ComparisonAgentResult : contains ×2
    DataAgentResult --> ThemeCount : contains
    RAGAgentResult --> RetrievedChunk : contains
    SummaryAgentResult --> FinalAnswer : feeds into
```

---

## 5. DataAgent Tool-Calling Flow

> This is the core "tool calling from within an agent" the rubric requires.

```mermaid
flowchart LR
    subgraph DA["DataAgent — Groq Tool-Calling Loop"]
        direction TB
        IN["Receives TaskSpec\n{date_range, period_label}"] --> Build["Build messages:\nsystem_prompt\n+ user_message\n+ TOOL_DEFINITIONS"]
        Build --> LLM1["Groq LLM\ntool_choice=auto"]
        LLM1 --> TC{"Tool calls\nin response?"}
        TC -->|"Yes"| Exec["Execute tool:\ndispatch_tool(name, args, responses)"]
        Exec --> Append["Append tool result\nto messages"]
        Append --> LLM1
        TC -->|"No - done"| FB["Fallback: direct calls\nif any metric missing"]
        FB --> Build2["Assemble\nDataAgentResult"]
    end

    subgraph Tools["tools/data_tools.py"]
        F1["compute_csat(responses)\n→ float 0-100"]
        F2["compute_avg_rating(responses)\n→ float 1-5"]
        F3["extract_top_themes(responses, n)\n→ list[ThemeCount]"]
        F4["rating_distribution(responses)\n→ dict str→int"]
        F5["filter_by_period(responses, start, end)\n→ list[dict]"]
    end

    Exec --> F1
    Exec --> F2
    Exec --> F3
    Exec --> F4
    F1 & F2 & F3 & F4 --> F5
```

---

## 6. RAG Pipeline — Ingest & Retrieve

```mermaid
flowchart TB
    subgraph Ingest["INGEST  rag/ingest.py  (run once)"]
        direction LR
        FAQ["faq_document.txt\n~500 words"] --> Split["Split on Q: boundaries\n→ 11 Q&A blocks"]
        Split --> Chunk["Sentence-split blocks\n> 150 tokens\n→ 11 final chunks"]
        Chunk --> Embed["SentenceTransformer\nall-MiniLM-L6-v2\n384-dim vectors"]
        Embed --> Norm["L2 Normalize\nfor cosine similarity"]
        Norm --> FAISS["FAISS IndexFlatIP\nfaq_index.faiss\n+ faq_meta.pkl"]
    end

    subgraph Retrieve["RETRIEVE  rag/retrieve.py  (per query)"]
        direction LR
        Q["Query string\nfrom RAGAgent"] --> EmbQ["Embed query\nsame model"]
        EmbQ --> NormQ["L2 Normalize"]
        NormQ --> Search["FAISS.search(top_k=3)\nInner product = cosine"]
        Search --> Chunks["Top-k chunks\n{chunk_id, text, score, source}"]
        Chunks --> Summary["Groq LLM\nContext summary\n2-3 sentences"]
        Summary --> Result["RAGAgentResult"]
    end

    FAISS -.->|"loaded once\nlru_cache"| Search
```

---

## 7. Orchestrator Planning — LLM Function Calling

```mermaid
flowchart TD
    Q["Natural language question"] --> SYS["System prompt:\n- Available agents & capabilities\n- Date ranges in dataset\n- Routing rules"]

    SYS --> PLAN["Groq LLM\ntool: create_execution_plan\ntool_choice: forced"]

    PLAN --> JSON["LLM returns JSON:\n[\n  {agent: data_agent, intent: ..., filters: {date_range: May}},\n  {agent: data_agent, intent: ..., filters: {date_range: April}},\n  {agent: comparison_agent, filters: {period_a, period_b}},\n  {agent: rag_agent, intent: ...}\n]"]

    JSON --> ROUTE{"Route each\nTaskSpec"}

    ROUTE -->|"data_agent"| DA["DataAgent.run(task)"]
    ROUTE -->|"rag_agent"| RA["RAGAgent.run(task)"]
    ROUTE -->|"comparison_agent"| CA["ComparisonAgent.run(task)"]

    DA --> R1["DataAgentResult"]
    RA --> R2["RAGAgentResult"]
    CA --> R3["ComparisonAgentResult"]

    R1 & R2 & R3 --> SYNTH["SummaryAgent.run(\n  task,\n  data_result,\n  rag_result,\n  comparison_result\n)"]

    SYNTH --> ANS["FinalAnswer\n{narrative, supporting_data,\n sources, agent_trace}"]
```

---

## 8. Data Generation Design

```mermaid
flowchart LR
    subgraph Config["Design Decisions"]
        D1["100,000 total records\n40% April / 60% May"]
        D2["April rating weights\n[3%,7%,12%,38%,40%]\nCSAT target ~59%"]
        D3["May rating weights\n[6%,12%,15%,35%,32%]\nCSAT target ~39%\n(intentional drop = signal)"]
        D4["6 themes:\nfood_quality, wait_time\nstaff, cleanliness\nprice, app"]
        D5["3 sentiments per theme:\npositive / negative / neutral\nwith template pools"]
    end

    subgraph Output["Output Record Schema"]
        S["{\n  response_id: 'r000001',\n  date: '2026-05-14',\n  business_id: 'b01',\n  business_name: 'GreenLeaf Bistro',\n  survey_id: 's01',\n  survey_name: 'Overall Experience',\n  rating: 2,\n  response_channel: 'mobile',\n  free_text: 'Wait was too long...'\n}"]
    end

    D1 & D2 & D3 & D4 & D5 --> Output
```

---

## 9. Question Routing Decision Tree

> How the Orchestrator decides which agents to invoke:

```mermaid
flowchart TD
    Q["User Question"] --> P1{"Contains comparison\nkeywords?\nvs / compare / change\ntrend / last month"}

    P1 -->|Yes| USE_CA["Use comparison_agent\n+ rag_agent\n+ summary_agent"]
    P1 -->|No| P2{"Asks about\nspecific period\nor current state?"}

    P2 -->|Yes| USE_DA["Use data_agent\n+ rag_agent\n+ summary_agent"]
    P2 -->|No| P3{"FAQ / policy\nquestion only?"}

    P3 -->|Yes| USE_RA["Use rag_agent\n+ summary_agent"]
    P3 -->|No| USE_ALL["Use all agents\nas fallback"]

    USE_CA --> ALWAYS["summary_agent\nalways last\n(synthesizes everything)"]
    USE_DA --> ALWAYS
    USE_RA --> ALWAYS
    USE_ALL --> ALWAYS
```

---

## 10. Fine-Tuning Architecture (Part 3)

```mermaid
flowchart TB
    subgraph DataPipeline["Data Pipeline"]
        RAW["10k raw responses/day"] --> GPT4["GPT-4o labeler\nfew-shot prompt\n8 categories"]
        GPT4 --> HUMAN["Human spot-check\n10-15% of labels"]
        HUMAN --> AUG["Augmentation:\nback-translation\nparaphrase"]
        AUG --> DATASET["~4,000 labeled\nexamples\n~500 per class"]
    end

    subgraph Training["Training Pipeline"]
        DATASET --> BASE["Base model:\nMistral-7B-Instruct\nor Flan-T5-base"]
        BASE --> LORA["LoRA adapter\nr=8, alpha=16\n~10MB artifact"]
        LORA --> EVAL["Evaluate:\nmacro-F1 >= 0.90\nper-class F1 >= 0.80"]
        EVAL -->|"Pass"| READY["Adapter v1.0\nversioned in\nobject storage"]
        EVAL -->|"Fail"| FIX["Fix data or\nhyperparams"]
        FIX --> LORA
    end

    subgraph Serving["Serving"]
        READY --> VLLM["vLLM server\n--enable-lora\nbase model running"]
        VLLM --> ROUTES["Route A: /chat → base LLM\nRoute B: /classify → LoRA adapter"]
        ROUTES --> HOT["Hot-swap adapter\nno restart needed"]
    end
```

---

## 11. Component Dependency Map

```mermaid
graph LR
    CLI["cli.py"] --> Orch
    API["api/main.py"] --> Orch

    Orch["agents/orchestrator.py"] --> DA
    Orch --> RA
    Orch --> CA
    Orch --> SA

    CA["agents/comparison_agent.py"] --> DA
    DA["agents/data_agent.py"] --> Tools
    DA --> Models
    DA --> Groq

    RA["agents/rag_agent.py"] --> Retrieve
    RA --> Models
    RA --> Groq

    SA["agents/summary_agent.py"] --> Models
    SA --> Groq

    CA --> Groq
    CA --> Models

    Retrieve["rag/retrieve.py"] --> FAISS["rag/vector_store/"]
    Retrieve --> EMB["sentence-transformers"]

    Ingest["rag/ingest.py"] --> FAISS
    Ingest --> FAQ["data/faq_document.txt"]
    Ingest --> EMB

    Tools["tools/data_tools.py"] --> JSON["data/survey_responses.json"]

    Generate["data/generate_data.py"] --> JSON

    Models["schemas/models.py"]
    Groq["Groq API"]
```

---

## 12. Key Design Decisions — Interview Cheat Sheet

| Decision | What | Why |
|---|---|---|
| **Groq + Llama 3.3 70B** | LLM provider | Function calling support, free tier, already in use |
| **Plain Python (no LangGraph)** | Framework choice | Clean architecture visible, no abstraction hiding agent logic |
| **Pydantic models everywhere** | Inter-agent comms | Enforces structured outputs, type-safe, serializable |
| **Tool calling in DataAgent** | Metrics computation | LLM decides *what* to compute; Python does *how* — deterministic |
| **Q&A block chunking** | RAG strategy | Preserves question-answer semantic units; better than fixed-size |
| **all-MiniLM-L6-v2** | Embedding model | Local, free, 384-dim, strong retrieval, no API cost |
| **FAISS flat index** | Vector store | Zero server infra needed for 11 chunks; HNSW at scale |
| **LRU cache on data load** | Performance | 100MB JSON loaded once, reused across all agent calls |
| **JSON file (no DB)** | Storage | Sufficient at 100k records; scope-appropriate |
| **Two-month dataset** | Data design | Provides comparison signal (April 59% vs May 39% CSAT) |
| **LoRA (not full FT)** | Fine-tuning | 1% trainable params, swappable adapter, no full retraining |
| **vLLM LoRA hot-swap** | Serving | Zero downtime adapter swap, one GPU for multiple routes |

---

## 13. Evaluation Results Summary

| Question | Top Retrieved Chunk | Score | Quality |
|---|---|---|---|
| "What is the CSAT target?" | chunk_006 — CSAT target & escalation policy | 0.5737 | ✅ High precision |
| "How are complaints handled?" | chunk_005 — 15-min escalation, refund policy | 0.4710 | ✅ Correct |
| "Wait time complaints rising?" | chunk_003 — 10min off-peak, 15-20min peak | 0.43 | ⚠️ Partial (app chunk also pulled) |

**Retrieval works well when**: query language matches FAQ Q&A phrasing (direct policy lookups).  
**Retrieval falls short when**: query is implicit or multi-faceted (hybrid BM25 + dense would help at scale).
