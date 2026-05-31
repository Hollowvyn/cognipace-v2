# Deterministic Assessment Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-function assessment policy with a layered named-rule pipeline that produces a richer decision (numeric confidence, structured reason + warnings, optional practice context) and a strict recall-only Easy gate, per issue #1.

**Architecture:** Pure-functional pipeline in `src/features/assessment/domain/`. `evaluateLeetCodeAssessment` orchestrates `deriveAssessmentSignals → applyHardLocks → proposeBaseRating → applyEasyGate → collectWarnings → scoreConfidence → assembleAccepted`. New types and codes live in `assessment-types.ts`; each rule lives in its own file with its own unit test. Existing single consumer (`use-overlay-review-actions.ts`) is updated to thread `timerUsed` and read the new wrapped `reason.code`.

**Tech Stack:** TypeScript, Vitest, React 19, WXT (Chrome MV3). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-30-deterministic-assessment-policy-design.md`

---

## File Plan

**Create:**
- `src/features/assessment/domain/assessment-types.ts`
- `src/features/assessment/domain/derived.ts`
- `src/features/assessment/domain/derived.test.ts`
- `src/features/assessment/domain/rules/hard-locks.ts`
- `src/features/assessment/domain/rules/hard-locks.test.ts`
- `src/features/assessment/domain/rules/base-rating.ts`
- `src/features/assessment/domain/rules/base-rating.test.ts`
- `src/features/assessment/domain/rules/easy-gate.ts`
- `src/features/assessment/domain/rules/easy-gate.test.ts`
- `src/features/assessment/domain/rules/confidence.ts`
- `src/features/assessment/domain/rules/confidence.test.ts`
- `src/features/assessment/domain/rules/warnings.ts`
- `src/features/assessment/domain/rules/warnings.test.ts`

**Modify:**
- `src/features/assessment/domain/assessment.ts` (refactor to orchestrator)
- `src/features/assessment/domain/assessment.test.ts` (rewrap `reason` assertions, add e2e cases)
- `src/features/assessment/domain/index.ts` (re-export new types and helpers)
- `src/features/assessment/index.ts` (re-export new types and helpers)
- `src/features/overlay-session/hooks/use-overlay-timer.ts` (add `hasStarted()`)
- `src/features/overlay-session/hooks/use-overlay-review-actions.ts` (thread `timerUsed`, update `formatAssessmentFeedback`)

**Conventions:**
- Test files sit next to source.
- Run a single test file with `npx vitest run <path>`.
- Run a single test by name with `npx vitest run <path> -t "<name>"`.
- Full validation: `npm run check` (drizzle check + typecheck + lint + vitest).
- All commit messages follow conventional-commits (`feat:`, `refactor:`, `test:`, `docs:`).

---

## Task 1: Add new shared types in `assessment-types.ts`

**Files:**
- Create: `src/features/assessment/domain/assessment-types.ts`
- Modify: `src/features/assessment/domain/index.ts`
- Modify: `src/features/assessment/index.ts`

This task only adds types and re-exports. No behavior change. `assessment.ts` continues to compile because it does not import from the new file yet.

- [ ] **Step 1: Create `assessment-types.ts`**

Create `src/features/assessment/domain/assessment-types.ts` with the full contract from the spec:

```ts
import type { ProblemDifficulty } from '@/features/problems'
import type { UserSettings } from '@/features/settings'
import type { ReviewRating } from '@/lib/fsrs'

export const assessmentSubmissionIntents = [
  'quick-submit',
  'leetcode-accepted',
  'selected-rating',
  'fail',
] as const

export const assessmentDecisionStatuses = ['accepted', 'blocked'] as const
export const assessmentBlockReasons = ['solve-time-required'] as const
export const assessmentLockReasons = ['failed', 'hard-mode-overtime'] as const

export const assessmentReasonCodes = [
  'failed',
  'hard-mode-overtime',
  'quick-good',
  'quick-hard-overtime',
  'leetcode-good',
  'leetcode-hard-overtime',
  'leetcode-easy-fast',
  'quick-easy-fast',
  'selected-rating',
] as const

export const assessmentWarningCodes = [
  'untimed',
  'solve-time-required-missing',
  'no-practice-context',
  'first-solve',
  'no-previous-best',
  'retry-after-fail',
  'downgrade-from-previous',
  'selected-rating-conflict',
] as const

export type AssessmentSubmissionIntent =
  (typeof assessmentSubmissionIntents)[number]
export type AssessmentDecisionStatus =
  (typeof assessmentDecisionStatuses)[number]
export type AssessmentBlockReason = (typeof assessmentBlockReasons)[number]
export type AssessmentLockReason = (typeof assessmentLockReasons)[number]
export type AssessmentReasonCode = (typeof assessmentReasonCodes)[number]
export type AssessmentWarningCode = (typeof assessmentWarningCodes)[number]

export type AssessmentTimingSettings = UserSettings['assessment']

export type AssessmentPracticeContext = {
  isFirstSolve: boolean
  previousRating: ReviewRating | null
  previousBestSeconds: number | null
  latestAttempt: {
    rating: ReviewRating
    isCorrect: boolean
    elapsedSeconds: number | null
    occurredAt: number
  } | null
}

type BaseAssessmentInput = {
  difficulty: ProblemDifficulty
  timing: AssessmentTimingSettings
  elapsedSeconds?: number | null | undefined
  timerUsed?: boolean | undefined
  practiceContext?: AssessmentPracticeContext | undefined
}

export type LeetCodeAssessmentInput =
  | ({ intent: 'quick-submit' } & BaseAssessmentInput)
  | ({ intent: 'leetcode-accepted' } & BaseAssessmentInput)
  | ({
      intent: 'selected-rating'
      selectedRating: ReviewRating
    } & BaseAssessmentInput)
  | ({ intent: 'fail' } & BaseAssessmentInput)

export type AssessmentReasonSignals = {
  elapsedSeconds: number | null
  targetSeconds: number
  ratioOfTarget: number | null
  previousBestSeconds: number | null
  beatsPreviousBest: boolean | null
  isRecallReview: boolean | null
}

export type AssessmentReason = {
  code: AssessmentReasonCode
  signals: AssessmentReasonSignals
}

export type AssessmentWarning = {
  code: AssessmentWarningCode
  signals: Record<string, number | string | boolean | null>
}

export type AssessmentBlockedReason = {
  code: AssessmentBlockReason
  signals: { targetSeconds: number }
}

export type LeetCodeAssessmentDecision =
  | {
      status: 'accepted'
      rating: ReviewRating
      isCorrect: boolean
      elapsedSeconds: number | null
      targetSeconds: number
      isOverTarget: boolean
      lockReason: AssessmentLockReason | null
      reason: AssessmentReason
      warnings: AssessmentWarning[]
      confidence: number
    }
  | {
      status: 'blocked'
      reason: AssessmentBlockedReason
      targetSeconds: number
      elapsedSeconds: null
    }

/**
 * @deprecated re-exported here so the domain barrel can satisfy the feature
 * barrel's existing contract without touching `assessment.ts`. The same `const`
 * and type live in `assessment.ts`; the domain barrel sources them from this
 * file. Remove after Task 8 replaces `assessment.ts` and the feature barrel is
 * updated.
 */
export const assessmentAcceptedReasons = [
  'quick-good',
  'quick-hard-overtime',
  'leetcode-good',
  'leetcode-hard-overtime',
  'selected-rating',
  'failed',
  'hard-mode-overtime',
] as const

/** @deprecated Use {@link AssessmentReasonCode} instead. Remove after Task 8. */
export type AssessmentAcceptedReason =
  (typeof assessmentAcceptedReasons)[number]
```

- [ ] **Step 2: Update domain `index.ts` to re-export from both modules**

`LeetCodeAssessmentInput` and `LeetCodeAssessmentDecision` keep flowing through `./assessment` (legacy shape) until Task 8 swaps `assessment.ts` over. All the new supporting types come from `./assessment-types`. Replace `src/features/assessment/domain/index.ts` entirely:

```ts
export {
  evaluateLeetCodeAssessment,
  getLeetCodeSolveTimeTargetSeconds,
  type LeetCodeAssessmentDecision,
  type LeetCodeAssessmentInput,
} from './assessment'

