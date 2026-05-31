# Due-Notification Scheduler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local daily browser notification that fires once per day when the user has due reviews, driven by `chrome.alarms` and a user-configured daily time.

**Architecture:** A `createDueNotification(deps)` factory (mirroring `createSyncAutoSync`) wires into the existing `AlarmScheduler` in the extension background. All IO deps are injected, making the module fully unit-testable without mocking Chrome globals. State dedup lives in `chrome.storage.local` under a namespaced key.

**Tech Stack:** TypeScript, Vitest, WXT (`wxt/browser`), Chrome MV3 alarms + notifications APIs.

---

## File Map

| Action | Path | Purpose |
|---|---|---|
| Create | `src/extension/background/due-notification.ts` | Factory module + storage helpers + `normalizeNotificationTime` |
| Create | `src/extension/background/due-notification.test.ts` | Full test suite |
| Modify | `wxt.config.ts` | Add `notifications` permission |
| Modify | `src/extension/background/register-handlers.ts` | Wire up factory, `registerJobs`, `handleStartup`, `onSettingsChanged` |

---

## Task 1: Add `notifications` manifest permission

**Files:**
- Modify: `wxt.config.ts`

`alarms` is already in the permissions array. Only `notifications` needs to be added.

- [ ] **Step 1: Add the permission**

In `wxt.config.ts`, change:
```typescript
permissions: ['storage', 'alarms'],
```
to:
```typescript
permissions: ['storage', 'alarms', 'notifications'],
```

- [ ] **Step 2: Verify the build still type-checks**

```bash
cd /Users/nidsounds/Documents/GitHub/cognipace-v2
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add wxt.config.ts
git commit -m "feat: add notifications manifest permission"
```

---

## Task 2: Create `due-notification.ts` skeleton + `normalizeNotificationTime`

**Files:**
- Create: `src/extension/background/due-notification.ts`
- Create: `src/extension/background/due-notification.test.ts`

This task establishes the module shape and TDDs the only pure helper. All functions are stubbed (empty bodies) — they are implemented in Tasks 3–5.

- [ ] **Step 1: Write the failing tests for `normalizeNotificationTime`**

Create `src/extension/background/due-notification.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest'
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
```

- [ ] **Step 2: Run tests — expect them to fail**

```bash
cd /Users/nidsounds/Documents/GitHub/cognipace-v2
TZ=UTC pnpm test src/extension/background/due-notification.test.ts
```

Expected: FAIL — `normalizeNotificationTime` not found.

- [ ] **Step 3: Create `due-notification.ts` with the helper and full module skeleton**

Create `src/extension/background/due-notification.ts`:

```typescript
import type { UserSettings } from '@/features/settings/domain'
import type { AlarmScheduler } from './scheduler/alarm-scheduler'

export const dueCheckAlarmName = 'due:daily-check'

export type DueNotificationDeps = {
  now: () => Date
  readSettings: () => Promise<Pick<UserSettings, 'reminders'>>
  readQueueSummary: () => Promise<{ dueCount: number }>
  readState: () => Promise<{ lastNotifiedDate: string | null }>
  writeState: (date: string) => Promise<void>
  notify: (title: string, message: string) => Promise<void>
  checkAlarmScheduled: (name: string) => Promise<boolean>
  scheduler: Pick<AlarmScheduler, 'clear' | 'register' | 'schedule'>
}

export function normalizeNotificationTime(time: string, now: Date): number {
  const [hours, minutes] = time.split(':').map(Number)
  const target = new Date(now)
  target.setHours(hours, minutes, 0, 0)
  if (target > now) {
    return Math.ceil((target.getTime() - now.getTime()) / 60_000)
  }
  target.setDate(target.getDate() + 1)
  return Math.ceil((target.getTime() - now.getTime()) / 60_000)
}

function hasTimePassed(time: string, now: Date): boolean {
  const [hours, minutes] = time.split(':').map(Number)
  const target = new Date(now)
  target.setHours(hours, minutes, 0, 0)
  return target <= now
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function createDueNotification(deps: DueNotificationDeps) {
  let jobsRegistered = false

  async function runDailyCheck(): Promise<void> {}

  async function handleStartup(): Promise<void> {}

  async function onSettingsChanged(
    _prev: Pick<UserSettings, 'reminders'>,
    _next: Pick<UserSettings, 'reminders'>,
  ): Promise<void> {}

  function registerJobs(): void {
    if (jobsRegistered) return
    deps.scheduler.register({ name: dueCheckAlarmName, run: runDailyCheck })
    jobsRegistered = true
  }

  return { handleStartup, onSettingsChanged, registerJobs, runDailyCheck }
}
```

