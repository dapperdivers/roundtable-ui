import { useState, useEffect } from 'react'
import { Target, Clock, Users, Link2, DollarSign, FileText, Brain, ChevronDown, ChevronUp, CheckCircle, XCircle, Zap, Hash } from 'lucide-react'
import { apiGet } from '../lib/api'
import type { Mission } from '../hooks/useMissions'
import { MissionPhaseBadge } from './MissionPhaseBadge'
import { PlanningResultViewer } from './PlanningResultViewer'
import { getKnightConfig } from '../lib/knights'
import { formatRelativeTime, formatDuration, formatCost } from '../lib/format'
import { phaseColor } from '../lib/status'
import { Spinner } from './ui'

interface MissionCardProps {
  mission: Mission
  onClick?: () => void
}

function MissionResults({ name }: { name: string }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    apiGet<Record<string, unknown>>(`/api/missions/${name}/results`)
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
  // Meta-missions start with no knights/chains — the API serializes those
  // nil slices as null
  const knights = mission.knights ?? []
  const chains = mission.chains ?? []
  const [showResults, setShowResults] = useState(false)
  const [showKnights, setShowKnights] = useState(false)
  const [showChains, setShowChains] = useState(false)
  const [showCriteria, setShowCriteria] = useState(false)
  const [showBriefing, setShowBriefing] = useState(false)
  
  const isComplete = mission.phase === 'Succeeded' || mission.phase === 'Failed' || mission.phase === 'Expired'
  const isPlanning = mission.phase === 'Planning'
  
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
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white">{mission.name}</h3>
              {mission.metaMission && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center gap-1">
                  <Brain className="w-3 h-3" />
                  Meta
                </span>
              )}
            </div>
            <p className="text-sm text-gray-400 line-clamp-1">{mission.objective}</p>
          </div>
        </div>
        <MissionPhaseBadge phase={mission.phase} />
      </div>

      {/* Planning Status - show spinner while planning */}
      {isPlanning && (
        <div className="mb-3 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
          <div className="flex items-center gap-2 text-xs text-amber-400">
            <Spinner size="sm" />
            <span className="font-medium">Planner generating execution plan...</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            The AI planner is reasoning about chains, knights, tools, and skills needed.
          </p>
        </div>
      )}

      {/* Planning Results - show after planning completes */}
      {mission.planningResult && !isPlanning && (
        <div className="mb-3">
          <PlanningResultViewer result={mission.planningResult} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-3">
        {/* Knights */}
        <div className="bg-roundtable-navy/50 rounded-lg p-2">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-3 h-3 text-gray-400" />
            <span className="text-xs text-gray-400">Knights</span>
          </div>
          <div className="flex gap-1">
            {knights.slice(0, 3).map((knight) => {
              const config = getKnightConfig(knight)
              return (
                <span key={knight} className="text-sm" title={knight}>
                  {config.emoji}
                </span>
              )
            })}
            {knights.length > 3 && (
              <span className="text-xs text-gray-500">+{knights.length - 3}</span>
            )}
          </div>
        </div>

        {/* Chains */}
        <div className="bg-roundtable-navy/50 rounded-lg p-2">
          <div className="flex items-center gap-2 mb-1">
            <Link2 className="w-3 h-3 text-gray-400" />
            <span className="text-xs text-gray-400">Chains</span>
          </div>
          <span className="text-sm text-white font-mono">{chains.length}</span>
        </div>
      </div>

      {/* Timing & Cost */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1 text-gray-500">
          <Clock className="w-3 h-3" />
          {isComplete && mission.completedAt ? (
            <span>Completed {formatRelativeTime(mission.completedAt)}</span>
          ) : isComplete ? (
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
              {formatCost(cost)} / {formatCost(budget)}
            </span>
          </div>
        )}
      </div>

      {/* Knights Statuses */}
      {mission.knightStatuses && mission.knightStatuses.length > 0 && (
        <div className="mt-3 pt-3 border-t border-roundtable-steel/50">
          <button
            onClick={(e) => { e.stopPropagation(); setShowKnights(!showKnights) }}
            className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-300 transition-colors mb-2 w-full"
          >
            {showKnights ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            <Users className="w-3 h-3" />
            <span className="font-medium">Knights ({mission.knightStatuses.length})</span>
          </button>
          {showKnights && (
            <div className="space-y-2">
              {mission.knightStatuses.map((knight) => {
                const config = getKnightConfig(knight.name)
                return (
                  <div key={knight.name} className="bg-roundtable-navy/50 rounded-lg p-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{config.emoji}</span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm text-white font-medium capitalize">{knight.name}</span>
                          {knight.ephemeral && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 flex items-center gap-0.5">
                              <Zap className="w-2.5 h-2.5" />
                              ephemeral
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="flex items-center gap-1">
                            {knight.ready ? (
                              <CheckCircle className="w-3 h-3 text-green-400" />
                            ) : (
                              <XCircle className="w-3 h-3 text-red-400" />
                            )}
                            <span className={`text-xs ${knight.ready ? 'text-green-400' : 'text-red-400'}`}>
                              {knight.ready ? 'Ready' : 'Not Ready'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <Hash className="w-3 h-3" />
                            <span>{knight.tasksCompleted} tasks</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Chain Statuses */}
      {mission.chainStatuses && mission.chainStatuses.length > 0 && (
        <div className="mt-3 pt-3 border-t border-roundtable-steel/50">
          <button
            onClick={(e) => { e.stopPropagation(); setShowChains(!showChains) }}
            className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-300 transition-colors mb-2 w-full"
          >
            {showChains ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            <Link2 className="w-3 h-3" />
            <span className="font-medium">Chains ({mission.chainStatuses.length})</span>
          </button>
          {showChains && (
            <div className="space-y-2">
              {mission.chainStatuses.map((chain) => (
                <div key={chain.chainCRName} className="bg-roundtable-navy/50 rounded-lg p-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Link2 className="w-4 h-4 text-gray-400" />
                    <div>
                      <span className="text-sm text-white font-medium">{chain.name}</span>
                      <div className="text-xs text-gray-500 font-mono">{chain.chainCRName}</div>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded border ${phaseColor(chain.phase)}`}>
                    {chain.phase}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Success Criteria */}
      {mission.successCriteria && (
        <div className="mt-3 pt-3 border-t border-roundtable-steel/50">
          <button
            onClick={(e) => { e.stopPropagation(); setShowCriteria(!showCriteria) }}
            className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-300 transition-colors mb-2 w-full"
          >
            {showCriteria ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            <Target className="w-3 h-3" />
            <span className="font-medium">Success Criteria</span>
          </button>
          {showCriteria && (
            <div className="bg-roundtable-navy/50 rounded-lg p-3 border border-green-500/20">
              <p className="text-xs text-gray-300 whitespace-pre-wrap">{mission.successCriteria}</p>
            </div>
          )}
        </div>
      )}

      {/* Briefing */}
      {mission.briefing && (
        <div className="mt-3 pt-3 border-t border-roundtable-steel/50">
          <button
            onClick={(e) => { e.stopPropagation(); setShowBriefing(!showBriefing) }}
            className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-300 transition-colors mb-2 w-full"
          >
            {showBriefing ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            <FileText className="w-3 h-3" />
            <span className="font-medium">Briefing</span>
          </button>
          {showBriefing && (
            <div className="bg-roundtable-navy/50 rounded-lg p-3 border border-blue-500/20">
              <p className="text-xs text-gray-300 whitespace-pre-wrap">{mission.briefing}</p>
            </div>
          )}
        </div>
      )}

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
