import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  PieChart, Pie, Legend, ResponsiveContainer,
} from 'recharts'
import type { VizSpec } from '@/types'

const DEFAULT_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#3b82f6', '#ec4899']

function getColors(viz: VizSpec): string[] {
  return viz.colors?.length ? viz.colors : DEFAULT_COLORS
}

// ── Tooltip ────────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label, unit }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-[#2a2a3a] bg-[#1a1a26] px-3 py-2 text-xs shadow-xl">
      {label && <p className="text-[#8888aa] mb-1">{label}</p>}
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-[#ccccdd]">{p.name ?? p.dataKey}:</span>
          <span className="text-white font-medium">
            {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
            {unit ? ` ${unit}` : ''}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Single-series horizontal bar ───────────────────────────────────────────
function HorizontalBar({ viz }: { viz: VizSpec }) {
  const colors = getColors(viz)
  const valueKey = viz.value_key ?? 'value'
  const xKey = viz.x_key ?? 'name'

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, viz.data.length * 36)}>
      <BarChart
        layout="vertical"
        data={viz.data}
        margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
      >
        <XAxis type="number" tick={{ fill: '#8888aa', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey={xKey}
          width={110}
          tick={{ fill: '#ccccdd', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip unit={viz.unit} />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <Bar dataKey={valueKey} radius={[0, 4, 4, 0]} maxBarSize={22}>
          {viz.data.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Grouped vertical bar ───────────────────────────────────────────────────
function GroupedBar({ viz }: { viz: VizSpec }) {
  const colors = getColors(viz)
  const xKey = viz.x_key ?? 'name'
  const yKeys = viz.y_keys ?? []

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={viz.data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
        <XAxis dataKey={xKey} tick={{ fill: '#ccccdd', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#8888aa', fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip unit={viz.unit} />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <Legend
          wrapperStyle={{ fontSize: 11, color: '#8888aa', paddingTop: 8 }}
          iconType="circle"
          iconSize={8}
        />
        {yKeys.map((key, i) => (
          <Bar key={key} dataKey={key} fill={colors[i % colors.length]} radius={[4, 4, 0, 0]} maxBarSize={32} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Pie chart ──────────────────────────────────────────────────────────────
const RADIAN = Math.PI / 180
const renderPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  if (percent < 0.04) return null
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
      fontSize={10} fontWeight="700">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

function PieViz({ viz }: { viz: VizSpec }) {
  const colors = getColors(viz)
  const valueKey = viz.value_key ?? 'value'
  const nameKey = viz.x_key ?? 'name'

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={viz.data}
          dataKey={valueKey}
          nameKey={nameKey}
          cx="50%"
          cy="46%"
          innerRadius={60}
          outerRadius={95}
          paddingAngle={2}
          stroke="none"
          labelLine={false}
          label={renderPieLabel}
        >
          {viz.data.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip unit={viz.unit} />} />
        <Legend
          wrapperStyle={{ fontSize: 11, color: '#8888aa', paddingTop: 4 }}
          iconType="circle"
          iconSize={8}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

// ── Table ──────────────────────────────────────────────────────────────────
function TableViz({ viz }: { viz: VizSpec }) {
  const columns = viz.x_key
    ? [viz.x_key, ...(viz.y_keys ?? [])]
    : Object.keys(viz.data[0] ?? {})

  const isChangeCol = (col: string) => col.toLowerCase() === 'change'

  const cellStyle = (col: string, val: unknown) => {
    if (!isChangeCol(col)) return 'text-[#ccccdd]'
    const s = String(val)
    if (s.startsWith('+')) return 'text-emerald-400 font-medium'
    if (s.startsWith('-')) return 'text-red-400 font-medium'
    return 'text-[#ccccdd]'
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            {columns.map(col => (
              <th
                key={col}
                className="text-left px-3 py-2 text-[#8888aa] font-medium border-b border-[#2a2a3a] whitespace-nowrap"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {viz.data.map((row, i) => (
            <tr key={i} className="border-b border-[#2a2a3a]/50 hover:bg-white/[0.02] transition-colors">
              {columns.map(col => (
                <td key={col} className={`px-3 py-2 ${cellStyle(col, row[col])} whitespace-nowrap`}>
                  {String(row[col] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main export ────────────────────────────────────────────────────────────
export function AnswerViz({ viz }: { viz: VizSpec }) {
  return (
    <div className="mt-3 rounded-xl border border-[#2a2a3a] bg-[#0e0e16] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-[#2a2a3a] flex items-center gap-2">
        <span className="text-xs font-medium text-[#8888aa] uppercase tracking-wider">
          {viz.type === 'pie' ? '◕' : viz.type === 'table' ? '⊞' : '▬'}&nbsp; Visualization
        </span>
        <span className="text-xs text-[#ccccdd] ml-1">{viz.title}</span>
      </div>

      {/* Chart area */}
      <div className="p-3">
        {viz.type === 'bar'         && <HorizontalBar viz={viz} />}
        {viz.type === 'grouped_bar' && <GroupedBar viz={viz} />}
        {viz.type === 'pie'         && <PieViz viz={viz} />}
        {viz.type === 'table'       && <TableViz viz={viz} />}
      </div>
    </div>
  )
}
