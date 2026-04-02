import { useState, useEffect, useCallback, useMemo } from 'react'
import { TreePine, ChevronRight, ChevronDown, Wrench, MessageSquare, Brain, RefreshCw, Search, BarChart3, Loader2 } from 'lucide-react'
import { getKnightConfig, buildKnightConfigFromFleet } from '../lib/knights'
import { useFleet } from '../hooks/useFleet'
import type { SessionEntry, SessionTreeNode, KnightSessionStats } from '../hooks/useKnightSession'

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

function formatCost(cost: number): string {
  return cost < 0.01 ? `$${cost.toFixed(4)}` : `$${cost.toFixed(2)}`
}

function TreeNodeView({ node, depth = 0 }: { node: SessionTreeNode & { children?: SessionTreeNode[] }; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2)
  const hasChildren = (node.children?.length ?? 0) > 0

  return (
    <div style={{ marginLeft: depth * 16 }}>
      <div
        className="flex items-center gap-2 py-1 px-2 rounded hover:bg-roundtable-steel/30 cursor-pointer text-sm"
        onClick={() => setExpanded(e => !e)}
      >
        {hasChildren ? (
          expanded ? <ChevronDown className="w-3 h-3 text-gray-500" /> : <ChevronRight className="w-3 h-3 text-gray-500" />
        ) : <span className="w-3" />}
        <span>{entryTypeIcons[node.type] || '●'}</span>
        <span className="text-gray-300 truncate flex-1">{node.summary || node.label || node.type}</span>
        {node.childrenCount > 0 && (
          <span className="text-xs text-gray-600">{node.childrenCount}</span>
        )}
        <span className="text-xs text-gray-600">{new Date(node.timestamp).toLocaleTimeString()}</span>
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

function ToolCallCard({ entry }: { entry: SessionEntry }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className={`border rounded-lg p-3 cursor-pointer transition-colors ${entryTypeColors[entry.type] || 'border-gray-500/30 bg-gray-500/5'}`}
      onClick={() => setExpanded(e => !e)}
    >
      <div className="flex items-center gap-2 text-sm">
        <span>{entryTypeIcons[entry.type] || '●'}</span>
        {entry.toolName && (
          <span className="font-mono text-purple-400 text-xs bg-purple-500/10 px-1.5 py-0.5 rounded">{entry.toolName}</span>
        )}
        <span className="text-gray-400 truncate flex-1">{entry.text || entry.toolName || entry.type}</span>
        {entry.cost != null && entry.cost > 0 && (
          <span className="text-roundtable-gold text-xs">{formatCost(entry.cost)}</span>
        )}
        {entry.tokens && (
          <span className="text-gray-600 text-xs">{entry.tokens.input + entry.tokens.output}t</span>
        )}
        <span className="text-gray-600 text-xs">{new Date(entry.timestamp).toLocaleTimeString()}</span>
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

  const fetchData = useCallback(async () => {
    if (!selectedKnight) return
    
    setLoading(true)
    setError(null)
    
    try {
      // Fetch with timeout - gracefully handle unsupported knights
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)

      // Always fetch stats
      fetch(`/api/fleet/${selectedKnight}/session?type=stats`, { signal: controller.signal })
        .then(r => r.ok ? r.json() : null)
        .then(d => { 
          clearTimeout(timeout)
          if (d) {
            setStats({ ...d, supported: true })
          } else {
            setStats({ knight: selectedKnight, supported: false, session: null, runtime: { uptime: 0, activeTasks: 0, model: '' } })
          }
        })
        .catch(() => {
          clearTimeout(timeout)
          setStats({ knight: selectedKnight, supported: false, session: null, runtime: { uptime: 0, activeTasks: 0, model: '' } })
        })

      if (view === 'tree') {
        const res = await fetch(`/api/fleet/${selectedKnight}/session?type=tree`, { signal: controller.signal })
        if (!res.ok) {
          setTreeNodes([])
          return
        }
        const data = await res.json()
        setTreeNodes(data.nodes || [])
      } else {
        const res = await fetch(`/api/fleet/${selectedKnight}/session?type=recent&limit=100`, { signal: controller.signal })
        if (!res.ok) {
          setEntries([])
          return
        }
        const data = await res.json()
        setEntries(data.entries || [])
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        // Timeout - knight doesn't support introspect
        setError(null)
        setEntries([])
        setTreeNodes([])
      } else {
        setError(e instanceof Error ? e.message : 'Failed to fetch session data')
      }
    } finally {
      setLoading(false)
    }
  }, [selectedKnight, view])

  useEffect(() => { fetchData() }, [fetchData])

  // Fetch fleet-wide stats for performance comparison (#50)
  const fetchFleetPerf = useCallback(async () => {
    setShowFleetPerf(true)
    const results: Record<string, KnightSessionStats> = {}
    await Promise.all(knights.map(async k => {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 5000)
        const res = await fetch(`/api/fleet/${k.name}/session?type=stats`, { signal: controller.signal })
        clearTimeout(timeout)
        if (res.ok) {
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
        <Loader2 className="w-8 h-8 text-roundtable-gold animate-spin mx-auto mb-4" />
        <p className="text-gray-400">Loading fleet data...</p>
      </div>
    )
  }

  if (knights.length === 0) {
    return (
      <div className="text-center py-12">
        <TreePine className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <p className="text-gray-400">No knights available in the fleet</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <TreePine className="w-8 h-8 text-roundtable-gold" />
          Session Explorer
          <span className="text-sm text-gray-500 font-normal">({knights.length} knights)</span>
        </h1>
        <button onClick={fetchData}
          disabled={!selectedKnight}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-roundtable-steel/50 hover:bg-roundtable-steel text-gray-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

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

      {/* Knight stats bar */}
      {stats?.supported === false && (
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
      {stats?.session && stats.supported !== false && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <div className="bg-roundtable-slate border border-roundtable-steel rounded-lg p-3">
            <p className="text-xs text-gray-500">Messages</p>
            <p className="text-lg font-bold text-white">{stats.session.totalMessages}</p>
          </div>
          <div className="bg-roundtable-slate border border-roundtable-steel rounded-lg p-3">
            <p className="text-xs text-gray-500">Tool Calls</p>
            <p className="text-lg font-bold text-purple-400">{stats.session.toolCalls}</p>
          </div>
          <div className="bg-roundtable-slate border border-roundtable-steel rounded-lg p-3">
            <p className="text-xs text-gray-500">Tokens</p>
            <p className="text-lg font-bold text-white">{stats.session.tokens.total.toLocaleString()}</p>
          </div>
          <div className="bg-roundtable-slate border border-roundtable-steel rounded-lg p-3">
            <p className="text-xs text-gray-500">Cost</p>
            <p className="text-lg font-bold text-roundtable-gold">{formatCost(stats.session.cost)}</p>
          </div>
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
                    <div className="flex-1 h-5 bg-roundtable-navy rounded-full overflow-hidden relative">
                      <div className="h-full bg-roundtable-gold/30 rounded-full transition-all"
                        style={{ width: `${barWidth}%` }} />
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
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-4">
          <p className="text-red-400 text-sm">⚠️ {error}</p>
        </div>
      )}

      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-roundtable-gold border-t-transparent rounded-full mx-auto mb-4" />
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
            <div className="text-center py-12">
              <TreePine className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              {stats?.supported === false ? (
                <p className="text-gray-500">Session introspection not available for this knight.</p>
              ) : (
                <p className="text-gray-500">No session tree data. Dispatch a task to see activity.</p>
              )}
            </div>
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
            <div className="text-center py-12">
              <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              {stats?.supported === false ? (
                <p className="text-gray-500">Session introspection not available for this knight.</p>
              ) : searchQuery || filterType ? (
                <p className="text-gray-500">No entries match your filters.</p>
              ) : (
                <p className="text-gray-500">No session entries found. Dispatch a task to see activity.</p>
              )}
            </div>
          )}
          {filteredEntries.map(entry => (
            <ToolCallCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  )
}
