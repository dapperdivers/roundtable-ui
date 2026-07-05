import { useState, useEffect, useRef, useCallback, createContext, useContext, type ReactNode } from 'react'
import { apiGet } from '../lib/api'

export interface NatsEvent {
  type: 'task' | 'result' | 'mission' | 'chain'
  subject: string
  data: unknown
  timestamp: string
  /** True when the event arrived over the live WebSocket (vs seeded from history) */
  live?: boolean
}

const MAX_EVENTS = 200
const RECONNECT_DELAY_MS = 3000
const MAX_RECONNECT_DELAY_MS = 30000

/** Add jitter (±25%) to prevent thundering herd reconnects (#37) */
function jitter(ms: number): number {
  return ms * (0.75 + Math.random() * 0.5)
}

/** Generate a dedup key from an event's subject + timestamp */
export function eventKey(e: NatsEvent): string {
  return `${e.subject}:${e.timestamp}`
}

/**
 * Owns a WebSocket connection + event feed. Use via WebSocketProvider /
 * useWebSocket — mounting this hook directly opens a NEW connection
 * (4 NATS subscriptions server-side) and refetches history.
 */
function useWebSocketConnection() {
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
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/ws`)

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
      // Surface the close reason for diagnosis. The API returns a 503 on the
      // upgrade when its NATS connection is down (browsers report that as a
      // reasonless code-1006 close), and a clean shutdown sends 1011 with a
      // reason — either way, don't silently show a bare "Disconnected".
      const reason = e.reason || (e.code === 1006 ? 'live feed unreachable (backend may be starting or NATS is down)' : `closed (code ${e.code})`)
      setError(reason)

      // Exponential backoff reconnect with jitter (#37)
      const delay = jitter(reconnectDelay.current)
      reconnectDelay.current = Math.min(reconnectDelay.current * 2, MAX_RECONNECT_DELAY_MS)
      reconnectTimer.current = setTimeout(connect, delay)
    }

    ws.onmessage = (e) => {
      if (!mountedRef.current) return
      try {
        const event: NatsEvent = { ...JSON.parse(e.data), live: true }
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
    apiGet<{ results?: Array<{ type?: string; subject?: string; data?: unknown; timestamp?: string }> }>('/api/tasks')
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

  const clearEvents = useCallback(() => {
    setEvents([])
    seenEvents.current.clear()
  }, [])

  return { events, connected, error, clearEvents }
}

type WebSocketState = ReturnType<typeof useWebSocketConnection>

const WebSocketContext = createContext<WebSocketState | null>(null)

/**
 * Holds the app's single WebSocket connection and event feed (#127).
 * Mount once near the root; every useWebSocket() consumer shares it.
 */
export function WebSocketProvider({ children }: { children: ReactNode }) {
  const ws = useWebSocketConnection()
  return <WebSocketContext.Provider value={ws}>{children}</WebSocketContext.Provider>
}

/** Access the shared WebSocket event feed. Requires WebSocketProvider. */
export function useWebSocket(): WebSocketState {
  const ctx = useContext(WebSocketContext)
  if (!ctx) {
    throw new Error('useWebSocket must be used within a WebSocketProvider')
  }
  return ctx
}
