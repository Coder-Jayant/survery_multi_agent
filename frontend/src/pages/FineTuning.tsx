import { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'
import {
  Cpu, Database, Zap, Target, TrendingUp, CheckCircle,
  GitBranch, Layers, BarChart2, AlertCircle, BookOpen, ArrowRight
} from 'lucide-react'
import { cn } from '@/lib/utils'

mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  themeVariables: {
    primaryColor: '#1a1a2e',
    primaryTextColor: '#e2e8f0',
    primaryBorderColor: '#4f46e5',
    lineColor: '#6366f1',
    secondaryColor: '#0f172a',
    tertiaryColor: '#1e1e2e',
    background: '#0a0a0f',
    mainBkg: '#12121a',
    nodeBorder: '#4f46e5',
    clusterBkg: '#0f0f1a',
    titleColor: '#e2e8f0',
    edgeLabelBackground: '#1a1a2e',
    fontFamily: 'Inter, sans-serif',
    fontSize: '13px',
  },
})

const PIPELINE_DIAGRAM = `flowchart LR
  classDef data fill:#1a2e1a,stroke:#22c55e,color:#86efac
  classDef process fill:#1a1a2e,stroke:#6366f1,color:#a5b4fc
  classDef model fill:#2e1a1a,stroke:#f59e0b,color:#fde68a
  classDef output fill:#1a2a2e,stroke:#06b6d4,color:#67e8f9

  A[("Survey<br/>Responses<br/>60K+")]:::data
  B["Label<br/>Pipeline"]:::process
  C[("Training<br/>Dataset<br/>JSONL")]:::data
  D["LoRA / QLoRA<br/>Training"]:::process
  E["Base LLM<br/>Llama / Mistral"]:::model
  F["Fine-Tuned<br/>Model"]:::model
  G["Theme<br/>Classifier"]:::output
  H["Sentiment<br/>Analyser"]:::output
  I["Narrative<br/>Generator"]:::output

  A --> B
  B --> C
  C --> D
  E --> D
  D --> F
  F --> G
  F --> H
  F --> I`

const COMPARISON_ROWS = [
  { metric: 'Theme classification accuracy', base: '71%', finetuned: '91%', delta: '+20%', better: true },
  { metric: 'Sentiment alignment with human labels', base: '78%', finetuned: '93%', delta: '+15%', better: true },
  { metric: 'Domain terminology recognition', base: 'Low', finetuned: 'High', delta: '—', better: true },
  { metric: 'Hallucination rate on FAQs', base: '12%', finetuned: '3%', delta: '-9%', better: true },
  { metric: 'Narrative tone consistency', base: 'Generic', finetuned: 'Brand-aligned', delta: '—', better: true },
  { metric: 'Avg inference latency', base: '320ms', finetuned: '340ms', delta: '+20ms', better: false },
]

const TRAINING_TASKS = [
  {
    icon: Target,
    color: 'indigo',
    title: 'Theme Classification',
    desc: 'Classify free-text feedback into themes: food_quality, wait_time, app_experience, service, ambiance, pricing. Base models misclassify ~29% of ambiguous responses.',
    data: '~48K labelled examples from survey_responses.json',
  },
  {
    icon: TrendingUp,
    color: 'emerald',
    title: 'Sentiment Analysis',
    desc: 'Domain-calibrated sentiment scoring — distinguishing "the wait was worth it" (positive) from "the wait was acceptable" (neutral) in a restaurant context.',
    data: '~60K examples with 1–5 star labels as weak supervision',
  },
  {
    icon: BookOpen,
    color: 'purple',
    title: 'Narrative Generation',
    desc: 'Generate executive-style business narratives from structured metrics. Fine-tuning teaches tone consistency, GreenLeaf brand voice, and metric citation format.',
    data: '~2K manually curated narrative examples',
  },
  {
    icon: GitBranch,
    color: 'amber',
    title: 'FAQ Answering',
    desc: 'Adapt the model to answer domain-specific questions about GreenLeaf Bistro using the FAQ knowledge base — reducing hallucination on policy questions.',
    data: '100+ FAQ pairs from faq_document.txt as instruction tuning',
  },
]

function MermaidChart({ id, chart }: { id: string; chart: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [svg, setSvg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    const uid = `${id}-${Math.random().toString(36).slice(2)}`
    mermaid.render(uid, chart)
      .then(r => setSvg(r.svg))
      .catch(e => setErr(String(e)))
  }, [chart, id])

  if (err) return <div className="text-red-400 text-xs p-4">{err}</div>
  if (!svg) return <div className="text-[#8888aa] text-xs p-4 animate-pulse">Rendering diagram…</div>
  return <div ref={ref} className="w-full overflow-x-auto" dangerouslySetInnerHTML={{ __html: svg }} />
}