export {
  assessmentAcceptedReasons,
  assessmentBlockReasons,
  assessmentDecisionStatuses,
  assessmentLockReasons,
  assessmentReasonCodes,
  assessmentSubmissionIntents,
  assessmentWarningCodes,
  type AssessmentAcceptedReason,
  type AssessmentBlockReason,
  type AssessmentBlockedReason,
  type AssessmentDecisionStatus,
  type AssessmentLockReason,
  type AssessmentPracticeContext,
  type AssessmentReason,
  type AssessmentReasonCode,
  type AssessmentReasonSignals,
  type AssessmentSubmissionIntent,
  type AssessmentTimingSettings,
  type AssessmentWarning,
  type AssessmentWarningCode,
} from './assessment-types'
```

- [ ] **Step 3: Update feature `index.ts` to re-export the new types**

`src/features/assessment/index.ts` is an explicit allowlist (not `export *`), so the new types added to the domain barrel do NOT flow through automatically. Replace its contents with:

```ts
export {
  assessmentAcceptedReasons,
  assessmentBlockReasons,
  assessmentDecisionStatuses,
  assessmentLockReasons,
  assessmentReasonCodes,
  assessmentSubmissionIntents,
  assessmentWarningCodes,
  evaluateLeetCodeAssessment,
  getLeetCodeSolveTimeTargetSeconds,
  type AssessmentAcceptedReason,
  type AssessmentBlockReason,
  type AssessmentBlockedReason,
  type AssessmentDecisionStatus,
  type AssessmentLockReason,
  type AssessmentPracticeContext,
  type AssessmentReason,
  type AssessmentReasonCode,
  type AssessmentReasonSignals,
  type AssessmentSubmissionIntent,
  type AssessmentTimingSettings,
  type AssessmentWarning,
  type AssessmentWarningCode,
  type LeetCodeAssessmentDecision,
  type LeetCodeAssessmentInput,
} from './domain'
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS. `assessment.ts` still exports its own (legacy) versions of the shared types; the new types live in parallel.

- [ ] **Step 5: Commit**

```sh
git add src/features/assessment/domain/assessment-types.ts \
        src/features/assessment/domain/index.ts \
        src/features/assessment/index.ts
git commit -m "feat(assessment): add shared types for richer decision contract"
```

---

## Task 2: Build `deriveAssessmentSignals`

**Files:**
- Create: `src/features/assessment/domain/derived.ts`
- Create: `src/features/assessment/domain/derived.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/assessment/domain/derived.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import type {
  AssessmentTimingSettings,
  LeetCodeAssessmentInput,
} from './assessment-types'
import { deriveAssessmentSignals } from './derived'

const timing = {
  requireSolveTime: false,
  strictTiming: false,
  timeTargetsMinutes: { easy: 20, medium: 35, hard: 50 },
} satisfies AssessmentTimingSettings

function quickSubmit(
  patch: Partial<LeetCodeAssessmentInput> = {},
): LeetCodeAssessmentInput {
  return {
    intent: 'quick-submit',
    difficulty: 'medium',
    timing,
    elapsedSeconds: 600,
    ...patch,
  } as LeetCodeAssessmentInput
}

describe('deriveAssessmentSignals', () => {
  it('computes targetSeconds from difficulty + timing', () => {
    expect(deriveAssessmentSignals(quickSubmit()).targetSeconds).toBe(35 * 60)
  })

  it('normalizes elapsed seconds to a positive integer', () => {
    expect(
      deriveAssessmentSignals(quickSubmit({ elapsedSeconds: 90.8 }))
        .elapsedSeconds,
    ).toBe(90)
  })

  it.each([null, undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'maps invalid elapsed seconds (%s) to null',
    (value) => {
      expect(
        deriveAssessmentSignals(quickSubmit({ elapsedSeconds: value })),
      ).toMatchObject({ elapsedSeconds: null, isUntimed: true })
    },
  )

  it('treats timerUsed:false as untimed even when elapsedSeconds is set', () => {
    expect(
      deriveAssessmentSignals(
        quickSubmit({ elapsedSeconds: 600, timerUsed: false }),
      ),
    ).toMatchObject({ elapsedSeconds: 600, isUntimed: true })
  })

  it('computes isOverTarget and ratioOfTarget', () => {
    const derived = deriveAssessmentSignals(
      quickSubmit({ elapsedSeconds: 42 * 60 }),
    )
    expect(derived.isOverTarget).toBe(true)
    expect(derived.ratioOfTarget).toBeCloseTo(1.2)
  })

  it('returns null ratioOfTarget when untimed', () => {
    expect(
      deriveAssessmentSignals(quickSubmit({ elapsedSeconds: null })),
    ).toMatchObject({ ratioOfTarget: null, isOverTarget: false })
  })

  it('returns null isRecallReview when practiceContext is absent', () => {
    expect(deriveAssessmentSignals(quickSubmit()).isRecallReview).toBeNull()
  })

  it('marks recall review when practiceContext.isFirstSolve is false', () => {
    expect(
      deriveAssessmentSignals(
        quickSubmit({
          practiceContext: {
            isFirstSolve: false,
            previousRating: 'good',
            previousBestSeconds: 1800,
            latestAttempt: null,
          },
        }),
      ).isRecallReview,
    ).toBe(true)
  })

  it('returns null beatsPreviousBest when no prior best exists', () => {
    expect(
      deriveAssessmentSignals(
        quickSubmit({
          practiceContext: {
            isFirstSolve: false,
            previousRating: 'good',
            previousBestSeconds: null,
            latestAttempt: null,
          },
        }),
      ).beatsPreviousBest,
    ).toBeNull()
  })

  it('returns false beatsPreviousBest when untimed', () => {
    expect(
      deriveAssessmentSignals(
        quickSubmit({
          elapsedSeconds: null,
          practiceContext: {
            isFirstSolve: false,
            previousRating: 'good',
            previousBestSeconds: 1800,
            latestAttempt: null,
          },
        }),
      ).beatsPreviousBest,
    ).toBe(false)
  })

  it('returns true beatsPreviousBest when elapsed < previousBest', () => {
    expect(
      deriveAssessmentSignals(
        quickSubmit({
          elapsedSeconds: 1200,
          practiceContext: {
            isFirstSolve: false,
            previousRating: 'good',
            previousBestSeconds: 1800,
            latestAttempt: null,
          },
        }),
      ).beatsPreviousBest,
    ).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npx vitest run src/features/assessment/domain/derived.test.ts`
Expected: FAIL with module-not-found for `./derived`.

- [ ] **Step 3: Implement `deriveAssessmentSignals`**

Create `src/features/assessment/domain/derived.ts`:

```ts
import type { ProblemDifficulty } from '@/features/problems'

import type {
  AssessmentTimingSettings,
  LeetCodeAssessmentInput,
} from './assessment-types'

export type AssessmentDerivedSignals = {
  targetSeconds: number
  elapsedSeconds: number | null
  isUntimed: boolean
  isOverTarget: boolean
  ratioOfTarget: number | null
  isRecallReview: boolean | null
  beatsPreviousBest: boolean | null
}

const SECONDS_PER_MINUTE = 60

const timingGoalKeyByDifficulty = {
  easy: 'easy',
  medium: 'medium',
  hard: 'hard',
  unknown: 'hard',
} as const satisfies Record<ProblemDifficulty, 'easy' | 'medium' | 'hard'>

export function getLeetCodeSolveTimeTargetSeconds(
  difficulty: ProblemDifficulty,
  timing: AssessmentTimingSettings,
): number {
  const minutes =
    timing.timeTargetsMinutes[timingGoalKeyByDifficulty[difficulty]]

  return normalizePositiveInteger(minutes) * SECONDS_PER_MINUTE
}

export function deriveAssessmentSignals(
  input: LeetCodeAssessmentInput,
): AssessmentDerivedSignals {
  const targetSeconds = getLeetCodeSolveTimeTargetSeconds(
    input.difficulty,
    input.timing,
  )
  const elapsedSeconds = normalizeElapsedSeconds(input.elapsedSeconds)
  const isUntimed = input.timerUsed === false || elapsedSeconds === null
  const isOverTarget =
    elapsedSeconds !== null && elapsedSeconds > targetSeconds
  const ratioOfTarget =
    elapsedSeconds !== null && targetSeconds > 0
      ? elapsedSeconds / targetSeconds
      : null

  const practiceContext = input.practiceContext
  const isRecallReview =
    practiceContext == null ? null : !practiceContext.isFirstSolve
  const beatsPreviousBest = computeBeatsPreviousBest(
    elapsedSeconds,
    isUntimed,
    practiceContext?.previousBestSeconds ?? null,
  )

  return {
    targetSeconds,
    elapsedSeconds,
    isUntimed,
    isOverTarget,
    ratioOfTarget,
    isRecallReview,
    beatsPreviousBest,
  }
}

function computeBeatsPreviousBest(
  elapsedSeconds: number | null,
  isUntimed: boolean,
  previousBestSeconds: number | null,
): boolean | null {
  if (previousBestSeconds === null) {
    return null
  }
  if (isUntimed || elapsedSeconds === null) {
    return false
  }
  return elapsedSeconds < previousBestSeconds
}

function normalizeElapsedSeconds(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }
  const elapsedSeconds = Math.floor(value)
  return elapsedSeconds > 0 ? elapsedSeconds : null
}

function normalizePositiveInteger(value: number) {
  if (!Number.isFinite(value) || value < 1) {
    return 1
  }
  return Math.floor(value)
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npx vitest run src/features/assessment/domain/derived.test.ts`
Expected: PASS, all 11 cases (the table case expands to 6).

