# Phase 3 Tracks Design

## Context

CogniPace v2 has completed the app shell/routes, Settings, and the Library/Problems MVP. Tracks currently has only an active-track preview path, seeded tracks/groups, `track_session`, and placeholder `/tracks` route modals.

Phase 3 turns Tracks into the targeted learning surface for curricula, study plans, company prep, and other ordered problem workflows. The design intentionally improves on the old CogniPace implementation while staying aligned with the v2 Problems and Settings architecture.

## Product Scope

Phase 3 implements a focused Tracks MVP:

- one active track workspace
- ordered groups
- ordered active-track problem rows
- track-scoped completion progress
- FSRS due count scoped to the active track
- optional target date/countdown from `tracks.dueAt`
- create/edit track composition
- set active track and active group
- delete any track
- reset track progress only

Tracks owns curriculum progression. Library owns global problem management, global filtering, and problem creation.

Seeded, imported, and manually created tracks behave the same. There is no `source`, `curated`, or `isUserCreated` concept.

Inactive tracks are summary-only. They can be edited, deleted, or set active, but they do not show a full problem workspace. Only the active track exposes group tabs and problem rows.

Every track must contain at least one group. New tracks get a default `Main` group when no group is provided. The edit form cannot save a track with zero groups. If a track has exactly one group, the UI treats it as the whole track and avoids noisy single-tab navigation.

## Non-Goals

Phase 3 does not implement:

- inactive track problem preview
- global Library filters inside Tracks
- bulk problem actions in Tracks
- inline global problem creation from Tracks
- drag/drop ordering
- advanced import/export UX
- creating tracks from Library filters
- popup/overview/overlay polish beyond keeping existing active-track reads working

## Progress Model

Track completion is separate from global practice state.

Global practice/FSRS remains lifelong. Once a problem is practiced, it stays part of global scheduling and queue behavior with or without a track.

Track progress is recorded only for the active track. When a saved assessment is `good` or `easy`, the practice save path checks the current `track_session.activeTrackId`. If the assessed problem belongs to that active track, the first ordered incomplete membership for that problem is marked complete.

If the same problem appears in multiple tracks, completing it in the active track does not complete it in other tracks. If the same problem appears multiple times inside one active track, the first ordered incomplete membership is completed.

Resetting track progress clears only the track progress ledger for that track. It does not touch `problem_practice`, `fsrs_cards`, or `review_attempts`.

Per-problem reset schedule remains the global practice reset action reused from the Library row details.

## Data Model

`track_session` is the single source of truth for active track and active group.

`tracks.isActive` should be removed or ignored through migration. Phase 3 should not preserve the current fallback to `tracks.isActive`.

Add `track_problem_progress`:

- `track_group_id` text, not null
- `problem_slug` text, not null
- `completed_at` integer, not null
- `completed_rating` text, not null, constrained to `good` or `easy`
- `created_at` integer, not null
- `updated_at` integer, not null
- primary key on `(track_group_id, problem_slug)`
- composite foreign key to `track_group_problems(track_group_id, problem_slug)` with cascade delete

The table stores current completion state, not an append-only event log. It intentionally does not reference `review_attempts.id` in Phase 3 to avoid unnecessary coupling to global practice history.

Existing `track_groups.position` and `track_group_problems.position` remain the ordering source. Add, remove, and move operations normalize positions to `1, 2, 3...` inside transactions.

Deleting a track cascades groups, memberships, and track progress. If the deleted track is active, `track_session.activeTrackId` and `activeGroupId` are set to `null`.

## Read APIs

Add `tracks.getWorkspace`, the Tracks equivalent of `problems.getLibrary`. It returns the full dashboard read model so the UI does not stitch catalog, session, groups, progress, rows, and next problem from multiple runtime calls.

The workspace response includes:

- generated timestamp
- all tracks for the catalog/accordion
- active track id
- active group id
- active track details
- target date/countdown fields from `tracks.dueAt`
- groups with completed/total counts
- active group rows ordered by `track_group_problems.position`
- track-scoped progress summary
- FSRS due count scoped to active track problems
- next problem for the active track
- edit/delete/reset permissions, which are true for all tracks except where state makes the action impossible

