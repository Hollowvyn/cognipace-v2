# Ordered Track Next Design

## Context

The Tracks workspace currently chooses the first due incomplete problem anywhere
in the active track before it considers curriculum order. This lets an FSRS due
review from a much later group replace the study target shown as `Next`, even
though the workspace already presents due reviews separately.

Track memberships are persisted and read in group position followed by problem
position. The defect is in selection precedence, not stored track order or
progress.

## Product Decision

The active track's `Next` problem will be the first incomplete, non-suspended
membership in explicit curriculum order:

1. group position ascending;
2. problem position ascending.

FSRS due state will not reorder track progression. Due and overdue incomplete
memberships will continue to contribute to the workspace's due-review count,
but that count is independent of the `Next` target.

The persisted active group remains a workspace navigation choice. Selecting a
group tab does not change curriculum order or retarget `Next`.

## Behavior

- Completed memberships are excluded from `Next` candidates.
- Suspended memberships are skipped without changing their persisted track
  completion.
- The first remaining membership in explicit track order becomes `Next`.
- If every membership is completed or every incomplete membership is suspended,
  `Next` is empty.
- Saving a recalled rating advances `Next` according to the existing track
  completion rules.
- Review scheduling, queue recommendations, track progress counts, active-group
  persistence, and problem ordering are unchanged.

## Out of Scope

- Changing FSRS scheduling or queue recommendation order
- Reordering or mutating track memberships
- Automatically changing the active group when `Next` advances
- Changing track-completion or review-correction semantics
- Adding a user-configurable track progression policy
