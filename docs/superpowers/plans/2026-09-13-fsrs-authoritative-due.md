# FSRS-Authoritative Due And Queue Semantics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make persisted `ts-fsrs` due dates authoritative, classify local-day due state truthfully, and compose Today Queue as overdue → due today → lowest-retrievability reinforcement → new.

**Architecture:** Keep `src/lib/fsrs` as the sole package adapter and keep all interval calculations inside `ts-fsrs`. `features/practice` derives local-calendar timing from persisted `dueAt`, `features/queue` owns the fixed recommendation waterfall, and Library/app-shell/Settings only present those feature-owned results. Target retention remains a prospective write-path scheduler input and is removed from read-time due classification.

**Tech Stack:** TypeScript, `ts-fsrs` 5.4.x, React, Zod, Drizzle ORM, Vitest, React Testing Library, Chrome MV3/WXT

---

## File Structure

- Create `src/features/practice/domain/practice-schedule.ts`: local-calendar
  due/overdue classification from persisted FSRS `dueAt`.
- Create `src/features/practice/domain/practice-schedule.test.ts`: focused
  calendar-boundary invariants.
- Modify `src/features/practice/domain/practice.ts`: use the timing helper and
  calculate retrievability independently from target retention.
- Modify `src/features/practice/domain/index.ts` and
  `src/features/practice/index.ts`: export the timing contract where needed.
- Modify `src/features/practice/data/practice-repository.ts`: remove
  target-retention plumbing from read-only detail derivation while preserving it
  for review scheduling and rating override replay.
- Modify `src/features/practice/server/practice-service.ts`: align read-only
  inputs with the revised practice contract.
- Modify `src/features/queue/domain/queue.ts`: implement the fixed four-lane
  waterfall and deterministic ordering.
- Modify `src/features/queue/domain/queue.test.ts`: prove lane priority,
  capacity filling, and reinforcement order.
- Modify `src/features/queue/server/queue-service.ts`: consume the normalized
  state without an implicit 90% due threshold.
- Modify `src/features/problems/data/problems-repository.ts`: derive overdue,
  due-today, and scheduled Library statuses from normalized timing and remove
  settings-dependent due reads.
- Modify `src/features/problems/server/problems-service.ts`: stop loading target
  retention for Library reads.
- Modify `src/features/problems/api/problems-contracts.ts`: add the `overdue`
  Library status.
- Modify `src/features/problems/components/library/problem-library-formatting.ts`:
  render Overdue with danger treatment.
- Modify `src/extension/messaging.ts`: rename the due reason from `due-now` to
  `due-today` at the runtime boundary.
- Modify `src/extension/background/register-handlers.ts`: remove target
  retention from read-only calls while keeping it on scheduling writes.
- Modify `src/features/app-shell/server/app-shell-service.ts`: stop passing
  target retention into reads and preserve queue-owned ordering.
- Modify `src/features/app-shell/components/overview/overview-panels.tsx`: render
  Due today and use browser-local date formatting.
- Modify `src/features/app-shell/domain/popup-app-shell.ts`: resolve one popup
  recommendation badge from the queue-owned recommendation reason.
- Modify `src/features/app-shell/domain/app-shell-metrics.ts`: label the
  overdue-plus-due-today aggregate as Reviews Due.
- Modify `src/app/popup/components/recommendation-card.tsx`: render only the
  resolved recommendation badge.
- Modify `src/extension/background/due-notification.ts` and
  `src/extension/background/dev-smoke-service.ts`: describe the unchanged
  combined count as due reviews rather than due today.
- Modify `src/features/settings/components/sections/advanced-review-section.tsx`:
  remove Review Order and correct target-retention guidance.
- Modify `src/features/settings/hooks/use-settings-draft.ts`: remove the unused
  Review Order UI action while retaining the stored schema-v1 field.
- Modify affected tests and fixtures under `src/features`, `src/extension`, and
  `src/testing` for the changed runtime enums and statuses.
- Modify `docs/product.md`, `docs/architecture.md`, and `docs/testing.md`: make
  the approved semantics authoritative and document smoke proof.

### Task 1: Derive Due State From The Persisted FSRS Date

**Files:**

- Create: `src/features/practice/domain/practice-schedule.ts`
- Create: `src/features/practice/domain/practice-schedule.test.ts`
- Modify: `src/features/practice/domain/practice.ts:1-7,203-217,262-315`
- Modify: `src/features/practice/domain/index.ts:1-26`
- Modify: `src/features/practice/index.ts:47-72`
- Test: `src/features/practice/domain/practice.test.ts`

