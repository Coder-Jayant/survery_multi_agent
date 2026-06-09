import type {
  DashboardResponse,
  AnalyticsTrends,
  MonthlyMetrics,
  KBChunk,
  KBInfo,
  RetrievalResult,
  EvalResults,
  AppConfig,
  PromptRegistry,
  RunRecord,
  FinalAnswer,
  SSEEvent,
} from '@/types'

const BASE = ''

// ── Simple in-memory GET cache with TTL ──────────────────────────────────────
// Avoids re-fetching static/slow-changing endpoints on every page navigation.
// Key = URL, value = { data, expiresAt }
const _cache = new Map<string, { data: unknown; expiresAt: number }>()

const CACHE_TTL: Record<string, number> = {
  '/api/dashboard':        5 * 60_000,  // 5 min — heavy LLM call
  '/api/analytics/trends': 5 * 60_000,  // 5 min — static dataset
  '/api/analytics/compare':3 * 60_000,  // 3 min
  '/api/analytics/channels':3 * 60_000, // 3 min
  '/api/knowledge/chunks': 10 * 60_000, // 10 min — only changes after rebuild
  '/api/knowledge/list':   10 * 60_000,
  '/api/agents/prompts':   5 * 60_000,
  '/api/config':           5 * 60_000,
  '/api/eval/results':     2 * 60_000,  // 2 min
  '/health':               60_000,      // 1 min
}

function _ttlFor(path: string): number {
  for (const [prefix, ttl] of Object.entries(CACHE_TTL)) {
    if (path.startsWith(prefix)) return ttl
  }
  return 0  // no cache for unknown paths
}

async function get<T>(path: string): Promise<T> {
  const ttl = _ttlFor(path)
  if (ttl > 0) {
    const cached = _cache.get(path)
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data as T
    }
  }

  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GET ${path} → ${res.status}: ${text}`)
  }
  const data = await res.json()

  if (ttl > 0) {
    _cache.set(path, { data, expiresAt: Date.now() + ttl })
  }
  return data as T
}

/** Call this to manually bust cache for a specific path prefix (e.g. after rebuild). */
export function bustCache(prefix: string) {
  for (const key of _cache.keys()) {
    if (key.startsWith(prefix)) _cache.delete(key)
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`POST ${path} → ${res.status}: ${text}`)
  }
  return res.json()
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`PUT ${path} → ${res.status}: ${text}`)
  }
  return res.json()
}

// ── Health ─────────────────────────────────────────────────────────────────

export const api = {
  health: () => get<{ status: string; service: string }>('/health'),

  // ── Ask / Stream ──────────────────────────────────────────────────────────
  ask: (question: string) =>
    post<FinalAnswer>('/ask', { question }),

  streamUrl: (question: string) =>
    `/stream?question=${encodeURIComponent(question)}`,

  // ── Dashboard ─────────────────────────────────────────────────────────────
  dashboard: (period = 'may') =>
    get<DashboardResponse>(`/api/dashboard?period=${period}`),

  // ── Analytics ─────────────────────────────────────────────────────────────
  analyticsTrends: () =>
    get<AnalyticsTrends>('/api/analytics/trends'),

  analyticsCompare: (a = 'apr', b = 'may') =>
    get<MonthlyMetrics>(`/api/analytics/compare?a=${a}&b=${b}`),

  analyticsChannels: (period = 'may') =>
    get<Record<string, number>>(`/api/analytics/channels?period=${period}`),

  // ── Knowledge Base ─────────────────────────────────────────────────────────
  kbChunks: () =>
    get<{ chunks: KBChunk[] }>('/api/knowledge/chunks'),

  kbRetrieve: (query: string, top_k = 3) =>
    post<RetrievalResult>('/api/knowledge/retrieve', { query, top_k }),

  kbList: () =>
    get<{ knowledge_bases: KBInfo[] }>('/api/knowledge/list'),

  kbRebuild: () =>
    post<{ message: string }>('/api/knowledge/rebuild', {}),

  // ── Agents / Prompts ──────────────────────────────────────────────────────
  getPrompts: () =>
    get<PromptRegistry>('/api/agents/prompts'),

  updatePrompt: (agent: string, prompt: string) =>
    put<{ message: string }>(`/api/agents/prompts/${agent}`, { prompt }),

  // ── Config ────────────────────────────────────────────────────────────────
  getConfig: () =>
    get<AppConfig>('/api/config'),

  updateConfig: (config: Partial<AppConfig>) =>
    put<{ message: string }>('/api/config', config),

  // ── Evaluation ────────────────────────────────────────────────────────────
  evalResults: () =>
    get<EvalResults>('/api/eval/results'),

  evalRunUrl: () => '/api/eval/run',

  // ── Data ──────────────────────────────────────────────────────────────────
  dataList: () =>
    get<{ datasets: string[] }>('/api/data/list'),

  dataGenerate: (params: { months?: string[]; records?: number }) =>
    post<{ message: string; file: string }>('/api/data/generate', params),

  // ── History ───────────────────────────────────────────────────────────────
  history: () =>
    get<{ runs: RunRecord[] }>('/api/history'),
}

// ── SSE Helper ───────────────────────────────────────────────────────────────

export function createSSEStream(
  question: string,
  onEvent: (event: SSEEvent) => void,
  onDone: () => void,
  onError: (err: string) => void,
): () => void {
  const url = api.streamUrl(question)
  const es = new EventSource(url)
  let finished = false
  let closedByUs = false

  const close = () => {
    closedByUs = true
    es.close()
  }

  es.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data) as SSEEvent
      onEvent(data)
      if (data.type === 'done') {
        finished = true
        close()
        onDone()
      } else if (data.type === 'error') {
        finished = true
        close()
        onError(data.message ?? 'Stream error')
      }
    } catch {
      // ignore malformed chunks
    }
  }

  // Mobile browsers often fire onerror after a normal stream close — ignore those.
  es.onerror = () => {
    if (finished || closedByUs) return
    finished = true
    close()
    onError('Connection lost — check network and retry')
  }

  return () => {
    finished = true
    close()
  }
}
