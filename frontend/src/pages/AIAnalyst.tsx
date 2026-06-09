import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Sparkles, Clock, ChevronRight, Network, Trash2 } from 'lucide-react'
import { createSSEStream } from '@/lib/api'
import { AgentBadge } from '@/components/AgentBadge'
import { AgentGraph } from '@/components/AgentGraph'
import { ChunkCard } from '@/components/ChunkCard'
import { StreamingText } from '@/components/StreamingText'
import { AnswerViz } from '@/components/AnswerViz'
import { cn, agentLabel, formatPercent, formatRating } from '@/lib/utils'
import { useAnalyst } from '@/context/AnalystContext'
import type { SSEEvent, RetrievedChunk, VizSpec } from '@/types'

interface Message {
  id: string
  role: 'user' | 'assistant'
  text: string
  streaming?: boolean
  agentTrace?: string[]
  chunks?: RetrievedChunk[]
  metrics?: Record<string, unknown>
  sources?: string[]
  latencyMs?: number
  visualization?: VizSpec | null
}

interface TraceStep {
  type: string
  agent?: string
  tool?: string
  intent?: string
  args?: Record<string, unknown>
  result?: string
  step?: number
  total?: number
  tasks?: Array<{ agent: string; intent: string }>
}

const SUGGESTIONS = [
  "What are the top complaints in May 2026?",
  "Compare April vs May 2026 CSAT",
  "What does the FAQ say about complaint handling?",
  "Which theme showed the biggest improvement?",
  "What's the business health score for May?",
  "Why did ratings drop in May?",
]

