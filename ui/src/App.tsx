import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { Swords, LayoutDashboard, Send, ScrollText, Activity } from 'lucide-react'
import { FleetPage } from './pages/Fleet'
import { TasksPage } from './pages/Tasks'
import { BriefingsPage } from './pages/Briefings'
import { LivePage } from './pages/Live'

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Fleet' },
  { path: '/tasks', icon: Send, label: 'Tasks' },
  { path: '/briefings', icon: ScrollText, label: 'Briefings' },
  { path: '/live', icon: Activity, label: 'Live' },
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
              <h1 className="text-lg font-bold text-roundtable-gold">Round Table</h1>
              <p className="text-xs text-gray-400">Fleet Dashboard</p>
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
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/briefings" element={<BriefingsPage />} />
          <Route path="/live" element={<LivePage />} />
        </Routes>
      </main>
    </div>
  )
}
