import { cn, agentColor, agentLabel } from '@/lib/utils'

const AGENT_BG: Record<string, string> = {
  orchestrator: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/25',
  data_agent: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  rag_agent: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  comparison_agent: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
  summary_agent: 'bg-pink-500/15 text-pink-400 border-pink-500/25',
}

interface AgentBadgeProps {
  agent: string
  size?: 'sm' | 'md'
  active?: boolean
}

export function AgentBadge({ agent, size = 'sm', active }: AgentBadgeProps) {
  const baseClass = AGENT_BG[agent] ?? 'bg-gray-500/15 text-gray-400 border-gray-500/25'
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full border font-medium',
      size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
      baseClass,
      active && 'animate-pulse-soft ring-1',
    )}>
      {active && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
      {agentLabel(agent)}
    </span>
  )
}

interface AgentDotProps {
  agent: string
  active?: boolean
}

export function AgentDot({ agent, active }: AgentDotProps) {
  return (
    <span
      className={cn('inline-block w-2 h-2 rounded-full', active && 'animate-pulse')}
      style={{ backgroundColor: agentColor(agent) }}
    />
  )
}
