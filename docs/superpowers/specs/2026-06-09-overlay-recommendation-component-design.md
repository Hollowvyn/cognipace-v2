# Overlay Recommendation Component — Design

**Issue:** [#8](https://github.com/Hollowvyn/cognipace-v2/issues/8) — Add assessment recommendation component to expanded overlay

**Depends on:** #7 (overlay recommendation hook) — merged via PR #74

**Unblocks:** #9 (AI notes guardrails), #10 (end-to-end test)

## Goal

Render the AI recommendation in the expanded overlay as a compact, presentational component placed between the assessment rail and the structured log fields. The component must not call runtime APIs, not write notes/logs, not save practice history, and must remain readable under a locked `Again` state.

This PR adds the component and wires it into the existing `ExpandedOverlay`. The hook and reducer plumbing it consumes already ship in #7.

## Architecture

```
ExpandedOverlay
    │
    ├── OverlayHeader
    ├── OverlayContextStrip / OverlaySubmissionSummary
    ├── OverlayTimerCard
    ├── OverlayAssessmentRail
    ├── OverlayAssessmentRecommendation  ← NEW
    ├── (optional) untimed-warning InlineStatus
    └── OverlayLogFields
```

The component is purely presentational: it receives a tagged view-model plus a single command callback. It never reads runtime, settings, dispatch, or the full overlay state. The container — `ExpandedOverlay` — sources the view-model from `LeetCodeOverlaySession.aiRecommendation` (added in #7) and threads the existing `actions.selectRating` as the command.

### Why a single command, not the recommendation state plus rating

Issue 7's reducer already encodes the policy that user-initiated rating changes flip `userTouchedRating: true`. We reuse `set-selected-rating` via `actions.selectRating(rating)` for the `Use recommendation` button. Clicking the button is an explicit user touch, so it correctly locks out future AI preselects on this session.

We do **not** introduce a new action or a separate "accept AI" path. The presentational component knows only that "the user clicked Use; pass the recommended rating to the rating command."

## Props

```ts
type OverlayAssessmentRecommendationProps = {
  state: AssessmentRecommendationState  // from useLeetCodeAssessmentRecommendation
  selectedRating: ReviewRating          // from overlay.selectedRating
  isRatingLocked: boolean               // Boolean(overlay.ratingLockReason)
  isMutating: boolean                   // reviewStatus === 'saving' | 'updating'
  onUseRecommendation: (rating: ReviewRating) => void
}
```

`state` is the discriminated union exported from `features/overlay-session` (#7).

The container computes `isRatingLocked` from `Boolean(overlay.ratingLockReason)` and `isMutating` from `overlay.reviewStatus`. These are the same predicates already used by `OverlayAssessmentRail` and `OverlayActions`, so the suppression behavior is consistent across the overlay.

## Visual states

Inline strip layout: label-headed, no surrounding box, accent-bordered reason line. Matches the visual language of `OverlayAssessmentRail` (uppercase mono label, accent-bordered helper text).

### `state.status === 'idle'`

Component returns `null`. The slot between rail and log fields collapses entirely. This covers:
- AI is disabled / unavailable (`context.aiAssessmentAvailable === false` upstream → hook stays `idle`)
- No terminal submission yet on this problem
- Navigation/restart cleared the state

### `state.status === 'pending'`

Single labeled row with a skeleton chip and skeleton text. Section wraps in `aria-live="polite" aria-busy="true"` so screen readers announce the eventual `ready` content without interrupting the existing assessment rail announcements.

### `state.status === 'ready'`

```
AI RECOMMENDATION                              ● Medium
[Hard]   Use recommendation
│ Solved within target time using a hash-map.
                                       Show details ›
```

- Label: uppercase mono `AI RECOMMENDATION` (matches `Assessment` label style on the rail).
- Confidence: small dot + uppercase label. Color of the dot follows the existing rating tokens (`high` → primary, `medium` → neutral foreground, `low` → muted).
- Rating chip: rendered with the existing `--cp-tone-review-{token}-bg/fg` tokens used by the rail. The chip is non-interactive `<span>` text — the only commit affordance is the button.
- `Use recommendation` button: shown only when ALL of:
  - `state.recommendation.recommendedRating !== selectedRating`
  - `!isRatingLocked`
  - `!isMutating`
- Reason line: `state.recommendation.primaryReason`, rendered with the same left-border accent style as the rail's helper text. The chip's rating token drives the accent color.
- `Show details ›` button: toggles a disclosure region rendering, in order, any non-empty fields among `evidence`, `complexity` (`O(time) · O(space) · confidence`), `improvementPoints`, `edgeCaseNotes`. Each empty array is omitted. The button uses `aria-expanded` + `aria-controls`. Closing restores focus to the toggle.

### `state.status === 'unavailable'`

Single muted row. No commit button.

```
AI RECOMMENDATION                              ● Unavailable
AI is not configured. Add a provider in settings to get recommendations.
```

The message uses `state.message` (which the runtime endpoint normalizes per #6).

### `state.status === 'error'`

Same shape as `unavailable`, with the error-tone token on the dot and label. Shows `state.message`. No retry button — the user re-submits to retry, per issue 7's stated non-goals.

### Locked-rating behavior

When `isRatingLocked` is true and the recommendation is ready, the card still renders the full ready state (chip, confidence, reason, optional details), but the `Use recommendation` button is omitted. This satisfies:

- Issue 8 acceptance: "Component works under locked `Again` state."
- Issue 7 acceptance: "AI recommendation can only affect saved history through existing `Update`."

The recommendation acts as an explanation surface; the lock holds.

## Accessibility

| Concern | Treatment |
|---|---|
| Region landmark | `<section aria-labelledby={headingId}>` wrapping a visually-styled `AI RECOMMENDATION` heading (same pattern as `OverlayAssessmentRail`). |
| Live region | `aria-live="polite"` and `aria-busy={state.status === 'pending'}` on the section, so screen readers announce pending → ready and error/unavailable surfaces non-interruptively. |
| Buttons | Semantic `<button type="button">` for `Use recommendation` and `Show details`. Both are real focusable controls. |
| Disclosure | `Show details` carries `aria-expanded` and `aria-controls={detailsId}`. The disclosure region uses `id={detailsId}`. |
| Rating chip | Non-focusable inline text (`<span>`). Clicking the chip does nothing; the button is the only commit affordance. |
| Disabled affordances | When `isMutating` or `isRatingLocked` suppress the `Use` button, the button is *removed from the tree*, not rendered as disabled. There is nothing meaningful for keyboard users to land on in those states. |
| Focus order | label → confidence → chip (non-focusable, skipped) → Use → Show details → (when expanded) details content. No focus traps. Toggling collapse restores focus to the toggle. |
| Error display | Surfaced as plain text in the labeled row. Non-blocking: focus stays where it was; nothing auto-grabs. |

## Files

### New

| Path | Purpose |
|---|---|
| `src/features/overlay-session/components/modes/expanded/overlay-assessment-recommendation.tsx` | The component. |
| `src/features/overlay-session/components/modes/expanded/overlay-assessment-recommendation.test.tsx` | 8 component tests. |

### Modified

| Path | Change |
|---|---|
| `src/features/overlay-session/components/modes/expanded/expanded-overlay.tsx` | Render `OverlayAssessmentRecommendation` between `OverlayAssessmentRail` and the untimed-warning. Add `aiRecommendation` to the `ExpandedOverlayViewModel`. Thread `actions.selectRating` as `onUseRecommendation`. |
| `src/features/overlay-session/components/modes/expanded/expanded-overlay.test.tsx` | Add `aiRecommendation` to the test view-model. |
| `src/features/overlay-session/components/overlay-shell.tsx` | Thread `aiRecommendation` from the session into the expanded view-model. |
| `src/features/overlay-session/components/overlay-shell.test.tsx` | Already updated in #7 to include `aiRecommendation`; no further change. |

No `index.ts` export: the component is a private piece of the expanded overlay, like the other `expanded/*.tsx` pieces. It is consumed only by `ExpandedOverlay`.

## Testing

Vitest + Testing Library, mirroring the style of the existing `overlay-shell.test.tsx` and `expanded-overlay.test.tsx`.

| # | Test |
|---|---|
| 1 | `state.status === 'idle'` renders nothing (component returns null). |
| 2 | `state.status === 'pending'` renders the labeled section with `aria-busy="true"` and a skeleton chip. |
| 3 | `state.status === 'ready'` renders the rating chip, confidence label, and primary reason. |
| 4 | `ready` with `recommendation.recommendedRating === selectedRating` → no `Use recommendation` button. |
| 5 | `ready` with `isRatingLocked === true` → no `Use recommendation` button; recommendation content is still readable. |
| 6 | Clicking `Show details` toggles disclosure: hidden content appears; `aria-expanded` flips from `false` to `true`. |
| 7 | Clicking `Use recommendation` calls `onUseRecommendation(state.recommendation.recommendedRating)` with the recommended rating. |
| 8 | `state.status === 'error'` renders the message in an error-toned row with no commit button. |

### Acceptance criteria coverage

| Criterion (from issue #8) | Test(s) |
|---|---|
| Component does not write notes/logs | Component's prop type is enforced; no save/practice imports — verified by code review of the import list. |
| Component works under locked `Again` state | Test 5. |
| Component remains compact and does not become a chat UI | Design: single-row label, one-line reason, single `Show details` disclosure. Reviewed during PR. |
| Existing expanded overlay action area remains unchanged | `OverlayActions` and `OverlayNextCard` are untouched. Verified during PR review. |
| Styling follows existing overlay tokens and density | Uses `--cp-tone-review-*` and the rail's label-and-accent pattern. Reviewed during PR. |
| Loading state renders | Test 2. |
| Ready state renders rating, confidence, and reason | Test 3. |
| Details expand/collapse | Test 6. |
| `Use recommendation` selects rating | Test 7. |
| Locked rating disables the use action | Test 5. |
| Error state is non-blocking and accessible | Test 8 + `aria-live="polite"`. |

## Non-goals

- **Manual "Ask AI" trigger.** No-submission path doesn't fire the hook; the component honors that. The `idle` state correctly hides the surface.
- **Retry on transient errors.** Out of scope per issue 7's non-goals.
- **Provider metadata display.** Provider/model/duration are exposed on `state.providerMetadata` but not rendered. Could be added behind a "debug" toggle in future work; not in scope here.
- **Notes / AI-authored text into structured log fields.** Ships in #9 (AI notes guardrails).
- **End-to-end overlay flow test.** Ships in #10.