- [ ] **Step 4: Run tests — expect them to pass**

```bash
TZ=UTC pnpm test src/extension/background/due-notification.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/extension/background/due-notification.ts \
        src/extension/background/due-notification.test.ts
git commit -m "feat: add due-notification module skeleton and normalizeNotificationTime"
```

---

## Task 3: Implement `runDailyCheck`

**Files:**
- Modify: `src/extension/background/due-notification.ts`
- Modify: `src/extension/background/due-notification.test.ts`

- [ ] **Step 1: Add test helpers and `runDailyCheck` tests to the test file**

Append the following to `src/extension/background/due-notification.test.ts` (after the existing `normalizeNotificationTime` describe block):

```typescript
import { beforeEach, vi } from 'vitest'
import { createDueNotification, dueCheckAlarmName } from './due-notification'
import type { DueNotificationDeps } from './due-notification'

// --- Test helpers ---

function createFakeScheduler() {
  const scheduled: Array<{ name: string; delayInMinutes: number }> = []
  const cleared: string[] = []
  return {
    scheduled,
    cleared,
    clear: vi.fn(async (name: string) => { cleared.push(name) }),
    schedule: vi.fn(async (name: string, info: { delayInMinutes?: number }) => {
      scheduled.push({ name, delayInMinutes: info.delayInMinutes ?? 0 })
    }),
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
    readState: vi.fn(async () => ({ lastNotifiedDate: null })),
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
})
```

- [ ] **Step 2: Run tests — the `runDailyCheck` tests should fail**

```bash
TZ=UTC pnpm test src/extension/background/due-notification.test.ts
```

Expected: `normalizeNotificationTime` tests still pass; `runDailyCheck` tests fail (notify/schedule not called with empty stub).

- [ ] **Step 3: Implement `runDailyCheck` in `due-notification.ts`**

Replace the empty `runDailyCheck` stub:

```typescript
async function runDailyCheck(): Promise<void> {
  const settings = await deps.readSettings()
  if (!settings.reminders.daily.enabled) return

  const now = deps.now()
  const today = toDateString(now)
  const state = await deps.readState()
  const { dueCount } = await deps.readQueueSummary()

  if (state.lastNotifiedDate !== today && dueCount > 0) {
    await deps.notify(
      'Reviews due',
      `You have ${dueCount} review${dueCount === 1 ? '' : 's'} due today.`,
    )
    await deps.writeState(today)
  }

  await deps.scheduler.schedule(dueCheckAlarmName, {
    delayInMinutes: normalizeNotificationTime(settings.reminders.daily.time, now),
  })
}
```

- [ ] **Step 4: Run tests — all should pass**

```bash
TZ=UTC pnpm test src/extension/background/due-notification.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/extension/background/due-notification.ts \
        src/extension/background/due-notification.test.ts
git commit -m "feat: implement runDailyCheck"
```

---

## Task 4: Implement `handleStartup`

**Files:**
- Modify: `src/extension/background/due-notification.ts`
- Modify: `src/extension/background/due-notification.test.ts`

- [ ] **Step 1: Add `handleStartup` tests to the test file**

Append to `src/extension/background/due-notification.test.ts`:

```typescript
describe('handleStartup', () => {
  it('does nothing when notifications are disabled', async () => {
    const deps = createDeps({
      readSettings: vi.fn(async () => makeReminders({ enabled: false })),
    })
    const { registerJobs, handleStartup } = createDueNotification(deps)
    registerJobs()

    await handleStartup()

    expect(deps.scheduler.schedule).not.toHaveBeenCalled()
    expect(deps.notify).not.toHaveBeenCalled()
  })

  it('does nothing when alarm is already scheduled', async () => {
    const deps = createDeps({
      readSettings: vi.fn(async () => makeReminders({ enabled: true, time: '11:00' })),
      checkAlarmScheduled: vi.fn(async () => true),
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
      readSettings: vi.fn(async () => makeReminders({ enabled: true, time: '11:00' })),
      checkAlarmScheduled: vi.fn(async () => false),
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
      readSettings: vi.fn(async () => makeReminders({ enabled: true, time: '09:00' })),
      checkAlarmScheduled: vi.fn(async () => false),
      readState: vi.fn(async () => ({ lastNotifiedDate: null })),
      readQueueSummary: vi.fn(async () => ({ dueCount: 2 })),
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
```