- [ ] **Step 1: Write focused failing local-calendar timing tests**

Create `practice-schedule.test.ts` with explicit local `Date` constructors so
the test exercises the runtime calendar rather than assuming UTC:

```typescript
import { describe, expect, it } from 'vitest'

import { derivePracticeScheduleTiming } from './practice-schedule'

describe('derivePracticeScheduleTiming', () => {
  const now = new Date(2026, 8, 13, 2, 11, 31)

  it('marks a prior local date overdue even when less than 24 hours elapsed', () => {
    expect(
      derivePracticeScheduleTiming({
        dueAt: new Date(2026, 8, 12, 23, 30),
        isStarted: true,
        isSuspended: false,
        now,
      }),
    ).toEqual({ isDue: true, isOverdue: true, overdueDays: 1 })
  })

  it('marks every instant on the current local date due today', () => {
    expect(
      derivePracticeScheduleTiming({
        dueAt: new Date(2026, 8, 13, 22),
        isStarted: true,
        isSuspended: false,
        now,
      }),
    ).toEqual({ isDue: true, isOverdue: false, overdueDays: 0 })
  })

  it('keeps a later local date scheduled', () => {
    expect(
      derivePracticeScheduleTiming({
        dueAt: new Date(2026, 8, 14, 0),
        isStarted: true,
        isSuspended: false,
        now,
      }),
    ).toEqual({ isDue: false, isOverdue: false, overdueDays: 0 })
  })

  it('allows suspension to override presentation without mutating dueAt', () => {
    expect(
      derivePracticeScheduleTiming({
        dueAt: new Date(2026, 8, 2),
        isStarted: true,
        isSuspended: true,
        now,
      }),
    ).toEqual({ isDue: false, isOverdue: false, overdueDays: 0 })
  })
})
```

- [ ] **Step 2: Run the timing test and verify it fails**

Run:

```sh
npm test -- src/features/practice/domain/practice-schedule.test.ts --run
```

Expected: FAIL because `practice-schedule.ts` does not exist.

- [ ] **Step 3: Implement the local-calendar timing helper**

Create `practice-schedule.ts`:

```typescript
export interface PracticeScheduleTiming {
  isDue: boolean
  isOverdue: boolean
  overdueDays: number
}

export function derivePracticeScheduleTiming(input: {
  dueAt: Date | null
  isStarted: boolean
  isSuspended: boolean
  now: Date
}): PracticeScheduleTiming {
  if (
    input.isSuspended ||
    !input.isStarted ||
    !input.dueAt ||
    Number.isNaN(input.dueAt.getTime())
  ) {
    return { isDue: false, isOverdue: false, overdueDays: 0 }
  }

  const overdueDays = Math.max(
    0,
    localCalendarOrdinal(input.now) - localCalendarOrdinal(input.dueAt),
  )

  return {
    isDue: localCalendarOrdinal(input.dueAt) <= localCalendarOrdinal(input.now),
    isOverdue: overdueDays > 0,
    overdueDays,
  }
}

function localCalendarOrdinal(date: Date): number {
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / dayMs,
  )
}

const dayMs = 24 * 60 * 60 * 1000
```

- [ ] **Step 4: Make `derivePracticeSummary` use `dueAt`, not target retention**

Import `derivePracticeScheduleTiming`, remove
`defaultFsrsSchedulingOptions`, and change the summary body to calculate the two
independent signals:

```typescript
const retrievability =
  input.card && input.card.lastReviewAt
    ? getRetrievability(input.card, now)
    : null
const timing = derivePracticeScheduleTiming({
  dueAt: input.card?.dueAt ?? null,
  isStarted,
  isSuspended: suspended,
  now,
})

return {
  // keep existing phase, dates, and FSRS metric mappings
  isDue: timing.isDue,
  isOverdue: timing.isOverdue,
  overdueDays: timing.overdueDays,
  retrievability,
}
```

Remove `targetRetention` from the inputs of `derivePracticeSummary` and
`deriveNormalizedPracticeState`. Export the new timing helper from the practice
domain barrels.

- [ ] **Step 5: Replace the old retrievability-threshold test with schedule invariants**

