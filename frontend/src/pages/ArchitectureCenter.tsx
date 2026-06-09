import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

type TabKey = 'system' | 'agents' | 'rag' | 'dataflow' | 'finetuning' | 'stack'

const DIAGRAMS: Record<string, { title: string; mermaid: string }> = {
  system: {
    title: 'System Architecture',
    mermaid: `flowchart TB
    classDef user fill:#1a2e1a,stroke:#22c55e,color:#86efac
    classDef entry fill:#1e1a3a,stroke:#6366f1,color:#a5b4fc
    classDef orch fill:#2d1b4e,stroke:#a855f7,color:#d8b4fe
    classDef agent fill:#1a1a3a,stroke:#6366f1,color:#c4b5fd
    classDef data fill:#1e3a5f,stroke:#3b82f6,color:#93c5fd

    U["👤 User"]:::user
    subgraph Entry["API Layer"]
        API["FastAPI\n/ask · /stream"]:::entry
        CLI["cli.py"]:::entry
    end
    subgraph Core["Agent System"]
        Orch["Orchestrator\nLLM Planner"]:::orch
        DA["DataAgent\nMetrics + Tools"]:::agent
        RA["RAGAgent\n2-Stage Retrieval"]:::agent
        CA["ComparisonAgent\nPeriod Deltas"]:::agent
        SA["SummaryAgent\nNarrative"]:::agent
    end
    subgraph Data["Data Layer"]
        JSON["survey_responses.json\n195k records"]:::data
        FAISS["FAISS Index\n384-dim"]:::data
        FAQ["FAQ Document\n88 chunks"]:::data
    end
    U --> API & CLI
    API & CLI --> Orch
    Orch -->|TaskSpec| DA & RA & CA
    DA & RA & CA --> Orch
    Orch --> SA --> Orch
    DA --> JSON
    RA --> FAISS --> FAQ`,
  },
  agents: {
    title: 'Agent Communication Protocol',
    mermaid: `flowchart LR
    classDef io fill:#1a2e1a,stroke:#22c55e,color:#86efac
    classDef orch fill:#2d1b4e,stroke:#a855f7,color:#d8b4fe
    classDef agent fill:#1a1a3a,stroke:#6366f1,color:#c4b5fd

    Q["❓ Question"]:::io --> Orch["Orchestrator"]:::orch
    Orch -->|TaskSpec| DA["DataAgent"]:::agent
    Orch -->|TaskSpec| RA["RAGAgent"]:::agent
    Orch -->|TaskSpec| CA["ComparisonAgent"]:::agent
    DA -->|DataResult| Orch
    RA -->|RAGResult| Orch
    CA -->|CompareResult| Orch
    Orch --> SA["SummaryAgent"]:::agent
    SA -->|Narrative| Orch
    Orch -->|"FinalAnswer"| Ans["✅ Answer"]:::io`,
  },
  rag: {
    title: 'RAG Pipeline — 2-Stage Retrieval',
    mermaid: `flowchart LR
    classDef doc fill:#1e3a5f,stroke:#3b82f6,color:#93c5fd
    classDef proc fill:#1a1a3a,stroke:#6366f1,color:#a5b4fc
    classDef model fill:#2d1b4e,stroke:#a855f7,color:#d8b4fe
    classDef rerank fill:#3a1a2e,stroke:#ec4899,color:#f9a8d4
    classDef out fill:#1a2e1a,stroke:#22c55e,color:#86efac

    subgraph Ingest["📥 Ingest (offline)"]
        F["FAQ Doc"]:::doc --> S["Q/A Split"]:::proc
        S --> C["88 Chunks"]:::proc
        C --> E["MiniLM\nEmbedder"]:::model
        E --> N["L2 Norm"]:::proc
        N --> I["FAISS\nIndex"]:::doc
    end
    subgraph Retrieve["🔍 Retrieve (online)"]
        Q["Query"]:::out --> EQ["Embed\nQuery"]:::model
        EQ --> NQ["L2 Norm"]:::proc
        NQ --> SR["Top-10\nFAISS"]:::doc
        SR --> CE["Cross-Encoder\nReranker"]:::rerank
        CE --> R["Top-3\nChunks"]:::out
        R --> LM["LLM\nSummary"]:::model
    end`,
  },
  dataflow: {
    title: 'Data Flow',
    mermaid: `flowchart LR
    classDef gen fill:#1a2e1a,stroke:#22c55e,color:#86efac
    classDef store fill:#1e3a5f,stroke:#3b82f6,color:#93c5fd
    classDef proc fill:#1a1a3a,stroke:#6366f1,color:#a5b4fc
    classDef out fill:#2d1b4e,stroke:#a855f7,color:#d8b4fe

    Gen["generate_data.py\n195k records"]:::gen --> JSON["survey_responses.json"]:::store
    JSON --> DA["DataAgent\nlru_cache"]:::proc
    DA --> Tools["data_tools.py\ncsat · themes · ratings"]:::proc
    Tools --> Filter["filter_by_period()"]:::proc
    Filter --> Metrics["DataAgentResult\nTyped schema"]:::out
    Metrics --> SA["SummaryAgent\nNarrative"]:::out`,
  },
  finetuning: {
    title: 'Fine-Tuning Design',
    mermaid: `flowchart LR
    classDef raw fill:#1e3a5f,stroke:#3b82f6,color:#93c5fd
    classDef proc fill:#1a1a3a,stroke:#6366f1,color:#a5b4fc
    classDef model fill:#2d1b4e,stroke:#a855f7,color:#d8b4fe
    classDef out fill:#1a2e1a,stroke:#22c55e,color:#86efac

    subgraph Pipeline["📊 Data Pipeline"]
        Raw["Raw Data\n10k/day"]:::raw --> Lab["GPT-4o\nLabeler"]:::model
        Lab --> Spot["Human\nReview 15%"]:::proc
        Spot --> Aug["Augment\nBack-translate"]:::proc
        Aug --> DS["4k Labeled\nExamples"]:::out
    end
    subgraph Training["🏋️ Training"]
        DS --> Base["Mistral-7B\nor Flan-T5"]:::model
        Base --> LoRA["LoRA\nr=8 α=16"]:::proc
        LoRA --> Ev["F1 ≥ 0.90\nEval"]:::proc
        Ev -->|Pass| Adapter["Adapter v1.0"]:::out
    end
    subgraph Serving["🚀 Serving"]
        Adapter --> vLLM["vLLM\n+ LoRA"]:::model
        vLLM --> Swap["Hot-swap\nzero downtime"]:::out
    end`,
  },
}

