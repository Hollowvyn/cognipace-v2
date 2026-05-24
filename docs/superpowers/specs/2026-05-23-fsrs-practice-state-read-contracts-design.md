# FSRS and Practice State Read Contracts

**Issue:** #11  
**Date:** 2026-05-23  
**Assignees:** TimiLikesJava, tobiolutimehin  
**Unblocks:** #12, #13, #14, #20

---

## Problem

Multiple features (Queue, Library, Tracks, Analytics, Dashboard) depend on overlapping FSRS
facts — due dates, retrievability, stability, difficulty, lapses, review history — but each
consumer currently reaches into raw database snapshots or calls `derivePracticeSummary`
independently. This creates divergence risk: two features can read the same raw field and
interpret it differently, and future features (e.g. Dashboard) may re-implement scheduling
logic from scratch.

---

## Decision

**Approach B — New `NormalizedPracticeState` contract alongside `PracticeDetails`.**

We introduce `NormalizedPracticeState` as a new flat interface that is the single read contract
for all scheduling consumers. `PracticeDetails` (used by the overlay session) extends it,
gaining all the flat fields while also keeping the raw `practice` and `card` snapshots needed
by mutation logic.

The two types are independent in purpose but related by inheritance:

- `NormalizedPracticeState` — consumed by Queue, Analytics, Library, Tracks. No raw objects.
- `PracticeDetails extends NormalizedPracticeState` — consumed by the overlay session. Adds
  raw `practice` and `card` for mutation operations, plus `currentLog` and
  `canOverrideLatestReview`.

The intentional trade-off: `PracticeDetails` carries some redundancy (e.g. both `lapses` from
the flat contract and `card.lapses` from the raw snapshot). This is documented via JSDoc.
Consumers should prefer flat fields for reads and use raw objects only when passing to mutation
functions.

`ReviewResult.summary: PracticeSummary` is out of scope — it is a mutation output type, not a
read contract. Left for a follow-up issue.

---

## New Type: `NormalizedPracticeState`

Defined in `src/features/practice/domain/practice.ts`.

```typescript
/**
 * Flat read contract for scheduling consumers: Queue, Analytics, Library, Tracks.
 * All FSRS and practice facts are pre-computed here. Consumers typed to this
 * interface never touch raw DB snapshots or FSRS card objects.
 */
export interface NormalizedPracticeState {
  // Identity
  problemSlug: ProblemSlug
  cardId: string

  // Status (from DB practice row)
  status: PracticeStatus
  isSuspended: boolean

  // Scheduling (computed)
  phase: PracticePhase
  isStarted: boolean
  isDue: boolean
  isOverdue: boolean
  overdueDays: number
  dueAt: Date | null
  lastReviewedAt: Date | null

  // FSRS metrics (computed from card)
  retrievability: number | null
  stability: number | null
  difficulty: number | null
  scheduledDays: number | null
  lapses: number
  reviewCount: number

  // History
  reviewHistory: PracticeReviewAttemptSnapshot[]   // full list
  recentAttempts: PracticeReviewAttemptSnapshot[]  // last 5
  latestAttempt: PracticeReviewAttemptSnapshot | null
}
```

### Field notes

- `dueAt` is the canonical due date field. `nextReviewAt` is dropped.
- `reviewHistory` is the full unbounded attempt list. `recentAttempts` is always the last 5
  entries of `reviewHistory` — never populated independently.
- `isSuspended` is the canonical suspension flag. `summary.suspended` (from the old
  `PracticeSummary`) is removed.

---

## Updated Type: `PracticeDetails`

```typescript
/**
 * Superset of NormalizedPracticeState used by the overlay session.
 * Adds raw `practice` and `card` snapshots needed by mutation logic
 * (override last review, reset schedule, update log).
 *
 * Note: some fields are intentionally redundant — e.g. `lapses` (flat, from
 * NormalizedPracticeState) and `card.lapses` (raw) are the same value.
 * Prefer the flat fields for reads. Use raw objects only when passing to
 * mutation functions that require them.
 */
export interface PracticeDetails extends NormalizedPracticeState {
  practice: PracticeStateSnapshot | null
  card: FsrsCardSnapshot | null
  currentLog: Required<PracticeLogFields>
  canOverrideLatestReview: boolean
  // summary: PracticeSummary — removed; fields now live on NormalizedPracticeState
}
```

---

