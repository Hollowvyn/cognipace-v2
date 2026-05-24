# Track Form Compact Composer Design

## Context

The current create/edit track modal works for small tracks but becomes hard to use for large curricula such as ByteByteGo Coding Patterns 101. Every group is rendered as a full card with a visible title input, selected problems are rendered as larger cards, and Library search results are also card-like. Long tracks make the modal grow vertically and push useful controls out of reach.

This redesign keeps the existing track form data model and runtime APIs. It changes the modal composition and density so large track edits remain lightweight.

## Goals

- Keep `/tracks/new` and `/tracks/$trackId/edit` as route modals over `/tracks`.
- Make the modal itself scrollable instead of letting long lists push the modal upward.
- Keep the form lightweight, dense, and consistent with the dashboard design system.
- Make group and problem ordering simple with icon buttons only, no drag/drop.
- Keep track membership rules unchanged: a problem can appear only once in a track, and every track must contain at least one group.
- Keep group deletion safe by disabling group removal unless the group is empty.

## Non-Goals

- No schema changes.
- No runtime contract/API changes.
- No drag/drop.
- No full-screen editor route.
- No delete confirmation for non-empty groups in this phase.

## Modal Shell

`RouteModal` should keep the form variant visually consistent, but the form modal needs internal scroll ownership:

- The dialog uses a viewport-safe maximum height.
- The modal body scrolls internally.
- The header remains outside the scrolling form body.
- The form footer stays reachable, preferably sticky at the bottom of the form.
- Backdrop and Escape close behavior remain unchanged.

This should also benefit problem forms if implemented generically in `RouteModal`, but care should be taken not to regress existing problem modal tests.

## Form Layout

The track form becomes a compact composer:

- Metadata stays at the top: title, description, target date, and create-mode active checkbox.
- The composer body uses two zones on desktop:
  - Groups on the left.
  - Selected group details and problems on the right.
- On narrow screens, the zones stack in one column.

The two-zone layout should be responsive, not fixed-width-heavy. Long group and problem names should truncate instead of resizing the layout.

## Groups

Groups render as compact rows rather than cards.

Each group row contains:

- group title or fallback title
- problem count
- move up icon
- move down icon
- remove icon

Only the selected group expands. The expanded state exposes the group title input. Non-selected groups stay one line.

Group remove stays disabled when:

- there is only one group
- the group contains any problems

This keeps destructive behavior predictable and avoids a confirmation dialog in this phase.

## Selected Group Problems

The selected group problem list becomes one-line rows.

Each problem row contains:

- source order number
- problem title
- optional compact difficulty badge
- move up icon
- move down icon
- remove X icon

The action order is always `up`, `down`, `remove`, with the X icon at the end. Rows should stay dense and avoid card-like vertical padding.

## Problem Search

The selected group editor includes a small autocomplete-style Library search.

Rules:

- Search only shows Library problems not already present anywhere in the track.
- Search matches existing title/slug behavior.
- Results are compact rows, not large cards.
- Clicking or pressing an add control appends the problem to the selected group.
- Empty result state stays simple: no matching Library problems.

The search should be visually small enough that it does not dominate the selected group editor.

## State And Data

The existing `useTrackForm` reducer is still the right owner for form state:

- metadata updates
- group add/rename/remove/move/select
- problem add/remove/move
- payload derivation
- validation

The implementation can add derived UI state for expanded/selected rows only if needed, but selected group should continue to come from the reducer.

## Tests

Focused tests should cover:

- modal form variant keeps content internally scrollable and footer reachable
- create mode still starts with one `Main` group
- only the selected group exposes the title input
- non-selected groups render compact rows with counts
- group remove is disabled for non-empty groups
- group remove is disabled when only one group exists
- problem rows are one-line and order actions as up/down/remove
- search excludes problems already selected anywhere in the track
- create and edit payloads are unchanged
- long group/problem titles truncate instead of crowding controls

## Deferred

- Drag/drop ordering
- full-screen track editor
- group delete confirmation for non-empty groups
- bulk membership operations
- grouping helpers from Library filters