export function AIAnalyst({ prefill }: { prefill?: string }) {
  // State lives in context → survives route changes, cleared on page refresh
  const {
    messages, setMessages,
    traceSteps, setTraceSteps,
    activeChunks, setActiveChunks,
    activeMetrics, setActiveMetrics,
    clearAll,
  } = useAnalyst()

  const [input, setInput] = useState(prefill ?? '')
  const [running, setRunning] = useState(false)
  const [expandedChunk, setExpandedChunk] = useState<string | null>(null)
  const [activeAgents, setActiveAgents] = useState<string[]>([])
  const [doneAgents, setDoneAgents] = useState<string[]>([])
  const [showGraph, setShowGraph] = useState(false)
  const latencyStartRef = useRef<number>(0)
  const stopRef = useRef<(() => void) | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const traceBottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (prefill) setInput(prefill)
  }, [prefill])

  const scrollBehavior = typeof window !== 'undefined' && window.innerWidth < 768 ? 'auto' : 'smooth'

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: scrollBehavior })
  }, [messages])

  useEffect(() => {
    traceBottomRef.current?.scrollIntoView({ behavior: scrollBehavior })
  }, [traceSteps])

  const submit = useCallback((question: string) => {
    if (!question.trim() || running) return
    setInput('')
    setRunning(true)
    setTraceSteps([])
    setActiveChunks([])
    setActiveMetrics({})
    setActiveAgents([])
    setDoneAgents([])
    latencyStartRef.current = Date.now()

    const userMsg: Message = { id: `u${Date.now()}`, role: 'user', text: question }
    const assistantId = `a${Date.now()}`
    const assistantMsg: Message = { id: assistantId, role: 'assistant', text: '', streaming: true }
    setMessages(prev => [...prev, userMsg, assistantMsg])

    const stop = createSSEStream(
      question,
      (event: SSEEvent) => {
        setTraceSteps(prev => [...prev, event as TraceStep])
        if (event.type === 'agent_start') {
          setActiveAgents(prev => [...prev.filter(a => a !== event.agent), event.agent!])
        }
        if (event.type === 'agent_done') {
          setActiveAgents(prev => prev.filter(a => a !== event.agent))
          setDoneAgents(prev => [...prev, event.agent!])
        }
        if (event.type === 'done') {
          setActiveAgents([])
          setDoneAgents(prev => [...prev, 'summary_agent'])
        }
        if (event.type === 'agent_done' && event.agent === 'rag_agent') {
          const chunks = (event.result as { chunks?: Array<{ id: string; score: number; preview: string }> })?.chunks
          if (chunks) {
            setActiveChunks(chunks.map(c => ({
              chunk_id: c.id,
              text: c.preview,
              score: c.score,
              source: 'faq_document.txt',
            })))
          }
        }
        if (event.type === 'agent_done' && event.agent === 'data_agent') {
          setActiveMetrics(event.result as Record<string, unknown>)
        }
        if (event.type === 'done') {
          const ans = event.answer
          const latency = Date.now() - latencyStartRef.current
          setMessages(prev => prev.map(m =>
            m.id === assistantId
              ? {
                  ...m,
                  text: ans.narrative,
                  streaming: false,
                  agentTrace: ans.trace,
                  sources: ans.sources,
                  metrics: ans.metrics,
                  chunks: activeChunks,
                  latencyMs: latency,
                  visualization: ans.visualization ?? null,
                }
              : m
          ))
        }
      },
      () => setRunning(false),
      (err) => {
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, text: `Error: ${err}`, streaming: false } : m
        ))
        setRunning(false)
      }
    )
    stopRef.current = stop
  }, [running, activeChunks])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit(input)
    }
  }

  const topChunkScore = activeChunks[0]?.score ?? 0
  const confidence = topChunkScore >= 0.5 ? 'High' : topChunkScore >= 0.3 ? 'Medium' : topChunkScore > 0 ? 'Low' : '—'
  const confidenceColor = topChunkScore >= 0.5 ? 'text-emerald-400' : topChunkScore >= 0.3 ? 'text-yellow-400' : 'text-red-400'
  const liveStatus = getLiveStatus(traceSteps)

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-48px)] md:h-screen overflow-hidden">
      {/* Panel 1 — Conversation */}
      <div className="flex-1 flex flex-col border-b md:border-b-0 md:border-r border-[#2a2a3a] min-w-0 min-h-0">
        <div className="px-4 py-3 border-b border-[#2a2a3a] flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-semibold text-white">AI Analyst</span>
          <span className="text-xs text-[#8888aa] ml-auto">Multi-agent reasoning</span>
          {messages.length > 0 && !running && (
            <button
              onClick={clearAll}
              title="Clear conversation"
              className="p-1 rounded-md text-[#8888aa] hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
              <Sparkles className="w-10 h-10 text-indigo-400/40" />
              <div>
                <p className="text-white font-medium">Ask anything about GreenLeaf Bistro</p>
                <p className="text-sm text-[#8888aa] mt-1">Powered by multi-agent AI with full observability</p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center mt-4">
                {SUGGESTIONS.slice(0, 4).map(s => (
                  <button
                    key={s}
                    onClick={() => submit(s)}
                    className="px-3 py-1.5 rounded-lg border border-[#2a2a3a] text-xs text-[#8888aa] hover:text-white hover:border-[#3a3a50] bg-[#1a1a26] transition-all text-left"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} className={cn('animate-fade-in', msg.role === 'user' ? 'flex justify-end' : '')}>
              {msg.role === 'user' ? (
                <div className="max-w-[80%] bg-indigo-500/15 border border-indigo-500/25 rounded-xl px-4 py-2.5 text-sm text-white">
                  {msg.text}
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="rounded-xl border border-[#2a2a3a] bg-[#12121a] p-4">
                    {msg.streaming ? (
                      <div className="space-y-2">
                        {running && (
                          <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            {liveStatus}
                          </p>
                        )}
                        <StreamingText text={msg.text || '…'} className="text-sm text-[#ccccdd] leading-relaxed" />
                      </div>
                    ) : (
                      <p className="text-sm text-[#ccccdd] leading-relaxed">{msg.text}</p>
                    )}
                    {/* Visualization — rendered after streaming completes */}
                    {!msg.streaming && msg.visualization && (
                      <AnswerViz viz={msg.visualization} />
                    )}
                    {msg.agentTrace && (
                      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[#2a2a3a] pt-3">
                        {msg.agentTrace.map((a, i) => (
                          <AgentBadge key={i} agent={a} size="sm" />
                        ))}
                        {msg.latencyMs && (
                          <div className="flex items-center gap-1 ml-auto text-xs text-[#8888aa]">
                            <Clock className="w-3 h-3" />
                            {(msg.latencyMs / 1000).toFixed(1)}s
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Metrics inline */}
                  {msg.metrics && Object.keys(msg.metrics).length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {msg.metrics.csat != null && (
                        <div className="rounded-lg bg-[#1a1a26] border border-[#2a2a3a] p-2 text-center">
                          <div className="text-xs text-[#8888aa]">CSAT</div>
                          <div className="text-sm font-bold text-white">{formatPercent(msg.metrics.csat as number)}</div>
                        </div>
                      )}
                      {msg.metrics.avg_rating != null && (
                        <div className="rounded-lg bg-[#1a1a26] border border-[#2a2a3a] p-2 text-center">
                          <div className="text-xs text-[#8888aa]">Avg Rating</div>
                          <div className="text-sm font-bold text-white">{formatRating(msg.metrics.avg_rating as number)}</div>
                        </div>
                      )}
                      {msg.metrics.responses != null && (
                        <div className="rounded-lg bg-[#1a1a26] border border-[#2a2a3a] p-2 text-center">
                          <div className="text-xs text-[#8888aa]">Responses</div>
                          <div className="text-sm font-bold text-white">{(msg.metrics.responses as number).toLocaleString()}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Suggestions when running finishes */}
        {!running && messages.length > 0 && (
          <div className="px-4 py-2 border-t border-[#2a2a3a] flex flex-wrap gap-1.5 overflow-x-auto">
            <span className="text-xs text-[#8888aa] shrink-0 self-center">Follow up:</span>
            {SUGGESTIONS.slice(0, 3).map(s => (
              <button
                key={s}
                onClick={() => submit(s)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#2a2a3a] text-xs text-[#8888aa] hover:text-white hover:border-[#3a3a50] bg-[#1a1a26] transition-all whitespace-nowrap"
              >
                {s} <ChevronRight className="w-3 h-3" />
              </button>
            ))}
          </div>
        )}

        {/* Mobile live trace — compact strip above input */}
        <div className="md:hidden shrink-0 border-t border-[#2a2a3a] bg-[#0a0a12]">
          <div className="px-3 py-1.5 flex items-center gap-2 border-b border-[#2a2a3a]/40">
            <span className="text-[10px] font-semibold text-white uppercase tracking-wider">Agent Trace</span>
            {running && <span className="text-[10px] text-emerald-400 animate-pulse">● Live</span>}
            {!running && traceSteps.length > 0 && (
              <span className="text-[10px] text-[#8888aa]">{traceSteps.length} steps</span>
            )}
          </div>
          <div className="px-3 py-2 max-h-[72px] overflow-y-auto space-y-1">
            {traceSteps.length === 0 && running && (
              <p className="text-[11px] text-[#8888aa]">Starting agents…</p>
            )}
            {traceSteps.slice(-4).map((step, i) => (
              <MobileTraceLine key={i} step={step} />
            ))}
          </div>
        </div>

        {/* Input */}
        <div className="px-4 py-3 pb-4 border-t border-[#2a2a3a]">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask a business question… (Enter to send)"
              rows={2}
              className="flex-1 bg-[#1a1a26] border border-[#2a2a3a] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[#8888aa] resize-none focus:outline-none focus:border-indigo-500/50 focus:bg-[#1e1e30] transition-all"
            />
            <button
              onClick={() => submit(input)}
              disabled={!input.trim() || running}
              className="p-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all"
            >
              {running ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Panel 2 — Agent Trace (hidden on mobile) */}
      <div className="hidden md:flex w-72 flex-col border-r border-[#2a2a3a] min-w-0">
        <div className="px-4 py-3 border-b border-[#2a2a3a] flex items-center gap-2">
          <span className="text-sm font-semibold text-white">Agent Trace</span>
          {running && <span className="text-xs text-emerald-400 animate-pulse">● Live</span>}
          <button
            onClick={() => setShowGraph(g => !g)}
            title="Toggle live agent graph"
            className={cn(
              'ml-auto p-1 rounded-md transition-colors',
              showGraph ? 'text-indigo-400 bg-indigo-500/10' : 'text-[#8888aa] hover:text-white hover:bg-[#2a2a3a]'
            )}
          >
            <Network className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Live agent graph (collapsible) */}
        {showGraph && (
          <div className="border-b border-[#2a2a3a] p-2 bg-[#0e0e16]">
            <AgentGraph
              activeAgents={activeAgents}
              doneAgents={doneAgents}
              compact
            />
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {traceSteps.length === 0 && (
            <div className="text-center text-xs text-[#8888aa] py-8">
              Trace will appear here when you ask a question
            </div>
          )}
          {traceSteps.map((step, i) => (
            <TraceItem key={i} step={step} />
          ))}
          <div ref={traceBottomRef} />
        </div>
      </div>

      {/* Panel 3 — Evidence (hidden on mobile) */}
      <div className="hidden md:flex w-72 flex-col min-w-0">
        <div className="px-4 py-3 border-b border-[#2a2a3a] flex items-center justify-between">
          <span className="text-sm font-semibold text-white">Evidence</span>
          {activeChunks.length > 0 && (
            <span className={cn('text-xs font-medium', confidenceColor)}>
              {confidence} confidence
            </span>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {activeChunks.length === 0 && (
            <div className="text-center text-xs text-[#8888aa] py-8">
              Retrieved chunks will appear here
            </div>
          )}

          {activeChunks.length > 0 && (
            <>
              <div className="text-xs text-[#8888aa] font-medium uppercase tracking-wider">Retrieved Chunks</div>
              {activeChunks.map((c, i) => (
                <ChunkCard
                  key={c.chunk_id}
                  chunk={c}
                  rank={i}
                  expanded={expandedChunk === c.chunk_id}
                  onClick={() => setExpandedChunk(expandedChunk === c.chunk_id ? null : c.chunk_id)}
                />
              ))}
            </>
          )}

          {Object.keys(activeMetrics).length > 0 && (
            <>
              <div className="text-xs text-[#8888aa] font-medium uppercase tracking-wider mt-3">Metrics Used</div>
              <div className="rounded-lg border border-[#2a2a3a] bg-[#12121a] p-3 space-y-2">
                {Object.entries(activeMetrics).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span className="text-[#8888aa]">{k}</span>
                    <span className="text-white font-medium">{String(v)}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeChunks.length > 0 && (
            <div className="rounded-lg border border-[#2a2a3a] bg-[#12121a] p-3 space-y-1.5">
              <div className="text-xs font-medium text-[#8888aa] uppercase tracking-wider">Provenance</div>
              <div className="flex justify-between text-xs">
                <span className="text-[#8888aa]">Top chunk score</span>
                <span className={cn('font-mono font-medium', confidenceColor)}>{topChunkScore.toFixed(3)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#8888aa]">Chunks retrieved</span>
                <span className="text-white font-medium">{activeChunks.length}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function getLiveStatus(steps: TraceStep[]): string {
  if (steps.length === 0) return 'Planning query…'
  const last = steps[steps.length - 1]
  if (last.type === 'plan') return 'Plan ready — running agents…'
  if (last.type === 'agent_start' && last.agent) return `${agentLabel(last.agent)} started`
  if (last.type === 'tool_call' && last.tool) return `Calling ${last.tool}…`
  if (last.type === 'tool_result') return 'Processing tool result…'
  if (last.type === 'agent_done' && last.agent) return `${agentLabel(last.agent)} finished`
  if (last.type === 'done') return 'Synthesizing answer…'
  return 'Working…'
}

function MobileTraceLine({ step }: { step: TraceStep }) {
  let text = step.type
  if (step.type === 'agent_start' && step.agent) text = `${agentLabel(step.agent)}: ${(step.intent ?? '').slice(0, 40)}`
  else if (step.type === 'tool_call' && step.tool) text = `→ ${step.tool}`
  else if (step.type === 'agent_done' && step.agent) text = `✓ ${agentLabel(step.agent)}`
  else if (step.type === 'plan') text = `Plan: ${step.tasks?.length ?? 0} tasks`

  return (
    <p className="text-[11px] text-[#aaaaaa] truncate leading-tight">
      <span className="text-[#6666888] font-mono text-[10px] mr-1">{step.type}</span>
      {text}
    </p>
  )
}

function TraceItem({ step }: { step: TraceStep }) {
  const typeColors: Record<string, string> = {
    plan: 'border-indigo-500/25 bg-indigo-500/5',
    agent_start: 'border-blue-500/25 bg-blue-500/5',
    tool_call: 'border-yellow-500/25 bg-yellow-500/5',
    tool_result: 'border-emerald-500/25 bg-emerald-500/5',
    agent_done: 'border-emerald-500/25 bg-emerald-500/5',
    done: 'border-indigo-500/25 bg-indigo-500/10',
    error: 'border-red-500/25 bg-red-500/5',
  }

  const cls = typeColors[step.type] ?? 'border-[#2a2a3a] bg-[#1a1a26]'

  return (
    <div className={cn('rounded-lg border p-2.5 text-xs animate-slide-in', cls)}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className="font-mono text-[10px] text-[#8888aa] uppercase">{step.type}</span>
        {step.agent && <AgentBadge agent={step.agent} size="sm" />}
      </div>
      {step.type === 'plan' && step.tasks && (
        <div className="space-y-1">
          {step.tasks.map((t, i) => (
            <div key={i} className="flex items-start gap-1">
              <span className="text-[#8888aa]">{i + 1}.</span>
              <span className="text-[#ccccdd]">{agentLabel(t.agent)}: {t.intent.slice(0, 50)}</span>
            </div>
          ))}
        </div>
      )}
      {step.intent && step.type === 'agent_start' && (
        <p className="text-[#ccccdd] mt-0.5 text-[11px]">{step.intent.slice(0, 80)}</p>
      )}
      {step.tool && (
        <div className="font-mono text-[11px]">
          <span className="text-yellow-400">{step.tool}</span>
          {step.args && <span className="text-[#8888aa]">({JSON.stringify(step.args).slice(0, 40)})</span>}
        </div>
      )}
      {step.type === 'tool_result' && step.result && (
        <p className="text-emerald-400 font-mono text-[11px] mt-0.5 truncate">→ {step.result.slice(0, 60)}</p>
      )}
    </div>
  )
}