In `practice.test.ts`, replace “keeps due logic retrievability-based” with tests
that set a persisted past `dueAt`, verify it remains due while retrievability is
finite, and verify a future `dueAt` remains scheduled even when its current
retrievability is low. Do not pass a target-retention argument to read-state
derivation.

- [ ] **Step 6: Run focused practice tests**

Run:

```sh
npm test -- src/features/practice/domain/practice-schedule.test.ts src/features/practice/domain/practice.test.ts --run
```

Expected: PASS.

- [ ] **Step 7: Commit the practice-domain invariant**

```sh
git add src/features/practice/domain/practice-schedule.ts src/features/practice/domain/practice-schedule.test.ts src/features/practice/domain/practice.ts src/features/practice/domain/practice.test.ts src/features/practice/domain/index.ts src/features/practice/index.ts
git commit -m "fix(practice): make FSRS due dates authoritative"
```

### Task 2: Remove Target Retention From Read-Time State

**Files:**

- Modify: `src/features/practice/domain/practice.ts:82-104`
- Modify: `src/features/practice/data/practice-repository.ts:129-145,241-257,350-400`
- Modify: `src/features/practice/server/practice-service.ts`
- Modify: `src/features/problems/data/problems-repository.ts:114-143,317-380,870-873`
- Modify: `src/features/problems/server/problems-service.ts:68-96`
- Modify: `src/features/app-shell/server/app-shell-service.ts:170-181`
- Modify: `src/extension/background/register-handlers.ts:698-713,717-797,850-870`
- Test: `src/features/problems/data/problems-repository.test.ts`
- Test: `src/extension/background/register-handlers.test.ts`

- [ ] **Step 1: Write a failing retention-change regression test**

Replace the Library test that expects target retention to flip an existing row
to due. The replacement must:

1. save a review at one target;
2. capture its persisted `dueAt` and status;
3. update settings to a different target;
4. read the same row at the same `now`;
5. assert the due date and status are unchanged.

Use a `now` whose local calendar relationship to `dueAt` is unambiguous so the
test isolates retention changes rather than midnight behavior.

- [ ] **Step 2: Run the regression test and verify the old expectation fails**

Run:

```sh
npm test -- src/features/problems/data/problems-repository.test.ts --run
```

Expected: FAIL until read-time target-retention plumbing is removed and the
test expectation is updated to the authoritative due date.

- [ ] **Step 3: Remove target retention from read-only types and calls**

Apply these boundaries:

```typescript
export interface PracticeReadOptions {
  cardKind?: FsrsCardKind | undefined
  now?: Date | undefined
}

export interface UpdatePracticeLogInput {
  problemSlug: ProblemSlug
  log: PracticeLogFields
}

export interface ProblemLibraryReadOptions {
  now?: Date | undefined
}
```

Remove `targetRetention` only from calls that derive or return current state.
Keep it on `SaveReviewResultInput` and `OverrideLastReviewResultInput`, where it
is passed into `scheduleReview` or review-history replay.

- [ ] **Step 4: Simplify Library and practice read services**

`getProblemLibrary` should no longer load settings:

```typescript
export async function getProblemLibrary(
  db: Db,
  request: ProblemsGetLibraryRequest,
) {
  const library = await createProblemsRepository(db).getLibrary({
    ...(request.at ? { now: new Date(request.at) } : {}),
  })

  return serializeProblemLibrary(library)
}
```

Likewise, `practice.getDetails`, post-save detail reads, post-override detail
reads, app-shell overlay detail reads, and log-update reads pass only `now` and
card identity. Scheduling writes continue to load settings and pass
`settings.review.targetRetention`.

- [ ] **Step 5: Run focused repository and runtime tests**

Run:

```sh
npm test -- src/features/practice/practice-core.integration.test.ts src/features/problems/data/problems-repository.test.ts src/features/problems/server/problems-service.test.ts src/extension/background/register-handlers.test.ts --run
```

Expected: PASS, including the prospective-retention regression.

- [ ] **Step 6: Commit the read/write boundary cleanup**

```sh
git add src/features/practice src/features/problems/data/problems-repository.ts src/features/problems/data/problems-repository.test.ts src/features/problems/server/problems-service.ts src/features/problems/server/problems-service.test.ts src/features/app-shell/server/app-shell-service.ts src/extension/background/register-handlers.ts src/extension/background/register-handlers.test.ts
git commit -m "refactor(fsrs): keep retention on scheduling writes"
```

### Task 3: Implement The Four-Lane Today Queue

