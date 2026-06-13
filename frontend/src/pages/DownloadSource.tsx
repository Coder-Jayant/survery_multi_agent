import { useState, useEffect } from 'react'
import { Download, FileArchive, ShieldCheck, BookOpen, Eye, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const EXCLUDES = [
  '.env files & API keys (config.json keys stripped)',
  '.venv / venv / node_modules',
  '__pycache__ & build caches',
]

const INCLUDED_DOCS = [
  { label: 'ASSIGNMENT_SUBMISSION.md', desc: 'Start here — approach, assumptions, checklist' },
  { label: 'README.md', desc: 'Setup & run instructions, architecture overview' },
  { label: 'ARCHITECTURE.md', desc: 'System design & diagrams' },
  { label: 'INTERVIEW_PREP.md', desc: 'Design rationale & demo script' },
  { label: 'walkthrough.md', desc: 'Build summary & test outputs' },
]

// ── Very lightweight Markdown → HTML renderer (no deps) ────────────────────
// Handles: headings, bold, inline code, code blocks, tables, hr, lists, links
function renderMarkdown(md: string): string {
  let html = md
    // Escape HTML entities first to prevent XSS
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Code blocks (```)
  html = html.replace(/```[\w]*\n([\s\S]*?)```/g, (_, code) =>
    `<pre class="md-code"><code>${code.trimEnd()}</code></pre>`)

  // Tables — detect lines with | separators
  html = html.replace(/((?:\|.+\|\n)+)/g, (block) => {
    const rows = block.trim().split('\n').filter(r => !/^\|[-| :]+\|$/.test(r))
    if (rows.length < 1) return block
    const toTd = (r: string, tag: string) =>
      '<tr>' + r.split('|').filter((_, i, a) => i > 0 && i < a.length - 1)
        .map(c => `<${tag} class="md-td">${c.trim()}</${tag}>`).join('') + '</tr>'
    const [head, ...body] = rows
    return `<table class="md-table"><thead>${toTd(head, 'th')}</thead><tbody>${body.map(r => toTd(r, 'td')).join('')}</tbody></table>`
  })

  // Horizontal rule
  html = html.replace(/^---+$/gm, '<hr class="md-hr" />')

  // Headings
  html = html.replace(/^#{6} (.+)$/gm, '<h6 class="md-h6">$1</h6>')
  html = html.replace(/^#{5} (.+)$/gm, '<h5 class="md-h5">$1</h5>')
  html = html.replace(/^#{4} (.+)$/gm, '<h4 class="md-h4">$1</h4>')
  html = html.replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2 class="md-h2">$1</h2>')
  html = html.replace(/^# (.+)$/gm, '<h1 class="md-h1">$1</h1>')

  // Blockquotes (> NOTE / TIP etc.)
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote class="md-bq">$1</blockquote>')

  // Unordered lists
  html = html.replace(/^[*\-] (.+)$/gm, '<li class="md-li">$1</li>')
  html = html.replace(/(<li[\s\S]*?<\/li>(?:\n<li[\s\S]*?<\/li>)*)/g,
    m => `<ul class="md-ul">${m}</ul>`)

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="md-oli">$1</li>')

  // Bold + italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="md-bold">$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="md-icode">$1</code>')

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
    '<a class="md-link" href="$2" target="_blank" rel="noopener">$1</a>')

  // Paragraphs — double newline → <p>
  html = html.replace(/\n\n(?!<)/g, '</p><p class="md-p">')
  html = `<p class="md-p">${html}</p>`

  // Remove empty <p> wrapping block elements
  html = html.replace(/<p class="md-p">(<(?:h[1-6]|pre|table|ul|blockquote|hr)[^>]*>)/g, '$1')
  html = html.replace(/(<\/(?:h[1-6]|pre|table|ul|blockquote|hr)>)<\/p>/g, '$1')

  return html
}

// ── Injected styles for the markdown preview ───────────────────────────────
const MD_STYLES = `
  .md-h1  { font-size:1.5rem;  font-weight:800; color:#fff;       margin:1.5rem 0 .75rem; border-bottom:1px solid #2a2a3a; padding-bottom:.4rem; }
  .md-h2  { font-size:1.15rem; font-weight:700; color:#e0e0f0;    margin:1.25rem 0 .5rem; }
  .md-h3  { font-size:1rem;    font-weight:600; color:#c0c0d8;    margin:1rem 0 .4rem; }
  .md-h4,.md-h5,.md-h6 { font-size:.9rem; font-weight:600; color:#a0a0c0; margin:.75rem 0 .3rem; }
  .md-p   { color:#ccccdd; font-size:.82rem; line-height:1.7; margin:.4rem 0; }
  .md-bold { color:#fff; }
  .md-hr  { border:none; border-top:1px solid #2a2a3a; margin:1.25rem 0; }
  .md-bq  { border-left:3px solid #6366f1; padding:.4rem .8rem; background:#1a1a2a; border-radius:0 6px 6px 0; margin:.5rem 0; color:#aaaacc; font-size:.8rem; }
  .md-ul  { padding-left:1.2rem; margin:.4rem 0; }
  .md-li,.md-oli { color:#ccccdd; font-size:.82rem; line-height:1.7; margin:.15rem 0; }
  .md-code { background:#0e0e16; border:1px solid #2a2a3a; border-radius:8px; padding:.75rem 1rem; overflow-x:auto; margin:.75rem 0; }
  .md-code code { color:#a5b4fc; font-family:monospace; font-size:.78rem; white-space:pre; }
  .md-icode { background:#1e1e2e; color:#a5b4fc; padding:.1rem .35rem; border-radius:4px; font-family:monospace; font-size:.8rem; }
  .md-table { width:100%; border-collapse:collapse; margin:.75rem 0; font-size:.78rem; }
  .md-td  { padding:.4rem .65rem; border:1px solid #2a2a3a; color:#ccccdd; text-align:left; }
  thead .md-td { color:#8888aa; font-weight:600; background:#12121a; }
  tbody tr:hover { background:rgba(255,255,255,.02); }
  .md-link { color:#818cf8; text-decoration:underline; text-underline-offset:2px; }
`

export function DownloadSource() {
  const [tab, setTab] = useState<'download' | 'readme'>('download')
  const [readmeHtml, setReadmeHtml] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (tab === 'readme' && !readmeHtml && !loading) {
      setLoading(true)
      setError('')
      fetch('/api/download/readme')
        .then(r => r.text())
        .then(text => {
          setReadmeHtml(renderMarkdown(text))
          setLoading(false)
        })
        .catch(() => {
          setError('Could not load README.md')
          setLoading(false)
        })
    }
  }, [tab])

  return (
    <div className="p-6 max-w-4xl animate-fade-in">
      {/* Injected MD styles */}
      <style>{MD_STYLES}</style>

      {/* Tab bar */}
      <div className="flex gap-1 mb-5 border-b border-[#2a2a3a] pb-0">
        {([
          { id: 'download', label: 'Download', icon: Download },
          { id: 'readme',   label: 'Preview README', icon: Eye },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-t-lg border border-b-0 transition-all -mb-px',
              tab === id
                ? 'bg-[#12121a] border-[#2a2a3a] text-white'
                : 'bg-transparent border-transparent text-[#8888aa] hover:text-white'
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Download tab ── */}
      {tab === 'download' && (
        <div className="rounded-2xl border border-[#2a2a3a] bg-[#12121a] p-8 space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <FileArchive className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Download Source Code</h1>
              <p className="text-xs text-indigo-400/80 mt-0.5 font-mono">Jayant_Assignment_Minisense.zip</p>
              <p className="text-sm text-[#8888aa] mt-1 leading-relaxed">
                Complete assignment package: source code, documentation, dataset, and setup instructions. No credentials included.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300 uppercase tracking-wider">
              <BookOpen className="w-3.5 h-3.5" />
              Included documentation
            </div>
            <ul className="space-y-2">
              {INCLUDED_DOCS.map(({ label, desc }) => (
                <li key={label} className="flex items-start gap-2">
                  <span className="text-indigo-400 mt-0.5 shrink-0">✓</span>
                  <div>
                    <span className="text-xs font-mono text-indigo-300">{label}</span>
                    <span className="text-xs text-[#8888aa] ml-2">— {desc}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-[#2a2a3a] bg-[#0e0e16] p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#8888aa] uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Excluded from archive
            </div>
            <ul className="space-y-1.5">
              {EXCLUDES.map(item => (
                <li key={item} className="text-xs text-[#9999bb] flex items-start gap-2">
                  <span className="text-[#5555777] mt-0.5">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href="/api/download/source.zip"
              download="Jayant_Assignment_Minisense.zip"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-semibold transition-all"
            >
              <Download className="w-4 h-4" />
              Download ZIP
            </a>
            <button
              onClick={() => setTab('readme')}
              className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl border border-[#2a2a3a] text-xs text-[#8888aa] hover:text-white hover:border-[#3a3a50] transition-all"
            >
              <Eye className="w-3.5 h-3.5" />
              Preview README
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <p className="text-[11px] text-[#6666888]">
            After extracting, open <code className="text-indigo-300">ASSIGNMENT_SUBMISSION.md</code> first,
            then follow <code className="text-indigo-300">README.md</code> to run locally.
          </p>
        </div>
      )}

      {/* ── README preview tab ── */}
      {tab === 'readme' && (
        <div className="rounded-2xl border border-[#2a2a3a] bg-[#12121a] overflow-hidden">
          {/* Preview header */}
          <div className="px-5 py-3 border-b border-[#2a2a3a] flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-semibold text-white">README.md</span>
            <span className="ml-auto text-xs text-[#8888aa]">Live project documentation</span>
          </div>

          <div className="p-6 overflow-y-auto max-h-[calc(100vh-220px)]">
            {loading && (
              <div className="flex items-center gap-2 text-[#8888aa] text-sm py-8 justify-center">
                <div className="w-4 h-4 border-2 border-indigo-500/40 border-t-indigo-400 rounded-full animate-spin" />
                Loading README…
              </div>
            )}
            {error && (
              <p className="text-red-400 text-sm text-center py-8">{error}</p>
            )}
            {!loading && !error && readmeHtml && (
              <div dangerouslySetInnerHTML={{ __html: readmeHtml }} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
