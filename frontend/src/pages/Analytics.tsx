import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, PieChart, Pie, Cell,
  AreaChart, Area, Legend
} from 'recharts'
import { Sparkles } from 'lucide-react'
import { api } from '@/lib/api'
import { themeColor, themeLabel, formatPercent, formatNumber } from '@/lib/utils'
import type { AnalyticsTrends } from '@/types'

const THEMES = ['food_quality', 'wait_time', 'staff', 'cleanliness', 'price', 'app']
const CHANNEL_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#ec4899']

const TOOLTIP_STYLE = {
  contentStyle: { background: '#1a1a26', border: '1px solid #2a2a3a', borderRadius: 8, color: '#e8e8f0', fontSize: 12 },
}

export function Analytics() {
  const [data, setData] = useState<AnalyticsTrends | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    api.analyticsTrends()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const askAI = (question: string) => {
    navigate(`/analyst?q=${encodeURIComponent(question)}`)
  }

  if (loading) return <div className="p-6 text-[#8888aa] animate-pulse">Loading analytics…</div>
  if (!data) return <div className="p-6 text-red-400">Failed to load analytics</div>

  const months = data.months

  // CSAT trend data
  const csatData = months.map(m => ({ name: m.label.split(' ')[0], csat: m.csat_score, target: 45 }))

  // Rating distribution grouped by month
  const ratingData = months.map(m => ({
    name: m.label.split(' ')[0],
    '5★': m.rating_distribution['5'] ?? 0,
    '4★': m.rating_distribution['4'] ?? 0,
    '3★': m.rating_distribution['3'] ?? 0,
    '2★': m.rating_distribution['2'] ?? 0,
    '1★': m.rating_distribution['1'] ?? 0,
  }))

  // Theme trends
  const themeData = months.map(m => {
    const row: Record<string, number | string> = { name: m.label.split(' ')[0] }
    m.top_themes.forEach(t => { row[t.theme] = t.percentage })
    THEMES.forEach(t => { if (!row[t]) row[t] = 0 })
    return row
  })

  // Volume trend
  const volumeData = months.map(m => ({ name: m.label.split(' ')[0], responses: m.total_responses }))

  // Channel breakdown (last month)
  const lastMonth = months[months.length - 1]
  const channelData = Object.entries(lastMonth?.channels ?? {}).map(([k, v]) => ({
    name: k, value: v
  }))

  // Theme shift (last 2 months)
  const prevMonth = months[months.length - 2]
  const themeShift = THEMES.map(t => {
    const prev = prevMonth?.top_themes.find(x => x.theme === t)?.percentage ?? 0
    const curr = lastMonth?.top_themes.find(x => x.theme === t)?.percentage ?? 0
    return { theme: t, delta: curr - prev, label: themeLabel(t) }
  }).sort((a, b) => b.delta - a.delta)

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-sm text-[#8888aa] mt-0.5">January – May 2026 · GreenLeaf Bistro</p>
      </div>

      {/* CSAT Trend */}
      <ChartCard title="CSAT Trend" onAskAI={() => askAI('What is the CSAT trend from January to May 2026?')}>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={csatData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
            <XAxis dataKey="name" stroke="#8888aa" tick={{ fontSize: 12 }} />
            <YAxis domain={[0, 100]} stroke="#8888aa" tick={{ fontSize: 12 }} tickFormatter={v => `${v}%`} />
            <Tooltip {...TOOLTIP_STYLE} formatter={(v: unknown) => [`${(v as number).toFixed(1)}%`]} />
            <ReferenceLine y={45} stroke="#f59e0b" strokeDasharray="5 5" label={{ value: '45% Target', fill: '#f59e0b', fontSize: 11 }} />
            <Line type="monotone" dataKey="csat" stroke="#6366f1" strokeWidth={2} dot={{ r: 4, fill: '#6366f1' }} name="CSAT" />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Theme Trends + Theme Shift side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Theme Trends" onAskAI={() => askAI('Which themes are trending up from January to May 2026?')}>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={themeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
              <XAxis dataKey="name" stroke="#8888aa" tick={{ fontSize: 11 }} />
              <YAxis stroke="#8888aa" tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v: unknown) => [`${(v as number).toFixed(1)}%`]} />
              <Legend formatter={(v) => themeLabel(v)} wrapperStyle={{ fontSize: 11 }} />
              {THEMES.map(t => (
                <Line key={t} type="monotone" dataKey={t} stroke={themeColor(t)} strokeWidth={1.5} dot={false} name={t} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={`Theme Shift (${prevMonth?.label.split(' ')[0]} → ${lastMonth?.label.split(' ')[0]})`}
          onAskAI={() => askAI('Which complaint themes shifted the most between April and May 2026?')}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={themeShift} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
              <XAxis type="number" stroke="#8888aa" tick={{ fontSize: 11 }} tickFormatter={v => `${v > 0 ? '+' : ''}${v.toFixed(1)}pp`} />
              <YAxis type="category" dataKey="label" stroke="#8888aa" tick={{ fontSize: 11 }} width={90} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v: unknown) => { const n = v as number; return [`${n > 0 ? '+' : ''}${n.toFixed(1)}pp`] }} />
              <ReferenceLine x={0} stroke="#2a2a3a" />
              <Bar dataKey="delta" radius={[0, 4, 4, 0]}>
                {themeShift.map((entry, i) => (
                  <Cell key={i} fill={entry.delta >= 0 ? '#ef4444' : '#10b981'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Rating Distribution + Channel Breakdown side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Rating Distribution by Month" onAskAI={() => askAI('How has the rating distribution changed over the months?')}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={ratingData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
              <XAxis dataKey="name" stroke="#8888aa" tick={{ fontSize: 12 }} />
              <YAxis stroke="#8888aa" tick={{ fontSize: 12 }} tickFormatter={formatNumber} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v: unknown) => [formatNumber(v as number), 'responses']} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="5★" stackId="a" fill="#10b981" />
              <Bar dataKey="4★" stackId="a" fill="#6366f1" />
              <Bar dataKey="3★" stackId="a" fill="#f59e0b" />
              <Bar dataKey="2★" stackId="a" fill="#f97316" />
              <Bar dataKey="1★" stackId="a" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={`Response Channel (${lastMonth?.label})`}
          onAskAI={() => askAI('What are the response channels and which drives the most feedback?')}>
          <div className="flex items-center justify-center h-[220px]">
            <ResponsiveContainer width="60%" height="100%">
              <PieChart>
                <Pie data={channelData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                  {channelData.map((_, i) => (
                    <Cell key={i} fill={CHANNEL_COLORS[i % CHANNEL_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip {...TOOLTIP_STYLE} formatter={(v: unknown) => [formatNumber(v as number), 'responses']} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-2">
              {channelData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CHANNEL_COLORS[i % CHANNEL_COLORS.length] }} />
                  <span className="text-xs text-[#8888aa]">{d.name}</span>
                  <span className="text-xs text-white font-medium ml-auto pl-2">{formatPercent((d.value / (lastMonth?.total_responses || 1)) * 100)}</span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>
      </div>

      {/* Response Volume */}
      <ChartCard title="Response Volume" onAskAI={() => askAI('Why did response volume spike in May 2026?')}>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={volumeData}>
            <defs>
              <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
            <XAxis dataKey="name" stroke="#8888aa" tick={{ fontSize: 12 }} />
            <YAxis stroke="#8888aa" tick={{ fontSize: 12 }} tickFormatter={formatNumber} />
            <Tooltip {...TOOLTIP_STYLE} formatter={(v: unknown) => [formatNumber(v as number), 'responses']} />
            <Area type="monotone" dataKey="responses" stroke="#6366f1" fill="url(#volGrad)" strokeWidth={2} name="Responses" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

function ChartCard({ title, children, onAskAI }: { title: string; children: React.ReactNode; onAskAI?: () => void }) {
  return (
    <div className="rounded-xl border border-[#2a2a3a] bg-[#12121a] p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {onAskAI && (
          <button
            onClick={onAskAI}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-indigo-500/25 text-xs text-indigo-400 hover:bg-indigo-500/10 transition-all"
          >
            <Sparkles className="w-3 h-3" />
            Ask AI about this
          </button>
        )}
      </div>
      {children}
    </div>
  )
}