## New Function: `deriveNormalizedPracticeState`

Defined in `src/features/practice/domain/practice.ts`. Single derivation path for all
consumers. `derivePracticeSummary` becomes an unexported internal helper called only by this
function.

```typescript
export function deriveNormalizedPracticeState(input: {
  problemSlug: ProblemSlug
  cardId: string
  practice: PracticeStateSnapshot | null
  card: FsrsCardSnapshot | null
  attempts: PracticeReviewAttemptSnapshot[]
  now?: Date
  targetRetention?: number
}): NormalizedPracticeState {
  const summary = derivePracticeSummary({
    practice: input.practice,
    card: input.card,
    now: input.now,
    targetRetention: input.targetRetention,
  })

  return {
    problemSlug: input.problemSlug,
    cardId: input.cardId,
    status: input.practice?.status ?? 'new',
    isSuspended: summary.suspended,
    phase: summary.phase,
    isStarted: summary.isStarted,
    isDue: summary.isDue,
    isOverdue: summary.isOverdue,
    overdueDays: summary.overdueDays,
    dueAt: summary.nextReviewAt,
    lastReviewedAt: summary.lastReviewedAt,
    retrievability: summary.retrievability,
    stability: summary.stability,
    difficulty: summary.difficulty,
    scheduledDays: summary.scheduledDays,
    lapses: summary.lapses,
    reviewCount: summary.reviewCount,
    reviewHistory: input.attempts,
    recentAttempts: input.attempts.slice(-5).reverse(),
    latestAttempt: input.attempts.at(-1) ?? null,
  }
}
```

---

## Zod Contracts

In `src/features/practice/api/practice-contracts.ts`:

```typescript
export const normalizedPracticeStateSchema = z.object({
  problemSlug: z.string(),
  cardId: z.string(),
  status: z.enum(practiceStatuses),
  isSuspended: z.boolean(),
  phase: z.enum(practicePhases),
  isStarted: z.boolean(),
  isDue: z.boolean(),
  isOverdue: z.boolean(),
  overdueDays: z.number().int().min(0),
  dueAt: z.iso.datetime().nullable(),
  lastReviewedAt: z.iso.datetime().nullable(),
  retrievability: z.number().nullable(),
  stability: z.number().nullable(),
  difficulty: z.number().nullable(),
  scheduledDays: z.number().int().min(0).nullable(),
  lapses: z.number().int().min(0),
  reviewCount: z.number().int().min(0),
  reviewHistory: z.array(practiceReviewAttemptSchema),
  recentAttempts: z.array(practiceReviewAttemptSchema),
  latestAttempt: practiceReviewAttemptSchema.nullable(),
})

// Extends the normalized contract with overlay-session fields
export const practiceDetailsSchema = normalizedPracticeStateSchema.extend({
  practice: practiceStateSnapshotSchema.nullable(),
  card: fsrsCardSnapshotSchema.nullable(),
  currentLog: practiceLogSnapshotSchema,
  canOverrideLatestReview: z.boolean(),
})

export type SerializedNormalizedPracticeState = z.infer<typeof normalizedPracticeStateSchema>
export type SerializedPracticeDetails = z.infer<typeof practiceDetailsSchema>
```

`practiceSummarySchema` is removed. `summary` fields in `practiceReviewResultSchema` are left
unchanged (out of scope).

---

## Queue Consumer Update

`QueueCandidate` and `QueueItem` both move from `PracticeSummary` to `NormalizedPracticeState`:

```typescript
// queue/domain/queue.ts
export interface QueueCandidate {
  problem: Problem
  state: NormalizedPracticeState  // replaces practice + card
}

export interface QueueItem {
  category: QueueItemCategory
  problemSlug: ProblemSlug
  title: string
  difficulty: ProblemDifficulty
  isPremium: boolean
  state: NormalizedPracticeState  // replaces summary
}
```

`buildTodayQueue` reads directly from `candidate.state` instead of calling
`derivePracticeSummary`. The Queue service maps its batch SQL rows through
`deriveNormalizedPracticeState` with `attempts: []` — the batch read does not fetch review
history (not needed for scheduling). As a result, `reviewHistory` and `recentAttempts` will
be empty arrays on Queue candidates. This is intentional and correct: Queue only reads
scheduling fields (`isDue`, `isSuspended`, `lapses`, `difficulty`, `dueAt`).

---

## Cleanup: Nothing Left Orphaned

