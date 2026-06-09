import { useEffect, useRef } from 'react'
import mermaid from 'mermaid'
import {
  Database, Cpu, GitBranch, BarChart2, Server, Layers,
  ArrowRight, Tag
} from 'lucide-react'
import { cn } from '@/lib/utils'

const PIPELINE_DIAGRAM = `flowchart TB
  classDef load fill:#1a2e1a,stroke:#22c55e,color:#86efac
  classDef data fill:#1a1a2e,stroke:#6366f1,color:#a5b4fc
  classDef train fill:#2e1a1a,stroke:#f59e0b,color:#fde68a
  classDef eval fill:#2d1b4e,stroke:#a855f7,color:#d8b4fe
  classDef serve fill:#1a2a2e,stroke:#06b6d4,color:#67e8f9
  classDef out fill:#1e3a5f,stroke:#3b82f6,color:#93c5fd

  subgraph Load["Production"]
    IN["10k survey responses / day\nfree-text input"]:::load
  end

  subgraph Data["① Data Strategy"]
    AUTO["GPT-4o / Gemini\nauto-label 8 classes"]:::data
    QC["Human review\n10–15% sample"]:::data
    DS["20k–50k labelled JSONL\n{input, output, metadata}"]:::data
  end

  subgraph Train["②③ Train & Register"]
    QL["QLoRA on Llama 3 8B\nNF4 + PEFT"]:::train
    REG["Model Registry\nsurvey-classifier-v1"]:::train
  end

  subgraph EvalGate["④ Evaluation"]
    MET["Macro F1 vs GPT-4o\ncost + latency check"]:::eval
  end

  subgraph VLLM["⑤ Serve — vLLM + LoRA"]
    BASE["Base model\nLlama-3-8B-Instruct"]:::serve
    ADP["LoRA adapters\nper-request, versioned"]:::serve
    ROUTE["Classification route only\nother LLM routes unchanged"]:::serve
  end

  OUT["8-class label\nper response"]:::out

  IN --> AUTO --> QC --> DS
  DS --> QL --> REG --> MET
  MET -->|pass| ADP
  IN -->|live inference| BASE
  BASE --> ADP --> ROUTE --> OUT`

const CATEGORIES = [
  'Positive – Food Quality', 'Negative – Food Quality',
  'Positive – Wait Time', 'Negative – Wait Time',
  'Neutral – Staff', 'Positive – Staff',
  'Negative – App Experience', 'Neutral – Pricing',
]

function PipelineDiagram() {
  const ref = useRef<HTMLDivElement>(null)
  const renderId = useRef(0)

  useEffect(() => {
    let cancelled = false
    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      themeVariables: {
        background: '#0e0e16',
        primaryColor: '#1a1a3a',
        primaryTextColor: '#e2e2f0',
        primaryBorderColor: '#f59e0b',
        edgeLabelBackground: '#12121a',
        lineColor: '#6366f1',
        clusterBkg: '#0f0f1a',
        clusterBorder: '#2a2a3a',
        fontFamily: 'Inter, sans-serif',
        fontSize: '12px',
      },
    })

    async function render() {
      try {
        renderId.current += 1
        const id = `ft-pipeline-${renderId.current}`
        const { svg } = await mermaid.render(id, PIPELINE_DIAGRAM)
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg
          const svgEl = ref.current.querySelector('svg')
          if (svgEl) {
            svgEl.style.maxWidth = '100%'
            svgEl.style.height = 'auto'
          }
        }
      } catch {
        if (!cancelled && ref.current) {
          ref.current.innerHTML = '<p class="text-xs text-[#8888aa] text-center py-4">Diagram loading…</p>'
        }
      }
    }
    render()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="rounded-xl border border-amber-500/20 bg-[#0e0e16] p-4 overflow-x-auto">
      <p className="text-[10px] font-semibold text-amber-400/70 uppercase tracking-widest mb-3 text-center">
        End-to-End Pipeline
      </p>
      <div ref={ref} className="flex justify-center [&_svg]:max-w-full" />
    </div>
  )
}

