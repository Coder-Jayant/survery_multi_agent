import { BrowserRouter, Routes, Route, useSearchParams } from 'react-router-dom'
import { Sidebar } from '@/components/Sidebar'
import { Dashboard } from '@/pages/Dashboard'
import { AIAnalyst } from '@/pages/AIAnalyst'
import { Analytics } from '@/pages/Analytics'
import { KnowledgeBase } from '@/pages/KnowledgeBase'
import { EvaluationLab } from '@/pages/EvaluationLab'
import { ArchitectureCenter } from '@/pages/ArchitectureCenter'
import { AdminCenter } from '@/pages/AdminCenter'
import { AboutProject } from '@/pages/AboutProject'
import { AboutDeveloper } from '@/pages/AboutDeveloper'
import { FineTuning } from '@/pages/FineTuning'
import { AnalystProvider } from '@/context/AnalystContext'
import { FloatingChatbot } from '@/components/FloatingChatbot'

function AnalystWrapper() {
  const [params] = useSearchParams()
  return <AIAnalyst prefill={params.get('q') ?? undefined} />
}

function AppLayout() {
  return (
    <div className="flex min-h-screen bg-[#0a0a0f] text-white">
      <Sidebar />
      <main className="flex-1 overflow-y-auto min-w-0 pt-12 md:pt-0">
        <Routes>
          <Route path="/" element={<AnalystWrapper />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/analyst" element={<AnalystWrapper />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/knowledge" element={<KnowledgeBase />} />
          <Route path="/eval-lab" element={<EvaluationLab />} />
          <Route path="/architecture" element={<ArchitectureCenter />} />
          <Route path="/admin" element={<AdminCenter />} />
          <Route path="/about-project" element={<AboutProject />} />
          <Route path="/about-developer" element={<AboutDeveloper />} />
          <Route path="/finetuning" element={<FineTuning />} />
        </Routes>
      </main>
      <FloatingChatbot />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AnalystProvider>
        <AppLayout />
      </AnalystProvider>
    </BrowserRouter>
  )
}
