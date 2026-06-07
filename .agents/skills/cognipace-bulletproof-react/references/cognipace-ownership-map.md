# CogniPace Ownership Map

- Popup, dashboard, overlay, and background are separate runtime surfaces.
- Popup is the compact review-now and study-next command surface.
- Dashboard is the larger inspection and management surface for Library, Tracks, Settings, Overview, and Analytics.
- Overlay is the LeetCode in-page practice surface and page-capture bridge.
- Background is the trusted runtime boundary for DB access, sender authorization, service calls, sync, notifications, and invalidation.

- `src/app` is composition-only: routes, shells, providers, and surface wiring.
- `src/features/app-shell` owns surface read models and popup controller/view mapping.
- `src/features/analytics` owns read-only review-health models.
- `src/features/overlay-session` owns overlay workflow state, timer, draft fields, and review orchestration.
- `src/features/practice` owns FSRS-backed review scheduling writes.
- `src/features/settings` owns persisted preferences, defaults, validation, and settings form behavior.
- `src/features/sync` owns GitHub Gist sync rules, status, and directional pull/push behavior.
- `src/features/problems`, `src/features/tracks`, and `src/features/queue` own their product domains; `queue` stays a read/composition feature, not a write owner.
- `src/extension` owns runtime protocol, sender authorization, and background handler registration.
- `src/platform/db` owns SQLite setup, migrations, snapshot persistence, and seed data.

- Route popup changes through `src/app/popup` for shell wiring and `src/features/app-shell` for read models; keep popup components presentational.
- Route overlay changes through `src/app/overlay` for composition, `src/features/overlay-session` for workflow state, and `src/features/leetcode-capture` or `src/lib/leetcode` for page reads.
- Route runtime methods through feature contracts, `src/extension/messaging.ts`, runtime policy, handler registration, then the owning feature `server` or `data` layer.
- Route DB changes through `src/platform/db/schema/*` plus the owning feature repository; keep business writes in the owning feature `data` folder.
- Route sync changes through `src/features/sync`, with orchestration staying in the background runtime path.
- Route settings changes through `src/features/settings`; Settings UI should edit feature-owned form state, not browser APIs or unrelated repositories directly.
