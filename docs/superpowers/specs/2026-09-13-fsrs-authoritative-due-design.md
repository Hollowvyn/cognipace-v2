# FSRS-Authoritative Due And Queue Semantics

**Date:** 2026-09-13  
**Status:** Approved in product discussion  
**Scope:** Practice read state, Today Queue, Library status, Overview labels, and
the Review settings surface

## Problem

CogniPace correctly delegates review scheduling to `ts-fsrs`, persists the
returned `card.due`, and later displays that timestamp as the next review date.
Its read model then overrides that schedule by deriving `isDue` from current
retrievability compared with the currently saved target retention.

That hybrid produces contradictory state after a target-retention change. A
card can retain an FSRS due date of September 2 while being classified as
scheduled or extra practice on September 13 because its current
retrievability is above a newly lowered target. Queue and Library can also
disagree because they do not consistently pass the same target into the read
model.

The current Review Order setting adds another product-owned scheduling policy.
The queue always places due cards first anyway, while the setting only changes
ordering inside each category. Its “Weakest first” implementation prioritizes
lapses and difficulty rather than the lower retention described by its UI
copy.

## Decisions

### FSRS is authoritative for card schedules

`ts-fsrs` owns all scheduling calculations. On a saved review CogniPace passes
the rating, review time, and configured `request_retention` to the library,
then persists the complete returned card and review log without recalculating
the next interval.

The persisted `card.due`, represented by `FsrsCardSnapshot.dueAt`, is the sole
source of truth for whether a reviewed card belongs to the scheduled review
lanes. Current retrievability must never cancel or replace that due date.

### Target-retention changes are prospective

Changing target retention does not mutate or reinterpret existing cards. The
new value is passed to `ts-fsrs` the next time a review is saved. The due date
returned from that scheduling call becomes the card's new authoritative due
date.

Bulk retroactive rescheduling is not part of this change. If introduced later,
it must be an explicit action that uses the library's rescheduling API and
persisted review history.

### Queue day classification uses the local calendar

The extension is local-first, so Today Queue and Library statuses use the
browser's local calendar date:

- **Overdue:** reviewed, active card whose `dueAt` calendar date is before
  today's local calendar date.
- **Due today:** reviewed, active card whose `dueAt` calendar date is today's
  local calendar date. The exact time does not exclude it from Today Queue.
- **Scheduled:** reviewed, active card whose `dueAt` calendar date is after
  today.
- **New:** eligible problem with no started practice card.
- **Suspended:** explicit practice suspension; this overrides schedule display
  and queue inclusion.

`overdueDays` counts crossed local calendar dates, not elapsed 24-hour blocks.
A card due yesterday is one day overdue after local midnight even when fewer
than 24 hours have elapsed.

### Queue composition is a fixed waterfall

The daily queue is assembled in this order and capped by the configured daily
goal:

1. Overdue FSRS cards, oldest `dueAt` first.
2. FSRS cards due today, earliest `dueAt` first.
3. Started future-scheduled cards as optional reinforcement, lowest current
   FSRS retrievability first.
4. Eligible new Library problems in deterministic title/slug order.

### User-facing due labels are exact

Every surface uses the same vocabulary for FSRS review timing:

- **Overdue** is shown only for a card whose `dueAt` is before the current
  local calendar date.
- **Due today** is shown only for a card whose `dueAt` is on the current local
  calendar date.
- **Reviews due** labels aggregate counts that combine overdue and due-today
  cards.
- **Extra Practice** labels future-scheduled reinforcement candidates.
- **New** labels eligible problems without started practice state.

An overdue popup recommendation renders one `Overdue` badge, never a generic
`Due` badge beside a second `Overdue` badge. Reminder and development-smoke copy
must not describe the combined actionable count as due today.

Reinforcement remains an application fallback, not a second scheduler. It only
ranks future-scheduled cards after all FSRS-due work. The library-computed
retrievability is used directly as the ranking metric. A missing or invalid
retrievability sorts after finite values. Ties use `dueAt`, then problem slug.

The queue fills remaining capacity from each subsequent lane. New problems no
longer require every reviewed problem to be absent; they may fill space left
after due and reinforcement candidates.

### Review Order is removed from the user-facing product

The Settings UI no longer offers Due first, Weakest first, or Mix by
difficulty. Queue ordering follows the fixed waterfall above.

The persisted `review.order` field remains accepted temporarily for settings
schema-version-1 compatibility, but queue code ignores it. Removing the stored
field requires a separately designed settings schema migration and is not
needed for this behavior correction.