- [ ] **Step 5: Commit**

```sh
git add src/features/assessment/domain/derived.ts \
        src/features/assessment/domain/derived.test.ts
git commit -m "feat(assessment): derive shared signals from inputs"
```

---

## Task 3: Build `applyHardLocks`

**Files:**
- Create: `src/features/assessment/domain/rules/hard-locks.ts`
- Create: `src/features/assessment/domain/rules/hard-locks.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/assessment/domain/rules/hard-locks.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import type {
  AssessmentTimingSettings,
  LeetCodeAssessmentInput,
} from '../assessment-types'
import { deriveAssessmentSignals } from '../derived'
import { applyHardLocks } from './hard-locks'

const timing = {
  requireSolveTime: false,
  strictTiming: false,
  timeTargetsMinutes: { easy: 20, medium: 35, hard: 50 },
} satisfies AssessmentTimingSettings

function build(input: Partial<LeetCodeAssessmentInput> = {}) {
  const merged = {
    intent: 'leetcode-accepted',
    difficulty: 'medium',
    timing,
    elapsedSeconds: 600,
    ...input,
  } as LeetCodeAssessmentInput
  return { input: merged, derived: deriveAssessmentSignals(merged) }
}

describe('applyHardLocks', () => {
  it('locks Again on fail intent regardless of timing', () => {
    const { input, derived } = build({ intent: 'fail', elapsedSeconds: null })
    expect(applyHardLocks(input, derived)).toEqual({
      lockReason: 'failed',
      reasonCode: 'failed',
    })
  })

  it('locks Again when strict timing is on and over target', () => {
    const { input, derived } = build({
      timing: { ...timing, strictTiming: true },
      elapsedSeconds: 36 * 60,
    })
    expect(applyHardLocks(input, derived)).toEqual({
      lockReason: 'hard-mode-overtime',
      reasonCode: 'hard-mode-overtime',
    })
  })

  it('locks Again when strict timing overrides a selected easy rating', () => {
    const { input, derived } = build({
      intent: 'selected-rating',
      selectedRating: 'easy',
      timing: { ...timing, strictTiming: true },
      elapsedSeconds: 51 * 60,
      difficulty: 'hard',
    })
    expect(applyHardLocks(input, derived)).toEqual({
      lockReason: 'hard-mode-overtime',
      reasonCode: 'hard-mode-overtime',
    })
  })

  it('does not lock when strict timing is off, even over target', () => {
    const { input, derived } = build({ elapsedSeconds: 36 * 60 })
    expect(applyHardLocks(input, derived)).toBeNull()
  })

  it('does not lock when under target with strict timing on', () => {
    const { input, derived } = build({
      timing: { ...timing, strictTiming: true },
      elapsedSeconds: 20 * 60,
    })
    expect(applyHardLocks(input, derived)).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npx vitest run src/features/assessment/domain/rules/hard-locks.test.ts`
Expected: FAIL with module-not-found for `./hard-locks`.

- [ ] **Step 3: Implement `applyHardLocks`**

Create `src/features/assessment/domain/rules/hard-locks.ts`:

```ts
import type {
  AssessmentLockReason,
  AssessmentReasonCode,
  LeetCodeAssessmentInput,
} from '../assessment-types'
import type { AssessmentDerivedSignals } from '../derived'

export type HardLockOutcome = {
  lockReason: AssessmentLockReason
  reasonCode: AssessmentReasonCode
}

export function applyHardLocks(
  input: LeetCodeAssessmentInput,
  derived: AssessmentDerivedSignals,
): HardLockOutcome | null {
  if (input.intent === 'fail') {
    return { lockReason: 'failed', reasonCode: 'failed' }
  }
  if (derived.isOverTarget && input.timing.strictTiming) {
    return {
      lockReason: 'hard-mode-overtime',
      reasonCode: 'hard-mode-overtime',
    }
  }
  return null
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npx vitest run src/features/assessment/domain/rules/hard-locks.test.ts`
Expected: PASS, all 5 cases.

- [ ] **Step 5: Commit**

```sh
git add src/features/assessment/domain/rules/hard-locks.ts \
        src/features/assessment/domain/rules/hard-locks.test.ts
git commit -m "feat(assessment): apply hard lock rules for fail and strict-timing overtime"
```

---

## Task 4: Build `proposeBaseRating`

**Files:**
- Create: `src/features/assessment/domain/rules/base-rating.ts`
- Create: `src/features/assessment/domain/rules/base-rating.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/assessment/domain/rules/base-rating.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import type {
  AssessmentTimingSettings,
  LeetCodeAssessmentInput,
} from '../assessment-types'
import { deriveAssessmentSignals } from '../derived'
import { proposeBaseRating } from './base-rating'

const timing = {
  requireSolveTime: false,
  strictTiming: false,
  timeTargetsMinutes: { easy: 20, medium: 35, hard: 50 },
} satisfies AssessmentTimingSettings

function build(input: Partial<LeetCodeAssessmentInput>) {
  const merged = {
    intent: 'quick-submit',
    difficulty: 'medium',
    timing,
    elapsedSeconds: 600,
    ...input,
  } as LeetCodeAssessmentInput
  return { input: merged, derived: deriveAssessmentSignals(merged) }
}

describe('proposeBaseRating', () => {
  it('quick-submit under target -> good', () => {
    const { input, derived } = build({
      intent: 'quick-submit',
      elapsedSeconds: 30 * 60,
    })
    expect(proposeBaseRating(input, derived)).toEqual({
      rating: 'good',
      reasonCode: 'quick-good',
    })
  })

  it('quick-submit over target -> hard', () => {
    const { input, derived } = build({
      intent: 'quick-submit',
      elapsedSeconds: 36 * 60,
    })
    expect(proposeBaseRating(input, derived)).toEqual({
      rating: 'hard',
      reasonCode: 'quick-hard-overtime',
    })
  })

  it('leetcode-accepted under target -> good', () => {
    const { input, derived } = build({
      intent: 'leetcode-accepted',
      elapsedSeconds: 30 * 60,
    })
    expect(proposeBaseRating(input, derived)).toEqual({
      rating: 'good',
      reasonCode: 'leetcode-good',
    })
  })

  it('leetcode-accepted over target -> hard', () => {
    const { input, derived } = build({
      intent: 'leetcode-accepted',
      elapsedSeconds: 36 * 60,
    })
    expect(proposeBaseRating(input, derived)).toEqual({
      rating: 'hard',
      reasonCode: 'leetcode-hard-overtime',
    })
  })

  it('selected-rating passes the selectedRating through unchanged', () => {
    const { input, derived } = build({
      intent: 'selected-rating',
      selectedRating: 'easy',
      elapsedSeconds: 45 * 60,
    })
    expect(proposeBaseRating(input, derived)).toEqual({
      rating: 'easy',
      reasonCode: 'selected-rating',
    })
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npx vitest run src/features/assessment/domain/rules/base-rating.test.ts`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement `proposeBaseRating`**

Create `src/features/assessment/domain/rules/base-rating.ts`:

```ts
import type { ReviewRating } from '@/lib/fsrs'

import type {
  AssessmentReasonCode,
  LeetCodeAssessmentInput,
} from '../assessment-types'
import type { AssessmentDerivedSignals } from '../derived'

export type BaseRatingOutcome = {
  rating: ReviewRating
  reasonCode: AssessmentReasonCode
}

export function proposeBaseRating(
  input: LeetCodeAssessmentInput,
  derived: AssessmentDerivedSignals,
): BaseRatingOutcome {
  switch (input.intent) {
    case 'selected-rating':
      return { rating: input.selectedRating, reasonCode: 'selected-rating' }
    case 'quick-submit':
      return derived.isOverTarget
        ? { rating: 'hard', reasonCode: 'quick-hard-overtime' }
        : { rating: 'good', reasonCode: 'quick-good' }
    case 'leetcode-accepted':
      return derived.isOverTarget
        ? { rating: 'hard', reasonCode: 'leetcode-hard-overtime' }
        : { rating: 'good', reasonCode: 'leetcode-good' }
    case 'fail':
      throw new Error(
        'proposeBaseRating should not be called for fail intent (hard-lock applies)',
      )
  }
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npx vitest run src/features/assessment/domain/rules/base-rating.test.ts`
Expected: PASS, all 5 cases.

