import { useState, useEffect, useCallback, useMemo } from 'react'
import { TreePine, ChevronRight, ChevronDown, Wrench, MessageSquare, Search, BarChart3, History } from 'lucide-react'
import { getKnightConfig, buildKnightConfigFromFleet } from '../lib/knights'
import { useFleet } from '../hooks/useFleet'
import { fetchWithTimeout } from '../hooks/useKnightSession'
import type { SessionEntry, SessionTreeNode, SessionHistoryItem, KnightSessionStats } from '../hooks/useKnightSession'
import { Spinner, ErrorBanner, EmptyState, PageHeader, RefreshButton, StatCard, ProgressBar } from '../components/ui'
import { formatCost, formatTimestamp } from '../lib/format'

const entryTypeIcons: Record<string, string> = {
  user: '📨',
  assistant: '🤖',
  tool_use: '🔧',
  tool_result: '📋',
  thinking: '🧠',
  compaction: '📦',
}

const entryTypeColors: Record<string, string> = {
  user: 'border-blue-500/30 bg-blue-500/5',
  assistant: 'border-green-500/30 bg-green-500/5',
  tool_use: 'border-purple-500/30 bg-purple-500/5',
  tool_result: 'border-amber-500/30 bg-amber-500/5',
  thinking: 'border-gray-500/30 bg-gray-500/5',
  compaction: 'border-red-500/30 bg-red-500/5',
}

// Cap the visual indent so a long, near-linear parent→child chain doesn't
// march the content off the right edge (and squeeze the timestamp into a wrap).
const MAX_TREE_INDENT_DEPTH = 12
const TREE_INDENT_PX = 16

// Human label for a past session in the picker: when it ran, message count, and the opening prompt.
function sessionLabel(s: SessionHistoryItem): string {
  const when = s.startedAt ? new Date(s.startedAt).toLocaleString() : 'unknown time'
  const prompt = s.firstPrompt ? ` — ${s.firstPrompt.slice(0, 60)}` : ''
  return `${when} · ${s.messageCount} msgs${prompt}`
}

