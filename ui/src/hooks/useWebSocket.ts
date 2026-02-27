import { useState, useEffect, useRef, useCallback } from 'react'

export interface NatsEvent {
  type: 'task' | 'result'
  subject: string
  data: unknown
  timestamp: string
}

const MAX_EVENTS = 200
const RECONNECT_DELAY_MS = 3000
const MAX_RECONNECT_DELAY_MS = 30000

export function useWebSocket() {
  const [events, setEvents] = useState<NatsEvent[]>([])
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectDelay = useRef(RECONNECT_DELAY_MS)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

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

      // Exponential backoff reconnect
      const delay = reconnectDelay.current
      reconnectDelay.current = Math.min(delay * 2, MAX_RECONNECT_DELAY_MS)
      reconnectTimer.current = setTimeout(connect, delay)
    }

    ws.onmessage = (e) => {
      if (!mountedRef.current) return
      try {
        const event: NatsEvent = JSON.parse(e.data)
        setEvents((prev) => {
          // Prevent unbounded growth — cap at MAX_EVENTS
          const next = [event, ...prev]
          return next.length > MAX_EVENTS ? next.slice(0, MAX_EVENTS) : next
        })
      } catch {
        // ignore parse errors
      }
    }

    wsRef.current = ws
  }, [])

  useEffect(() => {
    mountedRef.current = true
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

  const clearEvents = useCallback(() => setEvents([]), [])

  return { events, connected, error, dispatch, clearEvents }
}
