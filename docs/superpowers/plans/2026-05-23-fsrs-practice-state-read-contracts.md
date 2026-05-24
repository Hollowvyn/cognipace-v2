# FSRS Practice State Read Contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce `NormalizedPracticeState` as a single flat read contract consumed by Queue, Analytics, Library, and Tracks — eliminating divergent FSRS field access across consumers.

**Architecture:** A new `NormalizedPracticeState` interface lives in the practice domain and is derived by a single `deriveNormalizedPracticeState()` function. `PracticeDetails` extends it (gaining all flat fields) while retaining raw `practice`/`card` snapshots for the overlay session. Queue, Problems Library, and the app-shell all adopt the new type, replacing direct `PracticeSummary` usage. `PracticeSummary` and `derivePracticeSummary` become internal helpers — unexported from the feature's public API.

**Tech Stack:** TypeScript, Zod v4, Vitest, Drizzle ORM

---

## File Map

**Modified:**
- `src/features/practice/domain/practice.ts` — add `NormalizedPracticeState`, `deriveNormalizedPracticeState`; update `PracticeDetails`; keep `PracticeSummary`/`derivePracticeSummary` as internal unexported
- `src/features/practice/domain/index.ts` — remove `PracticeSummary`, `derivePracticeSummary` exports; add `NormalizedPracticeState`, `deriveNormalizedPracticeState`
- `src/features/practice/api/practice-contracts.ts` — add `normalizedPracticeStateSchema`; update `practiceDetailsSchema`; unexport `practiceSummarySchema`
- `src/features/practice/api/practice-serializers.ts` — add `serializeNormalizedPracticeState`; remove `serializePracticeSummary`; update `serializePracticeDetails`
- `src/features/practice/index.ts` — swap exports
- `src/features/practice/data/practice-repository.ts` — use `deriveNormalizedPracticeState` in `getPracticeDetails`; rename `getPracticeSummary` → `getNormalizedPracticeState`
- `src/features/practice/domain/practice.test.ts` — update tests to use `deriveNormalizedPracticeState`
- `src/features/queue/domain/queue.ts` — replace `QueueCandidate`/`QueueItem` raw fields with `state: NormalizedPracticeState`
- `src/features/queue/server/queue-service.ts` — map SQL rows via `deriveNormalizedPracticeState`
- `src/features/problems/data/problems-repository.ts` — update `ProblemLibraryRow`, `readLibraryRows`, `deriveProblemLibraryStatus`
- `src/features/problems/api/problems-contracts.ts` — replace `practiceSummarySchema` with `normalizedPracticeStateSchema`
- `src/features/problems/api/problems-serializers.ts` — use `serializeNormalizedPracticeState`
- `src/features/problems/components/library/problem-library-columns.tsx` — `row.summary.*` → `row.state.*`
- `src/features/problems/components/problem-row/problem-row-details.tsx` — `row.summary.*` → `row.state.*`
- `src/features/problems/components/problem-row/problem-row-actions.tsx` — `row.summary.suspended` → `row.state.isSuspended`
- `src/features/app-shell/api/app-shell-contracts.ts` — replace `practiceSummarySchema` with `normalizedPracticeStateSchema` in queue item schema
- `src/features/app-shell/server/app-shell-service.ts` — use `serializeNormalizedPracticeState`
- `src/features/app-shell/domain/popup-app-shell.ts` — `item.dueAt` → `item.state.dueAt`; `queueItem.summary.isOverdue` → `queueItem.state.isOverdue`
- `src/extension/messaging.ts` — replace `practiceSummarySchema` with `normalizedPracticeStateSchema` in queue item schema
- `src/extension/background/register-handlers.ts` — use `serializeNormalizedPracticeState`
- `src/testing/practice-fixtures.ts` — replace `createSerializedPracticeSummary` with `createSerializedNormalizedPracticeState`
- `src/testing/problem-fixtures.ts` — use new fixture
- `src/testing/track-fixtures.ts` — use new fixture
- `src/features/problems/data/problems-repository.test.ts` — update field accesses
- `src/features/problems/components/library/problem-library-screen.test.tsx` — update fixtures
- `src/features/app-shell/server/app-shell-service.test.ts` — update fixtures
- `src/features/app-shell/hooks/use-popup-app-shell-controller.test.tsx` — update fixtures

---

## Task 1: Add `NormalizedPracticeState` and `deriveNormalizedPracticeState` (TDD)

**Files:**
- Modify: `src/features/practice/domain/practice.ts`
- Modify: `src/features/practice/domain/practice.test.ts`

- [ ] **Step 1: Write failing tests for `deriveNormalizedPracticeState`**

Add these tests to `src/features/practice/domain/practice.test.ts` (after the existing imports — add `deriveNormalizedPracticeState` to the import list):

```typescript
import {
  deriveNormalizedPracticeState,
  derivePracticeSummary,
  normalizeReviewLogFields,
  statusFromReview,
  type PracticeStateSnapshot,
  type PracticeReviewAttemptSnapshot,
} from './practice'
```

Add a new `describe` block at the end of the file:

```typescript
describe('deriveNormalizedPracticeState', () => {
  it('returns a fully unstarted state when no practice, card, or attempts exist', () => {
    const state = deriveNormalizedPracticeState({
      problemSlug: 'two-sum',
      cardId: 'two-sum:default',
      practice: null,
      card: null,
      attempts: [],
      now: baseNow,
    })

    expect(state).toMatchObject({
      problemSlug: 'two-sum',
      cardId: 'two-sum:default',
      status: 'new',
      isSuspended: false,
      phase: 'new',
      isStarted: false,
      isDue: false,
      isOverdue: false,
      overdueDays: 0,
      dueAt: null,
      lastReviewedAt: null,
      retrievability: null,
      stability: null,
      difficulty: null,
      scheduledDays: null,
      lapses: 0,
      reviewCount: 0,
      reviewHistory: [],
      recentAttempts: [],
      latestAttempt: null,
    })
  })

  it('reflects status and isSuspended from practice row', () => {
    const state = deriveNormalizedPracticeState({
      problemSlug: 'two-sum',
      cardId: 'two-sum:default',
      practice: practiceState({ status: 'review', isSuspended: false }),
      card: null,
      attempts: [],
      now: baseNow,
    })

    expect(state.status).toBe('review')
    expect(state.isSuspended).toBe(false)
  })

  it('sets isSuspended from practice row suspended flag', () => {
    const state = deriveNormalizedPracticeState({
      problemSlug: 'two-sum',
      cardId: 'two-sum:default',
      practice: practiceState({ isSuspended: true, status: 'suspended' }),
      card: reviewedFsrsCard(),
      attempts: [],
      now: new Date('2026-06-01T10:00:00.000Z'),
    })

    expect(state.isSuspended).toBe(true)
    expect(state.phase).toBe('suspended')
    expect(state.isDue).toBe(false)
  })

  it('populates reviewHistory and recentAttempts correctly', () => {
    const attempt = makeAttempt('attempt-1')
    const state = deriveNormalizedPracticeState({
      problemSlug: 'two-sum',
      cardId: 'two-sum:default',
      practice: null,
      card: null,
      attempts: [attempt],
      now: baseNow,
    })

    expect(state.reviewHistory).toEqual([attempt])
    expect(state.recentAttempts).toEqual([attempt])
    expect(state.latestAttempt).toEqual(attempt)
  })

  it('caps recentAttempts at 5 and reverses them, keeping reviewHistory full', () => {
    const attempts = Array.from({ length: 7 }, (_, i) =>
      makeAttempt(`attempt-${i + 1}`),
    )
    const state = deriveNormalizedPracticeState({
      problemSlug: 'two-sum',
      cardId: 'two-sum:default',
      practice: null,
      card: null,
      attempts,
      now: baseNow,
    })

    expect(state.reviewHistory).toHaveLength(7)
    expect(state.recentAttempts).toHaveLength(5)
    // recentAttempts should be the last 5, reversed (most recent first)
    expect(state.recentAttempts[0]).toEqual(attempts[6])
    expect(state.recentAttempts[4]).toEqual(attempts[2])
    expect(state.latestAttempt).toEqual(attempts[6])
  })
})

function makeAttempt(id: string): PracticeReviewAttemptSnapshot {
  return {
    id,
    problemSlug: 'two-sum',
    cardId: 'two-sum:default',
    rating: 'good',
    reviewMode: 'manual',
    reviewedAt: reviewedAt,
    elapsedSeconds: null,
    isCorrect: null,
    log: {
      interviewPattern: null,
      timeComplexity: null,
      spaceComplexity: null,
      languages: null,
      notes: null,
    },
    createdAt: reviewedAt,
    updatedAt: reviewedAt,
  }
}
```

- [ ] **Step 2: Run the tests — confirm they fail**

```bash
npx vitest run src/features/practice/domain/practice.test.ts
```

Expected: FAIL with "deriveNormalizedPracticeState is not a function" (or similar import error).

- [ ] **Step 3: Add `NormalizedPracticeState` interface and `deriveNormalizedPracticeState` function to `practice.ts`**

Open `src/features/practice/domain/practice.ts`.

After the existing `PracticeDetails` interface (around line 158), add:

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
  reviewHistory: PracticeReviewAttemptSnapshot[]  // full list
  recentAttempts: PracticeReviewAttemptSnapshot[] // last 5
  latestAttempt: PracticeReviewAttemptSnapshot | null
}
```

After `derivePracticeSummary`, add:

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

- [ ] **Step 4: Run the tests — confirm they pass**

```bash
npx vitest run src/features/practice/domain/practice.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/practice/domain/practice.ts src/features/practice/domain/practice.test.ts
git commit -m "feat: add NormalizedPracticeState type and deriveNormalizedPracticeState"
```

---

## Task 2: Update `PracticeDetails` to extend `NormalizedPracticeState`

**Files:**
- Modify: `src/features/practice/domain/practice.ts`
- Modify: `src/features/practice/domain/index.ts`

- [ ] **Step 1: Replace `PracticeDetails` interface in `practice.ts`**

Find the existing `PracticeDetails` interface (around line 148) and replace it:

```typescript
// Before:
export interface PracticeDetails {
  problemSlug: ProblemSlug
  cardId: string
  practice: PracticeStateSnapshot | null
  card: FsrsCardSnapshot | null
  summary: PracticeSummary
  currentLog: Required<PracticeLogFields>
  recentAttempts: PracticeReviewAttemptSnapshot[]
  latestAttempt: PracticeReviewAttemptSnapshot | null
  canOverrideLatestReview: boolean
}

// After:
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
}
```

Note: `summary`, `recentAttempts`, and `latestAttempt` are removed from `PracticeDetails` — they are now inherited from `NormalizedPracticeState`.

- [ ] **Step 2: Update `practice/domain/index.ts` exports**

Replace the current contents of `src/features/practice/domain/index.ts`:

```typescript
export {
  deriveNormalizedPracticeState,
  derivePracticeSummary,
  normalizeReviewLogFields,
  parsePracticeStatus,
  practicePhases,
  practiceStatuses,
  reviewModes,
  statusFromReview,
  type NormalizedPracticeState,
  type OverrideLastReviewResultInput,
  type PracticeDetails,
  type PracticePhase,
  type PracticeLogFields,
  type PracticeReviewAttemptSnapshot,
  type PracticeReadOptions,
  type PracticeStateSnapshot,
  type PracticeStatus,
  type PracticeSummary,
  type ReviewMode,
  type ReviewResult,
  type ResetPracticeScheduleInput,
  type SaveReviewResultInput,
  type SetPracticeSuspendedInput,
  type UpdatePracticeLogInput,
} from './practice'
```

Key changes: add `deriveNormalizedPracticeState` and `NormalizedPracticeState`; keep `derivePracticeSummary` and `PracticeSummary` (still used internally by practice-repository for `ReviewResult`).

- [ ] **Step 3: Run tests to confirm no regressions**

```bash
npx vitest run src/features/practice
```

Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add src/features/practice/domain/practice.ts src/features/practice/domain/index.ts
git commit -m "feat: PracticeDetails extends NormalizedPracticeState"
```