**Files:**

- Modify: `src/features/queue/domain/queue.ts`
- Modify: `src/features/queue/domain/queue.test.ts`
- Modify: `src/features/queue/server/queue-service.ts`
- Test: `src/features/queue/queue-track-independence.integration.test.ts`

- [ ] **Step 1: Write a failing queue-waterfall test**

Build candidates covering all four lanes and assert the exact order:

```typescript
expect(queue.items.map((item) => item.problemSlug)).toEqual([
  'oldest-overdue',
  'newest-overdue',
  'due-today-early',
  'due-today-late',
  'lowest-retrievability',
  'higher-retrievability',
  'new-a',
  'new-b',
])
expect(queue.items.map((item) => item.reason)).toEqual([
  'overdue',
  'overdue',
  'due-today',
  'due-today',
  'reinforcement',
  'reinforcement',
  'new-problem',
  'new-problem',
])
```

Set the daily goal to eight. Give future-scheduled reinforcement cards
different `stability`/`lastReviewAt` values that produce distinct current
retrievability values.

- [ ] **Step 2: Write failing cap and deterministic-tie tests**

Add tests proving:

- the daily goal slices the final waterfall, never an individual lane before
  higher-priority lanes are assembled;
- reinforcement sorts by ascending finite retrievability;
- null retrievability sorts last;
- ties sort by `dueAt`, then problem slug;
- new problems fill remaining capacity and sort by title, then slug;
- suspended, mastered, and premium-filtered candidates remain excluded.

- [ ] **Step 3: Run queue tests and verify the old composition fails**

Run:

```sh
npm test -- src/features/queue/domain/queue.test.ts --run
```

Expected: FAIL because the old queue inserts reinforcement before new only as a
special fallback and does not use current retrievability for ordering.

- [ ] **Step 4: Replace configurable ordering with explicit lane order**

Use internal partitions that distinguish overdue and due today while
preserving the public `due` category:

```typescript
interface QueuePartitions {
  overdue: QueueItem[]
  dueToday: QueueItem[]
  reinforcement: QueueItem[]
  new: QueueItem[]
}

const dueItems = [
  ...sortByDueAt(partitions.overdue),
  ...sortByDueAt(partitions.dueToday),
]
const reinforcementItems = sortByRetrievability(partitions.reinforcement)
const newItems = sortNewProblems(partitions.new)
const items = [...dueItems, ...reinforcementItems, ...newItems].slice(
  0,
  dailyGoal,
)
```

Partition reviewed active cards using normalized state:

```typescript
if (candidate.state.isOverdue) {
  partitions.overdue.push(mapQueueItem(candidate, 'due'))
} else if (candidate.state.isDue) {
  partitions.dueToday.push(mapQueueItem(candidate, 'due'))
} else if (candidate.state.isStarted) {
  partitions.reinforcement.push(mapQueueItem(candidate, 'reinforcement'))
} else {
  partitions.new.push(mapQueueItem(candidate, 'new'))
}
```

Delete `orderQueueItems`, `sortByWeakest`, `interleaveByDifficulty`, and every
read of `settings.review.order` from queue behavior.

- [ ] **Step 5: Implement increasing-retrievability ordering**

```typescript
function sortByRetrievability(items: QueueItem[]) {
  return [...items].sort(
    (left, right) =>
      (left.state.retrievability ?? Number.POSITIVE_INFINITY) -
        (right.state.retrievability ?? Number.POSITIVE_INFINITY) ||
      compareDates(left.state.dueAt, right.state.dueAt) ||
      left.problemSlug.localeCompare(right.problemSlug),
  )
}

function sortNewProblems(items: QueueItem[]) {
  return [...items].sort(
    (left, right) =>
      left.title.localeCompare(right.title) ||
      left.problemSlug.localeCompare(right.problemSlug),
  )
}
```

Rename `due-now` to `due-today` in the queue domain. Keep `dueCount` and the
compatibility alias `dueToday` equal to the combined overdue-plus-due-today
count so reminders continue to represent all actionable scheduled reviews.

- [ ] **Step 6: Run queue domain and integration tests**

Run:

```sh
npm test -- src/features/queue/domain/queue.test.ts src/features/queue/queue-track-independence.integration.test.ts --run
```

Expected: PASS.

- [ ] **Step 7: Commit the deterministic queue**

```sh
git add src/features/queue
git commit -m "fix(queue): follow FSRS due and recall order"
```

