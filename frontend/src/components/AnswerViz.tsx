import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  PieChart, Pie, Legend, ResponsiveContainer,
  LineChart, Line, Area, AreaChart, CartesianGrid, ReferenceLine,
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

// ── NEW: Line / Area chart (weekly trend, multi-period arc) ────────────────
function LineViz({ viz }: { viz: VizSpec }) {
  const xKey     = viz.x_key ?? 'label'
  const valueKey = viz.value_key ?? 'value'
  const unit     = viz.unit ?? ''
  const color    = (viz.colors?.[0]) ?? '#6366f1'

  // Draw a reference line at 50% CSAT if this is a % chart
  const showRef = unit === '%'

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={viz.data} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={color} stopOpacity={0.25} />
            <stop offset="95%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" vertical={false} />
        <XAxis
          dataKey={xKey}
          tick={{ fill: '#8888aa', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: '#8888aa', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}${unit}`}
        />
        <Tooltip
          content={<CustomTooltip unit={unit} />}
          cursor={{ stroke: '#4444aa', strokeWidth: 1 }}
        />
        {showRef && (
          <ReferenceLine
            y={50}
            stroke="#f59e0b"
            strokeDasharray="4 4"
            strokeOpacity={0.5}
            label={{ value: '50% target', fill: '#f59e0b', fontSize: 9, position: 'insideTopRight' }}
          />
        )}
        <Area
          type="monotone"
          dataKey={valueKey}
          stroke={color}
          strokeWidth={2}
          fill="url(#lineGrad)"
          dot={{ fill: color, r: 3, strokeWidth: 0 }}
          activeDot={{ r: 5, fill: color, stroke: '#fff', strokeWidth: 1.5 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ── NEW: HeatBar — ranked theme list with inline color-coded CSAT bars ─────
function HeatBarViz({ viz }: { viz: VizSpec }) {
  const rows    = viz.data
  const maxCsat = Math.max(...rows.map(r => Number(r.value ?? r.csat ?? 0)), 1)

  return (
    <div className="space-y-2.5 py-1">
      {rows.map((row, i) => {
        const theme  = String(row[viz.x_key ?? 'theme'] ?? '')
        const csat   = Number(row[viz.value_key ?? 'csat'] ?? 0)
        const count  = Number(row.count ?? 0)
        const color  = String(row.color ?? (viz.colors?.[i] ?? '#6366f1'))
        const pct    = Math.round((csat / maxCsat) * 100)

        return (
          <div key={i} className="group">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-[#ccccdd] font-medium">{theme}</span>
              <div className="flex items-center gap-2 text-xs">
                {count > 0 && <span className="text-[#8888aa]">{count.toLocaleString()} resp.</span>}
                <span className="font-mono font-bold" style={{ color }}>{csat.toFixed(1)}%</span>
              </div>
            </div>
            <div className="h-2 rounded-full bg-[#2a2a3a] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${pct}%`, background: color }}
              />
            </div>
          </div>
        )
      })}
      <p className="text-[10px] text-[#8888aa] pt-1">Sorted worst CSAT first. Bar length is relative to highest value.</p>
    </div>
  )
}

// ── NEW: Scorecard — segment spotlight with metric tiles ───────────────────
function ScorecardViz({ viz }: { viz: VizSpec }) {
  const accentColor = viz.colors?.[0] ?? '#6366f1'

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {viz.data.map((row, i) => {
        const label = String(row[viz.x_key ?? 'label'] ?? '')
        const value = String(row[viz.value_key ?? 'value'] ?? '')
        const color = String(row.color ?? (i === 1 ? accentColor : '#ccccdd'))
        const isAccent = i === 1   // CSAT card gets accent treatment

        return (
          <div
            key={i}
            className={`rounded-lg border p-3 text-center transition-all ${
              isAccent
                ? 'border-[#3a3a50] bg-[#1a1a26]'
                : 'border-[#2a2a3a] bg-[#12121a]'
            }`}
          >
            <p className="text-[10px] text-[#8888aa] uppercase tracking-wider mb-1">{label}</p>
            <p
              className="text-sm font-bold leading-tight break-all"
              style={{ color: row.color ? color : (isAccent ? accentColor : '#ffffff') }}
            >
              {value}
            </p>
          </div>
        )
      })}
    </div>
  )
}

// ── Chart type icon ─────────────────────────────────────────────────────────
function vizIcon(type: string): string {
  if (type === 'pie')       return '◕'
  if (type === 'table')     return '⊞'
  if (type === 'line')      return '〜'
  if (type === 'heatbar')   return '▦'
  if (type === 'scorecard') return '◈'
  return '▬'
}

// ── Main export ────────────────────────────────────────────────────────────
export function AnswerViz({ viz }: { viz: VizSpec }) {
  return (
    <div className="mt-3 rounded-xl border border-[#2a2a3a] bg-[#0e0e16] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-[#2a2a3a] flex items-center gap-2">
        <span className="text-xs font-medium text-[#8888aa] uppercase tracking-wider">
          {vizIcon(viz.type)}&nbsp; Visualization
        </span>
        <span className="text-xs text-[#ccccdd] ml-1">{viz.title}</span>
      </div>

      {/* Chart area */}
      <div className="p-3">
        {viz.type === 'bar'         && <HorizontalBar viz={viz} />}
        {viz.type === 'grouped_bar' && <GroupedBar viz={viz} />}
        {viz.type === 'pie'         && <PieViz viz={viz} />}
        {viz.type === 'table'       && <TableViz viz={viz} />}
        {viz.type === 'line'        && <LineViz viz={viz} />}
        {viz.type === 'heatbar'     && <HeatBarViz viz={viz} />}
        {viz.type === 'scorecard'   && <ScorecardViz viz={viz} />}
      </div>
    </div>
  )
}
