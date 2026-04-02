import { useState, useEffect, useCallback } from 'react'
import { authFetch } from '../lib/auth'

export interface KnightCondition {
  type: string
  status: string
  reason?: string
  message?: string
  lastTransitionTime?: string
}

export interface GeneratedSkill {
  name: string
  content: string
}

export interface Knight {
  name: string
  domain: string
  status: 'online' | 'offline' | 'starting' | 'busy'
  ready: boolean
  restarts: number
  age: string
  image: string
  skills: number           // keep for backward compat
  skillsList?: string[]    // actual skill names from CRD
  nixTools: number         // keep for backward compat
  nixPackages?: string[]
  generatedSkills?: GeneratedSkill[]
  labels: Record<string, string>
  // fields from Knight CRD:
  phase?: string           // Pending | Provisioning | Ready | Degraded | Suspended
  model?: string           // e.g. claude-sonnet-4-20250514
  runtime?: string         // deployment | sandbox
  suspended?: boolean
  tasksCompleted?: number
  tasksFailed?: number
  totalCost?: string
  concurrency?: number
  taskTimeout?: number
  conditions?: KnightCondition[]
}

export function useFleet(refreshInterval = 10000) {
  const [knights, setKnights] = useState<Knight[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await authFetch('/api/fleet')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setKnights(data)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  // Pause polling when tab is hidden (#22)
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

  return { knights, loading, error, refresh }
}
