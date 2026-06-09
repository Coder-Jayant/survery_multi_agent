import { useEffect, useState } from 'react'
import { Search, Database, RefreshCw, FileText, Zap } from 'lucide-react'
import { api } from '@/lib/api'
import { ChunkCard } from '@/components/ChunkCard'
import { cn } from '@/lib/utils'
import type { KBChunk, KBInfo, RetrievedChunk, RetrievalResult } from '@/types'

export function KnowledgeBase() {
  const [chunks, setChunks] = useState<KBChunk[]>([])
  const [kbs, setKbs] = useState<KBInfo[]>([])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<RetrievedChunk[]>([])
  const [retrivalMeta, setRetrievalMeta] = useState<{ reranked: boolean } | null>(null)
  const [loading, setLoading] = useState(true)
  const [retrieving, setRetrieving] = useState(false)
  const [rebuilding, setRebuilding] = useState(false)
  const [rebuildMsg, setRebuildMsg] = useState('')
  const [selectedChunk, setSelectedChunk] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([api.kbChunks(), api.kbList()])
      .then(([c, k]) => {
        setChunks(c.chunks)
        setKbs(k.knowledge_bases)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const retrieve = async () => {
    if (!query.trim()) return
    setRetrieving(true)
    setResults([])
    try {
      const res = await api.kbRetrieve(query, 5) as RetrievalResult
      setResults(res.chunks)
      setRetrievalMeta({ reranked: res.reranked ?? false })
    } catch (e) {
      console.error(e)
    } finally {
      setRetrieving(false)
    }
  }

  const rebuild = async () => {
    setRebuilding(true)
    setRebuildMsg('')
    try {
      const r = await api.kbRebuild()
      setRebuildMsg(r.message)
    } catch (e) {
      setRebuildMsg('Rebuild failed')
    } finally {
      setRebuilding(false)
    }
  }

  const selectedChunkData = chunks.find(c => c.chunk_id === selectedChunk)

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Knowledge Base</h1>
          <p className="text-sm text-[#8888aa] mt-0.5">FAISS vector store — retrieval inspection & testing</p>
        </div>
        <button
          onClick={rebuild}
          disabled={rebuilding}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#2a2a3a] text-sm text-[#8888aa] hover:text-white hover:border-[#3a3a50] bg-[#1a1a26] transition-all disabled:opacity-50"
        >
          <RefreshCw className={cn('w-4 h-4', rebuilding && 'animate-spin')} />
          Rebuild Index
        </button>
      </div>
      {rebuildMsg && <div className="text-sm text-emerald-400">{rebuildMsg}</div>}

      {/* KB Info Cards */}
      {kbs.map(kb => (
        <div key={kb.name} className="rounded-xl border border-[#2a2a3a] bg-[#12121a] p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Database className="w-5 h-5 text-indigo-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">{kb.name}</span>
                {kb.active && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 text-emerald-400">
                    ACTIVE
                  </span>
                )}
              </div>
              <p className="text-xs text-[#8888aa] mt-0.5">{kb.source_file}</p>
            </div>
            <div className="flex gap-4 text-xs text-[#8888aa] flex-wrap">
              <div><span className="text-white font-medium">{kb.chunk_count}</span> chunks</div>
              <div>bi-encoder: <span className="text-white font-medium">{kb.embedding_model}</span></div>
              <div><span className="text-white font-medium">{kb.index_type}</span></div>
              {(kb as any).reranker_active && (
                <div className="flex items-center gap-1">
                  <Zap className="w-3 h-3 text-purple-400" />
                  <span className="text-purple-300 font-medium">reranker active</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Chunk Browser */}
        <div className="rounded-xl border border-[#2a2a3a] bg-[#12121a] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#2a2a3a] flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-semibold text-white">Chunks</span>
            <span className="ml-auto text-xs text-[#8888aa]">{chunks.length} indexed</span>
          </div>
          <div className="overflow-y-auto max-h-[500px]">
            {loading ? (
              <div className="p-4 text-[#8888aa] text-sm animate-pulse">Loading chunks…</div>
            ) : (
              <div className="divide-y divide-[#2a2a3a]">
                {chunks.map(chunk => (
                  <div
                    key={chunk.chunk_id}
                    onClick={() => setSelectedChunk(selectedChunk === chunk.chunk_id ? null : chunk.chunk_id)}
                    className={cn(
                      'px-4 py-3 cursor-pointer hover:bg-[#1a1a26] transition-colors',
                      selectedChunk === chunk.chunk_id && 'bg-indigo-500/5 border-l-2 border-indigo-500'
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono text-indigo-400">{chunk.chunk_id}</span>
                      {chunk.token_count && (
                        <span className="text-[10px] text-[#8888aa]">{chunk.token_count} tokens</span>
                      )}
                    </div>
                    <p className={cn('text-xs text-[#aaaacc] leading-relaxed', selectedChunk === chunk.chunk_id ? '' : 'line-clamp-2')}>
                      {chunk.text}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Retrieval Tester */}
        <div className="rounded-xl border border-[#2a2a3a] bg-[#12121a] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#2a2a3a] flex items-center gap-2">
            <Search className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-semibold text-white">Retrieval Tester</span>
            {retrivalMeta?.reranked && (
              <span className="ml-auto flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-purple-500/25 bg-purple-500/10 text-purple-400">
                <Zap className="w-3 h-3" />2-stage reranked
              </span>
            )}
          </div>
          <div className="p-4 space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && retrieve()}
                placeholder="Type a query to test retrieval…"
                className="flex-1 bg-[#1a1a26] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-white placeholder-[#8888aa] focus:outline-none focus:border-indigo-500/50 transition-all"
              />
              <button
                onClick={retrieve}
                disabled={retrieving || !query.trim()}
                className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 text-sm text-white font-medium transition-all"
              >
                {retrieving ? '…' : 'Retrieve'}
              </button>
            </div>

            <div className="space-y-2">
              {results.length === 0 && !retrieving && (
                <div className="text-center text-xs text-[#8888aa] py-8">Results will appear here</div>
              )}
              {retrieving && (
                <div className="text-center text-xs text-[#8888aa] py-8 animate-pulse">Searching FAISS index…</div>
              )}
              {results.map((r, i) => (
                <ChunkCard
                  key={r.chunk_id}
                  chunk={r}
                  rank={i}
                  expanded={selectedChunk === r.chunk_id}
                  onClick={() => setSelectedChunk(selectedChunk === r.chunk_id ? null : r.chunk_id)}
                />
              ))}
            </div>

            {results.length > 0 && (
              <div className="rounded-lg border border-[#2a2a3a] bg-[#1a1a26] p-3 text-xs space-y-1.5">
                <div className="font-medium text-[#8888aa] uppercase tracking-wider">Retrieval Info</div>
                <div className="flex justify-between">
                  <span className="text-[#8888aa]">Embedding model</span>
                  <span className="text-white font-mono">all-MiniLM-L6-v2</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8888aa]">Index type</span>
                  <span className="text-white font-mono">FAISS IndexFlatIP</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8888aa]">Similarity metric</span>
                  <span className="text-white font-mono">cosine (L2 norm)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8888aa]">Dimensions</span>
                  <span className="text-white font-mono">384</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
