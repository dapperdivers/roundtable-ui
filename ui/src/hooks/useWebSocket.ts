import { useState, useEffect, useRef, useCallback } from 'react'

export interface NatsEvent {
  type: 'task' | 'result'
  subject: string
  data: unknown
  timestamp: string
}

export function useWebSocket() {
  const [events, setEvents] = useState<NatsEvent[]>([])
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/ws`)

    ws.onopen = () => setConnected(true)
    ws.onclose = () => {
      setConnected(false)
      // Reconnect after 3s
      setTimeout(connect, 3000)
    }
    ws.onmessage = (e) => {
      try {
        const event: NatsEvent = JSON.parse(e.data)
        setEvents((prev) => [event, ...prev].slice(0, 200))
      } catch {
        // ignore parse errors
      }
    }

    wsRef.current = ws
  }, [])

  useEffect(() => {
    connect()
    return () => wsRef.current?.close()
  }, [connect])

  const dispatch = useCallback((knight: string, domain: string, task: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'dispatch', knight, domain, task }))
    }
  }, [])

  return { events, connected, dispatch }
}
