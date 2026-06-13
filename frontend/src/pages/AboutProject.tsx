import { useState } from 'react'
import { Brain, Database, Search, GitCompare, FileText, Zap, BarChart2, Layers, Server, Code2 } from 'lucide-react'

function Section({ title, children, icon: Icon }: { title: string; children: React.ReactNode; icon?: React.ElementType }) {
  return (
    <div className="space-y-4">
      <h2 className="flex items-center gap-2 text-base font-bold text-white border-b border-[#2a2a3a] pb-2">
        {Icon && <Icon className="w-4 h-4 text-indigo-400" />}
        {title}
      </h2>
      <div className="text-sm text-[#8888aa] leading-relaxed">{children}</div>
    </div>
  )
}

function Badge({ color = 'indigo', children }: { color?: string; children: React.ReactNode }) {
  const map: Record<string, string> = {
    indigo: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    green:  'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    amber:  'bg-amber-500/15  text-amber-300  border-amber-500/30',
    red:    'bg-red-500/15    text-red-300    border-red-500/30',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${map[color] ?? map.indigo}`}>
      {children}
    </span>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-[#2a2a3a] bg-[#12121a] p-4">{children}</div>
}

function Row({ label, value, badge }: { label: string; value: string; badge?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-[#2a2a3a]/60 last:border-0">
      <span className="text-[#8888aa] text-xs w-40 shrink-0">{label}</span>
      <span className="text-[#ccccdd] text-xs flex-1">{value}</span>
      {badge && <span className="shrink-0">{badge}</span>}
    </div>
  )
}

export function AboutProject() {
  const [openSection, setOpenSection] = useState<string | null>(null)
  const toggle = (s: string) => setOpenSection(prev => prev === s ? null : s)

  return (
    <div className="p-6 max-w-5xl space-y-8 animate-fade-in">

      {/* Header */}
      <div className="rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 p-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <Brain className="w-7 h-7 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">MiniSense</h1>
            <p className="text-indigo-300/80 text-sm mt-0.5">Multi-Agent Customer Intelligence Platform</p>
            <p className="text-[#8888aa] text-xs mt-2 leading-relaxed max-w-2xl">
              A production-grade AI system that answers complex business questions about 195,000 survey
              responses using hierarchical multi-agent orchestration, two-stage RAG with reranking,
              7 deterministic analytics tools, and real-time SSE observability.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {['Multi-Agent', 'RAG + Reranking', '7 Analytics Tools', 'Data-Shape Viz', 'SSE Streaming', 'Universal LLM'].map(t => (
                <Badge key={t}>{t}</Badge>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* System Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Survey Records', value: '195,000', sub: 'Jan–May 2026' },
          { label: 'Analytics Tools', value: '7', sub: 'Deterministic Python' },
          { label: 'Viz Chart Types', value: '7', sub: 'Data-shape driven' },
          { label: 'Frontend Pages', value: '12', sub: 'React + Vite + TS' },
        ].map(({ label, value, sub }) => (
          <Card key={label}>
            <div className="text-2xl font-bold text-white">{value}</div>
            <div className="text-xs font-medium text-[#ccccdd] mt-0.5">{label}</div>
            <div className="text-[10px] text-[#8888aa] mt-0.5">{sub}</div>
          </Card>
        ))}
      </div>

      {/* Agent Architecture */}
      <Section title="Agent Architecture" icon={Layers}>
        <p className="mb-4">5 specialised agents, each with a single well-defined responsibility. Typed Pydantic models flow between agents — no raw strings, no prompt injection surface.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#2a2a3a] text-[#8888aa] uppercase tracking-wider">
                <th className="py-2 text-left pr-4">Agent</th>
                <th className="py-2 text-left pr-4">Input</th>
                <th className="py-2 text-left pr-4">Output</th>
                <th className="py-2 text-left">Key Mechanism</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2a3a] text-[#ccccdd]">
              {[
                ['Orchestrator', 'User question (str)', 'List[TaskSpec]', 'LLM function-calling → execution plan. period_cache prevents duplicate DataAgent calls.'],
                ['DataAgent', 'TaskSpec', 'DataAgentResult', 'LLM picks which of 7 tools to call. Python does all math. Falls back to deterministic if LLM fails.'],
                ['RAGAgent', 'TaskSpec', 'RAGAgentResult', 'FAISS top-10 → cross-encoder reranks → top-3 chunks returned with both scores.'],
                ['ComparisonAgent', 'TaskSpec (2 periods)', 'ComparisonAgentResult', 'Calls DataAgent twice, computes delta CSAT/rating, detects emerging/declining themes.'],
                ['SummaryAgent', 'All agent results', 'SummaryAgentResult + VizSpec', 'Generates narrative + calls viz_builder (data-shape driven, zero LLM cost for viz).'],
              ].map(([agent, input, output, mech]) => (
                <tr key={agent}>
                  <td className="py-2.5 pr-4 text-indigo-400 font-semibold whitespace-nowrap">{agent}</td>
                  <td className="py-2.5 pr-4 font-mono text-[10px] text-emerald-300">{input}</td>
                  <td className="py-2.5 pr-4 font-mono text-[10px] text-amber-300">{output}</td>
                  <td className="py-2.5 text-[#8888aa]">{mech}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* DataAgent Tools */}
      <Section title="DataAgent — 7 Analytics Tools" icon={BarChart2}>
        <p className="mb-4">The LLM receives all tool schemas and chooses which to call. Python executes the computation. All tools use <code className="text-indigo-300 bg-indigo-500/10 px-1 rounded">filter_by_period(responses, start, end)</code> — every tool supports arbitrary date ranges.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { name: 'compute_csat', desc: '% of ratings ≥ 4. Primary health metric.', tag: 'Core' },
            { name: 'compute_avg_rating', desc: 'Mean rating 1–5. Supports granular trending.', tag: 'Core' },
            { name: 'extract_top_themes', desc: 'Top-N themes by keyword frequency in free text.', tag: 'Core' },
            { name: 'rating_distribution', desc: 'Response count per star (1–5). Renders as bar or pie.', tag: 'Core' },
            { name: 'csat_by_segment', desc: 'Multi-dim filter: channel + theme + rating range. Drills into subgroups.', tag: 'New' },
            { name: 'weekly_trend', desc: 'Breaks a date range into ISO weeks. Detects spikes and anomalies.', tag: 'New' },
            { name: 'compare_themes', desc: 'CSAT + avg_rating per theme, sorted worst-first. Issue severity ranking.', tag: 'New' },
          ].map(({ name, desc, tag }) => (
            <Card key={name}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <code className="text-indigo-300 text-[11px] font-mono">{name}</code>
                <Badge color={tag === 'New' ? 'green' : 'indigo'}>{tag}</Badge>
              </div>
              <p className="text-[11px] text-[#8888aa]">{desc}</p>
            </Card>
          ))}
        </div>
      </Section>

      {/* RAG Pipeline */}
      <Section title="RAG Pipeline — Two-Stage Retrieval" icon={Search}>
        <div className="space-y-3">
          <Card>
            <div className="text-xs font-semibold text-white mb-2">Stage 1 — FAISS Bi-Encoder (fast, approximate)</div>
            <Row label="Model" value="all-MiniLM-L6-v2 (384-dim, local, ~10ms)" />
            <Row label="Index type" value="IndexFlatL2 (L2-normalized = cosine similarity)" />
            <Row label="Candidates" value="Top-10 chunks retrieved per query" />
            <Row label="Why local?" value="Zero API cost, zero network latency, works offline" />
          </Card>
          <Card>
            <div className="text-xs font-semibold text-white mb-2">Stage 2 — Cross-Encoder Reranker (precise)</div>
            <Row label="Model" value="cross-encoder/ms-marco-MiniLM-L-6-v2" />
            <Row label="Mechanism" value="[CLS] query [SEP] chunk → single relevance logit" />
            <Row label="Why better?" value="Full bidirectional attention across both texts, not just embeddings" />
            <Row label="Final output" value="Top-3 chunks by rerank score (both scores shown in UI)" />
          </Card>
          <Card>
            <div className="text-xs font-semibold text-white mb-2">Chunking Strategy</div>
            <Row label="Method" value="Paragraph-split on \\n\\n boundaries" />
            <Row label="Why not fixed-size?" value="Fixed-size risks splitting Q away from its A in FAQ" />
            <Row label="Chunk IDs" value="faq_<8-char-hash> — stable across re-indexing (content-addressed)" />
            <Row label="Chunk size" value="50–200 tokens, optimal for bi-encoder embedding" />
          </Card>
        </div>
      </Section>

      {/* Visualization */}
      <Section title="Visualization — Data-Shape Driven" icon={BarChart2}>
        <p className="mb-3">
          Chart type is selected by <strong className="text-white">what data is present</strong>, not by keyword guessing on the question.
          Zero LLM calls. Zero tokens spent on visualization. Pure deterministic logic in <code className="text-indigo-300 bg-indigo-500/10 px-1 rounded">viz_builder.py</code>.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#2a2a3a] text-[#8888aa] uppercase tracking-wider">
                <th className="py-2 text-left pr-4">Condition</th>
                <th className="py-2 text-left pr-4">Chart Type</th>
                <th className="py-2 text-left">Triggered By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2a3a] text-[#ccccdd]">
              {[
                ['weekly_data present', 'Line / Area Chart', 'weekly_trend tool called'],
                ['theme_comparison_data present', 'HeatBar (inline ranked bars)', 'compare_themes tool called'],
                ['segment_data present', 'Scorecard (metric tiles)', 'csat_by_segment tool called'],
                ['3+ comparison periods', 'Line Chart (CSAT arc)', 'Multi-period Orchestrator plan'],
                ['2 comparison periods', 'Table with delta column', 'Comparison query'],
                ['Single period', 'Horizontal Bar (themes)', 'Default single-period query'],
              ].map(([cond, chart, trigger]) => (
                <tr key={cond}>
                  <td className="py-2.5 pr-4 font-mono text-[10px] text-indigo-300">{cond}</td>
                  <td className="py-2.5 pr-4 text-white font-medium">{chart}</td>
                  <td className="py-2.5 text-[#8888aa]">{trigger}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Dataset */}
      <Section title="Dataset — 195,000 Records (Jan–May 2026)" icon={Database}>
        <p className="mb-3">Deliberately engineered narrative arc — the dataset encodes a real business story so agents have meaningful signal to surface.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#2a2a3a] text-[#8888aa] uppercase tracking-wider">
                <th className="py-2 text-left pr-3">Month</th>
                <th className="py-2 text-left pr-3">Records</th>
                <th className="py-2 text-left pr-3">Target CSAT</th>
                <th className="py-2 text-left">Business Story</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2a3a] text-[#ccccdd]">
              {[
                ['January',  '32,000', '~72%', 'Strong start — loyal post-holiday crowd'],
                ['February', '28,000', '~68%', 'Valentine\'s rush → wait time complaints spike'],
                ['March',    '35,000', '~74%', '🏆 Peak — spring menu + staff retraining'],
                ['April',    '40,000', '~59%', 'App update introduces latency bugs'],
                ['May',      '60,000', '~39%', '🔴 Crisis — app crashes go viral, volume surges'],
              ].map(([month, rec, csat, story]) => (
                <tr key={month}>
                  <td className="py-2.5 pr-3 text-white font-medium">{month}</td>
                  <td className="py-2.5 pr-3 font-mono text-emerald-300">{rec}</td>
                  <td className="py-2.5 pr-3 font-mono text-amber-300">{csat}</td>
                  <td className="py-2.5 text-[#8888aa]">{story}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 grid sm:grid-cols-2 gap-3">
          <Card>
            <div className="text-xs font-semibold text-white mb-2">6 Themes</div>
            <div className="flex flex-wrap gap-1.5">
              {['food_quality', 'wait_time', 'staff', 'cleanliness', 'price', 'app'].map(t => (
                <code key={t} className="text-[10px] bg-[#1e1e2e] text-[#a5b4fc] px-2 py-0.5 rounded">{t}</code>
              ))}
            </div>
          </Card>
          <Card>
            <div className="text-xs font-semibold text-white mb-2">4 Channels (May mix)</div>
            <div className="space-y-1">
              {[['mobile', '48%'], ['web', '28%'], ['kiosk', '12%'], ['email', '12%']].map(([c, p]) => (
                <div key={c} className="flex justify-between text-xs">
                  <span className="text-[#ccccdd]">{c}</span>
                  <span className="text-indigo-300 font-mono">{p}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </Section>

      {/* LLM Providers */}
      <Section title="Universal LLM Interface" icon={Zap}>
        <p className="mb-3">All agents use <code className="text-indigo-300 bg-indigo-500/10 px-1 rounded">providers/llm.py → get_llm()</code>. Switch provider in Admin Center — no restarts.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { name: 'Groq', note: 'Lowest latency (~400–600 tok/s). Best for demos.', model: 'llama-3.3-70b-versatile', badge: 'Recommended' },
            { name: 'Gemini', note: 'Google AI Studio key. Flash models are fast.', model: 'gemini-2.0-flash', badge: '' },
            { name: 'OpenAI', note: 'GPT-4o-mini is most cost-efficient.', model: 'gpt-4o-mini', badge: '' },
            { name: 'Anthropic', note: 'Claude models via Anthropic API.', model: 'claude-3-5-haiku', badge: '' },
          ].map(({ name, note, model, badge }) => (
            <Card key={name}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-white">{name}</span>
                {badge && <Badge color="green">{badge}</Badge>}
              </div>
              <code className="text-[10px] text-indigo-300">{model}</code>
              <p className="text-[11px] text-[#8888aa] mt-1">{note}</p>
            </Card>
          ))}
        </div>
        <Card>
          <div className="text-xs font-semibold text-white mb-2">Fallback Behaviour (rate limit / no key)</div>
          <div className="space-y-1 text-[11px] text-[#8888aa]">
            <div>① DataAgent falls back to deterministic Python — all 7 tools still work, no LLM needed</div>
            <div>② Orchestrator emits <code className="text-amber-300">llm_warning</code> SSE event</div>
            <div>③ Frontend renders amber dismissible banner. Narrative is template-generated.</div>
          </div>
        </Card>
      </Section>

      {/* API & SSE */}
      <Section title="API & Real-Time SSE" icon={Server}>
        <div className="space-y-3">
          <p>The main analyst endpoint <code className="text-indigo-300 bg-indigo-500/10 px-1 rounded">GET /stream?q=...</code> is a Server-Sent Events stream. The frontend renders each event in real-time.</p>
          <Card>
            <div className="text-xs font-semibold text-white mb-2">SSE Event Sequence</div>
            <div className="space-y-1 font-mono text-[10px]">
              {[
                ['plan', 'indigo', 'Orchestrator emits task list'],
                ['agent_start', 'indigo', 'Sub-agent begins'],
                ['tool_call', 'amber', 'DataAgent calls a tool (name + args shown)'],
                ['tool_result', 'amber', 'Tool returns result (shown in trace)'],
                ['agent_done', 'green', 'Agent returns typed result'],
                ['llm_warning', 'red', 'LLM unavailable — degraded mode active'],
                ['done', 'green', 'Final answer: narrative + metrics + visualization'],
                ['error', 'red', 'Unrecoverable failure'],
              ].map(([ev, color, desc]) => (
                <div key={ev} className="flex items-start gap-3">
                  <Badge color={color as any}>{ev}</Badge>
                  <span className="text-[#8888aa]">{desc}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </Section>

      {/* Key Design Decisions */}
      <Section title="Key Design Decisions" icon={Code2}>
        <div className="space-y-3">
          {[
            {
              decision: 'LLM orchestrates what; Python does how',
              rationale: 'The LLM picks which of 7 tools to call and with which arguments. All arithmetic is deterministic Python. This eliminates hallucinated numbers entirely — the LLM never computes math.',
            },
            {
              decision: 'period_cache in Orchestrator (30–50% token savings)',
              rationale: 'Comparison queries need DataAgent twice (A and B). A simple dict keyed by date range detects duplicates and reuses results. Significant savings on compound queries.',
            },
            {
              decision: 'Data-shape-driven visualization (zero tokens)',
              rationale: 'viz_builder.py inspects which optional fields (weekly_data, segment_data, theme_comparison_data) are populated on DataAgentResult and picks the chart. No keyword matching, no LLM call.',
            },
            {
              decision: 'Typed Pydantic schemas between every agent',
              rationale: 'Agents never pass raw strings. TaskSpec in → *AgentResult out. This prevents prompt injection, enables validation, makes the system inspectable, and guarantees serialization.',
            },
            {
              decision: 'FAISS IndexFlatL2 (not Pinecone/Qdrant)',
              rationale: 'For ~100 chunks, a flat index is faster than HNSW and has zero infrastructure. L2-normalized vectors with inner product = cosine similarity. At >1M chunks or multi-tenant at scale, a managed vector DB is the correct choice.',
            },
            {
              decision: 'all-MiniLM-L6-v2 local embeddings',
              rationale: '384-dim, runs fully on CPU, ~10ms per query. Zero API cost. 384 dimensions is sufficient for a ~100-chunk FAQ. Production: text-embedding-3-small would give better recall at minimal cost.',
            },
          ].map(({ decision, rationale }) => (
            <Card key={decision}>
              <div className="text-sm font-semibold text-white mb-1.5">{decision}</div>
              <p className="text-xs text-[#8888aa] leading-relaxed">{rationale}</p>
            </Card>
          ))}
        </div>
      </Section>

      {/* What was skipped */}
      <Section title="What Was Skipped — and Why" icon={GitCompare}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#2a2a3a] text-[#8888aa] uppercase tracking-wider">
                <th className="py-2 text-left pr-4">Feature</th>
                <th className="py-2 text-left">Reason Skipped</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2a3a] text-[#ccccdd]">
              {[
                ['Authentication / multi-tenancy', 'Demo platform — not the scope of this showcase'],
                ['BM25 hybrid retrieval', 'Dense-only + cross-encoder reranking already significantly improves precision'],
                ['PostgreSQL / MongoDB', 'JSON file sufficient at 195k records; no CRUD needed for a read-only analytics system'],
                ['LangGraph / LangChain', 'Plain Python keeps agent logic visible, debuggable, and explainable in interviews'],
                ['Async parallel agents', 'DataAgent + RAGAgent could run concurrently; serial is clearer for evaluation trace'],
                ['Fine-tuning implementation', 'Full design documented (see Fine-Tuning page); production training needs labelled dataset'],
              ].map(([feature, reason]) => (
                <tr key={feature}>
                  <td className="py-2.5 pr-4 text-white font-medium whitespace-nowrap">{feature}</td>
                  <td className="py-2.5 text-[#8888aa]">{reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Tagline */}
      <div className="rounded-2xl border border-indigo-500/20 bg-gradient-to-r from-indigo-500/5 to-purple-500/5 p-6 text-center">
        <p className="text-xl font-bold text-white italic">"Real AI decisions. Full observability. No black boxes."</p>
        <p className="text-sm text-indigo-300/70 mt-2">Every tool call, every score, every agent step — visible in the UI trace.</p>
      </div>

    </div>
  )
}