- [ ] **Step 5: Commit**

```sh
git add src/features/assessment/domain/rules/base-rating.ts \
        src/features/assessment/domain/rules/base-rating.test.ts
git commit -m "feat(assessment): propose base rating from intent and target ratio"
```

---

## Task 5: Build `applyEasyGate`

**Files:**
- Create: `src/features/assessment/domain/rules/easy-gate.ts`
- Create: `src/features/assessment/domain/rules/easy-gate.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/assessment/domain/rules/easy-gate.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import type {
  AssessmentPracticeContext,
  AssessmentTimingSettings,
  LeetCodeAssessmentInput,
} from '../assessment-types'
import { deriveAssessmentSignals } from '../derived'
import type { BaseRatingOutcome } from './base-rating'
import { proposeBaseRating } from './base-rating'
import { applyEasyGate, EASY_GATE_RATIO } from './easy-gate'

const timing = {
  requireSolveTime: false,
  strictTiming: false,
  timeTargetsMinutes: { easy: 20, medium: 35, hard: 50 },
} satisfies AssessmentTimingSettings

const recallContext: AssessmentPracticeContext = {
  isFirstSolve: false,
  previousRating: 'good',
  previousBestSeconds: 30 * 60,
  latestAttempt: null,
}

function build(input: Partial<LeetCodeAssessmentInput>) {
  const merged = {
    intent: 'leetcode-accepted',
    difficulty: 'medium',
    timing,
    elapsedSeconds: 14 * 60, // 40% of medium target
    practiceContext: recallContext,
    ...input,
  } as LeetCodeAssessmentInput
  const derived = deriveAssessmentSignals(merged)
  const base: BaseRatingOutcome = proposeBaseRating(merged, derived)
  return { input: merged, derived, base }
}

describe('applyEasyGate', () => {
  it('fires for leetcode-accepted recall review at <=50% target beating prior best', () => {
    const { input, derived, base } = build({})
    expect(applyEasyGate(input, derived, base)).toEqual({
      rating: 'easy',
      reasonCode: 'leetcode-easy-fast',
    })
  })

  it('fires for quick-submit when all gates pass', () => {
    const { input, derived, base } = build({ intent: 'quick-submit' })
    expect(applyEasyGate(input, derived, base)).toEqual({
      rating: 'easy',
      reasonCode: 'quick-easy-fast',
    })
  })

  it('does not fire on first solve (no recall)', () => {
    const { input, derived, base } = build({
      practiceContext: { ...recallContext, isFirstSolve: true },
    })
    expect(applyEasyGate(input, derived, base)).toBe(base)
  })

  it('does not fire when practiceContext is absent', () => {
    const { input, derived, base } = build({ practiceContext: undefined })
    expect(applyEasyGate(input, derived, base)).toBe(base)
  })

  it('does not fire when previousBestSeconds is null', () => {
    const { input, derived, base } = build({
      practiceContext: { ...recallContext, previousBestSeconds: null },
    })
    expect(applyEasyGate(input, derived, base)).toBe(base)
  })

  it('does not fire when slower than previousBest', () => {
    const { input, derived, base } = build({
      practiceContext: { ...recallContext, previousBestSeconds: 10 * 60 },
    })
    expect(applyEasyGate(input, derived, base)).toBe(base)
  })

  it('does not fire when ratioOfTarget is above EASY_GATE_RATIO', () => {
    const { input, derived, base } = build({ elapsedSeconds: 21 * 60 }) // 60%
    expect(applyEasyGate(input, derived, base)).toBe(base)
  })

  it('does not fire for selected-rating intent', () => {
    const { input, derived, base } = build({
      intent: 'selected-rating',
      selectedRating: 'good',
    })
    expect(applyEasyGate(input, derived, base)).toBe(base)
  })

  it('does not fire when base rating is hard (would only upgrade good)', () => {
    const overTarget = build({ elapsedSeconds: 36 * 60 })
    expect(overTarget.base.rating).toBe('hard')
    expect(applyEasyGate(overTarget.input, overTarget.derived, overTarget.base))
      .toBe(overTarget.base)
  })

  it('exposes EASY_GATE_RATIO as 0.5', () => {
    expect(EASY_GATE_RATIO).toBe(0.5)
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npx vitest run src/features/assessment/domain/rules/easy-gate.test.ts`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement `applyEasyGate`**

Create `src/features/assessment/domain/rules/easy-gate.ts`:

```ts
import type { LeetCodeAssessmentInput } from '../assessment-types'
import type { AssessmentDerivedSignals } from '../derived'
import type { BaseRatingOutcome } from './base-rating'

export const EASY_GATE_RATIO = 0.5

export function applyEasyGate(
  input: LeetCodeAssessmentInput,
  derived: AssessmentDerivedSignals,
  base: BaseRatingOutcome,
): BaseRatingOutcome {
  if (input.intent !== 'quick-submit' && input.intent !== 'leetcode-accepted') {
    return base
  }
  if (base.rating !== 'good') {
    return base
  }
  if (derived.isRecallReview !== true) {
    return base
  }
  if (derived.ratioOfTarget === null || derived.ratioOfTarget > EASY_GATE_RATIO) {
    return base
  }
  if (derived.beatsPreviousBest !== true) {
    return base
  }

  return {
    rating: 'easy',
    reasonCode:
      input.intent === 'quick-submit' ? 'quick-easy-fast' : 'leetcode-easy-fast',
  }
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npx vitest run src/features/assessment/domain/rules/easy-gate.test.ts`
Expected: PASS, all 10 cases.

- [ ] **Step 5: Commit**

```sh
git add src/features/assessment/domain/rules/easy-gate.ts \
        src/features/assessment/domain/rules/easy-gate.test.ts
git commit -m "feat(assessment): upgrade Good to Easy under strict recall gate"
```

---

## Task 6: Build `collectWarnings`

