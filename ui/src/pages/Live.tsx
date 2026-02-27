import { useState, useMemo } from 'react'
import { GitGraph, Wifi, WifiOff, Filter } from 'lucide-react'
import { useWebSocket, type NatsEvent } from '../hooks/useWebSocket'
import { useFleet } from '../hooks/useFleet'
import { getKnightConfig, KNIGHT_CONFIG, knightNameForDomain } from '../lib/knights'
import { RoundTableGraph } from '../components/RoundTableGraph'

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
      <RoundTableGraph events={filteredEvents} connected={connected} knightStatuses={knightStatuses} />

      {/* Recent messages log */}
      <div className="mt-4 bg-roundtable-slate border border-roundtable-steel rounded-xl p-4">
        <h3 className="text-sm font-medium text-gray-400 mb-3">Recent Messages</h3>
        {recentEvents.length === 0 ? (
          <p className="text-sm text-gray-600 text-center py-4">Waiting for messages…</p>
        ) : (
          <div className="space-y-1.5">
            {recentEvents.map((event, i) => <CompactEvent key={i} event={event} />)}
          </div>
        )}
      </div>
    </div>
  )
}

function CompactEvent({ event }: { event: NatsEvent }) {
  const parsed = parseSubject(event.subject)
  const knight = knightNameForDomain(parsed.domain)
  const cfg = knight ? getKnightConfig(knight) : null
  const data = parseEventData(event.data)
  const isTask = event.type === 'task'
  const taskText = (data.task as string) || (data.summary as string) || ''

  return (
    <div className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded ${isTask ? 'bg-blue-500/5' : 'bg-green-500/5'}`}>
      <span className={isTask ? 'text-blue-400' : 'text-green-400'}>{isTask ? '📤' : '📥'}</span>
      <span className={`font-medium ${isTask ? 'text-blue-400' : 'text-green-400'}`}>
        {isTask ? 'TASK' : 'RESULT'}
      </span>
      {cfg && <span className={cfg.color}>{cfg.emoji} {knight}</span>}
      <span className="text-gray-500 truncate max-w-xs">{taskText}</span>
      <span className="text-gray-600 ml-auto flex-shrink-0">{new Date(event.timestamp).toLocaleTimeString()}</span>
    </div>
  )
}
