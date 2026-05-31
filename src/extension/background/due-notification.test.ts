import { describe, expect, it, vi } from 'vitest'
import { createDueNotification, dueCheckAlarmName, normalizeNotificationTime } from './due-notification'
import type { DueNotificationDeps } from './due-notification'

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

// --- Test helpers ---

function createFakeScheduler() {
  return {
    clear: vi.fn(async (_name: string) => {}),
    schedule: vi.fn(async (_name: string, _info: { delayInMinutes?: number }) => {}),
    register: vi.fn(),
  }
}

function makeReminders(opts: { enabled?: boolean; time?: string } = {}) {
  return {
    reminders: {
      daily: {
        enabled: opts.enabled ?? true,
        time: opts.time ?? '09:00',
      },
    },
  }
}

function createDeps(overrides: Partial<DueNotificationDeps> = {}): DueNotificationDeps & {
  scheduler: ReturnType<typeof createFakeScheduler>
} {
  const scheduler = createFakeScheduler()
  return {
    now: () => new Date('2026-05-30T10:00:00.000Z'), // 10:00 UTC
    readSettings: vi.fn(async () => makeReminders()),
    readQueueSummary: vi.fn(async () => ({ dueCount: 0 })),
    readState: vi.fn(async () => ({ lastNotifiedDate: null as string | null })),
    writeState: vi.fn(async () => {}),
    notify: vi.fn(async () => {}),
    checkAlarmScheduled: vi.fn(async () => false),
    scheduler,
    ...overrides,
  } as DueNotificationDeps & { scheduler: ReturnType<typeof createFakeScheduler> }
}

// --- runDailyCheck ---

describe('runDailyCheck', () => {
  it('bails and does not notify or reschedule when notifications are disabled', async () => {
    const deps = createDeps({
      readSettings: vi.fn(async () => makeReminders({ enabled: false })),
    })
    const { registerJobs, runDailyCheck } = createDueNotification(deps)
    registerJobs()

    await runDailyCheck()

    expect(deps.notify).not.toHaveBeenCalled()
    expect(deps.scheduler.schedule).not.toHaveBeenCalled()
  })

  it('skips notification when already notified today but still reschedules', async () => {
    const deps = createDeps({
      readSettings: vi.fn(async () => makeReminders({ enabled: true, time: '11:00' })),
      readState: vi.fn(async () => ({ lastNotifiedDate: '2026-05-30' })),
      readQueueSummary: vi.fn(async () => ({ dueCount: 5 })),
    })
    const { registerJobs, runDailyCheck } = createDueNotification(deps)
    registerJobs()

    await runDailyCheck()

    expect(deps.notify).not.toHaveBeenCalled()
    expect(deps.scheduler.schedule).toHaveBeenCalledWith(dueCheckAlarmName, {
      delayInMinutes: expect.any(Number),
    })
  })

  it('skips notification when dueCount is 0 but still reschedules', async () => {
    const deps = createDeps({
      readSettings: vi.fn(async () => makeReminders({ enabled: true, time: '11:00' })),
      readState: vi.fn(async () => ({ lastNotifiedDate: null })),
      readQueueSummary: vi.fn(async () => ({ dueCount: 0 })),
    })
    const { registerJobs, runDailyCheck } = createDueNotification(deps)
    registerJobs()

    await runDailyCheck()

    expect(deps.notify).not.toHaveBeenCalled()
    expect(deps.scheduler.schedule).toHaveBeenCalledWith(dueCheckAlarmName, {
      delayInMinutes: expect.any(Number),
    })
  })

  it('notifies, writes today date, and reschedules when dueCount > 0 and not deduped', async () => {
    // now=10:00 UTC, next alarm time=11:00 → 60 min delay
    const deps = createDeps({
      readSettings: vi.fn(async () => makeReminders({ enabled: true, time: '11:00' })),
      readState: vi.fn(async () => ({ lastNotifiedDate: null })),
      readQueueSummary: vi.fn(async () => ({ dueCount: 3 })),
    })
    const { registerJobs, runDailyCheck } = createDueNotification(deps)
    registerJobs()

    await runDailyCheck()

    expect(deps.notify).toHaveBeenCalledWith(
      'Reviews due',
      'You have 3 reviews due today.',
    )
    expect(deps.writeState).toHaveBeenCalledWith('2026-05-30')
    expect(deps.scheduler.schedule).toHaveBeenCalledWith(dueCheckAlarmName, {
      delayInMinutes: 60,
    })
  })

  it('uses singular "review" when dueCount is 1', async () => {
    const deps = createDeps({
      readSettings: vi.fn(async () => makeReminders({ enabled: true, time: '11:00' })),
      readState: vi.fn(async () => ({ lastNotifiedDate: null })),
      readQueueSummary: vi.fn(async () => ({ dueCount: 1 })),
    })
    const { registerJobs, runDailyCheck } = createDueNotification(deps)
    registerJobs()

    await runDailyCheck()

    expect(deps.notify).toHaveBeenCalledWith(
      'Reviews due',
      'You have 1 review due today.',
    )
  })

  it('notifies when lastNotifiedDate is a past date (stale dedup key)', async () => {
    const deps = createDeps({
      readSettings: vi.fn(async () => makeReminders({ enabled: true, time: '11:00' })),
      readState: vi.fn(async () => ({ lastNotifiedDate: '2026-05-29' })), // yesterday
      readQueueSummary: vi.fn(async () => ({ dueCount: 4 })),
    })
    const { registerJobs, runDailyCheck } = createDueNotification(deps)
    registerJobs()

    await runDailyCheck()

    expect(deps.notify).toHaveBeenCalledWith(
      'Reviews due',
      'You have 4 reviews due today.',
    )
    expect(deps.writeState).toHaveBeenCalledWith('2026-05-30')
  })
})
