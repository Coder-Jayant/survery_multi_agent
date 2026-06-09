// TypeScript interfaces mirroring backend Pydantic schemas

export interface DateRange {
  start: string
  end: string
}

export interface TaskSpec {
  task_id: string
  agent: string
  intent: string
  filters: Record<string, unknown>
  context: Record<string, unknown>
}

export interface ThemeCount {
  theme: string
  count: number
  percentage: number
}

export interface RetrievedChunk {
  chunk_id: string
  text: string
  score: number          // primary score (rerank_score if reranked, else faiss_score)
  source: string
  faiss_score?: number   // Stage 1 cosine similarity
  rerank_score?: number  // Stage 2 cross-encoder logit
  reranked?: boolean     // whether two-stage retrieval was used
}

export interface DataAgentResult {
  period_label: string
  date_range: DateRange
  total_responses: number
  avg_rating: number
  csat_score: number
  top_themes: ThemeCount[]
  rating_distribution: Record<string, number>
  tool_trace: string[]
}

export interface RAGAgentResult {
  query: string
  retrieved_chunks: RetrievedChunk[]
  context_summary: string
}

export interface ComparisonAgentResult {
  period_a: DataAgentResult
  period_b: DataAgentResult
  delta_csat: number
  delta_avg_rating: number
  emerging_themes: string[]
  declining_themes: string[]
  insight_summary: string
}

export interface SummaryAgentResult {
  narrative: string
  key_metrics: Record<string, unknown>
}

export interface FinalAnswer {
  question: string
  narrative: string
  supporting_data: Record<string, unknown>
  sources: string[]
  agent_trace: string[]
}

// Dashboard types
export interface DashboardKPIs {
  period: string
  csat_score: number
  avg_rating: number
  total_responses: number
  mom_delta_csat: number | null
  top_themes: ThemeCount[]
  rating_distribution: Record<string, number>
  channels: Record<string, number>
  health_score: number
  top_complaint: string
}

export interface DashboardAI {
  executive_brief: string
  insights: Array<{
    icon: string
    text: string
    type: 'warning' | 'trend' | 'positive' | 'info'
  }>
  operational_priority: string
  highest_risk_area: string
  fastest_growing_issue: string
  best_performing_area: string
}

export interface DashboardResponse {
  kpis: DashboardKPIs
  ai: DashboardAI
}

// Analytics types
export interface MonthlyMetrics {
  month: string
  label: string
  csat_score: number
  avg_rating: number
  total_responses: number
  top_themes: ThemeCount[]
  rating_distribution: Record<string, number>
  channels: Record<string, number>
}

export interface AnalyticsTrends {
  months: MonthlyMetrics[]
}

// Knowledge Base types
export interface KBChunk {
  chunk_id: string
  text: string
  source: string
  token_count?: number
}

export interface KBInfo {
  name: string
  active: boolean
  chunk_count: number
  embedding_model: string
  index_type: string
  source_file: string
}

export interface RetrievalResult {
  query: string
  chunks: RetrievedChunk[]
  reranked?: boolean
}

// Eval types
export interface EvalQuestion {
  question: string
  top_chunk_id: string
  top_chunk_score: number
  top_chunk_preview: string
  answer_preview: string
  quality: 'high' | 'medium' | 'low'
  notes: string
}

export interface EvalResults {
  avg_chunk_score: number
  top1_precision: number
  avg_latency_s: number
  agent_success_rate: number
  questions: EvalQuestion[]
  run_at: string
}

// Config types
export interface AppConfig {
  provider: string
  model: string
  api_keys: Record<string, string>
  embedding_model: string
  retrieval: {
    top_k: number
    strategy: string
    score_threshold: number
  }
  active_kb: string
  active_dataset: string
  temperature: number
  max_tokens: number
}

export interface PromptRegistry {
  orchestrator: string
  data_agent: string
  rag_agent: string
  summary_agent: string
}

// Run history
export interface RunRecord {
  id: string
  timestamp: string
  question: string
  agent_trace: string[]
  narrative_preview: string
  latency_ms: number
  supporting_data: Record<string, unknown>
  sources: string[]
}

// Visualization spec (mirrors backend VizSpec Pydantic model)
export interface VizSpec {
  type: 'bar' | 'grouped_bar' | 'pie' | 'table'
  title: string
  data: Array<Record<string, unknown>>
  x_key?: string
  y_keys?: string[]
  value_key?: string
  colors?: string[]
  unit?: string
}

// SSE event types
export type SSEEvent =
  | { type: 'plan'; tasks: Array<{ agent: string; intent: string }>; count: number }
  | { type: 'agent_start'; step: number; total: number; agent: string; intent: string }
  | { type: 'tool_call'; agent: string; tool: string; args: Record<string, unknown> }
  | { type: 'tool_result'; agent: string; tool: string; result: string }
  | { type: 'agent_done'; agent: string; step: number; result: Record<string, unknown> }
  | { type: 'done'; answer: { narrative: string; metrics: Record<string, unknown>; sources: string[]; trace: string[]; visualization?: VizSpec | null } }
  | { type: 'error'; message: string }
  | { type: 'llm_warning'; reason: string }
