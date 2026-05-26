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

### GitHub Gist Sync

1. Create a GitHub fine-grained or classic token with Gist access for a test
   account.
2. Open Settings > Data Management.
3. Save the token under GitHub Sync.
4. Create a private Gist, then use Pull latest and Push local.
5. Export a backup and confirm the token value is not present in the JSON.
6. Load CogniPace in a second Chrome profile or browser install.
7. Save the same token, connect the Gist ID, and use Pull latest.
8. Confirm clean remote data is restored locally.
9. Change local data while offline or with GitHub unavailable, then confirm the
   local save succeeds and Settings shows a retryable sync status.
10. Create a conflict by changing both installs before syncing, then confirm
    Pull latest is blocked when local data has unpushed changes and Push local
    requires overwrite confirmation before replacing changed remote data.

Expected: sync is pseudo-real-time rather than live collaborative editing.
Manual pulls and pushes are directional, local writes are not blocked by sync
failures, and tokens stay in trusted local extension storage rather than backups
or sync files.

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
- Analytics is a reserved dashboard route for future scheduling and reporting
  work.

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
npx prettier --check docs/product.md docs/architecture.md docs/testing.md
```

Focused tests:

```sh
npm run test -- <path-to-test-file>
```

Full verification:

```sh
npm run check
npm run format
```
