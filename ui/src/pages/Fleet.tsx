import { useState } from 'react'
import { RefreshCw, Zap, Crown } from 'lucide-react'
import { useFleet } from '../hooks/useFleet'
import type { Knight } from '../hooks/useFleet'
import { KnightCard } from '../components/KnightCard'
import { KnightDetailDrawer } from '../components/KnightDetailDrawer'

export function FleetPage() {
  const { knights, loading, error, refresh } = useFleet()
  const [selectedKnight, setSelectedKnight] = useState<Knight | null>(null)

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
              <KnightCard key={knight.name} knight={knight} onClick={() => setSelectedKnight(knight)} />
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
