import { useState } from 'react'
import { Crown, Shield, DollarSign, ChevronDown, Layers, Settings, CheckSquare } from 'lucide-react'
import { usePolledFetch } from '../hooks/usePolledFetch'
import type { RoundTable } from '../lib/types'
import { PageHeader, RefreshButton, ErrorBanner, Spinner, EmptyState, PhaseBadge, ProgressBar } from '../components/ui'

export function RoundTablesPage() {
  const { data: roundTables, loading, error, refresh } = usePolledFetch<RoundTable[]>('/api/roundtables', 15000, [])
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())

  const toggleCard = (name: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  return (
    <div>
      <PageHeader icon={Crown} title="Round Tables">
        <RefreshButton onClick={refresh} loading={loading} />
      </PageHeader>

      {error && (
        <div className="mb-6">
          <ErrorBanner>Failed to load round tables: {error}</ErrorBanner>
        </div>
      )}

      {loading && roundTables.length === 0 && (
        <div className="text-center py-12">
          <div className="flex justify-center mb-3">
            <Spinner />
          </div>
          <p className="text-gray-500 text-sm">Loading round tables...</p>
        </div>
      )}

      {!loading && roundTables.length === 0 && (
        <EmptyState icon={Crown} title="No round tables found." />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {roundTables.map(rt => {
          const expanded = expandedCards.has(rt.name)
          const hasDetail = rt.warmPool || rt.policies || rt.activeMissions != null || rt.totalTasksCompleted != null || rt.description || rt.suspended
          return (
            <div key={rt.name} className="bg-roundtable-slate border border-roundtable-steel rounded-xl hover:border-roundtable-gold/30 transition-colors">
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-white">{rt.name}</h3>
                    <p className="text-xs text-gray-500">{rt.namespace}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {rt.suspended && <PhaseBadge phase="Suspended" />}
                    <PhaseBadge phase={rt.phase || 'Unknown'} />
                  </div>
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
                  <ProgressBar
                    percent={rt.knightsTotal > 0 ? (rt.knightsReady / rt.knightsTotal) * 100 : 0}
                    fillClass="bg-green-500"
                  />

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

                  {/* Quick stats if available */}
                  {rt.activeMissions != null && (
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-1 text-gray-400">
                        <CheckSquare className="w-3 h-3" />
                        Active Missions
                      </div>
                      <span className={rt.activeMissions > 0 ? 'text-yellow-400 font-medium' : 'text-gray-400'}>{rt.activeMissions}</span>
                    </div>
                  )}
                </div>

                {/* Expand toggle */}
                {hasDetail && (
                  <button
                    onClick={() => toggleCard(rt.name)}
                    className="mt-4 w-full flex items-center justify-center gap-1 text-xs text-gray-500 hover:text-roundtable-gold transition-colors"
                  >
                    <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                    {expanded ? 'Less' : 'More details'}
                  </button>
                )}
              </div>

              {/* Expanded detail section */}
              {expanded && hasDetail && (
                <div className="border-t border-roundtable-steel/50 px-5 pb-5 pt-4 space-y-4">
                  {/* Description */}
                  {rt.description && (
                    <p className="text-sm text-gray-400 leading-relaxed">{rt.description}</p>
                  )}

                  {/* Warm Pool */}
                  {rt.warmPool && (
                    <div>
                      <h4 className="text-xs font-medium text-gray-400 mb-2 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5" />
                        Warm Pool
                      </h4>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-roundtable-navy rounded-lg p-2 text-center">
                          <p className="text-green-400 font-bold text-lg">{rt.warmPool.available}</p>
                          <p className="text-gray-500 text-xs">Available</p>
                        </div>
                        <div className="bg-roundtable-navy rounded-lg p-2 text-center">
                          <p className="text-blue-400 font-bold text-lg">{rt.warmPool.provisioning}</p>
                          <p className="text-gray-500 text-xs">Provisioning</p>
                        </div>
                        <div className="bg-roundtable-navy rounded-lg p-2 text-center">
                          <p className="text-yellow-400 font-bold text-lg">{rt.warmPool.claimed}</p>
                          <p className="text-gray-500 text-xs">Claimed</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Policies */}
                  {rt.policies && (
                    <div>
                      <h4 className="text-xs font-medium text-gray-400 mb-2 flex items-center gap-1.5">
                        <Settings className="w-3.5 h-3.5" />
                        Policies
                      </h4>
                      <div className="bg-roundtable-navy rounded-lg p-3 space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Max Concurrent Tasks</span>
                          <span className="text-gray-300">{rt.policies.maxConcurrentTasks}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Cost Budget</span>
                          <span className="text-roundtable-gold">${rt.policies.costBudgetUSD}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Max Knights</span>
                          <span className="text-gray-300">{rt.policies.maxKnights}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Max Missions</span>
                          <span className="text-gray-300">{rt.policies.maxMissions}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Missions & tasks */}
                  {(rt.activeMissions != null || rt.totalTasksCompleted != null) && (
                    <div className="bg-roundtable-navy rounded-lg p-3 space-y-1.5">
                      {rt.activeMissions != null && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">Active Missions</span>
                          <span className={rt.activeMissions > 0 ? 'text-yellow-400 font-medium' : 'text-gray-300'}>{rt.activeMissions}</span>
                        </div>
                      )}
                      {rt.totalTasksCompleted != null && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">Total Tasks Completed</span>
                          <span className="text-gray-300 font-medium">{rt.totalTasksCompleted}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
