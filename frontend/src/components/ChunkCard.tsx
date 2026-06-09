import { cn, getScoreBadge } from '@/lib/utils'
import type { RetrievedChunk } from '@/types'

interface ChunkCardProps {
  chunk: RetrievedChunk
  expanded?: boolean
  onClick?: () => void
  rank?: number
}

export function ChunkCard({ chunk, expanded, onClick, rank }: ChunkCardProps) {
  // Display score is FAISS cosine similarity (stored in faiss_score when reranked,
  // otherwise chunk.score is already the FAISS score). Reranker is used for ordering.
  const displayScore = chunk.faiss_score ?? chunk.score
  const badge = getScoreBadge(displayScore)
  const hasRerank = chunk.reranked && chunk.rerank_score !== undefined

  return (
    <div
      className={cn(
        'rounded-lg border border-[#2a2a3a] bg-[#12121a] p-3 transition-all cursor-pointer hover:border-[#3a3a50]',
        expanded && 'border-indigo-500/30 bg-indigo-500/5'
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {rank !== undefined && (
            <span className="text-xs font-mono text-[#8888aa] shrink-0">#{rank + 1}</span>
          )}
          <span className="text-xs font-mono text-[#8888aa] truncate">{chunk.chunk_id}</span>
          {hasRerank && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-purple-500/15 border border-purple-500/25 text-purple-400 font-medium shrink-0">
              reranked
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="w-16 bg-[#2a2a3a] rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full bg-indigo-400"
              style={{ width: `${Math.min(displayScore * 200, 100)}%` }}
            />
          </div>
          <span className={cn('text-xs px-1.5 py-0.5 rounded border font-mono', badge.color)}>
            {displayScore.toFixed(3)}
          </span>
        </div>
      </div>

      {/* Score breakdown when reranked */}
      {hasRerank && expanded && (
        <div className="flex gap-3 mb-2 text-[10px] text-[#8888aa]">
          <span>Similarity: <span className="text-indigo-400 font-mono">{chunk.faiss_score?.toFixed(3)}</span></span>
          <span title="Cross-encoder relevance probability — used for ordering, not displayed as main score">
            Relevance: <span className="text-purple-400 font-mono">{chunk.rerank_score?.toFixed(3)}</span>
          </span>
        </div>
      )}

      <p className={cn(
        'text-xs text-[#aaaacc] leading-relaxed',
        expanded ? '' : 'line-clamp-2'
      )}>
        {chunk.text}
      </p>
      {!expanded && (
        <div className="mt-1.5 text-xs text-[#8888aa]">{chunk.source}</div>
      )}
    </div>
  )
}
