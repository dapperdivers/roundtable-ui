import { useState, useEffect } from 'react'
import { Scroll, Clock, History, RefreshCw, CheckCircle, XCircle } from 'lucide-react'
import { getKnightConfig, KNIGHT_CONFIG, knightNameForDomain } from '../lib/knights'

interface QuestHistory {
  type: string
  subject: string
  data: Record<string, unknown>
  timestamp: string
}

export function TasksPage() {
  const [knight, setKnight] = useState('galahad')
  const [task, setTask] = useState('')
  const [dispatching, setDispatching] = useState(false)
  const [results, setResults] = useState<Array<{
    taskId: string
    knight: string
    task: string
    status: string
    timestamp: string
  }>>([])
  const [history, setHistory] = useState<QuestHistory[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const config = getKnightConfig(knight)
  const knightNames = Object.keys(KNIGHT_CONFIG)

  const loadHistory = () => {
    setHistoryLoading(true)
    fetch('/api/tasks')
      .then((r) => r.json())
      .then((data) => {
        setHistory(data.results || data.tasks || data || [])
      })
      .catch(() => {})
      .finally(() => setHistoryLoading(false))
  }

  useEffect(() => { loadHistory() }, [])

  const dispatch = async () => {
    if (!task.trim()) return
    setDispatching(true)

    try {
      const domain = KNIGHT_CONFIG[knight]?.domain || knight
      const res = await fetch('/api/tasks/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ knight, domain, task }),
      })
      const data = await res.json()
      setResults((prev) => [{
        taskId: data.task_id,
        knight,
        task,
        status: 'dispatched',
        timestamp: new Date().toISOString(),
      }, ...prev])
      setTask('')
    } catch (e) {
      console.error('Dispatch failed:', e)
    } finally {
      setDispatching(false)
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-white flex items-center gap-3 mb-8">
        <Scroll className="w-8 h-8 text-roundtable-gold" />
        Quest Dispatch
      </h1>

      {/* Dispatch form */}
      <div className="bg-roundtable-slate border border-roundtable-steel rounded-xl p-6 mb-8">
        <div className="flex gap-4 mb-4">
          <div className="w-48">
            <label className="text-sm text-gray-400 mb-2 block">Knight</label>
            <select
              value={knight}
              onChange={(e) => setKnight(e.target.value)}
              className="w-full bg-roundtable-navy border border-roundtable-steel rounded-lg px-3 py-2 text-white"
            >
              {knightNames.map((k) => {
                const kc = getKnightConfig(k)
                return (
                  <option key={k} value={k}>
                    {kc.emoji} {k} ({kc.domain})
                  </option>
                )
              })}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-sm text-gray-400 mb-2 block">Quest</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={task}
                onChange={(e) => setTask(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && dispatch()}
                placeholder={`Send a quest to ${config.emoji} ${knight} (${config.domain})...`}
                className="flex-1 bg-roundtable-navy border border-roundtable-steel rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:border-roundtable-gold/50 focus:outline-none"
              />
              <button
                onClick={dispatch}
                disabled={dispatching || !task.trim()}
                className="px-6 py-2 bg-roundtable-gold/20 hover:bg-roundtable-gold/30 border border-roundtable-gold/30 rounded-lg text-roundtable-gold font-medium transition-colors disabled:opacity-50"
              >
                {dispatching ? '...' : 'Dispatch'}
              </button>
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-500">
          Dispatching to domain: <span className="text-roundtable-gold font-mono">{config.domain}</span> via NATS subject: <span className="font-mono">fleet-a.tasks.{config.domain}.*</span>
        </p>
      </div>

      {/* Recent dispatches */}
      <h2 className="text-xl font-bold text-white mb-4">Recent Dispatches</h2>
      <div className="space-y-3 mb-10">
        {results.length === 0 && (
          <p className="text-gray-500 text-center py-8">No quests dispatched yet. Send one above!</p>
        )}
        {results.map((r) => {
          const kc = getKnightConfig(r.knight)
          return (
            <div
              key={r.taskId}
              className="bg-roundtable-slate border border-roundtable-steel rounded-lg p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span>{kc.emoji}</span>
                  <span className="font-medium text-white capitalize">{r.knight}</span>
                  <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">
                    {r.status}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-gray-500 text-xs">
                  <Clock className="w-3 h-3" />
                  {new Date(r.timestamp).toLocaleTimeString()}
                </div>
              </div>
              <p className="text-gray-300 text-sm">{r.task}</p>
              <p className="text-gray-500 text-xs mt-1 font-mono">{r.taskId}</p>
            </div>
          )
        })}
      </div>

      {/* Quest History from JetStream */}
      <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <History className="w-5 h-5 text-roundtable-gold" />
        Quest History
        <button onClick={loadHistory} className="ml-auto text-gray-400 hover:text-roundtable-gold transition-colors p-1" title="Refresh history">
          <RefreshCw className={`w-4 h-4 ${historyLoading ? 'animate-spin' : ''}`} />
        </button>
      </h2>
      <div className="space-y-3">
        {historyLoading && (
          <div className="text-center py-8">
            <div className="animate-spin w-6 h-6 border-2 border-roundtable-gold border-t-transparent rounded-full mx-auto mb-2" />
            <p className="text-gray-500 text-sm">Loading quest history from JetStream...</p>
          </div>
        )}
        {!historyLoading && history.length === 0 && (
          <p className="text-gray-500 text-center py-8">No quest history found in JetStream.</p>
        )}
        {history.map((h, i) => {
          const parts = (h.subject || '').split('.')
          const domain = parts[2] || 'unknown'
          const isResult = (h.type || h.subject || '').includes('result')
          const data = typeof h.data === 'string' ? (() => { try { return JSON.parse(h.data as unknown as string) } catch { return h.data } })() : (h.data || {})
          const knightName = knightNameForDomain(domain) || (data as Record<string, unknown>).knight as string || domain
          const cfg = getKnightConfig(knightName)
          const taskText = (data as Record<string, unknown>).task as string || (data as Record<string, unknown>).summary as string || (data as Record<string, unknown>).result as string || ''
          const cost = (data as Record<string, unknown>).cost as number | undefined
          const success = (data as Record<string, unknown>).success as boolean | undefined
          const duration = (data as Record<string, unknown>).duration as string | undefined

          return (
            <div
              key={i}
              className={`bg-roundtable-slate border ${isResult ? 'border-green-500/20' : 'border-blue-500/20'} rounded-lg p-4`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={cfg.color}>{cfg.emoji}</span>
                  <span className="font-medium text-white capitalize">{knightName}</span>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${isResult ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>
                    {isResult ? 'RESULT' : 'TASK'}
                  </span>
                  {success !== undefined && (
                    success ? <CheckCircle className="w-3.5 h-3.5 text-green-400" /> : <XCircle className="w-3.5 h-3.5 text-red-400" />
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  {duration && <span>{duration}</span>}
                  {cost != null && cost > 0 && <span className="text-roundtable-gold">${cost < 0.01 ? cost.toFixed(4) : cost.toFixed(2)}</span>}
                  <Clock className="w-3 h-3" />
                  {h.timestamp ? new Date(h.timestamp).toLocaleString() : '—'}
                </div>
              </div>
              {taskText && <p className="text-sm text-gray-300 line-clamp-2">{taskText}</p>}
              {!taskText && (
                <pre className="text-xs text-gray-400 overflow-auto max-h-24 font-mono">
                  {JSON.stringify(data, null, 2)}
                </pre>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