- [ ] **Step 2: Run tests — `handleStartup` tests should fail**

```bash
TZ=UTC pnpm test src/extension/background/due-notification.test.ts
```

Expected: existing tests still pass; `handleStartup` tests fail (empty stub).

- [ ] **Step 3: Implement `handleStartup` in `due-notification.ts`**

Replace the empty `handleStartup` stub:

```typescript
async function handleStartup(): Promise<void> {
  const settings = await deps.readSettings()
  if (!settings.reminders.daily.enabled) return

  const alreadyScheduled = await deps.checkAlarmScheduled(dueCheckAlarmName)
  if (alreadyScheduled) return

  const { time } = settings.reminders.daily
  if (hasTimePassed(time, deps.now())) {
    await runDailyCheck()
  } else {
    await deps.scheduler.schedule(dueCheckAlarmName, {
      delayInMinutes: normalizeNotificationTime(time, deps.now()),
    })
  }
}
```

- [ ] **Step 4: Run tests — all should pass**

```bash
TZ=UTC pnpm test src/extension/background/due-notification.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/extension/background/due-notification.ts \
        src/extension/background/due-notification.test.ts
git commit -m "feat: implement handleStartup"
```

---

## Task 5: Implement `onSettingsChanged`

**Files:**
- Modify: `src/extension/background/due-notification.ts`
- Modify: `src/extension/background/due-notification.test.ts`

- [ ] **Step 1: Add `onSettingsChanged` tests to the test file**

Append to `src/extension/background/due-notification.test.ts`:

```typescript
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
    // now=10:00, new time=11:00 → upcoming → schedule for 60 min
    const deps = createDeps({
      now: () => new Date('2026-05-30T10:00:00.000Z'),
      readSettings: vi.fn(async () => makeReminders({ enabled: true, time: '11:00' })),
      checkAlarmScheduled: vi.fn(async () => false),
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
```

- [ ] **Step 2: Run tests — `onSettingsChanged` tests should fail**

```bash
TZ=UTC pnpm test src/extension/background/due-notification.test.ts
```

Expected: existing tests still pass; `onSettingsChanged` tests fail.

- [ ] **Step 3: Implement `onSettingsChanged` in `due-notification.ts`**

Replace the empty `onSettingsChanged` stub:

```typescript
async function onSettingsChanged(
  prev: Pick<UserSettings, 'reminders'>,
  next: Pick<UserSettings, 'reminders'>,
): Promise<void> {
  const prevDaily = prev.reminders.daily
  const nextDaily = next.reminders.daily

  if (prevDaily.enabled === nextDaily.enabled && prevDaily.time === nextDaily.time) {
    return
  }

  if (!nextDaily.enabled) {
    await deps.scheduler.clear(dueCheckAlarmName)
    return
  }

  if (!prevDaily.enabled) {
    await handleStartup()
    return
  }

  // Enabled, time changed
  await deps.scheduler.clear(dueCheckAlarmName)
  await deps.scheduler.schedule(dueCheckAlarmName, {
    delayInMinutes: normalizeNotificationTime(nextDaily.time, deps.now()),
  })
}
```

- [ ] **Step 4: Run tests — all should pass**

```bash
TZ=UTC pnpm test src/extension/background/due-notification.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/extension/background/due-notification.ts \
        src/extension/background/due-notification.test.ts
git commit -m "feat: implement onSettingsChanged"
```

---

## Task 6: Add storage helpers and wire up in `register-handlers.ts`

**Files:**
- Modify: `src/extension/background/due-notification.ts` — add exported storage helpers
- Modify: `src/extension/background/register-handlers.ts` — create `dueNotification`, call `registerJobs`/`handleStartup`, hook `onSettingsChanged`

### Part A: Storage helpers

- [ ] **Step 1: Add `browser` import and storage helpers to `due-notification.ts`**

Add at the top of `due-notification.ts`, after the existing imports:

```typescript
import { browser } from 'wxt/browser'
```

Add these two exported functions before `createDueNotification` (alongside the private `hasTimePassed` and `toDateString` helpers):

```typescript
const notificationStateKey = 'cognipace:notification:lastNotifiedDate'

export async function readDueNotificationState(): Promise<{
  lastNotifiedDate: string | null
}> {
  const result = await browser.storage.local.get(notificationStateKey)
  const value = result[notificationStateKey]
  return { lastNotifiedDate: typeof value === 'string' ? value : null }
}

export async function writeDueNotificationState(date: string): Promise<void> {
  await browser.storage.local.set({ [notificationStateKey]: date })
}
```