**Files:**
- Create: `src/features/assessment/domain/rules/warnings.ts`
- Create: `src/features/assessment/domain/rules/warnings.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/assessment/domain/rules/warnings.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import type {
  AssessmentPracticeContext,
  AssessmentTimingSettings,
  AssessmentWarningCode,
  LeetCodeAssessmentInput,
} from '../assessment-types'
import { deriveAssessmentSignals } from '../derived'
import { collectWarnings, isDowngrade } from './warnings'

const timing = {
  requireSolveTime: false,
  strictTiming: false,
  timeTargetsMinutes: { easy: 20, medium: 35, hard: 50 },
} satisfies AssessmentTimingSettings

const recallContext: AssessmentPracticeContext = {
  isFirstSolve: false,
  previousRating: 'good',
  previousBestSeconds: 30 * 60,
  latestAttempt: null,
}

function build(input: Partial<LeetCodeAssessmentInput>) {
  const merged = {
    intent: 'leetcode-accepted',
    difficulty: 'medium',
    timing,
    elapsedSeconds: 30 * 60,
    ...input,
  } as LeetCodeAssessmentInput
  return { input: merged, derived: deriveAssessmentSignals(merged) }
}

function codes(
  warnings: { code: AssessmentWarningCode }[],
): AssessmentWarningCode[] {
  return warnings.map((w) => w.code)
}

describe('collectWarnings', () => {
  it('emits untimed when timer was not used', () => {
    const { input, derived } = build({ elapsedSeconds: null })
    expect(
      codes(
        collectWarnings(input, derived, {
          proposedRating: 'good',
          easyUpgraded: false,
          lockReason: null,
          selectedRatingConflicts: false,
        }),
      ),
    ).toContain('untimed')
  })

  it('emits solve-time-required-missing when requireSolveTime + untimed', () => {
    const { input, derived } = build({
      elapsedSeconds: null,
      timing: { ...timing, requireSolveTime: true },
    })
    const result = collectWarnings(input, derived, {
      proposedRating: 'good',
      easyUpgraded: false,
      lockReason: null,
      selectedRatingConflicts: false,
    })
    const required = result.find(
      (w) => w.code === 'solve-time-required-missing',
    )
    expect(required).toBeDefined()
    expect(required?.signals).toMatchObject({ targetSeconds: 35 * 60 })
  })

  it('emits no-practice-context when context is absent', () => {
    const { input, derived } = build({})
    expect(
      codes(
        collectWarnings(input, derived, {
          proposedRating: 'good',
          easyUpgraded: false,
          lockReason: null,
          selectedRatingConflicts: false,
        }),
      ),
    ).toContain('no-practice-context')
  })

  it('emits first-solve when context isFirstSolve is true', () => {
    const { input, derived } = build({
      practiceContext: { ...recallContext, isFirstSolve: true },
    })
    expect(
      codes(
        collectWarnings(input, derived, {
          proposedRating: 'good',
          easyUpgraded: false,
          lockReason: null,
          selectedRatingConflicts: false,
        }),
      ),
    ).toContain('first-solve')
  })

  it('emits no-previous-best when context exists with no prior best', () => {
    const { input, derived } = build({
      practiceContext: { ...recallContext, previousBestSeconds: null },
    })
    expect(
      codes(
        collectWarnings(input, derived, {
          proposedRating: 'good',
          easyUpgraded: false,
          lockReason: null,
          selectedRatingConflicts: false,
        }),
      ),
    ).toContain('no-previous-best')
  })

  it('emits retry-after-fail with previous attempt signals', () => {
    const { input, derived } = build({
      practiceContext: {
        ...recallContext,
        latestAttempt: {
          rating: 'again',
          isCorrect: false,
          elapsedSeconds: 25 * 60,
          occurredAt: 1_700_000_000_000,
        },
      },
    })
    const warning = collectWarnings(input, derived, {
      proposedRating: 'good',
      easyUpgraded: false,
      lockReason: null,
      selectedRatingConflicts: false,
    }).find((w) => w.code === 'retry-after-fail')
    expect(warning).toBeDefined()
    expect(warning?.signals).toMatchObject({
      previousElapsedSeconds: 25 * 60,
      occurredAt: 1_700_000_000_000,
    })
  })

  it('emits downgrade-from-previous when proposed rating ranks below previous', () => {
    const { input, derived } = build({
      practiceContext: { ...recallContext, previousRating: 'good' },
    })
    const warning = collectWarnings(input, derived, {
      proposedRating: 'hard',
      easyUpgraded: false,
      lockReason: null,
      selectedRatingConflicts: false,
    }).find((w) => w.code === 'downgrade-from-previous')
    expect(warning).toBeDefined()
    expect(warning?.signals).toMatchObject({
      previousRating: 'good',
      proposedRating: 'hard',
    })
  })

  it('emits selected-rating-conflict when caller flags conflict and no lock', () => {
    const { input, derived } = build({
      intent: 'selected-rating',
      selectedRating: 'easy',
      practiceContext: recallContext,
    })
    const result = collectWarnings(input, derived, {
      proposedRating: 'easy',
      easyUpgraded: false,
      lockReason: null,
      selectedRatingConflicts: true,
      policyBaseRating: 'good',
    })
    const conflict = result.find((w) => w.code === 'selected-rating-conflict')
    expect(conflict).toBeDefined()
    expect(conflict?.signals).toMatchObject({
      selectedRating: 'easy',
      policyRating: 'good',
    })
  })

  it('suppresses selected-rating-conflict under a lock', () => {
    const { input, derived } = build({
      intent: 'selected-rating',
      selectedRating: 'easy',
    })
    const result = collectWarnings(input, derived, {
      proposedRating: 'again',
      easyUpgraded: false,
      lockReason: 'hard-mode-overtime',
      selectedRatingConflicts: true,
      policyBaseRating: 'hard',
    })
    expect(codes(result)).not.toContain('selected-rating-conflict')
  })

  it('combines warnings in stable order: untimed before no-practice-context', () => {
    const { input, derived } = build({ elapsedSeconds: null })
    const result = collectWarnings(input, derived, {
      proposedRating: 'good',
      easyUpgraded: false,
      lockReason: null,
      selectedRatingConflicts: false,
    })
    const list = codes(result)
    expect(list.indexOf('untimed')).toBeLessThan(
      list.indexOf('no-practice-context'),
    )
  })

  it('isDowngrade ranks again < hard < good < easy', () => {
    expect(isDowngrade('hard', 'good')).toBe(true)
    expect(isDowngrade('good', 'hard')).toBe(false)
    expect(isDowngrade('again', 'easy')).toBe(true)
    expect(isDowngrade('easy', 'easy')).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npx vitest run src/features/assessment/domain/rules/warnings.test.ts`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement `collectWarnings`**

Create `src/features/assessment/domain/rules/warnings.ts`:

```ts
import type { ReviewRating } from '@/lib/fsrs'

import type {
  AssessmentLockReason,
  AssessmentWarning,
  LeetCodeAssessmentInput,
} from '../assessment-types'
import type { AssessmentDerivedSignals } from '../derived'

export type CollectWarningsContext = {
  proposedRating: ReviewRating
  easyUpgraded: boolean
  lockReason: AssessmentLockReason | null
  selectedRatingConflicts: boolean
  /** Required when selectedRatingConflicts is true. */
  policyBaseRating?: ReviewRating
}

const RATING_RANK: Record<ReviewRating, number> = {
  again: 0,
  hard: 1,
  good: 2,
  easy: 3,
}

export function isDowngrade(
  proposed: ReviewRating,
  previous: ReviewRating,
): boolean {
  return RATING_RANK[proposed] < RATING_RANK[previous]
}

export function collectWarnings(
  input: LeetCodeAssessmentInput,
  derived: AssessmentDerivedSignals,
  ctx: CollectWarningsContext,
): AssessmentWarning[] {
  const warnings: AssessmentWarning[] = []
  const practiceContext = input.practiceContext

  if (derived.isUntimed) {
    warnings.push({ code: 'untimed', signals: {} })
  }

  if (input.timing.requireSolveTime && derived.isUntimed) {
    warnings.push({
      code: 'solve-time-required-missing',
      signals: { targetSeconds: derived.targetSeconds },
    })
  }

  if (practiceContext == null) {
    warnings.push({ code: 'no-practice-context', signals: {} })
  } else {
    if (practiceContext.isFirstSolve) {
      warnings.push({ code: 'first-solve', signals: {} })
    }
    if (practiceContext.previousBestSeconds == null) {
      warnings.push({ code: 'no-previous-best', signals: {} })
    }
    if (practiceContext.latestAttempt?.isCorrect === false) {
      warnings.push({
        code: 'retry-after-fail',
        signals: {
          previousElapsedSeconds:
            practiceContext.latestAttempt.elapsedSeconds ?? null,
          occurredAt: practiceContext.latestAttempt.occurredAt,
        },
      })
    }
    if (
      practiceContext.previousRating !== null &&
      isDowngrade(ctx.proposedRating, practiceContext.previousRating)
    ) {
      warnings.push({
        code: 'downgrade-from-previous',
        signals: {
          previousRating: practiceContext.previousRating,
          proposedRating: ctx.proposedRating,
        },
      })
    }
  }

  if (
    ctx.lockReason == null &&
    input.intent === 'selected-rating' &&
    ctx.selectedRatingConflicts &&
    ctx.policyBaseRating !== undefined
  ) {
    warnings.push({
      code: 'selected-rating-conflict',
      signals: {
        selectedRating: input.selectedRating,
        policyRating: ctx.policyBaseRating,
      },
    })
  }

  return warnings
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npx vitest run src/features/assessment/domain/rules/warnings.test.ts`
Expected: PASS, all 11 cases.

- [ ] **Step 5: Commit**

```sh
git add src/features/assessment/domain/rules/warnings.ts \
        src/features/assessment/domain/rules/warnings.test.ts
git commit -m "feat(assessment): collect structured warnings with stable order"
```

---

## Task 7: Build `scoreConfidence`