export function TreeNodeView({ node, depth = 0 }: { node: SessionTreeNode & { children?: SessionTreeNode[] }; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2)
  const hasChildren = (node.children?.length ?? 0) > 0
  const indent = Math.min(depth, MAX_TREE_INDENT_DEPTH) * TREE_INDENT_PX

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1 pr-2 rounded hover:bg-roundtable-steel/30 cursor-pointer text-sm"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Indented label region — only this shrinks/truncates, keeping the
            timestamp pinned to a fixed right column. */}
        <div className="flex items-center gap-2 min-w-0 flex-1" style={{ paddingLeft: indent }}>
          {hasChildren ? (
            expanded
              ? <ChevronDown className="w-3 h-3 text-gray-500 shrink-0" />
              : <ChevronRight className="w-3 h-3 text-gray-500 shrink-0" />
          ) : <span className="w-3 shrink-0" />}
          <span className="shrink-0">{entryTypeIcons[node.type] || '●'}</span>
          <span className="text-gray-300 truncate">{node.summary || node.label || node.type}</span>
        </div>
        {node.childrenCount > 0 && (
          <span className="text-xs text-gray-600 shrink-0">{node.childrenCount}</span>
        )}
        <span className="text-xs text-gray-600 shrink-0 whitespace-nowrap tabular-nums">{formatTimestamp(node.timestamp)}</span>
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children?.map(child => (
            <TreeNodeView key={child.id} node={child as SessionTreeNode & { children?: SessionTreeNode[] }} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

// Message entries carry a `role` but a shared `type` of "message"; resolve a
// legible icon/color/label from the role so they don't all render as "message".
function roleIcon(role?: string): string {
  return role === 'user' ? '📨' : role === 'assistant' ? '🤖' : '💬'
}

function entryIcon(entry: SessionEntry): string {
  if (entry.type === 'message') return roleIcon(entry.role)
  return entryTypeIcons[entry.type] || '●'
}

function entryColor(entry: SessionEntry): string {
  if (entry.type === 'message') {
    return entry.role === 'user' ? entryTypeColors.user
      : entry.role === 'assistant' ? entryTypeColors.assistant
      : 'border-gray-500/30 bg-gray-500/5'
  }
  return entryTypeColors[entry.type] || 'border-gray-500/30 bg-gray-500/5'
}

// Never collapse to the bare wire type ("message"); prefer real text, then a
// role/tool descriptor. Returns whether the label is a placeholder so the UI
// can render it muted.
function entryLabel(entry: SessionEntry): { text: string; placeholder: boolean } {
  const text = entry.text?.trim()
  if (text) return { text, placeholder: false }
  if (entry.type === 'message' && entry.role) {
    return { text: `${entry.role} message`, placeholder: true }
  }
  if (entry.toolName) return { text: entry.toolName, placeholder: false }
  return { text: entry.type, placeholder: true }
}

export function ToolCallCard({ entry }: { entry: SessionEntry }) {
  const [expanded, setExpanded] = useState(false)
  const label = entryLabel(entry)

  return (
    <div
      className={`border rounded-lg p-3 cursor-pointer transition-colors ${entryColor(entry)}`}
      onClick={() => setExpanded(e => !e)}
    >
      <div className="flex items-center gap-2 text-sm">
        <span className="shrink-0">{entryIcon(entry)}</span>
        {entry.toolName && (
          <span className="font-mono text-purple-400 text-xs bg-purple-500/10 px-1.5 py-0.5 rounded shrink-0">{entry.toolName}</span>
        )}
        <span className={`truncate flex-1 min-w-0 ${label.placeholder ? 'text-gray-500 italic' : 'text-gray-400'}`}>{label.text}</span>
        {entry.cost != null && entry.cost > 0 && (
          <span className="text-roundtable-gold text-xs shrink-0">{formatCost(entry.cost)}</span>
        )}
        {entry.tokens && (
          <span className="text-gray-600 text-xs shrink-0">{entry.tokens.input + entry.tokens.output}t</span>
        )}
        <span className="text-gray-600 text-xs shrink-0 whitespace-nowrap tabular-nums">{formatTimestamp(entry.timestamp)}</span>
      </div>
      {expanded && (
        <div className="mt-2 space-y-2 border-t border-roundtable-steel/30 pt-2">
          {entry.input && (
            <div>
              <span className="text-[10px] text-gray-500 uppercase">Input</span>
              <pre className="text-xs text-gray-400 font-mono whitespace-pre-wrap max-h-48 overflow-auto mt-0.5">{entry.input}</pre>
            </div>
          )}
          {entry.output && (
            <div>
              <span className="text-[10px] text-gray-500 uppercase">Output</span>
              <pre className="text-xs text-gray-400 font-mono whitespace-pre-wrap max-h-48 overflow-auto mt-0.5">{entry.output}</pre>
            </div>
          )}
          {entry.text && !entry.input && !entry.output && (
            <pre className="text-xs text-gray-400 whitespace-pre-wrap max-h-64 overflow-auto">{entry.text}</pre>
          )}
        </div>
      )}
    </div>
  )
}

export function SessionsPage() {
  const { knights, loading: fleetLoading } = useFleet()
  const [selectedKnight, setSelectedKnight] = useState('')
  const [view, setView] = useState<'timeline' | 'tree' | 'tools'>('timeline')
  const [entries, setEntries] = useState<SessionEntry[]>([])
  const [treeNodes, setTreeNodes] = useState<SessionTreeNode[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterType, setFilterType] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [knightSearchQuery, setKnightSearchQuery] = useState('')
  const [stats, setStats] = useState<KnightSessionStats | null>(null)
  const [allKnightStats, setAllKnightStats] = useState<Record<string, KnightSessionStats>>({})
  const [showFleetPerf, setShowFleetPerf] = useState(false)
  // Session history / replay: 'live' = the active in-memory session; otherwise a past session id.
  const [sessions, setSessions] = useState<SessionHistoryItem[]>([])
  const [selectedSession, setSelectedSession] = useState('live')
  const [archivedMeta, setArchivedMeta] = useState<{ total: number; hasMore: boolean; startedAt: string | null } | null>(null)
  const isArchived = selectedSession !== 'live'

  // Build dynamic knight config from fleet
  const knightConfig = useMemo(() => buildKnightConfigFromFleet(knights), [knights])
  
  // Set default knight once fleet loads
  useEffect(() => {
    if (knights.length > 0 && !selectedKnight) {
      setSelectedKnight(knights[0].name)
    }
  }, [knights, selectedKnight])

  const config = selectedKnight ? knightConfig[selectedKnight] : null
  
  // Filter knights by search query
  const filteredKnights = useMemo(() => {
    if (!knightSearchQuery) return knights
    const q = knightSearchQuery.toLowerCase()
    return knights.filter(k => 
      k.name.toLowerCase().includes(q) || 
      k.domain.toLowerCase().includes(q)
    )
  }, [knights, knightSearchQuery])

  // Load the knight's past-session list; reset to the live view on knight change.
  useEffect(() => {
    if (!selectedKnight) return
    setSelectedSession('live')
    setArchivedMeta(null)
    fetchWithTimeout(`/api/fleet/${selectedKnight}/session?type=history`)
      .then(r => (r && r.ok ? r.json() : null))
      .then(d => setSessions(d?.sessions || []))
      .catch(() => setSessions([]))
  }, [selectedKnight])

  const fetchData = useCallback(async () => {
    if (!selectedKnight) return

    setLoading(true)
    setError(null)

    try {
      // Stats reflect the live session only.
      if (!isArchived) {
        fetchWithTimeout(`/api/fleet/${selectedKnight}/session?type=stats`)
          .then(r => r && r.ok ? r.json() : null)
          .then(d => {
            if (d) {
              setStats({ ...d, supported: true })
            } else {
              setStats({ knight: selectedKnight, supported: false, session: null, runtime: { uptime: 0, activeTasks: 0, model: '' } })
            }
          })
          .catch(() => {
            setStats({ knight: selectedKnight, supported: false, session: null, runtime: { uptime: 0, activeTasks: 0, model: '' } })
          })
      }

      // Archived session: replay its persisted entries (timeline/tools views).
      if (isArchived) {
        const res = await fetchWithTimeout(`/api/fleet/${selectedKnight}/session?type=session&id=${encodeURIComponent(selectedSession)}&limit=300`)
        if (!res || !res.ok) {
          setEntries([])
          setArchivedMeta(null)
          return
        }
        const data = await res.json()
        setEntries(data.entries || [])
        setTreeNodes([])
        setArchivedMeta({ total: data.total ?? 0, hasMore: !!data.hasMore, startedAt: data.startedAt ?? null })
        return
      }

      if (view === 'tree') {
        const res = await fetchWithTimeout(`/api/fleet/${selectedKnight}/session?type=tree`)
        if (!res || !res.ok) {
          setTreeNodes([])
          return
        }
        const data = await res.json()
        setTreeNodes(data.nodes || [])
      } else {
        const res = await fetchWithTimeout(`/api/fleet/${selectedKnight}/session?type=recent&limit=100`)
        if (!res || !res.ok) {
          setEntries([])
          return
        }
        const data = await res.json()
        setEntries(data.entries || [])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch session data')
    } finally {
      setLoading(false)
    }
  }, [selectedKnight, view, selectedSession, isArchived])

  useEffect(() => { fetchData() }, [fetchData])

  // Fetch fleet-wide stats for performance comparison (#50)
  const fetchFleetPerf = useCallback(async () => {
    setShowFleetPerf(true)
    const results: Record<string, KnightSessionStats> = {}
    await Promise.all(knights.map(async k => {
      try {
        const res = await fetchWithTimeout(`/api/fleet/${k.name}/session?type=stats`)
        if (res && res.ok) {
          const data = await res.json()
          results[k.name] = { ...data, supported: true }
        }
      } catch {}
    }))
    setAllKnightStats(results)
  }, [knights])

  // Build tree from flat nodes
  const tree = useMemo(() => {
    if (treeNodes.length === 0) return []
    const map = new Map<string, SessionTreeNode & { children: SessionTreeNode[] }>()
    for (const n of treeNodes) map.set(n.id, { ...n, children: [] })
    const roots: (SessionTreeNode & { children: SessionTreeNode[] })[] = []
    for (const n of treeNodes) {
      const node = map.get(n.id)!
      if (n.parentId && map.has(n.parentId)) {
        map.get(n.parentId)!.children.push(node)
      } else {
        roots.push(node)
      }
    }
    return roots
  }, [treeNodes])

  // Filter entries
  const filteredEntries = useMemo(() => {
    let result = entries
    if (view === 'tools') {
      result = result.filter(e => e.type === 'tool_use' || e.type === 'tool_result')
    }
    if (filterType) {
      result = result.filter(e => e.type === filterType)
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(e =>
        (e.text?.toLowerCase().includes(q)) ||
        (e.toolName?.toLowerCase().includes(q)) ||
        (e.input?.toLowerCase().includes(q)) ||
        (e.output?.toLowerCase().includes(q))
      )
    }
    return result
  }, [entries, view, filterType, searchQuery])

  // Tool call stats
  const toolStats = useMemo(() => {
    const tools = entries.filter(e => e.type === 'tool_use')
    const byName: Record<string, number> = {}
    for (const t of tools) {
      const name = t.toolName || 'unknown'
      byName[name] = (byName[name] || 0) + 1
    }
    return { total: tools.length, byName: Object.entries(byName).sort((a, b) => b[1] - a[1]) }
  }, [entries])

  if (fleetLoading) {
    return (
      <div className="text-center py-12">
        <div className="flex justify-center mb-4"><Spinner /></div>
        <p className="text-gray-400">Loading fleet data...</p>
      </div>
    )
  }

  if (knights.length === 0) {
    return <EmptyState icon={TreePine} title="No knights available in the fleet" />
  }

  return (
    <div>
      <PageHeader icon={TreePine} title="Session Explorer">
        <span className="text-sm text-gray-500 font-normal">({knights.length} knights)</span>
        <RefreshButton onClick={fetchData} loading={loading} />
      </PageHeader>

      {/* Knight picker with search + view tabs */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative">
          <select value={selectedKnight} onChange={e => setSelectedKnight(e.target.value)}
            className="bg-roundtable-navy border border-roundtable-steel rounded-lg px-4 py-2 text-white pr-8 appearance-none min-w-[200px]">
            {filteredKnights.map(k => {
              const kc = knightConfig[k.name]
              const statusIcon = k.status === 'online' ? '🟢' : k.status === 'busy' ? '🟡' : '🔴'
              return <option key={k.name} value={k.name}>{kc?.emoji || '🤖'} {k.name} {statusIcon}</option>
            })}
          </select>
        </div>
        
        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
          <input 
            type="text" 
            value={knightSearchQuery} 
            onChange={e => setKnightSearchQuery(e.target.value)}
            placeholder="Filter knights by name or domain..."
            className="w-full bg-roundtable-navy border border-roundtable-steel rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500" 
          />
        </div>

        <div className="flex rounded-lg border border-roundtable-steel overflow-hidden">
          {(['timeline', 'tree', 'tools'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                view === v ? 'bg-roundtable-gold/20 text-roundtable-gold' : 'bg-roundtable-slate text-gray-400 hover:text-white'
              }`}>
              {v === 'timeline' && <><MessageSquare className="w-4 h-4 inline mr-1.5" />Timeline</>}
              {v === 'tree' && <><TreePine className="w-4 h-4 inline mr-1.5" />Tree</>}
              {v === 'tools' && <><Wrench className="w-4 h-4 inline mr-1.5" />Tools</>}
            </button>
          ))}
        </div>

        {view !== 'tree' && (
          <div className="flex items-center gap-2 flex-1">
            <div className="relative flex-1 max-w-xs">
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search entries..."
                className="w-full bg-roundtable-navy border border-roundtable-steel rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500" />
            </div>
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              className="bg-roundtable-navy border border-roundtable-steel rounded-lg px-3 py-2 text-sm text-white">
              <option value="">All Types</option>
              <option value="user">📨 User</option>
              <option value="assistant">🤖 Assistant</option>
              <option value="tool_use">🔧 Tool Use</option>
              <option value="tool_result">📋 Tool Result</option>
              <option value="thinking">🧠 Thinking</option>
            </select>
          </div>
        )}
      </div>

      {/* Session picker: live vs. a past (persisted) session */}
      {sessions.length > 0 && (
        <div className="flex items-center gap-3 mb-4 text-sm">
          <span className="text-gray-500 flex items-center gap-1.5"><History className="w-4 h-4" /> Session</span>
          <select
            value={selectedSession}
            onChange={e => setSelectedSession(e.target.value)}
            className="bg-roundtable-navy border border-roundtable-steel rounded-lg px-3 py-2 text-white max-w-xl flex-1">
            <option value="live">🟢 Live (active session)</option>
            {sessions.map(s => (
              <option key={s.id} value={s.id}>{sessionLabel(s)}</option>
            ))}
          </select>
          {isArchived && (
            <span className="text-xs px-2 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 whitespace-nowrap">
              📼 Archived
            </span>
          )}
        </div>
      )}

      {/* Archived session banner (replaces live stats when replaying history) */}
      {isArchived && (
        <div className="bg-roundtable-slate border border-roundtable-steel rounded-lg p-3 mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="text-gray-300 font-medium">📼 Replaying archived session</span>
          {archivedMeta?.startedAt && (
            <span className="text-gray-500">Started {new Date(archivedMeta.startedAt).toLocaleString()}</span>
          )}
          {archivedMeta && (
            <span className="text-gray-500">{archivedMeta.total.toLocaleString()} entries{archivedMeta.hasMore ? ' (showing first 300)' : ''}</span>
          )}
          <button onClick={() => setSelectedSession('live')} className="text-roundtable-gold hover:underline ml-auto">
            ← Back to live
          </button>
        </div>
      )}

      {/* Knight stats bar (live session only) */}
      {!isArchived && stats?.supported === false && (
        <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-4 mb-4">
          <p className="text-amber-400 text-sm flex items-center gap-2">
            ℹ️ This knight does not support session introspection. Basic fleet info shown instead.
          </p>
          {config && (
            <div className="mt-2 text-xs text-gray-400">
              <span className="font-medium">{config.emoji} {selectedKnight}</span> · 
              <span className="ml-2">Domain: {knights.find(k => k.name === selectedKnight)?.domain || 'unknown'}</span> · 
              <span className="ml-2">Status: {knights.find(k => k.name === selectedKnight)?.status || 'unknown'}</span>
            </div>
          )}
        </div>
      )}
      {!isArchived && stats?.session && stats.supported !== false && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <StatCard label="Messages" value={stats.session.totalMessages} />
          <StatCard label="Tool Calls" value={stats.session.toolCalls} color="text-purple-400" />
          <StatCard label="Tokens" value={stats.session.tokens.total.toLocaleString()} />
          <StatCard label="Cost" value={formatCost(stats.session.cost)} color="text-roundtable-gold" />
          <div className="bg-roundtable-slate border border-roundtable-steel rounded-lg p-3 flex items-center justify-center">
            <button onClick={fetchFleetPerf}
              className="text-xs text-gray-400 hover:text-roundtable-gold flex items-center gap-1">
              <BarChart3 className="w-4 h-4" /> Fleet Comparison
            </button>
          </div>
        </div>
      )}

      {/* Fleet performance comparison (#50) */}
      {showFleetPerf && Object.keys(allKnightStats).length > 0 && (
        <div className="bg-roundtable-slate border border-roundtable-steel rounded-xl p-4 mb-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3">📊 Fleet Performance Comparison</h3>
          <div className="space-y-2">
            {Object.entries(allKnightStats)
              .filter(([, s]) => s.session)
              .sort((a, b) => (b[1].session?.cost || 0) - (a[1].session?.cost || 0))
              .map(([name, s]) => {
                const cfg = getKnightConfig(name)
                const maxCost = Math.max(...Object.values(allKnightStats).map(s => s.session?.cost || 0))
                const barWidth = maxCost > 0 ? ((s.session?.cost || 0) / maxCost * 100) : 0
                return (
                  <div key={name} className="flex items-center gap-3">
                    <span className="w-24 text-xs text-gray-300 truncate">{cfg.emoji} {name}</span>
                    <div className="flex-1 relative">
                      <ProgressBar percent={barWidth} fillClass="bg-roundtable-gold/30" heightClass="h-5" />
                      <span className="absolute right-2 top-0.5 text-[10px] text-gray-400">
                        {formatCost(s.session?.cost || 0)} · {s.session?.toolCalls || 0} tools · {(s.session?.tokens.total || 0).toLocaleString()} tokens
                      </span>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4">
          <ErrorBanner>⚠️ {error}</ErrorBanner>
        </div>
      )}

      {loading && (
        <div className="text-center py-12">
          <div className="flex justify-center mb-4"><Spinner /></div>
          <p className="text-gray-400">Querying {config?.emoji} {selectedKnight}...</p>
        </div>
      )}

      {/* Tool Stats bar (tools view) */}
      {view === 'tools' && !loading && toolStats.total > 0 && (
        <div className="bg-roundtable-slate border border-roundtable-steel rounded-xl p-4 mb-4">
          <h3 className="text-sm font-medium text-gray-400 mb-2">Tool Usage ({toolStats.total} calls)</h3>
          <div className="flex flex-wrap gap-2">
            {toolStats.byName.slice(0, 10).map(([name, count]) => (
              <span key={name} className="text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-1 rounded-full font-mono">
                {name} <span className="text-gray-500">×{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tree view */}
      {view === 'tree' && !loading && (
        <div className="bg-roundtable-slate border border-roundtable-steel rounded-xl p-4">
          {tree.length === 0 ? (
            <EmptyState
              icon={TreePine}
              title={isArchived
                ? 'Tree view is available for the live session. Use Timeline or Tools to replay this archived session.'
                : stats?.supported === false
                  ? 'Session introspection not available for this knight.'
                  : 'No session tree data. Dispatch a task to see activity.'}
            />
          ) : (
            <div className="max-h-[70vh] overflow-auto">
              {tree.map(node => (
                <TreeNodeView key={node.id} node={node} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Timeline / Tools view */}
      {view !== 'tree' && !loading && (
        <div className="space-y-2">
          {filteredEntries.length === 0 && (
            <EmptyState
              icon={MessageSquare}
              title={!isArchived && stats?.supported === false
                ? 'Session introspection not available for this knight.'
                : searchQuery || filterType
                  ? 'No entries match your filters.'
                  : isArchived
                    ? 'This archived session has no entries.'
                    : 'No session entries found. Dispatch a task to see activity.'}
            />
          )}
          {filteredEntries.map(entry => (
            <ToolCallCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  )
}
