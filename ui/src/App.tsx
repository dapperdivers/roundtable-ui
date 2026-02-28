import { useState, useEffect } from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { Swords, Shield, Scroll, GitGraph, BookOpen, Link2, TreePine, Menu, X } from 'lucide-react'
import { FleetPage } from './pages/Fleet'
import { TasksPage } from './pages/Tasks'
import { BriefingsPage } from './pages/Briefings'
import { LivePage } from './pages/Live'
import { ChainsPage } from './pages/Chains'
import { SessionsPage } from './pages/Sessions'
import { ToastProvider, useToast } from './components/Toast'
import { useWebSocket } from './hooks/useWebSocket'
import { useTaskNotifications } from './hooks/useTaskNotifications'

function NotificationWatcher() {
  const { events } = useWebSocket()
  const { addToast } = useToast()
  useTaskNotifications(events, addToast)
  return null
}

const navItems = [
  { path: '/', icon: Shield, label: 'The Round Table' },
  { path: '/quests', icon: Scroll, label: 'Quests' },
  { path: '/flow', icon: GitGraph, label: 'Message Flow' },
  { path: '/chronicles', icon: BookOpen, label: 'Chronicles' },
  { path: '/chains', icon: Link2, label: 'Chains' },
  { path: '/sessions', icon: TreePine, label: 'Sessions' },
]

export default function App() {
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Close sidebar on navigation (mobile)
  useEffect(() => { setSidebarOpen(false) }, [location.pathname])

  return (
    <ToastProvider>
    <div className="flex h-screen">
      <NotificationWatcher />

      {/* Mobile header (#58) */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-roundtable-slate border-b border-roundtable-steel px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Swords className="w-6 h-6 text-roundtable-gold" />
          <span className="text-sm font-bold text-roundtable-gold">Round Table</span>
        </div>
        <button onClick={() => setSidebarOpen(o => !o)} className="text-gray-400 p-1">
          {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar backdrop (mobile) */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <nav className={`fixed md:relative z-40 h-full w-64 bg-roundtable-slate border-r border-roundtable-steel flex flex-col transition-transform duration-200 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        <div className="p-6 border-b border-roundtable-steel hidden md:block">
          <div className="flex items-center gap-3">
            <Swords className="w-8 h-8 text-roundtable-gold" />
            <div>
              <h1 className="text-lg font-bold text-roundtable-gold">⚔️ The Round Table</h1>
              <p className="text-xs text-gray-400">Observability & Traceability</p>
            </div>
          </div>
        </div>

        <div className="flex-1 p-4 space-y-1 mt-14 md:mt-0">
          {navItems.map(({ path, icon: Icon, label }) => {
            const active = location.pathname === path
            return (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  active
                    ? 'bg-roundtable-gold/10 text-roundtable-gold border border-roundtable-gold/20'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-roundtable-steel/50'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{label}</span>
              </Link>
            )
          })}
        </div>

        <div className="p-4 border-t border-roundtable-steel">
          <p className="text-xs text-gray-500 text-center">
            ⚔️ Round Table v1.0.0
          </p>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-4 md:p-8 mt-14 md:mt-0">
        <Routes>
          <Route path="/" element={<FleetPage />} />
          <Route path="/quests" element={<TasksPage />} />
          <Route path="/flow" element={<LivePage />} />
          <Route path="/chronicles" element={<BriefingsPage />} />
          <Route path="/chains" element={<ChainsPage />} />
          <Route path="/sessions" element={<SessionsPage />} />
        </Routes>
      </main>
    </div>
    </ToastProvider>
  )
}
