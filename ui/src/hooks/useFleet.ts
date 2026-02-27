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

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, refreshInterval)
    return () => clearInterval(interval)
  }, [refresh, refreshInterval])

  return { knights, loading, error, refresh }
}