### Task 4: Make Library And Runtime Statuses Truthful

**Files:**

- Modify: `src/features/problems/api/problems-contracts.ts:60-79`
- Modify: `src/features/problems/data/problems-repository.ts:551-563,604-610`
- Modify: `src/features/problems/components/library/problem-library-formatting.ts:5-31`
- Modify: `src/features/problems/components/library/problem-library-filtering.ts:96-104`
- Modify: `src/extension/messaging.ts:221-245`
- Modify: `src/features/app-shell/components/overview/overview-panels.tsx:359-398`
- Test: `src/features/problems/api/problems-contracts.test.ts`
- Test: `src/features/problems/data/problems-repository.test.ts`
- Test: `src/features/problems/components/library/problem-library-screen.test.tsx`
- Test: `src/features/app-shell/components/overview-screen.test.tsx`
- Test: `src/features/app-shell/server/app-shell-service.test.ts`
- Test: `src/extension/background/register-handlers.test.ts`
- Test: `src/extension/background/dev-smoke-service.test.ts`

- [ ] **Step 1: Write failing Library status tests**

Add cases that assert:

```typescript
expect(priorDayRow.status).toBe('overdue')
expect(currentDayRow.status).toBe('due')
expect(nextDayRow.status).toBe('scheduled')
expect(library.summary.dueCount).toBe(2)
```

The Due summary includes both the overdue and due-today rows.

- [ ] **Step 2: Write failing UI and runtime-enum tests**

Assert that:

- `problemLibraryStatusSchema` accepts `overdue`;
- `queueItemSchema` and `todayQueueSchema` accept `due-today` and reject the
  removed `due-now` value;
- the Library renders an Overdue danger badge;
- Overview renders `Overdue · Sep 2, 2026`, `Due today · Sep 13, 2026`, and
  `Extra Practice` for the corresponding queue items.

- [ ] **Step 3: Run the focused contract and component tests**

Run:

```sh
npm test -- src/features/problems/api/problems-contracts.test.ts src/features/problems/data/problems-repository.test.ts src/features/problems/components/library/problem-library-screen.test.tsx src/features/app-shell/components/overview-screen.test.tsx src/features/app-shell/server/app-shell-service.test.ts src/extension/background/register-handlers.test.ts src/extension/background/dev-smoke-service.test.ts --run
```

Expected: FAIL on the new enums, status mapping, and labels.

- [ ] **Step 4: Add the overdue Library status and combined due count**

Use this precedence:

```typescript
function deriveProblemLibraryStatus(
  state: NormalizedPracticeState,
): ProblemLibraryStatus {
  if (state.isSuspended) return 'suspended'
  if (state.isOverdue) return 'overdue'
  if (state.isDue) return 'due'
  return state.isStarted ? 'scheduled' : 'not-started'
}
```

Count both actionable statuses:

```typescript
dueCount: rows.filter((row) => row.status === 'overdue' || row.status === 'due')
  .length
```

Apply the same rule to filtered Library summaries. Map `overdue` to label
`Overdue` and danger tone; retain `due` as warning.

- [ ] **Step 5: Update runtime enums and Overview copy**

Replace `due-now` with `due-today` in queue/runtime fixtures and consumers. In
Overview, render current-day due items as `Due today · <local date>` and remove
the forced `timeZone: 'UTC'` option from the shared date formatter.

- [ ] **Step 6: Run the focused contract and component tests again**

Run the Step 3 command.

Expected: PASS.

- [ ] **Step 7: Commit the truthful presentation contract**

```sh
git add src/features/problems src/features/app-shell src/extension/messaging.ts src/extension/background/register-handlers.test.ts src/extension/background/dev-smoke-service.test.ts
git commit -m "fix(ui): distinguish overdue and due-today reviews"
```

### Task 5: Remove User-Configurable Queue Ordering

**Files:**

- Modify: `src/features/settings/components/sections/advanced-review-section.tsx:1-83`
- Modify: `src/features/settings/hooks/use-settings-draft.ts:5-16,38-57,84-102,393-400`
- Test: `src/features/settings/components/settings-screen.test.tsx`
- Test: `src/features/settings/hooks/use-settings-draft.test.tsx`

- [ ] **Step 1: Write a failing Settings presentation test**

Assert that the advanced review section contains Target retention and its
prospective-scheduling explanation, but does not contain Review order, Due
first, Weakest first, or Mix by difficulty:

