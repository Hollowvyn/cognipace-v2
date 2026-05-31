# Deterministic Assessment Policy Design

## Status

Approved design from brainstorming on 2026-05-30. This is a planning artifact
for issue #1 (Perfect the deterministic LeetCode assessment policy). Current
product and architecture docs remain the source of truth until the
implementation lands.

## Context

`src/features/assessment/domain/assessment.ts` today owns the single function
`evaluateLeetCodeAssessment`. It maps a submission intent plus timing settings
to a `LeetCodeAssessmentDecision` with `rating`, `elapsedSeconds`, `isCorrect`,
`targetSeconds`, `isOverTarget`, `lockReason`, and a tight enum `reason`.

The only consumer is `src/features/overlay-session/hooks/use-overlay-review-actions.ts`,
which reads `decision.rating`, `decision.elapsedSeconds`, `decision.isCorrect`,
and `decision.lockReason`. The reason enum is not read directly today; copy is
selected from `decision.lockReason` in `formatAssessmentFeedback`.

The current policy never auto-recommends `easy`; an `easy` rating only reaches
the decision via `intent: 'selected-rating'`. It also has no notion of
confidence, warnings, or practice context.

Issue #1 unblocks #2 (review session context), #5 (review assistant prompt),
and #7 (overlay AI recommendation hook). Those layers need a strong local
baseline with a confidence signal and structured reasoning the AI layer can
inspect, so that when provider config is missing, the provider is slow, or
model output is invalid, CogniPace still produces a safe rating and a clear
explanation.

## Decisions

- Keep the policy in `src/features/assessment/domain`. No React, no Chrome
  runtime, no DB, no LeetCode DOM access in any file under it.
- Split today's single file into a small named-rule pipeline. One function per
  concern, each pure and independently unit-testable.
- Allow auto `easy` only via a strict practice-context gate. First-solves never
  auto-upgrade to `easy`; the deterministic baseline stays conservative.
- Represent `confidence` as a numeric `0`–`1` score, deterministic, computed
  from a fixed table of multiplicative factors.
- Represent `reason` and each `warning` as `{ code, signals }` objects. The
  policy never emits display strings; UI and AI layers interpolate signals into
  copy or prompts.
- Keep `lockReason` as a flat enum (`'failed' | 'hard-mode-overtime' | null`).
  It gates session-lock UI behavior and is read with `===` in multiple places.
- Do not rename `strictTiming` (settings name) or `hard-mode-overtime` (existing
  `lockReason` / reason value). The two names already coexist in this codebase
  and renaming either would touch settings UI, persistence, or callers for no
  behavior gain. New reason and warning codes follow the existing
  `hard-mode-overtime` vocabulary.
- `practiceContext` is fully optional on input. Callers that lack it (the
  overlay today) keep working; the policy emits `no-practice-context` and
  related warnings and lowers confidence accordingly.
- Wiring real `practiceContext` is out of scope for this issue. Issue #2 will
  build the review session context and feed it in.

## Goals

- Give the assessment policy a richer typed decision that explains itself well
  enough for an AI recommendation layer to consume or override safely.
- Preserve every existing rating outcome for current call sites, including
  fail locks and strict-timing overtime locks.
- Introduce a single new auto-rating outcome (`easy`) under a strict gate.
- Make every threshold and confidence weight a named constant in one file so
  later tuning is one diff.

## Non-Goals

- No AI provider integration, prompt design, or runtime endpoint.
- No change to FSRS scheduling, practice persistence, or read models.
- No new persisted fields. The decision object is transient runtime data.
- No new settings UI. `requireSolveTime` and `strictTiming` are existing
  settings; the policy continues to honor them.
- No renames of public types beyond shape extension (additive on `LeetCodeAssessmentInput`
  and `LeetCodeAssessmentDecision`).
- No changes to the blocked-decision flow beyond wrapping `reason` in
  `{ code, signals }` for shape consistency.

## File Layout

