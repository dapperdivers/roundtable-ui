import { authFetch } from '../lib/auth'
import { useState, useEffect, useMemo } from 'react'
import { Crown, Activity, DollarSign, Zap, AlertTriangle, Link2, ArrowRight, TrendingUp, Calendar, BarChart3, ChevronDown, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useFleet } from '../hooks/useFleet'
import { useWebSocket } from '../hooks/useWebSocket'
import { getKnightConfig, knightNameForDomain, KNIGHT_NAMES } from '../lib/knights'

interface ChainSummary {
  name: string
  phase: string
  startTime: string | null
  steps: { name: string; phase: string; knight: string }[]
}

interface CostEntry {
  knight: string
  cost: number
  timestamp: string
  taskId: string
  success: boolean
}

function formatCost(cost: number): string {
  return cost < 0.01 ? `$${cost.toFixed(4)}` : `$${cost.toFixed(2)}`
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function DashboardPage({ defaultCostExpanded = false }: { defaultCostExpanded?: boolean } = {}) {
  const { knights } = useFleet()
  const { events, connected } = useWebSocket()
  const [chains, setChains] = useState<ChainSummary[]>([])
  const [sessionCosts, setSessionCosts] = useState<{ total: number; perKnight: Record<string, number> }>({ total: 0, perKnight: {} })
  const [costExpanded, setCostExpanded] = useState(defaultCostExpanded)
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month'>('week')

  useEffect(() => {
    authFetch('/api/chains').then(r => r.json()).then(setChains).catch(() => {})
  }, [])

  // Fetch cumulative session costs from each knight on load
  useEffect(() => {
    (async () => {
      try {
        const fleetRes = await authFetch('/api/fleet')
        const fleetData = await fleetRes.json()
        const names: string[] = (fleetData || []).map((k: any) => k.name)

        const results = await Promise.allSettled(
          names.map(name =>
            fetch(`/api/fleet/${name}/session?type=stats`).then(r => r.json())
          )
        )

        let total = 0
        const perKnight: Record<string, number> = {}
        results.forEach((r, i) => {
          if (r.status === 'fulfilled' && r.value?.session?.cost) {
            const cost = r.value.session.cost
            total += cost
            perKnight[names[i]] = cost
          }
        })

        setSessionCosts({ total, perKnight })
      } catch { /* ignore */ }
    })()
  }, [])

  const stats = useMemo(() => {
    let totalCost = 0
    let totalTasks = 0
    let totalResults = 0
    let failures = 0
    const knightCosts: Record<string, number> = {}

    for (const e of events) {
      if (e.type === 'task') totalTasks++
      if (e.type !== 'result') continue
      totalResults++

      const data = (typeof e.data === 'string'
        ? (() => { try { return JSON.parse(e.data as string) } catch { return {} } })()
        : e.data || {}) as Record<string, unknown>

      if (data.success === false) failures++
      const cost = typeof data.cost === 'number' ? data.cost : 0
      totalCost += cost

      const parts = e.subject.split('.')
      const name = knightNameForDomain(parts[2] || '')
      if (name) knightCosts[name] = (knightCosts[name] || 0) + cost
    }

    // Merge cumulative session costs (primary) with live WS costs (supplementary)
    const mergedCosts: Record<string, number> = { ...sessionCosts.perKnight }
    for (const [name, cost] of Object.entries(knightCosts)) {
      mergedCosts[name] = (mergedCosts[name] || 0) + cost
    }
    const mergedTotal = sessionCosts.total + totalCost

    const topKnights = Object.entries(mergedCosts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

    return { totalCost: mergedTotal, totalTasks, totalResults, failures, topKnights }
  }, [events, sessionCosts])

  // Cost breakdown data for collapsible panel
  const costEntries = useMemo((): CostEntry[] => {
    const entries: CostEntry[] = []
    for (const event of events) {
      if (event.type !== 'result') continue
      const data = (typeof event.data === 'string'
        ? (() => { try { return JSON.parse(event.data as string) } catch { return {} } })()
        : event.data || {}) as Record<string, unknown>
      const cost = typeof data.cost === 'number' ? data.cost : 0
      if (cost <= 0) continue
      const parts = event.subject.split('.')
      const domain = parts[2] || ''
      entries.push({
        knight: knightNameForDomain(domain) || domain,
        cost,
        timestamp: event.timestamp,
        taskId: parts[3] || '',
        success: data.success !== false,
      })
    }
    return entries
  }, [events])

  const filteredCostEntries = useMemo(() => {
    const now = Date.now()
    const cutoff = timeRange === 'day' ? 24 * 60 * 60 * 1000
      : timeRange === 'week' ? 7 * 24 * 60 * 60 * 1000
      : 30 * 24 * 60 * 60 * 1000
    return costEntries.filter(e => now - new Date(e.timestamp).getTime() <= cutoff)
  }, [costEntries, timeRange])

  const costPanelData = useMemo(() => {
    const totalCost = filteredCostEntries.reduce((sum, e) => sum + e.cost, 0)
    const byKnight: Record<string, { cost: number; tasks: number; failures: number }> = {}
    for (const entry of filteredCostEntries) {
      if (!byKnight[entry.knight]) byKnight[entry.knight] = { cost: 0, tasks: 0, failures: 0 }
      byKnight[entry.knight].cost += entry.cost
      byKnight[entry.knight].tasks++
      if (!entry.success) byKnight[entry.knight].failures++
    }
    const costByKnight = Object.entries(byKnight)
      .map(([knight, s]) => ({ knight, ...s }))
      .sort((a, b) => b.cost - a.cost)

    const days: Record<string, number> = {}
    for (const entry of filteredCostEntries) {
      const date = formatDate(new Date(entry.timestamp))
      days[date] = (days[date] || 0) + entry.cost
    }
    const dailyCosts = Object.entries(days)
      .map(([date, cost]) => ({ date, cost }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-7)

    const topTasks = [...filteredCostEntries].sort((a, b) => b.cost - a.cost).slice(0, 10)

    return { totalCost, costByKnight, dailyCosts, topTasks }
  }, [filteredCostEntries])

  const online = knights.filter(k => k.status === 'online').length
  const runningChains = chains.filter(c => c.phase === 'Running' || c.phase === 'StepRunning')

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Crown className="w-8 h-8 text-roundtable-gold" />
            Command Center
          </h1>
          <p className="text-gray-400 mt-1">
            Fleet status at a glance • {connected ? '🟢 Live' : '🔴 Disconnected'}
          </p>
        </div>
      </div>

      {/* Top-level metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
        <MetricCard label="Knights Online" value={`${online}/${knights.length}`} color="text-green-400" icon={<Zap className="w-5 h-5" />} />
        <MetricCard label="Tasks Dispatched" value={stats.totalTasks} color="text-blue-400" icon={<Activity className="w-5 h-5" />} />
        <MetricCard label="Completed" value={stats.totalResults} color="text-green-400" />
        <MetricCard label="Failures" value={stats.failures} color={stats.failures > 0 ? 'text-red-400' : 'text-gray-400'} icon={stats.failures > 0 ? <AlertTriangle className="w-5 h-5" /> : undefined} />
        <MetricCard label="Session Cost" value={formatCost(stats.totalCost)} color="text-roundtable-gold" icon={<DollarSign className="w-5 h-5" />} />
        <MetricCard label="Active Chains" value={runningChains.length} color={runningChains.length > 0 ? 'text-blue-400' : 'text-gray-400'} icon={<Link2 className="w-5 h-5" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fleet Overview */}
        <div className="bg-roundtable-slate border border-roundtable-steel rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">🏰 Fleet</h2>
            <Link to="/fleet" className="text-xs text-roundtable-gold hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {KNIGHT_NAMES.map(name => {
              const cfg = getKnightConfig(name)
              const knight = knights.find(k => k.name === name)
              const isOnline = knight?.status === 'online'
              return (
                <div key={name} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isOnline ? 'bg-green-500/5' : 'bg-gray-500/5'}`}>
                  <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-600'}`} />
                  <span className="text-sm">{cfg.emoji}</span>
                  <span className={`text-sm capitalize ${isOnline ? 'text-gray-300' : 'text-gray-600'}`}>{name}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Top Spenders */}
        <div className="bg-roundtable-slate border border-roundtable-steel rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">💰 Cost by Knight</h2>
            <Link to="/sessions" className="text-xs text-roundtable-gold hover:underline flex items-center gap-1">
              Details <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {stats.topKnights.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">No cost data yet</p>
          ) : (
            <div className="space-y-3">
              {stats.topKnights.map(([name, cost]) => {
                const cfg = getKnightConfig(name)
                const maxCost = stats.topKnights[0]?.[1] || 1
                return (
                  <div key={name} className="flex items-center gap-3">
                    <span className="w-20 text-sm text-gray-300 truncate">{cfg.emoji} {name}</span>
                    <div className="flex-1 h-4 bg-roundtable-navy rounded-full overflow-hidden">
                      <div className="h-full bg-roundtable-gold/40 rounded-full transition-all"
                        style={{ width: `${(cost / maxCost) * 100}%` }} />
                    </div>
                    <span className="text-sm text-roundtable-gold w-16 text-right">{formatCost(cost)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Chain Status */}
        <div className="bg-roundtable-slate border border-roundtable-steel rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">⛓️ Chains</h2>
            <Link to="/chains" className="text-xs text-roundtable-gold hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {chains.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">No chains configured</p>
          ) : (
            <div className="space-y-2">
              {chains.map(chain => {
                const phaseColor = chain.phase === 'Completed' ? 'text-green-400'
                  : chain.phase === 'Failed' ? 'text-red-400'
                  : chain.phase === 'Running' || chain.phase === 'StepRunning' ? 'text-blue-400'
                  : 'text-gray-400'
                return (
                  <div key={chain.name} className="flex items-center justify-between py-2 border-b border-roundtable-steel/30 last:border-0">
                    <span className="text-sm text-gray-300">{chain.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{(chain.steps || []).length} steps</span>
                      <span className={`text-xs font-medium ${phaseColor}`}>{chain.phase || 'Pending'}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-roundtable-slate border border-roundtable-steel rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">📡 Recent Activity</h2>
            <Link to="/flow" className="text-xs text-roundtable-gold hover:underline flex items-center gap-1">
              Live feed <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {events.slice(0, 10).map((e, i) => {
              const parts = e.subject.split('.')
              const name = knightNameForDomain(parts[2] || '')
              const cfg = name ? getKnightConfig(name) : null
              return (
                <div key={i} className="flex items-center gap-2 text-xs py-1">
                  <span>{e.type === 'task' ? '📤' : '📥'}</span>
                  <span>{cfg?.emoji || '🤖'}</span>
                  <span className="text-gray-400 truncate flex-1">{name || parts[2]}</span>
                  <span className="text-gray-600">{new Date(e.timestamp).toLocaleTimeString()}</span>
                </div>
              )
            })}
            {events.length === 0 && (
              <p className="text-gray-500 text-sm text-center py-4">Waiting for activity...</p>
            )}
          </div>
        </div>
      </div>

      {/* Cost Details — collapsible */}
      <div className="mt-6 bg-roundtable-slate border border-roundtable-steel rounded-xl overflow-hidden">
        <button
          onClick={() => setCostExpanded(v => !v)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-roundtable-steel/20 transition-colors"
        >
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-roundtable-gold" />
            Cost Details
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">
              {filteredCostEntries.length} tasks · {timeRange === 'day' ? 'Last 24h' : timeRange === 'week' ? 'Last 7 days' : 'Last 30 days'}
            </span>
            {costExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
          </div>
        </button>

        {costExpanded && (
          <div className="px-5 pb-5">
            {/* Time range + summary */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-4">
                <span className="text-2xl font-bold text-roundtable-gold">{formatCost(costPanelData.totalCost)}</span>
                <div className="flex gap-1.5">
                  {(['day', 'week', 'month'] as const).map(range => (
                    <button
                      key={range}
                      onClick={() => setTimeRange(range)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                        timeRange === range
                          ? 'bg-roundtable-gold/20 text-roundtable-gold border border-roundtable-gold/30'
                          : 'bg-roundtable-steel/50 text-gray-400 hover:text-gray-300'
                      }`}
                    >
                      {range === 'day' ? 'Today' : range === 'week' ? 'Week' : 'Month'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-4 text-sm text-gray-400">
                <span><span className="text-white font-medium">{filteredCostEntries.length}</span> tasks</span>
                <span><span className="text-white font-medium">{costPanelData.costByKnight.length}</span> active knights</span>
                <span>avg <span className="text-roundtable-gold font-medium">{filteredCostEntries.length > 0 ? formatCost(costPanelData.totalCost / filteredCostEntries.length) : '$0.00'}</span>/task</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Cost by Knight */}
              <div>
                <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-roundtable-gold" /> Cost by Knight
                </h3>
                {costPanelData.costByKnight.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-6">No cost data available</p>
                ) : (
                  <div className="space-y-3">
                    {costPanelData.costByKnight.map(({ knight, cost, tasks, failures }) => {
                      const cfg = getKnightConfig(knight)
                      const barWidth = (cost / (costPanelData.costByKnight[0]?.cost || 1)) * 100
                      return (
                        <div key={knight} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className={cfg.color}>{cfg.emoji}</span>
                              <span className="text-gray-300 capitalize">{knight}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-gray-500 text-xs">{tasks} tasks</span>
                              {failures > 0 && <span className="text-red-400 text-xs">{failures} failed</span>}
                              <span className="text-roundtable-gold font-medium">{formatCost(cost)}</span>
                            </div>
                          </div>
                          <div className="h-2 bg-roundtable-navy rounded-full overflow-hidden">
                            <div className="h-full bg-roundtable-gold/40 rounded-full transition-all" style={{ width: `${barWidth}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Daily trend */}
              <div>
                <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-400" /> Daily Cost Trend
                </h3>
                {costPanelData.dailyCosts.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-6">No trend data available</p>
                ) : (
                  <div className="space-y-2">
                    {costPanelData.dailyCosts.map(({ date, cost }) => {
                      const maxCost = Math.max(...costPanelData.dailyCosts.map(d => d.cost), 1)
                      return (
                        <div key={date} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-400">{date}</span>
                            <span className="text-roundtable-gold font-medium">{formatCost(cost)}</span>
                          </div>
                          <div className="h-2 bg-roundtable-navy rounded-full overflow-hidden">
                            <div className="h-full bg-blue-400/40 rounded-full transition-all" style={{ width: `${(cost / maxCost) * 100}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Most expensive tasks */}
            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-400" /> Most Expensive Tasks
              </h3>
              {costPanelData.topTasks.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-6">No task data available</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-roundtable-steel">
                        <th className="text-left text-gray-400 text-xs font-medium pb-2">Knight</th>
                        <th className="text-left text-gray-400 text-xs font-medium pb-2">Task ID</th>
                        <th className="text-left text-gray-400 text-xs font-medium pb-2">Time</th>
                        <th className="text-right text-gray-400 text-xs font-medium pb-2">Cost</th>
                        <th className="text-center text-gray-400 text-xs font-medium pb-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {costPanelData.topTasks.map((task, i) => {
                        const cfg = getKnightConfig(task.knight)
                        return (
                          <tr key={i} className="border-b border-roundtable-steel/30 last:border-0">
                            <td className="py-2">
                              <div className="flex items-center gap-2">
                                <span className={cfg.color}>{cfg.emoji}</span>
                                <span className="text-gray-300 text-sm capitalize">{task.knight}</span>
                              </div>
                            </td>
                            <td className="py-2">
                              <span className="text-gray-400 text-xs font-mono truncate max-w-[200px] block">{task.taskId}</span>
                            </td>
                            <td className="py-2">
                              <span className="text-gray-500 text-xs">{new Date(task.timestamp).toLocaleTimeString()}</span>
                            </td>
                            <td className="py-2 text-right">
                              <span className="text-roundtable-gold font-medium text-sm">{formatCost(task.cost)}</span>
                            </td>
                            <td className="py-2 text-center">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${task.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                {task.success ? 'Success' : 'Failed'}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function MetricCard({ label, value, color, icon }: {
  label: string; value: string | number; color: string; icon?: React.ReactNode
}) {
  return (
    <div className="bg-roundtable-slate border border-roundtable-steel rounded-xl p-4">
      <div className="flex items-center justify-between">
        <p className="text-gray-400 text-xs">{label}</p>
        {icon && <span className={color}>{icon}</span>}
      </div>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  )
}