Add `tracks.getTrackForEdit`:

- track metadata
- ordered groups
- ordered problem memberships per group
- existing Library problem options/search payload needed by the form

The existing active-track read can stay available for popup/dashboard consumers if current app-shell code still uses it.

## Write APIs

Add dashboard-only management methods:

- `tracks.setActiveTrack`
- `tracks.setActiveGroup`
- `tracks.createTrack`
- `tracks.updateTrack`
- `tracks.deleteTrack`
- `tracks.resetTrackProgress`

`tracks.setActiveTrack` atomically sets `track_session.activeTrackId` and the first valid group for that track. If the target track has no group, the service rejects it because every persisted track must have at least one group.

`tracks.setActiveGroup` atomically sets the active group only when it belongs to the current active track.

`tracks.createTrack` accepts metadata, optional `dueAt`, ordered groups, ordered existing problem slugs, and an optional `setActive` flag. The create modal includes an unchecked "Set as active track" checkbox. When checked, creation and active session update happen atomically.

`tracks.updateTrack` accepts metadata, optional `dueAt`, group additions/renames/removals/reordering, and membership additions/removals/reordering. Removing a non-empty group is blocked in the UI and enforced in service validation unless the request also removes or moves all memberships first.

`tracks.deleteTrack` deletes any track after local confirmation and clears session ids if the deleted track was active.

`tracks.resetTrackProgress` deletes only `track_problem_progress` rows for that track after local confirmation.

Practice save behavior updates track progress on `good` or `easy` and invalidates track reads when it writes a track completion.

## Runtime And Cache

Follow the existing background runtime pattern:

- parse Zod contracts at the boundary
- enforce runtime policy
- use service functions for business rules
- use `runDbMutation` for writes
- flush the DB snapshot before broadcasting invalidation
- broadcast `tracks-updated`

Track management methods are dashboard-only. Active-track reads can remain popup/dashboard if needed by app shell.

Track session-only writes invalidate `tracks` and `app-shell`.

Track metadata or membership writes invalidate `tracks`, `app-shell`, and `problems` because Library rows/options show track memberships.

Practice saves that update track progress invalidate `practice`, `problems`, `queue`, `tracks`, and `app-shell`.

## React Architecture

The implementation must follow the current Problems and Settings feature shape.

- `src/app/dashboard/screens/tracks-page.tsx` stays thin and renders the feature screen plus `<Outlet />`.
- `src/features/tracks/api` owns Zod contracts, runtime senders, React Query hooks, and query keys.
- `src/features/tracks/data` owns Drizzle queries and transactions.
- `src/features/tracks/server` owns business rules and serialization orchestration.
- `src/features/tracks/components` owns screen, modal, table, accordion, and form UI.
- `src/features/tracks/hooks` is only used for meaningful local behavior such as `useTrackForm`.
- Root feature barrels do not export `data` or `server`.

State management stays simple:

- server state: React Query
- persisted product state: SQLite
- transient UI state: local component/form state
- no new global client store
- no HOCs
- hooks instead of containers when hooks are clearer
- presentational/container separation only where it reduces complexity
- compound components only when shared implicit state is genuinely useful
- composition over boolean prop sprawl

Tracks must not deep-import Problems internals. Reusable Problem row details/actions should be promoted through safe public Problems exports or a public Problems component layer.

## UI Design

Tracks follows the existing dashboard design system:

- `DashboardPage`
- `DashboardPageHeader`
- `DashboardPageBody`
- `Surface`
- `Button`
- `IconButton`
- `Badge`
- `InlineStatus`
- lucide icons
- existing dashboard tokens and spacing

The UI should match the density and restraint of Library and Settings. It should not use the old orange-heavy Tracks style.

### `/tracks`

The page contains:

- page header
- active track surface
- other tracks accordion

The active track surface shows:

- title and description
- active badge
- edit/action menu
- completed/total count and progress bar from `track_problem_progress`
- FSRS due count scoped to active track problems
- clickable next problem metric
- optional target date/countdown
- group tabs when there is more than one group
- active group problem rows in source order

The other tracks accordion shows summary-only track rows:

- title and description
- completed/total
- due count
- target date if set
- Set Active
- Edit
- Delete

