# Overlay Assessment Session Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire transient session context into the overlay so the deterministic Easy gate (issue #1) can fire from real use and the AI layer (issues #5/#7) has a typed contract to consume.

**Architecture:** Two pure functions in a new `src/features/overlay-session/domain/session-context.ts` — `deriveOverlayAssessmentSessionContext` and `toAssessmentPracticeContext`. The four `evaluateLeetCodeAssessment` call sites in `use-overlay-review-actions.ts` derive a session context inline and pass `practiceContext` to the policy. No new reducer state, no persistence.

**Tech Stack:** TypeScript, Vitest, React 19 (no new framework code). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-31-overlay-assessment-session-context-design.md`

---

## File Plan

**Create:**
- `src/features/overlay-session/domain/session-context.ts`
- `src/features/overlay-session/domain/session-context.test.ts`

**Modify:**
- `src/features/overlay-session/domain/index.ts` (add re-exports)
- `src/features/overlay-session/index.ts` (add re-exports)
- `src/features/overlay-session/hooks/use-overlay-review-actions.ts` (four call sites + import)
- `src/features/overlay-session/hooks/use-leetcode-overlay-session.test.tsx` (extend `renderReadySession` to accept `practice`; add two new integration tests)

**Conventions:**
- Test files sit next to source.
- Run a single test file with `npx vitest run <path>`.
- Run a single test by name with `npx vitest run <path> -t "<name>"`.
- Full validation: `npm run check` (drizzle + typecheck + lint + vitest).
- Commit messages follow conventional commits.

---

## Task 1: Build `session-context.ts` + tests (TDD)

**Files:**
- Create: `src/features/overlay-session/domain/session-context.ts`
- Create: `src/features/overlay-session/domain/session-context.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/features/overlay-session/domain/session-context.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import type { OverlayAppShellData } from '@/features/app-shell'
import type { SerializedPracticeDetails } from '@/features/practice'

import { createEmptyOverlayDraft } from './overlay-draft'
import {
  initialOverlaySessionState,
  type OverlaySessionState,
} from './overlay-session-state'
import {
  deriveOverlayAssessmentSessionContext,
  toAssessmentPracticeContext,
  type OverlayAssessmentSessionContext,
} from './session-context'

type Context = OverlayAppShellData['overlay']

const baseAttempt = {
  id: 'attempt-1',
  problemSlug: 'two-sum',
  cardId: 'fsrs:two-sum',
  rating: 'good',
  reviewMode: 'leetcode',
  reviewedAt: '2026-05-30T10:00:00.000Z',
  elapsedSeconds: 600,
  isCorrect: true,
  log: {
    interviewPattern: null,
    timeComplexity: null,
    spaceComplexity: null,
    languages: null,
    notes: null,
  },
  createdAt: '2026-05-30T10:00:00.000Z',
  updatedAt: '2026-05-30T10:00:00.000Z',
} satisfies NonNullable<SerializedPracticeDetails['latestAttempt']>

