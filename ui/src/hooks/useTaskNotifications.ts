import { useEffect, useRef } from 'react'
import type { NatsEvent } from './useWebSocket'
import { knightNameForDomain, getKnightConfig } from '../lib/knights'

interface ResultData {
  success?: boolean
  error?: string
  cost?: number
  duration?: string
  domain?: string
}

export function useTaskNotifications(
  events: NatsEvent[],
  addToast: (message: string, type: 'success' | 'info' | 'warning' | 'error') => void,
) {
  const seenCount = useRef(0)

  useEffect(() => {
    if (events.length === 0) return

    // Events are prepended (newest first), so new events are at indices 0..newCount-1
    const newCount = events.length - seenCount.current
    if (newCount <= 0) {
      seenCount.current = events.length
      return
    }

    const newEvents = events.slice(0, newCount)
    seenCount.current = events.length

    for (const event of newEvents) {
      if (event.type !== 'result') continue

      const data = event.data as ResultData
      // Extract domain from subject like "roundtable.security.result"
      const parts = event.subject.split('.')
      const domain = data.domain || parts[1] || 'unknown'
      const knightName = knightNameForDomain(domain)
      const config = knightName ? getKnightConfig(knightName) : getKnightConfig(domain)
      const displayName = knightName
        ? knightName.charAt(0).toUpperCase() + knightName.slice(1)
        : domain

      if (data.success === false || data.error) {
        const reason = data.error || 'unknown error'
        addToast(`❌ ${displayName} failed: ${reason}`, 'error')
      } else {
        const costStr = data.cost ? ` ($${data.cost.toFixed(4)})` : ''
        addToast(`${config.emoji} ${displayName} completed ${domain} task${costStr}`, 'success')
      }
    }
  }, [events, addToast])
}