**Files:**
- Create: `src/features/assessment/domain/rules/confidence.ts`
- Create: `src/features/assessment/domain/rules/confidence.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/assessment/domain/rules/confidence.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import type {
  AssessmentPracticeContext,
  AssessmentTimingSettings,
  LeetCodeAssessmentInput,
} from '../assessment-types'
import { deriveAssessmentSignals } from '../derived'
import { CONFIDENCE_FACTORS, scoreConfidence } from './confidence'

const timing = {
  requireSolveTime: false,
  strictTiming: false,
  timeTargetsMinutes: { easy: 20, medium: 35, hard: 50 },
} satisfies AssessmentTimingSettings

const recallContext: AssessmentPracticeContext = {
  isFirstSolve: false,
  previousRating: 'good',
  previousBestSeconds: 30 * 60,
  latestAttempt: null,
}

function build(input: Partial<LeetCodeAssessmentInput>) {
  const merged = {
    intent: 'leetcode-accepted',
    difficulty: 'medium',
    timing,
    elapsedSeconds: 30 * 60,
    ...input,
  } as LeetCodeAssessmentInput
  return { input: merged, derived: deriveAssessmentSignals(merged) }
}

describe('scoreConfidence', () => {
  it('returns 1 when locked', () => {
    const { input, derived } = build({})
    expect(
      scoreConfidence(input, derived, {
        lockReason: 'failed',
        downgradedFromPrevious: false,
        selectedRatingConflicts: false,
      }),
    ).toBe(1)
  })

  it('returns 1 for the fully-confident recall path', () => {
    const { input, derived } = build({
      elapsedSeconds: 14 * 60,
      practiceContext: recallContext,
    })
    expect(
      scoreConfidence(input, derived, {
        lockReason: null,
        downgradedFromPrevious: false,
        selectedRatingConflicts: false,
      }),
    ).toBe(1)
  })

  it('returns 0.80 when timed but no practice context', () => {
    const { input, derived } = build({})
    expect(
      scoreConfidence(input, derived, {
        lockReason: null,
        downgradedFromPrevious: false,
        selectedRatingConflicts: false,
      }),
    ).toBe(0.8)
  })

  it('returns 0.48 for quick-submit untimed with no context', () => {
    const { input, derived } = build({
      intent: 'quick-submit',
      elapsedSeconds: null,
    })
    // 1 * 0.60 (untimed) * 0.80 (noPracticeContext) = 0.48
    expect(
      scoreConfidence(input, derived, {
        lockReason: null,
        downgradedFromPrevious: false,
        selectedRatingConflicts: false,
      }),
    ).toBe(0.48)
  })

  it('returns 0.34 for quick-submit untimed, no context, requireSolveTime on', () => {
    const { input, derived } = build({
      intent: 'quick-submit',
      elapsedSeconds: null,
      timing: { ...timing, requireSolveTime: true },
    })
    // 1 * 0.60 * 0.80 * 0.70 = 0.336 -> 0.34
    expect(
      scoreConfidence(input, derived, {
        lockReason: null,
        downgradedFromPrevious: false,
        selectedRatingConflicts: false,
      }),
    ).toBe(0.34)
  })

  it('exposes CONFIDENCE_FACTORS for inspection', () => {
    expect(CONFIDENCE_FACTORS).toMatchObject({
      untimed: 0.6,
      noPracticeContext: 0.8,
      firstSolve: 0.85,
      noPreviousBest: 0.9,
      retryAfterFail: 0.85,
      downgradeFromPrevious: 0.9,
      selectedRatingConflict: 0.85,
      solveTimeRequiredMissing: 0.7,
    })
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npx vitest run src/features/assessment/domain/rules/confidence.test.ts`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement `scoreConfidence`**

Create `src/features/assessment/domain/rules/confidence.ts`:

```ts
import type {
  AssessmentLockReason,
  LeetCodeAssessmentInput,
} from '../assessment-types'
import type { AssessmentDerivedSignals } from '../derived'

export const CONFIDENCE_FACTORS = {
  untimed: 0.6,
  noPracticeContext: 0.8,
  firstSolve: 0.85,
  noPreviousBest: 0.9,
  retryAfterFail: 0.85,
  downgradeFromPrevious: 0.9,
  selectedRatingConflict: 0.85,
  solveTimeRequiredMissing: 0.7,
} as const

export type ScoreConfidenceContext = {
  lockReason: AssessmentLockReason | null
  downgradedFromPrevious: boolean
  selectedRatingConflicts: boolean
}

export function scoreConfidence(
  input: LeetCodeAssessmentInput,
  derived: AssessmentDerivedSignals,
  ctx: ScoreConfidenceContext,
): number {
  if (ctx.lockReason !== null) {
    return 1
  }

  let score = 1
  const practiceContext = input.practiceContext

  if (derived.isUntimed) {
    score *= CONFIDENCE_FACTORS.untimed
  }
  if (practiceContext == null) {
    score *= CONFIDENCE_FACTORS.noPracticeContext
  } else {
    if (practiceContext.isFirstSolve) {
      score *= CONFIDENCE_FACTORS.firstSolve
    }
    if (practiceContext.previousBestSeconds == null) {
      score *= CONFIDENCE_FACTORS.noPreviousBest
    }
    if (practiceContext.latestAttempt?.isCorrect === false) {
      score *= CONFIDENCE_FACTORS.retryAfterFail
    }
  }
  if (ctx.downgradedFromPrevious) {
    score *= CONFIDENCE_FACTORS.downgradeFromPrevious
  }
  if (ctx.selectedRatingConflicts) {
    score *= CONFIDENCE_FACTORS.selectedRatingConflict
  }
  if (input.timing.requireSolveTime && derived.isUntimed) {
    score *= CONFIDENCE_FACTORS.solveTimeRequiredMissing
  }

  return Math.round(score * 100) / 100
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npx vitest run src/features/assessment/domain/rules/confidence.test.ts`
Expected: PASS, all 6 cases.

- [ ] **Step 5: Commit**

```sh
git add src/features/assessment/domain/rules/confidence.ts \
        src/features/assessment/domain/rules/confidence.test.ts
git commit -m "feat(assessment): score deterministic confidence as multiplicative factors"
```

---

## Task 8: Replace `assessment.ts` with the orchestrator

**Files:**
- Modify: `src/features/assessment/domain/assessment.ts`
- Modify: `src/features/assessment/domain/assessment.test.ts`

This task replaces the old single function with the pipeline and updates the existing table-driven test to the new `reason: { code, signals }` shape, plus end-to-end coverage of `confidence` and `warnings`.

- [ ] **Step 1: Replace `assessment.ts` with the orchestrator**

After replacing `assessment.ts`, also update `src/features/assessment/domain/index.ts` to source `type LeetCodeAssessmentDecision` and `type LeetCodeAssessmentInput` from `./assessment-types` (they have flowed through `./assessment` since Task 1 to bridge the legacy shape). Remove those two `type` re-exports from the `./assessment` export block and add them to the `./assessment-types` export block.

Open `src/features/assessment/domain/assessment.ts` and replace its full contents with:

```ts
import type { ReviewRating } from '@/lib/fsrs'

import type {
  AssessmentLockReason,
  AssessmentReason,
  AssessmentReasonCode,
  AssessmentWarning,
  LeetCodeAssessmentDecision,
  LeetCodeAssessmentInput,
} from './assessment-types'
import {
  deriveAssessmentSignals,
  getLeetCodeSolveTimeTargetSeconds,
  type AssessmentDerivedSignals,
} from './derived'
import { applyHardLocks } from './rules/hard-locks'
import { proposeBaseRating } from './rules/base-rating'
import { applyEasyGate } from './rules/easy-gate'
import { collectWarnings, isDowngrade } from './rules/warnings'
import { scoreConfidence } from './rules/confidence'

export { getLeetCodeSolveTimeTargetSeconds }

export function evaluateLeetCodeAssessment(
  input: LeetCodeAssessmentInput,
): LeetCodeAssessmentDecision {
  const derived = deriveAssessmentSignals(input)
  const previousBestSeconds =
    input.practiceContext?.previousBestSeconds ?? null
  const locked = applyHardLocks(input, derived)

  if (locked) {
    const warnings = collectWarnings(input, derived, {
      proposedRating: 'again',
      easyUpgraded: false,
      lockReason: locked.lockReason,
      selectedRatingConflicts: false,
    })
    return assembleAccepted({
      derived,
      rating: 'again',
      reasonCode: locked.reasonCode,
      lockReason: locked.lockReason,
      warnings,
      confidence: 1,
      previousBestSeconds,
    })
  }

  const base = proposeBaseRating(input, derived)
  const finalOutcome = applyEasyGate(input, derived, base)
  const policyBaseRating = computePolicyBaseRating(input, derived)
  const selectedRatingConflicts =
    input.intent === 'selected-rating' &&
    input.selectedRating !== policyBaseRating
  const downgradedFromPrevious =
    input.practiceContext?.previousRating != null &&
    isDowngrade(finalOutcome.rating, input.practiceContext.previousRating)

  const warnings = collectWarnings(input, derived, {
    proposedRating: finalOutcome.rating,
    easyUpgraded: finalOutcome !== base,
    lockReason: null,
    selectedRatingConflicts,
    policyBaseRating,
  })

  const confidence = scoreConfidence(input, derived, {
    lockReason: null,
    downgradedFromPrevious,
    selectedRatingConflicts,
  })

  return assembleAccepted({
    derived,
    rating: finalOutcome.rating,
    reasonCode: finalOutcome.reasonCode,
    lockReason: null,
    warnings,
    confidence,
    previousBestSeconds,
  })
}

function computePolicyBaseRating(
  input: LeetCodeAssessmentInput,
  derived: AssessmentDerivedSignals,
): ReviewRating {
  if (input.intent === 'selected-rating') {
    return derived.isOverTarget ? 'hard' : 'good'
  }
  return proposeBaseRating(input, derived).rating
}

function assembleAccepted(args: {
  derived: AssessmentDerivedSignals
  rating: ReviewRating
  reasonCode: AssessmentReasonCode
  lockReason: AssessmentLockReason | null
  warnings: AssessmentWarning[]
  confidence: number
  previousBestSeconds: number | null
}): LeetCodeAssessmentDecision {
  const {
    derived,
    rating,
    reasonCode,
    lockReason,
    warnings,
    confidence,
    previousBestSeconds,
  } = args

  const reason: AssessmentReason = {
    code: reasonCode,
    signals: {
      elapsedSeconds: derived.elapsedSeconds,
      targetSeconds: derived.targetSeconds,
      ratioOfTarget: derived.ratioOfTarget,
      previousBestSeconds,
      beatsPreviousBest: derived.beatsPreviousBest,
      isRecallReview: derived.isRecallReview,
    },
  }

  return {
    status: 'accepted',
    rating,
    isCorrect: rating !== 'again',
    elapsedSeconds: derived.elapsedSeconds,
    targetSeconds: derived.targetSeconds,
    isOverTarget: derived.isOverTarget,
    lockReason,
    reason,
    warnings,
    confidence,
  }
}
```

