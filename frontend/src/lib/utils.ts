import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}

export function formatRating(value: number): string {
  return value.toFixed(2)
}

export function formatNumber(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`
  return value.toString()
}

export function formatDelta(value: number, decimals = 1): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)}pp`
}

export function getDeltaColor(value: number): string {
  if (value > 0) return 'text-emerald-400'
  if (value < 0) return 'text-red-400'
  return 'text-gray-400'
}

export function getHealthColor(score: number): string {
  if (score >= 70) return '#10b981'
  if (score >= 40) return '#f59e0b'
  return '#ef4444'
}

export function getScoreColor(score: number): string {
  if (score >= 0.5) return 'text-emerald-400'
  if (score >= 0.3) return 'text-yellow-400'
  return 'text-red-400'
}

export function getScoreBadge(score: number): { label: string; color: string } {
  if (score >= 0.5) return { label: 'High', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' }
  if (score >= 0.3) return { label: 'Medium', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' }
  return { label: 'Low', color: 'bg-red-500/20 text-red-400 border-red-500/30' }
}

export function themeColor(theme: string): string {
  const colors: Record<string, string> = {
    food_quality: '#6366f1',
    wait_time: '#f59e0b',
    staff: '#10b981',
    cleanliness: '#3b82f6',
    price: '#ec4899',
    app: '#ef4444',
    general: '#8888aa',
  }
  return colors[theme] ?? '#8888aa'
}

export function themeLabel(theme: string): string {
  const labels: Record<string, string> = {
    food_quality: 'Food Quality',
    wait_time: 'Wait Time',
    staff: 'Staff',
    cleanliness: 'Cleanliness',
    price: 'Price',
    app: 'App / Digital',
    general: 'General',
  }
  return labels[theme] ?? theme
}

export function agentColor(agent: string): string {
  const colors: Record<string, string> = {
    orchestrator: '#6366f1',
    data_agent: '#3b82f6',
    rag_agent: '#10b981',
    comparison_agent: '#f59e0b',
    summary_agent: '#ec4899',
  }
  return colors[agent] ?? '#8888aa'
}

export function agentLabel(agent: string): string {
  const labels: Record<string, string> = {
    orchestrator: 'Orchestrator',
    data_agent: 'DataAgent',
    rag_agent: 'RAGAgent',
    comparison_agent: 'ComparisonAgent',
    summary_agent: 'SummaryAgent',
  }
  return labels[agent] ?? agent
}

export function timeAgo(isoDate: string): string {
  const now = Date.now()
  const then = new Date(isoDate).getTime()
  const diff = Math.floor((now - then) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