```typescript
expect(screen.getByText('Target retention')).toBeVisible()
expect(
  screen.getByText(
    'FSRS uses this target when scheduling after your next review. Existing due dates stay unchanged.',
  ),
).toBeVisible()
expect(screen.queryByText('Review order')).not.toBeInTheDocument()
expect(screen.queryByText('Due first')).not.toBeInTheDocument()
expect(screen.queryByText('Weakest first')).not.toBeInTheDocument()
expect(screen.queryByText('Mix by difficulty')).not.toBeInTheDocument()
```

- [ ] **Step 2: Run focused Settings tests and verify the old UI fails**

Run:

```sh
npm test -- src/features/settings/components/settings-screen.test.tsx src/features/settings/hooks/use-settings-draft.test.tsx --run
```

Expected: FAIL while the segmented control and old hint remain.

- [ ] **Step 3: Remove Review Order from the Settings UI/controller**

Delete `reviewOrderOptions`, `SegmentedControl`, `setReviewOrder`, the
`set-review-order` reducer action, and the corresponding reducer case. Narrow
`AdvancedReviewSectionProps.actions` to:

```typescript
actions: Pick<
  SettingsDraftActions,
  'setNumberInput' | 'setStrictTiming' | 'setTargetRetention'
>
```

Set the hint exactly to:

```typescript
const targetRetentionHint =
  'FSRS uses this target when scheduling after your next review. Existing due dates stay unchanged.'
```

Do not remove `review.order` from `userSettingsSchema` or stored settings in
this phase. It remains an ignored compatibility field for schema version 1.

- [ ] **Step 4: Remove obsolete hook tests and run Settings tests**

Remove tests that dispatch or assert Review Order changes. Preserve tests for
target retention, save/discard, defaults, and validation.

Run the Step 2 command.

Expected: PASS.

- [ ] **Step 5: Commit the Settings simplification**

```sh
git add src/features/settings/components/sections/advanced-review-section.tsx src/features/settings/components/settings-screen.test.tsx src/features/settings/hooks/use-settings-draft.ts src/features/settings/hooks/use-settings-draft.test.tsx
git commit -m "refactor(settings): remove queue order controls"
```

### Task 6: Document And Validate The Cross-Surface Behavior

**Files:**

- Modify: `docs/product.md:134-180`
- Modify: `docs/architecture.md:92-107,245-257`
- Modify: `docs/testing.md:43-46,192-210,317-324`
- Review: `docs/superpowers/specs/2026-09-13-fsrs-authoritative-due-design.md`

- [ ] **Step 1: Update current product authority**

Document in `docs/product.md` that:

- saved `card.due` is authoritative;
- target retention applies prospectively at the next review;
- Today Queue uses the four-lane waterfall;
- “retention” in reinforcement ranking means current FSRS retrievability;
- Library distinguishes Overdue, Due, Scheduled, New, and Suspended.

- [ ] **Step 2: Update architecture authority**

Document the dependency boundary:

```text
review rating + target retention
-> features/practice write service
-> src/lib/fsrs adapter
-> ts-fsrs next(...)
-> persist returned card.due
-> normalized practice timing
-> Queue / Library / app-shell
```

State that read models may calculate retrievability through the adapter but may
not compare it with the current target to replace persisted due state.

- [ ] **Step 3: Add exact manual smoke flows**

Add these human-run checks to `docs/testing.md`:

1. Seed or create a card due on a prior local date and verify Library and
   Overview label it Overdue.
2. Create a card due later on the current local date and verify it appears as
   Due today.
3. Lower target retention and verify existing due dates, statuses, and queue
   lanes do not change.
4. Save a subsequent review and verify its new due date comes from the new
   retention setting.
5. With no due cards, verify reinforcement is lowest retrievability first and
   new problems follow.
6. Verify Settings has no Review Order control and explains prospective target
   retention.
7. Repeat the Library and Overview checks across local midnight.

Require screenshot or recording proof for Library, Overview, popup, and
Settings before PR review or merge.

- [ ] **Step 4: Run all focused tests**