- [ ] **Step 2: Run existing tests — should still pass (storage helpers are not called by them)**

```bash
TZ=UTC pnpm test src/extension/background/due-notification.test.ts
```

Expected: all tests pass.

### Part B: Wire up in `register-handlers.ts`

- [ ] **Step 3: Add the import for `createDueNotification` and storage helpers**

In `src/extension/background/register-handlers.ts`, add after the `import { createSyncAutoSync } from './sync-auto-sync'` line (around line 142):

```typescript
import {
  createDueNotification,
  readDueNotificationState,
  writeDueNotificationState,
} from './due-notification'
```

- [ ] **Step 4: Create the `dueNotification` instance at module level**

In `register-handlers.ts`, add after the `const syncAutoSync = createSyncAutoSync({...})` block (around line 165), before `export function registerBackgroundHandlers()`:

```typescript
const dueNotification = createDueNotification({
  now: () => new Date(),
  readSettings: async () => {
    const { db } = await getAppDb()
    return getSettings(db)
  },
  readQueueSummary: async () => {
    const { db } = await getAppDb()
    const queue = await getTodayQueue(db, new Date())
    return { dueCount: queue.dueCount }
  },
  readState: readDueNotificationState,
  writeState: writeDueNotificationState,
  notify: async (title, message) => {
    await browser.notifications.create('due-review-reminder', {
      type: 'basic',
      iconUrl: '/icons.svg',
      title,
      message,
    })
  },
  checkAlarmScheduled: async (name) => {
    const alarm = await browser.alarms.get(name)
    return alarm !== undefined
  },
  scheduler: alarmScheduler,
})
```

> **Note:** Chrome notifications may require a raster `iconUrl`. If `/icons.svg` doesn't render in the notification, check `public/` for an available PNG or add a `public/icon-48.png`. The WXT build serves `public/` assets at the extension root.

- [ ] **Step 5: Call `registerJobs` and `handleStartup` inside `registerBackgroundHandlers`**

In `registerBackgroundHandlers()`, after the existing `syncAutoSync.registerJobs()` and `void syncAutoSync.repairStartupAlarms()` lines (around line 168–169), add:

```typescript
dueNotification.registerJobs()
void dueNotification.handleStartup()
```

- [ ] **Step 6: Hook `onSettingsChanged` into `runSettingsMutation`**

The current `runSettingsMutation` (around line 1088) is:

```typescript
async function runSettingsMutation(
  source: 'popup' | 'dashboard',
  writeSettings: (db: Db) => Promise<UserSettings>,
) {
  return runDbMutation(writeSettings, () =>
    broadcastCacheInvalidation({
      reason: 'settings-updated',
      source,
      tags: ['settings'],
    }),
  )
}
```

Replace it with:

```typescript
async function runSettingsMutation(
  source: 'popup' | 'dashboard',
  writeSettings: (db: Db) => Promise<UserSettings>,
) {
  let prev: UserSettings | undefined
  return runDbMutation(
    async (db) => {
      prev = await getSettings(db)
      return writeSettings(db)
    },
    async (next) => {
      await broadcastCacheInvalidation({
        reason: 'settings-updated',
        source,
        tags: ['settings'],
      })
      if (prev !== undefined) {
        try {
          await dueNotification.onSettingsChanged(prev, next)
        } catch {
          // Notification rescheduling must not fail settings mutations.
        }
      }
    },
  )
}
```

- [ ] **Step 7: Type-check the full project**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 8: Run all tests**

```bash
TZ=UTC pnpm test
```

Expected: all tests pass including `due-notification.test.ts`.

- [ ] **Step 9: Commit**

```bash
git add src/extension/background/due-notification.ts \
        src/extension/background/register-handlers.ts
git commit -m "feat: wire up due-notification scheduler"
```

---

## Done

After Task 6, the feature is complete:
- `notifications` permission in manifest
- `normalizeNotificationTime` computes exact alarm delay, DST-safe
- `runDailyCheck` checks queue, deduplicates per day, notifies, reschedules
- `handleStartup` fires immediately if today's window passed, otherwise schedules
- `onSettingsChanged` reconciles alarm state on every settings mutation
- All logic is covered by unit tests with injected fakes
