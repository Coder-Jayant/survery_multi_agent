/**
 * FloatingChatbot — Personal AI representative
 *
 * A floating chat widget that acts as Jayant's representative.
 * Uses a separate Groq API key (VITE_CHATBOT_GROQ_KEY) so it never
 * touches the main agent's quota.
 *
 * Features:
 * - Text + voice input (Web Speech API, in-browser, no deps)
 * - Voice output (Web Speech Synthesis API)
 * - Loaded with Jayant's profile from jayant_about.txt (served as static)
 * - Answers questions about the project and Jayant's background
 */

import { useEffect, useRef, useState } from 'react'
import { MessageCircle, X, Send, Mic, MicOff, Volume2, VolumeX, Minimize2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChatMsg {
  role: 'user' | 'assistant'
  text: string
}

const CHATBOT_MODEL = 'llama-3.3-70b-versatile'

const SYSTEM_PROMPT_BASE = `You are Jayant's AI representative and project guide for MiniSense.

Your two roles:
1. Answer questions about the MiniSense project — its architecture, agent pipeline, RAG system, tech stack, and design decisions.
2. Answer questions about Jayant Verma — his background, skills, experience, and what he is looking for.

Always be confident, concise, and professional. Speak as if you are Jayant's knowledgeable assistant.
If asked something you don't know, say so honestly rather than guessing.
Keep answers under 3 sentences unless more detail is specifically requested.

--- JAYANT'S PROFILE ---
{PROFILE}
--- END PROFILE ---

--- MINISENSE PROJECT OVERVIEW ---
MiniSense is a production-grade multi-agent AI platform that analyses customer survey responses for GreenLeaf Bistro (fictional business).

Architecture:
- Orchestrator Agent: Plans execution using LLM tool-calling, decomposes queries, routes to sub-agents
- DataAgent: Extracts quantitative metrics (CSAT, ratings, themes) via Groq function-calling with deterministic Python fallback
- RAGAgent: Answers factual questions using 2-stage retrieval — FAISS bi-encoder (fast) + cross-encoder reranker (precise)
- ComparisonAgent: Period-over-period analysis with delta metrics
- SummaryAgent: Synthesises all results into business-language narrative

Tech Stack:
- Backend: FastAPI (Python), Groq LLM (llama-3.3-70b-versatile), FAISS, sentence-transformers
- Reranker: cross-encoder/ms-marco-MiniLM-L-6-v2 (local, CPU, no API cost)
- Frontend: React + TypeScript + Vite + Tailwind + shadcn/ui
- Real-time: Server-Sent Events (SSE) for live agent tracing
- Charts: Recharts | Diagrams: Mermaid.js | Agent graph: React Flow

Key features:
- Live agent graph showing execution flow in real-time
- Evaluation Lab with automated quality scoring
- Admin Center with provider switching (Groq/OpenAI/Gemini/Anthropic)
- Knowledge Base with chunk inspection and retrieval testing
- 100+ FAQ knowledge base with 2-stage RAG
- Period caching to reduce redundant LLM calls
- Full test suite (pytest)
--- END PROJECT ---`

// SpeechRecognition type declarations
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string
}
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
}
declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance
  }
}