The target-retention hint explains prospective behavior: FSRS applies the
value when scheduling after the next saved review; existing due dates remain
unchanged.

## Architecture

### `src/lib/fsrs`

Keep the thin anti-corruption adapter:

- it is the only production code importing `ts-fsrs`;
- it translates ratings, states, cards, and logs at the dependency boundary;
- `scheduleReview` delegates to `scheduler.next`;
- `getRetrievability` delegates to `scheduler.get_retrievability`.

No feature may manually calculate stability, difficulty, or next intervals.
Target retention remains a scheduling input, not a practice-read input.

### `features/practice`

Own one normalized temporal interpretation of persisted FSRS cards for Queue,
Library, app-shell, and overlay consumers. Due classification uses `dueAt` and
local calendar dates. Retrievability is calculated independently for display
and reinforcement ranking.

Read APIs no longer accept target retention because reading a card does not
reschedule it. Write inputs continue to carry target retention to
`scheduleReview` and history-replay operations.

### `features/queue`

Own the fixed queue waterfall, daily-goal cap, eligibility filters, and
deterministic lane ordering. It consumes normalized practice state and never
imports `ts-fsrs` or calculates a due interval.

### `features/problems`

Own Library presentation status. Add a distinct `overdue` status and count both
`overdue` and `due` rows in the existing Due summary count.

### `features/app-shell` and Settings

App-shell renders queue category and timing state without re-deriving them.
Overview dates use the browser's local timezone. Settings removes Review Order
and provides truthful target-retention copy.

## Contract Changes

- `RecommendationReason` replaces `due-now` with `due-today`.
- Serialized app-shell queue items expose their queue-owned recommendation
  reason so popup presentation does not re-derive timing from category or
  retrievability.
- `ProblemLibraryStatus` adds `overdue`.
- Existing normalized practice fields remain, but their definitions become:
  `isDue` means due on or before the current local calendar date;
  `isOverdue` means due before the current local calendar date.
- Existing `dueCount` includes overdue plus due-today cards.
- Existing `dueToday` remains a compatibility alias for the total actionable
  scheduled-review count used by reminders. Renaming it is outside this phase,
  but user-facing copy describes the aggregate as reviews due rather than due
  today.

All runtime changes remain Zod-validated. There is no persisted row-shape or
database schema change.

## Failure And Edge Semantics

- A suspended card is never due or overdue in product read state, while its
  persisted FSRS card remains untouched.
- A started card without a valid `dueAt` cannot enter a due lane and sorts last
  among reinforcement candidates.
- A reviewed card with unavailable retrievability remains scheduled by
  `dueAt`; it is never reclassified as new.
- Lowering or raising target retention refreshes analytics and settings but
  does not alter existing due statuses or dates.
- Reviewing a reinforcement card early is allowed; the saved rating is passed
  back through `ts-fsrs`, which owns the resulting new schedule.

## Data And Migration

No database migration is required. Existing `fsrs_cards.due_at` values are
already the library outputs needed by the corrected read model. Review history
and FSRS logs remain unchanged.

No automatic card rewrite occurs during rollout. Previously contradictory rows
become truthful immediately when their read models refresh.

## Validation

Automated coverage must prove:

- due classification follows local calendar comparison of `dueAt`, including a
  prior-day card less than 24 hours late;
- due classification is invariant under target-retention setting changes;
- the four queue lanes appear in the approved order;
- reinforcement is ordered by increasing retrievability with deterministic
  ties;
- Library exposes Overdue and counts overdue rows as due work;
- runtime schemas accept `due-today` and `overdue`;
- Settings no longer displays Review Order and explains prospective retention;
- Overview displays Overdue, Due today, Extra Practice, and New consistently;
- popup recommendations display exactly one timing/category badge;
- combined popup metrics, notifications, and dev-smoke output say Reviews due
  or due reviews instead of Due today;
- notification and dev-smoke consumers continue receiving the unchanged
  actionable due count.

Required repository validation is focused tests followed by `npm run lint`,
`npm run check`, and `npm run build`. Human smoke proof must cover Library,
Overview, popup, Settings, a target-retention change, and a local-midnight edge
case, with screenshots or a recording before review or merge.

## Non-Goals

- Upgrading from `ts-fsrs` 5.4.x or adopting the v6 beta.
- Optimizing FSRS weights from user review history.
- Automatically rescheduling existing cards when settings change.
- Replacing application history replay with `scheduler.reschedule`.
- Changing database, backup, restore, or sync formats.
- Removing the legacy persisted `review.order` field before a settings schema
  migration is designed.