const TECH_STACK = [
  { category: 'LLM', item: 'Groq / llama-3.3-70b-versatile', why: 'Function calling, free tier, low latency' },
  { category: 'Embeddings', item: 'all-MiniLM-L6-v2 (local)', why: 'Free, 384-dim, strong retrieval quality' },
  { category: 'Vector Store', item: 'FAISS IndexFlatIP', why: 'Zero server infra for 11 chunks; HNSW at scale' },
  { category: 'Backend', item: 'FastAPI', why: 'Async, SSE support, auto OpenAPI docs' },
  { category: 'Schemas', item: 'Pydantic v2', why: 'Typed inter-agent communication, never raw strings' },
  { category: 'Frontend', item: 'React + Vite + TypeScript', why: 'Modern, typed, fast HMR' },
  { category: 'Charts', item: 'Recharts', why: 'Composable, React-native, responsive' },
  { category: 'Agent Graph', item: 'React Flow', why: 'Live node animation, interactive graph' },
  { category: 'Architecture Diagrams', item: 'Mermaid', why: 'Render diagrams from markdown in-browser' },
  { category: 'Styling', item: 'Tailwind CSS', why: 'Utility-first, dark theme, zero CSS files' },
  { category: 'Data Generation', item: 'Python + random', why: 'Controlled synthetic data with realistic CSAT arc' },
  { category: 'Agent Framework', item: 'Plain Python', why: 'No abstraction hiding — agent logic fully visible' },
]