```
src/features/assessment/
  domain/
    assessment.ts                // public entrypoint + orchestrator
    assessment-types.ts          // Input, Decision, Reason/Warning code unions
    derived.ts                   // deriveAssessmentSignals
    rules/
      hard-locks.ts              // applyHardLocks
      base-rating.ts             // proposeBaseRating
      easy-gate.ts               // applyEasyGate, EASY_GATE_RATIO
      confidence.ts              // scoreConfidence, CONFIDENCE_FACTORS
      warnings.ts                // collectWarnings
    assessment.test.ts           // top-level end-to-end table tests
    derived.test.ts
    rules/
      hard-locks.test.ts
      base-rating.test.ts
      easy-gate.test.ts
      confidence.test.ts
      warnings.test.ts
    index.ts                     // re-exports
  index.ts                       // unchanged barrel
```

## Orchestrator

`assessment.ts` composes the pipeline:

```ts
export function evaluateLeetCodeAssessment(
  input: LeetCodeAssessmentInput,
): LeetCodeAssessmentDecision {
  const derived = deriveAssessmentSignals(input)
  const locked = applyHardLocks(input, derived)

  if (locked) {
    const warnings = collectWarnings(input, derived, {
      proposedRating: 'again',
      easyUpgraded: false,
      lockReason: locked.lockReason,
      selectedRatingConflicts: false,
    })
    return assembleAccepted({
      input, derived,
      rating: 'again',
      reasonCode: locked.reasonCode,
      lockReason: locked.lockReason,
      warnings,
      confidence: 1,
    })
  }

  const base = proposeBaseRating(input, derived)
  const final = applyEasyGate(input, derived, base)
  const easyUpgraded = final.rating !== base.rating

  const selectedRatingConflicts =
    input.intent === 'selected-rating' &&
    input.selectedRating !== base.rating

  const downgradedFromPrevious = isDowngrade(
    final.rating,
    input.practiceContext?.previousRating ?? null,
  )

  const warnings = collectWarnings(input, derived, {
    proposedRating: final.rating,
    easyUpgraded,
    lockReason: null,
    selectedRatingConflicts,
  })

  const confidence = scoreConfidence(input, derived, {
    lockReason: null,
    downgradedFromPrevious,
    selectedRatingConflicts,
  })

  return assembleAccepted({
    input, derived,
    rating: final.rating,
    reasonCode: final.reasonCode,
    lockReason: null,
    warnings,
    confidence,
  })
}
```

## Input Contract

```ts
export type AssessmentPracticeContext = {
  isFirstSolve: boolean
  previousRating: ReviewRating | null
  previousBestSeconds: number | null
  latestAttempt: {
    rating: ReviewRating
    isCorrect: boolean
    elapsedSeconds: number | null
    occurredAt: number // epoch ms
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
  | ({ intent: 'selected-rating'; selectedRating: ReviewRating } & BaseAssessmentInput)
  | ({ intent: 'fail' } & BaseAssessmentInput)
```

Notes:

- `practiceContext` is fully optional. When absent the policy emits a
  `no-practice-context` warning and the Easy gate cannot fire.
- `timerUsed` is optional; when omitted it defaults to `elapsedSeconds != null`
  for back-compat with existing callers. Passing `timerUsed: false` explicitly
  marks the elapsed value as untrusted even when present.
- No changes to `AssessmentTimingSettings`, `ProblemDifficulty`, or `ReviewRating`.

## Decision Contract