const SERVING_CONTENT = (
  <div className="space-y-3 text-sm text-[#9999bb] leading-relaxed">
    <p>
      QLoRA training produces a small <strong className="text-white">PEFT adapter</strong> (~10–50 MB) —
      not a full model copy. Register it in a model registry with a version tag (e.g.{' '}
      <code className="text-cyan-300 text-xs">survey-classifier-v1.0</code>) and deploy to{' '}
      <strong className="text-cyan-300">vLLM</strong> alongside the base weights.
    </p>

    <div className="rounded-lg border border-cyan-500/20 bg-[#0a0a12] p-3 space-y-2">
      <p className="text-xs text-cyan-300 font-semibold">vLLM LoRA serving (per-request, minimal overhead)</p>
      <pre className="text-[10px] font-mono text-[#8888aa] overflow-x-auto leading-relaxed">
{`# Start OpenAI-compatible server with adapters
vllm serve meta-llama/Llama-3-8B-Instruct \\
  --enable-lora \\
  --lora-modules survey-v1=/registry/survey-classifier-v1 \\
               survey-v2=/registry/survey-classifier-v2

# Per-request: select adapter by name + version ID
LoRARequest("survey-v1", adapter_id=1, path="/registry/...")`}
      </pre>
      <ul className="space-y-1 text-xs">
        {[
          'Multiple adapter versions coexist — swap or rollback without redeploying the base model',
          'GET /models lists base model + all mounted LoRA modules',
          'Classification requests pass lora_request; Orchestrator/RAG/Summary routes use base model unchanged',
        ].map(item => (
          <li key={item} className="flex gap-2">
            <ArrowRight className="w-3 h-3 text-cyan-400 shrink-0 mt-0.5" />
            {item}
          </li>
        ))}
      </ul>
    </div>

    <p className="text-xs">
      MiniSense routes classification through the existing OpenAI-compatible abstraction (
      <code className="text-cyan-300">providers/llm.py</code>) — point one endpoint at vLLM,
      keep Groq/Gemini for all other agents.
    </p>

    <ol className="space-y-1.5 text-xs list-none">
      {[
        'A/B: route 5–10% traffic to survey-v1 adapter vs GPT-4o baseline',
        'Monitor Macro F1, latency (p50/p95), and error rate in production',
        'Promote survey-v2 adapter when it beats v1 on eval — old adapter stays mounted for instant rollback',
        'Ramp to 100% over 1–2 weeks; rollback = change routing weight, not redeploy',
      ].map((step, i) => (
        <li key={i} className="flex gap-2">
          <span className="text-cyan-400 font-mono shrink-0">{i + 1}.</span>
          {step}
        </li>
      ))}
    </ol>
  </div>
)

