# Testing

## Purpose

This guide is for friends and contributors testing CogniPace locally. It covers
loading the extension, trying the main workflows, clearing local data,
reporting useful bugs, and choosing validation commands.

## Local Setup

Install dependencies:

```sh
npm install
```

Start WXT for local development:

```sh
npm run dev
```

Build a Chrome MV3 extension:

```sh
npm run build
```

## Load The Extension In Chrome

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Choose Load unpacked.
4. Select `.output/chrome-mv3`.
5. After rebuilding, click the reload button for CogniPace in
   `chrome://extensions`.

The extension requests the Chrome `notifications` permission for local
due-review reminders. It does not add notification-related host permissions.
Due reminder smoke should use local queue `dueToday` semantics, not a separate
notification-specific count.

## Smoke Flows

### Open The Dashboard

Use one of these entry points:

- Open the dashboard from the CogniPace popup or extension UI when that action is
  available.
- Or open `chrome://extensions`, find CogniPace, open Details, copy the
  extension ID, and open `chrome-extension://<extension-id>/dashboard.html`.

### Popup

1. Click the CogniPace extension icon.
2. Confirm the popup shows the brand header, metric tiles, a recommendation
   area, and study-mode or track guidance.
3. Use the shuffle action when available.
4. Open Settings from the popup.
5. Open Tracks from the track card when available.

Expected: the popup stays compact, does not jump around during feedback, and
keeps recommendation guidance separate from track guidance.

### Dashboard Settings

1. Open the dashboard.
2. Navigate to Settings.
3. Change a setting.
4. Confirm the save bar appears.
5. Save the change.
6. Reload the dashboard and confirm the setting persisted.

Expected: settings changes save through the extension runtime and persist
locally.

### Settings Data Management

1. Open the dashboard.
2. Navigate to Settings.
3. Use Export backup.
4. Confirm a JSON file downloads and a success toast appears.
5. Use Choose backup file under Import full backup and select that exported
   file.
6. Confirm the selected filename, validation toast, and validation summary
   appear.
7. Confirm Restore full backup is not shown until validation succeeds, then
   cancel before restore unless intentionally testing destructive restore.
8. Open Clear local data.
9. Cancel once, then reopen if intentionally testing clear/reset behavior.

Expected: backup validation happens before restore, restore and clear require
confirmation, restore success resets the import card, and clear offers backup
first inside the confirmation dialog. After that backup export succeeds, the
dialog button changes to a success state labeled Backup exported.

### AI Assessment Settings

1. Open the dashboard.
2. Navigate to Settings.
3. Find AI assessment.
4. Select a provider and enter a model id.
5. Save and remove a test API key.
6. Confirm the UI shows key presence without revealing the key value.

Expected: provider keys are stored locally in trusted extension secret storage.
Configured AI assessment can call the approved BYOK provider from trusted
background code without revealing the key value. Backup exports, sync payloads,
logs, and status payloads must not include raw provider keys.

### Dashboard Dev Smoke

1. Open the dashboard.
2. Navigate directly to `chrome-extension://<extension-id>/dashboard.html#/dev/smoke`
   or open the hash-equivalent `/dev/smoke` route after loading the extension
   dashboard.
3. Confirm the hidden route renders even though it is absent from primary
   dashboard navigation.
4. Confirm the default smoke report includes background health, Analytics
   summary with memory profile, today's queue aliases, notification dry run,
   GenAI config, and skipped live GenAI checks.
5. Leave Run live GenAI provider smoke unchecked for normal smoke testing.
6. To intentionally test a live provider, first configure AI assessment with a
   provider, model, and local BYOK secret, then check Run live GenAI provider
   smoke.
7. Confirm the live check reports pass, warn, fail, or skip without showing raw
   provider keys or unredacted secret-bearing errors.

Expected: dev smoke is a local extension development tool only. The live GenAI
checkbox is opt-in because it may call the configured provider; it relies on
stored BYOK secret presence and must not expose secret values.

### GitHub Gist Sync

1. Create a GitHub fine-grained or classic token with Gist access for a test
   account.
2. Open Settings > Data Management.
3. In GitHub Sync, open Connect GitHub Sync.
4. Enter the token, confirm it is masked, use Test token, then Save token.
5. Create a private Gist or connect an existing Gist ID from the same dialog.
6. Close the dialog and confirm Settings shows Connected and Auto-sync on.
7. Use Push local from Settings.
8. Export a backup and confirm the token value is absent from the JSON.
9. Load CogniPace in a second Chrome profile or browser install.
10. Save the same token, connect the Gist ID, and use Pull latest.
11. Confirm the latest remote data is restored locally in the second install.
12. Confirm the dashboard header shows compact Pull latest from Gist and Push
    local to Gist shortcuts after sync is configured.
