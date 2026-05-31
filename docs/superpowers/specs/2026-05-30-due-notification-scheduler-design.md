# Due-Notification Scheduler Design

**Issue:** #17  
**Date:** 2026-05-30  
**Status:** Ready for implementation

## Overview

Add a local daily reminder that fires one browser notification per day when the user has due reviews waiting. The scheduler lives entirely in the extension background, uses `chrome.alarms` for timing and `chrome.storage.local` for dedup state, and reads queue data through the existing queue service as a black box.

## Architecture

### Boundaries

- All Chrome side effects (`chrome.alarms`, `chrome.notifications`, `chrome.storage.local`) are isolated inside `src/extension/background/`
- The notification module never imports `src/lib/fsrs` or reads raw card/attempt tables — queue data arrives through an injected `readQueueSummary` dep wired to `getTodayQueue(db, now)` at the call site
- React components have no involvement — this is a pure background concern

### New files

```
src/extension/background/
  due-notification.ts        ← factory module
  due-notification.test.ts   ← unit tests
```

### Modified files

- `src/extension/background/register-handlers.ts` — wire up the module, call `registerJobs()`, `handleStartup()`, and `onSettingsChanged` from the settings update handler
- `wxt.config.ts` — add `"alarms"` and `"notifications"` to manifest permissions

## Module Shape

`createDueNotification(deps)` follows the `createSyncAutoSync` pattern: a factory that receives all IO dependencies and returns named functions.

```typescript
type DueNotificationDeps = {
  now: () => Date
  readSettings: () => Promise<Pick<UserSettings, 'reminders'>>
  readQueueSummary: () => Promise<{ dueCount: number }>
  readState: () => Promise<{ lastNotifiedDate: string | null }>
  writeState: (date: string) => Promise<void>
  notify: (title: string, message: string) => Promise<void>
  scheduler: Pick<AlarmScheduler, 'clear' | 'register' | 'schedule'>
}
```

Returned surface:

| Function | Responsibility |
|---|---|
| `registerJobs()` | Registers `due:daily-check` with the `AlarmScheduler` — call once at startup |
| `handleStartup()` | Ensures alarm is in the correct state on extension load |
| `onSettingsChanged(prev, next)` | Reconciles alarm state when reminder settings change |
| `runDailyCheck()` | Alarm's `run()` handler — dedup, queue check, notify, reschedule |

### Wire-up in `register-handlers.ts`

```typescript
const dueNotification = createDueNotification({
  now: () => new Date(),
  readSettings: () => getSettings(db),
  readQueueSummary: async () => {
    const q = await getTodayQueue(db, new Date())
    return { dueCount: q.dueCount }
  },
  readState: readDueNotificationState,
  writeState: writeDueNotificationState,
  notify: (title, message) =>
    browser.notifications.create({ type: 'basic', iconUrl: '...', title, message }),
  scheduler,
})

dueNotification.registerJobs()
await dueNotification.handleStartup()

// inside settings.update handler, after applying the patch:
await dueNotification.onSettingsChanged(prevSettings, nextSettings)
```

## Core Logic

### `normalizeNotificationTime(time: string, now: Date): number`

A pure helper that returns `delayInMinutes` to the next occurrence of an `HH:mm` wall-clock time:

1. Parse `HH:mm` into hours and minutes
2. Construct a `Date` for today at that time (same timezone as `now`)
3. If `target > now` → return `Math.ceil((target - now) / 60_000)`
4. Otherwise → return `Math.ceil((target + 24h - now) / 60_000)`

This is the only scheduling math in the feature. All other functions call it.

### `runDailyCheck()`

The alarm's `run()` function. Called by the scheduler when `due:daily-check` fires.

1. Read settings — if `reminders.daily.enabled` is false, bail without rescheduling (alarm lifecycle when disabled is owned by `onSettingsChanged`)
2. Read dedup state — if `lastNotifiedDate === today (YYYY-MM-DD)`, skip notification but still reschedule
3. Call `readQueueSummary()` — if `dueCount > 0`: call `notify(title, message)` and `writeState(today)`
4. Reschedule: `scheduler.schedule('due:daily-check', { delayInMinutes: normalizeNotificationTime(time, now()) })`

### `handleStartup()`

Called once when the extension background starts.

1. Read settings — if `reminders.daily.enabled` is false, return
2. Check whether `due:daily-check` alarm already exists — if yes, return (don't disturb a running alarm)
3. If alarm is missing:
   - If `dailyTime` has **already passed** today → call `runDailyCheck()` immediately (handles dedup, notification, and reschedule)
   - If `dailyTime` is still upcoming → `scheduler.schedule('due:daily-check', { delayInMinutes: normalizeNotificationTime(time, now()) })`

### `onSettingsChanged(prev, next)`

Diffs only `reminders.daily` between old and new settings:

| Change | Action |
|---|---|
| `enabled` toggled off | `scheduler.clear('due:daily-check')` |
| `enabled` toggled on | `handleStartup()` (schedules or fires immediately) |
| `time` changed while enabled | `scheduler.clear('due:daily-check')` then `scheduler.schedule(...)` with new delay |
| No relevant change | no-op |

## Dedup State

Stored in `chrome.storage.local` under a namespaced key (e.g., `cognipace:notification:lastNotifiedDate`). Value is an ISO date string (`"2026-05-30"`) or absent.

Two private helpers in `due-notification.ts`:
- `readDueNotificationState(): Promise<{ lastNotifiedDate: string | null }>`
- `writeDueNotificationState(date: string): Promise<void>`

These wrap `chrome.storage.local.get/set` directly — same pattern as `sync-metadata-store.ts`.

## Testing Strategy

All tests in `due-notification.test.ts` using vitest and fake adapters (following `alarm-scheduler.test.ts` patterns).

### `normalizeNotificationTime` (pure unit tests)
- Time is in the future today → correct positive delay
- Time already passed today → delay wraps to tomorrow (> 0)
- Exactly on the current minute → treated as passed, returns ~24h delay

### `runDailyCheck`
- Notifications disabled → bails, no `notify` call, no reschedule
- Already notified today → no `notify` call, still reschedules
- `dueCount === 0` → no `notify`, reschedules
- `dueCount > 0`, no dedup match → calls `notify`, writes today's date, reschedules
- Reschedule always passes result of `normalizeNotificationTime` as `delayInMinutes`

### `handleStartup`
- Alarm already exists → no-op
- Notifications disabled → no-op
- Time still upcoming → schedules alarm, does not call `runDailyCheck`
- Time already passed → calls `runDailyCheck` (which handles notify + reschedule)

### `onSettingsChanged`
- Toggle off → alarm cleared
- Toggle on → delegates to `handleStartup`
- Time changed while enabled → clears old alarm, schedules at updated time
- No relevant change → no-op

### Architecture test
- Static import graph of `due-notification.ts` must not include `src/lib/fsrs` — validated at the module boundary, not through the injected dep

## Settings Schema

No changes needed. `settings.reminders.daily.{ enabled: boolean, time: HH:mm }` already exists in `src/features/settings/domain/settings.ts`.

## Permissions

Add to manifest in `wxt.config.ts`:
```json
"permissions": ["alarms", "notifications"]
```

No host permissions required.

## Constraints

- One notification per day maximum (dedup via local date key)
- No server push, sync, or external provider — local-only
- Never import `src/lib/fsrs` in the notification module
- React components must not invoke `chrome.notifications` or `chrome.alarms` directly
