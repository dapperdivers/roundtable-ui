import { useState, useEffect, useMemo } from 'react'
import { Crown, Activity, DollarSign, Zap, AlertTriangle, Link2, ArrowRight } from 'lucide-react'
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

function formatCost(cost: number): string {
  return cost < 0.01 ? `$${cost.toFixed(4)}` : `$${cost.toFixed(2)}`
}

export function DashboardPage() {
  const { knights } = useFleet()
  const { events, connected } = useWebSocket()
  const [chains, setChains] = useState<ChainSummary[]>([])
  const [sessionCosts, setSessionCosts] = useState<{ total: number; perKnight: Record<string, number> }>({ total: 0, perKnight: {} })

  useEffect(() => {
    fetch('/api/chains').then(r => r.json()).then(setChains).catch(() => {})
  }, [])

  // Fetch cumulative session costs from each knight on load
  useEffect(() => {
    (async () => {
      try {
        const fleetRes = await fetch('/api/fleet')
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
            <Link to="/" className="text-xs text-roundtable-gold hover:underline flex items-center gap-1">
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
