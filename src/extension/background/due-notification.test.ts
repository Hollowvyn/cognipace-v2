import { describe, expect, it } from 'vitest'
import { normalizeNotificationTime } from './due-notification'

// All tests use TZ=UTC so setHours() is deterministic.
// Run with: TZ=UTC pnpm test src/extension/background/due-notification.test.ts

describe('normalizeNotificationTime', () => {
  it('returns minutes to a future time today', () => {
    // 10:00 UTC now, target 11:00 → 60 minutes
    const now = new Date('2026-05-30T10:00:00.000Z')
    expect(normalizeNotificationTime('11:00', now)).toBe(60)
  })

  it('wraps to tomorrow when time has already passed today', () => {
    // 10:00 UTC now, target 09:00 (already passed) → 23h until 09:00 tomorrow
    const now = new Date('2026-05-30T10:00:00.000Z')
    expect(normalizeNotificationTime('09:00', now)).toBe(23 * 60)
  })

  it('treats exactly the current minute as already passed', () => {
    // 10:00:30 UTC, target 10:00:00 → target <= now → tomorrow
    const now = new Date('2026-05-30T10:00:30.000Z')
    const result = normalizeNotificationTime('10:00', now)
    // Should be just under 24h (tomorrow at 10:00 minus 10:00:30 today)
    expect(result).toBeGreaterThan(23 * 60)
    expect(result).toBeLessThanOrEqual(24 * 60)
  })
})
