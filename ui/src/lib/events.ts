// Shared NATS event parsing.
//
// Subject formats (pi-knight + dashboard API conventions):
//   tasks:    <fleet>.tasks.<domain>.<taskId>
//   results:  <fleet>.results.<taskId>          — no domain segment!
//
// Result payloads (pi-knight publishResult) carry the knight name directly
// (capitalized CR name, e.g. "Galahad") plus success/result/cost/tokens/
// duration_ms/model. There is no `domain` or `error` field — failure text
// lives in `result` when success === false.
import { knightNameForDomain } from './knights'
import type { NatsEvent } from '../hooks/useWebSocket'

export interface ResultData {
  task_id?: string
  knight?: string
  success?: boolean
  result?: string
  duration_ms?: number
  cost?: number
  tokens?: { input?: number; output?: number; total?: number }
  model?: string
  timestamp?: string
}

/** Parse event payload, which may arrive as a JSON string or an object. */
export function parseEventData(data: unknown): Record<string, unknown> {
  if (typeof data === 'string') {
    try { return JSON.parse(data) } catch { return { raw: data } }
  }
  return (data as Record<string, unknown>) || {}
}

export interface ParsedEvent {
  /** Lowercase knight CR name (matches fleet/KNIGHT_CONFIG keys), if resolvable */
  knight: string | null
  /** Task domain — only present on task events (results carry no domain) */
  domain: string | null
  taskId: string
  data: Record<string, unknown>
}

/** Resolve knight/domain/taskId for an event, honoring the per-type subject format. */
export function parseEvent(event: NatsEvent): ParsedEvent {
  const parts = event.subject.split('.')
  const data = parseEventData(event.data)

  if (event.type === 'result') {
    const payloadKnight = typeof data.knight === 'string' && data.knight ? data.knight.toLowerCase() : null
    return {
      knight: payloadKnight,
      domain: null,
      taskId: (typeof data.task_id === 'string' && data.task_id) || parts[2] || '',
      data,
    }
  }

  if (event.type === 'task') {
    const domain = parts[2] || null
    return {
      knight: domain ? knightNameForDomain(domain) : null,
      domain,
      taskId: parts[3] || '',
      data,
    }
  }

  // mission/chain events: subject is <fleet>.<type>.<name...>
  return { knight: null, domain: null, taskId: '', data }
}

/** Failure reason for a failed result event, or null if it succeeded. */
export function resultFailureReason(data: Record<string, unknown>): string | null {
  if (data.success !== false) return null
  const text = typeof data.result === 'string' ? data.result.trim() : ''
  if (!text) return 'unknown error'
  return text.length > 160 ? text.slice(0, 160) + '…' : text
}
