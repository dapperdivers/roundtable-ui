import { useState, useEffect, useCallback } from 'react'
import { Crown, RefreshCw, Shield, DollarSign } from 'lucide-react'
import { authFetch } from '../lib/auth'

interface RoundTable {
  name: string
  namespace: string
  phase: string
  knightsReady: number
  knightsTotal: number
  natsPrefix: string
  costBudgetUSD: string
  totalCost: string
}

export function RoundTablesPage() {
  const [roundTables, setRoundTables] = useState<RoundTable[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await authFetch('/api/roundtables')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setRoundTables(data)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 15000)
    return () => clearInterval(interval)
  }, [refresh])

  const phaseBadge = (phase: string) => {
    const colors: Record<string, string> = {
      Ready: 'bg-green-500/10 text-green-400 border-green-500/20',
      Active: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      Degraded: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      Error: 'bg-red-500/10 text-red-400 border-red-500/20',
    }
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full border ${colors[phase] || 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>
        {phase || 'Unknown'}
      </span>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Crown className="w-8 h-8 text-roundtable-gold" />
          Round Tables
        </h1>
        <button
          onClick={refresh}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-roundtable-steel/50 hover:bg-roundtable-steel text-gray-300 rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
          <p className="text-red-400 text-sm">Failed to load round tables: {error}</p>
        </div>
      )}

      {loading && roundTables.length === 0 && (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-roundtable-gold border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading round tables...</p>
        </div>
      )}

      {!loading && roundTables.length === 0 && (
        <div className="text-center py-12">
          <Crown className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500">No round tables found.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {roundTables.map(rt => (
          <div key={rt.name} className="bg-roundtable-slate border border-roundtable-steel rounded-xl p-5 hover:border-roundtable-gold/30 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-lg font-bold text-white">{rt.name}</h3>
                <p className="text-xs text-gray-500">{rt.namespace}</p>
              </div>
              {phaseBadge(rt.phase)}
            </div>

            <div className="space-y-3">
              {/* Knights */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Shield className="w-4 h-4" />
                  Knights
                </div>
                <div className="text-sm">
                  <span className="text-green-400 font-medium">{rt.knightsReady}</span>
                  <span className="text-gray-500"> / {rt.knightsTotal}</span>
                </div>
              </div>

              {/* Knight readiness bar */}
              <div className="w-full bg-roundtable-navy rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all"
                  style={{ width: rt.knightsTotal > 0 ? `${(rt.knightsReady / rt.knightsTotal) * 100}%` : '0%' }}
                />
              </div>

              {/* NATS */}
              {rt.natsPrefix && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">NATS Prefix</span>
                  <code className="text-blue-400 text-xs bg-blue-500/10 px-2 py-0.5 rounded">{rt.natsPrefix}</code>
                </div>
              )}

              {/* Cost */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1 text-gray-400">
                  <DollarSign className="w-3 h-3" />
                  Cost
                </div>
                <div>
                  <span className="text-roundtable-gold">${rt.totalCost || '0.00'}</span>
                  {rt.costBudgetUSD && (
                    <span className="text-gray-500"> / ${rt.costBudgetUSD}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
