import { useEffect, useState } from 'react'
import { Play, CheckCircle, AlertTriangle, Clock, Target } from 'lucide-react'
import { api } from '@/lib/api'
import { cn, formatPercent } from '@/lib/utils'
import type { EvalResults } from '@/types'

export function EvaluationLab() {
  const [results, setResults] = useState<EvalResults | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<string[]>([])

  useEffect(() => {
    api.evalResults()
      .then(setResults)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const runEval = async () => {
    setRunning(true)
    setProgress([])
    try {
      const es = new EventSource(api.evalRunUrl())
      es.onmessage = (e) => {
        try {
          const d = JSON.parse(e.data)
          if (d.message) setProgress(prev => [...prev, d.message])
          if (d.type === 'done') {
            es.close()
            setRunning(false)
            api.evalResults().then(setResults).catch(() => {})
          }
          if (d.type === 'error') { es.close(); setRunning(false) }
        } catch { /* ignore */ }
      }
      es.onerror = () => { es.close(); setRunning(false) }
    } catch {
      setRunning(false)
    }
  }

  const qualityIcon = (q: string) => {
    if (q === 'high') return <CheckCircle className="w-4 h-4 text-emerald-400" />
    if (q === 'medium') return <AlertTriangle className="w-4 h-4 text-yellow-400" />
    return <AlertTriangle className="w-4 h-4 text-red-400" />
  }

  const qualityBadge = (q: string) => {
    if (q === 'high') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
    if (q === 'medium') return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/25'
    return 'bg-red-500/10 text-red-400 border-red-500/25'
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Evaluation Lab</h1>
          <p className="text-sm text-[#8888aa] mt-0.5">RAG retrieval quality metrics — measured, not assumed</p>
        </div>
        <div className="flex items-center gap-3">
          {results?.run_at && (
            <div className="flex items-center gap-1.5 text-xs text-[#8888aa]">
              <Clock className="w-3.5 h-3.5" />
              Last run: {new Date(results.run_at).toLocaleString()}
            </div>
          )}
          <button
            onClick={runEval}
            disabled={running}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-sm text-white font-medium transition-all"
          >
            {running ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {running ? 'Running…' : 'Run Full Eval'}
          </button>
        </div>
      </div>

      {/* Progress */}
      {progress.length > 0 && (
        <div className="rounded-xl border border-[#2a2a3a] bg-[#12121a] p-4">
          <div className="text-xs font-mono space-y-1 max-h-40 overflow-y-auto">
            {progress.map((p, i) => (
              <div key={i} className="text-emerald-400">{p}</div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-[#8888aa] animate-pulse">Loading results…</div>
      ) : !results ? (
        <div className="rounded-xl border border-[#2a2a3a] bg-[#12121a] p-12 text-center">
          <Target className="w-10 h-10 text-[#2a2a3a] mx-auto mb-3" />
          <p className="text-[#8888aa]">No evaluation results yet. Run the first evaluation.</p>
        </div>
      ) : (
        <>
          {/* Aggregate Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="Avg Chunk Score" value={results.avg_chunk_score.toFixed(3)} />
            <MetricCard label="Top-1 Precision" value={formatPercent(results.top1_precision * 100)} />
            <MetricCard label="Avg Latency" value={`${results.avg_latency_s.toFixed(1)}s`} />
            <MetricCard label="Agent Success" value={formatPercent(results.agent_success_rate * 100)} positive />
          </div>

          {/* Individual Results */}
          <div className="space-y-3">
            {results.questions.map((q, i) => (
              <div key={i} className="rounded-xl border border-[#2a2a3a] bg-[#12121a] p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    {qualityIcon(q.quality)}
                    <div>
                      <p className="text-sm font-medium text-white">Q{i + 1}: {q.question}</p>
                    </div>
                  </div>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium shrink-0', qualityBadge(q.quality))}>
                    {q.quality.toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg bg-[#1a1a26] border border-[#2a2a3a] p-2.5">
                    <div className="text-[#8888aa] mb-1">Top Chunk</div>
                    <div className="font-mono text-indigo-400">{q.top_chunk_id}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 rounded-full bg-[#2a2a3a]">
                        <div
                          className="h-1.5 rounded-full bg-indigo-400"
                          style={{ width: `${Math.min(q.top_chunk_score * 200, 100)}%` }}
                        />
                      </div>
                      <span className="text-white font-medium">{q.top_chunk_score.toFixed(3)}</span>
                    </div>
                    <p className="text-[#8888aa] mt-1 line-clamp-2">{q.top_chunk_preview}</p>
                  </div>
                  <div className="rounded-lg bg-[#1a1a26] border border-[#2a2a3a] p-2.5">
                    <div className="text-[#8888aa] mb-1">Answer Preview</div>
                    <p className="text-white line-clamp-3">{q.answer_preview}</p>
                    <div className="text-[#8888aa] mt-2 italic">{q.notes}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function MetricCard({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="rounded-xl border border-[#2a2a3a] bg-[#12121a] p-4">
      <div className="text-xs text-[#8888aa] uppercase tracking-wider mb-1">{label}</div>
      <div className={cn('text-2xl font-bold', positive ? 'text-emerald-400' : 'text-white')}>{value}</div>
    </div>
  )
}
