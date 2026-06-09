import { ExternalLink, GitBranch, Globe, Code2, Brain, Database, Cpu, Mic, Server, Mail, MapPin, Layers, Zap } from 'lucide-react'

const EXPERTISE = [
  {
    icon: Brain,
    label: 'Agentic AI',
    color: 'indigo',
    items: ['Multi-agent workflows', 'LangGraph', 'ReAct reasoning', 'Tool calling', 'Human-in-the-loop', 'Agent observability', 'MCP integrations', 'Autonomous workflows'],
  },
  {
    icon: Database,
    label: 'RAG & Retrieval',
    color: 'purple',
    items: ['FAISS / Vector DBs', 'Hybrid retrieval', 'Cross-encoder reranking', 'Chunking strategies', 'Metadata filtering', 'Retrieval evaluation', 'Enterprise knowledge bases'],
  },
  {
    icon: Server,
    label: 'LLM Infrastructure',
    color: 'emerald',
    items: ['vLLM', 'KServe', 'Ray Serve', 'Kubernetes', 'GPU optimization', 'Distributed inference', 'Llama / Mistral / Whisper'],
  },
  {
    icon: Mic,
    label: 'Voice AI',
    color: 'rose',
    items: ['Telephonic AI agents', 'Whisper ASR', 'XTTS v2 TTS', 'Real-time pipelines', 'Asterisk PBX', 'Low-latency voice', 'Multilingual speech'],
  },
  {
    icon: Layers,
    label: 'AI Platforms',
    color: 'amber',
    items: ['AI observability', 'LLMOps', 'Model lifecycle mgmt', 'Evaluation systems', 'Developer tooling', 'Agent infrastructure', 'Fine-tuning pipelines'],
  },
  {
    icon: Code2,
    label: 'Engineering',
    color: 'cyan',
    items: ['Python', 'FastAPI', 'TypeScript / React', 'Docker', 'Linux', 'MongoDB', 'SQL', 'S3-compatible storage'],
  },
]

const PROJECTS = [
  {
    title: 'Enterprise Multi-Agent AI Platform',
    desc: 'Production platform with multi-agent workflows, ReAct reasoning, human-in-the-loop controls, persistent state management, and real-time streaming for enterprise clients.',
    tags: ['Multi-agent', 'LangGraph', 'ReAct', 'Streaming', 'Enterprise'],
  },
  {
    title: 'Telephonic Voice AI Agent',
    desc: 'Real-time voice system integrating Whisper ASR, LLM reasoning with tool calling, FAISS retrieval, XTTS TTS, and Asterisk PBX telephony for automated customer conversations.',
    tags: ['Voice AI', 'Whisper', 'XTTS', 'Asterisk', 'Real-time'],
  },
  {
    title: 'LLM Infrastructure Platform',
    desc: 'Kubernetes-based platform for serving, fine-tuning, and operating LLMs at scale with vLLM, KServe, Ray Serve, and GPU utilization dashboards.',
    tags: ['vLLM', 'KServe', 'Kubernetes', 'GPU', 'Ray Serve'],
  },
  {
    title: 'MiniSense (This Project)',
    desc: 'CTO-demo-quality multi-agent platform demonstrating agent orchestration, RAG with reranking, survey analytics, AI observability, and SSE-streamed reasoning traces.',
    tags: ['Orchestrator', 'RAG', 'FAISS', 'FastAPI', 'React', 'SSE'],
    highlight: true,
  },
]

const COLOR_MAP: Record<string, string> = {
  indigo: 'bg-indigo-500/10 border-indigo-500/25 text-indigo-400',
  purple: 'bg-purple-500/10 border-purple-500/25 text-purple-400',
  emerald: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400',
  rose: 'bg-rose-500/10 border-rose-500/25 text-rose-400',
  amber: 'bg-amber-500/10 border-amber-500/25 text-amber-400',
  cyan: 'bg-cyan-500/10 border-cyan-500/25 text-cyan-400',
}

const ICON_COLOR_MAP: Record<string, string> = {
  indigo: 'text-indigo-400',
  purple: 'text-purple-400',
  emerald: 'text-emerald-400',
  rose: 'text-rose-400',
  amber: 'text-amber-400',
  cyan: 'text-cyan-400',
}

