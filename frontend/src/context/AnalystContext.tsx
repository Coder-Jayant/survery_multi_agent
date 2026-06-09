import { createContext, useContext, useState, type ReactNode } from 'react'
import type { RetrievedChunk, VizSpec } from '@/types'

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

interface AnalystState {
  messages: Message[]
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  traceSteps: TraceStep[]
  setTraceSteps: React.Dispatch<React.SetStateAction<TraceStep[]>>
  activeChunks: RetrievedChunk[]
  setActiveChunks: React.Dispatch<React.SetStateAction<RetrievedChunk[]>>
  activeMetrics: Record<string, unknown>
  setActiveMetrics: React.Dispatch<React.SetStateAction<Record<string, unknown>>>
  clearAll: () => void
}

const AnalystContext = createContext<AnalystState | null>(null)

export function AnalystProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [traceSteps, setTraceSteps] = useState<TraceStep[]>([])
  const [activeChunks, setActiveChunks] = useState<RetrievedChunk[]>([])
  const [activeMetrics, setActiveMetrics] = useState<Record<string, unknown>>({})

  const clearAll = () => {
    setMessages([])
    setTraceSteps([])
    setActiveChunks([])
    setActiveMetrics({})
  }

  return (
    <AnalystContext.Provider value={{
      messages, setMessages,
      traceSteps, setTraceSteps,
      activeChunks, setActiveChunks,
      activeMetrics, setActiveMetrics,
      clearAll,
    }}>
      {children}
    </AnalystContext.Provider>
  )
}

export function useAnalyst() {
  const ctx = useContext(AnalystContext)
  if (!ctx) throw new Error('useAnalyst must be used within AnalystProvider')
  return ctx
}
