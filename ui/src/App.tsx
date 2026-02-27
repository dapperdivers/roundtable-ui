import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { Swords, Shield, Scroll, GitGraph, BookOpen, Link2 } from 'lucide-react'
import { FleetPage } from './pages/Fleet'
import { TasksPage } from './pages/Tasks'
import { BriefingsPage } from './pages/Briefings'
import { LivePage } from './pages/Live'
import { ChainsPage } from './pages/Chains'

const navItems = [
  { path: '/', icon: Shield, label: 'The Round Table' },
  { path: '/quests', icon: Scroll, label: 'Quests' },
  { path: '/flow', icon: GitGraph, label: 'Message Flow' },
  { path: '/chronicles', icon: BookOpen, label: 'Chronicles' },
  { path: '/chains', icon: Link2, label: 'Chains' },
]

export default function App() {
  const location = useLocation()

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <nav className="w-64 bg-roundtable-slate border-r border-roundtable-steel flex flex-col">
        <div className="p-6 border-b border-roundtable-steel">
          <div className="flex items-center gap-3">
            <Swords className="w-8 h-8 text-roundtable-gold" />
            <div>
              <h1 className="text-lg font-bold text-roundtable-gold">⚔️ The Round Table</h1>
              <p className="text-xs text-gray-400">Observability & Traceability</p>
            </div>
          </div>
        </div>

        <div className="flex-1 p-4 space-y-1">
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
      <main className="flex-1 overflow-auto p-8">
        <Routes>
          <Route path="/" element={<FleetPage />} />
          <Route path="/quests" element={<TasksPage />} />
          <Route path="/flow" element={<LivePage />} />
          <Route path="/chronicles" element={<BriefingsPage />} />
          <Route path="/chains" element={<ChainsPage />} />
        </Routes>
      </main>
    </div>
  )
}
