import { useCallback, useEffect } from 'react'
import ReactFlow, {
  Node, Edge, Background, Controls,
  useNodesState, useEdgesState, MarkerType,
  Handle, Position
} from 'reactflow'
import 'reactflow/dist/style.css'
import { cn, agentColor } from '@/lib/utils'

const AGENT_DESCRIPTIONS: Record<string, string> = {
  user: 'Entry point: question input',
  orchestrator: 'Plans execution via LLM function-calling. Routes TaskSpec objects to sub-agents.',
  data_agent: 'Computes exact metrics via Groq tool-calling loop (CSAT, ratings, themes).',
  rag_agent: 'FAISS similarity search + context summary. Grounds answers in FAQ policy.',
  comparison_agent: 'Runs DataAgent × 2, computes period deltas, identifies shifts.',
  summary_agent: 'Synthesizes all results into a coherent business narrative.',
}

interface AgentNodeData {
  label: string
  agent: string
  active?: boolean
  done?: boolean
}

function AgentNode({ data }: { data: AgentNodeData }) {
  const color = agentColor(data.agent)
  return (
    <div className={cn(
      'px-3 py-2.5 rounded-xl border text-center min-w-[120px] transition-all duration-300',
      data.active
        ? 'border-[--agent-color] bg-[color-mix(in_srgb,var(--agent-color)_15%,transparent)] shadow-lg'
        : data.done
        ? 'border-[--agent-color] bg-[color-mix(in_srgb,var(--agent-color)_8%,transparent)]'
        : 'border-[#2a2a3a] bg-[#1a1a26]'
    )} style={{ '--agent-color': color } as React.CSSProperties}>
      <Handle type="target" position={Position.Top} style={{ background: color, border: 'none', width: 8, height: 8 }} />
      <div className="flex items-center justify-center gap-1.5 mb-0.5">
        {data.active && <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: color }} />}
        {data.done && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color, opacity: 0.6 }} />}
        <span className="text-xs font-semibold text-white">{data.label}</span>
      </div>
      <p className="text-[9px] text-[#8888aa] leading-tight max-w-[140px]">
        {AGENT_DESCRIPTIONS[data.agent]?.slice(0, 50)}…
      </p>
      <Handle type="source" position={Position.Bottom} style={{ background: color, border: 'none', width: 8, height: 8 }} />
    </div>
  )
}

const nodeTypes = { agentNode: AgentNode }

const INITIAL_NODES: Node[] = [
  { id: 'user', type: 'agentNode', position: { x: 200, y: 0 }, data: { label: 'User', agent: 'user' } },
  { id: 'orchestrator', type: 'agentNode', position: { x: 160, y: 100 }, data: { label: 'Orchestrator', agent: 'orchestrator' } },
  { id: 'data_agent', type: 'agentNode', position: { x: 0, y: 230 }, data: { label: 'DataAgent', agent: 'data_agent' } },
  { id: 'comparison_agent', type: 'agentNode', position: { x: 160, y: 230 }, data: { label: 'ComparisonAgent', agent: 'comparison_agent' } },
  { id: 'rag_agent', type: 'agentNode', position: { x: 320, y: 230 }, data: { label: 'RAGAgent', agent: 'rag_agent' } },
  { id: 'summary_agent', type: 'agentNode', position: { x: 160, y: 360 }, data: { label: 'SummaryAgent', agent: 'summary_agent' } },
]

const INITIAL_EDGES: Edge[] = [
  { id: 'u-o', source: 'user', target: 'orchestrator', animated: false },
  { id: 'o-da', source: 'orchestrator', target: 'data_agent', animated: false },
  { id: 'o-ca', source: 'orchestrator', target: 'comparison_agent', animated: false },
  { id: 'o-ra', source: 'orchestrator', target: 'rag_agent', animated: false },
  { id: 'da-sa', source: 'data_agent', target: 'summary_agent', animated: false },
  { id: 'ca-sa', source: 'comparison_agent', target: 'summary_agent', animated: false },
  { id: 'ra-sa', source: 'rag_agent', target: 'summary_agent', animated: false },
].map(e => ({
  ...e,
  style: { stroke: '#2a2a3a' },
  markerEnd: { type: MarkerType.ArrowClosed, color: '#2a2a3a' },
}))

interface AgentGraphProps {
  activeAgents?: string[]
  doneAgents?: string[]
  /** compact: render a smaller, non-interactive version for side panels */
  compact?: boolean
  /** disableZoom: lock zoom (scroll, pinch, double-click) */
  disableZoom?: boolean
}

export function AgentGraph({ activeAgents = [], doneAgents = [], compact = false, disableZoom = false }: AgentGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES)
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES)

  useEffect(() => {
    setNodes(ns => ns.map(n => ({
      ...n,
      data: {
        ...n.data,
        active: activeAgents.includes(n.id),
        done: doneAgents.includes(n.id),
      }
    })))
    setEdges(es => es.map(e => {
      const targetActive = activeAgents.includes(e.target)
      const targetDone = doneAgents.includes(e.target)
      const color = targetActive || targetDone ? agentColor(e.target) : '#2a2a3a'
      return {
        ...e,
        animated: targetActive,
        style: { stroke: color },
        markerEnd: { type: MarkerType.ArrowClosed, color },
      }
    }))
  }, [activeAgents, doneAgents, setNodes, setEdges])

  if (compact) {
    return (
      <div className="w-full h-[200px] rounded-lg bg-[#0e0e16] overflow-hidden">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          minZoom={0.3}
          maxZoom={1}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
        >
          <Background color="#1a1a26" gap={16} size={1} />
        </ReactFlow>
      </div>
    )
  }

  return (
    <div className="w-full h-[480px] rounded-xl border border-[#2a2a3a] bg-[#0e0e16] overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.5}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
        zoomOnScroll={!disableZoom}
        zoomOnPinch={!disableZoom}
        zoomOnDoubleClick={!disableZoom}
      >
        <Background color="#2a2a3a" gap={20} size={1} />
        {!disableZoom && <Controls className="bg-[#1a1a26] border-[#2a2a3a]" />}
      </ReactFlow>
    </div>
  )
}
