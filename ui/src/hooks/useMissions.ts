import { useState, useEffect, useCallback } from 'react'
import { authFetch } from '../lib/auth'

export interface PlanningResult {
  completedAt: string
  chainsGenerated: number
  knightsGenerated: number
  skillsGenerated: number
  error?: string
  rawOutput?: string
  reasoning?: string
}

export interface Mission {
  name: string
  namespace: string
  phase: string
  objective: string
  startedAt: string | null
  expiresAt: string | null
  knights: string[]
  chains: string[]
  costBudgetUSD: string
  totalCost: string
  ttl: number
  timeout: number
  roundTableRef: string
  metaMission?: boolean
  planningResult?: PlanningResult
}

export function useMissions(refreshInterval = 10000) {
  const [missions, setMissions] = useState<Mission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await authFetch('/api/missions')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setMissions(data)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  // Pause polling when tab is hidden (pattern from useFleet.ts)
  useEffect(() => {
    refresh()
    let interval: ReturnType<typeof setInterval> | null = null

    const startPolling = () => {
      if (!interval) interval = setInterval(refresh, refreshInterval)
    }
    const stopPolling = () => {
      if (interval) { clearInterval(interval); interval = null }
    }

    const onVisibility = () => {
      if (document.hidden) { stopPolling() } else { startPolling(); refresh() }
    }

    startPolling()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [refresh, refreshInterval])

  return { missions, loading, error, refresh }
}
