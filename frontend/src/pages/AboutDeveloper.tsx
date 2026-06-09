import { ExternalLink, GitBranch, Link2, Globe, Code2, Brain, Database, Cpu } from 'lucide-react'

const SKILLS = [
  { icon: Brain, label: 'Machine Learning', items: ['LLMs', 'Fine-tuning (LoRA)', 'RAG pipelines', 'Agent systems'] },
  { icon: Code2, label: 'Engineering', items: ['Python', 'FastAPI', 'TypeScript', 'React'] },
  { icon: Database, label: 'Data & Infra', items: ['FAISS', 'Vector DBs', 'SQL', 'JSON pipelines'] },
  { icon: Cpu, label: 'AI Frameworks', items: ['Groq', 'OpenAI', 'Sentence Transformers', 'vLLM'] },
]

export function AboutDeveloper() {
  return (
    <div className="p-6 max-w-3xl space-y-8 animate-fade-in">
      {/* Hero */}
      <div className="rounded-2xl border border-[#2a2a3a] bg-[#12121a] p-8 text-center space-y-4">
        <div className="w-20 h-20 rounded-full bg-indigo-500/20 border-2 border-indigo-500/40 flex items-center justify-center mx-auto">
          <span className="text-2xl font-bold text-indigo-300">JV</span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Jayant Verma</h1>
          <p className="text-indigo-400 font-medium mt-1">AI / ML Engineer</p>
        </div>
        <p className="text-sm text-[#8888aa] leading-relaxed max-w-xl mx-auto">
          Building production-grade AI systems that combine agentic reasoning, retrieval-augmented generation,
          and full observability. Focused on making AI decisions transparent and explainable.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <a
            href="https://jvt.connect-jv-dev.workers.dev/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/25 transition-all text-sm font-medium"
          >
            <Globe className="w-4 h-4" />
            Portfolio
            <ExternalLink className="w-3 h-3" />
          </a>
          <a
            href="https://github.com/jayantverma"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#2a2a3a] text-[#8888aa] hover:text-white hover:border-[#3a3a50] bg-[#1a1a26] transition-all text-sm"
          >
            <GitBranch className="w-4 h-4" />
            GitHub
          </a>
          <a
            href="https://linkedin.com/in/jayantverma"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#2a2a3a] text-[#8888aa] hover:text-white hover:border-[#3a3a50] bg-[#1a1a26] transition-all text-sm"
          >
            <Link2 className="w-4 h-4" />
            LinkedIn
          </a>
        </div>
      </div>

      {/* Skills */}
      <div>
        <h2 className="text-base font-bold text-white mb-4">Skills & Expertise</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {SKILLS.map(({ icon: Icon, label, items }) => (
            <div key={label} className="rounded-xl border border-[#2a2a3a] bg-[#12121a] p-4">
              <div className="flex items-center gap-2 mb-3">
                <Icon className="w-4 h-4 text-indigo-400" />
                <span className="text-sm font-semibold text-white">{label}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {items.map(item => (
                  <span
                    key={item}
                    className="text-xs px-2.5 py-1 rounded-full bg-[#1a1a26] border border-[#2a2a3a] text-[#8888aa]"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* This Project */}
      <div>
        <h2 className="text-base font-bold text-white mb-4">This Project</h2>
        <div className="rounded-xl border border-indigo-500/25 bg-indigo-500/5 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-indigo-400" />
            <span className="text-sm font-semibold text-white">MiniSense — Multi-Agent Customer Intelligence Platform</span>
          </div>
          <p className="text-sm text-[#8888aa] leading-relaxed">
            Demonstrates end-to-end agentic AI: Orchestrator plans via LLM function-calling, DataAgent computes
            exact metrics via tool-calling, RAGAgent retrieves relevant policy context from FAISS,
            ComparisonAgent identifies temporal shifts, and SummaryAgent synthesizes everything into a coherent
            business narrative — all with full SSE streaming and observability.
          </p>
          <div className="flex flex-wrap gap-2">
            {['Multi-Agent', 'RAG', 'FAISS', 'Groq', 'FastAPI', 'React', 'TypeScript', 'Tailwind', 'React Flow', 'Recharts'].map(tag => (
              <span key={tag} className="text-[10px] px-2 py-0.5 rounded border border-indigo-500/25 bg-indigo-500/10 text-indigo-400 font-medium">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
