import { useState, useMemo, useCallback } from 'react'
import { GitGraph, Wifi, WifiOff, Filter } from 'lucide-react'
import { useWebSocket, type NatsEvent } from '../hooks/useWebSocket'
import { useFleet } from '../hooks/useFleet'
import type { Knight } from '../hooks/useFleet'
import { getKnightConfig, KNIGHT_CONFIG, knightNameForDomain } from '../lib/knights'
import { FleetGraph } from '../components/FleetGraph'
import { KnightDetailDrawer } from '../components/KnightDetailDrawer'

function parseSubject(subject: string) {
  const parts = subject.split('.')
  return { fleet: parts[0] || '', type: parts[1] || '', domain: parts[2] || '', taskId: parts[3] || '' }
}

function parseEventData(data: unknown): Record<string, unknown> {
  if (typeof data === 'string') { try { return JSON.parse(data) } catch { return { raw: data } } }
  return (data as Record<string, unknown>) || {}
}

export function LivePage() {
  const { events, connected } = useWebSocket()
  const { knights: fleetKnights } = useFleet()
  const [filterKnight, setFilterKnight] = useState<string>('')
  const [filterType, setFilterType] = useState<string>('')
  const [filterDomain, setFilterDomain] = useState<string>('')
  const [selectedKnight, setSelectedKnight] = useState<Knight | null>(null)

  const handleKnightClick = useCallback((knightName: string) => {
    const fleet = fleetKnights.find(k => k.name === knightName)
    if (fleet) {
      setSelectedKnight(fleet)
    } else {
      // Build a minimal Knight object for knights not in fleet response
      const cfg = getKnightConfig(knightName)
      setSelectedKnight({
        name: knightName,
        domain: cfg.domain,
        status: 'offline',
        ready: false,
        restarts: 0,
        age: '—',
        image: '',
        skills: 0,
        nixTools: 0,
        labels: {},
      })
    }
  }, [fleetKnights])

  const knightNames = Object.keys(KNIGHT_CONFIG)
  const domains = [...new Set(Object.values(KNIGHT_CONFIG).map(c => c.domain))]

  // Knight online statuses from fleet API
  const knightStatuses = useMemo(() => {
    const m: Record<string, string> = {}
    for (const k of fleetKnights) m[k.name] = k.status
    return m
  }, [fleetKnights])

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const parsed = parseSubject(event.subject)
      if (filterType && event.type !== filterType) return false
      if (filterDomain && parsed.domain !== filterDomain) return false
      if (filterKnight) {
        const knight = knightNameForDomain(parsed.domain)
        if (knight !== filterKnight) return false
      }
      return true
    })
  }, [events, filterKnight, filterType, filterDomain])

  const [expandedId, setExpandedId] = useState<number | null>(null)
  const recentEvents = filteredEvents.slice(0, 10)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <GitGraph className="w-8 h-8 text-roundtable-gold" />
          Message Flow
        </h1>
        <div className="flex items-center gap-2">
          {connected ? (
            <><Wifi className="w-4 h-4 text-green-400" /><span className="text-green-400 text-sm">Connected</span></>
          ) : (
            <><WifiOff className="w-4 h-4 text-red-400" /><span className="text-red-400 text-sm">Disconnected</span></>
          )}
          <span className="text-gray-500 text-sm ml-2">({filteredEvents.length} events)</span>
        </div>
      </div>

      {/* Compact filter toolbar */}
      <div className="bg-roundtable-slate border border-roundtable-steel rounded-xl p-3 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Filter className="w-4 h-4 text-gray-400" />
          <select value={filterKnight} onChange={e => setFilterKnight(e.target.value)}
            className="bg-roundtable-navy border border-roundtable-steel rounded-lg px-3 py-1 text-sm text-white">
            <option value="">All Knights</option>
            {knightNames.map(k => <option key={k} value={k}>{getKnightConfig(k).emoji} {k}</option>)}
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="bg-roundtable-navy border border-roundtable-steel rounded-lg px-3 py-1 text-sm text-white">
            <option value="">All Types</option>
            <option value="task">📤 Tasks</option>
            <option value="result">📥 Results</option>
          </select>
          <select value={filterDomain} onChange={e => setFilterDomain(e.target.value)}
            className="bg-roundtable-navy border border-roundtable-steel rounded-lg px-3 py-1 text-sm text-white">
            <option value="">All Domains</option>
            {domains.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          {(filterKnight || filterType || filterDomain) && (
            <button onClick={() => { setFilterKnight(''); setFilterType(''); setFilterDomain('') }}
              className="text-xs text-gray-400 hover:text-white">Clear</button>
          )}
        </div>
      </div>

      {/* Round Table Graph */}
      {/* Fleet network graph — React Flow powered */}
      <FleetGraph events={filteredEvents} connected={connected} knightStatuses={knightStatuses} onKnightClick={handleKnightClick} />

      {/* Recent messages log */}
      <div className="mt-4 bg-roundtable-slate border border-roundtable-steel rounded-xl p-4">
        <h3 className="text-sm font-medium text-gray-400 mb-3">Recent Messages</h3>
        {recentEvents.length === 0 ? (
          <p className="text-sm text-gray-600 text-center py-4">Waiting for messages…</p>
        ) : (
          <div className="space-y-2">
            {recentEvents.map((event, i) => (
              <EventCard key={i} event={event} index={i}
                expanded={expandedId === i} onToggle={() => setExpandedId(expandedId === i ? null : i)} />
            ))}
          </div>
        )}
      </div>

      {/* Knight detail drawer */}
      <KnightDetailDrawer knight={selectedKnight} onClose={() => setSelectedKnight(null)} />
    </div>
  )
}

