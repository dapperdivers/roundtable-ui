import { useState, useEffect, useCallback } from 'react'

export interface Knight {
  name: string
  domain: string
  status: 'online' | 'offline' | 'starting' | 'busy'
  ready: boolean
  restarts: number
  age: string
  image: string
  skills: number
  nixTools: number
  labels: Record<string, string>
}

export function useFleet(refreshInterval = 10000) {
  const [knights, setKnights] = useState<Knight[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/fleet')
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
