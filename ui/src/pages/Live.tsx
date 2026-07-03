import { useState, useMemo, useCallback } from 'react'
import { GitGraph, Wifi, WifiOff, Filter } from 'lucide-react'
import { useWebSocket, type NatsEvent } from '../hooks/useWebSocket'
import { useFleet } from '../hooks/useFleet'
import type { Knight } from '../hooks/useFleet'
import { getKnightConfig, KNIGHT_CONFIG, knightNameForDomain } from '../lib/knights'
import { parseEvent, parseEventData } from '../lib/events'
import { FleetGraph } from '../components/FleetGraph'
import { KnightDetailDrawer } from '../components/KnightDetailDrawer'
import { PageHeader, StatCard, EmptyState } from '../components/ui'
import { formatCost, formatTimestamp } from '../lib/format'

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
      if (filterType && event.type !== filterType) return false
      const parsed = parseEvent(event)
      if (filterDomain) {
        // Results carry no domain — fall back to the knight's configured domain
        const domain = parsed.domain || (parsed.knight ? getKnightConfig(parsed.knight).domain : '')
        if (domain !== filterDomain) return false
      }
      if (filterKnight && parsed.knight !== filterKnight) return false
      return true
    })
  }, [events, filterKnight, filterType, filterDomain])

  const [expandedId, setExpandedId] = useState<number | null>(null)
  const recentEvents = filteredEvents.slice(0, 50)

  return (
    <div>
      {/* Header */}
      <PageHeader icon={GitGraph} title="Message Flow">
        {connected ? (
          <><Wifi className="w-4 h-4 text-green-400" /><span className="text-green-400 text-sm">Connected</span></>
        ) : (
          <><WifiOff className="w-4 h-4 text-red-400" /><span className="text-red-400 text-sm">Disconnected</span></>
        )}
        <span className="text-gray-500 text-sm">({filteredEvents.length} events)</span>
      </PageHeader>

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
      <FleetGraph knights={fleetKnights} events={filteredEvents} connected={connected} knightStatuses={knightStatuses} onKnightClick={handleKnightClick} />

      {/* Inter-knight comms summary (#51) */}
      {(() => {
        const comms: Record<string, number> = {}
        for (const event of filteredEvents.slice(0, 100)) {
          const parsed = parseEvent(event)
          const from = knightNameForDomain((parsed.data.from as string) || '')
          const to = parsed.knight
          if (from && to && from !== to) {
            const key = `${from} → ${to}`
            comms[key] = (comms[key] || 0) + 1
          }
        }
        const entries = Object.entries(comms).sort((a, b) => b[1] - a[1])
        if (entries.length === 0) return null

        return (
          <div className="mt-4 bg-roundtable-slate border border-roundtable-steel rounded-xl p-4">
            <h3 className="text-sm font-medium text-gray-400 mb-2">🔗 Knight-to-Knight Communications</h3>
            <div className="flex flex-wrap gap-2">
              {entries.map(([route, count]) => {
                const [from, to] = route.split(' → ')
                const fromCfg = getKnightConfig(from)
                const toCfg = getKnightConfig(to)
                return (
                  <span key={route} className="text-xs bg-roundtable-navy border border-roundtable-steel px-2.5 py-1 rounded-full">
                    {fromCfg.emoji} <span className="text-gray-400">→</span> {toCfg.emoji} <span className="text-gray-500">×{count}</span>
                  </span>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Event summary stats */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {(() => {
          const tasks = filteredEvents.filter(e => e.type === 'task').length
          const results = filteredEvents.filter(e => e.type === 'result').length
          const failures = filteredEvents.filter(e => {
            if (e.type !== 'result') return false
            const d = parseEventData(e.data)
            return d.success === false
          }).length
          const totalCost = filteredEvents.reduce((sum, e) => {
            if (e.type !== 'result') return sum
            const d = parseEventData(e.data)
            return sum + (typeof d.cost === 'number' ? d.cost : 0)
          }, 0)
          return (<>
            <StatCard label="Tasks" value={tasks} color="text-blue-400" />
            <StatCard label="Results" value={results} color="text-green-400" />
            <StatCard label="Failures" value={failures} color="text-red-400" />
            <StatCard label="Cost" value={formatCost(totalCost)} color="text-roundtable-gold" />
          </>)
        })()}
      </div>

      {/* Recent messages log */}
      <div className="bg-roundtable-slate border border-roundtable-steel rounded-xl p-4">
        <h3 className="text-sm font-medium text-gray-400 mb-3">Recent Messages</h3>
        {recentEvents.length === 0 ? (
          <EmptyState title="Waiting for messages…" />
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
  const { knight, data } = parseEvent(event)
  const cfg = knight ? getKnightConfig(knight) : null
  const isTask = event.type === 'task'
  const taskText = (data.task as string) || (data.result as string) || (data.summary as string) || ''
  const success = data.success as boolean | undefined
  const cost = typeof data.cost === 'number' ? data.cost : undefined
  // pi-knight publishes duration_ms and tool_calls
  const durationMs = typeof data.duration_ms === 'number' ? data.duration_ms : undefined
  const toolCalls = typeof data.tool_calls === 'number' ? data.tool_calls : undefined

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
          <span className="text-gray-500">{formatCost(cost)}</span>
        )}
        {!isTask && durationMs !== undefined && (
          <span className="text-gray-500">{(durationMs / 1000).toFixed(1)}s</span>
        )}
        {!isTask && toolCalls !== undefined && (
          <span className="text-gray-500">🔧{toolCalls}</span>
        )}
        <span className="text-gray-600 ml-auto flex-shrink-0">
          {formatTimestamp(event.timestamp)}
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
