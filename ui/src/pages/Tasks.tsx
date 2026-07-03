import { useState, useEffect } from 'react'
import { Scroll, Clock } from 'lucide-react'
import { apiGet, apiPost } from '../lib/api'
import { getKnightConfig } from '../lib/knights'
import { useFleet } from '../hooks/useFleet'
import { useToast } from '../components/Toast'

export function TasksPage() {
  const { knights } = useFleet()
  const { addToast } = useToast()
  const [knight, setKnight] = useState('')
  const [task, setTask] = useState('')
  const [dispatching, setDispatching] = useState(false)
  const [results, setResults] = useState<Array<{
    taskId: string
    knight: string
    task: string
    status: string
    timestamp: string
  }>>([])
  const [fleetPrefix, setFleetPrefix] = useState('fleet-a')

  // Default to the first knight once the fleet loads
  useEffect(() => {
    if (!knight && knights.length > 0) setKnight(knights[0].name)
  }, [knight, knights])

  const selected = knights.find((k) => k.name === knight)
  const config = getKnightConfig(knight)
  const domain = selected?.domain ?? ''

  // Fetch fleet configuration from backend (#60)
  useEffect(() => {
    apiGet<{ fleetPrefix?: string }>('/api/config')
      .then((data) => {
        if (data.fleetPrefix) setFleetPrefix(data.fleetPrefix)
      })
      .catch(() => {})
  }, [])

  const dispatch = async () => {
    if (!task.trim() || !selected) return
    setDispatching(true)

    try {
      const data = await apiPost<{ task_id: string }>('/api/tasks/dispatch', {
        knight,
        domain: selected.domain,
        task,
      })
      setResults((prev) => [{
        taskId: data.task_id,
        knight,
        task,
        status: 'dispatched',
        timestamp: new Date().toISOString(),
      }, ...prev])
      setTask('')
    } catch (e) {
      addToast(`Dispatch failed: ${e instanceof Error ? e.message : 'unknown error'}`, 'error')
    } finally {
      setDispatching(false)
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-white flex items-center gap-3 mb-8">
        <Scroll className="w-8 h-8 text-roundtable-gold" />
        Dispatch
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
              {knights.length === 0 && <option value="">Loading fleet…</option>}
              {knights.map((k) => (
                <option key={k.name} value={k.name}>
                  {getKnightConfig(k.name).emoji} {k.name} ({k.domain})
                </option>
              ))}
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
                placeholder={knight ? `Send a quest to ${config.emoji} ${knight} (${domain})...` : 'Waiting for fleet…'}
                className="flex-1 bg-roundtable-navy border border-roundtable-steel rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:border-roundtable-gold/50 focus:outline-none"
              />
              <button
                onClick={dispatch}
                disabled={dispatching || !task.trim() || !selected}
                className="px-6 py-2 bg-roundtable-gold/20 hover:bg-roundtable-gold/30 border border-roundtable-gold/30 rounded-lg text-roundtable-gold font-medium transition-colors disabled:opacity-50"
              >
                {dispatching ? '...' : 'Dispatch'}
              </button>
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-500">
          Dispatching to domain: <span className="text-roundtable-gold font-mono">{domain || '—'}</span> via NATS subject: <span className="font-mono">{fleetPrefix}.tasks.{domain || '*'}.*</span>
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

    </div>
  )
}