- [ ] **Step 2: Update existing `assessment.test.ts` to the new shape**

Open `src/features/assessment/domain/assessment.test.ts` and replace the file with:

```ts
import { describe, expect, it } from 'vitest'

import {
  evaluateLeetCodeAssessment,
  getLeetCodeSolveTimeTargetSeconds,
  type AssessmentTimingSettings,
  type LeetCodeAssessmentInput,
} from './assessment'

type AcceptedAssessment = Extract<
  ReturnType<typeof evaluateLeetCodeAssessment>,
  { status: 'accepted' }
>

const secondsPerMinute = 60
const timing = {
  requireSolveTime: false,
  strictTiming: false,
  timeTargetsMinutes: {
    easy: 20,
    medium: 35,
    hard: 50,
  },
} as const satisfies AssessmentTimingSettings

describe('assessment policy', () => {
  it.each([
    ['easy', 20 * secondsPerMinute],
    ['medium', 35 * secondsPerMinute],
    ['hard', 50 * secondsPerMinute],
    ['unknown', 50 * secondsPerMinute],
  ] as const)('uses the %s solve-time target', (difficulty, targetSeconds) => {
    expect(getLeetCodeSolveTimeTargetSeconds(difficulty, timing)).toBe(
      targetSeconds,
    )
  })

  it.each([
    {
      name: 'quick-submit without elapsed time defaults to Good when optional',
      input: quickSubmit(null),
      expected: acceptedDecision({
        rating: 'good',
        elapsedSeconds: null,
        reason: { code: 'quick-good' },
      }),
    },
    {
      name: 'quick-submit within target returns Good',
      input: quickSubmit(30 * secondsPerMinute),
      expected: acceptedDecision({
        rating: 'good',
        elapsedSeconds: 30 * secondsPerMinute,
        reason: { code: 'quick-good' },
      }),
    },
    {
      name: 'quick-submit overtime returns Hard when strict timing is off',
      input: quickSubmit(36 * secondsPerMinute),
      expected: acceptedDecision({
        rating: 'hard',
        elapsedSeconds: 36 * secondsPerMinute,
        isOverTarget: true,
        reason: { code: 'quick-hard-overtime' },
      }),
    },
    {
      name: 'quick-submit overtime returns Again when strict timing is on',
      input: quickSubmit(36 * secondsPerMinute, { strictTiming: true }),
      expected: strictTimingOvertime(36 * secondsPerMinute),
    },
    {
      name: 'LeetCode accepted under target returns Good',
      input: leetcodeAccepted(30 * secondsPerMinute),
      expected: acceptedDecision({
        rating: 'good',
        elapsedSeconds: 30 * secondsPerMinute,
        reason: { code: 'leetcode-good' },
      }),
    },
    {
      name: 'LeetCode accepted overtime returns Hard when strict timing is off',
      input: leetcodeAccepted(36 * secondsPerMinute),
      expected: acceptedDecision({
        rating: 'hard',
        elapsedSeconds: 36 * secondsPerMinute,
        isOverTarget: true,
        reason: { code: 'leetcode-hard-overtime' },
      }),
    },
    {
      name: 'LeetCode accepted overtime returns Again when strict timing is on',
      input: leetcodeAccepted(36 * secondsPerMinute, { strictTiming: true }),
      expected: strictTimingOvertime(36 * secondsPerMinute),
    },
    {
      name: 'selected rating is preserved outside strict timing overtime',
      input: {
        intent: 'selected-rating',
        difficulty: 'hard',
        selectedRating: 'easy',
        elapsedSeconds: 45 * secondsPerMinute,
        timing,
      },
      expected: acceptedDecision({
        rating: 'easy',
        elapsedSeconds: 45 * secondsPerMinute,
        reason: { code: 'selected-rating' },
      }),
    },
    {
      name: 'selected rating is forced to Again during strict timing overtime',
      input: {
        intent: 'selected-rating',
        difficulty: 'hard',
        selectedRating: 'easy',
        elapsedSeconds: 51 * secondsPerMinute,
        timing: { ...timing, strictTiming: true },
      },
      expected: strictTimingOvertime(51 * secondsPerMinute),
    },
    {
      name: 'fail always saves Again and bypasses solve-time-required blocking',
      input: {
        intent: 'fail',
        difficulty: 'easy',
        elapsedSeconds: null,
        timing: { ...timing, requireSolveTime: true },
      },
      expected: {
        rating: 'again',
        elapsedSeconds: null,
        isCorrect: false,
        isOverTarget: false,
        lockReason: 'failed',
        reason: { code: 'failed' },
      },
    },
    {
      name: 'solve-time-required is warning-only for quick submit',
      input: quickSubmit(null, { requireSolveTime: true }),
      expected: acceptedDecision({
        rating: 'good',
        elapsedSeconds: null,
        reason: { code: 'quick-good' },
      }),
    },
  ] satisfies Array<{
    name: string
    input: LeetCodeAssessmentInput
    expected: Partial<AcceptedAssessment>
  }>)('$name', ({ input, expected }) => {
    expect(evaluateLeetCodeAssessment(input)).toMatchObject({
      status: 'accepted',
      targetSeconds: getLeetCodeSolveTimeTargetSeconds(
        input.difficulty,
        input.timing,
      ),
      ...expected,
    })
  })

  it.each([undefined, null, 0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'normalizes invalid elapsed seconds %s to null',
    (elapsedSeconds) => {
      expect(quickSubmitDecision(elapsedSeconds)).toMatchObject({
        status: 'accepted',
        elapsedSeconds: null,
      })
    },
  )

  it('normalizes positive decimal elapsed seconds to whole seconds', () => {
    expect(
      evaluateLeetCodeAssessment({
        intent: 'selected-rating',
        difficulty: 'easy',
        selectedRating: 'good',
        elapsedSeconds: 90.8,
        timing,
      }),
    ).toMatchObject({
      status: 'accepted',
      elapsedSeconds: 90,
    })
  })

  it('returns easy with leetcode-easy-fast on fast recall solve beating prior best', () => {
    const decision = evaluateLeetCodeAssessment({
      intent: 'leetcode-accepted',
      difficulty: 'medium',
      elapsedSeconds: 14 * 60,
      timing,
      practiceContext: {
        isFirstSolve: false,
        previousRating: 'good',
        previousBestSeconds: 30 * 60,
        latestAttempt: null,
      },
    })
    expect(decision).toMatchObject({
      status: 'accepted',
      rating: 'easy',
      reason: { code: 'leetcode-easy-fast' },
      confidence: 1,
    })
    expect(
      decision.status === 'accepted' ? decision.warnings.map((w) => w.code) : [],
    ).toEqual([])
  })

  it('keeps fast first-solve at good and emits first-solve warning', () => {
    const decision = evaluateLeetCodeAssessment({
      intent: 'leetcode-accepted',
      difficulty: 'medium',
      elapsedSeconds: 14 * 60,
      timing,
      practiceContext: {
        isFirstSolve: true,
        previousRating: null,
        previousBestSeconds: null,
        latestAttempt: null,
      },
    })
    expect(decision).toMatchObject({
      status: 'accepted',
      rating: 'good',
      reason: { code: 'leetcode-good' },
    })
    expect(
      decision.status === 'accepted' ? decision.warnings.map((w) => w.code) : [],
    ).toEqual(expect.arrayContaining(['first-solve', 'no-previous-best']))
  })

  it('reports confidence 0.48 for untimed quick-submit with no practice context', () => {
    expect(
      evaluateLeetCodeAssessment({
        intent: 'quick-submit',
        difficulty: 'medium',
        elapsedSeconds: null,
        timing,
      }),
    ).toMatchObject({
      status: 'accepted',
      rating: 'good',
      confidence: 0.48,
    })
  })

  it('sets confidence to 1 for locked fail decisions', () => {
    expect(
      evaluateLeetCodeAssessment({
        intent: 'fail',
        difficulty: 'medium',
        elapsedSeconds: null,
        timing,
      }),
    ).toMatchObject({
      status: 'accepted',
      rating: 'again',
      lockReason: 'failed',
      confidence: 1,
    })
  })
})

function quickSubmit(
  elapsedSeconds: number | null | undefined,
  timingPatch?: Partial<AssessmentTimingSettings>,
): LeetCodeAssessmentInput {
  return {
    intent: 'quick-submit',
    difficulty: 'medium',
    elapsedSeconds,
    timing: { ...timing, ...timingPatch },
  }
}

function leetcodeAccepted(
  elapsedSeconds: number | null | undefined,
  timingPatch?: Partial<AssessmentTimingSettings>,
): LeetCodeAssessmentInput {
  return {
    intent: 'leetcode-accepted',
    difficulty: 'medium',
    elapsedSeconds,
    timing: { ...timing, ...timingPatch },
  }
}

function quickSubmitDecision(elapsedSeconds: number | null | undefined) {
  return evaluateLeetCodeAssessment({
    ...quickSubmit(elapsedSeconds),
    difficulty: 'easy',
  })
}

function strictTimingOvertime(elapsedSeconds: number) {
  return {
    rating: 'again',
    elapsedSeconds,
    isCorrect: false,
    isOverTarget: true,
    lockReason: 'hard-mode-overtime',
    reason: { code: 'hard-mode-overtime' },
  } satisfies Partial<AcceptedAssessment>
}

function acceptedDecision(
  overrides: Partial<AcceptedAssessment>,
): Partial<AcceptedAssessment> {
  return {
    isCorrect: true,
    isOverTarget: false,
    lockReason: null,
    ...overrides,
  }
}
```

