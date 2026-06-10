import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useTaskNotifications } from './useTaskNotifications'
import type { NatsEvent } from './useWebSocket'

let seq = 0
function makeResult(live: boolean, success = true): NatsEvent {
  seq++
  return {
    type: 'result',
    subject: `fleet-a.results.task-${seq}`,
    data: { task_id: `task-${seq}`, knight: 'Galahad', success, cost: 0.01 },
    timestamp: `2026-06-10T12:00:${String(seq % 60).padStart(2, '0')}.${seq}Z`,
    live,
  }
}

describe('useTaskNotifications', () => {
  it('toasts live result events exactly once', () => {
    const addToast = vi.fn()
    const live = makeResult(true)
    const { rerender } = renderHook(
      ({ events }: { events: NatsEvent[] }) => useTaskNotifications(events, addToast),
      { initialProps: { events: [] as NatsEvent[] } },
    )

    rerender({ events: [live] })
    expect(addToast).toHaveBeenCalledTimes(1)
    expect(addToast.mock.calls[0][0]).toContain('Galahad')

    // Same array again — no duplicate toast
    rerender({ events: [live] })
    expect(addToast).toHaveBeenCalledTimes(1)
  })

  it('does not toast seeded history events (no live flag)', () => {
    const addToast = vi.fn()
    const history = Array.from({ length: 50 }, () => makeResult(false))
    history.forEach((h) => delete h.live)

    const { rerender } = renderHook(
      ({ events }: { events: NatsEvent[] }) => useTaskNotifications(events, addToast),
      { initialProps: { events: [] as NatsEvent[] } },
    )
    rerender({ events: history })
    expect(addToast).not.toHaveBeenCalled()
  })

  it('keeps toasting when the feed is at its cap (constant length)', () => {
    const addToast = vi.fn()
    const feed = Array.from({ length: 200 }, () => makeResult(true))

    const { rerender } = renderHook(
      ({ events }: { events: NatsEvent[] }) => useTaskNotifications(events, addToast),
      { initialProps: { events: feed } },
    )
    expect(addToast).toHaveBeenCalledTimes(200)
    addToast.mockClear()

    // New event prepended, oldest dropped — length unchanged at 200
    const next = [makeResult(true), ...feed.slice(0, 199)]
    rerender({ events: next })
    expect(addToast).toHaveBeenCalledTimes(1)
  })

  it('shows the failure reason from the result field', () => {
    const addToast = vi.fn()
    const failed = makeResult(true, false)
    ;(failed.data as Record<string, unknown>).result = 'Task failed: model timeout'

    const { rerender } = renderHook(
      ({ events }: { events: NatsEvent[] }) => useTaskNotifications(events, addToast),
      { initialProps: { events: [] as NatsEvent[] } },
    )
    rerender({ events: [failed] })
    expect(addToast).toHaveBeenCalledWith(expect.stringContaining('Task failed: model timeout'), 'error')
  })
})
