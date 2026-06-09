import { useEffect, useState } from 'react'
import { Save, RefreshCw, Upload, Info } from 'lucide-react'
import { api, bustCache } from '@/lib/api'
import { cn, agentLabel } from '@/lib/utils'
import type { AppConfig, PromptRegistry } from '@/types'

type Tab = 'model' | 'dataset' | 'kb' | 'retrieval' | 'prompts'

const PROVIDERS = ['groq', 'openai', 'gemini', 'anthropic', 'grok', 'openrouter']
const PROVIDER_MODELS: Record<string, string[]> = {
  groq: ['★ llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'mixtral-8x7b-32768'],
  openai: ['★ gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
  gemini: ['★ gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  anthropic: ['★ claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'],
  grok: ['★ grok-2', 'grok-beta'],
  openrouter: [
    '★ nvidia/nemotron-3-ultra-550b-a55b:free',
    'nvidia/nemotron-3.5-content-safety:free',
    'nex-agi/nex-n2-pro:free',
    'nvidia/llama-3.3-nemotron-super-49b-v1:free',
    'qwen/qwen3-235b-a22b:free',
    'deepseek/deepseek-r1:free',
  ],
}
const EMBEDDING_MODELS = ['★ all-MiniLM-L6-v2', 'text-embedding-3-small', 'nomic-embed-text']
const CHUNK_STRATEGIES = ['★ paragraph', 'fixed_256', 'sentence_aware']

const STAR_REASONS: Record<string, string> = {
  groq: '★ Best for this project — lowest latency (400–600 tok/s), free tier, OpenAI-compatible API, native function-calling support needed by DataAgent.',
  '★ llama-3.3-70b-versatile': '★ Best Groq model — 70B instruction-tuned with 128k context, optimised for structured output and agentic tool-calling.',
  '★ gpt-4o': '★ Best OpenAI model — fastest GPT-4 class model with excellent tool-calling and JSON output reliability.',
  '★ gemini-2.5-flash': '★ Best Gemini model — Gemini 2.5 Flash is the latest and most capable in the free tier with strong reasoning and instruction-following at low latency.',
  '★ claude-3-5-sonnet-20241022': '★ Best Anthropic model — top instruction-following quality with reliable structured output.',
  '★ grok-2': '★ Best Grok model — most capable in the family for multi-step reasoning.',
  '★ nvidia/nemotron-3-ultra-550b-a55b:free': '★ Best free OpenRouter model — 550B MoE model from NVIDIA built for agent orchestration, tool calling, and 1M token context. Perfect for this system.',
  '★ all-MiniLM-L6-v2': '★ Best embedding model here — 384-dim vectors, runs on CPU in ~10ms, trained on 1B+ pairs, top BEIR benchmark performer at its size. No GPU required.',
  '★ paragraph': '★ Best chunking strategy — preserves Q&A pairs as atomic semantic units. Fixed-size risks splitting question from its answer. Sentence-aware is overkill for a focused FAQ.',
}

function StarTooltip({ option }: { option: string }) {
  const [show, setShow] = useState(false)
  const reason = STAR_REASONS[option]
  if (!option.startsWith('★') && option !== 'groq') return null
  const key = option === 'groq' ? 'groq' : option
  const msg = STAR_REASONS[key]
  if (!msg) return null
  return (
    <span className="relative inline-flex items-center ml-1.5">
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={e => { e.stopPropagation(); setShow(v => !v) }}
        className="text-yellow-400/70 hover:text-yellow-300 transition-colors"
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      {show && (
        <div className="absolute left-5 top-0 z-50 w-72 rounded-lg border border-yellow-500/20 bg-[#1a1a26] shadow-xl p-3 text-xs text-[#ccccdd] leading-relaxed">
          {msg}
        </div>
      )}
    </span>
  )
}

export function AdminCenter() {
  const [tab, setTab] = useState<Tab>('model')
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [prompts, setPrompts] = useState<PromptRegistry | null>(null)
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [datasets, setDatasets] = useState<string[]>([])
  const [generating, setGenerating] = useState(false)
  const [genMsg, setGenMsg] = useState('')
  const [selectedPromptAgent, setSelectedPromptAgent] = useState<keyof PromptRegistry>('orchestrator')
  const [editedPrompt, setEditedPrompt] = useState('')
  const [savingPrompt, setSavingPrompt] = useState(false)
  // Separate key draft state — starts empty so masked values are never sent back.
  // User must type (or paste) a new key to change it. Existing key is preserved server-side.
  const [keyDraft, setKeyDraft] = useState<Record<string, string>>({})
  const [maskedKeys, setMaskedKeys] = useState<Record<string, string>>({})

  useEffect(() => {
    Promise.all([
      api.getConfig().catch(() => null),
      api.getPrompts().catch(() => null),
      api.dataList().catch(() => ({ datasets: [] })),
    ]).then(([cfg, p, dl]) => {
      if (cfg) {
        // Store masked display values separately; never put them in the editable key input
        setMaskedKeys(cfg.api_keys ?? {})
        // Remove api_keys from config state so they can't be accidentally saved
        const { api_keys: _keys, ...cfgWithoutKeys } = cfg as AppConfig & { api_keys?: Record<string, string> }
        setConfig({ ...cfgWithoutKeys, api_keys: {} } as AppConfig)
      }
      setPrompts(p)
      setDatasets(dl.datasets)
    })
  }, [])

  useEffect(() => {
    if (prompts && selectedPromptAgent) {
      setEditedPrompt(prompts[selectedPromptAgent] ?? '')
    }
  }, [prompts, selectedPromptAgent])

  const saveConfig = async () => {
    if (!config) return
    setSaving(true)
    setTestResult(null)
    try {
      // Only include api_keys that the user actually typed (non-empty keyDraft)
      const apiKeyUpdates: Record<string, string> = {}
      Object.entries(keyDraft).forEach(([provider, val]) => {
        if (val.trim()) apiKeyUpdates[provider] = val.trim()
      })
      const payload = { ...config, ...(Object.keys(apiKeyUpdates).length > 0 ? { api_keys: apiKeyUpdates } : {}) }
      await api.updateConfig(payload)
      bustCache('/api/config')
      // Clear drafted keys after successful save; update masked display
      if (Object.keys(apiKeyUpdates).length > 0) {
        setKeyDraft({})
        setMaskedKeys(prev => {
          const next = { ...prev }
          Object.keys(apiKeyUpdates).forEach(p => { next[p] = apiKeyUpdates[p].slice(0, 8) + '•'.repeat(Math.max(0, apiKeyUpdates[p].length - 8)) })
          return next
        })
      }
      setTestResult('Configuration saved. Provider switched — next query will use the new LLM.')
    } catch (e) {
      setTestResult(`Error: ${e}`)
    } finally {
      setSaving(false)
    }
  }

  const generateData = async () => {
    setGenerating(true)
    setGenMsg('')
    try {
      const r = await api.dataGenerate({ months: ['jan', 'feb', 'mar', 'apr', 'may'] })
      setGenMsg(r.message)
      const dl = await api.dataList()
      setDatasets(dl.datasets)
    } catch (e) {
      setGenMsg(`Error: ${e}`)
    } finally {
      setGenerating(false)
    }
  }

  const savePrompt = async () => {
    setSavingPrompt(true)
    try {
      await api.updatePrompt(selectedPromptAgent, editedPrompt)
      setPrompts(p => p ? { ...p, [selectedPromptAgent]: editedPrompt } : p)
    } catch { /* ignore */ }
    setSavingPrompt(false)
  }

  const TABS: Array<{ id: Tab; label: string }> = [
    { id: 'model', label: 'Model Config' },
    { id: 'dataset', label: 'Dataset' },
    { id: 'kb', label: 'Knowledge Base' },
    { id: 'retrieval', label: 'Retrieval' },
    { id: 'prompts', label: 'Prompt Registry' },
  ]

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Admin Center</h1>
        <p className="text-sm text-[#8888aa] mt-0.5">Configure models, data, and system behaviour</p>
      </div>

      <div className="flex gap-1 border-b border-[#2a2a3a] overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-all',
              tab === t.id ? 'border-indigo-400 text-indigo-300' : 'border-transparent text-[#8888aa] hover:text-white'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Model Config */}
      {tab === 'model' && config && (
        <div className="grid gap-4 max-w-2xl">
          <Field label="LLM Provider">
            <div className="flex gap-2 flex-wrap items-center">
              {PROVIDERS.map(p => (
                <span key={p} className="inline-flex items-center">
                  <button
                    onClick={() => setConfig(c => c ? { ...c, provider: p, model: PROVIDER_MODELS[p][0] } : c)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg border text-sm font-medium transition-all capitalize',
                      config.provider === p
                        ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300'
                        : 'border-[#2a2a3a] text-[#8888aa] hover:text-white bg-[#1a1a26]'
                    )}
                  >{p === 'groq' ? '★ groq' : p}</button>
                  {p === 'groq' && <StarTooltip option="groq" />}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-[#8888aa] mt-1">★ = recommended for this project</p>
          </Field>

          <Field label="Model">
            <div className="flex items-center gap-2">
              <select
                value={config.model}
                onChange={e => setConfig(c => c ? { ...c, model: e.target.value } : c)}
                className="bg-[#1a1a26] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50 flex-1"
              >
                {(PROVIDER_MODELS[config.provider] ?? []).map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              {config.model && STAR_REASONS[config.model] && <StarTooltip option={config.model} />}
            </div>
          </Field>

          <Field label={`API Key (${config.provider})`}>
            <input
              type="password"
              value={keyDraft[config.provider] ?? ''}
              onChange={e => setKeyDraft(d => ({ ...d, [config.provider]: e.target.value }))}
              placeholder={
                maskedKeys[config.provider]
                  ? `Current: ${maskedKeys[config.provider]} — paste new key to change`
                  : `Paste ${config.provider} API key here…`
              }
              className="bg-[#1a1a26] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-white placeholder-[#555577] focus:outline-none focus:border-indigo-500/50 w-full font-mono"
            />
            {maskedKeys[config.provider] && !keyDraft[config.provider] && (
              <p className="text-[11px] text-emerald-500/70 mt-1">
                ✓ Key is set ({maskedKeys[config.provider]}). Leave blank to keep existing key.
              </p>
            )}
            {keyDraft[config.provider] && (
              <p className="text-[11px] text-yellow-400/80 mt-1">
                New key will be saved on "Save Configuration".
              </p>
            )}
          </Field>

          <Field label="Temperature">
            <div className="flex items-center gap-3">
              <input
                type="range" min={0} max={1} step={0.05}
                value={config.temperature}
                onChange={e => setConfig(c => c ? { ...c, temperature: parseFloat(e.target.value) } : c)}
                className="flex-1 accent-indigo-500"
              />
              <span className="text-sm text-white w-10 text-right">{config.temperature}</span>
            </div>
          </Field>

          <Field label="Embedding Model">
            <div className="flex items-center gap-2">
              <select
                value={config.embedding_model}
                onChange={e => setConfig(c => c ? { ...c, embedding_model: e.target.value } : c)}
                className="bg-[#1a1a26] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50 flex-1"
              >
                {EMBEDDING_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              {config.embedding_model && STAR_REASONS[config.embedding_model] && <StarTooltip option={config.embedding_model} />}
            </div>
          </Field>

          <div className="flex items-center gap-3">
            <button
              onClick={saveConfig}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-sm text-white font-medium transition-all"
            >
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
              Save Configuration
            </button>
            {testResult && <span className="text-sm text-emerald-400">{testResult}</span>}
          </div>
        </div>
      )}

      {/* Dataset */}
      {tab === 'dataset' && (
        <div className="space-y-4 max-w-2xl">
          <div className="rounded-xl border border-[#2a2a3a] bg-[#12121a] p-4">
            <div className="text-sm font-semibold text-white mb-3">Available Datasets</div>
            <div className="space-y-2">
              {datasets.length === 0 ? (
                <p className="text-sm text-[#8888aa]">No datasets found. Generate one below.</p>
              ) : (
                datasets.map(d => (
                  <div key={d} className={cn(
                    'flex items-center justify-between rounded-lg border border-[#2a2a3a] px-3 py-2',
                    config?.active_dataset === d && 'border-indigo-500/25 bg-indigo-500/5'
                  )}>
                    <span className="text-sm text-white font-mono">{d}</span>
                    {config?.active_dataset === d && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 text-emerald-400">ACTIVE</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[#2a2a3a] bg-[#12121a] p-4">
            <div className="text-sm font-semibold text-white mb-3">Generate Synthetic Dataset</div>
            <p className="text-xs text-[#8888aa] mb-3">
              Generates ~195k survey records from January–May 2026 with realistic CSAT arc (72% → 39%)
            </p>
            <button
              onClick={generateData}
              disabled={generating}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-sm text-white font-medium transition-all"
            >
              {generating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {generating ? 'Generating…' : 'Generate Dataset'}
            </button>
            {genMsg && <p className="mt-2 text-sm text-emerald-400">{genMsg}</p>}
          </div>
        </div>
      )}

      {/* Knowledge Base */}
      {tab === 'kb' && (
        <div className="space-y-4 max-w-2xl">
          <div className="rounded-xl border border-[#2a2a3a] bg-[#12121a] p-4">
            <div className="text-sm font-semibold text-white mb-3">Upload Document</div>
            <p className="text-xs text-[#8888aa] mb-3">Upload a .txt or .md file to create a new knowledge base. The system will ingest and build a new FAISS index.</p>
            <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-[#2a2a3a] rounded-xl cursor-pointer hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all">
              <Upload className="w-6 h-6 text-[#8888aa] mb-2" />
              <span className="text-sm text-[#8888aa]">Click to upload .txt or .md</span>
              <input type="file" accept=".txt,.md" className="hidden" />
            </label>
          </div>
          <div className="rounded-xl border border-[#2a2a3a] bg-[#12121a] p-4">
            <div className="text-sm font-semibold text-white mb-2">Rebuild Active Index</div>
            <p className="text-xs text-[#8888aa] mb-3">Re-ingests the active FAQ document and rebuilds the FAISS index.</p>
            <button
              onClick={() => api.kbRebuild()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#2a2a3a] text-sm text-[#8888aa] hover:text-white bg-[#1a1a26] transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              Rebuild Index
            </button>
          </div>
        </div>
      )}

      {/* Retrieval Config */}
      {tab === 'retrieval' && config && (
        <div className="space-y-4 max-w-2xl">
          <Field label="Chunking Strategy">
            <div className="flex items-center gap-2">
              <select
                value={config.retrieval.strategy}
                onChange={e => setConfig(c => c ? { ...c, retrieval: { ...c.retrieval, strategy: e.target.value } } : c)}
                className="bg-[#1a1a26] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50 flex-1"
              >
                {CHUNK_STRATEGIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {config.retrieval?.strategy && STAR_REASONS[config.retrieval.strategy] && (
                <StarTooltip option={config.retrieval.strategy} />
              )}
            </div>
          </Field>
          <Field label={`Top-K (${config.retrieval.top_k})`}>
            <input
              type="range" min={1} max={10}
              value={config.retrieval.top_k}
              onChange={e => setConfig(c => c ? { ...c, retrieval: { ...c.retrieval, top_k: parseInt(e.target.value) } } : c)}
              className="w-full accent-indigo-500"
            />
          </Field>
          <Field label={`Score Threshold (${config.retrieval.score_threshold})`}>
            <input
              type="range" min={0} max={1} step={0.05}
              value={config.retrieval.score_threshold}
              onChange={e => setConfig(c => c ? { ...c, retrieval: { ...c.retrieval, score_threshold: parseFloat(e.target.value) } } : c)}
              className="w-full accent-indigo-500"
            />
          </Field>
          <button
            onClick={saveConfig}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-sm text-white font-medium transition-all"
          >
            <Save className="w-4 h-4" />
            Save Retrieval Config
          </button>
        </div>
      )}

      {/* Prompt Registry */}
      {tab === 'prompts' && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {(['orchestrator', 'data_agent', 'rag_agent', 'summary_agent'] as const).map(a => (
              <button
                key={a}
                onClick={() => setSelectedPromptAgent(a)}
                className={cn(
                  'px-3 py-1.5 rounded-lg border text-xs font-medium transition-all',
                  selectedPromptAgent === a
                    ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300'
                    : 'border-[#2a2a3a] text-[#8888aa] hover:text-white bg-[#1a1a26]'
                )}
              >
                {agentLabel(a)}
              </button>
            ))}
          </div>
          <div className="rounded-xl border border-[#2a2a3a] bg-[#12121a] overflow-hidden">
            <div className="px-4 py-2 border-b border-[#2a2a3a] text-xs text-[#8888aa] uppercase tracking-wider">
              {agentLabel(selectedPromptAgent)} System Prompt
            </div>
            <textarea
              value={editedPrompt}
              onChange={e => setEditedPrompt(e.target.value)}
              rows={16}
              className="w-full bg-transparent px-4 py-3 text-xs font-mono text-[#ccccdd] leading-relaxed focus:outline-none resize-none"
            />
          </div>
          <button
            onClick={savePrompt}
            disabled={savingPrompt}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-sm text-white font-medium transition-all"
          >
            {savingPrompt ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
            Save Prompt
          </button>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-[#8888aa] uppercase tracking-wider">{label}</label>
      {children}
    </div>
  )
}
