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
    clear: vi.fn(() => Promise.resolve()),
    schedule: vi.fn(() => Promise.resolve()),
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
    readSettings: vi.fn(() => Promise.resolve(makeReminders())),
    readQueueSummary: vi.fn(() => Promise.resolve({ dueToday: 0 })),
    readState: vi.fn(() => Promise.resolve({ lastNotifiedDate: null as string | null })),
    writeState: vi.fn(() => Promise.resolve()),
    notify: vi.fn(() => Promise.resolve()),
    checkAlarmScheduled: vi.fn(() => Promise.resolve(false)),
    scheduler,
    ...overrides,
  } as DueNotificationDeps & { scheduler: ReturnType<typeof createFakeScheduler> }
}

// --- runDailyCheck ---

describe('runDailyCheck', () => {
  it('bails and does not notify or reschedule when notifications are disabled', async () => {
    const deps = createDeps({
      readSettings: vi.fn(() => Promise.resolve(makeReminders({ enabled: false }))),
    })
    const { registerJobs, runDailyCheck } = createDueNotification(deps)
    registerJobs()

    await runDailyCheck()

    expect(deps.notify).not.toHaveBeenCalled()
    expect(deps.scheduler.schedule).not.toHaveBeenCalled()
  })

  it('skips notification when already notified today but still reschedules', async () => {
    const deps = createDeps({
      readSettings: vi.fn(() => Promise.resolve(makeReminders({ enabled: true, time: '11:00' }))),
      readState: vi.fn(() => Promise.resolve({ lastNotifiedDate: '2026-05-30' })),
      readQueueSummary: vi.fn(() => Promise.resolve({ dueToday: 5 })),
    })
    const { registerJobs, runDailyCheck } = createDueNotification(deps)
    registerJobs()

    await runDailyCheck()

    expect(deps.notify).not.toHaveBeenCalled()
    // now=10:00 UTC, next alarm time=11:00 → 60 min delay
    expect(deps.scheduler.schedule).toHaveBeenCalledWith(dueCheckAlarmName, {
      delayInMinutes: 60,
    })
  })

  it('skips notification when dueToday is 0 but still reschedules', async () => {
    const deps = createDeps({
      readSettings: vi.fn(() => Promise.resolve(makeReminders({ enabled: true, time: '11:00' }))),
      readState: vi.fn(() => Promise.resolve({ lastNotifiedDate: null })),
      readQueueSummary: vi.fn(() => Promise.resolve({ dueToday: 0 })),
    })
    const { registerJobs, runDailyCheck } = createDueNotification(deps)
    registerJobs()

    await runDailyCheck()

    expect(deps.notify).not.toHaveBeenCalled()
    // now=10:00 UTC, next alarm time=11:00 → 60 min delay
    expect(deps.scheduler.schedule).toHaveBeenCalledWith(dueCheckAlarmName, {
      delayInMinutes: 60,
    })
  })

  it('notifies, writes today date, and reschedules when dueToday > 0 and not deduped', async () => {
    // now=10:00 UTC, next alarm time=11:00 → 60 min delay
    const deps = createDeps({
      readSettings: vi.fn(() => Promise.resolve(makeReminders({ enabled: true, time: '11:00' }))),
      readState: vi.fn(() => Promise.resolve({ lastNotifiedDate: null })),
      readQueueSummary: vi.fn(() => Promise.resolve({ dueToday: 3 })),
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

  it('uses singular "review" when dueToday is 1', async () => {
    const deps = createDeps({
      readSettings: vi.fn(() => Promise.resolve(makeReminders({ enabled: true, time: '11:00' }))),
      readState: vi.fn(() => Promise.resolve({ lastNotifiedDate: null })),
      readQueueSummary: vi.fn(() => Promise.resolve({ dueToday: 1 })),
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
      readSettings: vi.fn(() => Promise.resolve(makeReminders({ enabled: true, time: '11:00' }))),
      readState: vi.fn(() => Promise.resolve({ lastNotifiedDate: '2026-05-29' })), // yesterday
      readQueueSummary: vi.fn(() => Promise.resolve({ dueToday: 4 })),
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

describe('handleStartup', () => {
  it('does nothing when notifications are disabled', async () => {
    const deps = createDeps({
      readSettings: vi.fn(() => Promise.resolve(makeReminders({ enabled: false }))),
    })
    const { registerJobs, handleStartup } = createDueNotification(deps)
    registerJobs()

    await handleStartup()

    expect(deps.scheduler.schedule).not.toHaveBeenCalled()
    expect(deps.notify).not.toHaveBeenCalled()
  })

  it('does nothing when alarm is already scheduled', async () => {
    const deps = createDeps({
      readSettings: vi.fn(() => Promise.resolve(makeReminders({ enabled: true, time: '11:00' }))),
      checkAlarmScheduled: vi.fn(() => Promise.resolve(true)),
    })
    const { registerJobs, handleStartup } = createDueNotification(deps)
    registerJobs()

    await handleStartup()

    expect(deps.scheduler.schedule).not.toHaveBeenCalled()
  })

  it('schedules upcoming alarm when daily time is in the future and no alarm exists', async () => {
    // now=10:00 UTC, time=11:00 → upcoming → schedule for 60 min
    const deps = createDeps({
      now: () => new Date('2026-05-30T10:00:00.000Z'),
      readSettings: vi.fn(() => Promise.resolve(makeReminders({ enabled: true, time: '11:00' }))),
      checkAlarmScheduled: vi.fn(() => Promise.resolve(false)),
    })
    const { registerJobs, handleStartup } = createDueNotification(deps)
    registerJobs()

    await handleStartup()

    expect(deps.scheduler.schedule).toHaveBeenCalledWith(dueCheckAlarmName, {
      delayInMinutes: 60,
    })
    expect(deps.notify).not.toHaveBeenCalled()
  })

  it('runs daily check immediately when daily time has already passed today', async () => {
    // now=10:00 UTC, time=09:00 → already passed → fire now + reschedule for tomorrow
    const deps = createDeps({
      now: () => new Date('2026-05-30T10:00:00.000Z'),
      readSettings: vi.fn(() => Promise.resolve(makeReminders({ enabled: true, time: '09:00' }))),
      checkAlarmScheduled: vi.fn(() => Promise.resolve(false)),
      readState: vi.fn(() => Promise.resolve({ lastNotifiedDate: null as string | null })),
      readQueueSummary: vi.fn(() => Promise.resolve({ dueToday: 2 })),
    })
    const { registerJobs, handleStartup } = createDueNotification(deps)
    registerJobs()

    await handleStartup()

    expect(deps.notify).toHaveBeenCalledWith(
      'Reviews due',
      'You have 2 reviews due today.',
    )
    // runDailyCheck reschedules for 09:00 tomorrow = 23h from 10:00 now
    expect(deps.scheduler.schedule).toHaveBeenCalledWith(dueCheckAlarmName, {
      delayInMinutes: 23 * 60,
    })
  })
})

describe('onSettingsChanged', () => {
  it('clears the alarm when notifications are toggled off', async () => {
    const deps = createDeps()
    const { registerJobs, onSettingsChanged } = createDueNotification(deps)
    registerJobs()

    await onSettingsChanged(
      makeReminders({ enabled: true, time: '09:00' }),
      makeReminders({ enabled: false, time: '09:00' }),
    )

    expect(deps.scheduler.clear).toHaveBeenCalledWith(dueCheckAlarmName)
    expect(deps.scheduler.schedule).not.toHaveBeenCalled()
  })

  it('schedules alarm via handleStartup when notifications are toggled on', async () => {
    // now=10:00 UTC, new time=11:00 → upcoming → schedule for 60 min
    const deps = createDeps({
      now: () => new Date('2026-05-30T10:00:00.000Z'),
      readSettings: vi.fn(() => Promise.resolve(makeReminders({ enabled: true, time: '11:00' }))),
      checkAlarmScheduled: vi.fn(() => Promise.resolve(false)),
    })
    const { registerJobs, onSettingsChanged } = createDueNotification(deps)
    registerJobs()

    await onSettingsChanged(
      makeReminders({ enabled: false, time: '11:00' }),
      makeReminders({ enabled: true, time: '11:00' }),
    )

    expect(deps.scheduler.schedule).toHaveBeenCalledWith(dueCheckAlarmName, {
      delayInMinutes: 60,
    })
  })

  it('clears old alarm and schedules new one when time changes while enabled', async () => {
    // now=10:00 UTC, new time=11:00 → 60 min
    const deps = createDeps({
      now: () => new Date('2026-05-30T10:00:00.000Z'),
    })
    const { registerJobs, onSettingsChanged } = createDueNotification(deps)
    registerJobs()

    await onSettingsChanged(
      makeReminders({ enabled: true, time: '09:00' }),
      makeReminders({ enabled: true, time: '11:00' }),
    )

    expect(deps.scheduler.clear).toHaveBeenCalledWith(dueCheckAlarmName)
    expect(deps.scheduler.schedule).toHaveBeenCalledWith(dueCheckAlarmName, {
      delayInMinutes: 60,
    })
  })

  it('does nothing when neither enabled nor time changed', async () => {
    const deps = createDeps()
    const { registerJobs, onSettingsChanged } = createDueNotification(deps)
    registerJobs()

    await onSettingsChanged(
      makeReminders({ enabled: true, time: '09:00' }),
      makeReminders({ enabled: true, time: '09:00' }),
    )

    expect(deps.scheduler.clear).not.toHaveBeenCalled()
    expect(deps.scheduler.schedule).not.toHaveBeenCalled()
  })
})
