import { useEffect, useRef } from 'react'
import type { NatsEvent } from './useWebSocket'
import { getKnightConfig } from '../lib/knights'
import { parseEvent, resultFailureReason } from '../lib/events'

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

      const { knight, data } = parseEvent(event)
      const config = getKnightConfig(knight || 'unknown')
      const displayName = knight
        ? knight.charAt(0).toUpperCase() + knight.slice(1)
        : 'Unknown knight'

      const reason = resultFailureReason(data)
      if (reason) {
        addToast(`❌ ${displayName} failed: ${reason}`, 'error')
      } else {
        const cost = typeof data.cost === 'number' ? data.cost : null
        const costStr = cost ? ` ($${cost.toFixed(4)})` : ''
        const domainStr = knight ? ` ${config.domain}` : ''
        addToast(`${config.emoji} ${displayName} completed a${domainStr} task${costStr}`, 'success')
      }
    }
  }, [events, addToast])
}
