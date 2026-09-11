# Expanded Overlay Width Containment Design

## Context

The expanded LeetCode overlay has a fixed responsive width of at most 420px.
After a review is submitted, its footer renders the review actions and the
next-problem card in one single-column grid. A sufficiently long next-problem
title can currently make that footer wider than the overlay, causing both the
next card and the restart/update action row to extend past the visible surface.

The title already uses single-line truncation, but the footer's flex-item and
grid-track minimum sizing remain content-based. The title's intrinsic width can
therefore expand the footer before truncation takes effect.

## Product Decision

The expanded overlay will remain bounded by its existing responsive width.
Long next-problem titles and details will remain on one line and use ellipsis
truncation. Review controls, feedback, and the next card must stay entirely
inside the overlay at narrow and full widths.

## Implementation Boundary

The fix belongs to the expanded overlay footer owned by
`src/features/overlay-session`. Its sizing chain will opt into shrinking with a
zero minimum width and a single explicit `minmax(0, 1fr)` grid track. The next
card will keep its existing local text truncation behavior.

This targets the shared ancestor that sizes both affected footer children. It
does not change the global overlay surface, hide horizontal overflow, or alter
the collapsed and docked modes.

## Behavior And States

- Pre-submit submit/fail actions remain unchanged and contained.
- Post-submit restart/update actions remain a two-column row and contained.
- Feedback remains below the action row and wraps within the footer.
- Ready next-step titles and details truncate within the available space.
- Loading and error next-step messages remain contained and may wrap normally.
- The optional next-problem action remains visible and usable.

No data flow, review mutation, navigation, runtime messaging, persistence, or
error-handling behavior changes.

## Testing And Validation

Implementation will start with a focused failing component regression test that
renders a submitted overlay with a long next-problem title and verifies that the
footer exposes the required shrinkable sizing contract while preserving title
truncation and actions.

Required automated validation for an overlay UI change:

```sh
npm run test -- src/features/overlay-session/components/modes/expanded/expanded-overlay.test.tsx --run
npm run lint
npm run check
npm run build
```

A human engineer must then run the LeetCode overlay smoke flow with both a short
and a long next-problem title at the normal expanded width and a narrow browser
viewport. The proof should show the post-submit action row and next card fully
contained, with the long title truncated and its action still visible.

## Non-Goals

- No overlay width or height redesign.
- No title wrapping or typography change.
- No global overflow clipping.
- No changes to collapsed or docked overlay behavior.
- No review, next-step selection, or navigation behavior changes.