const COLOR_MAP: Record<string, string> = {
  indigo: 'border-indigo-500/30 bg-indigo-500/5',
  emerald: 'border-emerald-500/30 bg-emerald-500/5',
  purple: 'border-purple-500/30 bg-purple-500/5',
  amber: 'border-amber-500/30 bg-amber-500/5',
}
const ICON_COLOR: Record<string, string> = {
  indigo: 'text-indigo-400',
  emerald: 'text-emerald-400',
  purple: 'text-purple-400',
  amber: 'text-amber-400',
}

export function FineTuning() {
  return (
    <div className="p-6 max-w-5xl space-y-8 animate-fade-in">

      {/* Header */}
      <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/5 to-[#12121a] p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
            <Cpu className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">Fine-Tuning Use Case</h1>
            <p className="text-amber-400/80 text-sm font-medium mt-0.5">Domain adaptation for GreenLeaf Bistro customer intelligence</p>
            <p className="text-sm text-[#9999bb] leading-relaxed mt-2 max-w-2xl">
              MiniSense currently uses general-purpose LLMs (Groq / Gemini) for theme classification, narrative generation, and FAQ answering.
              Fine-tuning a smaller model on domain-specific data would deliver higher accuracy, lower latency, reduced API costs, and brand-consistent outputs.
              This page outlines the full fine-tuning strategy as it applies to this platform.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {['LoRA', 'QLoRA', 'Llama-3', 'Mistral-7B', 'PEFT', 'Hugging Face', 'XTTS v2', 'Supervised Fine-Tuning'].map(t => (
            <span key={t} className="text-[10px] px-2 py-0.5 rounded border border-amber-500/25 bg-amber-500/10 text-amber-400 font-medium">{t}</span>
          ))}
        </div>
      </div>

      {/* Why Fine-Tune */}
      <div>
        <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400" />
          Why Fine-Tune Instead of Prompting?
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: Target, color: 'amber', title: 'Domain Vocabulary', desc: 'General LLMs misclassify restaurant-domain terminology. Fine-tuning embeds GreenLeaf-specific jargon, menu items, and service concepts.' },
            { icon: Zap, color: 'emerald', title: 'Latency & Cost', desc: 'A fine-tuned 7B model runs locally on GPU with ~50ms latency and zero API cost — vs 300ms+ and per-token charges for cloud LLMs.' },
            { icon: Layers, color: 'indigo', title: 'Consistency', desc: 'Prompt engineering produces variable outputs. Fine-tuning locks in tone, format, and citation style — critical for automated executive reports.' },
          ].map(({ icon: Icon, color, title, desc }) => (
            <div key={title} className={cn('rounded-xl border p-4', COLOR_MAP[color])}>
              <div className="flex items-center gap-2 mb-2">
                <Icon className={cn('w-4 h-4', ICON_COLOR[color])} />
                <span className="text-sm font-semibold text-white">{title}</span>
              </div>
              <p className="text-xs text-[#9999bb] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Pipeline Diagram */}
      <div>
        <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <Database className="w-4 h-4 text-indigo-400" />
          Fine-Tuning Pipeline
        </h2>
        <div className="rounded-xl border border-[#2a2a3a] bg-[#0e0e16] p-4">
          <MermaidChart id="ft-pipeline" chart={PIPELINE_DIAGRAM} />
        </div>
      </div>

      {/* Training Tasks */}
      <div>
        <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <Layers className="w-4 h-4 text-purple-400" />
          Training Tasks
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {TRAINING_TASKS.map(({ icon: Icon, color, title, desc, data }) => (
            <div key={title} className={cn('rounded-xl border p-5 space-y-3', COLOR_MAP[color])}>
              <div className="flex items-start gap-3">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', `bg-${color}-500/15 border border-${color}-500/30`)}>
                  <Icon className={cn('w-4 h-4', ICON_COLOR[color])} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="text-xs text-[#9999bb] leading-relaxed mt-1">{desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#7777aa] border-t border-[#2a2a3a] pt-2">
                <Database className="w-3 h-3 flex-shrink-0" />
                <span>{data}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Technical Approach */}
      <div>
        <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <Cpu className="w-4 h-4 text-emerald-400" />
          Technical Approach
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl border border-[#2a2a3a] bg-[#12121a] p-5 space-y-3">
            <p className="text-sm font-semibold text-white">Method: QLoRA (4-bit)</p>
            <div className="space-y-2 text-xs text-[#9999bb]">
              {[
                'Base model: Llama-3-8B-Instruct or Mistral-7B-v0.3',
                'Quantization: bitsandbytes 4-bit NF4',
                'Adapter rank: r=16, alpha=32, dropout=0.05',
                'Target modules: q_proj, v_proj, k_proj, o_proj',
                'Training: 3 epochs, lr=2e-4, batch=4, grad_accum=4',
                'Hardware: Single A100 40GB or RTX 4090 (~4h)',
              ].map(l => (
                <div key={l} className="flex items-start gap-2">
                  <ArrowRight className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span>{l}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-[#2a2a3a] bg-[#12121a] p-5 space-y-3">
            <p className="text-sm font-semibold text-white">Serving: vLLM + KServe</p>
            <div className="space-y-2 text-xs text-[#9999bb]">
              {[
                'Merge LoRA adapter into base weights for production',
                'Serve via vLLM with tensor parallelism on GPU cluster',
                'Deploy as KServe InferenceService on Kubernetes',
                'OpenAI-compatible API endpoint — zero code change in MiniSense',
                'A/B testing: route 10% traffic to fine-tuned, monitor metrics',
                'Rollback: revert to cloud LLM if fine-tuned degrades',
              ].map(l => (
                <div key={l} className="flex items-start gap-2">
                  <ArrowRight className="w-3 h-3 text-indigo-400 flex-shrink-0 mt-0.5" />
                  <span>{l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Performance Comparison */}
      <div>
        <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-cyan-400" />
          Expected Performance (Base vs Fine-Tuned)
        </h2>
        <div className="rounded-xl border border-[#2a2a3a] bg-[#12121a] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2a2a3a] bg-[#0e0e16]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#8888aa] uppercase tracking-wider">Metric</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-[#8888aa] uppercase tracking-wider">Base LLM</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-[#8888aa] uppercase tracking-wider">Fine-Tuned</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-[#8888aa] uppercase tracking-wider">Delta</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row, i) => (
                <tr key={i} className={cn('border-b border-[#2a2a3a]/50', i % 2 === 0 ? 'bg-[#12121a]' : 'bg-[#0e0e16]')}>
                  <td className="px-4 py-3 text-[#ccccdd] text-xs">{row.metric}</td>
                  <td className="px-4 py-3 text-center text-xs text-[#8888aa] font-mono">{row.base}</td>
                  <td className="px-4 py-3 text-center text-xs text-emerald-400 font-mono font-semibold">{row.finetuned}</td>
                  <td className="px-4 py-3 text-center">
                    {row.delta !== '—' ? (
                      <span className={cn('text-xs font-mono font-semibold', row.better ? 'text-emerald-400' : 'text-amber-400')}>
                        {row.better ? <CheckCircle className="w-3 h-3 inline mr-1" /> : null}{row.delta}
                      </span>
                    ) : (
                      <span className="text-xs text-emerald-400 font-semibold">✓ Improved</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-[#6666888] mt-2">* Figures are estimates based on literature benchmarks for similar domain-adaptation tasks. Actual results depend on dataset quality and training configuration.</p>
      </div>

      {/* Integration with MiniSense */}
      <div className="rounded-xl border border-indigo-500/25 bg-indigo-500/5 p-5">
        <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-indigo-400" />
          Integration with MiniSense (Zero Code Change)
        </h2>
        <p className="text-sm text-[#9999bb] leading-relaxed mb-3">
          MiniSense uses an OpenAI-compatible provider abstraction (<code className="text-indigo-300 text-xs">providers/llm.py</code>).
          Switching from Groq to a self-hosted fine-tuned model requires only changing the base URL and model name in Admin Center — no agent code changes.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          {[
            { step: '1', label: 'Set base_url to vLLM endpoint', note: 'Admin Center → Provider → Custom' },
            { step: '2', label: 'Set model to fine-tuned model name', note: 'e.g. greenleaf-llama-3-8b' },
            { step: '3', label: 'All agents use the fine-tuned model', note: 'DataAgent, RAGAgent, SummaryAgent' },
          ].map(({ step, label, note }) => (
            <div key={step} className="rounded-lg border border-indigo-500/20 bg-[#12121a] p-3">
              <div className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 text-xs font-bold flex items-center justify-center mb-2">{step}</div>
              <p className="text-white font-medium">{label}</p>
              <p className="text-[#8888aa] mt-0.5">{note}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
