# Phase 3.4: Tracks Progress And Target Polish Design

## Context

Phase 3 added the Tracks workspace, active track management, track groups,
ordered problem rows, track progress, popup active-track context, and Library
selection-to-track creation.

Phase 3.4 is the final Tracks experience polish pass for progress and target
dates. It makes target dates feel intentional when users set them, while keeping
the feature lightweight and visually aligned with the current dashboard.

## Scope

In scope:

- `/tracks` active-track progress and target-date presentation.
- `/tracks` all-tracks row progress and target-date presentation.
- Track create/edit modal target-date input behavior.
- Popup active-track compact progress/target badges.

Out of scope:

- Overview screen work.
- Queue ordering changes.
- FSRS scheduling changes.
- Custom calendar popover/date-picker package.
- Analytics, charts, or pacing projections.
- A second progress model.

Target dates are presentation and planning context only. They do not change
review due dates, queue selection, or practice scoring.

## Target Date Status Model

Add a small Tracks-owned date/status helper that derives display state from:

- `dueAt`
- track progress
- `generatedAt`

Statuses:

- `none`: no target date is set.
- `upcoming`: target date is after today.
- `due-today`: target date is today.
- `overdue`: target date is before today.
- `complete`: progress is 100%.

`complete` wins over `overdue`. A finished track should not keep presenting as a
missed target just because the date passed.

Date comparisons are calendar-date comparisons, not timestamp comparisons.
Persisted track dates can remain UTC-midnight ISO strings, but display helpers
must read them as date-only values to avoid timezone shifts. UI copy should use
the read model `generatedAt` value as the stable "now" for a render.

Example display copy:

- `Target Jun 15 · 21 days left`
- `Target May 25 · Due today`
- `Target May 21 · Overdue · 4 days late`
- `Target Jun 15 · Complete`
- no target date: omit the target panel/row metadata unless an empty state needs
  explanatory copy.

## `/tracks` Active Track

The active track header keeps the existing title, description, and icon actions.
Below it, add a two-panel summary row:

- left panel: Progress
- right panel: Target, only when a target date exists

If no target date exists, render only the Progress panel and let it span the
summary row. Do not render a placeholder target panel.

When both panels are visible, they have equal width, equal height, matching
padding, matching border radius, and matching border weight on desktop and
smaller screens. They stay side-by-side on smaller widths; the content inside
each panel compacts instead of stacking the two panels into separate rows.

Progress panel:

- circular progress ring
- label `Progress`
- `17 of 101`
- secondary text such as `84 problems left`

Target panel:

- circular calendar icon treatment
- label `Target`
- target date
- status/countdown text
- subtle left rail and soft background only when status needs emphasis
- danger treatment for overdue
- primary/success treatment for upcoming or complete

Remove the extra horizontal progress strip from the active header. Progress
should not be shown twice in the same header area.

Keep the operational metrics below:

- `Due Reviews`
- `Next`

The old `Progress` metric is removed once the progress summary panel exists.
`Due Reviews` remains explicitly labeled because it means FSRS reviews due for
track problems, not the track target date.

## All Tracks Rows

All-tracks rows keep their compact list shape and action layout.

Each row should show:

- title
- optional active badge
- description
- compact progress count with a tiny circular progress indicator
- problem count
- target metadata when `dueAt` is set

Target metadata uses the same status language as the active header:

- `Target Jun 15 · 21 days left`
- `Target May 21 · Overdue · 4 days late`

Overdue text can use danger color and a small calendar icon. It should not make
the entire row look like an error state.

Rows without a target date simply omit target metadata.

## Track Form Modal

Keep the native `type="date"` input. Do not add a custom calendar package in
Phase 3.4.

Date input behavior:

- show `Target date`
- add a clear control when a date is set
- show helper copy: `Optional finish target for this track.`
- set the minimum selectable date to today for new target-date choices
- validate create-mode target dates as today or future
- in edit mode, allow an already-saved past date to remain unchanged so users can
  edit other track metadata without being forced to clear/update the target
- if the user changes a target date in edit mode, the new value must be today or
  future

Do not show a separate status preview in the modal. The form should help users
set or clear a date, while the track workspace and popup communicate status.

For Library selection-to-track creation, keep the existing balanced row where
`Target date` shares horizontal space with `Group by`.

## Popup

Keep the popup compact and close to the current active-track card.

The popup should not add the large target panel from `/tracks`.

Study-plan active-track badges should include:

- active group when present
- progress percent
- target status when a target date exists

Example popup badges:

- `Two Pointers`
- `17%`
- `Overdue`

The popup target badge uses compact status text such as `Overdue`, `Due today`,
`21 days left`, or `Complete`. Do not add the full target date to the popup card
body. The existing Up Next card and freestyle-mode action stay unchanged.

Free Practice still disables track progression display. Do not reintroduce
active-track progress or target dates while free practice mode is active.

## Architecture

Add a focused Tracks helper at
`src/features/tracks/domain/track-target-status.ts`, and export only the safe
public helper/types from the Tracks barrel.

The helper should be pure and reusable by:

- Tracks screen components
- all-tracks row components
- popup active-track view/component code

Avoid new global client state. State categories stay the same:

- server cache: React Query/app-shell responses
- persisted state: SQLite
- transient UI state: local component/form state
- URL state: existing route-backed modals

Use the read model `generatedAt` for deterministic display calculations instead
of calling `new Date()` independently in every component.

Keep app screens thin. Feature-specific components stay in `src/features/tracks`
or the existing popup component area.

## Styling

Use existing primitives and tokens:

- `Surface`
- `Badge`
- `Button`
- `IconButton`
- lucide icons
- existing CSS variables and Tailwind utility patterns

Do not introduce a new visual theme. The approved direction is compact, quiet,
and dashboard-native:

- two equal-weight summary panels
- circular progress ring
- target date panel with subtle status rail
- danger only for overdue text/rail/badge
- compact metadata in all-track rows
- chip-level target status in popup

Responsive behavior:

- the Progress and Target summary panels remain equal-width in the same row on
  smaller screens
- internal content may wrap and compact
- avoid text overflow inside the panels
- if copy becomes too tight, prefer shorter status copy over stacking the panels

## Tests

Add focused tests for:

- target status helper: no target, upcoming, due today, overdue, complete.
- date-only behavior around UTC-midnight persisted dates.
- `/tracks` active header renders equal progress/target summary panels when a
  target date exists.
- `/tracks` active header does not render the old duplicated horizontal progress
  strip.
- `Due Reviews` and `Next` remain visible below the summary panels.
- all-tracks rows show compact progress and target metadata.
- all-tracks rows omit target metadata when no target date exists.
- overdue rows use danger treatment without changing the whole row into an error
  state.
- create modal blocks past target dates.
- edit modal allows an unchanged saved past target date, but blocks a newly
  chosen past date.
- clear target date works.
- popup uses compact badges for group, progress percent, and target status.
- free practice popup still hides active-track progress/target state.

## Verification

Run:

```bash
npm run check
```

For implementation, also verify the rendered `/tracks` screen and popup at a
desktop viewport and one smaller viewport. The key visual acceptance criterion is
that Progress and Target remain equal-weight summary panels in one row while
staying readable.