```sh
npm test -- src/lib/fsrs/scheduler/review-scheduler.test.ts src/features/practice/domain/practice-schedule.test.ts src/features/practice/domain/practice.test.ts src/features/practice/practice-core.integration.test.ts src/features/queue/domain/queue.test.ts src/features/queue/queue-track-independence.integration.test.ts src/features/problems/data/problems-repository.test.ts src/features/problems/api/problems-contracts.test.ts src/features/problems/components/library/problem-library-screen.test.tsx src/features/settings/components/settings-screen.test.tsx src/features/settings/hooks/use-settings-draft.test.tsx src/features/app-shell/components/overview-screen.test.tsx src/features/app-shell/server/app-shell-service.test.ts src/extension/background/register-handlers.test.ts src/extension/background/dev-smoke-service.test.ts src/extension/background/due-notification.test.ts --run
```

Expected: PASS.

- [ ] **Step 5: Run required static and build validation**

```sh
npm run lint
npm run check
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 6: Check formatting for changed documentation**

```sh
npx prettier --check docs/product.md docs/architecture.md docs/testing.md docs/superpowers/specs/2026-09-13-fsrs-authoritative-due-design.md docs/superpowers/plans/2026-09-13-fsrs-authoritative-due.md
```

Expected: PASS. If it fails, run Prettier only on those files and repeat the
check.

- [ ] **Step 7: Record required human validation as pending until performed**

Do not mark manual smoke or visual proof as not applicable. In the handoff,
list each Step 3 flow as pending until a human engineer runs it in the unpacked
extension and attaches screenshots or a recording.

- [ ] **Step 8: Review database and release impact**

Record:

- database migration: none;
- persisted card rewrite: none;
- backup/sync format change: none;
- Chrome permission change: none;
- release impact: user-visible bug fix and Settings/UI behavior change;
- rollback: revert the code release; existing FSRS card rows require no data
  restoration.

- [ ] **Step 9: Commit docs and validation evidence**

```sh
git add docs/product.md docs/architecture.md docs/testing.md docs/superpowers/specs/2026-09-13-fsrs-authoritative-due-design.md docs/superpowers/plans/2026-09-13-fsrs-authoritative-due.md
git commit -m "docs(fsrs): define authoritative due semantics"
```

### Task 7: Normalize Due Labels Across Popup And Notifications

**Files:**

- Modify: `src/features/app-shell/domain/popup-app-shell.ts`
- Modify: `src/features/app-shell/domain/app-shell-metrics.ts`
- Modify: `src/app/popup/components/recommendation-card.tsx`
- Modify: `src/app/popup/popup-shell.test.tsx`
- Modify: `src/features/app-shell/hooks/use-popup-app-shell-controller.ts`
- Test: `src/features/app-shell/hooks/use-popup-app-shell-controller.test.tsx`
- Test: `src/features/app-shell/server/app-shell-service.test.ts`
- Modify: `src/extension/background/due-notification.ts`
- Test: `src/extension/background/due-notification.test.ts`
- Modify: `src/extension/background/dev-smoke-service.ts`
- Test: `src/extension/background/dev-smoke-service.test.ts`
- Test: `src/extension/background/register-handlers.test.ts`
- Modify: `docs/product.md`
- Modify: `docs/testing.md`
- Modify: `docs/superpowers/specs/2026-09-13-fsrs-authoritative-due-design.md`

- [ ] **Step 1: Write failing popup label tests**

Update the overdue popup expectation so the recommendation contains exactly one
`Overdue` badge and contains neither `Due` nor `Due today`. Add a due-today
fixture whose queue item has `reason: 'due-today'` and assert it displays one
`Due today` badge. Change popup metric expectations to:

```typescript
expect(view.metrics).toContainEqual({ label: 'Reviews Due', value: '1' })
```

- [ ] **Step 2: Run popup tests and verify the expected failures**

```sh
npm test -- src/app/popup/popup-shell.test.tsx src/features/app-shell/hooks/use-popup-app-shell-controller.test.tsx src/features/app-shell/server/app-shell-service.test.ts --run
```

Expected: FAIL because the current popup renders `Due` plus `Overdue` and the
aggregate metric is still labeled `Due Today`.

- [ ] **Step 3: Resolve one popup recommendation badge**

Derive the recommendation presentation from the matching queue item's
`reason`:

```typescript
type PopupRecommendationReason = {
  label: string
  tone: 'danger' | 'warning' | 'info' | 'success'
}

