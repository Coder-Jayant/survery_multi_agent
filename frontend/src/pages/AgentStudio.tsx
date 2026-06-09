import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { AgentGraph } from '@/components/AgentGraph'
import { AgentBadge } from '@/components/AgentBadge'
import { api, createSSEStream } from '@/lib/api'
import { cn, agentLabel } from '@/lib/utils'
import type { SSEEvent, RunRecord, PromptRegistry } from '@/types'

type Tab = 'graph' | 'decisions' | 'tools' | 'prompts' | 'outputs'

interface ToolCall {
  tool: string
  agent: string
  args: Record<string, unknown>
  result: string
}

export function AgentStudio() {
  const [tab, setTab] = useState<Tab>('graph')
  const [activeAgents, setActiveAgents] = useState<string[]>([])
  const [doneAgents, setDoneAgents] = useState<string[]>([])
  const [lastRun, setLastRun] = useState<RunRecord | null>(null)
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([])
  const [prompts, setPrompts] = useState<PromptRegistry | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<keyof PromptRegistry>('orchestrator')
  const [running, setRunning] = useState(false)
  const [streamError, setStreamError] = useState<string | null>(null)
  const [demoQ, setDemoQ] = useState('What are the top complaints in May 2026 and how do they compare to April?')
  const [traceEvents, setTraceEvents] = useState<SSEEvent[]>([])
  const stopRef = useRef<(() => void) | null>(null)
  const traceBottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    Promise.all([
      api.history().catch(() => ({ runs: [] })),
      api.getPrompts().catch(() => null),
    ]).then(([hist, p]) => {
      if (hist.runs.length > 0) setLastRun(hist.runs[0])
      setPrompts(p)
    })
  }, [])

  // Auto-scroll trace
  useEffect(() => {
    traceBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [traceEvents])

  // Cleanup stream on unmount
  useEffect(() => {
    return () => { stopRef.current?.() }
  }, [])

  const finishRun = (err?: string) => {
    setRunning(false)
    setActiveAgents([])
    if (err) setStreamError(err)
    // Refresh last run from history after completion
    api.history().catch(() => ({ runs: [] })).then(hist => {
      if (hist.runs.length > 0) setLastRun(hist.runs[0])
    })
  }

  const runDemo = () => {
    if (running) return
    stopRef.current?.()
    setRunning(true)
    setStreamError(null)
    setActiveAgents([])
    setDoneAgents([])
    setToolCalls([])
    setTraceEvents([])

    const stop = createSSEStream(
      demoQ,
      (event) => {
        setTraceEvents(prev => [...prev, event])
        if (event.type === 'agent_start') {
          setActiveAgents(prev => [...prev.filter(a => a !== event.agent), event.agent!])
        }
        if (event.type === 'agent_done') {
          setActiveAgents(prev => prev.filter(a => a !== event.agent))
          setDoneAgents(prev => [...prev, event.agent!])
        }
        if (event.type === 'tool_call') {
          setToolCalls(prev => [...prev, { tool: event.tool!, agent: event.agent!, args: event.args ?? {}, result: '' }])
        }
        if (event.type === 'tool_result') {
          setToolCalls(prev => {
            const updated = [...prev]
            const idx = [...updated].reverse().findIndex(t => t.tool === event.tool && t.result === '')
            if (idx !== -1) updated[updated.length - 1 - idx] = { ...updated[updated.length - 1 - idx], result: String(event.result ?? '') }
            return updated
          })
        }
        if (event.type === 'done') {
          setDoneAgents(prev => [...prev, 'summary_agent'])
          // finishRun is called by onDone below — don't call twice
        }
      },
      () => { finishRun() },           // onDone — single cleanup point
      (err) => { finishRun(err) }      // onError
    )
    stopRef.current = stop
  }

  const TABS: Array<{ id: Tab; label: string }> = [
    { id: 'graph', label: 'Agent Graph' },
    { id: 'decisions', label: 'Decision Log' },
    { id: 'tools', label: 'Tool Calls' },
    { id: 'prompts', label: 'Prompt Viewer' },
    { id: 'outputs', label: 'Structured Outputs' },
  ]

  const planEvent = traceEvents.find(e => e.type === 'plan') as Extract<SSEEvent, { type: 'plan' }> | undefined

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Agent Studio</h1>
          <p className="text-sm text-[#8888aa] mt-0.5">Inspect the multi-agent system in real time</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={demoQ}
            onChange={e => setDemoQ(e.target.value)}
            className="w-72 bg-[#1a1a26] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-white placeholder-[#8888aa] focus:outline-none focus:border-indigo-500/50 transition-all"
            placeholder="Question for live demo…"
          />
          <button
            onClick={running ? () => { stopRef.current?.(); finishRun() } : runDemo}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white font-medium transition-all',
              running ? 'bg-red-500/70 hover:bg-red-500' : 'bg-indigo-500 hover:bg-indigo-400'
            )}
          >
            {running ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {running ? 'Stop' : 'Run Live Demo'}
          </button>
        </div>
      </div>

      {/* Tabs */}
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

      {/* Error banner */}
      {streamError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400 flex items-center gap-2">
          <span className="font-mono">⚠</span>
          <span className="flex-1">
            {streamError === 'Connection lost'
              ? 'Connection lost — server may have restarted. Click Retry to re-run.'
              : `Stream error: ${streamError}`}
          </span>
          <button
            onClick={() => { setStreamError(null); runDemo() }}
            className="text-xs px-2 py-1 rounded border border-red-500/40 hover:bg-red-500/20 transition-colors whitespace-nowrap"
          >
            Retry
          </button>
          <button onClick={() => setStreamError(null)} className="text-red-400/50 hover:text-red-400 text-lg leading-none">×</button>
        </div>
      )}

      {/* Tab Content */}
      {tab === 'graph' && (
        <div className="space-y-3">
          <AgentGraph activeAgents={activeAgents} doneAgents={doneAgents} disableZoom />
          <div className="grid grid-cols-3 gap-3 text-xs">
            {(['orchestrator', 'data_agent', 'rag_agent', 'comparison_agent', 'summary_agent'] as const).map(a => (
              <div key={a} className={cn(
                'rounded-lg border p-2.5 transition-all',
                activeAgents.includes(a)
                  ? 'border-indigo-500/30 bg-indigo-500/5'
                  : doneAgents.includes(a)
                  ? 'border-emerald-500/20 bg-emerald-500/5'
                  : 'border-[#2a2a3a] bg-[#12121a]'
              )}>
                <AgentBadge agent={a} active={activeAgents.includes(a)} />
                <p className="text-[#8888aa] mt-1">
                  {activeAgents.includes(a) ? '⚡ Running…' : doneAgents.includes(a) ? '✓ Done' : 'Waiting'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'decisions' && (
        <div className="space-y-3">
          {planEvent ? (
            <div className="rounded-xl border border-[#2a2a3a] bg-[#12121a] p-4">
              <div className="text-sm font-semibold text-white mb-3">
                Execution Plan · {planEvent.count} tasks
              </div>
              <div className="space-y-2">
                {planEvent.tasks.map((t, i) => (
                  <div key={i} className="rounded-lg border border-[#2a2a3a] bg-[#1a1a26] p-3 flex items-start gap-3">
                    <span className="text-[#8888aa] text-xs font-mono shrink-0 mt-0.5">{i + 1}.</span>
                    <div>
                      <AgentBadge agent={t.agent} size="sm" />
                      <p className="text-xs text-[#ccccdd] mt-1.5">{t.intent}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState text="Run a live demo to see the orchestrator's execution plan" />
          )}

          {lastRun && (
            <div className="rounded-xl border border-[#2a2a3a] bg-[#12121a] p-4">
              <div className="text-sm font-semibold text-white mb-3">Last Run Record</div>
              <div className="text-xs space-y-1.5 text-[#8888aa]">
                <div className="flex justify-between">
                  <span>Question</span>
                  <span className="text-white max-w-[60%] text-right">{lastRun.question.slice(0, 60)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Agent trace</span>
                  <div className="flex gap-1 flex-wrap justify-end">
                    {lastRun.agent_trace.map((a, i) => <AgentBadge key={i} agent={a} size="sm" />)}
                  </div>
                </div>
                <div className="flex justify-between">
                  <span>Latency</span>
                  <span className="text-white">{(lastRun.latency_ms / 1000).toFixed(1)}s</span>
                </div>
              </div>
            </div>
          )}
          <div ref={traceBottomRef} />
        </div>
      )}

      {tab === 'tools' && (
        <div>
          {toolCalls.length === 0 ? (
            <EmptyState text="Run a live demo to see tool calls from DataAgent" />
          ) : (
            <div className="rounded-xl border border-[#2a2a3a] bg-[#12121a] overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#2a2a3a] text-[#8888aa] uppercase tracking-wider">
                    <th className="px-4 py-3 text-left">Tool</th>
                    <th className="px-4 py-3 text-left">Agent</th>
                    <th className="px-4 py-3 text-left">Arguments</th>
                    <th className="px-4 py-3 text-left">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a2a3a]">
                  {toolCalls.map((tc, i) => (
                    <tr key={i} className="hover:bg-[#1a1a26] transition-colors">
                      <td className="px-4 py-3 font-mono text-yellow-400">{tc.tool}</td>
                      <td className="px-4 py-3"><AgentBadge agent={tc.agent} /></td>
                      <td className="px-4 py-3 font-mono text-[#8888aa] max-w-[200px] truncate">
                        {JSON.stringify(tc.args)}
                      </td>
                      <td className="px-4 py-3 text-emerald-400 font-mono max-w-[200px] truncate">
                        {tc.result || <span className="animate-pulse text-[#8888aa]">…</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'prompts' && (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            {(['orchestrator', 'data_agent', 'rag_agent', 'summary_agent'] as const).map(a => (
              <button
                key={a}
                onClick={() => setSelectedAgent(a)}
                className={cn(
                  'px-3 py-1.5 rounded-lg border text-xs font-medium transition-all',
                  selectedAgent === a
                    ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300'
                    : 'border-[#2a2a3a] text-[#8888aa] hover:text-white bg-[#1a1a26]'
                )}
              >
                {agentLabel(a)}
              </button>
            ))}
          </div>
          <div className="rounded-xl border border-[#2a2a3a] bg-[#12121a] p-4">
            <div className="text-xs text-[#8888aa] mb-2 uppercase tracking-wider">{agentLabel(selectedAgent)} System Prompt</div>
            <pre className="text-xs text-[#ccccdd] leading-relaxed whitespace-pre-wrap font-mono bg-[#0e0e16] rounded-lg p-3 max-h-[400px] overflow-y-auto">
              {prompts?.[selectedAgent] ?? 'Loading…'}
            </pre>
          </div>
        </div>
      )}

      {tab === 'outputs' && (
        <div>
          {lastRun ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-[#2a2a3a] bg-[#12121a] p-4">
                <div className="text-sm font-semibold text-white mb-2">FinalAnswer</div>
                <pre className="text-xs text-[#ccccdd] font-mono bg-[#0e0e16] rounded-lg p-3 overflow-auto max-h-[400px] whitespace-pre-wrap">
                  {JSON.stringify({
                    question: lastRun.question,
                    narrative_preview: lastRun.narrative_preview,
                    supporting_data: lastRun.supporting_data,
                    sources: lastRun.sources,
                    agent_trace: lastRun.agent_trace,
                  }, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <EmptyState text="Run a live demo to see structured Pydantic outputs" />
          )}
        </div>
      )}
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-[#2a2a3a] bg-[#12121a] p-12 text-center">
      <p className="text-sm text-[#8888aa]">{text}</p>
    </div>
  )
}
