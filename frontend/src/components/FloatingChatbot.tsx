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
import { useLocation } from 'react-router-dom'
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
MiniSense is a production-grade multi-agent AI platform that analyses customer survey responses for GreenLeaf Bistro (a fictional restaurant chain). It demonstrates real agentic AI, not a simple chatbot.

AGENT ARCHITECTURE:
- Orchestrator: Plans execution via LLM tool-calling, decomposes natural language queries into a task plan, routes to the right sub-agents in sequence
- DataAgent: Extracts quantitative metrics (CSAT score, avg rating, response counts, themes) via Groq function-calling with tool calls. Has deterministic Python fallback if LLM is unavailable
- RAGAgent: 2-stage retrieval — FAISS bi-encoder for fast candidate retrieval, then cross-encoder reranker (ms-marco-MiniLM-L-6-v2) for precise re-scoring. Sigmoid applied to reranker scores for interpretability
- ComparisonAgent: Period-over-period analysis with delta metrics (e.g. April vs May CSAT shift)
- SummaryAgent: Synthesises all agent results into a business-language executive narrative

RAG PIPELINE DETAILS:
- FAISS vector store with sentence-transformers embeddings (all-MiniLM-L6-v2)
- Cross-encoder reranking: scores all candidates, then sorts by relevance — FAISS score shown to user for interpretability, reranker score used for ordering
- 100+ curated FAQ document for GreenLeaf Bistro knowledge base
- Chunking strategy: paragraph-level with overlap for context preservation

REAL-TIME OBSERVABILITY:
- Server-Sent Events (SSE) stream every agent action live to the frontend
- Live agent graph (React Flow) showing which agents are active/done
- Agent Trace panel: shows plan, tool calls, tool results, agent start/done events
- Evidence panel: shows retrieved RAG chunks with scores and metadata

FINE-TUNING USE CASE:
- Platform has a dedicated Fine-Tuning tab explaining domain adaptation strategy
- Would fine-tune Llama-3-8B or Mistral-7B using QLoRA on GreenLeaf survey data
- Tasks: theme classification, sentiment analysis, narrative generation, FAQ answering
- Estimated improvements: +20% theme accuracy, -9% hallucination rate
- Serves via vLLM + KServe; OpenAI-compatible API means zero MiniSense code changes

EVALUATION SYSTEM:
- Evaluation Lab runs automated quality scoring on agent responses
- Metrics: relevance, accuracy, completeness, latency
- Run history tracked in JSONL for trend analysis

ADMIN CENTER:
- Multi-provider LLM switching: Groq, OpenAI, Gemini (gemini-2.5-flash), Anthropic
- Best options marked with ★ in dropdowns with explanations
- API keys stored server-side only — never in client JS bundle

TECH STACK:
- Backend: Python, FastAPI, Groq/Gemini/OpenAI APIs, FAISS, sentence-transformers, cross-encoder
- Frontend: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, React Flow, Recharts, Mermaid.js
- Real-time: Server-Sent Events (SSE)
- Testing: pytest test suite covering agents, RAG, and API endpoints
- Deployment: Railway (backend + pre-built frontend), Procfile + nixpacks

MOBILE SUPPORT:
- Fully mobile-responsive: slide-in sidebar drawer, hamburger menu, stacked layouts on small screens

DATA:
- 60,000+ synthetic survey responses generated across Jan–May 2026
- Themes: food_quality, wait_time, app_experience, service, ambiance, pricing
- Stored as JSON, served via FastAPI endpoints
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
  const location = useLocation()
  const onAnalyst = location.pathname === '/' || location.pathname === '/analyst'
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
          className={cn(
            'fixed z-40 w-12 h-12 md:w-14 md:h-14 rounded-full bg-indigo-600 hover:bg-indigo-500 shadow-2xl shadow-indigo-500/30 flex items-center justify-center transition-all hover:scale-110 group',
            onAnalyst ? 'bottom-28 right-4 md:bottom-6 md:right-6' : 'bottom-6 right-4 md:right-6',
          )}
          title="Chat with Jayant's AI"
        >
          <MessageCircle className="w-6 h-6 text-white" />
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-[#0a0a0f] animate-pulse" />
        </button>
      )}

      {/* Chat window */}
      {open && (
        <div className={cn(
          'fixed z-40 rounded-2xl border border-[#2a2a3a] bg-[#0e0e16] shadow-2xl shadow-black/50 flex flex-col transition-all',
          'w-[calc(100vw-32px)] sm:w-80',
          onAnalyst ? 'bottom-28 right-4 md:bottom-4 md:right-4' : 'bottom-4 right-4',
          minimized ? 'h-12' : 'h-[380px] sm:h-[480px]'
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