### Removed entirely
- `practiceSummarySchema` — fields now on `normalizedPracticeStateSchema`
- `serializePracticeSummary` — no longer a nested object
- All public exports of the above

### Becomes internal (unexported)
- `PracticeSummary` type — private intermediate, used only inside `deriveNormalizedPracticeState`
- `derivePracticeSummary` — private helper called only by `deriveNormalizedPracticeState`

### Updated callsites

| File | Change |
|---|---|
| `practice/domain/practice.ts` | Add `NormalizedPracticeState`, `deriveNormalizedPracticeState`; unexport `PracticeSummary` + `derivePracticeSummary`; update `PracticeDetails` |
| `practice/domain/index.ts` | Remove exports: `PracticeSummary`, `derivePracticeSummary` |
| `practice/api/practice-contracts.ts` | Remove `practiceSummarySchema`; add `normalizedPracticeStateSchema`; update `practiceDetailsSchema` |
| `practice/api/practice-serializers.ts` | Remove `serializePracticeSummary`; update `serializePracticeDetails` to emit flat fields |
| `practice/index.ts` | Remove: `practiceSummarySchema`, `serializePracticeSummary`, `derivePracticeSummary`, `PracticeSummary`; add: `NormalizedPracticeState`, `normalizedPracticeStateSchema`, `deriveNormalizedPracticeState` |
| `practice/data/practice-repository.ts` | Replace `derivePracticeSummary` calls with `deriveNormalizedPracticeState`; update `getPracticeDetails`; rename `getPracticeSummary` → `getNormalizedPracticeState` |
| `queue/domain/queue.ts` | Replace `QueueCandidate.practice/card` + `QueueItem.summary` with `state: NormalizedPracticeState`; remove `derivePracticeSummary` call |
| `queue/server/queue-service.ts` | Map SQL rows via `deriveNormalizedPracticeState` |
| `problems/data/problems-repository.ts` | Replace `derivePracticeSummary` + `PracticeSummary` with `deriveNormalizedPracticeState` + `NormalizedPracticeState` |
| `problems/api/problems-contracts.ts` | Replace `practiceSummarySchema` with `normalizedPracticeStateSchema` |
| `problems/api/problems-serializers.ts` | Remove `serializePracticeSummary`; serialize flat fields |
| `app-shell/api/app-shell-contracts.ts` | Replace `practiceSummarySchema` with `normalizedPracticeStateSchema` |
| `app-shell/server/app-shell-service.ts` | Remove `serializePracticeSummary`; use flat fields |
| `extension/background/register-handlers.ts` | Remove `serializePracticeSummary` |
| `extension/messaging.ts` | Replace `practiceSummarySchema` with `normalizedPracticeStateSchema` |
| `testing/practice-fixtures.ts` | Replace `createSerializedPracticeSummary` → `createSerializedNormalizedPracticeState` |
| `testing/problem-fixtures.ts` | Update to use new fixture |
| `testing/track-fixtures.ts` | Update to use new fixture |
| `practice/domain/practice.test.ts` | Update tests to use `deriveNormalizedPracticeState` |
| `problems/components/library/problem-library-screen.test.tsx` | Update to use new fixture |
| `app-shell/hooks/use-popup-app-shell-controller.test.tsx` | Update to use new fixture |

---

## Edge Cases

The following must be handled correctly by `deriveNormalizedPracticeState`:

- **Missing practice row** — `practice` is `null`; `status` defaults to `'new'`, `isSuspended` to `false`
- **Suspended problems** — `isSuspended: true` preserved even after reset; `reviewHistory` still populated
- **Reset schedules** — `card` is `null` after reset; all FSRS metrics default to `null`/`0`
- **Invalid serialized FSRS logs** — `parseStoredFsrsReviewLogSnapshot` already catches and returns `null`; no change needed
- **Partial card values from legacy data** — existing `mapCard` null guards are preserved

---

## Acceptance Criteria

- Queue and Analytics consume `NormalizedPracticeState` without importing `derivePracticeSummary`, `PracticeSummary`, `FsrsCardSnapshot`, or `PracticeStateSnapshot`
- Unstarted problems have `status: 'new'`, `isStarted: false`, no null ambiguity
- `PracticeSummary` and `derivePracticeSummary` are not exported from the `practice` feature
- `practiceSummarySchema` and `serializePracticeSummary` are deleted
- All tests pass