function makePractice(
  overrides: Partial<SerializedPracticeDetails> = {},
): SerializedPracticeDetails {
  return {
    problemSlug: 'two-sum',
    cardId: 'fsrs:two-sum',
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

function makeContext(
  practice: SerializedPracticeDetails | null = null,
): Context {
  return {
    appearance: { themeMode: 'system' },
    automation: { autoDetectSolved: false },
    problem: {
      problemSlug: 'two-sum',
      title: 'Two Sum',
      difficulty: 'medium',
      isPremium: false,
    },
    practice,
    timing: {
      requireSolveTime: false,
      strictTiming: false,
      timeTargetsMinutes: { easy: 20, medium: 35, hard: 50 },
    },
    nextStep: null,
  }
}

function makeOverlay(
  patch: Partial<OverlaySessionState> = {},
): OverlaySessionState {
  return {
    ...initialOverlaySessionState,
    activeProblemSlug: 'two-sum',
    ...patch,
  }
}

describe('deriveOverlayAssessmentSessionContext', () => {
  it('marks first-solve when latestAttempt is null', () => {
    const result = deriveOverlayAssessmentSessionContext({
      context: makeContext(makePractice()),
      overlay: makeOverlay(),
      submissionSource: 'manual-overlay',
      timerUsed: true,
    })
    expect(result.sessionKind).toBe('first-solve')
  })

  it('marks recall-review when latestAttempt is present', () => {
    const result = deriveOverlayAssessmentSessionContext({
      context: makeContext(makePractice({ latestAttempt: baseAttempt })),
      overlay: makeOverlay(),
      submissionSource: 'manual-overlay',
      timerUsed: true,
    })
    expect(result.sessionKind).toBe('recall-review')
  })

  it('marks first-solve when practice record is absent entirely', () => {
    const result = deriveOverlayAssessmentSessionContext({
      context: makeContext(null),
      overlay: makeOverlay(),
      submissionSource: 'manual-overlay',
      timerUsed: true,
    })
    expect(result).toMatchObject({
      sessionKind: 'first-solve',
      previousRating: null,
      bestElapsedSeconds: null,
      latestAttempt: null,
    })
  })

  it.each([
    'manual-overlay',
    'collapsed-quick',
    'leetcode-watcher',
  ] as const)('passes submissionSource %s through', (source) => {
    expect(
      deriveOverlayAssessmentSessionContext({
        context: makeContext(null),
        overlay: makeOverlay(),
        submissionSource: source,
        timerUsed: false,
      }).submissionSource,
    ).toBe(source)
  })

  it.each([true, false])('passes timerUsed %s through', (used) => {
    expect(
      deriveOverlayAssessmentSessionContext({
        context: makeContext(null),
        overlay: makeOverlay(),
        submissionSource: 'manual-overlay',
        timerUsed: used,
      }).timerUsed,
    ).toBe(used)
  })

  it('reads previousRating and bestElapsedSeconds from practice.practice', () => {
    const result = deriveOverlayAssessmentSessionContext({
      context: makeContext(
        makePractice({
          practice: {
            status: 'review',
            lastReviewedAt: '2026-05-29T10:00:00.000Z',
            attemptCount: 3,
            solvedCount: 2,
            isSuspended: false,
            lastRating: 'hard',
            lastElapsedSeconds: 1200,
            bestElapsedSeconds: 900,
            log: {
              interviewPattern: null,
              timeComplexity: null,
              spaceComplexity: null,
              languages: null,
              notes: null,
            },
          },
        }),
      ),
      overlay: makeOverlay(),
      submissionSource: 'manual-overlay',
      timerUsed: true,
    })
    expect(result).toMatchObject({
      previousRating: 'hard',
      bestElapsedSeconds: 900,
    })
  })

  it('projects latestAttempt into the five session fields with epoch occurredAt', () => {
    const result = deriveOverlayAssessmentSessionContext({
      context: makeContext(makePractice({ latestAttempt: baseAttempt })),
      overlay: makeOverlay(),
      submissionSource: 'manual-overlay',
      timerUsed: true,
    })
    expect(result.latestAttempt).toEqual({
      id: 'attempt-1',
      rating: 'good',
      isCorrect: true,
      elapsedSeconds: 600,
      occurredAt: Date.parse('2026-05-30T10:00:00.000Z'),
    })
  })

  it('falls back to rating !== "again" when latestAttempt.isCorrect is null', () => {
    const result = deriveOverlayAssessmentSessionContext({
      context: makeContext(
        makePractice({
          latestAttempt: { ...baseAttempt, isCorrect: null, rating: 'hard' },
        }),
      ),
      overlay: makeOverlay(),
      submissionSource: 'manual-overlay',
      timerUsed: true,
    })
    expect(result.latestAttempt?.isCorrect).toBe(true)
  })

  it('falls back to false when latestAttempt.isCorrect is null and rating is again', () => {
    const result = deriveOverlayAssessmentSessionContext({
      context: makeContext(
        makePractice({
          latestAttempt: { ...baseAttempt, isCorrect: null, rating: 'again' },
        }),
      ),
      overlay: makeOverlay(),
      submissionSource: 'manual-overlay',
      timerUsed: true,
    })
    expect(result.latestAttempt?.isCorrect).toBe(false)
  })

  it('returns latestAttempt null when practice.latestAttempt is null', () => {
    expect(
      deriveOverlayAssessmentSessionContext({
        context: makeContext(makePractice()),
        overlay: makeOverlay(),
        submissionSource: 'manual-overlay',
        timerUsed: true,
      }).latestAttempt,
    ).toBeNull()
  })

  it('reports currentDraftHasChanges true when draft differs from persistedDraft', () => {
    const persistedDraft = createEmptyOverlayDraft()
    const draft = { ...persistedDraft, notes: 'unsaved' }
    expect(
      deriveOverlayAssessmentSessionContext({
        context: makeContext(makePractice()),
        overlay: makeOverlay({ draft, persistedDraft }),
        submissionSource: 'manual-overlay',
        timerUsed: true,
      }).currentDraftHasChanges,
    ).toBe(true)
  })

  it('reports currentDraftHasChanges false when draft equals persistedDraft', () => {
    const draft = createEmptyOverlayDraft()
    expect(
      deriveOverlayAssessmentSessionContext({
        context: makeContext(makePractice()),
        overlay: makeOverlay({ draft, persistedDraft: draft }),
        submissionSource: 'manual-overlay',
        timerUsed: true,
      }).currentDraftHasChanges,
    ).toBe(false)
  })
})

describe('toAssessmentPracticeContext', () => {
  function makeSession(
    overrides: Partial<OverlayAssessmentSessionContext> = {},
  ): OverlayAssessmentSessionContext {
    return {
      sessionKind: 'recall-review',
      submissionSource: 'manual-overlay',
      timerUsed: true,
      previousRating: 'good',
      bestElapsedSeconds: 900,
      latestAttempt: {
        id: 'attempt-1',
        rating: 'good',
        isCorrect: true,
        elapsedSeconds: 600,
        occurredAt: Date.parse('2026-05-30T10:00:00.000Z'),
      },
      currentDraftHasChanges: false,
      ...overrides,
    }
  }

  it('maps sessionKind first-solve to isFirstSolve true', () => {
    expect(
      toAssessmentPracticeContext(makeSession({ sessionKind: 'first-solve' }))
        .isFirstSolve,
    ).toBe(true)
  })

  it('maps sessionKind recall-review to isFirstSolve false', () => {
    expect(
      toAssessmentPracticeContext(makeSession({ sessionKind: 'recall-review' }))
        .isFirstSolve,
    ).toBe(false)
  })

  it('maps bestElapsedSeconds to previousBestSeconds (with rename)', () => {
    expect(
      toAssessmentPracticeContext(makeSession({ bestElapsedSeconds: 1234 }))
        .previousBestSeconds,
    ).toBe(1234)
  })

  it('preserves previousRating', () => {
    expect(
      toAssessmentPracticeContext(makeSession({ previousRating: 'hard' }))
        .previousRating,
    ).toBe('hard')
  })

  it('projects latestAttempt to the four policy fields and drops id', () => {
    const result = toAssessmentPracticeContext(makeSession())
    expect(result.latestAttempt).toEqual({
      rating: 'good',
      isCorrect: true,
      elapsedSeconds: 600,
      occurredAt: Date.parse('2026-05-30T10:00:00.000Z'),
    })
  })

  it('passes null latestAttempt through unchanged', () => {
    expect(
      toAssessmentPracticeContext(makeSession({ latestAttempt: null }))
        .latestAttempt,
    ).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npx vitest run src/features/overlay-session/domain/session-context.test.ts`
Expected: FAIL with `Failed to resolve import "./session-context"`.

- [ ] **Step 3: Implement `session-context.ts`**

Create `src/features/overlay-session/domain/session-context.ts`:

```ts
import type { OverlayAppShellData } from '@/features/app-shell'
import type { AssessmentPracticeContext } from '@/features/assessment'
import type { ReviewRating } from '@/lib/fsrs'

import {
  hasUnpersistedDraftChanges,
  type OverlaySessionState,
} from './overlay-session-state'

export type OverlayAssessmentContext = OverlayAppShellData['overlay']

export type OverlaySubmissionSource =
  | 'manual-overlay'
  | 'collapsed-quick'
  | 'leetcode-watcher'

export type OverlayAssessmentLatestAttempt = {
  id: string
  rating: ReviewRating
  isCorrect: boolean
  elapsedSeconds: number | null
  occurredAt: number
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

export type DeriveOverlayAssessmentSessionContextInput = {
  context: OverlayAssessmentContext
  overlay: OverlaySessionState
  submissionSource: OverlaySubmissionSource
  timerUsed: boolean
}

export function deriveOverlayAssessmentSessionContext(
  input: DeriveOverlayAssessmentSessionContextInput,
): OverlayAssessmentSessionContext {
  const practice = input.context.practice
  const latestAttempt = practice?.latestAttempt ?? null

  return {
    sessionKind: latestAttempt === null ? 'first-solve' : 'recall-review',
    submissionSource: input.submissionSource,
    timerUsed: input.timerUsed,
    previousRating: practice?.practice?.lastRating ?? null,
    bestElapsedSeconds: practice?.practice?.bestElapsedSeconds ?? null,
    latestAttempt: latestAttempt
      ? {
          id: latestAttempt.id,
          rating: latestAttempt.rating,
          isCorrect: latestAttempt.isCorrect ?? latestAttempt.rating !== 'again',
          elapsedSeconds: latestAttempt.elapsedSeconds,
          occurredAt: Date.parse(latestAttempt.reviewedAt),
        }
      : null,
    currentDraftHasChanges: hasUnpersistedDraftChanges(input.overlay),
  }
}

export function toAssessmentPracticeContext(
  session: OverlayAssessmentSessionContext,
): AssessmentPracticeContext {
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
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npx vitest run src/features/overlay-session/domain/session-context.test.ts`
Expected: PASS, 20 tests (14 deriver + 6 mapper; the `it.each` cases expand the count).

- [ ] **Step 5: Commit**

```sh
git add src/features/overlay-session/domain/session-context.ts \
        src/features/overlay-session/domain/session-context.test.ts
git commit -m "feat(overlay-session): derive transient assessment session context"
```

---

## Task 2: Re-export from barrels

**Files:**
- Modify: `src/features/overlay-session/domain/index.ts`
- Modify: `src/features/overlay-session/index.ts`

- [ ] **Step 1: Add the new exports to the domain barrel**

Open `src/features/overlay-session/domain/index.ts` and replace the entire file with:

```ts
export { formatOverlayDateTime, formatOverlayDuration } from './overlay-format'
export {
  createOverlayDraftFromLog,
  toPracticeLogPatch,
  type OverlayDraftField,
  type OverlayDraftLog,
} from './overlay-draft'
export {
  hasSubmittedSessionChanges,
  hasUnpersistedDraftChanges,
  initialOverlaySessionState,
  overlaySessionReducer,
  type OverlayFeedback,
  type OverlayNextStepState,
  type OverlayReviewStatus,
  type OverlaySessionState,
  type OverlaySubmittedSession,
} from './overlay-session-state'
export {
  deriveOverlayAssessmentSessionContext,
  toAssessmentPracticeContext,
  type DeriveOverlayAssessmentSessionContextInput,
  type OverlayAssessmentContext,
  type OverlayAssessmentLatestAttempt,
  type OverlayAssessmentSessionContext,
  type OverlaySubmissionSource,
} from './session-context'
```

- [ ] **Step 2: Add the new exports to the feature barrel**

Open `src/features/overlay-session/index.ts` and replace its entire contents with:

```ts
export { OverlayShell } from './components/overlay-shell'
export { useLeetCodeOverlaySession } from './hooks/use-leetcode-overlay-session'
export type { LeetCodeOverlaySession } from './hooks/use-leetcode-overlay-session'
export {
  deriveOverlayAssessmentSessionContext,
  toAssessmentPracticeContext,
  type DeriveOverlayAssessmentSessionContextInput,
  type OverlayAssessmentContext,
  type OverlayAssessmentLatestAttempt,
  type OverlayAssessmentSessionContext,
  type OverlaySubmissionSource,
} from './domain'
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```sh
git add src/features/overlay-session/domain/index.ts \
        src/features/overlay-session/index.ts
git commit -m "feat(overlay-session): re-export session-context contracts"
```

---

## Task 3: Wire all four `evaluateLeetCodeAssessment` call sites

**Files:**
- Modify: `src/features/overlay-session/hooks/use-overlay-review-actions.ts`

The file has four call sites (lines around 170, 194, 219, 243 in the current file). Each one gets one new derivation and threads `practiceContext` plus a small `timerUsed` reshape.

- [ ] **Step 1: Add the import**

Open `src/features/overlay-session/hooks/use-overlay-review-actions.ts` and locate the existing import block from `../domain`:

```ts
import {
  createOverlayDraftFromLog,
  hasSubmittedSessionChanges,
  hasUnpersistedDraftChanges,
  toPracticeLogPatch,
  type OverlayFeedback,
  type OverlaySessionState,
  type OverlaySubmittedSession,
} from '../domain'
```

Replace it with:

```ts
import {
  createOverlayDraftFromLog,
  deriveOverlayAssessmentSessionContext,
  hasSubmittedSessionChanges,
  hasUnpersistedDraftChanges,
  toAssessmentPracticeContext,
  toPracticeLogPatch,
  type OverlayFeedback,
  type OverlaySessionState,
  type OverlaySubmittedSession,
} from '../domain'
```

- [ ] **Step 2: Update `prepareQuickSubmit`**

Find this block (around line 170):

```ts
    const decision = evaluateLeetCodeAssessment({
      intent: 'quick-submit',
      difficulty: problem.difficulty,
      timing: currentContext.timing,
      elapsedSeconds: timer.readElapsedSeconds(),
      timerUsed: timer.hasStarted(),
    })
```

Replace it with:

```ts
    const session = deriveOverlayAssessmentSessionContext({
      context: currentContext,
      overlay: overlayRef.current,
      submissionSource: 'collapsed-quick',
      timerUsed: timer.hasStarted(),
    })

    const decision = evaluateLeetCodeAssessment({
      intent: 'quick-submit',
      difficulty: problem.difficulty,
      timing: currentContext.timing,
      elapsedSeconds: timer.readElapsedSeconds(),
      timerUsed: session.timerUsed,
      practiceContext: toAssessmentPracticeContext(session),
    })
```

- [ ] **Step 3: Update `submitReview`**

Find this block (around line 194):

```ts
    const decision = evaluateLeetCodeAssessment({
      intent: 'selected-rating',
      difficulty: problem.difficulty,
      timing: currentContext.timing,
      selectedRating: overlayRef.current.selectedRating,
      elapsedSeconds: timer.readElapsedSeconds(),
      timerUsed: timer.hasStarted(),
    })
```

Replace with:

```ts
    const session = deriveOverlayAssessmentSessionContext({
      context: currentContext,
      overlay: overlayRef.current,
      submissionSource: 'manual-overlay',
      timerUsed: timer.hasStarted(),
    })

    const decision = evaluateLeetCodeAssessment({
      intent: 'selected-rating',
      difficulty: problem.difficulty,
      timing: currentContext.timing,
      selectedRating: overlayRef.current.selectedRating,
      elapsedSeconds: timer.readElapsedSeconds(),
      timerUsed: session.timerUsed,
      practiceContext: toAssessmentPracticeContext(session),
    })
```

- [ ] **Step 4: Update `failReview`**

Find this block (around line 219):

```ts
    const decision = evaluateLeetCodeAssessment({
      intent: 'fail',
      difficulty: problem.difficulty,
      timing: currentContext.timing,
      elapsedSeconds: timer.readElapsedSeconds(),
      timerUsed: timer.hasStarted(),
    })
```

Replace with:

```ts
    const session = deriveOverlayAssessmentSessionContext({
      context: currentContext,
      overlay: overlayRef.current,
      submissionSource: 'manual-overlay',
      timerUsed: timer.hasStarted(),
    })

    const decision = evaluateLeetCodeAssessment({
      intent: 'fail',
      difficulty: problem.difficulty,
      timing: currentContext.timing,
      elapsedSeconds: timer.readElapsedSeconds(),
      timerUsed: session.timerUsed,
      practiceContext: toAssessmentPracticeContext(session),
    })
```

- [ ] **Step 5: Update `saveLeetCodeSubmissionResult`**

Find this block (around line 243):

```ts
    const decision = evaluateLeetCodeAssessment(
      result.status === 'accepted'
        ? {
            intent: 'leetcode-accepted',
            difficulty: problem.difficulty,
            timing: currentContext.timing,
            elapsedSeconds: timer.readElapsedSeconds(),
            timerUsed: timer.hasStarted(),
          }
        : {
            intent: 'fail',
            difficulty: problem.difficulty,
            timing: currentContext.timing,
            elapsedSeconds: timer.readElapsedSeconds(),
            timerUsed: timer.hasStarted(),
          },
    )
```

Replace with:

```ts
    const session = deriveOverlayAssessmentSessionContext({
      context: currentContext,
      overlay: overlayRef.current,
      submissionSource: 'leetcode-watcher',
      timerUsed: timer.hasStarted(),
    })
    const practiceContext = toAssessmentPracticeContext(session)

    const decision = evaluateLeetCodeAssessment(
      result.status === 'accepted'
        ? {
            intent: 'leetcode-accepted',
            difficulty: problem.difficulty,
            timing: currentContext.timing,
            elapsedSeconds: timer.readElapsedSeconds(),
            timerUsed: session.timerUsed,
            practiceContext,
          }
        : {
            intent: 'fail',
            difficulty: problem.difficulty,
            timing: currentContext.timing,
            elapsedSeconds: timer.readElapsedSeconds(),
            timerUsed: session.timerUsed,
            practiceContext,
          },
    )
```

- [ ] **Step 6: Run the overlay-session suite**

Run: `npx vitest run src/features/overlay-session`
Expected: PASS. The existing tests do not assert on the `practiceContext` field directly, so they should keep passing without changes.

If any test fails because it uses `toHaveBeenCalledWith` with an exact input object, update its expectation to include `practiceContext: expect.any(Object)` (or `expect.objectContaining(...)` if it cares about specific fields). The current test file uses `toMatchObject` on the saved review request, not the assessment input, so this is unlikely to fire.

- [ ] **Step 7: Run the wider check**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```sh
git add src/features/overlay-session/hooks/use-overlay-review-actions.ts
git commit -m "feat(overlay-session): thread practice context into the assessment policy"
```

---

## Task 4: Integration tests proving the Easy gate now fires

**Files:**
- Modify: `src/features/overlay-session/hooks/use-leetcode-overlay-session.test.tsx`

The session-context unit tests prove the deriver and mapper are correct. These integration tests prove the wiring in Task 3 actually reaches the policy by observing the saved review's `rating` for a fast recall solve (must be `easy`) and a fast first-solve (must be `good`).

The spec's optional SPA-navigation regression test is intentionally omitted. Because the deriver is pure and reads the current `contextRef.current` on every submit, there is no state to go stale. The existing test `'ignores stale LeetCode submission results after SPA navigation'` already exercises the page-changed reset path; this plan does not introduce any new state along that path.

- [ ] **Step 1: Extend `renderReadySession` to accept a practice fixture**

Find the `renderReadySession` function in `src/features/overlay-session/hooks/use-leetcode-overlay-session.test.tsx`:

```ts
async function renderReadySession(options?: {
  autoDetectSolved?: boolean
  timing?: Partial<OverlayAppShellData['overlay']['timing']>
}): Promise<RenderedOverlaySession> {
  if (options?.autoDetectSolved || options?.timing) {
    const overlayDataOptions: Parameters<typeof createOverlayData>[0] = {}

    if (options.autoDetectSolved !== undefined) {
      overlayDataOptions.autoDetectSolved = options.autoDetectSolved
    }

    if (options.timing) {
      overlayDataOptions.timing = options.timing
    }

    vi.mocked(getOverlayAppShellDataViaRuntime).mockResolvedValue(
      createOverlayData(overlayDataOptions),
    )
  }

  const session = renderOverlaySession()

  emitPageReady()
  await waitFor(() =>
    expect(session.result.current).toMatchObject({
      status: 'ready',
      overlay: { activeProblemSlug: 'two-sum' },
    }),
  )

  return session
}
```

Replace it with:

```ts
async function renderReadySession(options?: {
  autoDetectSolved?: boolean
  timing?: Partial<OverlayAppShellData['overlay']['timing']>
  practice?: OverlayAppShellData['overlay']['practice']
}): Promise<RenderedOverlaySession> {
  if (options?.autoDetectSolved || options?.timing || options?.practice !== undefined) {
    const overlayDataOptions: Parameters<typeof createOverlayData>[0] = {}

    if (options.autoDetectSolved !== undefined) {
      overlayDataOptions.autoDetectSolved = options.autoDetectSolved
    }

    if (options.timing) {
      overlayDataOptions.timing = options.timing
    }

    if (options.practice !== undefined) {
      overlayDataOptions.practice = options.practice
    }

    vi.mocked(getOverlayAppShellDataViaRuntime).mockResolvedValue(
      createOverlayData(overlayDataOptions),
    )
  }

  const session = renderOverlaySession()

  emitPageReady()
  await waitFor(() =>
    expect(session.result.current).toMatchObject({
      status: 'ready',
      overlay: { activeProblemSlug: 'two-sum' },
    }),
  )

  return session
}
```

- [ ] **Step 2: Add the two integration tests**

Inside the existing `describe('useLeetCodeOverlaySession', ...)` block, immediately after the existing test `it('quick submits from collapsed using the assessment policy', ...)`, insert:

```ts
  it('fires the Easy gate on a fast recall solve beating the previous best', async () => {
    const startTime = Date.now()
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(startTime)
    const { result } = await renderReadySession({
      practice: createSavedPracticeDetails({
        latestAttempt: { elapsedSeconds: 1800 },
      }),
    })

    act(() => {
      result.current.actions.startTimer()
    })
    // Medium target = 35 * 60 = 2100s. 600s is 28% of target and beats prior best (1800s).
    nowSpy.mockReturnValue(startTime + 600 * 1000)

    await runOverlayAction(result.current.actions.prepareQuickSubmit)

    expect(latestSavedReviewRequest()).toMatchObject({
      rating: 'easy',
      elapsedSeconds: 600,
      isCorrect: true,
    })
  })

  it('does not fire the Easy gate on a first solve even with a fast time', async () => {
    const startTime = Date.now()
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(startTime)
    const { result } = await renderReadySession({
      // Default practice is null → first-solve. Easy gate cannot fire.
    })

    act(() => {
      result.current.actions.startTimer()
    })
    nowSpy.mockReturnValue(startTime + 600 * 1000)

    await runOverlayAction(result.current.actions.prepareQuickSubmit)

    expect(latestSavedReviewRequest()).toMatchObject({
      rating: 'good',
      elapsedSeconds: 600,
      isCorrect: true,
    })
  })
```

- [ ] **Step 3: Run the new tests by name**

Run:
```sh
npx vitest run src/features/overlay-session/hooks/use-leetcode-overlay-session.test.tsx -t "fires the Easy gate"
npx vitest run src/features/overlay-session/hooks/use-leetcode-overlay-session.test.tsx -t "does not fire the Easy gate on a first solve"
```
Expected: both PASS.

- [ ] **Step 4: Run the full overlay-session suite**

Run: `npx vitest run src/features/overlay-session`
Expected: PASS. No prior tests should regress (the `practice` option on `renderReadySession` defaults to undefined for existing callers).

- [ ] **Step 5: Commit**

```sh
git add src/features/overlay-session/hooks/use-leetcode-overlay-session.test.tsx
git commit -m "test(overlay-session): assert Easy gate fires only with recall practice context"
```

---

## Task 5: Whole-project validation

**Files:** none modified (unless Step 2 catches something)

- [ ] **Step 1: Run the full check**

Run: `npm run check`
Expected: PASS for all four phases (drizzle, typecheck, lint, vitest).

- [ ] **Step 2: Resolve any failures**

If any phase fails, read the output and fix the root cause. Common cases:
- A barrel re-export missing one of the new types → add it to `domain/index.ts` or feature `index.ts`.
- An ESLint import-order violation in `use-overlay-review-actions.ts` → reformat the import block per the existing convention.
- A test asserting on the exact `evaluateLeetCodeAssessment` input → update to allow `practiceContext`.

Re-run `npm run check` until it passes. If you made fixes, commit them with a focused message such as `fix(overlay-session): align barrel exports with new types`.

If `package-lock.json` shows as modified in `git status`, discard those auto-changes with `git checkout -- package-lock.json` (npm sometimes touches it during `wxt prepare`).

- [ ] **Step 3: Confirm clean state**

Run: `git status`
Expected: `nothing to commit, working tree clean`.

Run: `git log --oneline -8`
Expected, in order:
- `feat(overlay-session): derive transient assessment session context`
- `feat(overlay-session): re-export session-context contracts`
- `feat(overlay-session): thread practice context into the assessment policy`
- `test(overlay-session): assert Easy gate fires only with recall practice context`
- (optionally) a `fix:` commit from Step 2
- `docs: design overlay assessment session context (#2)`

Implementation complete.
