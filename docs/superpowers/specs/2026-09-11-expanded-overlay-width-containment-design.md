# Expanded Overlay Width Containment Design

## Problem

The expanded LeetCode overlay is at most 420px wide. A long next-problem title
could still establish the post-submit footer's intrinsic width, stretching both
the next card and the restart/update row past the overlay. The title already
used truncation, but its flex/grid ancestors did not allow it to shrink.

## Decision

The `overlay-session`-owned expanded footer will use `min-w-0` and one
`minmax(0, 1fr)` grid track. Long next titles and details remain single-line
and ellipsized; actions and feedback remain inside the existing overlay width.

The fix does not change global overflow, overlay dimensions, review behavior,
runtime messaging, navigation, or collapsed/docked modes.

## Validation

A focused submitted-state regression test preserves the two signals that guard
this bug:

- the footer exposes the shrinkable sizing contract
- the long title keeps its truncation contract

Existing neighboring tests continue to cover restart/update actions and the
next-problem link.

Automated validation uses the focused component test, lint, full tests, and the
extension build. Before merge, a human must verify short and long next titles at
normal and narrow viewport widths and attach screenshot or recording proof.