function EventCard({ event, index, expanded, onToggle }: {
  event: NatsEvent; index: number; expanded: boolean; onToggle: () => void
}) {
  const parsed = parseSubject(event.subject)
  const knight = knightNameForDomain(parsed.domain)
  const cfg = knight ? getKnightConfig(knight) : null
  const data = parseEventData(event.data)
  const isTask = event.type === 'task'
  const taskText = (data.task as string) || (data.summary as string) || ''
  const success = data.success as boolean | undefined
  const cost = typeof data.cost === 'number' ? data.cost : undefined
  const duration = typeof data.duration === 'number' ? data.duration : undefined
  const toolCalls = typeof data.toolCalls === 'number' ? data.toolCalls : undefined

  return (
    <div
      className={`rounded-lg border transition-colors cursor-pointer ${
        isTask ? 'bg-blue-500/5 border-blue-500/10' : 'bg-green-500/5 border-green-500/10'
      } ${expanded ? 'ring-1 ring-roundtable-gold/30' : ''}`}
      onClick={onToggle}
    >
      <div className="flex items-center gap-2 text-xs px-3 py-2">
        <span className={isTask ? 'text-blue-400' : 'text-green-400'}>{isTask ? '📤' : '📥'}</span>
        <span className={`font-medium ${isTask ? 'text-blue-400' : 'text-green-400'}`}>
          {isTask ? 'TASK' : 'RESULT'}
        </span>
        {cfg && <span className={cfg.color}>{cfg.emoji} {knight}</span>}
        {!isTask && success !== undefined && (
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
            success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}>
            {success ? 'OK' : 'FAIL'}
          </span>
        )}
        {!isTask && cost !== undefined && (
          <span className="text-gray-500">${cost.toFixed(4)}</span>
        )}
        {!isTask && duration !== undefined && (
          <span className="text-gray-500">{duration}s</span>
        )}
        {!isTask && toolCalls !== undefined && (
          <span className="text-gray-500">🔧{toolCalls}</span>
        )}
        <span className="text-gray-600 ml-auto flex-shrink-0">
          {new Date(event.timestamp).toLocaleTimeString()}
        </span>
      </div>
      <div className="px-3 pb-2">
        <p className={`text-xs text-gray-400 ${expanded ? '' : 'line-clamp-2'}`}>{taskText}</p>
      </div>
      {expanded && (
        <div className="px-3 pb-3 border-t border-roundtable-steel/30 mt-1 pt-2">
          <pre className="text-[10px] text-gray-500 overflow-x-auto max-h-48 whitespace-pre-wrap">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
