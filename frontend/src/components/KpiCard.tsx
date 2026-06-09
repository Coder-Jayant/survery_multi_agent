import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface KpiCardProps {
  label: string
  value: string | number
  sub?: string
  delta?: string
  deltaPositive?: boolean
  icon?: ReactNode
  accent?: boolean
  className?: string
}

export function KpiCard({ label, value, sub, delta, deltaPositive, icon, accent, className }: KpiCardProps) {
  return (
    <div className={cn(
      'rounded-xl border border-[#2a2a3a] bg-[#12121a] p-4 flex flex-col gap-2 transition-all hover:border-[#3a3a50]',
      accent && 'border-indigo-500/30 bg-indigo-500/5',
      className
    )}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[#8888aa] uppercase tracking-wider">{label}</span>
        {icon && <span className="text-[#8888aa]">{icon}</span>}
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-white">{value}</span>
        {delta && (
          <span className={cn(
            'text-xs font-medium mb-0.5',
            deltaPositive === true ? 'text-emerald-400' : deltaPositive === false ? 'text-red-400' : 'text-[#8888aa]'
          )}>
            {delta}
          </span>
        )}
      </div>
      {sub && <span className="text-xs text-[#8888aa]">{sub}</span>}
    </div>
  )
}

interface AIKpiCardProps {
  label: string
  value: string
  badge?: { text: string; variant: 'danger' | 'warning' | 'success' | 'info' }
  className?: string
}

export function AIKpiCard({ label, value, badge, className }: AIKpiCardProps) {
  const badgeColors = {
    danger: 'bg-red-500/15 text-red-400 border-red-500/25',
    warning: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
    success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    info: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/25',
  }
  return (
    <div className={cn(
      'rounded-xl border border-[#2a2a3a] bg-[#12121a] p-4 flex flex-col gap-2 hover:border-[#3a3a50] transition-all',
      className
    )}>
      <span className="text-xs font-medium text-[#8888aa] uppercase tracking-wider">{label}</span>
      <span className="text-sm font-semibold text-white leading-snug">{value}</span>
      {badge && (
        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border w-fit', badgeColors[badge.variant])}>
          {badge.text}
        </span>
      )}
    </div>
  )
}
