import { Download, FileArchive, ShieldCheck } from 'lucide-react'

const EXCLUDES = [
  '.env files & API keys (config.json keys stripped)',
  '.venv / venv / node_modules',
  '__pycache__ & build caches',
  'Assignment.docx',
]

export function DownloadSource() {
  return (
    <div className="p-6 max-w-xl animate-fade-in">
      <div className="rounded-2xl border border-[#2a2a3a] bg-[#12121a] p-8 space-y-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <FileArchive className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Download Source Code</h1>
            <p className="text-xs text-indigo-400/80 mt-0.5 font-mono">Jayant_Assignment_Minisense.zip</p>
            <p className="text-sm text-[#8888aa] mt-1 leading-relaxed">
              Full MiniSense project as a ZIP — ready to clone locally. Credentials and virtual
              environments are excluded automatically.
            </p>
          </div>
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

        <a
          href="/api/download/source.zip"
          download="Jayant_Assignment_Minisense.zip"
          className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-semibold transition-all"
        >
          <Download className="w-4 h-4" />
          Download ZIP
        </a>

        <p className="text-[11px] text-[#6666888]">
          After extracting: copy <code className="text-indigo-300">.env.example</code> to{' '}
          <code className="text-indigo-300">.env</code> and add your API keys in Admin Center.
        </p>
      </div>
    </div>
  )
}
