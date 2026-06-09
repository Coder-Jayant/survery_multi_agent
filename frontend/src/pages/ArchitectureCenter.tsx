import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

type TabKey = 'system' | 'agents' | 'rag' | 'dataflow' | 'finetuning' | 'stack'

const DIAGRAMS: Record<string, { title: string; mermaid: string }> = {
  system: {
    title: 'System Architecture',
    mermaid: `graph TB
    User["User / API Client"]
    subgraph Entry["Entry Points"]
        API["FastAPI\\nPOST /ask\\nGET /stream (SSE)"]
        CLI["cli.py\\n--question flag"]
    end
    subgraph Core["Core Agent System"]
        Orch["OrchestratorAgent\\nPlans via LLM function-calling\\nRoutes TaskSpec objects"]
        subgraph Sub["Sub-Agents"]
            DA["DataAgent\\nGroq tool-calling loop\\nCSAT, themes, ratings"]
            RA["RAGAgent\\nFAISS similarity search\\nContext summary"]
            CA["ComparisonAgent\\nRuns DataAgent x2\\nPeriod deltas"]
            SA["SummaryAgent\\nNarrative generation"]
        end
    end
    subgraph Data["Data Layer"]
        JSON["survey_responses.json\\n~195k records Jan-May 2026"]
        FAISS["FAISS IndexFlatIP\\n384-dim embeddings"]
        FAQ["faq_document.txt"]
    end
    User --> API
    User --> CLI
    API --> Orch
    CLI --> Orch
    Orch -->|TaskSpec| DA
    Orch -->|TaskSpec| RA
    Orch -->|TaskSpec| CA
    Orch --> SA
    DA --> JSON
    RA --> FAISS
    FAISS --> FAQ`,
  },
  agents: {
    title: 'Agent Communication Protocol',
    mermaid: `flowchart TD
    Q["Natural language question"] --> Orch["OrchestratorAgent\\nLLM function-calling plan"]
    Orch -->|"TaskSpec{agent,intent,filters}"| DA["DataAgent"]
    Orch -->|"TaskSpec"| RA["RAGAgent"]
    Orch -->|"TaskSpec"| CA["ComparisonAgent"]
    DA -->|"DataAgentResult"| Orch
    RA -->|"RAGAgentResult"| Orch
    CA -->|"ComparisonAgentResult"| Orch
    Orch --> SA["SummaryAgent"]
    SA -->|"SummaryAgentResult"| Orch
    Orch -->|"FinalAnswer"| User["User"]`,
  },
  rag: {
    title: 'RAG Pipeline',
    mermaid: `flowchart LR
    subgraph Ingest["INGEST"]
        FAQ["faq_document.txt"] --> Split["Q: boundary split"]
        Split --> Chunks["59 Q&A chunks"]
        Chunks --> Embed["all-MiniLM-L6-v2"]
        Embed --> Norm["L2 Normalize"]
        Norm --> FAISS["FAISS IndexFlatIP"]
    end
    subgraph Retrieve["RETRIEVE"]
        Query["Query"] --> EmbQ["Embed query"]
        EmbQ --> NormQ["L2 Normalize"]
        NormQ --> Search["FAISS top-k search"]
        Search --> Results["Ranked chunks"]
        Results --> Summary["Groq context summary"]
    end`,
  },
  dataflow: {
    title: 'Data Flow',
    mermaid: `flowchart LR
    Gen["generate_data.py\\n~195k records Jan-May 2026"] --> JSON["survey_responses.json"]
    JSON --> DA["DataAgent\\n_load_responses()\\nlru_cache"]
    DA --> Tools["data_tools.py\\ncompute_csat()\\nextract_top_themes()\\nrating_distribution()"]
    Tools --> Filter["filter_by_period(start,end)"]
    Filter --> Metrics["Typed metrics\\nDataAgentResult"]
    Metrics --> SA["SummaryAgent\\nNarrative"]`,
  },
  finetuning: {
    title: 'Fine-Tuning Design',
    mermaid: `flowchart TB
    subgraph Pipeline["Data Pipeline"]
        Raw["10k responses/day"] --> Labeler["GPT-4o labeler"]
        Labeler --> Spot["Human spot-check 10-15%"]
        Spot --> Aug["Back-translation augment"]
        Aug --> Dataset["4k labeled examples"]
    end
    subgraph Training["Training"]
        Dataset --> Base["Mistral-7B or Flan-T5"]
        Base --> LoRA["LoRA r=8 alpha=16"]
        LoRA --> Eval["macro-F1 >= 0.90"]
        Eval -->|Pass| Ready["Adapter v1.0"]
    end
    subgraph Serving["Serving"]
        Ready --> vLLM["vLLM + enable-lora"]
        vLLM --> Routes["Hot-swap zero downtime"]
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
          theme: 'dark',
          themeVariables: {
            background: '#12121a',
            primaryColor: '#6366f1',
            primaryTextColor: '#e8e8f0',
            primaryBorderColor: '#6366f1',
            edgeLabelBackground: '#1a1a26',
            nodeTextColor: '#e8e8f0',
            lineColor: '#6366f1',
            secondaryColor: '#1a1a26',
            tertiaryColor: '#0e0e16',
            clusterBkg: '#0e0e16',
            clusterBorder: '#2a2a3a',
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
