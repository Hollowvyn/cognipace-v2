# Dashboard Overview Design

Date: 2026-05-25
Status: Approved for implementation planning

## Context

CogniPace v2 is a local-first WXT, React, and TypeScript Chrome extension. The
Dashboard shell, Tracks, Library, Settings, popup, and basic overlay exist.
Overview is currently a placeholder at
`src/app/dashboard/screens/overview-page.tsx`.

The Overview should become the dashboard home base for one question:

> What should I practice now?

It must not become an analytics dashboard, admin surface, debug surface, or
generic SaaS dashboard.

## Research Summary

The old CogniPace overview had useful sections for recommendation, metrics,
active track, and queue. Its weak point was the `Protocol / Review Surface`
card. That card exposed settings-like facts such as study mode, queue order, and
manual timer behavior instead of helping the user decide what to practice.

The new Overview keeps the useful product surfaces:

- top review recommendation
- lightweight practice progress metrics
- active track summary
- compact queue preview

It deliberately removes protocol/settings/status-card behavior.

## Chosen Approach

Use the same route-to-feature pattern as Tracks, Library, and Settings.

`src/app/dashboard/screens/overview-page.tsx` remains thin. It owns route-level
composition only:

- `DashboardPage`
- `DashboardPageHeader`
- `DashboardPageBody`
- route navigation actions for Library and Tracks

The real Overview behavior and UI live under `src/features/app-shell` because
Overview is a cross-feature dashboard read surface. `app-shell` already owns
popup, dashboard, and overlay shell data composition.

Do not create a new top-level `src/features/overview` feature for this MVP.
Overview is not an independent domain. Queue, tracks, practice, and problems
keep their own rules and data access. App-shell only composes their read models
for the dashboard.

## Architecture

Add or update app-shell modules:

- `src/features/app-shell/components/overview-screen.tsx`
- focused child components under `src/features/app-shell/components/overview/`
  if the screen would otherwise become large
- `src/features/app-shell/domain/dashboard-overview.ts`
- `src/features/app-shell/api/app-shell-contracts.ts`
- `src/features/app-shell/server/app-shell-service.ts`

The app-shell server composes data by calling owning feature services:

- Queue: `features/queue/server/getTodayQueue`
- Tracks: `features/tracks/server/getActiveTrack`
- Practice: a new practice-owned read summary service for daily progress and
  streak
- Settings: existing settings service for daily goal and review settings

Practice aggregate logic belongs in `features/practice`, not app-shell. App-shell
may call a practice service but should not directly query practice tables.

Dependency direction remains:

```txt
entrypoints -> app -> features -> platform/lib/components
```

## Dashboard Payload

Overview reads one dashboard app-shell query:

```ts
useDashboardAppShellData()
```

The dashboard app-shell payload should gain an `overview` object shaped for the
screen. Existing shared base fields may remain for popup/dashboard reuse, but the
Overview component should consume a stable overview-specific view model instead
of reconstructing behavior from unrelated fields.

No visible `generatedAt`, `refreshedAt`, sync timestamp, or manual refresh action
is part of this design.

## Practice Progress Rules

Metrics should be real, not hardcoded.

The Overview metrics row uses:

- `Due`: number of due queue items
- `Completed Today`: unique problems practiced today divided by daily goal
- `Streak`: consecutive local calendar days that met the daily goal

Completed Today counts unique `problemSlug` values with at least one saved
review attempt on the current local calendar day.

Rules:

- Multiple attempts for the same problem on the same day count as `1`.
- Every saved practice result counts, including `again` and failed attempts.
- A day qualifies for streak when unique practiced problems for that day is
  greater than or equal to the configured daily goal.
- If daily goal is `0`, display `Completed Today` as the completed unique
  problem count with a disabled-goal caption, and do not qualify any day for the
  streak solely because the goal is zero.

## UI Layout

The selected layout is recommendation-first.

The page follows existing dashboard style:

- `mx-auto w-full max-w-[64rem]`
- `DashboardPageHeader` title and compact supporting copy
- `Surface`, `Button`, `Badge`, `InlineStatus`, `ProblemDifficultyBadge`
- dense spacing with `gap-[var(--cp-surface-gap)]`
- no MUI-style card system
- no card-inside-card layouts beyond legitimate compact summary tiles

### Header

Title: `Overview`

Supporting copy should be short and product-focused. It should read like a home
base for practice, not a marketing hero.

### Primary Recommendation

If the queue has a top recommendation:

- section label: `Review Now`
- show problem title
- show category, such as `Due` or `Extra Practice`
- show overdue state when applicable
- show difficulty
- show due/review state when useful
- primary action: open the LeetCode problem

If the queue is clear:

- title: `Queue Clear`
- concise copy explaining no review pressure is waiting
- primary action: `Open Library`

Queue-clear state should not force the active-track next problem into the
recommendation slot.

### Metrics

Show three compact metric tiles:

- `Due`
- `Completed Today`
- `Streak`

The metrics should use tabular numbers and short captions. Do not show review
card counts in this MVP.

### Active Track

Show:

- active track title
- description when present
- progress
- current group when available
- next problem when available

Actions:

- primary action opens the active-track next problem when available
- secondary action opens Tracks

If there is no active track, show a compact empty state with a Tracks CTA.

If practice mode disables track guidance, show the state clearly but do not add a
settings/protocol card. Deeper mode changes belong in Settings or existing track
surfaces.

### Queue Preview

Show up to 5 rows from today's queue preview.

Each row should include:

- problem title
- category or due state
- difficulty
- small open action

Do not build queue management here.

## Actions

Problem actions use existing LeetCode URL helpers.

Library and Tracks navigation is passed from the route page, matching how
Library and Tracks pass render actions into feature screens.

There is no manual refresh action.

There is no protocol/settings action card.

## Loading, Error, And Empty States

Use the same patterns as Tracks, Library, and Settings.

Loading:

- `Surface`
- `InlineStatus`
- short loading copy

Error:

- `Surface`
- `InlineStatus role="alert" tone="danger"`
- small outline `Retry` button with `RefreshCw`

New-user or empty:

- no separate landing page
- primary card can show `Queue Clear`
- no active track section shows a Tracks CTA
- metrics show zero or neutral values
- Library CTA lets the user choose any problem

## Testing

Implementation should be test-first or spec-first before code changes.

Add focused tests for:

- practice progress summary
  - unique practiced problems today
  - multiple attempts for one problem count once
  - `again` and failed attempts still count
  - streak day qualifies only when unique practiced problems meet daily goal
- app-shell contract and service composition for dashboard overview payload
- dashboard overview domain/view mapper
  - due recommendation state
  - queue-clear Library fallback
  - active-track next problem state
  - empty/new-user state
- Overview component
  - populated due-review state
  - no due review / queue clear with Library CTA
  - active track next problem
  - empty/new-user state
  - loading state
  - error state with retry
  - navigation/open actions where practical with existing helpers
- dashboard route test update so `/` renders the real Overview content

Run focused tests first, then `npm run check`.

## Out Of Scope

This design does not include:

- analytics charts
- backup or sync
- account/auth/team behavior
- backend service behavior
- manual refresh/status panels
- Chrome permission expansion
- protocol/settings card
- full queue management
- unrelated page polish

## Open Implementation Notes

- Keep `overview-page.tsx` thin.
- Prefer direct component composition over compound component APIs unless the
  screen proves it needs them.
- Keep app-shell dashboard Overview payload validated with Zod.
- Keep practice summary date boundaries explicit and testable.
- Keep docs honest about validation commands actually run.
