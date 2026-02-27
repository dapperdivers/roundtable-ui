import { Activity, Wifi, WifiOff } from 'lucide-react'
import { useWebSocket } from '../hooks/useWebSocket'

export function LivePage() {
  const { events, connected } = useWebSocket()

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Activity className="w-8 h-8 text-roundtable-gold" />
          Live Feed
        </h1>
        <div className="flex items-center gap-2">
          {connected ? (
            <>
              <Wifi className="w-4 h-4 text-green-400" />
              <span className="text-green-400 text-sm">Connected</span>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4 text-red-400" />
              <span className="text-red-400 text-sm">Disconnected</span>
            </>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {events.length === 0 && (
          <div className="text-center py-20 text-gray-500">
            <Activity className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>Waiting for NATS events...</p>
            <p className="text-sm mt-1">Tasks and results will appear here in real-time</p>
          </div>
        )}

        {events.map((event, i) => (
          <div
            key={i}
            className={`bg-roundtable-slate border rounded-lg p-4 ${
              event.type === 'task'
                ? 'border-blue-500/30'
                : 'border-green-500/30'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs px-2 py-0.5 rounded font-medium ${
                    event.type === 'task'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-green-500/20 text-green-400'
                  }`}
                >
                  {event.type.toUpperCase()}
                </span>
                <span className="text-sm text-gray-400 font-mono">{event.subject}</span>
              </div>
              <span className="text-xs text-gray-500">
                {new Date(event.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <pre className="text-xs text-gray-400 overflow-auto max-h-32 font-mono">
              {typeof event.data === 'string'
                ? event.data
                : JSON.stringify(event.data, null, 2)}
            </pre>
          </div>
        ))}
      </div>
    </div>
  )
}