---

## Task 3: Update Zod contracts in `practice-contracts.ts`

**Files:**
- Modify: `src/features/practice/api/practice-contracts.ts`
- Modify: `src/features/practice/api/practice-contracts.test.ts` (if it exists)

- [ ] **Step 1: Add `normalizedPracticeStateSchema` and update `practiceDetailsSchema`**

Open `src/features/practice/api/practice-contracts.ts`.

After the existing `practiceReviewAttemptSchema`, add:

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

export type SerializedNormalizedPracticeState = z.infer<typeof normalizedPracticeStateSchema>
```

Replace the existing `practiceDetailsSchema` with:

```typescript
// Extends the normalized contract with overlay-session fields
export const practiceDetailsSchema = normalizedPracticeStateSchema.extend({
  practice: practiceStateSnapshotSchema.nullable(),
  card: fsrsCardSnapshotSchema.nullable(),
  currentLog: practiceLogSnapshotSchema,
  canOverrideLatestReview: z.boolean(),
})

export type SerializedPracticeDetails = z.infer<typeof practiceDetailsSchema>
```

Remove the `export` keyword from `practiceSummarySchema` (keep it for internal use by `practiceReviewResultSchema`):

```typescript
// Change:
export const practiceSummarySchema = z.object({
// To:
const practiceSummarySchema = z.object({
```

- [ ] **Step 2: Run the practice contracts test if it exists**

```bash
npx vitest run src/features/practice/api/practice-contracts.test.ts
```

If no test file exists, skip this step.

- [ ] **Step 3: Commit**

```bash
git add src/features/practice/api/practice-contracts.ts
git commit -m "feat: add normalizedPracticeStateSchema; practiceDetailsSchema extends it"
```

---

## Task 4: Update practice serializer

**Files:**
- Modify: `src/features/practice/api/practice-serializers.ts`

- [ ] **Step 1: Rewrite `practice-serializers.ts`**

Replace the entire file with:

```typescript
import type { NormalizedPracticeState } from '../domain'
import type {
  PracticeDetails,
  PracticeLogFields,
  PracticeReviewAttemptSnapshot,
  PracticeSummary,
  ReviewResult,
} from '../domain'
import {
  normalizedPracticeStateSchema,
  practiceDetailsSchema,
  practiceReviewResultSchema,
  type SerializedNormalizedPracticeState,
  type SerializedPracticeDetails,
  type SerializedReviewResult,
} from './practice-contracts'

export function serializeNormalizedPracticeState(
  state: NormalizedPracticeState,
): SerializedNormalizedPracticeState {
  return normalizedPracticeStateSchema.parse({
    ...state,
    dueAt: state.dueAt?.toISOString() ?? null,
    lastReviewedAt: state.lastReviewedAt?.toISOString() ?? null,
    reviewHistory: state.reviewHistory.map(serializePracticeAttempt),
    recentAttempts: state.recentAttempts.map(serializePracticeAttempt),
    latestAttempt: state.latestAttempt
      ? serializePracticeAttempt(state.latestAttempt)
      : null,
  })
}

export function serializePracticeDetails(
  details: PracticeDetails,
): SerializedPracticeDetails {
  return practiceDetailsSchema.parse({
    ...serializeNormalizedPracticeState(details),
    practice: details.practice
      ? serializePracticeState(details.practice)
      : null,
    card: details.card
      ? {
          ...details.card,
          dueAt: details.card.dueAt.toISOString(),
          lastReviewAt: details.card.lastReviewAt?.toISOString() ?? null,
        }
      : null,
    currentLog: serializePracticeLog(details.currentLog),
    canOverrideLatestReview: details.canOverrideLatestReview,
  })
}

export function serializeReviewResult(
  result: ReviewResult,
): SerializedReviewResult {
  return practiceReviewResultSchema.parse({
    problemSlug: result.problemSlug,
    cardId: result.cardId,
    rating: result.rating,
    status: result.status,
    dueAt: result.dueAt.toISOString(),
    reviewedAt: result.reviewedAt.toISOString(),
    summary: serializePracticeResultSummary(result.summary),
  })
}

function serializePracticeResultSummary(summary: PracticeSummary) {
  return {
    ...summary,
    nextReviewAt: summary.nextReviewAt?.toISOString() ?? null,
    lastReviewedAt: summary.lastReviewedAt?.toISOString() ?? null,
  }
}

function serializePracticeState(
  practice: NonNullable<PracticeDetails['practice']>,
) {
  return {
    ...practice,
    lastReviewedAt: practice.lastReviewedAt?.toISOString() ?? null,
    log: serializePracticeLog(practice.log),
  }
}

function serializePracticeAttempt(attempt: PracticeReviewAttemptSnapshot) {
  return {
    ...attempt,
    reviewedAt: attempt.reviewedAt.toISOString(),
    log: serializePracticeLog(attempt.log),
    createdAt: attempt.createdAt.toISOString(),
    updatedAt: attempt.updatedAt.toISOString(),
  }
}

function serializePracticeLog(log: Required<PracticeLogFields>) {
  return {
    interviewPattern: log.interviewPattern ?? null,
    timeComplexity: log.timeComplexity ?? null,
    spaceComplexity: log.spaceComplexity ?? null,
    languages: log.languages ?? null,
    notes: log.notes ?? null,
  }
}
```

- [ ] **Step 2: Run practice API tests**

```bash
npx vitest run src/features/practice/api
```

Expected: All pass.

- [ ] **Step 3: Commit**

```bash
git add src/features/practice/api/practice-serializers.ts
git commit -m "feat: add serializeNormalizedPracticeState; remove serializePracticeSummary"
```

---

## Task 5: Update practice repository

**Files:**
- Modify: `src/features/practice/data/practice-repository.ts`

- [ ] **Step 1: Update imports in `practice-repository.ts`**

Replace the domain import block (the one starting with `derivePracticeSummary`) with:

```typescript
import {
  deriveNormalizedPracticeState,
  derivePracticeSummary,
  normalizeReviewLogFields,
  parsePracticeStatus,
  reviewModes,
  statusFromReview,
  type NormalizedPracticeState,
  type OverrideLastReviewResultInput,
  type PracticeDetails,
  type PracticeLogFields,
  type PracticeReviewAttemptSnapshot,
  type PracticeReadOptions,
  type PracticeStateSnapshot,
  type PracticeSummary,
  type ReviewMode,
  type ReviewResult,
  type ResetPracticeScheduleInput,
  type SaveReviewResultInput,
  type SetPracticeSuspendedInput,
  type UpdatePracticeLogInput,
} from '../domain'
```

- [ ] **Step 2: Replace `getPracticeDetails` method**

Find the `getPracticeDetails` method (around line 335) and replace it:

```typescript
async getPracticeDetails(
  problemSlug: string,
  options: PracticeReadOptions = {},
): Promise<PracticeDetails> {
  const cardKind = options.cardKind ?? defaultFsrsCardKind
  const cardId = createFsrsCardId(problemSlug, cardKind)
  const [practice, card, attempts] = await Promise.all([
    this.getPracticeState(problemSlug),
    this.getCard(problemSlug, cardKind),
    this.readReviewAttempts(this.db, { problemSlug, cardId }),
  ])
  const attemptSnapshots = attempts.map(toReviewAttemptSnapshot)
  const normalized = deriveNormalizedPracticeState({
    problemSlug,
    cardId,
    practice,
    card,
    attempts: attemptSnapshots,
    now: options.now,
    targetRetention: options.targetRetention,
  })

  return {
    ...normalized,
    practice,
    card,
    currentLog: practice?.log ?? normalizeReviewLogFields(),
    canOverrideLatestReview: normalized.latestAttempt !== null,
  }
}
```

- [ ] **Step 3: Rename `getPracticeSummary` to `getNormalizedPracticeState`**

Find `getPracticeSummary` (around line 369) and replace it:

```typescript
async getNormalizedPracticeState(
  problemSlug: string,
  options: PracticeReadOptions = {},
): Promise<NormalizedPracticeState> {
  return this.getPracticeDetails(problemSlug, options)
}
```

- [ ] **Step 4: Run the practice integration test**

```bash
npx vitest run src/features/practice/practice-core.integration.test.ts
```

Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/practice/data/practice-repository.ts
git commit -m "feat: practice repository uses deriveNormalizedPracticeState"
```

---

## Task 6: Update practice feature public exports

**Files:**
- Modify: `src/features/practice/index.ts`

- [ ] **Step 1: Replace the contents of `src/features/practice/index.ts`**

```typescript
export {
  getPracticeDetailsViaRuntime,
  overrideLastReviewResultViaRuntime,
  resetPracticeScheduleViaRuntime,
  saveReviewResultViaRuntime,
  setPracticeSuspendedViaRuntime,
  updateCurrentPracticeLogViaRuntime,
  usePracticeDetails,
  useOverrideLastReviewResult,
  useResetPracticeSchedule,
  useSaveReviewResult,
  useSetPracticeSuspended,
  useUpdateCurrentPracticeLog,
  type RuntimePracticeDetails,
} from './api/practice-api'
export {
  fsrsCardSnapshotSchema,
  normalizedPracticeStateSchema,
  practiceDetailsRequestSchema,
  practiceDetailsSchema,
  practiceLogPatchSchema,
  practiceLogSnapshotSchema,
  practiceOverrideLastReviewResultRequestSchema,
  practiceResetScheduleRequestSchema,
  practiceReviewAttemptSchema,
  practiceReviewResultSchema,
  practiceRuntimeSurfaceSchema,
  practiceSaveReviewResultRequestSchema,
  practiceSetSuspendedRequestSchema,
  practiceStateSnapshotSchema,
  practiceUpdateCurrentLogRequestSchema,
  type PracticeDetailsRequest,
  type PracticeOverrideLastReviewResultRequest,
  type PracticeResetScheduleRequest,
  type PracticeSaveReviewResultRequest,
  type PracticeSetSuspendedRequest,
  type PracticeUpdateCurrentLogRequest,
  type SerializedNormalizedPracticeState,
  type SerializedPracticeDetails,
  type SerializedReviewResult,
} from './api/practice-contracts'
export {
  serializeNormalizedPracticeState,
  serializePracticeDetails,
  serializeReviewResult,
} from './api/practice-serializers'
export {
  deriveNormalizedPracticeState,
  normalizeReviewLogFields,
  practiceStatuses,
  reviewModes,
  statusFromReview,
  type NormalizedPracticeState,
  type OverrideLastReviewResultInput,
  type PracticeDetails,
  type PracticeLogFields,
  type PracticeReviewAttemptSnapshot,
  type PracticeReadOptions,
  type PracticeStateSnapshot,
  type PracticeStatus,
  type ReviewMode,
  type ReviewResult,
  type ResetPracticeScheduleInput,
  type SaveReviewResultInput,
  type SetPracticeSuspendedInput,
  type UpdatePracticeLogInput,
} from './domain'
```

Key removals: `practiceSummarySchema`, `serializePracticeSummary`, `derivePracticeSummary`, `PracticeSummary`.  
Key additions: `normalizedPracticeStateSchema`, `serializeNormalizedPracticeState`, `deriveNormalizedPracticeState`, `NormalizedPracticeState`, `SerializedNormalizedPracticeState`.

- [ ] **Step 2: Run TypeScript type check to surface all broken import sites**

```bash
npx tsc --noEmit 2>&1 | head -60
```

This output tells you exactly which files need updates in Tasks 7–12. Keep this output handy.

- [ ] **Step 3: Commit**

```bash
git add src/features/practice/index.ts
git commit -m "feat: update practice feature public exports for normalized contract"
```

---

## Task 7: Update Queue domain and service

**Files:**
- Modify: `src/features/queue/domain/queue.ts`
- Modify: `src/features/queue/server/queue-service.ts`

- [ ] **Step 1: Rewrite `queue/domain/queue.ts`**

Replace the entire file:

```typescript
import type {
  Problem,
  ProblemDifficulty,
  ProblemSlug,
} from '@/features/problems'
import {
  deriveNormalizedPracticeState,
  type NormalizedPracticeState,
} from '@/features/practice'
import type { UserSettings } from '@/features/settings'
import type { FsrsCardSnapshot } from '@/lib/fsrs'

import type { PracticeStateSnapshot } from '@/features/practice'

export type QueueItemCategory = 'due' | 'new' | 'reinforcement'

export interface QueueCandidate {
  problem: Problem
  state: NormalizedPracticeState
}

export interface QueueItem {
  category: QueueItemCategory
  problemSlug: ProblemSlug
  title: string
  difficulty: ProblemDifficulty
  isPremium: boolean
  state: NormalizedPracticeState
}

export interface TodayQueue {
  generatedAt: Date
  dailyGoal: number
  dueCount: number
  newCount: number
  reinforcementCount: number
  items: QueueItem[]
}

export function buildTodayQueue(
  candidates: QueueCandidate[],
  settings: UserSettings,
  generatedAt = new Date(),
): TodayQueue {
  const dailyGoal = Math.max(0, Math.round(settings.practice.dailyGoal))
  const partitioned = partitionQueueCandidates(
    candidates,
    settings,
    generatedAt,
  )
  const dueItems = orderQueueItems(partitioned.due, settings.review.order)
  const newItems = orderQueueItems(partitioned.new, settings.review.order)
  const reinforcementItems = orderQueueItems(
    partitioned.reinforcement,
    settings.review.order,
  )
  const dueForQueue = dueItems.slice(0, dailyGoal)
  const slotsAfterDue = Math.max(0, dailyGoal - dueForQueue.length)
  const newForQueue = newItems.slice(0, slotsAfterDue)
  const reinforcementSlots = Math.max(0, slotsAfterDue - newForQueue.length)
  const reinforcementForQueue = reinforcementItems.slice(0, reinforcementSlots)

  return {
    generatedAt,
    dailyGoal,
    dueCount: dueItems.length,
    newCount: newItems.length,
    reinforcementCount: reinforcementItems.length,
    items: [...dueForQueue, ...newForQueue, ...reinforcementForQueue],
  }
}

function partitionQueueCandidates(
  candidates: QueueCandidate[],
  settings: UserSettings,
  generatedAt: Date,
) {
  const partitions: Record<QueueItemCategory, QueueItem[]> = {
    due: [],
    new: [],
    reinforcement: [],
  }

  for (const candidate of candidates) {
    if (isEffectivelySuspended(candidate, settings)) {
      continue
    }

    const { state } = candidate

    if (state.isDue) {
      partitions.due.push(mapQueueItem(candidate, 'due'))
      continue
    }

    if (!state.isStarted) {
      continue
    }

    partitions.reinforcement.push(mapQueueItem(candidate, 'reinforcement'))
  }

  return partitions
}

function isEffectivelySuspended(
  candidate: QueueCandidate,
  settings: UserSettings,
) {
  return (
    candidate.state.isSuspended ||
    candidate.state.status === 'mastered' ||
    candidate.state.status === 'suspended' ||
    (settings.practice.problemFilters.skipPremium &&
      candidate.problem.isPremium)
  )
}

function mapQueueItem(
  candidate: QueueCandidate,
  category: QueueItemCategory,
): QueueItem {
  return {
    category,
    problemSlug: candidate.problem.slug,
    title: candidate.problem.title,
    difficulty: candidate.problem.difficulty,
    isPremium: candidate.problem.isPremium,
    state: candidate.state,
  }
}

function orderQueueItems(
  items: QueueItem[],
  strategy: UserSettings['review']['order'],
): QueueItem[] {
  if (strategy === 'weakestFirst') {
    return sortByWeakest(items)
  }

  if (strategy === 'mixByDifficulty') {
    return interleaveByDifficulty(items)
  }

  return sortByDueThenPosition(items)
}

function sortByDueThenPosition(items: QueueItem[]) {
  return [...items].sort((left, right) => {
    const dueComparison = compareDates(left.state.dueAt, right.state.dueAt)

    if (dueComparison !== 0) {
      return dueComparison
    }

    return left.problemSlug.localeCompare(right.problemSlug)
  })
}

function sortByWeakest(items: QueueItem[]) {
  return [...items].sort((left, right) => {
    if (right.state.lapses !== left.state.lapses) {
      return right.state.lapses - left.state.lapses
    }

    if ((right.state.difficulty ?? 0) !== (left.state.difficulty ?? 0)) {
      return (right.state.difficulty ?? 0) - (left.state.difficulty ?? 0)
    }

    return sortByDueThenPosition([left, right])[0] === left ? -1 : 1
  })
}

function interleaveByDifficulty(items: QueueItem[]) {
  const buckets: Record<ProblemDifficulty, QueueItem[]> = {
    easy: [],
    medium: [],
    hard: [],
    unknown: [],
  }

  for (const item of sortByDueThenPosition(items)) {
    buckets[item.difficulty].push(item)
  }

  const difficultyOrder: ProblemDifficulty[] = [
    'easy',
    'medium',
    'hard',
    'unknown',
  ]
  const orderedItems: QueueItem[] = []
  let addedItem = true

  while (addedItem) {
    addedItem = false

    for (const difficulty of difficultyOrder) {
      const item = buckets[difficulty].shift()

      if (item) {
        orderedItems.push(item)
        addedItem = true
      }
    }
  }

  return orderedItems
}

function compareDates(left: Date | null, right: Date | null) {
  return (
    (left?.getTime() ?? Number.MAX_SAFE_INTEGER) -
    (right?.getTime() ?? Number.MAX_SAFE_INTEGER)
  )
}
```

- [ ] **Step 2: Update `queue-service.ts` — add `deriveNormalizedPracticeState` to imports and update `mapQueueCandidate`**

At the top of `src/features/queue/server/queue-service.ts`, update the practice imports:

```typescript
import {
  deriveNormalizedPracticeState,
  normalizeReviewLogFields,
  parsePracticeStatus,
  type PracticeStateSnapshot,
} from '@/features/practice/domain'
```

(Remove the `type PracticeSummary` import if present.)

Update `mapQueueCandidate` (the function that maps a raw SQL row to `QueueCandidate`):

```typescript
function mapQueueCandidate(row: {
  problem: QueueProblemRow
  practice: QueuePracticeRow | null
  card: QueueCardRow | null
}): QueueCandidate {
  const problemSlug = row.problem.slug
  const cardId = `${problemSlug}:${defaultFsrsCardKind}`
  const practice = mapPractice(row.practice)
  const card = mapCard(row.card)

  return {
    problem: mapProblem(row.problem),
    state: deriveNormalizedPracticeState({
      problemSlug,
      cardId,
      practice,
      card,
      attempts: [],
    }),
  }
}
```

- [ ] **Step 3: Run the queue tests**

```bash
npx vitest run src/features/queue
```

Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add src/features/queue/domain/queue.ts src/features/queue/server/queue-service.ts
git commit -m "feat: queue uses NormalizedPracticeState instead of raw practice/card"
```

---

## Task 8: Update app-shell contracts, service, and popup domain

**Files:**
- Modify: `src/features/app-shell/api/app-shell-contracts.ts`
- Modify: `src/features/app-shell/server/app-shell-service.ts`
- Modify: `src/features/app-shell/domain/popup-app-shell.ts`

- [ ] **Step 1: Update `app-shell-contracts.ts`**

Change the import at the top:

```typescript
import {
  normalizedPracticeStateSchema,
  practiceDetailsSchema,
} from '@/features/practice/api/practice-contracts'
```

Replace `appShellQueueItemSchema`:

```typescript
const appShellQueueItemSchema = z.object({
  category: z.enum(['due', 'new', 'reinforcement']),
  problem: appShellProblemSummarySchema,
  state: normalizedPracticeStateSchema,
})
```

- [ ] **Step 2: Update `app-shell-service.ts`**

Change the serializer import:

```typescript
import {
  serializeNormalizedPracticeState,
  serializePracticeDetails,
} from '@/features/practice/api/practice-serializers'
```

Replace the `serializeQueueItem` function:

```typescript
function serializeQueueItem(item: QueueItem): AppShellQueueItem {
  return {
    category: item.category,
    problem: {
      problemSlug: item.problemSlug,
      title: item.title,
      difficulty: item.difficulty,
      isPremium: item.isPremium,
    },
    state: serializeNormalizedPracticeState(item.state),
  }
}
```

Update `serializeOverlayNextStep` — `recommendation.dueAt` becomes `recommendation.state.dueAt`:

```typescript
if (recommendation) {
  return {
    kind: 'recommendation',
    title: recommendation.problem.title,
    detail: `${formatQueueCategory(recommendation.category)} · ${formatDifficulty(recommendation.problem.difficulty)}`,
    problem: recommendation.problem,
    category: recommendation.category,
    dueAt: recommendation.state.dueAt,
  }
}
```

- [ ] **Step 3: Update `popup-app-shell.ts`**

In `buildAppShellRecommendation`, change `dueAt: item.dueAt` to:

```typescript
dueAt: item.state.dueAt,
```

In `createPopupRecommendationView`, change `queueItem?.summary.isOverdue` to:

```typescript
isOverdue: queueItem?.state.isOverdue ?? false,
```

- [ ] **Step 4: Run app-shell tests**

```bash
npx vitest run src/features/app-shell
```

Expected: All pass (fixture failures handled in Task 12).

- [ ] **Step 5: Commit**

```bash
git add src/features/app-shell/api/app-shell-contracts.ts src/features/app-shell/server/app-shell-service.ts src/features/app-shell/domain/popup-app-shell.ts
git commit -m "feat: app-shell uses NormalizedPracticeState for queue items"
```

---

## Task 9: Update problems domain, contracts, serializers, and UI components

**Files:**
- Modify: `src/features/problems/data/problems-repository.ts`
- Modify: `src/features/problems/api/problems-contracts.ts`
- Modify: `src/features/problems/api/problems-serializers.ts`
- Modify: `src/features/problems/components/library/problem-library-columns.tsx`
- Modify: `src/features/problems/components/problem-row/problem-row-details.tsx`
- Modify: `src/features/problems/components/problem-row/problem-row-actions.tsx`

- [ ] **Step 1: Update `problems-repository.ts` domain type and `readLibraryRows`**

Update the import block at the top — replace:

```typescript
import {
  derivePracticeSummary,
  normalizeReviewLogFields,
  parsePracticeStatus,
  type PracticeSummary,
  type PracticeStateSnapshot,
} from '@/features/practice/domain'
```

With:

```typescript
import {
  deriveNormalizedPracticeState,
  normalizeReviewLogFields,
  parsePracticeStatus,
  type NormalizedPracticeState,
  type PracticeStateSnapshot,
} from '@/features/practice/domain'
```

Update `ProblemLibraryRow` interface (around line 835):

```typescript
export interface ProblemLibraryRow {
  problem: Problem
  status: ProblemLibraryStatus
  state: NormalizedPracticeState
  nextReviewAt: Date | null
  lastReviewedAt: Date | null
  lastSolvedAt: Date | null
  topics: ProblemTaxonomyLabel[]
  companies: ProblemTaxonomyLabel[]
  trackMemberships: ProblemTrackMembership[]
}
```

Update `deriveProblemLibraryStatus` (around line 529):

```typescript
function deriveProblemLibraryStatus(
  state: NormalizedPracticeState,
): ProblemLibraryStatus {
  if (state.isSuspended) {
    return 'suspended'
  }

  if (state.isDue) {
    return 'due'
  }

  return state.isStarted ? 'scheduled' : 'not-started'
}
```

Update `readLibraryRows` — replace the `derivePracticeSummary` call and row construction (around lines 341-358):

```typescript
const state = deriveNormalizedPracticeState({
  problemSlug: problem.slug,
  cardId: `${problem.slug}:${defaultFsrsCardKind}`,
  practice,
  card,
  attempts: [],
  now: options.now,
  targetRetention: options.targetRetention,
})

return {
  problem,
  status: deriveProblemLibraryStatus(state),
  state,
  nextReviewAt: state.dueAt,
  lastReviewedAt: state.lastReviewedAt,
  lastSolvedAt: lastSolvedBySlug.get(problem.slug) ?? null,
  topics: topicsBySlug.get(problem.slug) ?? [],
  companies: companiesBySlug.get(problem.slug) ?? [],
  trackMemberships: tracksBySlug.get(problem.slug) ?? [],
} satisfies ProblemLibraryRow
```

- [ ] **Step 2: Update `problems-contracts.ts`**

Change the import:

```typescript
import { normalizedPracticeStateSchema } from '@/features/practice/api/practice-contracts'
```

In `problemLibraryRowSchema`, replace `summary: practiceSummarySchema` with:

```typescript
state: normalizedPracticeStateSchema,
```

- [ ] **Step 3: Update `problems-serializers.ts`**

Change the import:

```typescript
import { serializeNormalizedPracticeState } from '@/features/practice/api/practice-serializers'
```

Update `serializeProblemLibraryRow`:

```typescript
export function serializeProblemLibraryRow(row: DomainProblemLibraryRow) {
  return problemLibraryRowSchema.parse({
    ...row,
    problem: serializeProblem(row.problem),
    state: serializeNormalizedPracticeState(row.state),
    nextReviewAt: row.nextReviewAt?.toISOString() ?? null,
    lastReviewedAt: row.lastReviewedAt?.toISOString() ?? null,
    lastSolvedAt: row.lastSolvedAt?.toISOString() ?? null,
  })
}
```

- [ ] **Step 4: Update `problem-library-columns.tsx`**

Change these two lines (around lines 79 and 86):

```typescript
// Before:
accessorFn: (row) => row.summary.retrievability ?? undefined,
// After:
accessorFn: (row) => row.state.retrievability ?? undefined,

// Before:
{formatPercentMetric(row.original.summary.retrievability)}
// After:
{formatPercentMetric(row.original.state.retrievability)}
```

- [ ] **Step 5: Update `problem-row-details.tsx`**

Replace all `row.summary.*` accesses:

```typescript
// Before → After:
row.summary.stability        → row.state.stability
row.summary.difficulty       → row.state.difficulty
row.summary.retrievability   → row.state.retrievability
row.summary.reviewCount      → row.state.reviewCount
```

- [ ] **Step 6: Update `problem-row-actions.tsx`**

Change line 38:

```typescript
// Before:
const isSuspended = row.summary.suspended || row.status === 'suspended'
// After:
const isSuspended = row.state.isSuspended || row.status === 'suspended'
```

- [ ] **Step 7: Run problems tests**

```bash
npx vitest run src/features/problems
```

Expected: All pass (fixture failures handled in Task 12).

- [ ] **Step 8: Commit**

```bash
git add src/features/problems/data/problems-repository.ts src/features/problems/api/problems-contracts.ts src/features/problems/api/problems-serializers.ts src/features/problems/components/library/problem-library-columns.tsx src/features/problems/components/problem-row/problem-row-details.tsx src/features/problems/components/problem-row/problem-row-actions.tsx
git commit -m "feat: problems library uses NormalizedPracticeState"
```

---

## Task 10: Update extension messaging and register-handlers

**Files:**
- Modify: `src/extension/messaging.ts`
- Modify: `src/extension/background/register-handlers.ts`

- [ ] **Step 1: Update `messaging.ts`**

Remove the `practiceSummarySchema` import. Add:

```typescript
import { normalizedPracticeStateSchema } from '@/features/practice/api/practice-contracts'
```

Replace `queueItemSchema`:

```typescript
export const queueItemSchema = z.object({
  category: z.enum(['due', 'new', 'reinforcement']),
  problemSlug: problemSlugSchema,
  title: z.string(),
  difficulty: problemDifficultySchema,
  isPremium: z.boolean(),
  state: normalizedPracticeStateSchema,
})
```

- [ ] **Step 2: Update `register-handlers.ts`**

Remove the `serializePracticeSummary` import. Add:

```typescript
import { serializeNormalizedPracticeState } from '@/features/practice/api/practice-serializers'
```

Replace the `serializeTodayQueue` function:

```typescript
function serializeTodayQueue(queue: TodayQueue): SerializedTodayQueue {
  return todayQueueSchema.parse({
    generatedAt: queue.generatedAt.toISOString(),
    dailyGoal: queue.dailyGoal,
    dueCount: queue.dueCount,
    newCount: queue.newCount,
    reinforcementCount: queue.reinforcementCount,
    items: queue.items.map((item) => ({
      category: item.category,
      problemSlug: item.problemSlug,
      title: item.title,
      difficulty: item.difficulty,
      isPremium: item.isPremium,
      state: serializeNormalizedPracticeState(item.state),
    })),
  })
}
```

- [ ] **Step 3: Run background handler tests**

```bash
npx vitest run src/extension/background
```

Expected: All pass (fixture failures handled in Task 12).

- [ ] **Step 4: Commit**

```bash
git add src/extension/messaging.ts src/extension/background/register-handlers.ts
git commit -m "feat: extension messaging uses NormalizedPracticeState for queue items"
```

---

## Task 11: Update testing fixtures

**Files:**
- Modify: `src/testing/practice-fixtures.ts`
- Modify: `src/testing/problem-fixtures.ts`
- Modify: `src/testing/track-fixtures.ts`

- [ ] **Step 1: Rewrite `practice-fixtures.ts`**

Replace the entire file:

```typescript
import type {
  SerializedNormalizedPracticeState,
  SerializedPracticeDetails,
} from '@/features/practice/api/practice-contracts'

export function createSerializedNormalizedPracticeState(
  overrides: Partial<SerializedNormalizedPracticeState> = {},
): SerializedNormalizedPracticeState {
  return {
    problemSlug: 'two-sum',
    cardId: 'two-sum:default',
    status: 'new',
    isSuspended: false,
    phase: 'new',
    isStarted: false,
    isDue: false,
    isOverdue: false,
    overdueDays: 0,
    dueAt: null,
    lastReviewedAt: null,
    retrievability: null,
    stability: null,
    difficulty: null,
    scheduledDays: null,
    lapses: 0,
    reviewCount: 0,
    reviewHistory: [],
    recentAttempts: [],
    latestAttempt: null,
    ...overrides,
  }
}

export function createSerializedPracticeDetails(
  overrides: Partial<SerializedPracticeDetails> = {},
): SerializedPracticeDetails {
  return {
    ...createSerializedNormalizedPracticeState(),
    practice: null,
    card: null,
    currentLog: {
      interviewPattern: null,
      timeComplexity: null,
      spaceComplexity: null,
      languages: null,
      notes: null,
    },
    canOverrideLatestReview: false,
    ...overrides,
  }
}
```

- [ ] **Step 2: Update `problem-fixtures.ts`**

Find the import of `createSerializedPracticeSummary` and replace it with `createSerializedNormalizedPracticeState`. Replace all usages:

```typescript
import { createSerializedNormalizedPracticeState } from './practice-fixtures'

// Wherever createSerializedPracticeSummary() was used, replace with:
// createSerializedNormalizedPracticeState()
// And rename the field from `summary:` to `state:`
```

- [ ] **Step 3: Update `track-fixtures.ts`**

Same pattern as Step 2 — replace `createSerializedPracticeSummary` with `createSerializedNormalizedPracticeState`, rename field from `summary:` to `state:`.

- [ ] **Step 4: Commit**

```bash
git add src/testing/practice-fixtures.ts src/testing/problem-fixtures.ts src/testing/track-fixtures.ts
git commit -m "test: replace createSerializedPracticeSummary with createSerializedNormalizedPracticeState"
```

---

## Task 12: Fix remaining test callsites

**Files:**
- Modify: `src/features/problems/data/problems-repository.test.ts`
- Modify: `src/features/problems/components/library/problem-library-screen.test.tsx`
- Modify: `src/features/app-shell/server/app-shell-service.test.ts`
- Modify: `src/features/app-shell/hooks/use-popup-app-shell-controller.test.tsx`

- [ ] **Step 1: Run the full test suite and note failures**

```bash
npx vitest run 2>&1 | grep -E "FAIL|×"
```

- [ ] **Step 2: Fix `problems-repository.test.ts`**

Replace field access changes:

```typescript
// Line 277 — Before:
expect(rows[0]?.summary.nextReviewAt).toEqual(rows[0]?.nextReviewAt)
// After:
expect(rows[0]?.state.dueAt).toEqual(rows[0]?.nextReviewAt)

// Lines 321-323 — Before:
expect(rowWithUndefinedRetention[0]?.summary.retrievability).toBeNull()
expect(rowWithUndefinedRetention[0]?.summary.retrievability).toBeLessThan(...)
// After:
expect(rowWithUndefinedRetention[0]?.state.retrievability).toBeNull()
expect(rowWithUndefinedRetention[0]?.state.retrievability).toBeLessThan(...)
```

- [ ] **Step 3: Fix `problem-library-screen.test.tsx`**

Replace all `createSerializedPracticeSummary(...)` usages with `createSerializedNormalizedPracticeState(...)` and rename the field from `summary:` to `state:`.

Update the import:
```typescript
import { createSerializedNormalizedPracticeState } from '@/testing/practice-fixtures'
```

- [ ] **Step 4: Fix `app-shell-service.test.ts` and `use-popup-app-shell-controller.test.tsx`**

Replace `createSerializedPracticeSummary` with `createSerializedNormalizedPracticeState`. Rename `summary:` fields to `state:` in fixture data.

Update imports:
```typescript
import { createSerializedNormalizedPracticeState } from '@/testing/practice-fixtures'
```

- [ ] **Step 5: Run the full test suite — confirm all pass**

```bash
npx vitest run
```

Expected: All tests PASS, no failures.

- [ ] **Step 6: Run TypeScript check — confirm no type errors**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/features/problems/data/problems-repository.test.ts src/features/problems/components/library/problem-library-screen.test.tsx src/features/app-shell/server/app-shell-service.test.ts src/features/app-shell/hooks/use-popup-app-shell-controller.test.tsx
git commit -m "test: update callsites to use NormalizedPracticeState"
```