13. Pause auto-sync from Settings and confirm the connection remains connected
    while Settings and the dashboard header still allow manual Pull latest and
    Push local.
14. Resume auto-sync.
15. Open Manage connection, confirm the saved token appears masked, and use Test
    token without retyping the token.
16. Change local data in one install and confirm sync status shows it needs
    push.
17. Wait for the auto-push alarm or trigger it in development, then open or
    reload the second clean install.
18. Confirm the second clean install pulls the latest Gist data without a manual
    pull.
19. Use Push local from Settings or the dashboard header when an explicit manual
    upload is needed.
20. Use Pull latest in the other install when an explicit manual download is
    needed.
21. Create a conflict by changing both installs before syncing.
22. Confirm Pull latest opens a force-pull dialog when local data has unpushed
    changes, then cancel once before intentionally confirming.
23. Confirm force pull replaces the local data with the connected Gist data only
    after confirmation.
24. Confirm Push local opens a force-push dialog when remote data changed, then
    cancel once before intentionally confirming.
25. Confirm force push replaces the Gist with local data only after
    confirmation.

Expected: sync is pseudo-real-time, with automatic safe push and clean open-check
pulls plus manual directional pull and push actions for explicit recovery. Local
writes are not blocked by GitHub failures, destructive local and remote
overwrites require confirmation dialogs, and tokens stay in trusted local
extension storage rather than backups, sync files, status payloads, or unmasked
UI text.

### Library

1. Open the dashboard.
2. Navigate to Library.
3. Inspect problem rows.
4. Create or edit a problem.
5. Open problem details or practice actions when available.

Expected: Library reflects persisted problem metadata and remains usable after
reloading the extension.

### Tracks

1. Open the dashboard.
2. Navigate to Tracks.
3. Inspect the active track workspace.
4. Create or edit a track.
5. Set a track active.
6. Change the active group when more than one group exists.
7. Reset track progress only when intentionally testing reset behavior.

Expected: active track state, group state, problem order, and track progress are
local and update the dashboard without changing global practice history unless a
review is saved.

### Dashboard Analytics

1. Open the dashboard.
2. Navigate to Analytics.
3. Test 14, 30, and 90 days from the range control. Confirm their historical
   bucket labels are respectively daily, three-day, and weekly; the selected
   range stays selected unless you explicitly choose another one.
4. With enough eligible local history, confirm the historical chart story
   renders. If older leading buckets have no evidence, confirm the effective-
   window copy explains the usable part of the selected range rather than
   drawing a fabricated value from the range start.
5. For a range or metric that is not ready, confirm the compact warning
   identifies the evidence shortfall, reports its progress in buckets/
   assessments where applicable, and offers a shorter ready range only as an
   explicit link. The page must not silently switch ranges, and any available
   chart points must remain visible.
6. Check a line chart with missing-evidence gaps. It should use a dashed bridge
   from one measured point to the next valid point; absent buckets remain
   unknown and have no fabricated marker or tooltip value. A one-point chart
   remains visible with “Not enough data for a trend yet.”
7. In Practice Rhythm, confirm every bucket after the first supported practice
   bucket remains in the chart. A week with no reviews has zero review volume,
   while its correctness line remains unknown unless correctness evidence
   exists.
8. Confirm Recall Quality, Practice Rhythm, Ratings Mix, Where to Focus, and
   Memory Strength communicate their defined data meanings. Practice Rhythm is
   review volume plus observed correctness; it must not claim causation.
9. Confirm Recent Overdue Backlog has a watch zone at five problems: values at
   or below five render in the healthy green treatment, values above five use
   the attention yellow treatment, and its tooltip reports the bucket's
   threshold status. Unknown/reconstructable history must not be made up.
10. Confirm Upcoming Review Load always shows its fixed next 14 calendar days,
    including when the selected historical range is unready.
11. In Retention Health, hover and keyboard-focus a point to inspect the
    preview, pin its details, tab through the dialog controls, press Escape,
    and dismiss it by clicking outside. Confirm its LeetCode action opens the
    matching canonical problem in a new tab.
12. In Fragile Knowledge, confirm exactly five rows appear per page when there
    are more than five rows, Previous/Next and the live row range update
    correctly, and every visible problem link opens its canonical LeetCode
    problem in a new tab.
