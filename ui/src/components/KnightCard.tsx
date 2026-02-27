import { Shield, Wifi, WifiOff, RotateCw } from 'lucide-react'
import type { Knight } from '../hooks/useFleet'
import { getKnightConfig } from '../lib/knights'

interface KnightCardProps {
  knight: Knight
  onClick?: () => void
}

const statusColors = {
  online: 'bg-green-500',
  offline: 'bg-red-500',
  starting: 'bg-yellow-500',
  busy: 'bg-blue-500',
}

export function KnightCard({ knight, onClick }: KnightCardProps) {
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

      <div className="mt-3 pt-3 border-t border-roundtable-steel/50">
        <p className="text-xs text-gray-500 truncate font-mono">{knight.age} uptime</p>
      </div>
    </div>
  )
}