export function ArchitectureCenter() {
  const [tab, setTab] = useState<TabKey>('system')
  const diagramRef = useRef<HTMLDivElement>(null)

  const renderIdRef = useRef(0)

  useEffect(() => {
    if (tab === 'stack') return
    let cancelled = false

    const render = async () => {
      if (!diagramRef.current) return
      // Clear previous content immediately to avoid showing stale diagram
      diagramRef.current.innerHTML = '<div class="flex justify-center py-8"><div class="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin"></div></div>'

      try {
        const mermaid = (await import('mermaid')).default
        mermaid.initialize({
          startOnLoad: false,
          theme: 'base',
          themeVariables: {
            background: '#0e0e16',
            primaryColor: '#1a1a3a',
            primaryTextColor: '#e2e2f0',
            primaryBorderColor: '#6366f1',
            edgeLabelBackground: '#12121a',
            nodeTextColor: '#e2e2f0',
            lineColor: '#6366f1',
            secondaryColor: '#12121a',
            tertiaryColor: '#0e0e16',
            clusterBkg: '#0f0f1a',
            clusterBorder: '#2a2a3a',
            fontFamily: 'ui-monospace, monospace',
            fontSize: '13px',
          },
        })

        const diagram = DIAGRAMS[tab]?.mermaid
        if (!diagram || cancelled) return

        // Use a unique ID on every render to avoid Mermaid's ID-reuse error
        renderIdRef.current += 1
        const renderId = `mermaid-diagram-${renderIdRef.current}`

        const { svg } = await mermaid.render(renderId, diagram)
        if (!cancelled && diagramRef.current) {
          diagramRef.current.innerHTML = svg
          // Make SVG responsive
          const svgEl = diagramRef.current.querySelector('svg')
          if (svgEl) {
            svgEl.style.maxWidth = '100%'
            svgEl.style.height = 'auto'
          }
        }
      } catch (e) {
        if (!cancelled && diagramRef.current) {
          diagramRef.current.innerHTML = `
            <div class="text-center py-4 space-y-2">
              <p class="text-xs text-red-400">Diagram render error — showing source</p>
              <pre class="text-xs text-[#8888aa] text-left whitespace-pre-wrap font-mono bg-[#0e0e16] rounded-lg p-3 overflow-auto max-h-[400px]">${DIAGRAMS[tab]?.mermaid ?? ''}</pre>
            </div>`
        }
      }
    }

    render()
    return () => { cancelled = true }
  }, [tab])

  const TABS: Array<{ id: TabKey; label: string }> = [
    { id: 'system', label: 'System Architecture' },
    { id: 'agents', label: 'Agent Protocol' },
    { id: 'rag', label: 'RAG Pipeline' },
    { id: 'dataflow', label: 'Data Flow' },
    { id: 'finetuning', label: 'Fine-Tuning Design' },
    { id: 'stack', label: 'Tech Stack' },
  ]

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Architecture Center</h1>
        <p className="text-sm text-[#8888aa] mt-0.5">System design decisions, tradeoffs, and diagrams</p>
      </div>

      <div className="flex gap-1 border-b border-[#2a2a3a] overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-all',
              tab === t.id
                ? 'border-indigo-400 text-indigo-300'
                : 'border-transparent text-[#8888aa] hover:text-white'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'stack' ? (
        <div className="rounded-xl border border-[#2a2a3a] bg-[#12121a] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2a2a3a] text-[#8888aa] text-xs uppercase tracking-wider">
                <th className="px-5 py-3 text-left">Category</th>
                <th className="px-5 py-3 text-left">Technology</th>
                <th className="px-5 py-3 text-left">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2a3a]">
              {TECH_STACK.map((row, i) => (
                <tr key={i} className="hover:bg-[#1a1a26] transition-colors">
                  <td className="px-5 py-3 text-indigo-400 font-medium text-xs">{row.category}</td>
                  <td className="px-5 py-3 text-white font-mono text-xs">{row.item}</td>
                  <td className="px-5 py-3 text-[#8888aa] text-xs">{row.why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-[#2a2a3a] bg-[#12121a] p-6">
          <h2 className="text-sm font-semibold text-white mb-4">{DIAGRAMS[tab]?.title}</h2>
          <div
            ref={diagramRef}
            className="flex justify-center overflow-auto [&_svg]:max-w-full [&_svg]:h-auto"
          />
        </div>
      )}
    </div>
  )
}
