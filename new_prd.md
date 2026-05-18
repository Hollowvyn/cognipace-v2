# CogniPace Rebuild Product Requirements

Date: 2026-05-18

Status: Greenfield rebuild PRD and product inventory.

This document describes what CogniPace is, what the app must do, how every current surface behaves, and how to rebuild the product from scratch without copying the current source architecture. The behavior is the product contract. The current implementation is useful evidence, not a mandate.

## Source Inputs

External engineering references used for greenfield stack options:

- [Bulletproof React](https://github.com/alan2207/bulletproof-react/tree/master)
- [Bulletproof React project structure](https://raw.githubusercontent.com/alan2207/bulletproof-react/master/docs/project-structure.md)
- [Bulletproof React project standards](https://raw.githubusercontent.com/alan2207/bulletproof-react/master/docs/project-standards.md)
- [Bulletproof React API layer](https://raw.githubusercontent.com/alan2207/bulletproof-react/master/docs/api-layer.md)
- [Bulletproof React state management](https://raw.githubusercontent.com/alan2207/bulletproof-react/master/docs/state-management.md)
- [Bulletproof React components and styling](https://raw.githubusercontent.com/alan2207/bulletproof-react/master/docs/components-and-styling.md)
- [WXT official docs](https://wxt.dev/)
- [Plasmo official docs](https://docs.plasmo.com/)
- [CRXJS official docs](https://crxjs.dev/guide/introduction/)
- [Chrome MV3 service worker docs](https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers)
- [Chrome content scripts docs](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- [Chrome storage API docs](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [Radix Primitives docs](https://www.radix-ui.com/primitives/docs/overview/introduction)
- [shadcn/ui component docs](https://ui.shadcn.com/docs/components)

## 1. Product Description

CogniPace is a Chrome extension for deliberate LeetCode interview practice. It helps users answer two daily questions quickly:

1. What should I review right now so I do not forget solved problems?
2. What should I study next so I keep progressing through a curated path?

The app combines spaced repetition, curated interview-prep tracks, and an in-page LeetCode overlay. It is not a full SaaS platform. It is a compact browser tool that stays close to the user's actual LeetCode workflow.

The user opens the popup to get immediate guidance, solves or reviews a LeetCode problem with the overlay, logs the result, and uses the dashboard only when they need a broader control surface for tracks, library, analytics, settings, backup, or reset.

## 2. Product Principles

- Extension-first: the primary product is a browser extension, not a hosted web app.
- Local-first: user data is owned locally by the extension.
- No account by default: no auth, profiles, subscriptions, cloud sync, or backend.
- Retention plus progression: due review and active-track next problem must both remain visible.
- Compact and direct: common flows should take one or two actions.
- LeetCode-native: support the LeetCode problem page instead of replacing it.
- Operational design: technical, compact, low-fluff, and optimized for repeated use.
- Explicit scope: future ideas are not MVP commitments.

## 3. Rebuild Rationale And Engineering Mandate

This rebuild exists because the current path proved that shipping features is
not enough if the app cannot stay clean, predictable, and easy to extend. The
new implementation is a cleanliness reset. The goal is not to recreate the same
architecture with different files; the goal is to build the same product with a
clearer structure, better library choices, and stronger engineering patterns so
future work moves faster.

The rebuild must follow the spirit of Bulletproof React:

- Organize by feature, not by broad technical buckets.
- Keep shared code genuinely shared.
- Keep application composition at the app layer.
- Keep feature modules independent and avoid cross-feature imports.
- Enforce one-way dependencies: shared code can be used by features and app;
  features can be composed by app; features should not import app code.
- Make project standards enforceable through TypeScript, ESLint, Prettier,
  tests, and import rules.
- Prefer direct imports and clear public APIs over broad barrel files that hide
  dependency direction.

The rebuild must use stable third-party libraries for solved problems. Do not
hand-roll common infrastructure such as routing, tables, forms, validation,
query caching, dialogs, popovers, tabs, switches, sliders, date utilities,
state machines, or scheduling algorithms unless no stable library fits the
extension constraints.

Custom code should focus on CogniPace product logic:

- FSRS review policy integration.
- LeetCode page context mapping.
- Track progression rules.
- Queue recommendation policy.
- Local persistence orchestration.
- Extension runtime authorization.
- Product-specific view models.

Third-party libraries should be wrapped behind thin app adapters when that
protects the product from churn. The wrapper should not become a custom
framework; it should normalize library usage, naming, styling, and error
handling for CogniPace.

## 4. Recommended Source Structure

The greenfield source tree should start close to Bulletproof React and then add
extension-specific runtime folders deliberately.

Recommended shape:

```txt
src/
  app/
    providers/
    routes/
    popup/
    dashboard/
    overlay/
  assets/
  components/
    ui/
    layout/
    feedback/
  config/
  extension/
    background/
    content/
    manifest/
  features/
    analytics/
    backup/
    problems/
    queue/
    settings/
    study/
    tracks/
    overlay-session/
  hooks/
  lib/
    fsrs/
    leetcode/
    runtime-rpc/
  platform/
    chrome/
    db/
    time/
  stores/
  testing/
  types/
  utils/
```

Feature folders should use only the subfolders they need:

```txt
src/features/<feature>/
  api/
  components/
  hooks/
  stores/
  types/
  utils/
  server/
```

Folder responsibilities:

- `app`: surface composition, providers, route wiring, shell-level view models.
- `features`: product capabilities and feature-scoped UI.
- `components`: shared reusable UI only.
- `lib`: app-owned integrations and pure library adapters.
- `platform`: browser, Chrome, SQLite, filesystem-like, and time adapters.
- `extension`: MV3 service worker, content-script bootstraps, manifest wiring.
- `testing`: render helpers, fixtures, mocks, and extension test utilities.

Import direction:

```txt
components/config/hooks/lib/platform/types/utils
  -> features
  -> app
  -> extension entry composition
```

Rules:

- Features do not import from `app`.
- Features do not deep-import other feature internals.
- App composes features.
- Runtime handlers depend on feature server APIs, not feature UI.
- Domain utilities stay React-free.
- UI calls feature repositories or hooks, not raw Chrome APIs.

## 5. Target Users

Primary user:

- A technical interview candidate already using LeetCode.
- Wants more structure than random problem browsing.
- Wants to retain solved problems instead of only grinding new ones.
- Uses curated lists such as Blind 75, NeetCode-style paths, or pattern tracks.
- Wants guidance in the browser without logging into another study platform.

Secondary user:

- A repeat interviewer brushing up weak areas.
- A user tracking progress across topics, companies, and curated tracks.
- A user who wants local data portability through export/import, not cloud sync.

## 6. Core User Problems

Interview prep usually fails in one of two ways:

- Random grind: users solve many problems but forget the patterns.
- Curated list tunnel vision: users progress through a list but do not revisit old work at the right time.

CogniPace solves this by keeping two loops active:

- Review loop: FSRS-backed spaced repetition recommends due or weak problems.
- Progression loop: active track traversal shows the next unstarted problem.

## 7. Product Scope

### MVP Scope

The rebuild MVP must include:

- Chrome MV3 extension.
- Popup recommendation flow.
- LeetCode problem-page overlay.
- Dashboard with five pages: Overview, Tracks, Library, Analytics, Settings.
- Route-backed create/edit problem dialog.
- Reset study history confirmation dialog.
- Local SQLite/Drizzle persistence with backup export/import.
- FSRS scheduling and retrievability.
- Curated tracks and active track progression.
- Optional local notifications.
- Basic analytics from local data.
- Minimal extension permissions.

### Out Of Scope For MVP

Do not include these without explicit product approval:

- User accounts.
- Authentication.
- Backend service.
- Cloud sync.
- Team or shared workspaces.
- Generic SaaS dashboard behavior.
- Mobile app behavior.
- Paid subscription or remote billing.
- Broad extension permission expansion.
- AI provider/API-key handling.
- Auto-submission hooking that inspects code/results.
- Multi-language FSRS cards as a visible user-facing feature.

### Future Candidates

These are useful but not MVP:

- Deterministic LeetCode submit-result capture.
- Smart recommended assessment engine.
- GenAI-assisted log filling.
- Multi-language or multi-variant FSRS cards.
- Richer analytics with heatmaps and topic trends.
- Visual regression testing pipeline.
- Company-based study paths.
- Scoped progress reset per track or company.

## 8. Success Criteria

The MVP succeeds when a user can:

- Open the popup and immediately understand the best next review target.
- See the next active-track problem without opening the dashboard.
- Open a recommended or track problem in LeetCode.
- Use the overlay to time a solve, record notes, submit a review, fail a review, update the latest result, and restart a local session.
- Preserve structured logs with the associated problem.
- Use the dashboard to inspect overall status, tracks, library, analytics, settings, and backup.
- Export and import local data.
- Configure target retention, review ordering, timer goals, premium filtering, and notifications.
- Keep all data local unless they manually export it.

## 9. Core Concepts

### Problem

A LeetCode problem normalized by slug.

Required fields:

- `slug`
- `title`
- `difficulty`: Easy, Medium, Hard, Unknown
- `url`
- `isPremium`
- topics
- companies
- user-edited metadata flags

### Study State

The user's review state for a problem.

Required fields:

- suspended flag
- tags
- best solve time
- last solve time
- last rating
- FSRS card state
- structured log fields
- attempt history

MVP can keep one FSRS card per problem. A better greenfield schema should be V2-ready by making the FSRS card a separate table with a default variant, while only exposing one default card in MVP.

### Attempt

A review event.

Required fields:

- reviewed timestamp
- rating: Again, Hard, Good, Easy
- optional solve time
- review mode: full solve or recall
- structured log snapshot

### Track

A curated or custom study path.

Required fields:

- track id
- name
- description
- enabled flag
- curated flag
- ordered groups
- ordered problem memberships

### Track Group

A chapter or section inside a track.

Required fields:

- group id
- track id
- name
- description
- topic association where available
- order index
- ordered problem list

### Active Track Session

The currently focused track. This must be separate from general settings because track selection is a tracks-domain concern.

### Queue

The generated daily work list.

Queue categories:

- due: reviewed cards below target retention
- new: never-started problems
- reinforcement: reviewed but not yet due

### Study Modes

- Study plan: user follows active track plus review queue.
- Freestyle: user follows queue priority without advancing track progression as the primary prompt.

## 10. Product Surfaces

CogniPace has four product surfaces:

- Popup: primary next-action surface.
- LeetCode overlay: in-page timing and review logging surface.
- Dashboard: secondary control surface with five pages.
- Background service worker: non-visual runtime, persistence, scheduling, notifications, and RPC boundary.

## 11. Popup PRD

### Purpose

Give the user the fastest possible answer to what to do next.

The popup is the primary MVP surface and should remain compact.

### Layout

Fixed-width, single-column popup with:

1. Header
2. Optional surface status
3. Metrics row
4. Recommendation panel
5. Active-track panel

### Header

Header includes:

- CogniPace brand mark.
- Refresh icon button.
- Settings icon button.

Actions:

- Refresh reloads popup data and resets local recommendation shuffle index.
- Settings opens dashboard Settings.

### Metrics

Show exactly two metrics in MVP:

- Due Today
- Streak

Loading state:

- Show placeholder values while initial payload loads.

### Recommendation Panel

Purpose:

- Show the current best review target.

Content when active:

- Label: Recommended Now.
- Problem title.
- Difficulty badge.
- Reason chip.
- Optional "also next in track" chip if recommendation equals track next.
- Open Problem action.
- Shuffle icon if there are multiple candidates.
- Helper text explaining that shuffle only changes the recommendation pool.
- Reserved inline status region.

Empty state:

- Title: Queue Clear.
- Copy should explain there is no review pressure right now.
- Suggest continuing active track or refreshing after another session.

Loading state:

- Title: Loading Queue.
- Copy should explain recommendation data is loading.

Behavior:

- Recommendation comes from a candidate pool.
- Shuffle rotates local candidate index only.
- Shuffle must not mutate server state.
- Shuffle must not alter active-track next problem.
- Open Problem opens the LeetCode problem page.
- Opening a recommendation without track context should scope failures to recommendation status.

Implementation note for rebuild:

- Ensure "also next in track" is computed server-side when the recommendation matches active-track next. Current code has the view flag but does not pass active-track-next into candidate generation.

### Active-Track Panel

Purpose:

- Show current guided-study state separately from review recommendation.

Panel states:

- Loading track.
- Freestyle mode.
- No active track.
- Track complete.
- Study plan with next problem.

Loading:

- Show "Fetching track context."
- Include dashboard shortcut.

Freestyle:

- Show that freestyle mode is active.
- Keep track context visible.
- Primary action: Start study mode.
- Secondary action: open Tracks dashboard.

No active track:

- Explain no guided track is active.
- Primary action: Start freestyle mode.
- Secondary action: open Tracks dashboard.

Track complete:

- Show active track name.
- Explain the path is complete.
- Primary action: Start freestyle mode.
- Secondary action: open Tracks dashboard.

Study plan:

- Show active track name.
- Show track description where available.
- Show completion percent.
- Show progress bar.
- Show completed/total count.
- Show Up Next inset with next problem title and continue action.
- Primary action: Start freestyle mode.
- Secondary action: open Tracks dashboard.

Mode switching:

- Mode actions must be explicit: Start study mode, Start freestyle mode.
- Apply pending local feedback immediately.
- Persist through settings.
- Block repeat writes while saving.
- Roll back to persisted mode if save fails.
- Show inline error scoped to the track panel.

### Popup Acceptance Criteria

- User can tell what to review now.
- User can tell what is next in active track.
- Review recommendation and track progression are visually separate.
- Shuffle only rotates recommendation.
- Mode switching is explicit and rollback-safe.
- Empty states remain useful and compact.
- Popup does not become a mini-dashboard.

## 12. LeetCode Overlay PRD

### Purpose

Let users log practice while staying on the LeetCode problem page.

The overlay is supportive, not dominant. It should remain compact, recoverable, and safe to ignore.

### Rendering Conditions

Render only on valid LeetCode problem pages.

If no problem slug can be read:

- Clear active local overlay session.
- Render nothing.

### Bootstrap Behavior

On problem page:

1. Derive slug from URL.
2. Read DOM snapshot for title, difficulty, premium state.
3. Upsert problem into local DB.
4. Fetch problem context.
5. Fetch settings and app-shell payload.
6. Apply study state and settings.
7. Schedule warm refreshes to catch late LeetCode hydration.
8. Watch SPA navigation and prevent stale async responses from overwriting current problem.

### Overlay States

The overlay has three visual states:

- Collapsed.
- Expanded.
- Docked.

There is no fully hidden unrecoverable state. "Hidden" means docked to a narrow right-edge trigger.

### Collapsed Overlay

Default state after problem activation.

Content:

- Expand button.
- Hide/dock button.
- Timer display.
- Start/pause button.
- Reset timer button.
- Submit quick-review button.
- Fail review button.
- Reserved helper text.
- Optional feedback surface.

Behavior:

- Timer is the visual priority.
- Submit uses quick-rating heuristic.
- Fail submits Again.
- Submit/fail are disabled after a saved submission.
- Expand remains available after submission.
- Hide saves dirty structured draft and moves to docked state.

### Expanded Overlay

Full review form.

Sections:

- Header controls.
- Status cards.
- Timer card.
- Assessment rail.
- Structured log fields.
- Action buttons.
- Post-submit next-step preview.

Header controls:

- Collapse.
- Open settings.
- Hide/dock.
- Problem title.
- Difficulty.
- Session label.
- Review status cards.

Status cards should communicate:

- First solve vs recall session.
- Last review or empty status.
- Next due or current status.

Outside click:

- Pointer down outside overlay saves changed structured draft fields.
- Then collapses the overlay.

### Docked Overlay

Purpose:

- Hide the main overlay without making it unrecoverable.

Content:

- Narrow right-edge trigger.
- Compact brand mark.
- Tooltip: Show overlay.

Behavior:

- Click restores to collapsed state.
- Dragging vertically moves dock during current docked session.
- Drag is vertical-only.
- Drag offset is viewport-clamped.
- Dragging must suppress click restore.
- Dock position does not need to persist across reloads for MVP.

### Timer

Timer behavior:

- Local to current overlay session.
- Start, pause, reset.
- Read latest elapsed value at submit time.
- Submitting while running pauses timer.
- Reset and pause are blocked after submission.
- Starting after submission restarts a fresh local session first.
- Collapsed view shows elapsed time.
- Expanded view shows elapsed time and target time.

Target time:

- Easy, Medium, Hard goals come from settings.
- Unknown difficulty uses Hard goal.

Solve-time settings:

- If solve time is required and no timer value exists, save should fail with clear feedback.
- If Hard Mode is on and elapsed time exceeds target, assessment is forced to Again.
- If Hard Mode is off and quick submit exceeds target, quick submit maps to Hard.

### Assessment

Ratings:

- Again = 0.
- Hard = 1.
- Good = 2.
- Easy = 3.

Assessment rail:

- Four exclusive choices.
- Defaults to last rating for existing review context, otherwise Good.
- Failed session locks selected rating to Again until restart.
- Hard Mode overtime locks selected rating to Again until restart.
- Helper text must explain why selected/locked rating applies.

Review modes:

- First review uses full solve.
- Existing reviewed problem uses recall.

### Structured Log Fields

Fields:

- Interview pattern.
- Time complexity.
- Space complexity.
- Languages used.
- Notes.

Requirements:

- Editable before submit.
- Editable after submit.
- Clear affordance for populated fields.
- Draft values persist on collapse/dock without creating a review attempt.
- Submit snapshots draft into the attempt.
- Top-level problem study state stores latest structured log fields.
- Restart discards unsaved local edits and reloads from persisted fields.

### Submission Actions

Submit:

- Enabled only before current session is submitted.
- Uses selected rating in expanded mode.
- Uses quick-rating heuristic in collapsed mode.
- Saves review result.
- Appends attempt.
- Pauses timer.
- Expands overlay.
- Loads post-submit next-step preview.

Fail:

- Dedicated action.
- Saves Again.
- Locks assessment to Again.
- Expands overlay.
- Loads post-submit next-step preview.

Update / Save Override:

- Enabled only after submit.
- Enabled only if selected rating or draft fields differ from submitted snapshot.
- Replaces latest saved result.
- Does not append a duplicate attempt.
- Keeps original submitted mode and solve time unless product explicitly changes this later.

Restart:

- Enabled only after submit.
- Clears submitted-session lock.
- Clears failure lock.
- Clears feedback.
- Resets timer.
- Clears next-step preview.
- Restores draft from latest persisted problem state.
- Does not mutate persisted history until next submit.

### Post-Submit Next-Step Preview

After successful submit or update:

1. Show loading state.
2. Refresh current problem context.
3. Fetch app-shell payload.
4. If study mode is study plan and a distinct active-track next problem exists, show Next in track.
5. Else show first distinct recommendation.
6. Else show empty next-step state.

Restart or page navigation clears the preview.

### Overlay Edge Cases

Must handle:

- Non-problem URL.
- SPA navigation while requests are pending.
- LeetCode DOM hydration delay.
- Missing title.
- Missing difficulty.
- Premium metadata.
- Submit failure.
- Draft save failure.
- Override without prior attempt.
- Dock drag vs click.
- Viewport-clamped dock.
- Visual mode reset on reload.

### Overlay Acceptance Criteria

- Overlay never renders on non-problem pages.
- User can log review from LeetCode page.
- Collapsed, expanded, and docked states are recoverable and clear.
- Timer and assessment behavior are understandable.
- Submit, fail, update, and restart are distinct.
- Structured logs persist correctly.
- Save override replaces latest attempt.
- Dock remains right-edge, draggable, and recoverable.
- Runtime calls go through repository/RPC, not direct storage.

## 13. Dashboard PRD

### Purpose

The dashboard is the secondary control surface for inspection, configuration, analytics, library management, and backup.

It should not become a generic SaaS app. It should remain an operational study control surface.

### Dashboard Shell

Pages:

- Overview.
- Tracks.
- Library.
- Analytics.
- Settings.

Routing:

- Hash routes are acceptable for extension pages.
- Problem create/edit dialogs should be route-backed.
- Modal routes must preserve the background page's local UI state when opened from Library or Tracks.

Shell requirements:

- Persistent navigation rail or compact nav appropriate for desktop extension page.
- Page header with current route label and route-specific explanatory copy.
- Toast provider for one-time success/error events.
- Not-found route redirects safely to Overview.

### Overview Page

Purpose:

- Summarize the study loop at a glance.

Required sections:

- Recommended problem card.
- Metrics: Due Today, Day Streak, Review Cards.
- Active track overview card.
- Today queue preview.
- Protocol/settings card.

Required actions:

- Open recommended problem.
- Open active-track next problem.
- Go to Tracks.
- Go to Settings.
- Toggle study mode.

Empty states:

- No recommendation.
- Empty today queue.
- No active track.

Acceptance criteria:

- New user can infer the learning loop: review now, continue track, inspect queue.
- Overview remains focused on study state, not marketing.

### Tracks Page

Purpose:

- Inspect and manage curated progression.

Required sections:

- Active track section.
- Other tracks section.

Active track section:

- Track name.
- Description.
- Completion progress bar.
- Completed/total count.
- Due-for-review count.
- Quick links to other enabled tracks.
- Group/chapter tabs.
- Track-scoped problem table.
- Add problem action.

Other tracks section:

- Hidden/collapsed by default.
- Show/Hide toggle.
- Cards for enabled non-active tracks.
- Set Active action.
- Future New Track affordance can be disabled if not implemented.

Track table:

- Problems in selected group.
- Source-order sort.
- Empty message when group has no problems.
- Edit problem action.
- Open problem action.
- Reset/suspend actions where relevant.

Acceptance criteria:

- User can identify active track.
- User can see current group.
- User can see completed and remaining work.
- User can switch active track intentionally.
- User can add or edit problem metadata without losing track page context.

### Library Page

Purpose:

- Search, filter, inspect, and manage all tracked problems.

Required layout:

- Single operational card or full-width section.
- Add problem action.
- Problem table.
- Filter toolbar.

Filters:

- Search by title.
- Difficulty.
- Status.
- Track.
- Topic.
- Company.
- Hide premium.
- Hide suspended.
- Clear filters.
- Visible count.

Table columns:

- Selection checkbox where bulk actions exist.
- Problem title.
- Difficulty.
- Status.
- Retrievability / memory strength.
- Next review.
- Last solved.
- Topics/companies where compactly possible.
- Row actions.

Expanded row details:

- Premium badge.
- Topics.
- Companies.
- Track memberships.
- FSRS stability.
- FSRS difficulty.
- Retrievability.
- Reps.
- Lapses.
- Last attempts.
- Structured log fields.
- Edit.
- Suspend/Resume.
- Reset schedule.

Empty states:

- No library problems.
- No filtered results.
- Premium hidden explanation where applicable.

Acceptance criteria:

- User can quickly find a problem.
- User can understand memory strength.
- User can inspect metadata and review state.
- User can edit metadata from route-backed dialog.

### Analytics Page

Purpose:

- Show local retention and workload signals without implying server-grade precision.

Required metrics:

- Streak.
- Total reviews.
- Retention proxy.
- Average retention explanation.
- Difficulty spread / weak items.
- Due forecast for next 14 days.
- Weakest problems table.

Future analytics:

- Activity heatmap.
- Retention curve.
- Topic weak-spot analysis.
- Solve-time trends by difficulty.
- Company/topic breakdowns.

Empty states:

- No problem data yet.
- No weak-problem data yet.

Acceptance criteria:

- User can decide whether review workload is healthy.
- User can identify weak problems.
- Helper text states that metrics are local estimates.

### Settings Page

Purpose:

- Configure study behavior, timer goals, notification behavior, filters, data portability, and reset.

Required sections:

- Save bar.
- Practice Plan.
- Notifications.
- Memory and Review.
- Question Filters.
- Timing Goals.
- Data Management.

Save bar:

- Reset Defaults.
- Discard Changes.
- Save Settings.
- Buttons gated by dirty/default/busy/validation state.
- Save persists all sections in one local update.

Practice Plan:

- Daily Question Goal.
- Study Mode: Study plan or Freestyle.

Notifications:

- Enable reminders toggle.
- Local reminder time.
- Time disabled when reminders are off.

Memory and Review:

- Target retention slider, 70 percent to 95 percent.
- Review order: Due First, Mix By Difficulty, Weakest First.

Question Filters:

- Treat premium as suspended.

Timing Goals:

- Require solve time.
- Hard Mode.
- Easy goal in minutes.
- Medium goal in minutes.
- Hard goal in minutes.
- Validation/coercion for invalid goals.

Data Management:

- Export backup JSON.
- Choose backup file.
- Import backup.
- Reset study history danger zone.

Acceptance criteria:

- Settings load and save reliably.
- Dirty edits are not clobbered by background refreshes.
- Notifications schedule correctly.
- Queue generation respects settings.
- Reset and import are clear about destructive behavior.

## 14. Modal And Dialog PRD

### Create Problem Dialog

Entry:

- From Library.
- From Tracks.
- Public route can include background source.

Fields:

- LeetCode URL or slug.
- Title.
- Difficulty.
- LeetCode URL.
- Topics.
- Companies.
- LeetCode Premium toggle.

Behavior:

- Load topic and company options.
- Parse URL or slug into normalized slug.
- Create problem with non-empty patch fields.
- Prevent duplicate problem creation.
- Save closes dialog, refreshes background page payload, and shows success toast.
- Cancel closes without mutation.
- Save errors render inline.

### Edit Problem Dialog

Entry:

- From Library row details/table.
- From Tracks table.
- Public route can include background source.

Fields:

- Title.
- Difficulty.
- LeetCode URL.
- Topics.
- Companies.
- LeetCode Premium toggle.

Behavior:

- Omit slug input.
- Load existing problem.
- If missing, show "This problem is not in the library."
- Save full editable patch.
- Mark user-edited metadata.
- Save closes dialog, refreshes background page payload, and shows success toast.
- Cancel closes without mutation.

### Reset Study History Dialog

Entry:

- Settings Data Management.

Content:

- Warning that reset clears review history, FSRS cards, solve times, ratings, suspended flags, and course progress derived from study history.
- Export backup action.
- Cancel.
- Confirm Reset.

Behavior:

- Reset preserves settings, problem library, source data, and tracks.
- Reset clears review-derived state.
- Result appears as dashboard toast.

### Import Confirmation Dialog

This is not fully implemented today but should be in the rebuild MVP if possible.

Entry:

- After selecting backup JSON and clicking Import Backup.

Content:

- Backup schema version.
- Counts: problems, study states/cards, attempts, topics, companies, tracks.
- Warning that import replaces or merges local state according to defined rules.
- Cancel.
- Confirm Import.

Behavior:

- Validate before confirmation.
- Reject malformed or unsupported versions.
- Canonicalize URLs.
- Deduplicate attempts on repeated import.
- Result appears as dashboard toast.

## 15. Data And Runtime PRD

### Persistence

Preferred MVP storage:

- SQLite-WASM as source of truth.
- Drizzle ORM for schema and queries.
- `chrome.storage.local` stores serialized SQLite snapshot and small runtime keys only.

Why:

- Local-first.
- Better queryability than one large JSON blob.
- Better analytics potential.
- Transactional model.
- Existing direction is working and worth preserving.

### Suggested Greenfield Schema

Use tables equivalent to:

- `problems`
- `problem_topics`
- `problem_companies`
- `topics`
- `companies`
- `study_cards` or `study_states`
- `attempt_history`
- `tracks`
- `track_groups`
- `track_group_problems`
- `track_session`
- `settings_kv`

V2-ready improvement:

- Model FSRS card state as `study_cards`.
- Use `card_variant = 'default'` in MVP.
- Add unique constraint on `(problem_slug, card_variant)`.
- Keep UI one-card-per-problem until multi-language review is approved.

This avoids painful migration later while preserving MVP simplicity.

### Runtime Boundary

The service worker owns:

- DB boot.
- Snapshot restore.
- Schema upgrade.
- Catalog seeding.
- Typed RPC dispatch.
- Sender authorization.
- Runtime message validation.
- Problem open/navigation.
- FSRS mutations.
- Settings mutations.
- Backup import/export.
- Notification scheduling.

UI owns:

- Presentation.
- Local interaction state.
- View-model orchestration.
- Calling typed repositories.

UI must not:

- Call `chrome.storage` directly.
- Mutate SQLite directly.
- Trust unvalidated runtime payloads.
- Deeply depend on service worker implementation internals.

### RPC Commands And Queries

Minimum API:

- `getPopupShellData`
- `getAppShellData`
- `getProblemContext`
- `upsertProblemFromPage`
- `openProblemPage`
- `openExtensionPage`
- `saveReviewResult`
- `saveOverlayLogDraft`
- `overrideLastReviewResult`
- `createProblem`
- `editProblem`
- `getProblemForEdit`
- `getTopics`
- `getCompanies`
- `setActiveTrack`
- `getTracks`
- `getLibrary`
- `getSettings`
- `updateSettings`
- `resetStudyHistory`
- `exportData`
- `importData`

### Sender Authorization

Allow extension pages to call internal methods.

Allow LeetCode content script only the methods required by overlay:

- page upsert/context
- app-shell data read
- review save/draft/override
- problem open
- extension settings open

Reject unknown methods and malformed payloads with actionable errors.

### Backup

Export:

- Versioned JSON.
- Problems.
- Study states/cards.
- Attempt history.
- Settings.
- Topics.
- Companies.
- Tracks.

Import:

- Validate schema.
- Validate URLs.
- Sanitize settings.
- Sanitize problem metadata.
- Sanitize study state/card fields.
- Deduplicate attempts.
- Preserve curated track rules.
- Show confirmation summary before destructive import.

### Notifications

MVP:

- Optional local daily reminder.
- One reminder time.
- Uses Chrome alarms.
- Sends notification only when due count is greater than zero.
- Avoid duplicate notification for the same local date.

Do not add:

- Server push.
- Multi-device notifications.
- Calendar integration.

## 16. FSRS And Queue PRD

### FSRS Rating Semantics

- Again: failed or needs shortest interval.
- Hard: solved with friction or overtime without strict failure.
- Good: steady recall and acceptable timing.
- Easy: immediate recall and high confidence.

### Review State

Each review:

- Applies FSRS scheduling.
- Records attempt.
- Updates last rating.
- Updates last solve time.
- Updates best solve time if applicable.
- Clears suspended state.
- Snapshots structured log fields.

### Override

Override:

- Replaces latest attempt.
- Rebuilds FSRS state from history.
- Must not append a duplicate attempt.

### Reset

Problem reset:

- Clears scheduling and attempts.
- Can preserve notes/log fields if requested.

Global study-history reset:

- Clears review-derived state.
- Preserves problem library, settings, source data, and tracks.

### Retrievability

Show memory strength where relevant:

- Green: strong.
- Yellow: needs attention soon.
- Red: due.
- Missing state: no retrievability yet.

### Queue Generation

Inputs:

- Problems.
- Study state/cards.
- Settings.
- Active filters.
- Current date/time.

Algorithm:

1. Exclude suspended/effectively suspended problems.
2. Compute retrievability and due status.
3. Partition into due, new, and reinforcement.
4. Order by selected review strategy.
5. Cap by daily question goal.
6. Build recommendation candidates.

Review order strategies:

- Due First.
- Weakest First.
- Mix By Difficulty.

## 17. Track Progression PRD

### Next Problem

The active-track next problem is the first unstarted problem in the first group with unstarted problems.

If all groups are started/reviewed:

- Track is complete.

### Progress

Track progress includes:

- Total questions.
- Completed/started questions.
- Due count.
- Completion percent.
- Group-level counts.

### Active Track

Opening a problem from track context should:

- Open the LeetCode problem.
- Save or preserve active track selection.
- Carry group context if needed by future analytics.

### Track Management MVP

MVP supports:

- Curated tracks seeded locally.
- Active track selection.
- Group/chapter inspection.
- Problem add/edit from Tracks.

Future:

- Custom track authoring.
- Company-as-track flows.
- Track import UI.

## 18. Design Requirements

### Visual Direction

- Technical.
- Compact.
- Direct.
- Utility-first.
- Desktop extension appropriate.

### Popup Design

- Narrow.
- Single column.
- Recommendation first.
- Active-track second.
- Stable reserved status/helper slots.
- Compact icon actions.
- No marketing copy.
- No dashboard-style navigation inside popup.

### Overlay Design

- Supportive, not dominant.
- Fast logging.
- Always recoverable dock.
- Right-edge dock only.
- Vertical-only dock movement.
- Collapsed and expanded action positions should not jump.
- Critical guidance visible as helper text.

### Dashboard Design

- Operational control surface.
- Distinct Overview, Tracks, Library, Analytics, Settings.
- Avoid generic SaaS shell.
- Use dense but readable tables and grouped controls.
- Use toasts for one-time results.
- Use semantic tokens and shared primitives.

### Copy Tone

- Short.
- Literal.
- Operational.
- Low-fluff.

Examples:

- Due now.
- Review focus.
- Next in track.
- Queue clear.
- Reset study history.

## 19. Greenfield Engineering Recommendation

This section is not product scope. It is the engineering posture for the clean
rebuild. The reason to rebuild is that the app needs a simpler, more durable
structure where features can be added without repeatedly reworking the same
foundation.

The default posture is library-first and pattern-first:

- Use stable third-party libraries for solved UI and application problems.
- Keep CogniPace-specific code focused on product policy and extension runtime
  integration.
- Wrap libraries behind thin app adapters where consistency matters.
- Do not build a custom component framework, router, table engine, form engine,
  validation framework, state cache, or state machine unless a real extension
  constraint forces it.
- Treat architecture rules as enforceable standards, not preferences.

### Bulletproof React Application Pattern

The rebuild should use Bulletproof React as the organizing model, adapted for a
Chrome extension.

Required patterns:

- Feature-based modules under `src/features`.
- Application composition under `src/app`.
- Shared UI under `src/components`.
- Preconfigured integrations under `src/lib`.
- Platform adapters under `src/platform`.
- Extension runtime code under `src/extension`.
- Test utilities under `src/testing`.
- One-way imports from shared code to features to app.
- Feature internals are private by default.
- App layer composes features instead of features importing from each other.

Feature module shape:

```txt
features/<feature>/
  api/
  components/
  hooks/
  stores/
  types/
  utils/
  server/
```

Not every feature needs every folder. Add a folder only when the feature really
uses that kind of code.

Boundary rules:

- `components`, `hooks`, `lib`, `platform`, `types`, and `utils` cannot import
  from `features` or `app`.
- `features` cannot import from `app`.
- Feature UI cannot call raw Chrome APIs.
- Feature domain code cannot import React.
- Service-worker handlers call feature server APIs and datasources, not React
  code.
- Cross-feature UI composition happens in `app`, not inside feature internals.

### Stable Library Policy

Choose proven libraries over custom code for these categories:

- Routing: TanStack Router or another mature route library.
- Server/cache state: TanStack Query.
- Tables: TanStack Table.
- Forms: React Hook Form.
- Validation: Zod or Valibot.
- Headless UI primitives: Radix UI, React Aria, Base UI, Ark UI, or equivalent.
- Icons: Lucide or a stable icon package.
- Local UI state: Zustand, Jotai, Redux Toolkit, or React reducer/context where
  appropriate.
- Complex interaction machines: XState where state transitions are hard enough
  to justify it.
- Dates/time: date-fns, Temporal polyfill, or a small stable date utility.
- Persistence schema/querying: Drizzle ORM.
- Spaced repetition: `ts-fsrs` or a maintained FSRS implementation.
- Testing: Vitest, Testing Library, Playwright.

Custom implementation is allowed only when:

- The behavior is CogniPace product policy.
- A stable library cannot operate inside MV3/content-script constraints.
- The wrapper is thinner than adopting a library.
- The decision is documented with the tradeoff.

### Component Strategy

Use stable headless or full-featured components for accessibility and behavior.
Style them to match CogniPace instead of rebuilding dialog, tabs, popover,
tooltip, select, switch, slider, table, or form behavior from scratch.

Preferred approach:

- Use third-party primitives for behavior.
- Create thin CogniPace adapters for repeated product styling.
- Keep adapters small and boring.
- Keep feature-specific UI inside the feature.
- Extract shared components only after repetition is real.

Examples:

- `Dialog` adapter wraps a stable dialog primitive.
- `Tabs` adapter wraps a stable tabs primitive.
- `DataTable` composes TanStack Table with CogniPace table styling.
- `FormField` composes React Hook Form with a stable input primitive.
- `ToastProvider` wraps a stable toast primitive or a small proven package.

Avoid:

- Handwritten popover positioning.
- Handwritten keyboard interaction for tabs/selects/dialogs.
- One-off form state managers.
- Custom table sorting/filtering engines.
- UI primitives with dozens of product-specific props.

### Extension Framework

Recommended spike: WXT.

Reasoning:

- It is purpose-built for web extensions.
- Official docs describe MV2/MV3 and cross-browser build support.
- It can replace custom Vite orchestration and reduce entrypoint boilerplate.
- It should fit React, TypeScript, content scripts, extension pages, and MV3 service worker constraints.

Alternatives:

- Plasmo: strong if the goal is maximum extension DX, declarative pages/content scripts, built-in live reload, and batteries-included storage/messaging.
- CRXJS: good if the goal is staying close to plain Vite with HMR and minimal framework ownership.

Recommendation:

- Run a 1-2 day spike with WXT + React + one popup + one content overlay + one service worker RPC.
- If WXT fights SQLite-WASM, shadow-root overlay, or service-worker output, compare Plasmo and CRXJS before committing.

### UI Stack

Current MUI works, but the rebuild should not assume MUI is the only path. The
decision should be based on whether the library helps the extension stay clean,
compact, accessible, and fast to build.

Recommended spike:

- Radix Primitives for dialogs, tooltip, popover, tabs, select, switch, slider.
- Tailwind CSS or CSS variables with CVA/class-variance-authority for styling
  variants.
- shadcn/ui selectively as a Radix-based reference or scaffold, not as an excuse
  to invent our own primitives.
- Lucide icons.

Why:

- More control over compact extension UI.
- Easier to keep design tokens close to product.
- Less fighting library default spacing.
- Reuses stable accessibility and interaction behavior.

Keep MUI only if:

- Speed of table/forms/settings is more important than bundle and styling control.
- The team wants a complete component library with fewer custom adapters.
- The chosen MUI usage stays systematic and does not create one-off styling
  sprawl.

### State And Data

Use the Bulletproof React state categories explicitly:

- Component state: local `useState` or `useReducer`.
- Application state: small global stores only for cross-surface UI state.
- Server/cache state: TanStack Query for service-worker reads.
- Form state: React Hook Form.
- URL state: router search/hash params for dashboard route and modal state.

Recommended libraries:

- TanStack Query for async server-worker reads and cache invalidation.
- Zustand or XState only for local UI machines where useful, especially overlay session state.
- TanStack Table for library and track problem tables.
- React Hook Form plus Valibot or Zod for forms.
- Drizzle ORM plus SQLite-WASM for persistence.
- ts-fsrs for scheduling.

### Routing

Dashboard:

- TanStack Router remains a strong fit for typed hash routes and route-backed modals.
- Modal routes should be owned by routing, not by ad hoc boolean state.
- Library and Tracks background state should remain mounted behind problem
  dialogs.

Popup:

- No route tree.
- Use local component state only.

Overlay:

- No route tree.
- State machine or reducer should control visual/session state.
- Timer state and submitted-session locks should be explicit state transitions,
  not scattered booleans.

### Build And Validation

Use:

- TypeScript strict.
- ESLint.
- Vitest.
- React Testing Library.
- Playwright extension E2E.
- Visual regression tests for popup, overlay states, and dashboard pages.
- One command equivalent to `npm run check`.

### Chrome MV3 Constraints

The rebuild must respect these platform constraints:

- Background code runs as a service worker.
- Register event listeners synchronously at top level.
- Do not rely on in-memory service-worker variables for durable state.
- Use alarms for scheduled work.
- Content scripts live in isolated worlds and must message the extension for privileged operations.
- `chrome.storage.local` is local and removed when the extension is removed.

## 20. MVP Build Process

### Phase 0: Product Lock

Deliverables:

- Confirm MVP scope and non-goals.
- Choose framework spike winner.
- Choose UI stack.
- Define extension permissions.
- Define schema.
- Define typed RPC contract.

Exit criteria:

- A developer can explain surfaces, data flow, permissions, and MVP exclusions.

### Phase 1: Extension Foundation

Deliverables:

- MV3 manifest.
- Popup page.
- Dashboard page.
- Content script for LeetCode problem pages.
- Background service worker.
- Shared runtime messaging.
- Basic theme/tokens.
- Test harness.

Exit criteria:

- Popup, dashboard, and overlay host render in local extension build.
- Service worker responds to typed ping.

### Phase 2: Local Data And FSRS

Deliverables:

- SQLite-WASM boot.
- Drizzle schema.
- Snapshot persistence.
- Catalog seed.
- Settings defaults.
- FSRS scheduler.
- Queue generator.
- Backup export/import skeleton.

Exit criteria:

- Review result can be saved locally.
- Data survives extension reload.
- Queue returns due/new/reinforcement items.

### Phase 3: Popup MVP

Deliverables:

- Header.
- Due/streak metrics.
- Recommendation panel.
- Active-track panel.
- Shuffle.
- Open problem.
- Study/freestyle mode switch.
- Loading/error/empty states.

Exit criteria:

- Popup answers review-now and next-in-track.
- Shuffle is local-only.
- Mode change is rollback-safe.

### Phase 4: Overlay MVP

Deliverables:

- Shadow-root overlay.
- Collapsed state.
- Expanded state.
- Docked state.
- Timer.
- Assessment rail.
- Structured logs.
- Submit/fail/update/restart.
- Next-step preview.
- Settings shortcut.

Exit criteria:

- User can complete a full review on LeetCode.
- Logs persist.
- FSRS state updates.
- Dock is recoverable and draggable.

### Phase 5: Dashboard Core

Deliverables:

- Dashboard shell.
- Overview page.
- Tracks page.
- Library page.
- Route-backed problem create/edit dialog.

Exit criteria:

- User can inspect current state, change active track, search/filter library, and manage problem metadata.

### Phase 6: Settings, Backup, Reset

Deliverables:

- Settings page sections.
- Save/discard/reset defaults.
- Notifications.
- Timing goals.
- Premium filter.
- Export.
- Import with confirmation.
- Reset study history dialog.

Exit criteria:

- User can configure behavior and safely back up or reset local data.

### Phase 7: Analytics

Deliverables:

- Streak.
- Total reviews.
- Retention proxy.
- Due forecast.
- Weakest problems.
- Basic visual explanations.

Exit criteria:

- Analytics help user identify retention health and weak problems.

### Phase 8: Hardening And Launch

Deliverables:

- Runtime sender validation.
- Payload validation.
- URL safelisting.
- Import hardening.
- Playwright extension E2E.
- Visual regression baselines.
- Docs and release checklist.

Exit criteria:

- Full validation command passes.
- Extension can be loaded unpacked and tested end-to-end.

## 21. Issue-Informed Backlog

### Current V1 Improvement Candidates

- Dashboard visual alignment with popup/overlay: [#118](https://github.com/Hollowvyn/CogniPace/issues/118).
- Dashboard overview learning-loop redesign: [#72](https://github.com/Hollowvyn/CogniPace/issues/72).
- Better track progress and next-step visibility: [#69](https://github.com/Hollowvyn/CogniPace/issues/69).
- Better library filtering and readability: [#76](https://github.com/Hollowvyn/CogniPace/issues/76).
- Clearer analytics interpretation: [#74](https://github.com/Hollowvyn/CogniPace/issues/74).
- Advanced analytics/reporting: [#97](https://github.com/Hollowvyn/CogniPace/issues/97).
- Popup empty states and progress cues: [#73](https://github.com/Hollowvyn/CogniPace/issues/73).
- Clearer backup messaging/import validation UI: [#82](https://github.com/Hollowvyn/CogniPace/issues/82).
- Global and scoped reset progress: [#75](https://github.com/Hollowvyn/CogniPace/issues/75).
- Runtime sender and payload validation: [#67](https://github.com/Hollowvyn/CogniPace/issues/67).
- Backup import validation and URL safelisting: [#68](https://github.com/Hollowvyn/CogniPace/issues/68).
- Typed background response contracts: [#66](https://github.com/Hollowvyn/CogniPace/issues/66).
- Companies feature and company-based study: [#45](https://github.com/Hollowvyn/CogniPace/issues/45).

### V2 / Explicit Approval Candidates

- Auto-start, submission hooking, heuristic rating: [#92](https://github.com/Hollowvyn/CogniPace/issues/92).
- Smart assessment recommendation engine: [#96](https://github.com/Hollowvyn/CogniPace/issues/96).
- GenAI integration: [#94](https://github.com/Hollowvyn/CogniPace/issues/94).
- Multi-language/multi-variant FSRS cards: [#156](https://github.com/Hollowvyn/CogniPace/issues/156).
- Visual regression testing: [#114](https://github.com/Hollowvyn/CogniPace/issues/114).

### Recently Completed Baseline Work To Preserve Conceptually

- Drizzle/SQLite migration: [#95](https://github.com/Hollowvyn/CogniPace/issues/95), [PR #163](https://github.com/Hollowvyn/CogniPace/pull/163).
- Track SSoT and tracks on SQLite: [PR #153](https://github.com/Hollowvyn/CogniPace/pull/153), [PR #164](https://github.com/Hollowvyn/CogniPace/pull/164).
- Overlay review handling/draft persistence: [#88](https://github.com/Hollowvyn/CogniPace/issues/88).
- Popup clarity/stability: [#89](https://github.com/Hollowvyn/CogniPace/issues/89).
- Flexible overlay states: [#90](https://github.com/Hollowvyn/CogniPace/issues/90).
- Settings control center: [#78](https://github.com/Hollowvyn/CogniPace/issues/78).
- Custom time limits and Hard Mode: [#93](https://github.com/Hollowvyn/CogniPace/issues/93).
- Premium/unsolvable filtering: [#99](https://github.com/Hollowvyn/CogniPace/issues/99).
- Dashboard toasts: [PR #181](https://github.com/Hollowvyn/CogniPace/pull/181).
- Problem table filtering: [PR #182](https://github.com/Hollowvyn/CogniPace/pull/182).

## 22. Acceptance Test Matrix

### Popup

- Renders loading state.
- Renders queue clear state.
- Renders recommendation.
- Shuffle rotates candidates only.
- Opens recommended problem.
- Shows no active track state.
- Shows freestyle state.
- Shows track complete state.
- Shows study-plan next problem state.
- Opens next track problem with track context.
- Optimistic mode change succeeds.
- Optimistic mode change rolls back on failure.

### Overlay

- Does not render on non-problem pages.
- Upserts page problem metadata.
- Handles SPA navigation.
- Collapsed timer start/pause/reset works.
- Compact submit saves review and expands.
- Fail saves Again and locks assessment.
- Expanded submit uses selected rating.
- Save override replaces latest attempt.
- Restart opens fresh local session.
- Collapse/dock persists dirty draft without attempt.
- Outside click collapses expanded overlay.
- Dock drag does not restore.
- Dock remains viewport-clamped.
- Hard Mode overtime forces Again.
- Require solve time blocks untimed submit.
- Next-step preview chooses track next before recommendation.

### Dashboard

- Overview loads recommendation, metrics, active track, queue.
- Tracks can switch active track.
- Tracks group tabs preserve selected group.
- Library filters by search, track, difficulty, status, topic, company, premium, suspended.
- Library row expands details.
- Problem create dialog saves new problem.
- Problem edit dialog updates metadata.
- Dialog route preserves background state.
- Analytics empty and populated states render.
- Settings dirty state gates save/discard/defaults.
- Notifications toggle controls time input.
- Export creates JSON.
- Import validates and confirms.
- Reset history requires confirmation.
- Toasts appear for one-time results.

### Runtime

- Unknown runtime methods are rejected.
- Malformed payloads are rejected.
- LeetCode content script cannot call privileged dashboard-only methods.
- Snapshot restores after service worker restart.
- Catalog seeding is idempotent.
- Backup import rejects unsafe URLs.
- Repeated import does not duplicate attempts.

## 23. Open Product Decisions

1. Should MVP schema be V2-ready with `study_cards`, or keep current `study_states` one-to-one and migrate later?
2. Should company-based study be part of MVP or v1.1?
3. Should import replace all data or merge with dedupe rules? Current behavior is closer to merge/upsert.
4. Should route-backed modals use TanStack Router again, or a simpler hash router if WXT changes page conventions?
5. Should the rebuild use Radix/Tailwind/shadcn or keep MUI for speed?
6. Should overlay auto-start timer be MVP? Current docs say manual timer; GitHub issue #92 asks for auto-start.
7. Should AI be excluded entirely until after local deterministic submit capture exists?
8. Should multi-language FSRS influence schema now while staying hidden from UI?

## 24. Screen Deep Dive

This section describes the user-facing screens in detail. It is intentionally
about product surfaces, information hierarchy, controls, states, and user
outcomes rather than framework choices.

### 24.1 Popup Screen

The popup is the most important screen in the product. It should feel like a
compact command surface that answers the user's next move in under five
seconds.

#### Popup Mental Model

The popup has two distinct jobs:

1. Tell the user what to review now.
2. Tell the user what is next in the active track.

The recommendation and track sections should never blur together. The review
recommendation is memory pressure. The track next problem is curriculum
progression.

#### Popup First View

Visible above the fold:

- Brand mark.
- Refresh action.
- Settings action.
- Due Today metric.
- Streak metric.
- Recommended Now card.
- Active Track card.

The popup should not require scrolling in the normal populated state. If text is
long, truncate or compress secondary copy before letting the popup become tall.

#### Popup Header

Header content:

- CogniPace mark or compact wordmark.
- Refresh icon.
- Settings icon.

Refresh behavior:

- Reload the latest popup payload.
- Reset local recommendation shuffle index to the first candidate.
- Keep the layout stable while loading.
- Show surface-level error if refresh fails.

Settings behavior:

- Open Dashboard Settings in a new extension tab.
- Do not replace the current LeetCode tab.

#### Popup Metrics Row

Metric 1: Due Today.

- Shows count of cards currently below target retention.
- Empty value is `0`.
- Loading value can be `...` or skeleton.
- Should be visually urgent but not alarming.

Metric 2: Streak.

- Shows consecutive review days.
- Label should clarify days if space allows.
- Empty value is `0 days`.

The metrics are supportive context. They should not visually overpower the
recommendation card.

#### Popup Recommended Now Card

Populated state:

- Section label: Recommended Now.
- Problem title.
- Difficulty.
- Reason chip such as Due, Overdue, Weak, Reinforcement, or New.
- Optional chip: Also next in track.
- Primary action: Open Problem.
- Optional icon action: Shuffle recommendation.
- Helper text explaining the action.
- Reserved inline status region.

Primary action behavior:

- Opens the LeetCode canonical problem URL.
- If a LeetCode problem tab is already the sender context, reusing that tab is
  acceptable.
- If opening fails, show inline error in the recommendation card.

Shuffle behavior:

- Rotates among the current recommendation candidates.
- Does not generate a new queue.
- Does not mutate persisted data.
- Does not change track progression.
- Does not hide the currently active track card.

Recommendation empty state:

- Title: Queue Clear.
- Explain there is no review pressure right now.
- Suggest continuing the active track if one exists.
- Keep the card shape stable.
- Keep helper and status slots mounted.

Recommendation loading state:

- Title: Loading Queue.
- Explain that recommendation data is loading.
- Keep metrics and active-track slots stable.

Recommendation error state:

- If payload load fails, show a surface-level message and empty safe defaults.
- If opening a problem fails, show card-scoped error.

#### Popup Active Track Card

The Active Track card must be present in every study mode. It keeps the user
aware of curriculum context even when they are in freestyle.

Shared card pieces:

- Section label: Active Track.
- Title for current state.
- Body content.
- Helper text.
- Reserved inline status region.
- Primary mode action.
- Tracks dashboard icon action.

Loading state:

- Title: Loading track.
- Body: Fetching track context.
- Action: open Tracks dashboard.

No active track state:

- Title: No active track.
- Body: choose a track in dashboard to restore guided path.
- Primary action: Start freestyle mode.
- Secondary action: open Tracks dashboard.

Freestyle state:

- Title: You are in freestyle mode.
- Body: start study mode to resume guided track progression.
- Primary action: Start study mode.
- Secondary action: open Tracks dashboard.
- Track context can still be visible in body copy if an active track exists.

Study-plan state:

- Title: active track name.
- Body: active track description.
- Progress percentage chip.
- Progress bar.
- Completed/total text.
- Up Next inset with problem title.
- Continue path icon action.
- Primary action: Start freestyle mode.
- Secondary action: open Tracks dashboard.

Track complete state:

- Title: active track name.
- Body: track complete; switch tracks or use freestyle for due reviews.
- Primary action: Start freestyle mode.
- Secondary action: open Tracks dashboard.

Mode action behavior:

- Apply optimistic local state immediately.
- Disable mode button while save is in flight.
- Persist through settings.
- On success, show track-scoped confirmation.
- On failure, roll back and show track-scoped error.

#### Popup Screen Acceptance

- User understands review priority and active-track next problem.
- User can open the recommended problem.
- User can open the next track problem.
- User can switch between study plan and freestyle deliberately.
- No card jumps vertically when helper or status text changes.
- Empty states explain the next useful action.

### 24.2 Overlay Screens

The overlay is one product surface with three screen states: collapsed,
expanded, and docked. Each state should support the same study session without
feeling like a separate app.

#### Overlay Context

The overlay appears only on LeetCode problem pages. It should read the current
problem context, create or update the local problem record, then attach review
state to that problem.

If the user navigates between LeetCode problems without a full page reload, the
overlay should reset local session state for the new slug and ignore stale
responses from the previous slug.

#### Collapsed Overlay

Collapsed overlay is the default in-page state.

Primary job:

- Keep timer and quick review actions one click away while using minimal space.

Visible controls:

- Expand.
- Hide/dock.
- Timer display.
- Start or pause.
- Reset timer.
- Submit.
- Fail review.
- Helper text.
- Feedback line.

Timer display:

- Large enough to scan.
- Uses tabular numerals.
- Does not resize the overlay as time changes.

Start/pause:

- Start begins timing.
- Pause freezes elapsed time.
- After a session is submitted, start means Start a new session.

Reset:

- Clears local elapsed time before submission.
- Disabled after submission.

Submit:

- Uses quick-rating policy.
- Saves review.
- Expands overlay after save.
- Disabled after current session is submitted.

Fail review:

- Saves Again.
- Expands overlay after save.
- Locks assessment to Again until restart.
- Disabled after current session is submitted.

Hide:

- Saves dirty draft fields if needed.
- Moves to docked state.

Collapsed post-submit state:

- Submit and fail are disabled.
- Helper says result was saved.
- Expand remains available for update or restart.

#### Expanded Overlay

Expanded overlay is the full review screen.

Primary job:

- Let the user inspect review context, choose an assessment, edit structured
  logs, save or update the review, and move to the next problem.

Layout:

1. Header row.
2. Status cards.
3. Feedback surface if needed.
4. Timer card.
5. Assessment rail.
6. Structured log fields.
7. Review actions.
8. Next-step preview.

Header row:

- Collapse button.
- Open settings button.
- Hide/dock button.
- Problem title.
- Header row click can collapse, but icon buttons must stop propagation.

Status area:

- Session label such as First solve or Recall.
- Difficulty chip.
- Last review state.
- Next due state.
- Empty state if no previous review exists.

Timer card:

- Elapsed time.
- Target time.
- Start/pause.
- Reset.
- Disabled controls when a submitted session is locked.

Assessment rail:

- Easy, Good, Hard, Again.
- Each option has a short meaning label.
- Selected rating is visually obvious.
- Hard Mode overtime forces Again.
- Failed session forces Again.
- Helper text explains current rating recommendation or lock.

Structured log:

- Interview pattern.
- Time complexity.
- Space complexity.
- Languages used.
- Notes.

Field behavior:

- Fields are plain text, not rich text.
- Clear control appears for non-empty fields.
- Edits are local until submit, update, collapse, or dock.
- Collapse/dock saves draft without creating a review attempt.

Action row:

- Restart.
- Update.
- Submit.
- I could not finish.

Submit:

- Saves selected rating and current draft.
- Appends attempt.
- Locks current session.

Update:

- Enabled only after submit.
- Enabled only if rating or draft differs from submitted snapshot.
- Replaces latest review.

Restart:

- Enabled only after submit.
- Clears lock and preview.
- Resets timer.
- Restores persisted draft.
- Does not mutate history.

I could not finish:

- Saves Again.
- Locks assessment to Again.

Outside click:

- Saves dirty draft.
- Collapses to collapsed state.

#### Docked Overlay

Docked overlay is the recoverable hidden state.

Primary job:

- Get out of the user's way without disappearing completely.

Visible controls:

- Narrow right-edge trigger.
- Compact brand mark.
- Tooltip or accessible label: Show overlay.

Behavior:

- Click restores collapsed overlay.
- Drag moves vertically only.
- Drag stays clamped within viewport.
- Drag must not trigger restore click.
- Dock offset is session-local.
- Reload returns to default collapsed behavior.

#### Overlay Error And Feedback States

Feedback must be near the action that caused it:

- Problem sync failure: overlay feedback.
- Review save failure: overlay feedback and keep session editable.
- Draft save failure: overlay feedback.
- Open settings failure: overlay feedback.
- Next-step load failure: next-step empty/error card.

#### Overlay Screen Acceptance

- User can use collapsed mode for quick timing and submit.
- User can use expanded mode for detailed logging.
- User can hide to dock and recover the overlay.
- User cannot accidentally append duplicate review attempts through update.
- User can restart without mutating saved history.
- User understands why a rating is selected or locked.

### 24.3 Dashboard Shell Screen

The dashboard shell is the persistent frame around all control pages.

Primary job:

- Let the user move between major control areas while preserving the feeling of
  one study tool.

Required navigation:

- Dashboard or Overview.
- Tracks.
- Library.
- Analytics.
- Settings.

Shell layout:

- Desktop-first.
- Rail or top nav is acceptable, but rail works well for the current control
  center.
- Active route must be obvious.
- Header should show page label and short operational copy.
- Routed content should keep page-specific state where expected.

Global feedback:

- Toasts for one-time action results.
- Errors persist long enough to read.
- Success messages can auto-hide.

Routing behavior:

- Unknown routes redirect to Overview.
- Problem modal routes preserve Library or Tracks background.

### 24.4 Dashboard Overview Screen

Overview is the dashboard's study-loop summary.

Primary job:

- Explain the current study state and provide the main next actions.

Required sections:

- Recommended Problem.
- Metrics.
- Active Track Overview.
- Today Queue.
- Review Surface or Protocol card.

Recommended Problem:

- Same card logic as popup, but can include next review date and more space.
- Primary action opens LeetCode.
- Empty state points user to track or library.

Metrics:

- Due Today.
- Day Streak.
- Review Cards.

Active Track Overview:

- Track name.
- Track description.
- Progress.
- Next in track.
- Toggle study mode action.
- Open Tracks action.

Today Queue:

- List current due/new/reinforcement items.
- Each item opens problem.
- Empty state says the queue is clear.

Protocol card:

- Current study mode.
- Review order.
- Timer behavior.
- Open Settings action.

Overview acceptance:

- User can identify their next review.
- User can identify their next track problem.
- User can understand whether they are in study plan or freestyle.
- User can move to detailed pages without hunting.

### 24.5 Dashboard Tracks Screen

Tracks is the curriculum control screen.

Primary job:

- Show the active path, group progression, and track switching controls.

Required top state:

- Loading settings/tracks.
- No tracks.
- No active track.
- Active track.

No tracks:

- Explain that no tracks are available.
- Offer Add problem if problem creation is supported.
- Future track import can be secondary.

No active track:

- Explain that the user should pick a track below.
- Show other tracks if any exist.

Active track section:

- Label: Active track.
- Track name.
- Description.
- Add problem action.
- Completion progress bar.
- Completed/total text.
- Due count.
- Short links to other enabled tracks.

Group tabs:

- One tab per group/chapter.
- Tab label includes group name.
- Tab label includes completed/total count.
- Completed groups should have success tone.
- Tabs scroll horizontally if needed.

Group problem table:

- Problems in selected group.
- Source order by default.
- Difficulty.
- Status.
- Open action.
- Edit action.
- Suspend/resume/reset where relevant.
- Empty group message.

Other tracks:

- Collapsed by default.
- Header shows count.
- Show/Hide action.
- Each card shows name, description, completed/total, progress bar.
- Set Active action.

Tracks acceptance:

- User can see where they are in the active track.
- User can see which group/chapter they are in.
- User can switch active track.
- User can open and edit problems from track context.
- Completed and upcoming work are distinguishable.

### 24.6 Dashboard Library Screen

Library is the full problem inspection and management screen.

Primary job:

- Let users find, inspect, edit, suspend, reset, and open tracked problems.

Screen header:

- Title such as All Tracked Problems.
- Add problem action.
- Optional refresh action.

Filter toolbar:

- Search by title.
- Filter panel toggle.
- Visible results count.
- Clear filters.

Advanced filters:

- Difficulty multi-select.
- Status multi-select.
- Track multi-select.
- Topic multi-select.
- Company multi-select.
- Hide premium toggle.
- Hide suspended toggle.

Table row:

- Selection checkbox if bulk actions exist.
- Expand/collapse control.
- Problem title.
- Difficulty.
- Status.
- Retrievability.
- Next review.
- Last solved.
- Compact metadata chips where space allows.
- Row actions.

Status language:

- New.
- Learning.
- Review.
- Due.
- Suspended.
- Premium suspended when premium filtering applies.

Retrievability:

- Percent if reviewed.
- Dash if never reviewed.
- Green/yellow/red tone.
- Tooltip or helper explaining memory strength.

Expanded row:

- Problem title and metadata.
- Premium state.
- Topics.
- Companies.
- Track memberships.
- FSRS stability.
- FSRS difficulty.
- Reps.
- Lapses.
- Retrievability.
- Last five attempts.
- Latest notes and structured log.
- Edit action.
- Open problem action.
- Suspend/Resume.
- Reset schedule.

Command feedback:

- Inline table command errors.
- Toasts for major successful actions if appropriate.
- Refresh after mutation.

Library empty states:

- No problems tracked yet.
- No results match filters.
- All matching problems hidden by premium/suspended filters.

Library acceptance:

- User can find a specific problem quickly.
- User can tell which problems are due, weak, or new.
- User can inspect why a problem is due.
- User can edit metadata in a dialog.
- User can suspend or reset safely.

### 24.7 Dashboard Analytics Screen

Analytics is the local insight screen.

Primary job:

- Help users understand retention health and workload from local data.

Top metrics:

- Streak.
- Total Reviews.
- Retention Proxy.

Scheduler Signals:

- Average retention rate.
- Explanation that proxy is based on recent Good/Easy ratings.
- Difficulty spread.
- Weakest problems preview.

Due Forecast:

- Next 14 days.
- Each day has date, count, and relative bar.
- Empty/low days still render without division or layout issues.

Weakest Problems:

- Problem title.
- Lapses.
- FSRS difficulty.
- Optional retrievability.
- Empty state when no weak data exists.

Analytics copy rules:

- Do not overclaim precision.
- Use "proxy", "estimate", or "local signal" when appropriate.
- Tell the user what action to take when data is weak.

Analytics acceptance:

- User can tell whether workload is growing.
- User can identify weak problems.
- User can understand retention proxy without a stats background.

### 24.8 Dashboard Settings Screen

Settings is the control center for product behavior.

Primary job:

- Let the user change study rules safely and save them intentionally.

Save bar:

- Always visible at top of Settings content.
- Explains that all sections save together.
- Reset Defaults.
- Discard Changes.
- Save Settings.

Button states:

- Save disabled when no changes or validation errors.
- Discard disabled when no changes.
- Reset Defaults disabled when already at defaults.
- Busy labels while saving/resetting.

Practice Plan:

- Daily Question Goal numeric input.
- Study Mode segmented control.
- Helper explaining study plan vs freestyle.

Notifications:

- Enable reminders switch.
- Notification Time input.
- Time disabled when reminders are off.
- Helper explains local daily reminder behavior.

Memory and Review:

- Target Retention slider from 70 percent to 95 percent.
- Current value displayed.
- Review Order select.
- Helper explains higher retention means more review pressure.

Question Filters:

- Treat premium as suspended switch.
- Helper explains premium problems stay in library but out of queue.

Timing Goals:

- Require solve time switch.
- Hard Mode switch.
- Easy goal.
- Medium goal.
- Hard goal.
- Goal values shown in minutes.
- Invalid values show field-level errors.
- Unknown difficulty uses Hard goal.

Data Management:

- Export Backup JSON.
- Choose Backup File.
- Selected filename.
- Import Backup.
- Reset Study History danger row.

Settings background refresh:

- If settings are clean, external DB tick can refresh settings.
- If settings are dirty, preserve local draft and avoid clobbering edits.

Settings acceptance:

- User can change settings without accidental save.
- User understands unsaved changes.
- Invalid timing goals prevent save.
- Notification controls are clear.
- Data actions are separated from routine study settings.

### 24.9 Problem Form Dialog

The problem form is shared between Library and Tracks.

Primary job:

- Add or edit problem metadata without losing the current dashboard page.

Create mode:

- Dialog title: Add problem.
- LeetCode URL or slug field is required.
- Title.
- Difficulty.
- LeetCode URL.
- Topics multi-select.
- Companies multi-select.
- Premium toggle.

Edit mode:

- Dialog title: Edit: Problem Title or Edit problem.
- No slug input.
- Same metadata fields except slug.
- Prefill from existing problem.

Loading:

- Show progress indicator while options/problem load.

Load error:

- If problem does not exist, show "This problem is not in the library."
- Keep Cancel available.

Save:

- Create parses URL/slug.
- Create rejects duplicates.
- Edit saves full patch.
- Save button disabled until required create input exists.
- Save button shows busy label.

Close:

- Saved create shows Problem added toast.
- Saved edit shows Problem updated toast.
- Both refresh background page payload.
- Cancel closes without mutation.
- Route returns to original Library or Tracks background.

### 24.10 Reset Study History Dialog

Primary job:

- Make destructive review-history reset explicit and recoverable through backup.

Trigger:

- Reset study history button in Settings Data Management.

Dialog content:

- Title: Reset study history?
- Warning that reset clears review history, FSRS cards, solve times, ratings,
  suspended flags, and track progress derived from study history.
- Export Backup JSON action.
- Cancel.
- Confirm Reset.

Behavior:

- Cancel closes.
- Export does not close dialog unless product chooses otherwise.
- Confirm runs reset and closes on success.
- Result is shown by toast.
- Settings, problem library, tracks, and source data are preserved.

### 24.11 Import Backup Confirmation Dialog

This should be added in the rebuild even though import is currently a direct
button flow.

Primary job:

- Prevent silent destructive or malformed imports.

Trigger:

- User chooses JSON file, then clicks Import Backup.

Pre-confirmation validation:

- Parse JSON.
- Validate root version.
- Validate entity arrays/maps.
- Validate canonical LeetCode URLs.
- Count imported records.
- Detect unsupported versions.

Dialog content:

- Backup version.
- Problems count.
- Study state/card count.
- Attempt count.
- Topics count.
- Companies count.
- Tracks count.
- Import behavior summary: replace or merge according to product decision.
- Warning that import changes local extension data.
- Cancel.
- Confirm Import.

After confirm:

- Import sanitized data.
- Deduplicate attempts.
- Refresh app-shell payloads.
- Show success or error toast.

Import acceptance:

- User sees what is about to change.
- Malformed files never reach mutation code.
- Unsafe URLs are rejected.
- Re-importing the same backup does not duplicate attempts.

## 25. Definition Of Done

MVP is done when:

- The extension builds as MV3.
- The unpacked extension loads in Chrome.
- Popup, dashboard, and overlay render.
- User can open a LeetCode problem from popup/dashboard.
- Overlay can submit review and update FSRS schedule.
- Queue and recommendation update after review.
- Active track progression works.
- Library search/filter works.
- Settings persist.
- Export/import works.
- Reset history works.
- Local notifications work when enabled.
- Full validation passes.
- Product docs reflect shipped behavior.