function readRecommendationReason(reason: AppShellQueueItem['reason'] | null) {
  switch (reason) {
    case 'overdue':
      return { label: 'Overdue', tone: 'danger' as const }
    case 'due-today':
      return { label: 'Due today', tone: 'warning' as const }
    case 'new-problem':
      return { label: 'New', tone: 'info' as const }
    case 'reinforcement':
      return { label: 'Extra Practice', tone: 'success' as const }
    case null:
      return null
  }
}
```

Remove `isOverdue` from `PopupRecommendationView` and remove the second
conditional Overdue badge from `RecommendationCard`. Use a safe category
fallback only when a matching queue item is unavailable.

- [ ] **Step 4: Rename the combined popup metric**

Change both loaded and loading-state labels from `Due Today` to `Reviews Due`.
Do not change `dueCount`, `dueToday`, or runtime schemas in this amendment.

- [ ] **Step 5: Run popup tests and verify they pass**

Run the Step 2 command.

Expected: PASS.

- [ ] **Step 6: Write failing reminder and development-smoke copy tests**

Change expected notification messages to:

```typescript
`You have ${count} review${count === 1 ? '' : 's'} due.`
```

Change the queue development-smoke expectation from `${count} due today` to
`${count} reviews due`.

- [ ] **Step 7: Run background tests and verify the expected failures**

```sh
npm test -- src/extension/background/due-notification.test.ts src/extension/background/dev-smoke-service.test.ts src/extension/background/register-handlers.test.ts --run
```

Expected: FAIL because notification and queue smoke copy still says due today.

- [ ] **Step 8: Implement the reminder and development-smoke copy**

Keep the internal compatibility field and count unchanged. Change only the
rendered strings:

```typescript
`You have ${dueToday} review${dueToday === 1 ? '' : 's'} due.`
```

```typescript
`Queue loaded: ${queue.dueToday} reviews due, ...`
```

- [ ] **Step 9: Run focused tests and verify they pass**

Run the Step 2 and Step 7 commands.

Expected: PASS.

- [ ] **Step 10: Run repository validation and commit**

```sh
npm run check
npm run build
npx prettier --check docs/product.md docs/testing.md docs/superpowers/specs/2026-09-13-fsrs-authoritative-due-design.md docs/superpowers/plans/2026-09-13-fsrs-authoritative-due.md src/features/app-shell/domain/popup-app-shell.ts src/features/app-shell/domain/app-shell-metrics.ts src/app/popup/components/recommendation-card.tsx src/app/popup/popup-shell.test.tsx src/features/app-shell/hooks/use-popup-app-shell-controller.ts src/features/app-shell/hooks/use-popup-app-shell-controller.test.tsx src/features/app-shell/server/app-shell-service.test.ts src/extension/background/due-notification.ts src/extension/background/due-notification.test.ts src/extension/background/dev-smoke-service.ts src/extension/background/dev-smoke-service.test.ts src/extension/background/register-handlers.test.ts
git add docs/product.md docs/testing.md docs/superpowers/specs/2026-09-13-fsrs-authoritative-due-design.md docs/superpowers/plans/2026-09-13-fsrs-authoritative-due.md src/features/app-shell/domain/popup-app-shell.ts src/features/app-shell/domain/app-shell-metrics.ts src/app/popup/components/recommendation-card.tsx src/app/popup/popup-shell.test.tsx src/features/app-shell/hooks/use-popup-app-shell-controller.ts src/features/app-shell/hooks/use-popup-app-shell-controller.test.tsx src/features/app-shell/server/app-shell-service.test.ts src/extension/background/due-notification.ts src/extension/background/due-notification.test.ts src/extension/background/dev-smoke-service.ts src/extension/background/dev-smoke-service.test.ts src/extension/background/register-handlers.test.ts
git commit -m "fix(ui): normalize review due labels"
```

Expected: all validation commands pass. Manual popup and reminder smoke proof
remains pending until the human engineer performs it.

## Self-Review Results

- Spec coverage: every approved decision maps to Tasks 1-7.
- Scope: no FSRS version upgrade, schema migration, bulk reschedule, or history
  replay refactor is included.
- Type consistency: `isDue` remains the normalized due-on-or-before-today flag;
  `isOverdue` is the prior-local-day subset; `due-today` is the runtime reason;
  `overdue` is the new Library status.
- Persistence safety: scheduling writes retain target retention; reads do not
  receive it; no existing card is rewritten.
- Validation: focused tests, lint, full check, build, docs formatting, manual
  smoke, and visual proof are all explicitly covered.
- Label consistency: Overdue, Due today, and Reviews Due have mutually
  exclusive meanings; internal compatibility field names remain unchanged.
