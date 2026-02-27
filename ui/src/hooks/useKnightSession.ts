import { useState, useCallback } from 'react'

export interface KnightSessionStats {
  knight: string
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

export function useKnightSession() {
  const [stats, setStats] = useState<KnightSessionStats | null>(null)
  const [recent, setRecent] = useState<SessionEntry[]>([])
  const [tree, setTree] = useState<SessionTreeNode[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async (knight: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/fleet/${knight}/session?type=stats`)
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
      const data = await res.json()
      setStats(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchRecent = useCallback(async (knight: string, limit = 20) => {
    try {
      const res = await fetch(`/api/fleet/${knight}/session?type=recent&limit=${limit}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setRecent(data.entries || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    }
  }, [])

  const fetchTree = useCallback(async (knight: string) => {
    try {
      const res = await fetch(`/api/fleet/${knight}/session?type=tree`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setTree(data.nodes || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    }
  }, [])

  return { stats, recent, tree, loading, error, fetchStats, fetchRecent, fetchTree }
}
