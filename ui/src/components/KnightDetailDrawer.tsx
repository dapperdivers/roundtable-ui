import { useEffect, useState } from 'react'
import { X, Activity, Cpu, DollarSign, MessageSquare, Wrench, Clock, ChevronRight, RefreshCw } from 'lucide-react'
import { getKnightConfig } from '../lib/knights'
import { useKnightSession } from '../hooks/useKnightSession'
import type { Knight } from '../hooks/useFleet'

interface Props {
  knight: Knight | null
  onClose: () => void
}

function formatCost(cost: number): string {
  return cost < 0.01 ? `$${cost.toFixed(4)}` : `$${cost.toFixed(2)}`
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString()
  } catch {
    return ts
  }
}

const entryTypeColors: Record<string, string> = {
  user: 'bg-blue-500/20 text-blue-400',
  assistant: 'bg-green-500/20 text-green-400',
  tool_use: 'bg-purple-500/20 text-purple-400',
  tool_result: 'bg-amber-500/20 text-amber-400',
  thinking: 'bg-gray-500/20 text-gray-400',
  compaction: 'bg-red-500/20 text-red-400',
}

export function KnightDetailDrawer({ knight, onClose }: Props) {
  const { stats, recent, loading, error, fetchStats, fetchRecent } = useKnightSession()
  const [recentLoading, setRecentLoading] = useState(false)

  const refreshAll = async (knightName: string) => {
    fetchStats(knightName)
    setRecentLoading(true)
    await fetchRecent(knightName, 30)
    setRecentLoading(false)
  }

  useEffect(() => {
    if (knight) {
      refreshAll(knight.name)
    }
  }, [knight])

  if (!knight) return null

  const config = getKnightConfig(knight.name)

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-[480px] bg-roundtable-navy border-l border-roundtable-steel z-50 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-roundtable-navy border-b border-roundtable-steel p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{config.emoji}</span>
            <div>
              <h2 className="text-xl font-bold text-white capitalize">{knight.name}</h2>
              <p className={`text-sm ${config.color}`}>{config.title} Knight</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => knight && refreshAll(knight.name)} className="text-gray-400 hover:text-roundtable-gold p-1 transition-colors" title="Refresh">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-6">
          {/* Status bar */}
          <div className="flex items-center gap-3">
            <span className={`w-2.5 h-2.5 rounded-full ${knight.ready ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
            <span className="text-sm text-gray-300">{knight.ready ? 'Online' : 'Offline'}</span>
            <span className="text-xs text-gray-500">•</span>
            <span className="text-xs text-gray-500">{knight.age} uptime</span>
            <span className="text-xs text-gray-500">•</span>
            <span className="text-xs text-gray-500">{knight.restarts} restarts</span>
          </div>

          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin w-6 h-6 border-2 border-roundtable-gold border-t-transparent rounded-full mx-auto mb-2" />
              <p className="text-gray-500 text-sm">Querying knight...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3">
              <p className="text-red-400 text-sm">⚠️ {error}</p>
              <p className="text-red-400/60 text-xs mt-1">Knight may not have introspection enabled yet</p>
            </div>
          )}

          {/* Session Stats */}
          {stats?.session && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Session Stats
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  icon={<MessageSquare className="w-4 h-4" />}
                  label="Messages"
                  value={stats.session.totalMessages}
                  detail={`${stats.session.userMessages} user / ${stats.session.assistantMessages} assistant`}
                />
                <StatCard
                  icon={<Wrench className="w-4 h-4" />}
                  label="Tool Calls"
                  value={stats.session.toolCalls}
                />
                <StatCard
                  icon={<Cpu className="w-4 h-4" />}
                  label="Tokens"
                  value={stats.session.tokens.total.toLocaleString()}
                  detail={`${stats.session.tokens.input.toLocaleString()} in / ${stats.session.tokens.output.toLocaleString()} out`}
                />
                <StatCard
                  icon={<DollarSign className="w-4 h-4" />}
                  label="Total Cost"
                  value={formatCost(stats.session.cost)}
                  color="text-roundtable-gold"
                />
              </div>
            </div>
          )}

          {/* Runtime Info */}
          {stats?.runtime && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                <Cpu className="w-4 h-4" />
                Runtime
              </h3>
              <div className="bg-roundtable-slate rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Model</span>
                  <span className="text-gray-200 font-mono text-xs">{stats.runtime.model}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Uptime</span>
                  <span className="text-gray-200">{formatUptime(stats.runtime.uptime)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Active Tasks</span>
                  <span className={stats.runtime.activeTasks > 0 ? 'text-yellow-400' : 'text-gray-200'}>
                    {stats.runtime.activeTasks}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Recent Activity */}
          {(recent.length > 0 || recentLoading || stats?.session) && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Recent Activity {recent.length > 0 && `(${recent.length} entries)`}
              </h3>
              {recentLoading && (
                <div className="text-center py-4">
                  <div className="animate-spin w-5 h-5 border-2 border-roundtable-gold border-t-transparent rounded-full mx-auto mb-2" />
                  <p className="text-gray-500 text-xs">Loading activity...</p>
                </div>
              )}
              {!recentLoading && recent.length === 0 && (
                <p className="text-gray-500 text-sm text-center py-4">Send a task to see activity here</p>
              )}
              <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                {recent.map((entry) => (
                  <ActivityEntry key={entry.id} entry={entry} />
                ))}
              </div>
            </div>
          )}

          {/* No session */}
          {!loading && !error && !stats?.session && (
            <div className="text-center py-8 text-gray-500">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No session data available</p>
              <p className="text-xs mt-1">Knight may not have processed any tasks yet</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function ActivityEntry({ entry }: { entry: any }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className="bg-roundtable-slate rounded-lg p-2.5 border border-roundtable-steel/50 cursor-pointer"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className={`text-xs px-1.5 py-0.5 rounded ${entryTypeColors[entry.type] || 'bg-gray-500/20 text-gray-400'}`}>
            {entry.type === 'tool_use' ? '🔧' : entry.type === 'tool_result' ? '📋' : entry.role === 'user' ? '📨' : '🤖'}
            {' '}{entry.type}
          </span>
          {entry.toolName && (
            <span className="text-xs text-purple-400 font-mono">{entry.toolName}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-600">{formatTimestamp(entry.timestamp)}</span>
          <ChevronRight className={`w-3 h-3 text-gray-600 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </div>
      </div>
      {entry.text && (
        <p className={`text-xs text-gray-400 mt-1 ${expanded ? 'whitespace-pre-wrap' : 'line-clamp-4'}`}>{entry.text}</p>
      )}
      {entry.input && (
        <p className={`text-xs text-gray-500 mt-1 font-mono ${expanded ? 'whitespace-pre-wrap break-all' : 'line-clamp-3'}`}>→ {entry.input}</p>
      )}
      {entry.output && (
        <p className={`text-xs text-gray-500 mt-1 font-mono ${expanded ? 'whitespace-pre-wrap break-all' : 'line-clamp-3'}`}>← {entry.output}</p>
      )}
      {entry.cost != null && entry.cost > 0 && (
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-roundtable-gold">{formatCost(entry.cost)}</span>
          {entry.tokens && (
            <span className="text-xs text-gray-600">{entry.tokens.input + entry.tokens.output} tokens</span>
          )}
        </div>
      )}
    </div>
  )
}

function StatCard({ icon, label, value, detail, color }: {
  icon: React.ReactNode
  label: string
  value: string | number
  detail?: string
  color?: string
}) {
  return (
    <div className="bg-roundtable-slate rounded-lg p-3">
      <div className="flex items-center gap-2 text-gray-400 mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className={`text-lg font-bold ${color || 'text-white'}`}>{value}</p>
      {detail && <p className="text-xs text-gray-500 mt-0.5">{detail}</p>}
    </div>
  )
}