Inactive tracks do not show full group problem workspaces.

### Problem Rows

The active track problem table is order-first and active-track scoped. It should look and behave like the Library table, but should not include Library filtering, bulk selection, or global pagination in Phase 3.

Problem title opens the LeetCode problem like Library.

Row click or chevron expands details like Library.

Expanded details reuse the Library expanded row details/actions as directly as architecture allows. Phase 3 does not add a separate track-specific detail block inside expanded rows.

Tracks should hide or omit global problem delete if the reused Library action surface exposes it. Tracks should keep open, edit in Library, suspend/resume, and reset schedule behavior.

### Track Form Modal

`/tracks/new` and `/tracks/$trackId/edit` are route-backed modals. The parent `/tracks` screen remains visible behind the modal.

Create fields:

- title
- optional description
- optional target date
- unchecked "Set as active track" checkbox
- group/membership composition

Edit fields:

- title
- description
- target date
- group/membership composition

The group editor supports:

- add group
- rename group
- remove empty group
- move group up/down

The problem membership editor supports:

- selected group
- search existing Library problems
- add existing problem to selected group
- remove problem
- move problem up/down

Save normalizes positions and writes in one transaction.

## Consistency With Problems And Settings

Tracks should feel implemented by the same codebase as Problems and Settings:

- same feature folder layering
- same route modal pattern
- same React Query mutation pattern
- same runtime contract style
- same component primitives
- same semantic test style
- same architecture boundary constraints

Any reusable Problem row primitives needed by Tracks should be extracted/promoted deliberately instead of deep-importing Library internals.

## Testing

Repository/domain tests:

- workspace read model
- active track/group from `track_session`
- no `tracks.isActive` fallback
- track and group ordering
- membership ordering
- single-group track behavior
- progress ledger completion
- progress does not leak across tracks containing the same problem
- due count scoped to active track
- next problem selection
- create track with default group
- create/update group and membership positions
- delete any track, including active session cleanup
- reset track progress only

Contract/runtime tests:

- valid/invalid track payloads
- dashboard-only management methods
- runtime handlers use `runDbMutation`
- snapshot flush before invalidation broadcast
- invalidation includes `tracks`, `app-shell`, and `problems` where appropriate

API hook tests:

- workspace and edit queries
- set active/group mutations
- create/update/delete/reset mutations
- invalidation behavior

UI/route tests:

- `/tracks` renders real workspace
- loading, error, and empty states
- active workspace only
- other tracks accordion summary-only
- group tab switching
- single-group UI
- row title open behavior
- row expansion behavior
- reused Library details/actions visible
- create modal direct route
- edit modal direct route
- modal close returns to `/tracks`
- delete/reset confirmations
- no delete/reset routes

Architecture tests:

- app imports only public Tracks surface
- Tracks does not deep-import Problems internals
- root barrels remain safe
- review scheduling writes stay behind Practice

## Verification

Implementation starts with:

```bash
git status --short
npm run check
```

Do not overwrite uncommitted Problems/Library work.

Implementation ends with:

```bash
npm run check
```

Fix Phase 3-related failures. If unrelated user-owned changes keep the check red, report the specific failures.

## Deferrals

Phase 3.1: Create Track from Library filtered or selected results.

- source can be current filtered rows or selected rows
- user enters title, optional description, optional target date
- grouping choices: flat, topic, difficulty, company
- create request receives explicit ordered groups and problem slugs
- order defaults to current Library table order
- multi-label grouping should default to a non-duplicating rule unless explicitly changed later

Phase 3.1: richer seeded/imported track data from old Blind75, ByteByteGo101, LeetCode75, Grind75, NeetCode150, and NeetCode250 sources if desired.

Phase 3.2: polish Tracks across other surfaces.

- popup active-track card uses the new progress ledger and target date
- overview shows active-track context consistently
- post-submission overlay prioritizes active track next problem
- if no active track next problem exists, post-submission overlay falls back to queue next
- free practice visibility can be revisited separately; current intentional hiding should not be undone in Phase 3

Later:

- drag/drop ordering
- advanced bulk membership tools
- richer grouping rules
- full import/export UX
