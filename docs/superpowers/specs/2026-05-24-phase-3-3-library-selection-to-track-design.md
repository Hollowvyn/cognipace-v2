# Phase 3.3: Library Selection To Track Design

## Summary

Phase 3.3 adds a lightweight way to create a track from selected Library rows.
Users filter Library however they want, select the exact problems they want, then
use a `Make Track` bulk action to open the existing Track composer over Library.

The feature should reuse the Phase 3 Track form and track creation API. It should
not introduce a second track composer, a global app store, server-side Library
filtering, or extra problem metadata.

## Goals

- Add a `Make Track` action for selected Library rows.
- Open a Library-scoped track creation modal over `/library`.
- Seed the existing `TrackForm` from selected problem rows.
- Support lightweight initial grouping by none, difficulty, topic, or company.
- Allow moving an already selected problem to another group with a compact group
  selector in the existing problem membership row.
- Keep the workflow small, local, and consistent with the current Library and
  Tracks architecture.

## Non-Goals

- Creating tracks from all filtered rows.
- Creating tracks from the current page only.
- Drag and drop.
- Duplicating a problem across multiple topic or company groups.
- Persisting draft tracks before save.
- Adding backend/server-side Library filtering.
- Adding schedule countdown or due-date practice behavior.
- Adding new track ownership/source fields.

## User Flow

1. The user filters Library to narrow the visible problem set.
2. The user selects one or more problem rows.
3. The existing Library bulk action bar shows `Make Track` when selection is
   non-empty.
4. Clicking `Make Track` creates a short-lived draft containing the selected
   problem slugs, then navigates to a Library modal route.
5. The modal resolves the draft slugs back to full Library rows, seeds the
   existing Track form, and displays the selected count.
6. The user enters track metadata, optionally chooses `Group by`, adjusts groups
   and order, then saves.
7. Saving uses the existing `tracks.createTrack` mutation and returns to
   `/library`.

## Route Design

Add a Library child modal route:

- `/library/tracks/new`

This route renders over the Library page, matching the existing modal route
pattern for `/library/problems/new` and `/library/problems/$problemSlug/edit`.
Closing the modal returns to `/library`.

The existing `/tracks/new` route remains the normal Tracks-owned creation route.
It should continue to close back to `/tracks` and should not require a Library
selection draft.

## State Design

This feature should not introduce global application state. The state categories
are:

- Component state: Library table selection remains owned by the Library table.
- Server cache state: Library rows continue to come from `useProblemLibrary`.
- URL state: `/library/tracks/new?draft=<id>` identifies the active handoff.
- Form state: `TrackForm` owns title, description, target date, group by, groups,
  problem order, and set-active intent.
- Ephemeral handoff state: selected problem slugs are stored in a feature-local,
  tab-scoped draft helper backed by `sessionStorage`.

The draft shape should stay small:

```ts
type LibrarySelectionTrackDraft = {
  id: string
  source: 'library-selection'
  problemSlugs: string[]
  createdAt: string
}
```

Only slugs are stored. The modal reloads normal Library data and resolves those
slugs to current `ProblemLibraryRow` values.

If the draft is missing, stale, or resolves to zero rows, the modal shows a small
error state with a `Return to Library` action. If only some slugs resolve, the
modal continues with the remaining rows and shows a non-blocking warning.

## Grouping Rules

The create-from-selection modal starts with `Group by: None`.

Supported values:

- `None`: one `Main` group containing every selected problem in the current
  Library table order.
- `Difficulty`: groups by `Easy`, `Medium`, `Hard`, then `Unknown`; empty groups
  are omitted.
- `Topic`: groups by the first topic on each problem; problems without topics go
  to `No topic`.
- `Company`: groups by the first company on each problem; problems without
  companies go to `No company`.

Changing `Group by` regenerates the group draft from the original selected rows.
This is intentionally lightweight and does not add a confirmation step. Canceling
the modal remains the recovery path if the user does not want the regenerated
draft.

## Track Form Changes

`TrackForm` should accept an optional create-mode draft source. The normal
`/tracks/new` flow still uses the default `Main` group behavior.

The create-from-Library flow should:

- show the selected problem count in the modal context;
- place `Group by` beside `Target date` with equal horizontal weight;
- reuse the existing metadata, group list, search, and membership editor layout;
- keep problem membership rows visually close to the current Track modal rows;
- add only a compact group selector to membership rows, placed near the move
  up/down and remove controls.

Problem rows should not gain extra metadata chips or a second Library-style row
layout. The goal is membership editing, not problem management.

## Architecture Boundaries

Library owns:

- table filtering;
- table selection;
- showing the selected-row `Make Track` action;
- creating the handoff from selected problem slugs.

Tracks owns:

- the draft helper contract for track creation handoff;
- Track form initialization from selected problem rows;
- group-by draft generation;
- moving a problem between groups;
- final create payload construction.

App/dashboard owns:

- composing the Library modal route;
- keeping app screens thin;
- returning the modal to the correct parent route.

Cross-feature imports should stay on public feature surfaces. Root feature barrels
must not export `data` or `server` modules.

## Data Flow

1. `ProblemLibraryScreen` passes selected rows to the bulk action bar.
2. The `Make Track` action stores selected slugs through a Tracks public draft
   helper and gets a draft id.
3. The app navigates to `/library/tracks/new?draft=<id>`.
4. The modal loads normal Track form defaults and normal Library rows.
5. The modal resolves draft slugs to Library rows and builds an initial Track
   draft.
6. `TrackForm` manages all subsequent local edits.
7. Submit sends the existing `tracks.createTrack` request with metadata, groups,
   and ordered `problemSlugs`.
8. Existing Tracks cache invalidation and DB mutation behavior handle persistence.

## Tests

Add or update focused tests for:

- `Make Track` appears only when Library rows are selected.
- The action stores selected slugs and navigates to the Library track modal route.
- `/library/tracks/new` renders over Library and closes to `/library`.
- Missing or invalid drafts show a recoverable modal state.
- Draft resolution preserves current Library table order for selected rows.
- Group by none, difficulty, topic, and company creates expected groups.
- Multi-topic and multi-company rows use the first value only.
- Missing topics/companies use fallback groups.
- Changing `Group by` regenerates groups from the original selected rows.
- Moving a problem to another group updates group membership and submit payload.
- Creating the track calls `tracks.createTrack` with expected groups and order.
- Architecture boundary tests remain green.

## Deferred Follow-Ups

- Create track from all filtered rows.
- Bulk grouping from selected rows by custom metadata beyond difficulty, topic,
  and company.
- Track templates or imports.
- Server-side Library query/filter contracts.
- Drag and drop ordering.
