import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  RadialBarChart, RadialBar, ResponsiveContainer, PieChart, Pie, Cell, Tooltip
} from 'recharts'
import {
  TrendingUp, TrendingDown, AlertTriangle, Star, Users, RefreshCw,
  Copy, Check, Zap, Target, ArrowRight, Activity
} from 'lucide-react'
import { api } from '@/lib/api'
import { KpiCard, AIKpiCard } from '@/components/KpiCard'
import {
  formatPercent, formatRating, formatNumber, formatDelta,
  themeColor, themeLabel, getHealthColor
} from '@/lib/utils'
import type { DashboardResponse } from '@/types'

const PERIODS = [
  { key: 'jan', label: 'January 2026' },
  { key: 'feb', label: 'February 2026' },
  { key: 'mar', label: 'March 2026' },
  { key: 'apr', label: 'April 2026' },
  { key: 'may', label: 'May 2026' },
]

export function Dashboard() {
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [period, setPeriod] = useState('may')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const navigate = useNavigate()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api.dashboard(period)
      setData(d)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => { load() }, [load])

  const copy = async () => {
    if (!data?.ai.executive_brief) return
    await navigator.clipboard.writeText(data.ai.executive_brief)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const insightIcon = (type: string) => {
    if (type === 'warning') return <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
    if (type === 'trend') return <TrendingDown className="w-3.5 h-3.5 text-red-400 shrink-0" />
    if (type === 'positive') return <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
    return <Activity className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
  }

  if (loading) return <DashboardSkeleton />

  const { kpis, ai } = data ?? { kpis: null, ai: null }

  const healthColor = getHealthColor(kpis?.health_score ?? 0)

  const radialData = [
    { name: 'score', value: kpis?.health_score ?? 0, fill: healthColor },
  ]

  const ratingData = Object.entries(kpis?.rating_distribution ?? {}).map(([k, v]) => ({
    name: `${k}★`, value: v, fill: k === '5' ? '#10b981' : k === '4' ? '#6366f1' : k === '3' ? '#f59e0b' : k === '2' ? '#f97316' : '#ef4444'
  }))

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-[#8888aa] mt-0.5">GreenLeaf Bistro — Customer Intelligence Overview</p>
        </div>
        <div className="flex items-center gap-2">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                period === p.key
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  : 'bg-[#1a1a26] text-[#8888aa] border border-[#2a2a3a] hover:text-white hover:border-[#3a3a50]'
              }`}
            >
              {p.label.split(' ')[0]}
            </button>
          ))}
          <button
            onClick={load}
            className="ml-2 p-2 rounded-lg border border-[#2a2a3a] text-[#8888aa] hover:text-white hover:border-[#3a3a50] transition-all"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="CSAT Score"
          value={formatPercent(kpis?.csat_score ?? 0)}
          sub="% ratings ≥ 4/5"
          delta={kpis?.mom_delta_csat != null ? formatDelta(kpis.mom_delta_csat) : undefined}
          deltaPositive={kpis?.mom_delta_csat != null ? kpis.mom_delta_csat >= 0 : undefined}
          icon={<Target className="w-4 h-4" />}
        />
        <KpiCard
          label="Avg Rating"
          value={`${formatRating(kpis?.avg_rating ?? 0)} / 5`}
          sub="Mean 1–5 scale"
          icon={<Star className="w-4 h-4" />}
        />
        <KpiCard
          label="Responses"
          value={formatNumber(kpis?.total_responses ?? 0)}
          sub="Survey responses"
          icon={<Users className="w-4 h-4" />}
        />
        <KpiCard
          label="Top Complaint"
          value={themeLabel(kpis?.top_complaint ?? 'app')}
          sub="Highest volume theme"
          accent
          icon={<AlertTriangle className="w-4 h-4 text-yellow-400" />}
        />
      </div>

      {/* AI KPIs + Health Score */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Health Score */}
        <div className="rounded-xl border border-[#2a2a3a] bg-[#12121a] p-4 flex flex-col items-center justify-center">
          <div className="text-xs font-medium text-[#8888aa] uppercase tracking-wider mb-2">Business Health Score</div>
          <div className="relative w-36 h-36">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart innerRadius="65%" outerRadius="90%" data={radialData} startAngle={225} endAngle={-45}>
                <RadialBar dataKey="value" cornerRadius={8} background={{ fill: '#2a2a3a' }} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold" style={{ color: healthColor }}>
                {kpis?.health_score ?? 0}
              </span>
              <span className="text-xs text-[#8888aa]">/ 100</span>
            </div>
          </div>
          <span className="text-xs mt-1" style={{ color: healthColor }}>
            {(kpis?.health_score ?? 0) >= 70 ? 'Healthy' : (kpis?.health_score ?? 0) >= 40 ? 'At Risk' : 'Critical'}
          </span>
        </div>

        {/* AI KPIs Grid */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-3">
          <AIKpiCard
            label="Operational Priority"
            value={ai?.operational_priority ?? '—'}
            badge={{ text: 'ACTION REQUIRED', variant: 'warning' }}
          />
          <AIKpiCard
            label="Highest Risk Area"
            value={ai?.highest_risk_area ?? '—'}
            badge={{ text: 'HIGH RISK', variant: 'danger' }}
          />
          <AIKpiCard
            label="Fastest Growing Issue"
            value={ai?.fastest_growing_issue ?? '—'}
            badge={{ text: 'TRENDING UP', variant: 'info' }}
          />
          <AIKpiCard
            label="Best Performing Area"
            value={ai?.best_performing_area ?? '—'}
            badge={{ text: 'POSITIVE SIGNAL', variant: 'success' }}
          />
        </div>
      </div>

      {/* Bottom Row: Executive Brief + Insights + Rating Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Executive Brief */}
        <div className="lg:col-span-2 rounded-xl border border-[#2a2a3a] bg-[#12121a] p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-indigo-400" />
              <span className="text-sm font-semibold text-white">AI Executive Brief</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400 border border-indigo-500/25 font-medium">
                Groq Generated
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={copy}
                className="p-1.5 rounded hover:bg-[#2a2a3a] text-[#8888aa] hover:text-white transition-all"
                title="Copy"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={load}
                className="p-1.5 rounded hover:bg-[#2a2a3a] text-[#8888aa] hover:text-white transition-all"
                title="Regenerate"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <p className="text-sm text-[#ccccdd] leading-relaxed">
            {ai?.executive_brief ?? 'Generating executive brief…'}
          </p>
          <button
            onClick={() => navigate('/analyst')}
            className="mt-3 flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Ask AI a follow-up question <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* Rating Distribution */}
        <div className="rounded-xl border border-[#2a2a3a] bg-[#12121a] p-4">
          <div className="text-sm font-semibold text-white mb-3">Rating Distribution</div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={ratingData}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={72}
                paddingAngle={3}
                dataKey="value"
              >
                {ratingData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#1a1a26', border: '1px solid #2a2a3a', borderRadius: 8, color: '#e8e8f0' }}
                formatter={(v: unknown) => [formatNumber(v as number), 'responses']}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center">
            {ratingData.map(d => (
              <div key={d.name} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.fill }} />
                <span className="text-xs text-[#8888aa]">{d.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI Insights Feed + Top Themes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-[#2a2a3a] bg-[#12121a] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-semibold text-white">AI Insights Feed</span>
          </div>
          <div className="space-y-2">
            {(ai?.insights ?? []).map((ins, i) => (
              <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-[#1a1a26] border border-[#2a2a3a]">
                {insightIcon(ins.type)}
                <span className="text-xs text-[#ccccdd] leading-relaxed">{ins.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Themes */}
        <div className="rounded-xl border border-[#2a2a3a] bg-[#12121a] p-4">
          <div className="text-sm font-semibold text-white mb-3">Theme Breakdown</div>
          <div className="space-y-2.5">
            {(kpis?.top_themes ?? []).map(t => (
              <div key={t.theme} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium" style={{ color: themeColor(t.theme) }}>{themeLabel(t.theme)}</span>
                  <span className="text-[#8888aa]">{formatPercent(t.percentage)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-[#2a2a3a]">
                  <div
                    className="h-1.5 rounded-full transition-all duration-700"
                    style={{ width: `${t.percentage}%`, backgroundColor: themeColor(t.theme) }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-[#1a1a26] rounded-lg" />
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 bg-[#1a1a26] rounded-xl border border-[#2a2a3a]" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="h-52 bg-[#1a1a26] rounded-xl border border-[#2a2a3a]" />
        <div className="col-span-2 h-52 bg-[#1a1a26] rounded-xl border border-[#2a2a3a]" />
      </div>
    </div>
  )
}
