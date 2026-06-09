# Overlay Recommendation Component Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compact, presentational `OverlayAssessmentRecommendation` to the expanded overlay that renders the AI recommendation (from the `aiRecommendation` view-model added in #7) between the assessment rail and the structured log fields.

**Architecture:** Single presentational React component in `src/features/overlay-session/components/modes/expanded/`. Receives a tagged `AssessmentRecommendationState` view-model plus an `onUseRecommendation` command callback. Reuses the existing `Badge` (`review-*` tones) for the rating chip and mirrors the `OverlayAssessmentRail` label/accent visual language. Wired into `ExpandedOverlay` via the existing `commands`/`view` prop split.

**Tech Stack:** React 18, TypeScript (`exactOptionalPropertyTypes` strict), Vitest + Testing Library, Tailwind (with the project's `--cp-tone-review-*` design tokens), `lucide-react` for the chevron icon.

**Spec:** `docs/superpowers/specs/2026-06-09-overlay-recommendation-component-design.md`

**Branch:** `issue-8` (already created off latest `main`; the design doc commit `3ed7e9f` is its first commit).

---

## File map

**New**

| Path | Responsibility |
|---|---|
| `src/features/overlay-session/components/modes/expanded/overlay-assessment-recommendation.tsx` | The presentational component. |
| `src/features/overlay-session/components/modes/expanded/overlay-assessment-recommendation.test.tsx` | 8 component tests (Vitest + Testing Library). |

**Modified**

| Path | Change |
|---|---|
| `src/features/overlay-session/components/modes/expanded/expanded-overlay.tsx` | Add `aiRecommendation` to `ExpandedOverlayViewModel`; render the new component between `OverlayAssessmentRail` and the untimed-warning; thread `actions.selectRating` as the `Use recommendation` command. |
| `src/features/overlay-session/components/modes/expanded/expanded-overlay.test.tsx` | Add `aiRecommendation: { status: 'idle' }` to the default `view` fixture. |
| `src/features/overlay-session/components/overlay-shell.tsx` | Pass `aiRecommendation` (already on `LeetCodeOverlaySession`) into the expanded `view`. |

`overlay-shell.test.tsx` already includes `aiRecommendation` in the fixture (added in #7), so no change there.

---

## Task 1: Scaffold the component file with the `idle` case

**Files:**
- Create: `src/features/overlay-session/components/modes/expanded/overlay-assessment-recommendation.tsx`
- Create: `src/features/overlay-session/components/modes/expanded/overlay-assessment-recommendation.test.tsx`

The component returns `null` for the `idle` state. This is the baseline contract: when AI is unavailable or no submission has been made, the slot in the overlay collapses entirely.

- [ ] **Step 1: Write the failing test**

Create `src/features/overlay-session/components/modes/expanded/overlay-assessment-recommendation.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { AssessmentRecommendation } from '@/features/leetcode-review-assistant'
import type { GenAiProviderMetadata } from '@/features/genai'
import type { ReviewRating } from '@/lib/fsrs'

import type { AssessmentRecommendationState } from '../../../domain'

import { OverlayAssessmentRecommendation } from './overlay-assessment-recommendation'

type Props = Parameters<typeof OverlayAssessmentRecommendation>[0]

function renderRecommendation(overrides: Partial<Props> = {}) {
  const props: Props = {
    state: { status: 'idle' },
    selectedRating: 'good',
    isRatingLocked: false,
    isMutating: false,
    onUseRecommendation: vi.fn(),
    ...overrides,
  }
  return {
    ...render(<OverlayAssessmentRecommendation {...props} />),
    props,
  }
}

function makeRecommendation(
  overrides: Partial<AssessmentRecommendation> = {},
): AssessmentRecommendation {
  return {
    recommendedRating: 'hard',
    confidence: 'medium',
    summary: 'Solved within target.',
    primaryReason: 'Solved within target time using a hash-map.',
    evidence: ['Status: accepted', 'Elapsed 600s vs 2100s target'],
    complexity: { time: 'O(n)', space: 'O(n)', confidence: 'medium' },
    improvementPoints: ['Consider edge case for empty array.'],
    edgeCaseNotes: ['Negative numbers handled correctly.'],
    shouldUpdateRating: true,
    promptVersion: 'leetcode-assessment-v1',
    ...overrides,
  }
}

function makeProviderMetadata(): GenAiProviderMetadata {
  return { provider: 'openai', model: 'gpt-test', durationMs: 1234 }
}

describe('OverlayAssessmentRecommendation', () => {
  it('renders nothing when status is idle', () => {
    const { container } = renderRecommendation()
    expect(container.firstChild).toBeNull()
  })
})
```

Also add the type re-export the test imports — see step 2 below.

- [ ] **Step 2: Re-export `AssessmentRecommendationState` from the domain barrel so it's reachable without reaching into hooks/**

Modify `src/features/overlay-session/index.ts` to also re-export `AssessmentRecommendationState` from the hooks file (it's already exported there from #7).

Find the existing block:

```ts
export {
  useLeetCodeAssessmentRecommendation,
  type AssessmentRecommendationState,
  type UseLeetCodeAssessmentRecommendationOptions,
  type UseLeetCodeAssessmentRecommendationResult,
} from './hooks/use-leetcode-assessment-recommendation'
```

Confirm it already exports `type AssessmentRecommendationState`. If yes, the test can import from `@/features/overlay-session` instead of `../../../domain`. Update the test import:

```tsx
import type { AssessmentRecommendationState } from '../../..'
```

Replace the earlier `import type { AssessmentRecommendationState } from '../../../domain'` line in the test with the line above. The component will import the same type the same way.

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd "/Users/ernest-opara/Development/AI Bombing/cognipace/cognipace-v2" && npx vitest run src/features/overlay-session/components/modes/expanded/overlay-assessment-recommendation.test.tsx`

Expected: FAIL — `Cannot find module './overlay-assessment-recommendation'` or similar.

- [ ] **Step 4: Write the minimal component**

Create `src/features/overlay-session/components/modes/expanded/overlay-assessment-recommendation.tsx`:

```tsx
import type { ReviewRating } from '@/lib/fsrs'

import type { AssessmentRecommendationState } from '../../..'

export type OverlayAssessmentRecommendationProps = {
  state: AssessmentRecommendationState
  selectedRating: ReviewRating
  isRatingLocked: boolean
  isMutating: boolean
  onUseRecommendation: (rating: ReviewRating) => void
}

export function OverlayAssessmentRecommendation({
  state,
}: OverlayAssessmentRecommendationProps) {
  if (state.status === 'idle') {
    return null
  }
  return null
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/features/overlay-session/components/modes/expanded/overlay-assessment-recommendation.test.tsx`

Expected: PASS (1/1).

- [ ] **Step 6: Commit**

```bash
git add src/features/overlay-session/components/modes/expanded/overlay-assessment-recommendation.tsx src/features/overlay-session/components/modes/expanded/overlay-assessment-recommendation.test.tsx
git commit -m "feat: scaffold OverlayAssessmentRecommendation with idle case (#8)"
```

---

## Task 2: Pending state

**Files:**
- Modify: `src/features/overlay-session/components/modes/expanded/overlay-assessment-recommendation.tsx`
- Modify: `src/features/overlay-session/components/modes/expanded/overlay-assessment-recommendation.test.tsx`

Render the labeled section in a loading shape: uppercase `AI RECOMMENDATION` label, a skeleton chip, and a skeleton text line. The whole section wraps in `aria-live="polite"` and `aria-busy="true"`.

- [ ] **Step 1: Add the failing test**

Append inside the `describe('OverlayAssessmentRecommendation', ...)` block in `overlay-assessment-recommendation.test.tsx`:

```tsx
  it('renders a busy labeled region in the pending state', () => {
    renderRecommendation({ state: { status: 'pending', fingerprint: 'fp-1' } })

    const region = screen.getByRole('region', { name: 'AI recommendation' })
    expect(region).toHaveAttribute('aria-busy', 'true')
    expect(region).toHaveAttribute('aria-live', 'polite')
  })
```

Also add `screen` to the testing-library import at the top of the file:

```tsx
import { render, screen } from '@testing-library/react'
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/overlay-session/components/modes/expanded/overlay-assessment-recommendation.test.tsx`

Expected: pending test FAILS (`Unable to find role="region" with name 'AI recommendation'`).

- [ ] **Step 3: Implement the labeled section + pending visuals**

Replace the component file content with:

```tsx
import { useId } from 'react'

import { cn } from '@/utils/cn'
import type { ReviewRating } from '@/lib/fsrs'

import type { AssessmentRecommendationState } from '../../..'

export type OverlayAssessmentRecommendationProps = {
  state: AssessmentRecommendationState
  selectedRating: ReviewRating
  isRatingLocked: boolean
  isMutating: boolean
  onUseRecommendation: (rating: ReviewRating) => void
}

const LABEL_ID_PREFIX = 'overlay-ai-recommendation'

export function OverlayAssessmentRecommendation({
  state,
}: OverlayAssessmentRecommendationProps) {
  const headingId = `${LABEL_ID_PREFIX}-${useId()}`

  if (state.status === 'idle') {
    return null
  }

  const isPending = state.status === 'pending'

  return (
    <section
      aria-busy={isPending || undefined}
      aria-labelledby={headingId}
      aria-live="polite"
      className="border-y border-border py-3"
      role="region"
    >
      <div
        className={cn(
          'mb-2 font-mono text-[0.72rem] font-semibold uppercase tracking-[0.14em]',
          'text-muted-foreground',
        )}
        id={headingId}
      >
        AI Recommendation
      </div>
      {isPending ? (
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="inline-block h-5 w-12 animate-pulse rounded-full bg-muted"
          />
          <span
            aria-hidden="true"
            className="inline-block h-3 flex-1 max-w-[14rem] animate-pulse rounded bg-muted"
          />
          <span className="sr-only">Loading recommendation</span>
        </div>
      ) : null}
    </section>
  )
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/features/overlay-session/components/modes/expanded/overlay-assessment-recommendation.test.tsx`

Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add src/features/overlay-session/components/modes/expanded/overlay-assessment-recommendation.tsx src/features/overlay-session/components/modes/expanded/overlay-assessment-recommendation.test.tsx
git commit -m "feat: add pending state to OverlayAssessmentRecommendation (#8)"
```

---

## Task 3: Ready state — chip, confidence, reason

**Files:**
- Modify: `src/features/overlay-session/components/modes/expanded/overlay-assessment-recommendation.tsx`
- Modify: `src/features/overlay-session/components/modes/expanded/overlay-assessment-recommendation.test.tsx`

Render the recommended rating as a `Badge` with the matching `review-{rating}` tone; render the confidence label with a small color dot; render the primary reason in an accent-bordered quote (matching the rail's helper text style).

- [ ] **Step 1: Add the failing test**

Append inside the describe block:

```tsx
  it('renders rating, confidence, and primary reason in the ready state', () => {
    renderRecommendation({
      state: {
        status: 'ready',
        fingerprint: 'fp-1',
        recommendation: makeRecommendation({
          recommendedRating: 'hard',
          confidence: 'medium',
          primaryReason: 'Solved within target time using a hash-map.',
        }),
        providerMetadata: makeProviderMetadata(),
      },
    })

    expect(screen.getByText('Hard')).toBeInTheDocument()
    expect(screen.getByText(/Medium/)).toBeInTheDocument()
    expect(
      screen.getByText('Solved within target time using a hash-map.'),
    ).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/overlay-session/components/modes/expanded/overlay-assessment-recommendation.test.tsx`

Expected: ready test FAILS — text not found.

- [ ] **Step 3: Implement the ready visuals**

Add imports at the top of the component file:

```tsx
import { Badge } from '@/components/ui/badge'
import type { AssessmentRecommendationConfidence } from '@/features/leetcode-review-assistant'
```

Add helper functions at the bottom of the file (above the closing of the existing `export function` if needed; place them at module scope after the component definition):

```tsx
const RATING_LABEL_BY_RATING: Record<ReviewRating, string> = {
  again: 'Again',
  hard: 'Hard',
  good: 'Good',
  easy: 'Easy',
}

const CONFIDENCE_LABEL: Record<AssessmentRecommendationConfidence, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

const CONFIDENCE_DOT_CLASS: Record<AssessmentRecommendationConfidence, string> = {
  high: 'bg-[color:var(--cp-tone-success-fg)]',
  medium: 'bg-foreground',
  low: 'bg-muted-foreground',
}
```

Then replace the body of the `section` to handle the `ready` state. Replace:

```tsx
      {isPending ? (
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="inline-block h-5 w-12 animate-pulse rounded-full bg-muted"
          />
          <span
            aria-hidden="true"
            className="inline-block h-3 flex-1 max-w-[14rem] animate-pulse rounded bg-muted"
          />
          <span className="sr-only">Loading recommendation</span>
        </div>
      ) : null}
```

with:

```tsx
      {isPending ? (
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="inline-block h-5 w-12 animate-pulse rounded-full bg-muted"
          />
          <span
            aria-hidden="true"
            className="inline-block h-3 flex-1 max-w-[14rem] animate-pulse rounded bg-muted"
          />
          <span className="sr-only">Loading recommendation</span>
        </div>
      ) : null}

      {state.status === 'ready' ? (
        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-2">
            <Badge tone={`review-${state.recommendation.recommendedRating}`}>
              {RATING_LABEL_BY_RATING[state.recommendation.recommendedRating]}
            </Badge>
            <span className="inline-flex items-center gap-1.5 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <span
                aria-hidden="true"
                className={cn(
                  'inline-block h-1.5 w-1.5 rounded-full',
                  CONFIDENCE_DOT_CLASS[state.recommendation.confidence],
                )}
              />
              {CONFIDENCE_LABEL[state.recommendation.confidence]} confidence
            </span>
          </div>
          <p
            className={cn(
              'border-l-2 pl-2 text-[0.78rem] leading-snug text-foreground',
              'border-[color:var(--overlay-rating-fg)]',
            )}
            style={ratingAccentStyle(state.recommendation.recommendedRating)}
          >
            {state.recommendation.primaryReason}
          </p>
        </div>
      ) : null}
```

Add the helper function at module scope:

```tsx
function ratingAccentStyle(rating: ReviewRating): React.CSSProperties {
  return {
    '--overlay-rating-fg': `var(--cp-tone-review-${rating}-fg)`,
  } as React.CSSProperties
}
```

Add `import type * as React from 'react'` at the top alongside the existing react imports, or change the existing `import { useId } from 'react'` to also import `type CSSProperties`:

```tsx
import { useId, type CSSProperties } from 'react'
```

…and update the helper return type:

```tsx
function ratingAccentStyle(rating: ReviewRating): CSSProperties {
  return {
    '--overlay-rating-fg': `var(--cp-tone-review-${rating}-fg)`,
  } as CSSProperties
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/overlay-session/components/modes/expanded/overlay-assessment-recommendation.test.tsx`

Expected: PASS (3/3).

- [ ] **Step 5: Commit**

```bash
git add src/features/overlay-session/components/modes/expanded/overlay-assessment-recommendation.tsx src/features/overlay-session/components/modes/expanded/overlay-assessment-recommendation.test.tsx
git commit -m "feat: render rating, confidence, and reason in OverlayAssessmentRecommendation (#8)"
```

---

## Task 4: `Use recommendation` button

**Files:**
- Modify: `src/features/overlay-session/components/modes/expanded/overlay-assessment-recommendation.tsx`
- Modify: `src/features/overlay-session/components/modes/expanded/overlay-assessment-recommendation.test.tsx`

The button shows only when the recommended rating differs from `selectedRating`, the rating isn't locked, and we aren't saving/updating. Clicking it calls `onUseRecommendation(recommendation.recommendedRating)`. The `onUseRecommendation` callback is wired by the container to `actions.selectRating`, which uses the reducer's `set-selected-rating` action — that action already flips `userTouchedRating: true`, locking out future AI preselects.

- [ ] **Step 1: Add the three failing tests**

Append inside the describe block:

```tsx
  it('shows Use recommendation when the AI rating differs from the selected rating', async () => {
    const onUseRecommendation = vi.fn()
    renderRecommendation({
      state: {
        status: 'ready',
        fingerprint: 'fp-1',
        recommendation: makeRecommendation({ recommendedRating: 'hard' }),
        providerMetadata: makeProviderMetadata(),
      },
      selectedRating: 'good',
      onUseRecommendation,
    })

    const button = screen.getByRole('button', { name: 'Use recommendation' })
    await userEvent.click(button)

    expect(onUseRecommendation).toHaveBeenCalledWith('hard')
  })

  it('hides Use recommendation when the AI rating equals the selected rating', () => {
    renderRecommendation({
      state: {
        status: 'ready',
        fingerprint: 'fp-1',
        recommendation: makeRecommendation({ recommendedRating: 'hard' }),
        providerMetadata: makeProviderMetadata(),
      },
      selectedRating: 'hard',
    })

    expect(
      screen.queryByRole('button', { name: 'Use recommendation' }),
    ).not.toBeInTheDocument()
  })

  it('hides Use recommendation when the rating is locked', () => {
    renderRecommendation({
      state: {
        status: 'ready',
        fingerprint: 'fp-1',
        recommendation: makeRecommendation({ recommendedRating: 'good' }),
        providerMetadata: makeProviderMetadata(),
      },
      selectedRating: 'again',
      isRatingLocked: true,
    })

    expect(
      screen.queryByRole('button', { name: 'Use recommendation' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(/Solved within target time using a hash-map\./),
    ).toBeInTheDocument()
  })
```

Add `userEvent` to the imports at the top of the test file:

```tsx
import userEvent from '@testing-library/user-event'
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/features/overlay-session/components/modes/expanded/overlay-assessment-recommendation.test.tsx`

Expected: the three new tests FAIL — `Use recommendation` button cannot be found in either direction (the click test fails because the button isn't in the DOM; the two `not.toBeInTheDocument` tests pass trivially today — confirm they pass for the wrong reason and treat the click failure as the failing-test signal).

- [ ] **Step 3: Add the Use recommendation button to the ready branch**

In the ready branch, change the first `<div>` (the chip + confidence row) to also conditionally render a button to the right of the confidence label. Replace:

```tsx
          <div className="flex items-center justify-between gap-2">
            <Badge tone={`review-${state.recommendation.recommendedRating}`}>
              {RATING_LABEL_BY_RATING[state.recommendation.recommendedRating]}
            </Badge>
            <span className="inline-flex items-center gap-1.5 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <span
                aria-hidden="true"
                className={cn(
                  'inline-block h-1.5 w-1.5 rounded-full',
                  CONFIDENCE_DOT_CLASS[state.recommendation.confidence],
                )}
              />
              {CONFIDENCE_LABEL[state.recommendation.confidence]} confidence
            </span>
          </div>
```

with:

```tsx
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge tone={`review-${state.recommendation.recommendedRating}`}>
                {RATING_LABEL_BY_RATING[state.recommendation.recommendedRating]}
              </Badge>
              {showUseButton ? (
                <button
                  className={cn(
                    'rounded-md border border-primary px-2 py-1 text-[0.72rem] font-semibold text-primary',
                    'transition-colors hover:bg-primary/10',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  )}
                  onClick={() =>
                    onUseRecommendation(state.recommendation.recommendedRating)
                  }
                  type="button"
                >
                  Use recommendation
                </button>
              ) : null}
            </div>
            <span className="inline-flex items-center gap-1.5 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <span
                aria-hidden="true"
                className={cn(
                  'inline-block h-1.5 w-1.5 rounded-full',
                  CONFIDENCE_DOT_CLASS[state.recommendation.confidence],
                )}
              />
              {CONFIDENCE_LABEL[state.recommendation.confidence]} confidence
            </span>
          </div>
```

Just above the `return` statement in the component, compute the predicate. After the early-return for `idle`, add:

```tsx
  const isReady = state.status === 'ready'
  const showUseButton =
    isReady &&
    !isRatingLocked &&
    !isMutating &&
    state.recommendation.recommendedRating !== selectedRating
```

Update the destructured props in the component signature to actually use these inputs:

```tsx
export function OverlayAssessmentRecommendation({
  state,
  selectedRating,
  isRatingLocked,
  isMutating,
  onUseRecommendation,
}: OverlayAssessmentRecommendationProps) {
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/features/overlay-session/components/modes/expanded/overlay-assessment-recommendation.test.tsx`

Expected: PASS (6/6).

- [ ] **Step 5: Commit**

```bash
git add src/features/overlay-session/components/modes/expanded/overlay-assessment-recommendation.tsx src/features/overlay-session/components/modes/expanded/overlay-assessment-recommendation.test.tsx
git commit -m "feat: add Use recommendation button with conditional visibility (#8)"
```

---

## Task 5: `Show details` disclosure

**Files:**
- Modify: `src/features/overlay-session/components/modes/expanded/overlay-assessment-recommendation.tsx`
- Modify: `src/features/overlay-session/components/modes/expanded/overlay-assessment-recommendation.test.tsx`

A single `Show details` toggle reveals a region containing the non-empty fields among `evidence`, `complexity`, `improvementPoints`, and `edgeCaseNotes`. The toggle uses `aria-expanded` and `aria-controls`; closing restores focus to the toggle (browser default for a `<button>` that doesn't lose focus).

- [ ] **Step 1: Add the failing test**

Append inside the describe block:

```tsx
  it('expands and collapses the details disclosure', async () => {
    const user = userEvent.setup()
    renderRecommendation({
      state: {
        status: 'ready',
        fingerprint: 'fp-1',
        recommendation: makeRecommendation({
          evidence: ['Status: accepted', 'Elapsed 600s vs 2100s target'],
          improvementPoints: ['Consider edge case for empty array.'],
        }),
        providerMetadata: makeProviderMetadata(),
      },
    })

    const toggle = screen.getByRole('button', { name: /Show details/i })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Elapsed 600s vs 2100s target')).toBeNull()

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(
      screen.getByText('Elapsed 600s vs 2100s target'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Consider edge case for empty array.'),
    ).toBeInTheDocument()

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Elapsed 600s vs 2100s target')).toBeNull()
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/overlay-session/components/modes/expanded/overlay-assessment-recommendation.test.tsx`

Expected: the disclosure test FAILS — no `Show details` button found.

- [ ] **Step 3: Implement the disclosure**

Add `useState` and `ChevronDown` to the imports:

```tsx
import { useId, useState, type CSSProperties } from 'react'
import { ChevronDown } from 'lucide-react'
```

In the component, after the existing predicate computations, add:

```tsx
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const detailsId = `${LABEL_ID_PREFIX}-details-${useId()}`
```

In the `ready` branch JSX, after the closing `</p>` of the primary-reason paragraph, append:

```tsx
          <div className="mt-1 flex justify-end">
            <button
              aria-controls={detailsId}
              aria-expanded={isDetailsOpen}
              className={cn(
                'inline-flex items-center gap-1 rounded text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground',
                'hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
              onClick={() => setIsDetailsOpen((open) => !open)}
              type="button"
            >
              {isDetailsOpen ? 'Hide details' : 'Show details'}
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  'h-3 w-3 transition-transform',
                  isDetailsOpen ? 'rotate-180' : '',
                )}
              />
            </button>
          </div>
          {isDetailsOpen ? (
            <div className="mt-2 grid gap-3 text-[0.78rem] leading-snug" id={detailsId}>
              {state.recommendation.evidence.length > 0 ? (
                <DetailList
                  heading="Evidence"
                  items={state.recommendation.evidence}
                />
              ) : null}
              {state.recommendation.complexity ? (
                <div>
                  <DetailHeading>Complexity</DetailHeading>
                  <p className="text-foreground">
                    {state.recommendation.complexity.time} ·{' '}
                    {state.recommendation.complexity.space} ·{' '}
                    {CONFIDENCE_LABEL[state.recommendation.complexity.confidence]} confidence
                  </p>
                </div>
              ) : null}
              {state.recommendation.improvementPoints.length > 0 ? (
                <DetailList
                  heading="Improvement points"
                  items={state.recommendation.improvementPoints}
                />
              ) : null}
              {state.recommendation.edgeCaseNotes.length > 0 ? (
                <DetailList
                  heading="Edge case notes"
                  items={state.recommendation.edgeCaseNotes}
                />
              ) : null}
            </div>
          ) : null}
```

Add the two small inner components at the bottom of the file (after the existing helpers):

```tsx
function DetailHeading({ children }: { children: string }) {
  return (
    <div className="mb-1 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
      {children}
    </div>
  )
}

function DetailList({
  heading,
  items,
}: {
  heading: string
  items: readonly string[]
}) {
  return (
    <div>
      <DetailHeading>{heading}</DetailHeading>
      <ul className="grid gap-1 text-foreground">
        {items.map((item, index) => (
          <li className="list-inside list-disc" key={index}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 4: Run the tests to verify all pass**

Run: `npx vitest run src/features/overlay-session/components/modes/expanded/overlay-assessment-recommendation.test.tsx`

Expected: PASS (7/7).

- [ ] **Step 5: Commit**

```bash
git add src/features/overlay-session/components/modes/expanded/overlay-assessment-recommendation.tsx src/features/overlay-session/components/modes/expanded/overlay-assessment-recommendation.test.tsx
git commit -m "feat: add Show details disclosure to OverlayAssessmentRecommendation (#8)"
```

---

## Task 6: Error and unavailable states

**Files:**
- Modify: `src/features/overlay-session/components/modes/expanded/overlay-assessment-recommendation.tsx`
- Modify: `src/features/overlay-session/components/modes/expanded/overlay-assessment-recommendation.test.tsx`

Both render the labeled section with a small status dot and label in the top-right, and the `message` text below. No chip, no `Use recommendation`, no `Show details`. The error variant uses the danger-tone foreground for the dot/label.

- [ ] **Step 1: Add the failing tests**

Append inside the describe block:

```tsx
  it('renders an error message in the error state without a commit button', () => {
    renderRecommendation({
      state: {
        status: 'error',
        fingerprint: 'fp-1',
        code: 'rate-limit',
        message: 'AI is rate-limited.',
      },
    })

    expect(screen.getByText('AI is rate-limited.')).toBeInTheDocument()
    expect(screen.getByText(/Error/i)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Use recommendation' }),
    ).not.toBeInTheDocument()
  })

  it('renders the unavailable message without a commit button', () => {
    renderRecommendation({
      state: {
        status: 'unavailable',
        fingerprint: 'fp-1',
        message: 'AI is not configured.',
      },
    })

    expect(screen.getByText('AI is not configured.')).toBeInTheDocument()
    expect(screen.getByText(/Unavailable/i)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Use recommendation' }),
    ).not.toBeInTheDocument()
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/features/overlay-session/components/modes/expanded/overlay-assessment-recommendation.test.tsx`

Expected: the two new tests FAIL — message text not found.

- [ ] **Step 3: Implement the error / unavailable branches**

In the component, after the `ready` branch JSX block, add:

```tsx
      {state.status === 'unavailable' || state.status === 'error' ? (
        <div className="grid gap-1">
          <div className="flex justify-end">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.12em]',
                state.status === 'error'
                  ? 'text-[color:var(--cp-tone-danger-fg)]'
                  : 'text-muted-foreground',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'inline-block h-1.5 w-1.5 rounded-full',
                  state.status === 'error'
                    ? 'bg-[color:var(--cp-tone-danger-fg)]'
                    : 'bg-muted-foreground',
                )}
              />
              {state.status === 'error' ? 'Error' : 'Unavailable'}
            </span>
          </div>
          <p className="text-[0.78rem] leading-snug text-muted-foreground">
            {state.message}
          </p>
        </div>
      ) : null}
```

Place this immediately after the closing `) : null}` of the ready block, still inside the labeled `<section>`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/features/overlay-session/components/modes/expanded/overlay-assessment-recommendation.test.tsx`

Expected: PASS (9/9).

- [ ] **Step 5: Commit**

```bash
git add src/features/overlay-session/components/modes/expanded/overlay-assessment-recommendation.tsx src/features/overlay-session/components/modes/expanded/overlay-assessment-recommendation.test.tsx
git commit -m "feat: render error and unavailable states in OverlayAssessmentRecommendation (#8)"
```

---

## Task 7: Wire into `ExpandedOverlay`

**Files:**
- Modify: `src/features/overlay-session/components/modes/expanded/expanded-overlay.tsx`
- Modify: `src/features/overlay-session/components/modes/expanded/expanded-overlay.test.tsx`
- Modify: `src/features/overlay-session/components/overlay-shell.tsx`

Thread `aiRecommendation` from the session into the expanded view-model; render the new component between the assessment rail and the optional untimed-warning; pass `actions.selectRating` as the `Use recommendation` command.

- [ ] **Step 1: Update `expanded-overlay.tsx`**

Add the imports at the top of `src/features/overlay-session/components/modes/expanded/expanded-overlay.tsx`:

```tsx
import type { AssessmentRecommendationState } from '../../..'

import { OverlayAssessmentRecommendation } from './overlay-assessment-recommendation'
```

Extend the `ExpandedOverlayViewModel` type:

```tsx
type ExpandedOverlayViewModel = {
  aiRecommendation: AssessmentRecommendationState
  context: OverlayAppShellData['overlay'] | null
  draft: {
    clearField: (field: OverlayDraftField) => void
    hasUnpersistedChanges: boolean
    setField: (field: OverlayDraftField, value: string) => void
  }
  elapsedSeconds: number
  isOverTarget: boolean
  overlay: OverlaySessionState
  problemTitle: string
  syncFeedback: string | null
  syncStatus: string
  targetSeconds: number
  timerStatus: OverlayTimerStatus
}
```

In the destructure, add `aiRecommendation`:

```tsx
  const {
    aiRecommendation,
    context,
    draft,
    elapsedSeconds,
    isOverTarget,
    overlay,
    problemTitle,
    syncFeedback,
    syncStatus,
    targetSeconds,
    timerStatus,
  } = view
```

Insert the new component into the grid between `OverlayAssessmentRail` and the untimed-warning. Find this block:

```tsx
            <OverlayAssessmentRail
              isDisabled={isMutating}
              lockReason={overlay.ratingLockReason}
              onSelectRating={onSelectRating}
              selectedRating={overlay.selectedRating}
            />

            {showUntimedWarning ? (
```

…and change it to:

```tsx
            <OverlayAssessmentRail
              isDisabled={isMutating}
              lockReason={overlay.ratingLockReason}
              onSelectRating={onSelectRating}
              selectedRating={overlay.selectedRating}
            />

            <OverlayAssessmentRecommendation
              isMutating={isMutating}
              isRatingLocked={Boolean(overlay.ratingLockReason)}
              onUseRecommendation={onSelectRating}
              selectedRating={overlay.selectedRating}
              state={aiRecommendation}
            />

            {showUntimedWarning ? (
```

- [ ] **Step 2: Update `expanded-overlay.test.tsx` to add the default `aiRecommendation` fixture**

Find the `view:` block inside `createProps` and add `aiRecommendation` at the top of the object:

```tsx
    view: {
      aiRecommendation: { status: 'idle' },
      context: createOverlayContext(),
```

- [ ] **Step 3: Update `overlay-shell.tsx`**

Find where the `<ExpandedOverlay>` is rendered and add `aiRecommendation` to the `view` prop. In the destructure at the top of the `OverlayShell` function, add `aiRecommendation`:

```tsx
export function OverlayShell({
  actions,
  aiRecommendation,
  context,
  draft,
  feedback,
  location,
  metadata,
  overlay,
  status,
  timer,
}: OverlayShellProps) {
```

And in the `<ExpandedOverlay>` `view` prop, add the field. Find:

```tsx
        view={{
          context,
```

…and change to:

```tsx
        view={{
          aiRecommendation,
          context,
```

- [ ] **Step 4: Run the affected test files**

Run: `npx vitest run src/features/overlay-session/components/modes/expanded/expanded-overlay.test.tsx src/features/overlay-session/components/modes/expanded/overlay-assessment-recommendation.test.tsx src/features/overlay-session/components/overlay-shell.test.tsx`

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/overlay-session/components/modes/expanded/expanded-overlay.tsx src/features/overlay-session/components/modes/expanded/expanded-overlay.test.tsx src/features/overlay-session/components/overlay-shell.tsx
git commit -m "feat: wire OverlayAssessmentRecommendation into the expanded overlay (#8)"
```

---

## Task 8: Final verification

**Files:** none modified.

- [ ] **Step 1: Run the full check (db, typecheck, lint, tests)**

Run: `npm run check`

Expected: all stages PASS. If lint flags any issues in the new component (most likely `react-hooks/exhaustive-deps` on the disclosure handler or a class-name nit), fix them and re-run.

- [ ] **Step 2: Push the branch and open the PR**

```bash
git push -u origin issue-8
```

Then open a PR using the existing repo PR template (the same template enforced on PR #74 — `## Details`, `## Issue`, `## Testing`, `## Screenshots`). Use this body:

```
## Details

Add `OverlayAssessmentRecommendation`, a presentational component that renders the AI recommendation between the assessment rail and the structured log fields, consuming the `aiRecommendation` view-model added in #7.

- Component is purely presentational: receives the tagged `AssessmentRecommendationState`, the current `selectedRating`, `isRatingLocked`, `isMutating`, and a single `onUseRecommendation` command. It never imports save/practice, never calls runtime, never writes notes/logs.
- `Use recommendation` button is shown only when the AI rating differs from `selectedRating`, no lock is in effect, and no mutation is in flight. Clicking it goes through `actions.selectRating`, which uses the reducer's `set-selected-rating` action — that action already flips `userTouchedRating: true`, so an explicit click correctly counts as a user touch (see #7).
- All five `AssessmentRecommendationState` cases handled: `idle` (returns null), `pending` (skeleton + `aria-busy`), `ready` (chip + confidence + reason + optional `Use recommendation` + `Show details` disclosure), `unavailable` (muted row), `error` (danger-tone row). All non-idle states render in a `<section aria-live="polite">` labeled `AI Recommendation`.
- Disclosure uses `aria-expanded` and `aria-controls`; closing restores focus to the toggle.

## Issue

Closes #8

## Testing

- [x] `npm run check` passed
  - db check
  - typecheck
  - lint
  - tests (existing + 9 new component tests)
- [x] `npm run build` passed, or N/A: Not run locally; build is exercised by CI on every PR.
- [x] `npm run zip` passed, or N/A: N/A — zip only repackages build output; no packaging-relevant change.
- [x] Added/updated needed tests: UI/component (9 new tests covering idle, pending, ready content, hides `Use` when equal/locked, click invokes command, disclosure toggle, error + unavailable rows)
- [x] Manual smoke tested: N/A — component is reached through the existing expanded overlay path covered by `expanded-overlay.test.tsx`; behavior is fully covered by component tests.
- [x] Skipped validation: None

## Screenshots

N/A — the visual change is gated on `aiAssessmentAvailable === true` and a successful runtime recommendation. Coverage is via tests; component tests render the ready state directly.
```

---

## Self-review

**1. Spec coverage:**

| Spec requirement | Task |
|---|---|
| Component returns null when `idle` | Task 1 |
| `pending` renders `aria-busy="true"` labeled region | Task 2 |
| `ready` renders rating chip + confidence + reason | Task 3 |
| `Use recommendation` button shown only when conditions met; click goes through `selectRating` | Task 4 |
| `Show details` disclosure with `aria-expanded` + `aria-controls` | Task 5 |
| `error` and `unavailable` render non-blocking labeled rows | Task 6 |
| Inserted between `OverlayAssessmentRail` and untimed-warning | Task 7 |
| `aiRecommendation` threaded through `OverlayShell` → `ExpandedOverlay` | Task 7 |
| `npm run check` passes end-to-end | Task 8 |

**2. Placeholder scan:** None — every step contains either a code block, an exact command, or a concrete file edit.

**3. Type consistency:** `AssessmentRecommendationState`, `OverlayAssessmentRecommendationProps`, `ReviewRating`, and `AssessmentRecommendationConfidence` are spelled the same across all tasks. The `onUseRecommendation` callback signature `(rating: ReviewRating) => void` matches what `actions.selectRating` already exposes.

**4. Spec gap:** The locked-rating "card still readable" behavior is implicitly covered by Task 4's third test (it asserts the reason paragraph stays visible) and by the `Show details` disclosure remaining clickable in the ready branch regardless of `isRatingLocked`.
