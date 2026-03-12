import { useState, useEffect, useRef, useCallback } from 'react'
import { getApiKey, authFetch } from '../lib/auth'

export interface NatsEvent {
  type: 'task' | 'result' | 'mission' | 'chain'
  subject: string
  data: unknown
  timestamp: string
}

const MAX_EVENTS = 200
const RECONNECT_DELAY_MS = 3000
const MAX_RECONNECT_DELAY_MS = 30000

/** Add jitter (±25%) to prevent thundering herd reconnects (#37) */
function jitter(ms: number): number {
  return ms * (0.75 + Math.random() * 0.5)
}

/** Generate a dedup key from an event's subject + timestamp */
function eventKey(e: NatsEvent): string {
  return `${e.subject}:${e.timestamp}`
}

export function useWebSocket() {
  const [events, setEvents] = useState<NatsEvent[]>([])
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectDelay = useRef(RECONNECT_DELAY_MS)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)
  const seenEvents = useRef(new Set<string>())

  const connect = useCallback(() => {
    if (!mountedRef.current) return

    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.onclose = null
      wsRef.current.close()
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const apiKey = getApiKey()
    const wsUrl = `${protocol}//${window.location.host}/api/ws${apiKey ? `?api_key=${encodeURIComponent(apiKey)}` : ''}`
    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      if (!mountedRef.current) return
      setConnected(true)
      setError(null)
      reconnectDelay.current = RECONNECT_DELAY_MS // Reset backoff on success
    }

    ws.onerror = () => {
      if (!mountedRef.current) return
      setError('WebSocket connection error')
    }

    ws.onclose = (e) => {
      if (!mountedRef.current) return
      setConnected(false)

      // Exponential backoff reconnect with jitter (#37)
      const delay = jitter(reconnectDelay.current)
      reconnectDelay.current = Math.min(reconnectDelay.current * 2, MAX_RECONNECT_DELAY_MS)
      reconnectTimer.current = setTimeout(connect, delay)
    }

    ws.onmessage = (e) => {
      if (!mountedRef.current) return
      try {
        const event: NatsEvent = JSON.parse(e.data)
        const key = eventKey(event)
        if (seenEvents.current.has(key)) return // deduplicate
        seenEvents.current.add(key)
        // Prevent unbounded growth of seen set
        if (seenEvents.current.size > MAX_EVENTS * 2) {
          const entries = Array.from(seenEvents.current)
          seenEvents.current = new Set(entries.slice(entries.length - MAX_EVENTS))
        }
        setEvents((prev) => {
          const next = [event, ...prev]
          return next.length > MAX_EVENTS ? next.slice(0, MAX_EVENTS) : next
        })
      } catch {
        // ignore parse errors
      }
    }

    wsRef.current = ws
  }, [])

  // Seed with recent history from JetStream on mount
  useEffect(() => {
    mountedRef.current = true

    // Load historical events so there's always something to show
    authFetch('/api/tasks')
      .then((r) => r.json())
      .then((data) => {
        if (!mountedRef.current) return
        const historical: NatsEvent[] = (data.results || [])
          .map((r: { type?: string; subject?: string; data?: unknown; timestamp?: string }) => ({
            type: (r.type || 'result') as NatsEvent['type'],
            subject: r.subject || '',
            data: r.data,
            timestamp: r.timestamp || new Date().toISOString(),
          }))
          .reverse() // newest first
          .slice(0, MAX_EVENTS)
        if (historical.length > 0) {
          // Track historical event keys for dedup
          for (const h of historical) {
            seenEvents.current.add(eventKey(h))
          }
          setEvents((prev) => {
            // Merge: live events take priority, dedup against history
            const existingKeys = new Set(prev.map(eventKey))
            const newHistory = historical.filter((h: NatsEvent) => !existingKeys.has(eventKey(h)))
            const merged = [...prev, ...newHistory]
            return merged.slice(0, MAX_EVENTS)
          })
        }
      })
      .catch(() => {}) // silently fail — WS will still work

    connect()
    return () => {
      mountedRef.current = false
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      if (wsRef.current) {
        wsRef.current.onclose = null
        wsRef.current.close()
      }
    }
  }, [connect])

  const dispatch = useCallback((knight: string, domain: string, task: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'dispatch', knight, domain, task }))
    }
  }, [])

  const clearEvents = useCallback(() => {
    setEvents([])
    seenEvents.current.clear()
  }, [])

  return { events, connected, error, dispatch, clearEvents }
}
