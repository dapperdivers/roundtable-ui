import { useState, useMemo } from 'react'
import { RefreshCw, Zap, Crown } from 'lucide-react'
import { useFleet } from '../hooks/useFleet'
import type { Knight } from '../hooks/useFleet'
import { KnightCard } from '../components/KnightCard'
import { KnightDetailDrawer } from '../components/KnightDetailDrawer'
import { useWebSocket } from '../hooks/useWebSocket'
import { knightNameForDomain } from '../lib/knights'

export function FleetPage() {
  const { knights, loading, error, refresh } = useFleet()
  const [selectedKnight, setSelectedKnight] = useState<Knight | null>(null)
  const { events } = useWebSocket()

  const knightActivity = useMemo(() => {
    const now = Date.now()
    const windowMs = 30 * 60 * 1000 // 30 min
    const intervalMs = windowMs / 5
    const activity: Record<string, { recent: number; lastActive: string | null; busy: boolean; sparkline: number[] }> = {}

    // Track pending tasks (task sent but no result yet) per knight
    const pendingTasks = new Set<string>()
    const resultsSeen = new Set<string>()

    // Only process events within our activity window (#43 — bounded memory)
    const windowedEvents = events.filter(e => {
      const ts = new Date(e.timestamp).getTime()
      return now - ts <= windowMs
    })

    for (const event of windowedEvents) {
      const parts = event.subject.split('.')
      const domain = parts[2] || ''
      const name = knightNameForDomain(domain)
      if (!name) continue

      const ts = new Date(event.timestamp).getTime()

      if (!activity[name]) {
        activity[name] = { recent: 0, lastActive: null, busy: false, sparkline: [0, 0, 0, 0, 0] }
      }

      if (event.type === 'result') {
        activity[name].recent++
        resultsSeen.add(`${name}:${event.timestamp}`)
        if (!activity[name].lastActive || event.timestamp > activity[name].lastActive!) {
          activity[name].lastActive = event.timestamp
        }
        // Sparkline bucket
        const bucket = Math.min(4, Math.floor((now - ts) / intervalMs))
        activity[name].sparkline[4 - bucket]++
      }

      if (event.type === 'task') {
        pendingTasks.add(name)
      }
    }

    // Normalize sparkline values to 0-1
    for (const a of Object.values(activity)) {
      const max = Math.max(1, ...a.sparkline)
      a.sparkline = a.sparkline.map(v => v / max)
    }

    // Mark busy: has task but fewer results than tasks in recent window
    for (const event of windowedEvents) {
      const parts = event.subject.split('.')
      const domain = parts[2] || ''
      const name = knightNameForDomain(domain)
      if (!name || event.type !== 'task') continue
      const ts = new Date(event.timestamp).getTime()
      if (now - ts > 60000) continue // only last 60s for busy detection
      if (activity[name]) {
        // Check if there's a result after this task
        const hasResult = events.some(e =>
          e.type === 'result' &&
          knightNameForDomain(e.subject.split('.')[2] || '') === name &&
          new Date(e.timestamp).getTime() > ts
        )
        if (!hasResult) activity[name].busy = true
      }
    }

    return activity
  }, [events])

  const online = knights.filter((k) => k.status === 'online').length
  const total = knights.length

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Crown className="w-8 h-8 text-roundtable-gold" />
            The Round Table
          </h1>
          <p className="text-gray-400 mt-1">
            {online}/{total} knights seated • observing the realm
          </p>
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-2 px-4 py-2 bg-roundtable-steel hover:bg-roundtable-gold/20 border border-roundtable-steel hover:border-roundtable-gold/30 rounded-lg transition-colors text-gray-300"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <SummaryCard
          label="Online"
          value={online}
          total={total}
          color="text-green-400"
          icon={<Zap className="w-5 h-5" />}
        />
        <SummaryCard
          label="Offline"
          value={knights.filter((k) => k.status === 'offline').length}
          total={total}
          color="text-red-400"
        />
        <SummaryCard
          label="Total Restarts"
          value={knights.reduce((sum, k) => sum + k.restarts, 0)}
          color="text-yellow-400"
        />
        <SummaryCard
          label="Domains"
          value={new Set(knights.map((k) => k.domain)).size}
          color="text-blue-400"
        />
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-6">
          <p className="text-red-400">⚠️ {error}</p>
          <p className="text-red-400/60 text-sm mt-1">API may not be running. Start with: cd api && go run .</p>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="text-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-roundtable-gold border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-400">Summoning knights to the table...</p>
        </div>
      )}

      {/* Knight grid */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {knights
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((knight) => (
              <KnightCard key={knight.name} knight={knight} onClick={() => setSelectedKnight(knight)} activity={knightActivity[knight.name]} />
            ))}
        </div>
      )}

      {/* Knight detail drawer */}
      <KnightDetailDrawer knight={selectedKnight} onClose={() => setSelectedKnight(null)} />
    </div>
  )
}

function SummaryCard({
  label,
  value,
  total,
  color,
  icon,
}: {
  label: string
  value: number
  total?: number
  color: string
  icon?: React.ReactNode
}) {
  return (
    <div className="bg-roundtable-slate border border-roundtable-steel rounded-xl p-4">
      <div className="flex items-center justify-between">
        <p className="text-gray-400 text-sm">{label}</p>
        {icon && <span className={color}>{icon}</span>}
      </div>
      <p className={`text-2xl font-bold mt-1 ${color}`}>
        {value}
        {total !== undefined && <span className="text-gray-500 text-lg">/{total}</span>}
      </p>
    </div>
  )
}
