import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Bot, BarChart2, BookOpen,
  FlaskConical, Building2, Settings, Info, User,
  ChevronLeft, ChevronRight, Leaf, Activity, Menu, X
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_SECTIONS = [
  {
    items: [
      { path: '/', label: 'AI Analyst', icon: Bot },
      { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/analytics', label: 'Analytics', icon: BarChart2 },
      { path: '/knowledge', label: 'Knowledge Base', icon: BookOpen },
    ],
  },
  {
    items: [
      { path: '/eval-lab', label: 'Evaluation Lab', icon: FlaskConical },
    ],
  },
  {
    items: [
      { path: '/architecture', label: 'Architecture', icon: Building2 },
      { path: '/admin', label: 'Admin Center', icon: Settings },
    ],
  },
  {
    items: [
      { path: '/about-project', label: 'About Project', icon: Info },
      { path: '/about-developer', label: 'About Developer', icon: User },
    ],
  },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  const closeMobile = () => setMobileOpen(false)

  return (
    <>
      {/* ── Mobile top bar (hidden on md+) ─────────────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 h-12 bg-[#0e0e16] border-b border-[#2a2a3a] flex items-center px-4 gap-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1.5 rounded-md hover:bg-[#2a2a3a] text-[#8888aa] hover:text-white transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="w-6 h-6 rounded-md bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center">
          <Leaf className="w-3.5 h-3.5 text-indigo-400" />
        </div>
        <span className="text-sm font-bold text-white">MiniSense</span>
      </div>

      {/* ── Mobile backdrop ────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
          onClick={closeMobile}
        />
      )}

      {/* ── Sidebar ───────────────────────────────────────────── */}
    <aside
      className={cn(
        'flex flex-col h-screen border-r border-[#2a2a3a] bg-[#0e0e16] z-50 transition-all duration-300 ease-in-out',
        // Desktop: sticky, width collapses
        'md:sticky md:top-0',
        collapsed ? 'md:w-16' : 'md:w-60',
        // Mobile: fixed drawer, full width 240px, slides in/out
        'fixed top-0 left-0 w-64',
        mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-[#2a2a3a]">
        <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center shrink-0">
          <Leaf className="w-4 h-4 text-indigo-400" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="text-sm font-bold text-white tracking-wide">MiniSense</div>
            <div className="text-[10px] text-[#8888aa] leading-tight">Customer Intelligence</div>
          </div>
        )}
        {/* Desktop collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto p-1 rounded-md hover:bg-[#2a2a3a] text-[#8888aa] hover:text-white transition-colors shrink-0 hidden md:flex"
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
        {/* Mobile close button */}
        <button
          onClick={closeMobile}
          className="ml-auto p-1 rounded-md hover:bg-[#2a2a3a] text-[#8888aa] hover:text-white transition-colors shrink-0 md:hidden"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {NAV_SECTIONS.map((section, si) => (
          <div key={si} className={cn('mb-1', si > 0 && 'border-t border-[#2a2a3a] pt-1 mt-1')}>
            {section.items.map(({ path, label, icon: Icon }) => {
              const active = path === '/'
                ? location.pathname === '/' || location.pathname === '/analyst'
                : location.pathname.startsWith(path)
              return (
                <NavLink
                  key={path}
                  to={path}
                  onClick={closeMobile}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 group',
                    active
                      ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/25'
                      : 'text-[#8888aa] hover:text-white hover:bg-[#1a1a26]'
                  )}
                  title={collapsed ? label : undefined}
                >
                  <Icon className={cn('w-4 h-4 shrink-0', active ? 'text-indigo-400' : 'text-[#8888aa] group-hover:text-white')} />
                  {!collapsed && <span className="truncate">{label}</span>}
                </NavLink>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[#2a2a3a]">
        {collapsed ? (
          <Activity className="w-4 h-4 text-emerald-400 mx-auto" />
        ) : (
          <div className="flex items-center gap-2">
            <Activity className="w-3 h-3 text-emerald-400 animate-pulse" />
            <span className="text-xs text-[#8888aa]">Platform active</span>
          </div>
        )}
      </div>
    </aside>
    </>
  )
}
