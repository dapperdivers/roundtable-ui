import { useEffect, useRef } from 'react'
import { eventKey, type NatsEvent } from './useWebSocket'
import { getKnightConfig } from '../lib/knights'
import { parseEvent, resultFailureReason } from '../lib/events'

const MAX_SEEN_KEYS = 1000

/**
 * Toast on live result events. Tracks event identity (not array length —
 * the feed is capped, so its length stops changing once full) and only
 * notifies for events that arrived over the WebSocket after mount, never
 * for seeded history.
 */
export function useTaskNotifications(
  events: NatsEvent[],
  addToast: (message: string, type: 'success' | 'info' | 'warning' | 'error') => void,
) {
  const seenKeys = useRef(new Set<string>())

  useEffect(() => {
    const seen = seenKeys.current
    const fresh = events.filter((e) => !seen.has(eventKey(e)))
    if (fresh.length === 0) return

    for (const e of fresh) seen.add(eventKey(e))
    // Bound the seen set; Sets iterate in insertion order, so keep the newest
    if (seen.size > MAX_SEEN_KEYS) {
      const keys = Array.from(seen)
      seenKeys.current = new Set(keys.slice(keys.length - MAX_SEEN_KEYS / 2))
    }

    for (const event of fresh) {
      if (!event.live || event.type !== 'result') continue

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
