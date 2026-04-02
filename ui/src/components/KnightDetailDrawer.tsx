import { useEffect, useState } from 'react'
import { X, Activity, Cpu, DollarSign, MessageSquare, Wrench, Clock, ChevronRight, RefreshCw, FileCode, Package, Terminal, ChevronDown, Settings, BarChart2, Tag } from 'lucide-react'
import { getKnightConfig } from '../lib/knights'
import { useKnightSession } from '../hooks/useKnightSession'
import { authFetch } from '../lib/auth'
import type { Knight, GeneratedSkill, KnightCondition } from '../hooks/useFleet'

interface Props {
  knight: Knight | null
  onClose: () => void
}

function formatCost(cost: number): string {
  return cost < 0.01 ? `$${cost.toFixed(4)}` : `$${cost.toFixed(2)}`
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString()
  } catch {
    return ts
  }
}

const entryTypeColors: Record<string, string> = {
  user: 'bg-blue-500/20 text-blue-400',
  assistant: 'bg-green-500/20 text-green-400',
  tool_use: 'bg-purple-500/20 text-purple-400',
  tool_result: 'bg-amber-500/20 text-amber-400',
  thinking: 'bg-gray-500/20 text-gray-400',
  compaction: 'bg-red-500/20 text-red-400',
}

// Knight skills by domain (from roundtable CRDs)
const knightSkills: Record<string, string[]> = {
  galahad: ['security-auditing', 'vulnerability-scanning', 'penetration-testing', 'compliance-checking'],
  percival: ['code-review', 'refactoring', 'testing', 'documentation'],
  gawain: ['cost-analysis', 'budget-tracking', 'resource-optimization', 'financial-reporting'],
  tristan: ['infrastructure-management', 'cluster-operations', 'deployment-automation', 'monitoring'],
  lancelot: ['architecture-design', 'system-integration', 'performance-optimization', 'scalability'],
  bedivere: ['data-analysis', 'reporting', 'visualization', 'insights'],
  gareth: ['workflow-automation', 'task-scheduling', 'orchestration', 'integration'],
  kay: ['user-support', 'troubleshooting', 'knowledge-base', 'training'],
  bors: ['quality-assurance', 'testing-automation', 'validation', 'verification'],
  ector: ['content-generation', 'documentation', 'translation', 'summarization'],
  lamorak: ['research', 'analysis', 'investigation', 'intelligence-gathering'],
  pellinore: ['exploration', 'discovery', 'prototyping', 'experimentation'],
  agravain: ['policy-enforcement', 'compliance', 'governance', 'audit'],
  tor: ['messaging', 'communication', 'coordination', 'notification'],
  patsy: ['assistance', 'coordination', 'task-delegation', 'collaboration'],
}