export function FloatingChatbot() {
  const [open, setOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [msgs, setMsgs] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [speakOn, setSpeakOn] = useState(false)
  const [profile, setProfile] = useState('')
  const [listening, setListening] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const recogRef = useRef<SpeechRecognitionInstance | null>(null)

  // Load Jayant's profile
  useEffect(() => {
    fetch('/jayant_about.txt')
      .then(r => r.ok ? r.text() : '')
      .then(t => setProfile(t))
      .catch(() => setProfile(''))
  }, [])

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, loading])

  // Greet on first open
  useEffect(() => {
    if (open && msgs.length === 0) {
      setMsgs([{
        role: 'assistant',
        text: "Hi! I'm Jayant's AI assistant. Ask me anything about the MiniSense project or about Jayant's background and skills.",
      }])
    }
  }, [open])

  const systemPrompt = SYSTEM_PROMPT_BASE.replace('{PROFILE}', profile || 'Profile not yet loaded.')

  const send = async (text: string) => {
    if (!text.trim() || loading) return
    const userMsg: ChatMsg = { role: 'user', text }
    const history = [...msgs, userMsg]
    setMsgs(history)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: CHATBOT_MODEL,
          temperature: 0.5,
          max_tokens: 300,
          messages: [
            { role: 'system', content: systemPrompt },
            ...history.map(m => ({ role: m.role, content: m.text })),
          ],
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const detail = err.detail ?? `Server error ${res.status}`
        setMsgs(prev => [...prev, { role: 'assistant', text: `⚠️ ${detail}` }])
        return
      }

      const data = await res.json()
      const reply = data.reply ?? 'Sorry, I could not generate a response.'
      setMsgs(prev => [...prev, { role: 'assistant', text: reply }])

      if (speakOn) speak(reply)
    } catch {
      setMsgs(prev => [...prev, { role: 'assistant', text: 'Error reaching the AI. Check your API key.' }])
    } finally {
      setLoading(false)
    }
  }

  const speak = (text: string) => {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(text)
    utt.rate = 1.05
    utt.pitch = 1
    window.speechSynthesis.speak(utt)
  }

  const toggleListen = () => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SR) return alert('Speech recognition not supported in this browser.')

    if (listening) {
      recogRef.current?.stop()
      setListening(false)
      return
    }

    const recog = new SR()
    recog.lang = 'en-US'
    recog.continuous = false
    recog.interimResults = false
    recog.onresult = (e) => {
      const transcript = e.results[0][0].transcript
      setInput(transcript)
      recog.stop()
      setListening(false)
      send(transcript)
    }
    recog.onerror = () => setListening(false)
    recog.onend = () => setListening(false)
    recogRef.current = recog
    recog.start()
    setListening(true)
  }

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-500 shadow-2xl shadow-indigo-500/30 flex items-center justify-center transition-all hover:scale-110 group"
          title="Chat with Jayant's AI"
        >
          <MessageCircle className="w-6 h-6 text-white" />
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-[#0a0a0f] animate-pulse" />
        </button>
      )}

      {/* Chat window */}
      {open && (
        <div className={cn(
          'fixed bottom-4 right-4 z-50 rounded-2xl border border-[#2a2a3a] bg-[#0e0e16] shadow-2xl shadow-black/50 flex flex-col transition-all',
          'w-[calc(100vw-32px)] sm:w-80',
          minimized ? 'h-12' : 'h-[420px] sm:h-[480px]'
        )}>
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2a2a3a] rounded-t-2xl bg-[#12121a]">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-sm font-bold text-indigo-300">
              J
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white">Jayant's AI</div>
              <div className="text-[10px] text-emerald-400">● Online</div>
            </div>
            <button
              onClick={() => setSpeakOn(v => !v)}
              title={speakOn ? 'Mute voice' : 'Enable voice output'}
              className={cn('p-1 rounded transition-colors', speakOn ? 'text-indigo-400' : 'text-[#8888aa] hover:text-white')}
            >
              {speakOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => setMinimized(v => !v)} className="p-1 text-[#8888aa] hover:text-white transition-colors">
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setOpen(false)} className="p-1 text-[#8888aa] hover:text-red-400 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {!minimized && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {msgs.map((m, i) => (
                  <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                    <div className={cn(
                      'max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed',
                      m.role === 'user'
                        ? 'bg-indigo-500/20 border border-indigo-500/25 text-white'
                        : 'bg-[#1a1a26] border border-[#2a2a3a] text-[#ccccdd]'
                    )}>
                      {m.text}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-[#1a1a26] border border-[#2a2a3a] rounded-xl px-3 py-2 text-xs text-[#8888aa]">
                      <span className="animate-pulse">thinking…</span>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Suggestions */}
              {msgs.length <= 1 && (
                <div className="px-3 pb-2 flex flex-wrap gap-1">
                  {[
                    'What is MiniSense?',
                    'Tell me about Jayant',
                    'How does the RAG work?',
                    'What skills does Jayant have?',
                  ].map(s => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="text-[10px] px-2 py-1 rounded-lg border border-[#2a2a3a] text-[#8888aa] hover:text-white hover:border-indigo-500/30 bg-[#12121a] transition-all"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className="p-3 border-t border-[#2a2a3a] flex gap-2 items-end">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && send(input)}
                  placeholder="Ask anything…"
                  className="flex-1 bg-[#1a1a26] border border-[#2a2a3a] rounded-lg px-3 py-2 text-xs text-white placeholder-[#8888aa] focus:outline-none focus:border-indigo-500/50 transition-all"
                />
                <button
                  onClick={toggleListen}
                  className={cn(
                    'p-2 rounded-lg border transition-all',
                    listening
                      ? 'border-red-500/40 bg-red-500/10 text-red-400 animate-pulse'
                      : 'border-[#2a2a3a] text-[#8888aa] hover:text-white bg-[#1a1a26]'
                  )}
                  title="Voice input"
                >
                  {listening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => send(input)}
                  disabled={!input.trim() || loading}
                  className="p-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 text-white transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