export function AboutDeveloper() {
  return (
    <div className="p-6 max-w-4xl space-y-8 animate-fade-in">

      {/* Hero */}
      <div className="rounded-2xl border border-[#2a2a3a] bg-gradient-to-br from-[#12121a] to-[#0e0e1a] p-8 text-center space-y-4">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500/30 to-purple-500/20 border-2 border-indigo-500/50 flex items-center justify-center mx-auto shadow-lg shadow-indigo-500/10">
          <span className="text-3xl font-black text-indigo-300">JV</span>
        </div>
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Jayant Verma</h1>
          <p className="text-indigo-400 font-semibold mt-1 text-base">AI / ML Engineer</p>
          <div className="flex items-center justify-center gap-3 mt-2 text-xs text-[#6666888]">
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> Noida, India</span>
            <span className="text-[#3a3a50]">•</span>
            <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-amber-400" /> Cyfuture India Pvt. Ltd. — Aug 2024–Present</span>
          </div>
        </div>

        <p className="text-sm text-[#9999bb] leading-relaxed max-w-2xl mx-auto">
          AI/ML Engineer specializing in <span className="text-indigo-300 font-medium">Agentic AI</span>,{' '}
          <span className="text-purple-300 font-medium">RAG pipelines</span>,{' '}
          <span className="text-emerald-300 font-medium">LLM infrastructure</span>, and{' '}
          <span className="text-rose-300 font-medium">Voice AI</span>.
          Core member of Cyfuture's AI team — building production AI systems, not research prototypes.
          Focused on enterprise AI platforms, multi-agent architectures, model serving, and AI observability.
        </p>

        <div className="flex items-center justify-center gap-3 flex-wrap pt-2">
          <a
            href="https://jvt.connect-jv-dev.workers.dev/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500/15 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/25 transition-all text-sm font-semibold"
          >
            <Globe className="w-4 h-4" />
            Portfolio
            <ExternalLink className="w-3 h-3" />
          </a>
          <a
            href="https://github.com/Coder-Jayant"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#2a2a3a] text-[#9999bb] hover:text-white hover:border-[#3a3a50] bg-[#1a1a26] transition-all text-sm"
          >
            <GitBranch className="w-4 h-4" />
            GitHub
          </a>
          <a
            href="mailto:jayantmailac@gmail.com"
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#2a2a3a] text-[#9999bb] hover:text-white hover:border-[#3a3a50] bg-[#1a1a26] transition-all text-sm"
          >
            <Mail className="w-4 h-4" />
            jayantmailac@gmail.com
          </a>
        </div>
      </div>

      {/* Experience Badge */}
      <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-5 flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
          <Zap className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-white">AI/ML Engineer — Cyfuture India Pvt. Ltd.</p>
          <p className="text-xs text-amber-400/80 mt-0.5">August 2024 – Present</p>
          <p className="text-sm text-[#9999bb] mt-2 leading-relaxed">
            Core member of the AI team designing, building, and deploying enterprise AI solutions at scale.
            Work spans agentic AI platforms, enterprise AI assistants, RAG systems, Voice AI, LLM hosting &amp; serving infrastructure,
            fine-tuning platforms, Kubernetes-based AI deployments, and GPU infrastructure optimization.
            Contributed to customer support automation, intelligent knowledge retrieval, voice agents,
            autonomous workflows, and enterprise AI platform products.
          </p>
        </div>
      </div>

      {/* Expertise Grid */}
      <div>
        <h2 className="text-base font-bold text-white mb-4">Areas of Expertise</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {EXPERTISE.map(({ icon: Icon, label, color, items }) => (
            <div key={label} className={`rounded-xl border p-4 ${COLOR_MAP[color].replace('text-', 'border-').split(' ')[1]} bg-[#12121a]`}>
              <div className="flex items-center gap-2 mb-3">
                <Icon className={`w-4 h-4 ${ICON_COLOR_MAP[color]}`} />
                <span className="text-sm font-semibold text-white">{label}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {items.map(item => (
                  <span
                    key={item}
                    className="text-xs px-2 py-0.5 rounded-full bg-[#1a1a26] border border-[#2a2a3a] text-[#9999bb]"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Major Projects */}
      <div>
        <h2 className="text-base font-bold text-white mb-4">Major Projects</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PROJECTS.map(p => (
            <div
              key={p.title}
              className={`rounded-xl border p-5 space-y-3 ${
                p.highlight
                  ? 'border-indigo-500/35 bg-indigo-500/5'
                  : 'border-[#2a2a3a] bg-[#12121a]'
              }`}
            >
              <div className="flex items-start gap-2">
                <Cpu className={`w-4 h-4 mt-0.5 flex-shrink-0 ${p.highlight ? 'text-indigo-400' : 'text-[#6666aa]'}`} />
                <span className="text-sm font-semibold text-white leading-tight">{p.title}</span>
              </div>
              <p className="text-xs text-[#9999bb] leading-relaxed">{p.desc}</p>
              <div className="flex flex-wrap gap-1.5">
                {p.tags.map(tag => (
                  <span
                    key={tag}
                    className={`text-[10px] px-2 py-0.5 rounded border font-medium ${
                      p.highlight
                        ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400'
                        : 'border-[#2a2a3a] bg-[#1a1a26] text-[#7777aa]'
                    }`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tech Stack */}
      <div>
        <h2 className="text-base font-bold text-white mb-4">Technical Stack</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: 'Programming', icon: Code2, items: ['Python', 'TypeScript / JavaScript', 'SQL', 'Bash / Linux'] },
            { label: 'AI & ML', icon: Brain, items: ['LangGraph', 'LangChain', 'RAG', 'Agentic AI', 'LLMOps', 'Prompt Engineering', 'Fine-Tuning', 'Evaluation Systems'] },
            { label: 'Infrastructure', icon: Server, items: ['Kubernetes', 'Docker', 'Linux', 'FastAPI', 'Ray Serve', 'KServe', 'vLLM'] },
            { label: 'Data & Storage', icon: Database, items: ['MongoDB', 'FAISS', 'Vector Databases', 'S3-Compatible Storage'] },
            { label: 'Speech / Voice', icon: Mic, items: ['Whisper ASR', 'XTTS v2', 'Voice AI Systems', 'Speech Processing', 'Indic Language TTS'] },
            { label: 'AI Models Served', icon: Zap, items: ['Llama family', 'Mistral', 'GPT-OSS', 'Whisper', 'BERT-family', 'Vision-language models'] },
          ].map(({ label, icon: Icon, items }) => (
            <div key={label} className="rounded-xl border border-[#2a2a3a] bg-[#12121a] p-4">
              <div className="flex items-center gap-2 mb-3">
                <Icon className="w-4 h-4 text-[#7777aa]" />
                <span className="text-sm font-semibold text-white">{label}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {items.map(item => (
                  <span key={item} className="text-xs px-2.5 py-1 rounded-full bg-[#1a1a26] border border-[#2a2a3a] text-[#8888aa]">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Interests */}
      <div className="rounded-xl border border-[#2a2a3a] bg-[#12121a] p-5">
        <h2 className="text-sm font-bold text-white mb-3">Career Direction &amp; Interests</h2>
        <p className="text-sm text-[#9999bb] leading-relaxed mb-4">
          Focused on building the next generation of AI systems, particularly in <span className="text-indigo-300">Agentic AI</span>,{' '}
          <span className="text-purple-300">Enterprise AI Platforms</span>, <span className="text-rose-300">Voice AI</span>,{' '}
          and <span className="text-emerald-300">AI Infrastructure</span>. Particularly interested in roles combining AI engineering,
          platform architecture, and product thinking to deliver real-world impact.
        </p>
        <div className="flex flex-wrap gap-2">
          {['Agentic AI', 'Enterprise AI Platforms', 'Voice AI', 'Multimodal AI', 'AI Infrastructure', 'Autonomous Systems'].map(tag => (
            <span key={tag} className="text-xs px-3 py-1 rounded-full border border-indigo-500/25 bg-indigo-500/8 text-indigo-300 font-medium">
              {tag}
            </span>
          ))}
        </div>
        <p className="text-xs text-[#6666888] mt-4">
          Outside of work: cricket, badminton, sketching, tech exploration, and studying emerging AI research &amp; infrastructure systems.
        </p>
      </div>

    </div>
  )
}