const SECTIONS = [
  {
    id: 'data',
    num: 1,
    title: 'Data Strategy',
    icon: Database,
    color: 'emerald',
    content: (
      <div className="space-y-3 text-sm text-[#9999bb] leading-relaxed">
        <p>
          <strong className="text-white">Problem:</strong> omniSense processes ~10,000 free-text survey responses/day.
          Each must be classified into one of <strong className="text-emerald-300">8 sentiment + topic categories</strong>.
        </p>
        <ol className="space-y-2 list-none">
          {[
            'Sample historical responses (stratified by channel, rating, and length).',
            'Use GPT-4o or Gemini as a labeler with a strict 8-class prompt and 2–3 few-shot examples per class.',
            'Human review on 10–15% of labels — focus on ambiguous or multi-topic responses.',
            'Balance classes via oversampling underrepresented categories; drop noisy or contradictory labels.',
            'Store as JSONL: { "input": "<free_text>", "output": "<category>", "metadata": {...} }.',
          ].map((step, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-emerald-400 font-mono text-xs shrink-0">{i + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-300">
          <strong>Estimate:</strong> 20k–50k labelled examples sufficient for a strong initial classifier.
        </p>
      </div>
    ),
  },
  {
    id: 'model',
    num: 2,
    title: 'Model & Technique Selection',
    icon: Cpu,
    color: 'amber',
    content: (
      <div className="space-y-3 text-sm text-[#9999bb] leading-relaxed">
        <p>
          <strong className="text-white">Base model:</strong>{' '}
          <span className="text-amber-300">Llama 3 8B Instruct</span> (primary).
          <span className="text-[#8888aa]"> Mistral 7B Instruct</span> as alternative if already in the serving stack.
        </p>
        <p>
          <strong className="text-white">Technique:</strong>{' '}
          <span className="text-amber-300">QLoRA</span> — NF4 quantization + PEFT LoRA adapters.
          Strong quality at a fraction of full fine-tuning GPU cost; ideal for fixed 8-class classification.
        </p>
        <ul className="space-y-1.5 text-xs">
          {[
            'NF4 (bitsandbytes) — train on a single 24GB GPU',
            'PEFT adapter ~10–50 MB — version, store, and hot-swap independently of base weights',
            'Full FT rejected: 4× GPU cost, harder rollback, overkill for classification',
          ].map(item => (
            <li key={item} className="flex gap-2">
              <ArrowRight className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    ),
  },
  {
    id: 'pipeline',
    num: 3,
    title: 'Training Pipeline',
    icon: GitBranch,
    color: 'indigo',
    content: (
      <div className="space-y-3 text-sm text-[#9999bb] leading-relaxed">
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
          {['Dataset', 'Train/Val/Test Split', 'QLoRA Training', 'Evaluation', 'Model Registry'].map((step, i, arr) => (
            <span key={step} className="flex items-center gap-1.5">
              <span className="px-2 py-1 rounded border border-indigo-500/30 bg-indigo-500/10 text-indigo-300">{step}</span>
              {i < arr.length - 1 && <ArrowRight className="w-3 h-3 text-[#5555777]" />}
            </span>
          ))}
        </div>
        <p>
          <strong className="text-white">Tooling:</strong> Hugging Face{' '}
          <code className="text-indigo-300 text-xs">datasets</code>,{' '}
          <code className="text-indigo-300 text-xs">transformers</code>,{' '}
          <code className="text-indigo-300 text-xs">peft</code>,{' '}
          <code className="text-indigo-300 text-xs">trl</code> (SFTTrainer).
        </p>
        <p className="text-xs">
          80/10/10 split. Train 2–3 epochs, early stop on validation Macro F1.
          Export adapter to registry as <code className="text-indigo-300">survey-classifier-vX</code> — ready for vLLM mount.
        </p>
      </div>
    ),
  },
  {
    id: 'eval',
    num: 4,
    title: 'Evaluation',
    icon: BarChart2,
    color: 'purple',
    content: (
      <div className="space-y-3 text-sm text-[#9999bb] leading-relaxed">
        <div className="flex flex-wrap gap-1.5">
          {['Accuracy', 'Precision', 'Recall', 'F1', 'Macro F1'].map(m => (
            <span key={m} className="text-[10px] px-2 py-0.5 rounded border border-purple-500/25 bg-purple-500/10 text-purple-300 font-mono">{m}</span>
          ))}
        </div>
        <ul className="space-y-1.5 text-xs">
          {[
            'Primary gate: Macro F1 on held-out human-labelled test set',
            'Compare against GPT-4o labels on the same test set (within ~2–3 pts Macro F1)',
            'Per-class precision/recall + confusion matrix',
            'Track cost per 10k responses and p50/p95 latency vs frontier model',
          ].map(item => (
            <li key={item} className="flex gap-2">
              <ArrowRight className="w-3 h-3 text-purple-400 shrink-0 mt-0.5" />
              {item}
            </li>
          ))}
        </ul>
        <p className="rounded-lg border border-purple-500/20 bg-purple-500/5 px-3 py-2 text-xs text-purple-300">
          <strong>Production-ready when:</strong> quality ≈ GPT-4o at 10–20× lower inference cost.
        </p>
      </div>
    ),
  },
  {
    id: 'serving',
    num: 5,
    title: 'Serving',
    icon: Server,
    color: 'cyan',
    content: SERVING_CONTENT,
  },
  {
    id: 'future',
    num: 6,
    title: 'Future Proofing',
    icon: Layers,
    color: 'rose',
    content: (
      <div className="space-y-3 text-sm text-[#9999bb] leading-relaxed">
        <p>All training data follows a <strong className="text-white">domain-agnostic schema</strong>:</p>
        <pre className="rounded-lg border border-[#2a2a3a] bg-[#0e0e16] p-3 text-xs font-mono text-rose-300 overflow-x-auto">
{`{ "input": "<free_text>", "output": "<category>", "metadata": {...} }`}
        </pre>
        <p className="text-xs">
          Label set is config-driven (YAML/JSON). Same pipeline works for restaurants, telecom, healthcare,
          e-commerce, and support — only categories and labeler prompt change. Training and serving never
          depend on a specific survey schema.
        </p>
      </div>
    ),
  },
]

const COLOR: Record<string, string> = {
  emerald: 'border-emerald-500/25 bg-emerald-500/5',
  amber: 'border-amber-500/25 bg-amber-500/5',
  indigo: 'border-indigo-500/25 bg-indigo-500/5',
  purple: 'border-purple-500/25 bg-purple-500/5',
  cyan: 'border-cyan-500/25 bg-cyan-500/5',
  rose: 'border-rose-500/25 bg-rose-500/5',
}
const ICON: Record<string, string> = {
  emerald: 'text-emerald-400', amber: 'text-amber-400', indigo: 'text-indigo-400',
  purple: 'text-purple-400', cyan: 'text-cyan-400', rose: 'text-rose-400',
}

export function FineTuning() {
  return (
    <div className="p-6 max-w-3xl space-y-6 animate-fade-in">

      <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-[#12121a] p-6">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Tag className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-amber-400/70 uppercase tracking-widest mb-1">Part 3 — Assignment</p>
            <h1 className="text-lg font-black text-white">Fine-Tuning Design</h1>
            <p className="text-sm text-[#9999bb] mt-1.5 leading-relaxed">
              Classify 10,000 survey responses/day into 8 sentiment + topic categories —
              replacing GPT-4o at scale with a cost-efficient fine-tuned model.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {CATEGORIES.map(c => (
            <span key={c} className="text-[10px] px-2 py-0.5 rounded border border-amber-500/20 bg-amber-500/8 text-amber-300/80">{c}</span>
          ))}
        </div>
      </div>

      <PipelineDiagram />

      {SECTIONS.map(({ id, num, title, icon: Icon, color, content }) => (
        <div key={id} className={cn('rounded-xl border p-5', COLOR[color])}>
          <div className="flex items-center gap-2.5 mb-4">
            <span className="w-6 h-6 rounded-full bg-[#1a1a26] border border-[#2a2a3a] flex items-center justify-center text-xs font-bold text-[#8888aa]">{num}</span>
            <Icon className={cn('w-4 h-4', ICON[color])} />
            <h2 className="text-sm font-bold text-white">{title}</h2>
          </div>
          {content}
        </div>
      ))}

      <p className="text-[11px] text-[#5555777] text-center pb-2">
        Full write-up also in README.md § Part 3 — Fine-Tuning Design
      </p>
    </div>
  )
}
