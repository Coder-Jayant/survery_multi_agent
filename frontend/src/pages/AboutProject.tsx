export function AboutProject() {
  return (
    <div className="p-6 max-w-4xl space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">About MiniSense</h1>
        <p className="text-sm text-[#8888aa] mt-1">Multi-Agent Customer Intelligence Platform — Design Decisions & Tradeoffs</p>
      </div>

      <Section title="Problem Statement">
        <p>
          Customer survey data contains actionable business intelligence, but surfacing it requires combining
          structured metric computation, unstructured FAQ retrieval, temporal comparison, and coherent narrative
          generation. A single LLM call cannot do this reliably. MiniSense addresses this with a multi-agent
          system where each agent has a single, well-defined responsibility.
        </p>
      </Section>

      <Section title="Why Multi-Agent?">
        <p className="mb-3">A monolithic LLM prompt produces hallucinated metrics. A multi-agent architecture separates concerns:</p>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-[#2a2a3a] text-[#8888aa] text-xs uppercase tracking-wider">
              <th className="py-2 text-left">Agent</th>
              <th className="py-2 text-left">Responsibility</th>
              <th className="py-2 text-left">Why Separate?</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2a2a3a] text-[#ccccdd]">
            {[
              ['Orchestrator', 'Planning via LLM function-calling', 'Separates intent from execution'],
              ['DataAgent', 'Deterministic metric computation', 'LLM decides what; Python does how'],
              ['RAGAgent', 'FAISS policy retrieval', 'Grounds answers in source documents'],
              ['ComparisonAgent', 'Period-over-period deltas', 'Single responsibility for temporal analysis'],
              ['SummaryAgent', 'Narrative synthesis', 'Prose generation after all data is certain'],
            ].map(([agent, resp, why]) => (
              <tr key={agent}>
                <td className="py-2.5 pr-4 text-indigo-400 font-medium">{agent}</td>
                <td className="py-2.5 pr-4">{resp}</td>
                <td className="py-2.5 text-[#8888aa]">{why}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Key Design Decisions">
        <div className="space-y-3">
          {[
            {
              decision: 'Pydantic schemas for inter-agent communication',
              rationale: 'Agents never pass raw strings. Every message is a typed model (TaskSpec in, *AgentResult out). This prevents prompt injection, enables serialization, and makes the system inspectable.',
            },
            {
              decision: 'Q&A-block chunking over fixed-size',
              rationale: 'The FAQ document is structured as Q&A pairs. Splitting on "Q:" boundaries preserves semantic units — each chunk contains exactly one question and its complete answer, improving retrieval precision.',
            },
            {
              decision: 'FAISS IndexFlatIP over ChromaDB/Pinecone',
              rationale: 'For 11 chunks, a flat index is faster and has zero server infrastructure overhead. L2-normalized vectors with inner product = cosine similarity. HNSW would be the production choice at scale.',
            },
            {
              decision: 'Tool calling in DataAgent, not in Orchestrator',
              rationale: 'The DataAgent uses Groq function-calling to decide which metrics to compute. This demonstrates the "LLM as orchestrator of deterministic tools" pattern — the LLM chooses what, Python does how.',
            },
            {
              decision: 'all-MiniLM-L6-v2 (local) over OpenAI embeddings',
              rationale: 'Local embedding model eliminates API cost and latency for retrieval. 384 dimensions is sufficient for an 11-chunk FAQ. In production, text-embedding-3-small would provide better recall.',
            },
            {
              decision: 'LRU cache on survey data load',
              rationale: '~195k records (~200MB JSON) loaded once per process and cached. All agents share the same in-memory dataset — no repeated disk I/O across tool calls.',
            },
          ].map(({ decision, rationale }) => (
            <div key={decision} className="rounded-lg border border-[#2a2a3a] bg-[#12121a] p-4">
              <div className="text-sm font-semibold text-white mb-1.5">{decision}</div>
              <p className="text-sm text-[#8888aa] leading-relaxed">{rationale}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="What Was Skipped — and Why">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2a2a3a] text-[#8888aa] text-xs uppercase tracking-wider">
              <th className="py-2 text-left">Feature</th>
              <th className="py-2 text-left">Why Skipped</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2a2a3a] text-[#ccccdd]">
            {[
              ['Authentication / multi-tenancy', 'Demo platform; not the scope of a technical showcase'],
              ['PDF export', 'High complexity, low demo value'],
              ['Exact run replay', 'LLM outputs are non-deterministic — replay would be misleading'],
              ['Real-time multi-RAG strategy switching', 'Risk of index corruption in live demo'],
              ['LangGraph / LangChain', 'Plain Python keeps agent logic visible and explainable'],
              ['Vector DB server (Chroma, Pinecone)', 'Zero-infrastructure is more demo-portable; FAISS is sufficient'],
              ['Fine-tuning implementation', 'Design documented; production LoRA training needs labeled dataset'],
            ].map(([feature, reason]) => (
              <tr key={feature}>
                <td className="py-2.5 pr-4 text-white font-medium">{feature}</td>
                <td className="py-2.5 text-[#8888aa]">{reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Tagline">
        <blockquote className="border-l-4 border-indigo-500 pl-4 py-2">
          <p className="text-lg font-semibold text-white italic">"Real AI decisions. Full observability. No black boxes."</p>
        </blockquote>
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-base font-bold text-white border-b border-[#2a2a3a] pb-2">{title}</h2>
      <div className="text-sm text-[#8888aa] leading-relaxed">{children}</div>
    </div>
  )
}
