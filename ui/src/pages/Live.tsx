import { useState, useMemo } from 'react'
import { GitGraph, Wifi, WifiOff, Filter } from 'lucide-react'
import { useWebSocket, type NatsEvent } from '../hooks/useWebSocket'
import { getKnightConfig, KNIGHT_CONFIG } from '../lib/knights'

function parseSubject(subject: string) {
  // fleet-a.tasks.{domain}.{taskId} or fleet-a.results.{domain}.{taskId}
  const parts = subject.split('.')
  return {
    fleet: parts[0] || '',
    type: parts[1] || '',
    domain: parts[2] || '',
    taskId: parts[3] || '',
  }
}

function findKnightForDomain(domain: string): string | null {
  const entry = Object.entries(KNIGHT_CONFIG).find(([, c]) => c.domain === domain)
  return entry ? entry[0] : null
}

function parseEventData(data: unknown): Record<string, unknown> {
  if (typeof data === 'string') {
    try { return JSON.parse(data) } catch { return { raw: data } }
  }
  return (data as Record<string, unknown>) || {}
}

export function LivePage() {
  const { events, connected } = useWebSocket()
  const [filterKnight, setFilterKnight] = useState<string>('')
  const [filterType, setFilterType] = useState<string>('')
  const [filterDomain, setFilterDomain] = useState<string>('')
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  const knightNames = Object.keys(KNIGHT_CONFIG)
  const domains = [...new Set(Object.values(KNIGHT_CONFIG).map(c => c.domain))]

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const parsed = parseSubject(event.subject)
      if (filterType && event.type !== filterType) return false
      if (filterDomain && parsed.domain !== filterDomain) return false
      if (filterKnight) {
        const knight = findKnightForDomain(parsed.domain)
        if (knight !== filterKnight) return false
      }
      return true
    })
  }, [events, filterKnight, filterType, filterDomain])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <GitGraph className="w-8 h-8 text-roundtable-gold" />
          Message Flow
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
          <span className="text-gray-500 text-sm ml-2">({filteredEvents.length} events)</span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-roundtable-slate border border-roundtable-steel rounded-xl p-4 mb-6">
        <div className="flex items-center gap-4">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={filterKnight}
            onChange={(e) => setFilterKnight(e.target.value)}
            className="bg-roundtable-navy border border-roundtable-steel rounded-lg px-3 py-1.5 text-sm text-white"
          >
            <option value="">All Knights</option>
            {knightNames.map((k) => (
              <option key={k} value={k}>{getKnightConfig(k).emoji} {k}</option>
            ))}
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-roundtable-navy border border-roundtable-steel rounded-lg px-3 py-1.5 text-sm text-white"
          >
            <option value="">All Types</option>
            <option value="task">📤 Tasks (outgoing)</option>
            <option value="result">📥 Results (incoming)</option>
          </select>
          <select
            value={filterDomain}
            onChange={(e) => setFilterDomain(e.target.value)}
            className="bg-roundtable-navy border border-roundtable-steel rounded-lg px-3 py-1.5 text-sm text-white"
          >
            <option value="">All Domains</option>
            {domains.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          {(filterKnight || filterType || filterDomain) && (
            <button
              onClick={() => { setFilterKnight(''); setFilterType(''); setFilterDomain('') }}
              className="text-xs text-gray-400 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Event stream */}
      <div className="space-y-2">
        {filteredEvents.length === 0 && (
          <div className="text-center py-20 text-gray-500">
            <GitGraph className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>Waiting for messages to flow...</p>
            <p className="text-sm mt-1">Tasks and results between knights will appear here in real-time</p>
          </div>
        )}

        {filteredEvents.map((event, i) => (
          <MessageFlowEvent
            key={i}
            event={event}
            expanded={expandedIdx === i}
            onToggle={() => setExpandedIdx(expandedIdx === i ? null : i)}
          />
        ))}
      </div>
    </div>
  )
}

function MessageFlowEvent({ event, expanded, onToggle }: {
  event: NatsEvent
  expanded: boolean
  onToggle: () => void
}) {
  const parsed = parseSubject(event.subject)
  const knight = findKnightForDomain(parsed.domain)
  const knightConfig = knight ? getKnightConfig(knight) : null
  const data = parseEventData(event.data)
  const isTask = event.type === 'task'

  // Extract key fields
  const taskText = (data.task as string) || ''
  const cost = data.cost as number | undefined
  const tokens = data.tokens as number | undefined
  const duration = data.duration as string | undefined
  const from = (data.from as string) || ''

  return (
    <div
      onClick={onToggle}
      className={`bg-roundtable-slate border rounded-lg p-4 cursor-pointer hover:border-roundtable-gold/20 transition-colors ${
        isTask ? 'border-blue-500/30' : 'border-green-500/30'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {/* Direction indicator */}
          <span className={`text-lg ${isTask ? 'text-blue-400' : 'text-green-400'}`}>
            {isTask ? '📤' : '📥'}
          </span>
          {/* Type badge */}
          <span
            className={`text-xs px-2 py-0.5 rounded font-medium ${
              isTask
                ? 'bg-blue-500/20 text-blue-400'
                : 'bg-green-500/20 text-green-400'
            }`}
          >
            {isTask ? 'TASK' : 'RESULT'}
          </span>
          {/* Knight badge */}
          {knightConfig && (
            <span className={`text-sm ${knightConfig.color} flex items-center gap-1`}>
              {knightConfig.emoji}
              <span className="capitalize font-medium">{knight}</span>
            </span>
          )}
          {/* Domain */}
          <span className="text-xs text-gray-500 bg-roundtable-navy px-2 py-0.5 rounded">
            {parsed.domain}
          </span>
          {/* Source */}
          {from && (
            <span className="text-xs text-gray-500">
              from: {from}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-500">
          {new Date(event.timestamp).toLocaleTimeString()}
        </span>
      </div>

      {/* Key fields summary */}
      <div className="flex items-center gap-3 flex-wrap">
        {taskText && (
          <p className="text-sm text-gray-300 truncate max-w-xl">{taskText}</p>
        )}
        {cost !== undefined && (
          <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded">
            ${cost.toFixed(4)}
          </span>
        )}
        {tokens !== undefined && (
          <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded">
            {tokens} tokens
          </span>
        )}
        {duration && (
          <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded">
            {duration}
          </span>
        )}
      </div>

      {/* Expanded JSON */}
      {expanded && (
        <pre className="text-xs text-gray-400 overflow-auto max-h-48 font-mono mt-3 pt-3 border-t border-roundtable-steel/50">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}

      {/* Subject line */}
      <p className="text-xs text-gray-600 font-mono mt-1">{event.subject}</p>
    </div>
  )
}