```ts
export type AssessmentReasonCode =
  | 'failed'
  | 'hard-mode-overtime'
  | 'quick-good'
  | 'quick-hard-overtime'
  | 'leetcode-good'
  | 'leetcode-hard-overtime'
  | 'leetcode-easy-fast'
  | 'quick-easy-fast'
  | 'selected-rating'

export type AssessmentWarningCode =
  | 'untimed'
  | 'solve-time-required-missing'
  | 'no-practice-context'
  | 'first-solve'
  | 'no-previous-best'
  | 'retry-after-fail'
  | 'downgrade-from-previous'
  | 'selected-rating-conflict'

export type AssessmentReason = {
  code: AssessmentReasonCode
  signals: {
    elapsedSeconds: number | null
    targetSeconds: number
    ratioOfTarget: number | null
    previousBestSeconds: number | null
    beatsPreviousBest: boolean | null
    isRecallReview: boolean | null
  }
}

export type AssessmentWarning = {
  code: AssessmentWarningCode
  signals: Record<string, number | string | boolean | null>
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
      confidence: number // 0–1, two decimal places
    }
  | {
      status: 'blocked'
      reason: {
        code: AssessmentBlockReason
        signals: { targetSeconds: number }
      }
      targetSeconds: number
      elapsedSeconds: null
    }
```

`reason` becomes an object on both accepted and blocked decisions for shape
consistency. `lockReason` stays a flat top-level enum because it gates session
lock UI and is read with `===`.

## Derived Signals

`deriveAssessmentSignals(input)` is the single place thresholds and ratios are
computed. Rules read from `derived` and never recompute.

```ts
type AssessmentDerivedSignals = {
  targetSeconds: number
  elapsedSeconds: number | null
  isUntimed: boolean
  isOverTarget: boolean
  ratioOfTarget: number | null
  isRecallReview: boolean | null
  beatsPreviousBest: boolean | null
}
```

Computation rules:

- `targetSeconds = getLeetCodeSolveTimeTargetSeconds(input.difficulty, input.timing)`.
- `elapsedSeconds` is normalized via the existing `normalizeElapsedSeconds` (positive
  integer or `null`).
- `isUntimed = input.timerUsed === false || elapsedSeconds == null`.
- `isOverTarget = elapsedSeconds != null && elapsedSeconds > targetSeconds`.
- `ratioOfTarget = elapsedSeconds != null ? elapsedSeconds / targetSeconds : null`.
- `isRecallReview` is `null` when `practiceContext` is absent, else
  `!practiceContext.isFirstSolve`.
- `beatsPreviousBest` is `null` when `practiceContext` is absent or
  `previousBestSeconds` is null; `false` when untimed; otherwise
  `elapsedSeconds < previousBestSeconds`.

## Rule: Hard Locks

`applyHardLocks(input, derived)` returns `{ lockReason, reasonCode } | null`,
evaluated in order:

1. `intent === 'fail'` → `{ lockReason: 'failed', reasonCode: 'failed' }`.
2. `derived.isOverTarget && input.timing.strictTiming` →
   `{ lockReason: 'hard-mode-overtime', reasonCode: 'hard-mode-overtime' }`.
   This applies even to `selected-rating`, matching today's behavior.
3. Otherwise `null`.

Locked decisions always set `rating: 'again'` and `confidence: 1`.

## Rule: Base Rating

`proposeBaseRating(input, derived)` returns `{ rating, reasonCode }` and is
only called when `applyHardLocks` returned `null`:

- `selected-rating` → `{ rating: input.selectedRating, reasonCode: 'selected-rating' }`.
- `quick-submit` → over target: `{ rating: 'hard', reasonCode: 'quick-hard-overtime' }`;
  else `{ rating: 'good', reasonCode: 'quick-good' }`.
- `leetcode-accepted` → over target: `{ rating: 'hard', reasonCode: 'leetcode-hard-overtime' }`;
  else `{ rating: 'good', reasonCode: 'leetcode-good' }`.

## Rule: Easy Gate

`applyEasyGate(input, derived, base)` returns `base` unchanged unless **all**
of the following hold, in which case it returns an upgraded rating:

- `input.intent` is `'quick-submit'` or `'leetcode-accepted'`.
- `base.rating === 'good'`.
- `derived.isRecallReview === true`.
- `derived.ratioOfTarget != null && derived.ratioOfTarget <= EASY_GATE_RATIO`.
- `derived.beatsPreviousBest === true`.

