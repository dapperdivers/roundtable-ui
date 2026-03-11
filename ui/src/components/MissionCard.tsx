import { useState, useEffect } from 'react'
import { Target, Clock, Users, Link2, DollarSign, FileText } from 'lucide-react'
import { authFetch } from '../lib/auth'
import type { Mission } from '../hooks/useMissions'
import { MissionPhaseBadge } from './MissionPhaseBadge'
import { getKnightConfig } from '../lib/knights'

interface MissionCardProps {
  mission: Mission
  onClick?: () => void
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const days = Math.floor(hr / 24)
  return `${days}d ago`
}

function formatDuration(start: string | null, end: string | null): string {
  if (!start) return '—'
  const s = new Date(start).getTime()
  const e = end ? new Date(end).getTime() : Date.now()
  const sec = Math.round((e - s) / 1000)
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}m`
  const hours = Math.floor(sec / 3600)
  const mins = Math.floor((sec % 3600) / 60)
  return `${hours}h ${mins}m`
}

function MissionResults({ name }: { name: string }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    authFetch(`/api/missions/${name}/results`)
      .then(r => { if (!r.ok) throw new Error('Not found'); return r.json() })
      .then(d => setData(d))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [name])

  if (loading) return <p className="text-xs text-gray-500 py-2">Loading results...</p>
  if (error) return <p className="text-xs text-gray-500 py-2">No results stored yet</p>

  return (
    <pre className="text-xs text-gray-300 whitespace-pre-wrap max-h-64 overflow-auto bg-roundtable-navy rounded p-3 border border-roundtable-gold/20">
      {JSON.stringify(data, null, 2)}
    </pre>
  )
}

export function MissionCard({ mission, onClick }: MissionCardProps) {
  const [showResults, setShowResults] = useState(false)
  const isComplete = mission.phase === 'Succeeded' || mission.phase === 'Failed' || mission.phase === 'Expired'
  
  // Calculate budget usage percentage
  const budget = parseFloat(mission.costBudgetUSD) || 0
  const cost = parseFloat(mission.totalCost) || 0
  const budgetPercent = budget > 0 ? Math.min((cost / budget) * 100, 100) : 0
  const budgetColor = budgetPercent > 90 ? 'text-red-400' : budgetPercent > 70 ? 'text-yellow-400' : 'text-green-400'

  return (
    <div
      onClick={onClick}
      className="bg-roundtable-slate border border-roundtable-steel rounded-xl p-5 hover:border-roundtable-gold/30 transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <Target className="w-5 h-5 text-roundtable-gold" />
          <div>
            <h3 className="font-bold text-white">{mission.name}</h3>
            <p className="text-sm text-gray-400 line-clamp-1">{mission.objective}</p>
          </div>
        </div>
        <MissionPhaseBadge phase={mission.phase} />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        {/* Knights */}
        <div className="bg-roundtable-navy/50 rounded-lg p-2">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-3 h-3 text-gray-400" />
            <span className="text-xs text-gray-400">Knights</span>
          </div>
          <div className="flex gap-1">
            {mission.knights.slice(0, 3).map((knight) => {
              const config = getKnightConfig(knight)
              return (
                <span key={knight} className="text-sm" title={knight}>
                  {config.emoji}
                </span>
              )
            })}
            {mission.knights.length > 3 && (
              <span className="text-xs text-gray-500">+{mission.knights.length - 3}</span>
            )}
          </div>
        </div>

        {/* Chains */}
        <div className="bg-roundtable-navy/50 rounded-lg p-2">
          <div className="flex items-center gap-2 mb-1">
            <Link2 className="w-3 h-3 text-gray-400" />
            <span className="text-xs text-gray-400">Chains</span>
          </div>
          <span className="text-sm text-white font-mono">{mission.chains.length}</span>
        </div>
      </div>

      {/* Timing & Cost */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1 text-gray-500">
          <Clock className="w-3 h-3" />
          {isComplete ? (
            <span>Duration: {formatDuration(mission.startedAt, mission.expiresAt)}</span>
          ) : mission.startedAt ? (
            <span>Started {formatRelativeTime(mission.startedAt)}</span>
          ) : (
            <span>Not started</span>
          )}
        </div>
        {mission.costBudgetUSD && parseFloat(mission.costBudgetUSD) > 0 && (
          <div className="flex items-center gap-1">
            <DollarSign className={`w-3 h-3 ${budgetColor}`} />
            <span className={budgetColor}>
              ${cost.toFixed(2)} / ${parseFloat(mission.costBudgetUSD).toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {/* RoundTable */}
      <div className="mt-3 pt-3 border-t border-roundtable-steel/50 flex items-center justify-between">
        <span className="text-xs text-gray-500">
          RoundTable: <span className="text-gray-400">{mission.roundTableRef}</span>
        </span>
        <div className="flex items-center gap-2">
          {isComplete && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowResults(r => !r) }}
              className="flex items-center gap-1 text-xs text-roundtable-gold/60 hover:text-roundtable-gold transition-colors"
            >
              <FileText className="w-3 h-3" />
              {showResults ? 'hide results' : 'results'}
            </button>
          )}
          <span className="text-xs text-gray-600 group-hover:text-roundtable-gold/60 transition-colors">
            view details →
          </span>
        </div>
      </div>

      {showResults && (
        <div className="mt-3 pt-3 border-t border-roundtable-steel/50">
          <MissionResults name={mission.name} />
        </div>
      )}
    </div>
  )
}
