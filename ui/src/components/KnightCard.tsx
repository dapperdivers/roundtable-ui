import { Shield, Wifi, WifiOff, RotateCw } from 'lucide-react'
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

export function KnightCard({ knight, onClick, activity }: KnightCardProps) {
  const config = getKnightConfig(knight.name)

  return (
    <div
      onClick={onClick}
      className="bg-roundtable-slate border border-roundtable-steel rounded-xl p-5 hover:border-roundtable-gold/30 transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{config.emoji}</span>
          <div>
            <h3 className="font-bold text-white capitalize">{knight.name}</h3>
            <p className={`text-sm ${config.color}`}>{config.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${statusColors[knight.status]} animate-pulse`} />
          <span className="text-xs text-gray-400 capitalize">{knight.status}</span>
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

      <div className={`${activity ? '' : 'mt-3 pt-3 border-t border-roundtable-steel/50'} ${activity ? 'mt-2' : ''} flex items-center justify-between`}>
        <p className="text-xs text-gray-500 truncate font-mono">{knight.age} uptime</p>
        <span className="text-xs text-gray-600 group-hover:text-roundtable-gold/60 transition-colors">inspect →</span>
      </div>
    </div>
  )
}
