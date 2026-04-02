import { Shield, Wifi, WifiOff, RotateCw, Cpu, CheckCircle, XCircle, DollarSign } from 'lucide-react'
import type { Knight } from '../hooks/useFleet'
import { getKnightConfig } from '../lib/knights'

interface KnightActivity {
  recent: number
  lastActive: string | null
  busy: boolean
  sparkline?: number[]
}

interface KnightCardProps {
  knight: Knight
  onClick?: () => void
  activity?: KnightActivity
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  return `${hr}h ago`
}

function MiniSparkline({ bars, active }: { bars: number[]; active: boolean }) {
  return (
    <div className="flex items-end gap-0.5 h-4">
      {bars.map((v, i) => (
        <div
          key={i}
          className={`w-1.5 rounded-sm transition-all ${active ? 'bg-green-500/70' : 'bg-gray-600/50'}`}
          style={{ height: `${Math.max(v * 100, 10)}%` }}
        />
      ))}
    </div>
  )
}

const statusColors = {
  online: 'bg-green-500',
  offline: 'bg-red-500',
  starting: 'bg-yellow-500',
  busy: 'bg-blue-500',
}

const phaseColors = {
  Ready: 'bg-green-500/20 text-green-400 border-green-500/30',
  Degraded: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  Suspended: 'bg-red-500/20 text-red-400 border-red-500/30',
  Provisioning: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  Pending: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

function extractModelShortName(model?: string): string | null {
  if (!model) return null
  // Extract short name from strings like "claude-sonnet-4-20250514" or "anthropic/claude-sonnet-4"
  const match = model.match(/(?:claude-)?([a-z]+-\d+(?:-[a-z]+)?)/i)
  if (match) return match[1]
  // Fallback: just return last part after last slash or dash
  const parts = model.split(/[\/]/)
  return parts[parts.length - 1].split('-').slice(0, 2).join('-')
}

export function KnightCard({ knight, onClick, activity }: KnightCardProps) {
  const config = getKnightConfig(knight.name)
  const modelShortName = extractModelShortName(knight.model)
  const successRate = knight.tasksCompleted !== undefined && knight.tasksFailed !== undefined
    ? knight.tasksCompleted / (knight.tasksCompleted + knight.tasksFailed || 1)
    : null

  return (
    <div
      onClick={onClick}
      className="bg-roundtable-slate border border-roundtable-steel rounded-xl p-5 hover:border-roundtable-gold/30 transition-all cursor-pointer group relative"
    >
      {/* Suspended overlay */}
      {knight.suspended && (
        <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-md shadow-lg z-10">
          SUSPENDED
        </div>
      )}

      {/* Runtime badge */}
      {knight.runtime && (
        <div className={`absolute top-2 right-2 text-xs font-medium px-2 py-1 rounded-md border ${
          knight.runtime === 'sandbox' 
            ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' 
            : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
        }`}>
          {knight.runtime}
        </div>
      )}

      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{config.emoji}</span>
          <div>
            <h3 className="font-bold text-white capitalize">{knight.name}</h3>
            <p className={`text-sm ${config.color}`}>{config.title}</p>
            {modelShortName && (
              <div className="mt-1 inline-flex items-center gap-1 bg-roundtable-navy/70 border border-roundtable-steel/50 rounded px-2 py-0.5">
                <Cpu className="w-3 h-3 text-gray-400" />
                <span className="text-xs text-gray-300 font-mono">{modelShortName}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${statusColors[knight.status]} animate-pulse`} />
            <span className="text-xs text-gray-400 capitalize">{knight.status}</span>
          </div>
          {knight.phase && (
            <span className={`text-xs px-2 py-0.5 rounded border ${phaseColors[knight.phase as keyof typeof phaseColors] || phaseColors.Pending}`}>
              {knight.phase}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-roundtable-navy/50 rounded-lg p-2">
          <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
            {knight.ready ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          </div>
          <p className="text-xs text-gray-400">{knight.ready ? 'Ready' : 'Not Ready'}</p>
        </div>
        <div className="bg-roundtable-navy/50 rounded-lg p-2">
          <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
            <Shield className="w-3 h-3" />
            <span className="text-sm font-mono">{knight.domain}</span>
          </div>
          <p className="text-xs text-gray-400">Domain</p>
        </div>
        <div className="bg-roundtable-navy/50 rounded-lg p-2">
          <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
            <RotateCw className="w-3 h-3" />
            <span className="text-sm font-mono">{knight.restarts}</span>
          </div>
          <p className="text-xs text-gray-400">Restarts</p>
        </div>
      </div>

      {/* Activity indicator */}
      {activity && (
        <div className="mt-3 pt-3 border-t border-roundtable-steel/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {activity.busy ? (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-xs text-amber-400">Working...</span>
              </>
            ) : activity.recent > 0 ? (
              <span className="text-xs text-gray-400">{activity.recent} tasks recently</span>
            ) : activity.lastActive ? (
              <span className="text-xs text-gray-500">Last active {formatRelativeTime(activity.lastActive)}</span>
            ) : (
              <span className="text-xs text-gray-600">Idle</span>
            )}
          </div>
          <MiniSparkline bars={activity.sparkline || [0, 0, 0, 0, 0]} active={activity.recent > 0 || activity.busy} />
        </div>
      )}

      {/* Performance metrics */}
      {(knight.tasksCompleted !== undefined || knight.totalCost !== undefined) && (
        <div className="mt-3 pt-3 border-t border-roundtable-steel/50">
          <div className="grid grid-cols-3 gap-2 text-center">
            {knight.tasksCompleted !== undefined && (
              <div className="bg-roundtable-navy/30 rounded p-1.5">
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <CheckCircle className="w-3 h-3 text-green-400" />
                  <span className="text-xs font-mono text-white">{knight.tasksCompleted}</span>
                </div>
                <p className="text-[10px] text-gray-500">completed</p>
              </div>
            )}
            {successRate !== null && (
              <div className="bg-roundtable-navy/30 rounded p-1.5">
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  {successRate >= 0.9 ? (
                    <CheckCircle className="w-3 h-3 text-green-400" />
                  ) : successRate >= 0.7 ? (
                    <Shield className="w-3 h-3 text-yellow-400" />
                  ) : (
                    <XCircle className="w-3 h-3 text-red-400" />
                  )}
                  <span className="text-xs font-mono text-white">{(successRate * 100).toFixed(0)}%</span>
                </div>
                <p className="text-[10px] text-gray-500">success</p>
              </div>
            )}
            {knight.totalCost && (
              <div className="bg-roundtable-navy/30 rounded p-1.5">
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <DollarSign className="w-3 h-3 text-blue-400" />
                  <span className="text-xs font-mono text-white">{knight.totalCost}</span>
                </div>
                <p className="text-[10px] text-gray-500">cost</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className={`${activity || (knight.tasksCompleted !== undefined || knight.totalCost !== undefined) ? 'mt-2' : 'mt-3 pt-3 border-t border-roundtable-steel/50'} flex items-center justify-between`}>
        <p className="text-xs text-gray-500 truncate font-mono">{knight.age} uptime</p>
        <span className="text-xs text-gray-600 group-hover:text-roundtable-gold/60 transition-colors">inspect →</span>
      </div>
    </div>
  )
}
