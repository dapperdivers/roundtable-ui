import { useState, useCallback } from 'react'
import { authFetch } from '../lib/auth'

export interface KnightSessionStats {
  knight: string
  supported?: boolean  // whether knight responded to introspect
  session: {
    sessionId: string
    userMessages: number
    assistantMessages: number
    toolCalls: number
    toolResults: number
    totalMessages: number
    tokens: { input: number; output: number; cacheRead: number; cacheWrite: number; total: number }
    cost: number
  } | null
  runtime: {
    uptime: number
    activeTasks: number
    model: string
  }
}

export interface SessionEntry {
  id: string
  parentId: string | null
  type: string
  timestamp: string
  role?: string
  text?: string
  toolName?: string
  input?: string
  output?: string
  cost?: number
  tokens?: { input: number; output: number }
}

export interface SessionTreeNode {
  id: string
  parentId: string | null
  type: string
  timestamp: string
  label?: string
  childrenCount: number
  summary: string
}

// Helper to add timeout to fetch requests
async function fetchWithTimeout(url: string, timeoutMs = 5000): Promise<Response | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  
  try {
    const res = await authFetch(url, { signal: controller.signal })
    clearTimeout(timeout)
    return res
  } catch (e) {
    clearTimeout(timeout)
    if ((e as Error).name === 'AbortError') {
      return null  // timeout - knight doesn't support introspect
    }
    throw e
  }
}

export function useKnightSession() {
  const [stats, setStats] = useState<KnightSessionStats | null>(null)
  const [recent, setRecent] = useState<SessionEntry[]>([])
  const [tree, setTree] = useState<SessionTreeNode[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async (knight: string, timeoutMs = 5000) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchWithTimeout(`/api/fleet/${knight}/session?type=stats`, timeoutMs)
      if (!res) {
        // Knight doesn't support introspect - not an error
        setStats({ knight, supported: false, session: null, runtime: { uptime: 0, activeTasks: 0, model: '' } })
        return
      }
      if (!res.ok) {
        setStats({ knight, supported: false, session: null, runtime: { uptime: 0, activeTasks: 0, model: '' } })
        return
      }
      const data = await res.json()
      setStats({ ...data, supported: true })
    } catch (e) {
      // Graceful failure - return null instead of throwing
      setStats({ knight, supported: false, session: null, runtime: { uptime: 0, activeTasks: 0, model: '' } })
      setError(null)  // Don't show error for unsupported knights
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchRecent = useCallback(async (knight: string, limit = 20, timeoutMs = 5000) => {
    try {
      const res = await fetchWithTimeout(`/api/fleet/${knight}/session?type=recent&limit=${limit}`, timeoutMs)
      if (!res || !res.ok) {
        setRecent([])
        return
      }
      const data = await res.json()
      setRecent(data.entries || [])
    } catch (e) {
      setRecent([])
      setError(null)
    }
  }, [])

  const fetchTree = useCallback(async (knight: string, timeoutMs = 5000) => {
    try {
      const res = await fetchWithTimeout(`/api/fleet/${knight}/session?type=tree`, timeoutMs)
      if (!res || !res.ok) {
        setTree([])
        return
      }
      const data = await res.json()
      setTree(data.nodes || [])
    } catch (e) {
      setTree([])
      setError(null)
    }
  }, [])

  return { stats, recent, tree, loading, error, fetchStats, fetchRecent, fetchTree }
}
