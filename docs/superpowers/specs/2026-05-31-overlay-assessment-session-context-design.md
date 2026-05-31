# Overlay Assessment Session Context Design

## Status

Approved design from brainstorming on 2026-05-31. This is a planning artifact
for issue #2 (Add review session context without polluting practice
persistence). Current product and architecture docs remain the source of truth
until the implementation lands.

## Context

Issue #1 shipped a deterministic assessment policy that accepts an optional
`AssessmentPracticeContext` (first-solve flag, previous rating, previous best
seconds, latest attempt). The overlay caller currently passes
`practiceContext: undefined` at all four `evaluateLeetCodeAssessment` call
sites in `src/features/overlay-session/hooks/use-overlay-review-actions.ts`, so
the policy's Easy gate cannot fire and confidence is always penalized with
`no-practice-context`.

All of the data needed to populate `AssessmentPracticeContext` already lives in
`OverlayAppShellData.overlay.practice` (a `SerializedPracticeDetails`). Issue
#2's scope is to wire a small transient session-context layer in
`overlay-session/` that:

- Derives a richer `OverlayAssessmentSessionContext` from the existing overlay
  context + transient overlay state.
- Projects to the policy's `AssessmentPracticeContext` via a tiny mapper.
- Records additional signals the AI layer (issues #5 / #7) will need:
  submission source, draft-changed flag, full latest attempt with id.

The context is not persisted. No new DB fields, no new write paths, no changes
to `review_attempts`.

## Decisions

- Pure derivation, not reducer-stored state. The session context has no
  independent lifecycle; it is a function of the current overlay context,
  overlay state, the call site's submission source, and the timer's
  `hasStarted()`.
- Two pure functions in `src/features/overlay-session/domain/session-context.ts`:
  `deriveOverlayAssessmentSessionContext` and `toAssessmentPracticeContext`.
  Both are React-free and synchronously testable.
- The session context carries the full `latestAttempt` shape (id + the four
  policy-relevant fields), not just an id. The mapper projects to the policy
  context with one shape-change (strip the id) and one rename
  (`bestElapsedSeconds` → `previousBestSeconds`).
- `submissionSource` is a literal passed by each call site. It is never
  inferred from `visualMode` or other state, because the four code paths are
  the canonical source-of-truth for "which user gesture triggered this".
- `sessionKind` is derived from `latestAttempt` presence, matching issue #2's
  test wording: "First solve detected when no latest attempt exists; recall
  review detected when latest attempt exists." `solvedCount` is not used.
- The session-context module is exported from `overlay-session/index.ts` so the
  future AI hook (issue #7) can consume it without reaching into internals.
- No changes to `OverlaySessionState`, `OverlaySessionAction`, the reducer, or
  any other domain file. Existing `page-changed` and `restart-local-session`
  actions already reset the inputs the deriver reads from; reset behavior is
  implicit.

## Goals

- Make the deterministic Easy gate from issue #1 reachable from real overlay
  use (recall review, fast solve beating previous best).
- Give the AI layer (issues #5 / #7) a single typed contract carrying all the
  session signals it will need, derived in one place.
- Add zero persistence and zero new state.

## Non-Goals

- No AI integration, prompt, or runtime endpoint (issues #3–#9).
- No persistence of session context or AI output.
- No changes to FSRS scheduling, practice persistence, or schemas.
- No changes to the overlay reducer, actions, or visual state.
- No changes to `LeetCodeOverlayContext` or `SerializedPracticeDetails`.
- No new UI surface. The session context is invisible to the user this pass.

## File Layout

```
src/features/overlay-session/
  domain/
    session-context.ts                  // NEW
    session-context.test.ts             // NEW
    index.ts                            // re-export new symbols
    overlay-session-state.ts            // unchanged
    overlay-draft.ts                    // unchanged
    overlay-format.ts                   // unchanged
  hooks/
    use-overlay-review-actions.ts       // four call sites updated
  index.ts                              // re-export new symbols
```

## Contracts

### `OverlayAssessmentSessionContext`

```ts
import type { ReviewRating } from '@/lib/fsrs'

export type OverlaySubmissionSource =
  | 'manual-overlay'      // submitReview, failReview
  | 'collapsed-quick'     // prepareQuickSubmit
  | 'leetcode-watcher'    // saveLeetCodeSubmissionResult

export type OverlayAssessmentLatestAttempt = {
  id: string
  rating: ReviewRating
  isCorrect: boolean
  elapsedSeconds: number | null
  occurredAt: number // epoch ms
}

export type OverlayAssessmentSessionContext = {
  sessionKind: 'first-solve' | 'recall-review'
  submissionSource: OverlaySubmissionSource
  timerUsed: boolean
  previousRating: ReviewRating | null
  bestElapsedSeconds: number | null
  latestAttempt: OverlayAssessmentLatestAttempt | null
  currentDraftHasChanges: boolean
}
```

### `DeriveOverlayAssessmentSessionContextInput`

```ts
import type { OverlayAppShellData } from '@/features/app-shell'

import type { OverlaySessionState } from './overlay-session-state'

export type OverlayAssessmentContext = OverlayAppShellData['overlay']

export type DeriveOverlayAssessmentSessionContextInput = {
  context: OverlayAssessmentContext
  overlay: OverlaySessionState
  submissionSource: OverlaySubmissionSource
  timerUsed: boolean
}
```

The `context` parameter is required (non-nullable). All four call sites already
short-circuit with an error message when the LeetCode problem is not yet
synced, so the deriver never sees a null context.

`OverlayAssessmentContext` is a domain-local alias for the existing
`OverlayAppShellData['overlay']` type. The deriver depends on a contract
(`@/features/app-shell`), not a hook (`use-leetcode-page-sync.ts`), which keeps
the domain layer free of hook imports. The hook's existing
`LeetCodeOverlayContext` alias remains for its own callers.

## Derivation Rules

`deriveOverlayAssessmentSessionContext(input)` returns
`OverlayAssessmentSessionContext` using these rules:

| Field | Source |
|---|---|
| `sessionKind` | `input.context.practice?.latestAttempt == null ? 'first-solve' : 'recall-review'` |
| `submissionSource` | `input.submissionSource` (literal) |
| `timerUsed` | `input.timerUsed` |
| `previousRating` | `input.context.practice?.practice?.lastRating ?? null` |
| `bestElapsedSeconds` | `input.context.practice?.practice?.bestElapsedSeconds ?? null` |
| `latestAttempt` | projected from `input.context.practice?.latestAttempt`; `null` if absent |
| `currentDraftHasChanges` | `hasUnpersistedDraftChanges(input.overlay)` (existing helper) |

The `latestAttempt` projection maps the schema fields directly:

```ts
{
  id: latestAttempt.id,
  rating: latestAttempt.rating,
  isCorrect: latestAttempt.isCorrect ?? latestAttempt.rating !== 'again',
  elapsedSeconds: latestAttempt.elapsedSeconds,
  occurredAt: Date.parse(latestAttempt.reviewedAt),
}
```

Two notes:

- `isCorrect` falls back to `rating !== 'again'` to handle older records where
  the schema allowed `isCorrect: null`. The fallback matches existing code in
  `createSubmittedSnapshotFromPracticeDetails` in `use-overlay-review-actions.ts`.
- `occurredAt` is parsed once here so downstream consumers (the AI layer in
  particular) get an epoch number, not an ISO string.

## Mapper to Policy Context

`toAssessmentPracticeContext(session)` returns `AssessmentPracticeContext`:

```ts
return {
  isFirstSolve: session.sessionKind === 'first-solve',
  previousRating: session.previousRating,
  previousBestSeconds: session.bestElapsedSeconds,
  latestAttempt: session.latestAttempt
    ? {
        rating: session.latestAttempt.rating,
        isCorrect: session.latestAttempt.isCorrect,
        elapsedSeconds: session.latestAttempt.elapsedSeconds,
        occurredAt: session.latestAttempt.occurredAt,
      }
    : null,
}
```

The mapper strips the `id` field (the policy doesn't need it) and renames
`bestElapsedSeconds` to `previousBestSeconds` (the name the policy uses). All
other fields pass through.

## Caller Migration

`src/features/overlay-session/hooks/use-overlay-review-actions.ts` has four
`evaluateLeetCodeAssessment` call sites. Each one adds one derivation and
threads `practiceContext`. The existing problem-not-synced guards stay; the
deriver is called after them.

For each site, replace the existing `evaluateLeetCodeAssessment({...})`
invocation with:

```ts
const session = deriveOverlayAssessmentSessionContext({
  context: currentContext,
  overlay: overlayRef.current,
  submissionSource: '<literal-per-site>',
  timerUsed: timer.hasStarted(),
})

const decision = evaluateLeetCodeAssessment({
  intent: '<unchanged>',
  difficulty: problem.difficulty,
  timing: currentContext.timing,
  elapsedSeconds: timer.readElapsedSeconds(),
  timerUsed: session.timerUsed,
  practiceContext: toAssessmentPracticeContext(session),
  // selectedRating: ... // only for submitReview's selected-rating intent
})
```

Per-site `submissionSource` literals:

| Function | `submissionSource` |
|---|---|
| `prepareQuickSubmit` | `'collapsed-quick'` |
| `submitReview` | `'manual-overlay'` |
| `failReview` | `'manual-overlay'` |
| `saveLeetCodeSubmissionResult` (both ternary arms) | `'leetcode-watcher'` |

The `submissionSource` is the same for both arms of
`saveLeetCodeSubmissionResult` (accepted and failed) because the source is
about where the submission originated, not what it said. The intent field on
the assessment input still distinguishes accepted vs failed.

Other state in `use-overlay-review-actions.ts` is unchanged. No new refs, no
new dispatch actions, no changes to `saveAcceptedReview` or
`createSubmittedSnapshotFromPracticeDetails`.

## Visibility / Barrels

`src/features/overlay-session/domain/index.ts` adds re-exports:

```ts
export {
  deriveOverlayAssessmentSessionContext,
  toAssessmentPracticeContext,
  type DeriveOverlayAssessmentSessionContextInput,
  type OverlayAssessmentLatestAttempt,
  type OverlayAssessmentSessionContext,
  type OverlaySubmissionSource,
} from './session-context'
```

`src/features/overlay-session/index.ts` re-exports the same symbols at the
feature level so the future AI hook can `import { ... } from '@/features/overlay-session'`.

## Reset Behavior

Issue #2's acceptance criteria include "Context resets on SPA navigation and
restart" and "Existing overlay save, update, fail, restart, and automation
flows continue to work". Both are satisfied implicitly because the session
context is a pure derivation:

- SPA navigation dispatches `page-changed`, which clears `activeProblemSlug`
  and resets the draft / selectedRating / submittedSession in the reducer.
  `contextRef.current` becomes the next problem's context once page-sync
  completes. Any subsequent derivation reads the new context.
- `restart-local-session` resets the draft, timer, selectedRating, and
  submittedSession via the reducer. The same `context` ref still points at the
  current problem; the next derivation produces a fresh session context with
  the reset overlay fields.

No new reset actions or guards are needed.

## Edge Cases

- **No practice record yet** (`context.practice == null`): the deriver returns
  `sessionKind: 'first-solve'`, `previousRating: null`,
  `bestElapsedSeconds: null`, `latestAttempt: null`. The policy receives the
  same shape via the mapper; the Easy gate cannot fire (correct, no prior
  best).
- **Practice record present but no `latestAttempt`** (problem opened but
  never reviewed): same as above except `previousRating` and
  `bestElapsedSeconds` may still come back null because they live on the
  nullable `practice.practice` snapshot inside `SerializedPracticeDetails`.
  Treat all nullable reads consistently with `?.` and `?? null`.
- **Untimed solve** (`timerUsed: false`): passes straight through to the
  policy. The policy already treats this as a confidence penalty via the
  `untimed` factor.
- **`latestAttempt.elapsedSeconds === null`** (older attempts saved without a
  timer): passes through to the policy as `null`. The policy's
  `beatsPreviousBest` logic already handles null elapsed correctly.

## Test Plan

Tests live alongside the code they exercise. Vitest, no React, no mocks of the
runtime.

**`session-context.test.ts`** (new file):

`deriveOverlayAssessmentSessionContext` cases:

- marks `first-solve` when `latestAttempt` is null
- marks `recall-review` when `latestAttempt` is present
- marks `first-solve` when `practice` is absent entirely (covers the no-practice
  edge case)
- table case for `submissionSource`: passes through each of the three literals
- table case for `timerUsed`: passes through `true` and `false`
- `previousRating` reads from `practice.practice.lastRating`
- `bestElapsedSeconds` reads from `practice.practice.bestElapsedSeconds`
- `latestAttempt` projects all five fields, parsing `occurredAt` from ISO
- `latestAttempt.isCorrect` falls back to `rating !== 'again'` when source is
  null
- `latestAttempt` is null when `practice.latestAttempt` is null
- `currentDraftHasChanges` is true when the draft differs from
  `persistedDraft`, false when identical

`toAssessmentPracticeContext` cases:

- maps `sessionKind: 'first-solve'` → `isFirstSolve: true`
- maps `sessionKind: 'recall-review'` → `isFirstSolve: false`
- maps `bestElapsedSeconds` → `previousBestSeconds`
- `latestAttempt` projects to the four policy fields and drops `id`
- `latestAttempt: null` in session → `latestAttempt: null` in policy context

**Integration check** — `use-overlay-review-actions.test.*` and
`use-leetcode-overlay-session.test.tsx` should continue passing. If any
existing test asserts on the exact `evaluateLeetCodeAssessment` input object
(typically via `expect(spy).toHaveBeenCalledWith(...)`), update the fixture to
include `practiceContext` derived from the test's context, and `timerUsed`.

**SPA-navigation regression** — add one integration test in
`use-leetcode-overlay-session.test.tsx`: trigger a submit on a recall-review
problem, assert the saved decision was computed with `isFirstSolve: false`;
dispatch `page-changed`; load a first-solve problem; trigger another submit;
assert the second decision was computed with `isFirstSolve: true`. If the
existing harness cannot intercept the assessment input directly, fall back to
asserting on the saved review's `decision.reason.code` (which differs because
the Easy gate fires on the first case but not the second when inputs differ).

## Acceptance Criteria Mapping

- "Deterministic assessment can consume the derived context." → Mapper to
  Policy Context + Caller Migration sections.
- "GenAI request can consume the derived context." → Visibility / Barrels
  section exports the type and deriver for issue #7.
- "Context resets on SPA navigation and restart." → Reset Behavior section.
- "Context is not persisted to practice history." → Non-Goals.
- "Existing overlay save, update, fail, restart, and automation flows continue
  to work." → Caller Migration plus integration check in Test Plan.

## Dependencies

Depends on: #1 (lands the `AssessmentPracticeContext` shape and the
`timerUsed` input).

Unblocks: #5 (review assistant prompt consumes the session context), #6
(runtime endpoint passes the session context), #7 (overlay AI recommendation
hook uses the same deriver).