export function KnightDetailDrawer({ knight, onClose }: Props) {
  const { stats, recent, loading, error, fetchStats, fetchRecent } = useKnightSession()
  const [recentLoading, setRecentLoading] = useState(false)
  const [logs, setLogs] = useState<string>('')
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsExpanded, setLogsExpanded] = useState(false)
  const [skillsExpanded, setSkillsExpanded] = useState(false)
  const [knightDetail, setKnightDetail] = useState<Knight | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const fetchKnightDetail = async (knightName: string) => {
    setDetailLoading(true)
    try {
      const res = await authFetch(`/api/fleet/${knightName}`)
      if (res.ok) {
        const data = await res.json()
        setKnightDetail(data)
      }
    } catch (e) {
      console.error('Failed to fetch knight detail:', e)
    } finally {
      setDetailLoading(false)
    }
  }

  const refreshAll = async (knightName: string) => {
    fetchStats(knightName)
    fetchKnightDetail(knightName)
    setRecentLoading(true)
    await fetchRecent(knightName, 30)
    setRecentLoading(false)
  }

  const fetchLogs = async (knightName: string) => {
    setLogsLoading(true)
    try {
      const res = await fetch(`/api/fleet/${knightName}/logs?tail=100`)
      if (res.ok) {
        const text = await res.text()
        setLogs(text)
      } else {
        setLogs(`Error: ${res.status} ${res.statusText}`)
      }
    } catch (e) {
      setLogs(`Error: ${e instanceof Error ? e.message : 'Unknown error'}`)
    } finally {
      setLogsLoading(false)
    }
  }

  useEffect(() => {
    if (knight) {
      refreshAll(knight.name)
      setLogsExpanded(false)
      setSkillsExpanded(false)
      setLogs('')
    }
  }, [knight])

  if (!knight) return null

  const config = getKnightConfig(knight.name)
  const skills = knightSkills[knight.name] || []

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-[520px] bg-roundtable-navy border-l border-roundtable-steel z-50 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-roundtable-navy border-b border-roundtable-steel p-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{config.emoji}</span>
            <div>
              <h2 className="text-xl font-bold text-white capitalize">{knight.name}</h2>
              <p className={`text-sm ${config.color}`}>{config.title} Knight</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => knight && refreshAll(knight.name)} className="text-gray-400 hover:text-roundtable-gold p-1 transition-colors" title="Refresh">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-6">
          {/* Status bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`w-2.5 h-2.5 rounded-full ${knight.ready ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
            <span className="text-sm text-gray-300">{knight.ready ? 'Online' : 'Offline'}</span>
            <span className="text-xs text-gray-500">•</span>
            <span className="text-xs text-gray-500">{knight.age} uptime</span>
            <span className="text-xs text-gray-500">•</span>
            <span className="text-xs text-gray-500">{knight.restarts} restarts</span>
            <span className="text-xs text-gray-500">•</span>
            <span className="text-xs text-gray-400 font-mono">{knight.name}</span>
          </div>

          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin w-6 h-6 border-2 border-roundtable-gold border-t-transparent rounded-full mx-auto mb-2" />
              <p className="text-gray-500 text-sm">Querying knight...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3">
              <p className="text-red-400 text-sm">⚠️ {error}</p>
              <p className="text-red-400/60 text-xs mt-1">Knight may not have introspection enabled yet</p>
            </div>
          )}

          {/* Configuration */}
          {(knightDetail?.model || knightDetail?.runtime || knightDetail?.concurrencyLimit != null || knightDetail?.taskTimeout || knightDetail?.suspended) && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Configuration
              </h3>
              <div className="bg-roundtable-slate rounded-lg p-3 space-y-2">
                {knightDetail.suspended && (
                  <div className="flex justify-between text-sm items-center">
                    <span className="text-gray-400">Status</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">Suspended</span>
                  </div>
                )}
                {knightDetail.model && (
                  <div className="flex justify-between text-sm items-center">
                    <span className="text-gray-400">Model</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 font-mono">{knightDetail.model}</span>
                  </div>
                )}
                {knightDetail.runtime && (
                  <div className="flex justify-between text-sm items-center">
                    <span className="text-gray-400">Runtime</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${
                      knightDetail.runtime === 'sandbox'
                        ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                        : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                    }`}>{knightDetail.runtime}</span>
                  </div>
                )}
                {knightDetail.concurrencyLimit != null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Concurrency Limit</span>
                    <span className="text-gray-200">{knightDetail.concurrencyLimit}</span>
                  </div>
                )}
                {knightDetail.taskTimeout && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Task Timeout</span>
                    <span className="text-gray-200">{knightDetail.taskTimeout}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Performance */}
          {(knightDetail?.tasksCompleted != null || knightDetail?.tasksFailed != null || knightDetail?.totalCost) && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                <BarChart2 className="w-4 h-4" />
                Performance
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {knightDetail.tasksCompleted != null && (
                  <StatCard
                    icon={<Activity className="w-4 h-4" />}
                    label="Completed"
                    value={knightDetail.tasksCompleted}
                    color="text-green-400"
                  />
                )}
                {knightDetail.tasksFailed != null && (
                  <StatCard
                    icon={<Activity className="w-4 h-4" />}
                    label="Failed"
                    value={knightDetail.tasksFailed}
                    color="text-red-400"
                  />
                )}
                {knightDetail.totalCost && (
                  <StatCard
                    icon={<DollarSign className="w-4 h-4" />}
                    label="Total Cost"
                    value={`$${knightDetail.totalCost}`}
                    color="text-roundtable-gold"
                  />
                )}
                {knightDetail.tasksCompleted != null && knightDetail.tasksFailed != null && (knightDetail.tasksCompleted + knightDetail.tasksFailed) > 0 && (
                  <StatCard
                    icon={<BarChart2 className="w-4 h-4" />}
                    label="Success Rate"
                    value={`${Math.round((knightDetail.tasksCompleted / (knightDetail.tasksCompleted + knightDetail.tasksFailed)) * 100)}%`}
                    color="text-blue-400"
                  />
                )}
              </div>
            </div>
          )}

          {/* Skills List (from CRD skillsList field) */}
          {knightDetail?.skillsList && knightDetail.skillsList.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                <Tag className="w-4 h-4" />
                Skills ({knightDetail.skillsList.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {knightDetail.skillsList.map((skill, i) => (
                  <span
                    key={skill}
                    className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs border ${
                      i % 2 === 0
                        ? 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                        : 'bg-purple-500/10 text-purple-300 border-purple-500/20'
                    }`}
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Conditions */}
          {knightDetail?.conditions && knightDetail.conditions.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Conditions
              </h3>
              <div className="bg-roundtable-slate border border-roundtable-steel/50 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-roundtable-steel/50">
                      <th className="text-left text-gray-500 font-medium px-3 py-2">Type</th>
                      <th className="text-left text-gray-500 font-medium px-3 py-2">Status</th>
                      <th className="text-left text-gray-500 font-medium px-3 py-2 hidden sm:table-cell">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {knightDetail.conditions.map((cond: KnightCondition, i: number) => {
                      const statusColor =
                        cond.status === 'True' ? 'text-green-400 bg-green-500/10 border-green-500/20' :
                        cond.status === 'False' ? 'text-red-400 bg-red-500/10 border-red-500/20' :
                        'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
                      return (
                        <tr key={cond.type} className={i < knightDetail.conditions!.length - 1 ? 'border-b border-roundtable-steel/30' : ''}>
                          <td className="px-3 py-2 text-gray-200 font-medium">{cond.type}</td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded-full border ${statusColor}`}>{cond.status}</span>
                          </td>
                          <td className="px-3 py-2 text-gray-400 font-mono hidden sm:table-cell">{cond.reason || cond.message || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Skills Section */}
          {skills.length > 0 && (
            <div>
              <button
                onClick={() => setSkillsExpanded(!skillsExpanded)}
                className="w-full flex items-center justify-between text-sm font-medium text-gray-400 mb-3 hover:text-roundtable-gold transition-colors"
              >
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4" />
                  Knight Skills ({skills.length})
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform ${skillsExpanded ? 'rotate-180' : ''}`} />
              </button>
              {skillsExpanded && (
                <div className="grid grid-cols-2 gap-2">
                  {skills.map((skill) => (
                    <div key={skill} className="bg-roundtable-slate border border-roundtable-steel/50 rounded-lg px-3 py-2 text-xs text-gray-300 flex items-center gap-2">
                      <span className="text-roundtable-gold">✓</span>
                      <span className="capitalize">{skill.replace(/-/g, ' ')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Nix Packages */}
          {knightDetail?.nixPackages && knightDetail.nixPackages.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                <Package className="w-4 h-4" />
                Nix Packages ({knightDetail.nixPackages.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {knightDetail.nixPackages.map((pkg) => (
                  <span
                    key={pkg}
                    className="inline-flex items-center px-2.5 py-1 bg-roundtable-slate border border-roundtable-steel/50 rounded-lg text-xs text-gray-300 font-mono"
                  >
                    {pkg}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Generated Skills */}
          {knightDetail?.generatedSkills && knightDetail.generatedSkills.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                <FileCode className="w-4 h-4" />
                Generated Skills ({knightDetail.generatedSkills.length})
              </h3>
              <div className="space-y-2">
                {knightDetail.generatedSkills.map((skill) => (
                  <details key={skill.name} className="bg-roundtable-slate border border-roundtable-steel/50 rounded-lg">
                    <summary className="px-3 py-2 cursor-pointer text-xs text-gray-300 hover:text-roundtable-gold transition-colors">
                      {skill.name}
                    </summary>
                    <div className="px-3 pb-3">
                      <pre className="text-xs text-gray-400 whitespace-pre-wrap overflow-x-auto max-h-64">
                        {skill.content}
                      </pre>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          )}

          {/* Session Stats */}
          {stats?.session && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Session Stats
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  icon={<MessageSquare className="w-4 h-4" />}
                  label="Messages"
                  value={stats.session.totalMessages}
                  detail={`${stats.session.userMessages} user / ${stats.session.assistantMessages} assistant`}
                />
                <StatCard
                  icon={<Wrench className="w-4 h-4" />}
                  label="Tool Calls"
                  value={stats.session.toolCalls}
                />
                <StatCard
                  icon={<Cpu className="w-4 h-4" />}
                  label="Tokens"
                  value={stats.session.tokens.total.toLocaleString()}
                  detail={`${stats.session.tokens.input.toLocaleString()} in / ${stats.session.tokens.output.toLocaleString()} out`}
                />
                <StatCard
                  icon={<DollarSign className="w-4 h-4" />}
                  label="Total Cost"
                  value={formatCost(stats.session.cost)}
                  color="text-roundtable-gold"
                />
              </div>
            </div>
          )}

          {/* Runtime Info */}
          {stats?.runtime && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                <Cpu className="w-4 h-4" />
                Runtime
              </h3>
              <div className="bg-roundtable-slate rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Model</span>
                  <span className="text-gray-200 font-mono text-xs">{stats.runtime.model}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Uptime</span>
                  <span className="text-gray-200">{formatUptime(stats.runtime.uptime)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Active Tasks</span>
                  <span className={stats.runtime.activeTasks > 0 ? 'text-yellow-400' : 'text-gray-200'}>
                    {stats.runtime.activeTasks}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Pod Logs Viewer */}
          <div>
            <button
              onClick={() => {
                if (!logsExpanded && logs === '') {
                  fetchLogs(knight.name)
                }
                setLogsExpanded(!logsExpanded)
              }}
              className="w-full flex items-center justify-between text-sm font-medium text-gray-400 mb-3 hover:text-roundtable-gold transition-colors"
            >
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4" />
                Pod Logs
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform ${logsExpanded ? 'rotate-180' : ''}`} />
            </button>
            {logsExpanded && (
              <div className="bg-black/50 border border-roundtable-steel rounded-lg p-3">
                {logsLoading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin w-5 h-5 border-2 border-roundtable-gold border-t-transparent rounded-full mx-auto mb-2" />
                    <p className="text-gray-500 text-xs">Loading logs...</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-500">Last 100 lines</span>
                      <button
                        onClick={() => fetchLogs(knight.name)}
                        className="text-xs text-roundtable-gold hover:text-roundtable-gold/80"
                      >
                        Refresh
                      </button>
                    </div>
                    <pre className="text-xs text-gray-300 font-mono overflow-x-auto max-h-[300px] overflow-y-auto whitespace-pre-wrap break-words">
                      {logs || 'No logs available'}
                    </pre>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Recent Activity */}
          {(recent.length > 0 || recentLoading || stats?.session) && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Recent Activity {recent.length > 0 && `(${recent.length} entries)`}
              </h3>
              {recentLoading && (
                <div className="text-center py-4">
                  <div className="animate-spin w-5 h-5 border-2 border-roundtable-gold border-t-transparent rounded-full mx-auto mb-2" />
                  <p className="text-gray-500 text-xs">Loading activity...</p>
                </div>
              )}
              {!recentLoading && recent.length === 0 && (
                <p className="text-gray-500 text-sm text-center py-4">Send a task to see activity here</p>
              )}
              <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                {recent.map((entry) => (
                  <ActivityEntry key={entry.id} entry={entry} />
                ))}
              </div>
            </div>
          )}

          {/* No session */}
          {!loading && !error && !stats?.session && (
            <div className="text-center py-8 text-gray-500">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No session data available</p>
              <p className="text-xs mt-1">Knight may not have processed any tasks yet</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function ActivityEntry({ entry }: { entry: any }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className="bg-roundtable-slate rounded-lg p-2.5 border border-roundtable-steel/50 cursor-pointer hover:border-roundtable-gold/30 transition-colors"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className={`text-xs px-1.5 py-0.5 rounded ${entryTypeColors[entry.type] || 'bg-gray-500/20 text-gray-400'}`}>
            {entry.type === 'tool_use' ? '🔧' : entry.type === 'tool_result' ? '📋' : entry.role === 'user' ? '📨' : '🤖'}
            {' '}{entry.type}
          </span>
          {entry.toolName && (
            <span className="text-xs text-purple-400 font-mono">{entry.toolName}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-600">{formatTimestamp(entry.timestamp)}</span>
          <ChevronRight className={`w-3 h-3 text-gray-600 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </div>
      </div>
      {entry.text && (
        <p className={`text-xs text-gray-400 mt-1 ${expanded ? 'whitespace-pre-wrap' : 'line-clamp-4'}`}>{entry.text}</p>
      )}
      {entry.input && (
        <p className={`text-xs text-gray-500 mt-1 font-mono ${expanded ? 'whitespace-pre-wrap break-all' : 'line-clamp-3'}`}>→ {entry.input}</p>
      )}
      {entry.output && (
        <p className={`text-xs text-gray-500 mt-1 font-mono ${expanded ? 'whitespace-pre-wrap break-all' : 'line-clamp-3'}`}>← {entry.output}</p>
      )}
      {entry.cost != null && entry.cost > 0 && (
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-roundtable-gold">{formatCost(entry.cost)}</span>
          {entry.tokens && (
            <span className="text-xs text-gray-600">{entry.tokens.input + entry.tokens.output} tokens</span>
          )}
        </div>
      )}
    </div>
  )
}

function StatCard({ icon, label, value, detail, color }: {
  icon: React.ReactNode
  label: string
  value: string | number
  detail?: string
  color?: string
}) {
  return (
    <div className="bg-roundtable-slate rounded-lg p-3">
      <div className="flex items-center gap-2 text-gray-400 mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className={`text-lg font-bold ${color || 'text-white'}`}>{value}</p>
      {detail && <p className="text-xs text-gray-500 mt-0.5">{detail}</p>}
    </div>
  )
}
