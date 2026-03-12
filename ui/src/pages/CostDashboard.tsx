import { useState, useMemo, useEffect } from 'react'
import { DollarSign, TrendingUp, Calendar, Activity, BarChart3 } from 'lucide-react'
import { useWebSocket } from '../hooks/useWebSocket'
import { useFleet } from '../hooks/useFleet'
import { getKnightConfig, knightNameForDomain } from '../lib/knights'

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

export function CostDashboardPage() {
  const { events } = useWebSocket()
  const { knights } = useFleet()
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month'>('week')

  // Parse cost data from result events
  const costEntries = useMemo(() => {
    const entries: CostEntry[] = []
    
    for (const event of events) {
      if (event.type !== 'result') continue
      
      const data = (typeof event.data === 'string'
        ? (() => { try { return JSON.parse(event.data) } catch { return {} } })()
        : event.data || {}) as Record<string, unknown>
      
      const cost = typeof data.cost === 'number' ? data.cost : 0
      if (cost <= 0) continue
      
      const parts = event.subject.split('.')
      const domain = parts[2] || ''
      const knight = knightNameForDomain(domain) || domain
      const taskId = parts[3] || ''
      const success = data.success !== false
      
      entries.push({
        knight,
        cost,
        timestamp: event.timestamp,
        taskId,
        success,
      })
    }
    
    return entries
  }, [events])

  // Filter by time range
  const filteredEntries = useMemo(() => {
    const now = Date.now()
    const cutoff = timeRange === 'day' ? 24 * 60 * 60 * 1000
      : timeRange === 'week' ? 7 * 24 * 60 * 60 * 1000
      : 30 * 24 * 60 * 60 * 1000
    
    return costEntries.filter(e => {
      const ts = new Date(e.timestamp).getTime()
      return now - ts <= cutoff
    })
  }, [costEntries, timeRange])

  // Total cost
  const totalCost = useMemo(() => {
    return filteredEntries.reduce((sum, e) => sum + e.cost, 0)
  }, [filteredEntries])

  // Cost by knight
  const costByKnight = useMemo(() => {
    const byKnight: Record<string, { cost: number; tasks: number; failures: number }> = {}
    
    for (const entry of filteredEntries) {
      if (!byKnight[entry.knight]) {
        byKnight[entry.knight] = { cost: 0, tasks: 0, failures: 0 }
      }
      byKnight[entry.knight].cost += entry.cost
      byKnight[entry.knight].tasks++
      if (!entry.success) byKnight[entry.knight].failures++
    }
    
    return Object.entries(byKnight)
      .map(([knight, stats]) => ({ knight, ...stats }))
      .sort((a, b) => b.cost - a.cost)
  }, [filteredEntries])

  // Daily cost trend
  const dailyCosts = useMemo(() => {
    const days: Record<string, number> = {}
    
    for (const entry of filteredEntries) {
      const date = formatDate(new Date(entry.timestamp))
      days[date] = (days[date] || 0) + entry.cost
    }
    
    return Object.entries(days)
      .map(([date, cost]) => ({ date, cost }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-7) // Last 7 days
  }, [filteredEntries])

  // Cost per task breakdown
  const topTasks = useMemo(() => {
    const tasks = filteredEntries
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 10)
    return tasks
  }, [filteredEntries])

  const maxKnightCost = costByKnight[0]?.cost || 1

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-roundtable-gold" />
            Cost Dashboard
          </h1>
          <p className="text-gray-400 mt-1">
            {filteredEntries.length} tasks · {timeRange === 'day' ? 'Last 24 hours' : timeRange === 'week' ? 'Last 7 days' : 'Last 30 days'}
          </p>
        </div>

        {/* Time range selector */}
        <div className="flex gap-2">
          {(['day', 'week', 'month'] as const).map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
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

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-roundtable-slate border border-roundtable-steel rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-400 text-sm">Total Cost</p>
            <DollarSign className="w-5 h-5 text-roundtable-gold" />
          </div>
          <p className="text-3xl font-bold text-roundtable-gold">{formatCost(totalCost)}</p>
        </div>

        <div className="bg-roundtable-slate border border-roundtable-steel rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-400 text-sm">Tasks Completed</p>
            <Activity className="w-5 h-5 text-blue-400" />
          </div>
          <p className="text-3xl font-bold text-white">{filteredEntries.length}</p>
        </div>

        <div className="bg-roundtable-slate border border-roundtable-steel rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-400 text-sm">Avg Cost/Task</p>
            <TrendingUp className="w-5 h-5 text-green-400" />
          </div>
          <p className="text-3xl font-bold text-white">
            {filteredEntries.length > 0 ? formatCost(totalCost / filteredEntries.length) : '$0.00'}
          </p>
        </div>

        <div className="bg-roundtable-slate border border-roundtable-steel rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-400 text-sm">Active Knights</p>
            <BarChart3 className="w-5 h-5 text-purple-400" />
          </div>
          <p className="text-3xl font-bold text-white">{costByKnight.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Cost by Knight */}
        <div className="bg-roundtable-slate border border-roundtable-steel rounded-xl p-5">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-roundtable-gold" />
            Cost by Knight
          </h2>

          {costByKnight.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No cost data available</p>
          ) : (
            <div className="space-y-3">
              {costByKnight.map(({ knight, cost, tasks, failures }) => {
                const cfg = getKnightConfig(knight)
                const barWidth = (cost / maxKnightCost) * 100
                return (
                  <div key={knight} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className={cfg.color}>{cfg.emoji}</span>
                        <span className="text-gray-300 capitalize">{knight}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-500 text-xs">{tasks} tasks</span>
                        {failures > 0 && (
                          <span className="text-red-400 text-xs">{failures} failed</span>
                        )}
                        <span className="text-roundtable-gold font-medium">{formatCost(cost)}</span>
                      </div>
                    </div>
                    <div className="h-2 bg-roundtable-navy rounded-full overflow-hidden">
                      <div
                        className="h-full bg-roundtable-gold/40 rounded-full transition-all"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Daily trend */}
        <div className="bg-roundtable-slate border border-roundtable-steel rounded-xl p-5">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-400" />
            Daily Cost Trend
          </h2>

          {dailyCosts.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No trend data available</p>
          ) : (
            <div className="space-y-2">
              {dailyCosts.map(({ date, cost }) => {
                const maxCost = Math.max(...dailyCosts.map(d => d.cost), 1)
                const barWidth = maxCost > 0 ? (cost / maxCost) * 100 : 0
                return (
                  <div key={date} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">{date}</span>
                      <span className="text-roundtable-gold font-medium">{formatCost(cost)}</span>
                    </div>
                    <div className="h-2 bg-roundtable-navy rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-400/40 rounded-full transition-all"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Top expensive tasks */}
      <div className="bg-roundtable-slate border border-roundtable-steel rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-green-400" />
          Most Expensive Tasks
        </h2>

        {topTasks.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No task data available</p>
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
                {topTasks.map((task, i) => {
                  const cfg = getKnightConfig(task.knight)
                  const time = new Date(task.timestamp)
                  return (
                    <tr key={i} className="border-b border-roundtable-steel/30 last:border-0">
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <span className={cfg.color}>{cfg.emoji}</span>
                          <span className="text-gray-300 text-sm capitalize">{task.knight}</span>
                        </div>
                      </td>
                      <td className="py-3">
                        <span className="text-gray-400 text-xs font-mono truncate max-w-[200px] block">
                          {task.taskId}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className="text-gray-500 text-xs">
                          {time.toLocaleTimeString()}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <span className="text-roundtable-gold font-medium text-sm">
                          {formatCost(task.cost)}
                        </span>
                      </td>
                      <td className="py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          task.success
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}>
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
  )
}