- [ ] **Step 3: Run the assessment tests**

Run: `npx vitest run src/features/assessment/domain/assessment.test.ts`
Expected: PASS. All existing cases pass under the new wrapped `reason` shape, plus the four new end-to-end cases.

- [ ] **Step 4: Run the full assessment suite**

Run: `npx vitest run src/features/assessment`
Expected: PASS across `derived.test.ts`, every `rules/*.test.ts`, and `assessment.test.ts`.

- [ ] **Step 5: Commit**

```sh
git add src/features/assessment/domain/assessment.ts \
        src/features/assessment/domain/assessment.test.ts
git commit -m "refactor(assessment): compose policy from layered rule pipeline"
```

---

## Task 9: Update the overlay caller

**Files:**
- Modify: `src/features/overlay-session/hooks/use-overlay-timer.ts`
- Modify: `src/features/overlay-session/hooks/use-overlay-review-actions.ts`

The overlay is the only consumer of `evaluateLeetCodeAssessment`. Thread the new `timerUsed` input, leave `practiceContext` undefined (issue #2 wires it), and update the success-feedback helper to render the new easy-fast reasons.

- [ ] **Step 1: Add `hasStarted()` to `OverlayTimerController`**

Open `src/features/overlay-session/hooks/use-overlay-timer.ts`. Update the controller type and append a `hasStarted` method.

Change the controller type:

```ts
export type OverlayTimerController = {
  elapsedSeconds: number
  status: OverlayTimerStatus
  start: () => void
  pause: () => void
  reset: () => void
  lockAt: (elapsedSeconds: number | null) => number
  readElapsedSeconds: () => number
  hasStarted: () => boolean
}
```

Add the function inside `useOverlayTimer`, just below `readElapsedSeconds`:

```ts
  function hasStarted() {
    return statusRef.current !== 'idle'
  }
```

Add `hasStarted` to the returned object:

```ts
  return {
    elapsedSeconds,
    status,
    start,
    pause,
    reset,
    lockAt,
    readElapsedSeconds,
    hasStarted,
  }
```

- [ ] **Step 2: Thread `timerUsed` into all four `evaluateLeetCodeAssessment` calls**

Open `src/features/overlay-session/hooks/use-overlay-review-actions.ts`. In each of the four call sites (`prepareQuickSubmit`, `submitReview`, `failReview`, and the two arms of `saveLeetCodeSubmissionResult`), add `timerUsed: timer.hasStarted(),` as the last property in the input object literal.

For example, `prepareQuickSubmit`'s call becomes:

```ts
    const decision = evaluateLeetCodeAssessment({
      intent: 'quick-submit',
      difficulty: problem.difficulty,
      timing: currentContext.timing,
      elapsedSeconds: timer.readElapsedSeconds(),
      timerUsed: timer.hasStarted(),
    })
```

Apply the same pattern to the `submitReview`, `failReview`, and both arms of the `saveLeetCodeSubmissionResult` ternary.

- [ ] **Step 3: Update `formatAssessmentFeedback` to render easy-fast reasons**

In the same file, replace the existing `formatAssessmentFeedback` function with:

```ts
function formatAssessmentFeedback(
  decision: AcceptedAssessmentDecision,
): OverlayFeedback {
  if (decision.lockReason === 'hard-mode-overtime') {
    return {
      tone: 'warning',
      message: 'Strict timing saved this overtime attempt as Again.',
    }
  }

  if (decision.lockReason === 'failed') {
    return {
      tone: 'warning',
      message: 'Failed attempt saved as Again.',
    }
  }

  if (
    decision.reason.code === 'leetcode-easy-fast' ||
    decision.reason.code === 'quick-easy-fast'
  ) {
    return {
      tone: 'success',
      message: 'Fast solve — saved as Easy.',
    }
  }

  return {
    tone: 'success',
    message: 'Review saved.',
  }
}
```

- [ ] **Step 4: Run overlay tests**

Run: `npx vitest run src/features/overlay-session`
Expected: PASS. The overlay's existing tests should not depend on the inner shape of the assessment decision; they should keep passing.

If any test fails because of an inner detail, update its expectations to match the new wrapped `reason: { code, ... }` shape rather than the old flat enum.

- [ ] **Step 5: Commit**

```sh
git add src/features/overlay-session/hooks/use-overlay-timer.ts \
        src/features/overlay-session/hooks/use-overlay-review-actions.ts
git commit -m "feat(overlay-session): thread timerUsed and render fast-solve feedback"
```

---

## Task 10: Whole-project validation

**Files:** none modified

- [ ] **Step 1: Run the full check**

Run: `npm run check`
Expected: PASS for drizzle check, typecheck, lint, and the full Vitest suite.

- [ ] **Step 2: Resolve any lint or type failures**

If `npm run check` fails:

- Read the failure output.
- Fix issues in the file the failure points to. Common cases:
  - A missed `import type` for one of the new types — add it.
  - A stale `// @ts-expect-error` that no longer applies — remove it.
  - A barrel re-export missing a newly exported type — add it to `src/features/assessment/domain/index.ts`.
- Re-run `npm run check` until it passes.
- If you change files in this step, commit with a focused message such as `fix(assessment): align barrel exports with new types`.

- [ ] **Step 3: Final summary commit (only if any cleanup happened in Step 2)**

If Step 2 made changes:

```sh
git add -- <files-changed>
git commit -m "<focused message describing the cleanup>"
```

If Step 2 made no changes, skip this step.

- [ ] **Step 4: Confirm clean state**

Run: `git status`
Expected: `nothing to commit, working tree clean`.

Run: `git log --oneline -12`
Expected: a commit per task in order:
`feat(assessment): add shared types`,
`feat(assessment): derive shared signals`,
`feat(assessment): apply hard lock rules`,
`feat(assessment): propose base rating`,
`feat(assessment): upgrade Good to Easy`,
`feat(assessment): collect structured warnings`,
`feat(assessment): score deterministic confidence`,
`refactor(assessment): compose policy from layered rule pipeline`,
`feat(overlay-session): thread timerUsed and render fast-solve feedback`,
optionally `fix(assessment): align barrel exports`.

Implementation complete.
