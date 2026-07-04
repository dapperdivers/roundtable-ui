import { useState, useEffect, useCallback } from 'react'
import { apiGet } from '../lib/api'

/**
 * Poll a JSON endpoint on an interval, pausing while the tab is hidden (#22).
 * Errors surface as a message string; the last good data is kept.
 */
export function usePolledFetch<T>(url: string, intervalMs: number, initial: T) {
  const [data, setData] = useState<T>(initial)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setData(await apiGet<T>(url))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [url])

  useEffect(() => {
    refresh()
    let interval: ReturnType<typeof setInterval> | null = null

    const startPolling = () => {
      if (!interval) interval = setInterval(refresh, intervalMs)
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
  }, [refresh, intervalMs])

  return { data, loading, error, refresh }
}