`EASY_GATE_RATIO = 0.5`, exported from `rules/easy-gate.ts`.

Upgrade output:

```ts
{
  rating: 'easy',
  reasonCode: input.intent === 'quick-submit'
    ? 'quick-easy-fast'
    : 'leetcode-easy-fast',
}
```

The gate never fires for `selected-rating` or `fail`. On first solves the
policy returns `good` and emits `first-solve` plus (when applicable)
`no-previous-best`; the UI or AI layer may surface "could be Easy" itself
without changing the deterministic baseline.

## Rule: Confidence

`scoreConfidence(input, derived, ctx)` returns a number in `[0, 1]` rounded to
two decimals.

```ts
export const CONFIDENCE_FACTORS = {
  untimed:                  0.60,
  noPracticeContext:        0.80,
  firstSolve:               0.85,
  noPreviousBest:           0.90,
  retryAfterFail:           0.85,
  downgradeFromPrevious:    0.90,
  selectedRatingConflict:   0.85,
  solveTimeRequiredMissing: 0.70,
} as const
```

Algorithm:

- Locked decisions return `1`.
- Otherwise start at `1` and multiply by each factor whose condition holds.
- Round to two decimals.

Conditions (multiple may apply):

| Factor | Condition |
|---|---|
| `untimed` | `derived.isUntimed` |
| `noPracticeContext` | `input.practiceContext == null` |
| `firstSolve` | `input.practiceContext?.isFirstSolve === true` |
| `noPreviousBest` | `input.practiceContext != null && input.practiceContext.previousBestSeconds == null` |
| `retryAfterFail` | `input.practiceContext?.latestAttempt?.isCorrect === false` |
| `downgradeFromPrevious` | `ctx.downgradedFromPrevious` |
| `selectedRatingConflict` | `ctx.selectedRatingConflicts` |
| `solveTimeRequiredMissing` | `input.timing.requireSolveTime && derived.isUntimed` |

Concrete values produced:

- LeetCode-accepted, recall review, timed, beats prior best, gate fires → `1.00`.
- LeetCode-accepted, timed, no practice context → `0.80`.
- Quick-submit, untimed, no practice context → `0.48`.
- Quick-submit, untimed, no practice context, `requireSolveTime: true` → `0.34`.
- Any locked decision → `1.00`.

## Rule: Warnings

`collectWarnings(input, derived, ctx)` returns an `AssessmentWarning[]`.
Warnings emit independently and the array order is stable.

| Code | Condition | `signals` |
|---|---|---|
| `untimed` | `derived.isUntimed` | `{}` |
| `solve-time-required-missing` | `input.timing.requireSolveTime && derived.isUntimed` | `{ targetSeconds }` |
| `no-practice-context` | `input.practiceContext == null` | `{}` |
| `first-solve` | `input.practiceContext?.isFirstSolve === true` | `{}` |
| `no-previous-best` | `input.practiceContext != null && input.practiceContext.previousBestSeconds == null` | `{}` |
| `retry-after-fail` | `input.practiceContext?.latestAttempt?.isCorrect === false` | `{ previousElapsedSeconds, occurredAt }` |
| `downgrade-from-previous` | `input.practiceContext?.previousRating != null && isDowngrade(ctx.proposedRating, input.practiceContext.previousRating)` | `{ previousRating, proposedRating }` |
| `selected-rating-conflict` | `input.intent === 'selected-rating' && ctx.selectedRatingConflicts && ctx.lockReason == null` | `{ selectedRating, policyRating }` |

Order in the returned array matches the order in this table.

Rank ordering for `isDowngrade` and conflict detection:
`again < hard < good < easy`. `isDowngrade(proposed, previous)` returns true
when `rank(proposed) < rank(previous)`.

Warnings still emit under locks, except `selected-rating-conflict`, which is
suppressed because the lock is the override.

## Caller Migration

`src/features/overlay-session/hooks/use-overlay-review-actions.ts` is the only
consumer of `evaluateLeetCodeAssessment`. Changes:

- Thread `timerUsed: timer.hasStarted()` and `practiceContext: undefined` into
  each of the four `evaluateLeetCodeAssessment` call sites.
- Add `hasStarted(): boolean` to `OverlayTimerController` as a read-only
  derivation from existing timer state. No new state is introduced.
- Update `formatAssessmentFeedback(decision)` to additionally read
  `decision.reason.code` for the `quick-easy-fast` and `leetcode-easy-fast`
  cases (success toast text: "Fast solve — saved as Easy"). Existing
  `decision.lockReason` checks for `failed` and `hard-mode-overtime` are
  unchanged.

`saveAcceptedReview` is unchanged: it reads only `rating`, `elapsedSeconds`,
`isCorrect`, and `lockReason`.

No other files in `src/` import from `@/features/assessment`.

## Test Plan

Vitest, table-driven where natural. Tests live next to the code they exercise.

- `derived.test.ts`: `targetSeconds`, `isUntimed` (including `timerUsed: false`
  with positive elapsed), `isOverTarget`, `ratioOfTarget`,
  `isRecallReview`/`beatsPreviousBest` for the three relevant states
  (no context, recall with prior best, first solve).
- `rules/hard-locks.test.ts`: fail intent always locks; strict-timing overtime
  locks (including overriding a selected `easy`); strict timing under target
  does not lock; non-strict overtime does not lock.
- `rules/base-rating.test.ts`: each non-fail intent under and over target;
  selected-rating passes through unchanged.
- `rules/easy-gate.test.ts`:
  - fires: `leetcode-accepted`, recall review, ratio `0.4`, beats previous
    best → `easy`.
  - does not fire: `quick-submit`, first solve, ratio `0.3` → `good`.
  - does not fire: recall review, ratio `0.4`, `previousBestSeconds` null →
    `good`.
  - does not fire: recall review, ratio `0.4`, slower than previous best →
    `good`.
  - does not fire: recall review, ratio `0.6`, beats previous best → `good`.
  - never fires for `selected-rating` or `fail`.
- `rules/confidence.test.ts`: the five concrete values listed in the Rule
  section, plus an empty-state baseline (all-true context, timed) returning
  `1.00`, and a locked decision returning `1.00`.
- `rules/warnings.test.ts`: one assertion per warning code firing in isolation,
  plus a combination case (`untimed` + `no-practice-context`) verifying both
  fire in stable order, and a lock case verifying `selected-rating-conflict`
  is suppressed.
- `assessment.test.ts`: end-to-end cases asserting assembled
  `decision.reason.code`, `decision.confidence`, and
  `decision.warnings.map(w => w.code)` for representative scenarios. Existing
  cases continue to apply, but their `reason` assertions must be rewritten from
  the flat enum (`reason: 'quick-good'`) to the wrapped object
  (`reason: { code: 'quick-good' }`); `toMatchObject` then matches partially on
  the nested object. The `acceptedDecision` and `strictTimingOvertime` test
  helpers are updated to emit the wrapped shape.

No new tests are required in `overlay-session`. Existing behavior is preserved;
if feedback copy changes, update the copy expectations in
`use-overlay-review-actions.test.*`.

## Acceptance Criteria Mapping

- "Assessment returns `rating`, `isCorrect`, `elapsedSeconds`, `targetSeconds`,
  `isOverTarget`, `lockReason`, `confidence`, `reason`, and `warnings`."
  → Decision Contract section.
- "Existing overlay save/update behavior still works." → Caller Migration
  section.
- "Existing hard-mode and fail behavior is preserved." → Rule: Hard Locks
  section.
- "No practice persistence changes are required." → Non-Goals.

## Dependencies

Depends on: none. This is the first issue in the GenAI assessment cluster.

Unblocks: #2 (review session context will provide `practiceContext`), #5
(LeetCode review assistant prompt and schema will consume `reason`,
`confidence`, and `warnings`), #7 (overlay AI recommendation hook).