13. Exercise sparse and unknown history: verify readiness context rather than
    invented trends, while Recall Quality, Practice Rhythm, Memory Strength,
    Recent Overdue Backlog, Retention Health, Fragile Knowledge, and Upcoming
    Review Load remain usable. Repeat the happy path and sparse path at a narrow dashboard
    width; charts, range controls, dialogs, table scrolling, and keyboard focus
    must remain usable.

Expected: Analytics loads through the extension runtime without the failed-load
state, reflects only local practice data, and tells a truthful chart story
without filling missing evidence.

For this dashboard behavior change, the human engineer must attach screenshot
or screen-recording proof of both the ready-history happy path and the sparse or
unready edge path before PR review or merge. This is required by
`docs/agent-governance.md`; automated checks do not replace real-time extension
smoke testing.

### LeetCode Overlay

1. Open a LeetCode problem page in Chrome.
2. Confirm the CogniPace overlay appears after page context is read.
3. Start, pause, and reset the timer.
4. Expand the overlay.
5. Select a rating or use fail.
6. Submit or update a review.
7. Dock and restore the overlay.

Expected: the overlay remains recoverable, does not dominate the LeetCode page,
and saved review results update CogniPace state.

### Cross-Surface Refresh

1. Save a review from the overlay.
2. Open the popup.
3. Open the dashboard.

Expected: due counts, recommendation state, practice details, and track progress
refresh across surfaces.

## Current Incomplete Surfaces

- Overview is a reserved dashboard route for a future guided-practice home.

Do not report these as broken unless they stop rendering or navigation fails.

## Clear Local Data

Use this when testing from a clean CogniPace local state. Local test data is
disposable during development.

Use Settings > Data Management > Clear local data for an in-app fresh-install
clear/reset. Removing and reloading the extension remains useful when testing
extension installation behavior.

Schema and migration changes may reset local extension data during development.

## Troubleshooting

### Extension Does Not Load

- Run `npm run build`.
- Confirm `.output/chrome-mv3` exists.
- Reload the unpacked extension in `chrome://extensions`.
- Inspect the extension service worker console from `chrome://extensions`.

### Popup Or Dashboard Shows Stale Data

- Reload the extension.
- Reload the dashboard tab.
- Check the service worker console for runtime or database errors.

### Overlay Does Not Appear On LeetCode

- Confirm the tab is a LeetCode problem page.
- Reload the LeetCode tab after reloading the extension.
- Check the page console and extension service worker console.

### Database Or Migration Errors

- Run `npm run db:check`.
- Reset local extension data.
- Rebuild and reload the extension.

## Useful Bug Reports

Include:

- surface: popup, dashboard, overlay, or background
- exact steps
- expected behavior
- actual behavior
- screenshots or screen recording when visual behavior matters
- browser console errors
- extension service worker errors
- whether local data was reset before the test

## Validation Commands

Docs-only formatting:

```sh
npx prettier --check README.md docs/product.md docs/architecture.md docs/testing.md docs/superpowers/README.md
```

Focused tests:

```sh
npm run test -- <path-to-test-file>
```

GitHub Gist sync focused checks:

```sh
npm test -- src/features/sync/server/sync-service.test.ts src/features/sync/api/sync-api.test.tsx src/extension/background/register-handlers.test.ts src/extension/background/runtime-policy.test.ts src/features/sync/hooks/use-github-sync-controller.test.tsx src/features/sync/components/github-sync-panel.test.tsx src/features/sync/components/github-sync-connection-dialog.test.tsx src/features/sync/components/dashboard-sync-actions.test.tsx --run
```

Topic graph focused checks:

```sh
npm test -- src/testing/db-foundation.test.ts --run
npm test -- src/features/problems/data/problems-repository.test.ts --run
npm test -- src/features/backup/api/backup-contracts.test.ts src/features/backup/data/backup-repository.test.ts src/features/backup/server/backup-service.test.ts --run
```

Run the overlay capture check when validating captured LeetCode page topic
merges:

```sh
npm test -- src/features/overlay-session/hooks/use-leetcode-overlay-session.test.tsx --run
```

Final topic graph validation:

```sh
npm test -- src/testing/db-foundation.test.ts src/features/problems/data/problems-repository.test.ts src/features/problems/api/problems-contracts.test.ts src/features/overlay-session/hooks/use-leetcode-overlay-session.test.tsx src/features/backup/api/backup-contracts.test.ts src/features/backup/data/backup-repository.test.ts src/features/backup/server/backup-service.test.ts --run
npm run db:check
npm run check
```

Full verification:

```sh
npm run check
npm run format
```
