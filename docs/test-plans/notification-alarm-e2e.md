# Notification Alarm End-to-End Test Plan

This plan verifies the local due-notification flow for CogniPace v2. It covers
the WXT build, Chrome extension alarm state, and real notification delivery.
Run these steps after `#17` (scheduler) and `#18` (notification preferences)
are merged.

## Status

| Step | Result |
|---|---|
| **Option C — direct notification delivery** | ✅ Executed. Service worker console call confirmed Chrome permissions are granted and notifications appear correctly. |
| **Full alarm-flow (Steps 5–10)** | ⏸ Deferred. Steps 5–10 require a Chrome build with at least one FSRS-scheduled problem whose due date has passed. Deferred until a test environment with real due data is available. |

## Prerequisites

- Node.js installed; run `npm install` if you have not already.
- Chrome with Developer mode enabled (`chrome://extensions` → Developer mode on).
- macOS: confirm that Chrome notifications are allowed in System Settings →
  Notifications → Google Chrome.

## 1. Build the Extension

```sh
npm run build
```

The output should be at `.output/chrome-mv3`.

## 2. Load the Unpacked Extension

1. Open `chrome://extensions`.
2. Click **Load unpacked**.
3. Select `.output/chrome-mv3`.
4. Confirm CogniPace appears in the list without errors.

## 3. Confirm Notification Permission is Granted

1. On the CogniPace extension card, click **Details**.
2. Open the extension's service worker DevTools: click **Service worker** or
   **Inspect views: service worker**.
3. In the Console, run:

   ```js
   chrome.notifications.getPermissionLevel(level => console.log(level))
   ```

   Expected: `granted`.

## 4. Seed at Least One Due Review

Pick whichever option fits your situation. Options A and B test the full
end-to-end alarm flow. Option C isolates notification delivery only.

**Option A — use existing due data (quickest):**

1. Open the CogniPace popup or dashboard.
2. Confirm at least one problem shows in the queue with a **due** status.
   Problems that have never been reviewed do not count — `dueCount` only
   includes FSRS-scheduled reviews whose due date has passed.
3. Skip to Step 5 and set the reminder time 1–2 minutes from now.

**Option B — answer a question then backdate its due date:**

1. Open the popup or dashboard and complete a practice session with any problem
   so that an FSRS card entry is created for it.
2. Open the dashboard → **Settings** → **Data Management** → **Export backup**.
   A JSON file downloads.
3. Open the JSON file, find the card entry for that problem, and set its `dueAt`
   field (a Unix timestamp in milliseconds) to any timestamp in the past
   (e.g., yesterday at midnight: `Date.now() - 86_400_000`).
4. Import and restore the edited backup via **Import full backup** →
   **Restore full backup**.
5. Open the queue in the popup or dashboard and confirm the problem now appears
   as due.

**Option C — verify notification delivery directly via the service worker (skips alarm and queue):**

If you only want to confirm that Chrome and macOS will show notifications from
this extension, open the service worker DevTools Console and run:

```js
chrome.notifications.create('due-review-reminder', {
  type: 'basic',
  iconUrl: '/icons.svg',
  title: 'Reviews due',
  message: 'You have 3 reviews due today.'
})
```

Expected: a notification appears immediately. This bypasses the scheduler and
queue entirely — use it to rule out permission or OS-level issues, then return
to Option A or B for the full alarm flow.

## 5. Enable Reminders and Set Time a Few Minutes Ahead

> Skip this step if you used Option C above.

1. Open the dashboard → **Settings** → **Notifications**.
2. Enable daily reminders if not already enabled.
3. Set the reminder time to **1–2 minutes from now** (e.g., if it is 14:57,
   set 14:58 or 14:59).
4. Save the setting.

## 6. Inspect the Chrome Alarm State

In the service worker DevTools Console:

```js
chrome.alarms.getAll(alarms => console.log(alarms))
```

Expected: an alarm named `due:daily-check` appears in the list with a
`scheduledTime` matching roughly the time you set.

## 7. Wait and Confirm a Notification Appears

Wait until the alarm fires (the time you configured). Expected behavior:

- A Chrome notification appears with the title **"Reviews due"** and a body
  such as **"You have N review(s) due today."**
- The notification uses the CogniPace icon.

If no notification appears within 30 seconds of the scheduled time:

- Check the service worker Console for errors.
- Confirm macOS notification permissions are still granted.
- Confirm the alarm is still present with `chrome.alarms.getAll`.

## 8. Confirm Duplicate Suppression on the Same Date

1. Re-open the service worker Console.
2. Manually trigger the daily check:

   ```js
   chrome.alarms.create('due:daily-check', { delayInMinutes: 0 })
   ```

3. Wait a few seconds.

Expected: **no second notification** appears. The `lastNotifiedDate` key in
local storage should match today's ISO date (`YYYY-MM-DD`).

Verify with:

```js
chrome.storage.local.get('cognipace:notification:lastNotifiedDate', d => console.log(d))
```

## 9. Confirm No Notification Appears When No Due Work Exists

1. Open the dashboard and mark all due problems as reviewed (or use a fresh
   profile with no problems).
2. In the service worker Console, fire a manual check:

   ```js
   // Clear the dedup key so suppression doesn't hide the result
   chrome.storage.local.remove('cognipace:notification:lastNotifiedDate')
   chrome.alarms.create('due:daily-check', { delayInMinutes: 0 })
   ```

Expected: no notification appears, because `dueCount` is 0.

## 10. Confirm Disabling Reminders Clears the Alarm

1. Open Settings → Notifications.
2. Disable daily reminders.
3. Save.
4. In the service worker Console:

   ```js
   chrome.alarms.getAll(alarms => console.log(alarms))
   ```

Expected: `due:daily-check` is **not** in the list.

## 11. Cleanup

1. Re-enable or disable reminders as appropriate for your test environment.
2. Clear the dedup key if you want a fresh state:

   ```js
   chrome.storage.local.remove('cognipace:notification:lastNotifiedDate')
   ```

3. If testing on a profile you want to reset, use the dashboard's
   **Clear local data** option under Settings → Data Management.

## Automated Tests

The automated suite covers scheduler helper logic and background wiring without
requiring a real browser. Run with:

```sh
npm run test -- src/extension/background/due-notification src/extension/background/scheduler/alarm-scheduler src/extension/background/register-handlers
```

Or run the full check (typecheck + lint + tests):

```sh
npm run check
```

Key automated coverage:

| Area | File |
|------|------|
| Time normalization, dedup, notify, reschedule | `due-notification.test.ts` |
| Alarm create/clear/dispatch/repair/dispose | `alarm-scheduler.test.ts` |
| Startup wiring (registerJobs + handleStartup) | `register-handlers.test.ts` |
| Architecture boundary (no FSRS imports in notification code) | `architecture-boundaries.test.ts` |
