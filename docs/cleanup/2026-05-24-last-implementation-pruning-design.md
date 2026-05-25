# Last Implementation Pruning Design

## Context

The last Tracks implementation landed useful behavior, but the merged diff is
larger than the original scope guardrails expected. A read-only audit with
parallel agents found that the architecture is mostly intact: Tracks owns track
progression, app-shell consumes read models, runtime methods remain
dashboard-scoped, and no new migration was introduced.

The main cleanup need is pruning, not redesign. The largest low-risk reduction
is in planning artifacts and tests that assert visual implementation details
instead of user-visible behavior.

## Goals

- Remove the last implementation's bulky `docs/superpowers` spec and plan
  artifacts from the active repo.
- Prune brittle tests that assert Tailwind classes, token classes, exact action
  ordering, and jsdom layout proxies.
- Keep high-signal behavior tests for form payloads, validation, duplicate
  problem exclusion, error states, runtime boundaries, repository rules, and
  core Tracks screen behavior.
- Keep production changes minimal.
- Preserve the current product behavior.

## Non-Goals

- No large `TrackForm` split in this pass.
- No broad `TrackActions` redesign in this pass.
- No compound component, HOC, render-prop, or shared UI abstraction work.
- No schema or migration work.
- No visual redesign.

## Required Build-Health Fix

The audit found one likely build blocker: `src/features/problems/api/problems-contracts.ts`
still imports from deleted `@/lib/problem-catalog` files. The cleanup should fix
that import by using the Problems feature domain as the source for
`problemDifficulties`.

This is the only planned production-code change unless implementation discovers
another equivalent build blocker.

## Docs Pruning

Remove the last implementation's superpowers planning artifacts:

- `docs/superpowers/specs/2026-05-24-tracks-phase-3-2-design.md`
- `docs/superpowers/specs/2026-05-24-track-form-compact-composer-design.md`
- `docs/superpowers/plans/2026-05-24-tracks-phase-3-2.md`
- `docs/superpowers/plans/2026-05-24-track-form-compact-composer.md`

Update `docs/superpowers/README.md` only if needed so it does not link deleted
files. Keep older docs if they still provide useful project history and are not
part of the last implementation cleanup.

## Test Pruning

Prefer behavior checks over implementation checks.

Prune or shrink tests that assert:

- exact Tailwind layout classes
- typography token classes
- z-index, sticky, scroll-container, grid-column, or wrapping classes
- exact icon-only action order when the user-visible behavior is already covered
- jsdom layout proxies that should be verified manually or with browser checks

Keep tests that prove:

- create and edit requests preserve payload shape
- validation blocks invalid saves and shows useful errors
- duplicate problem selection is not offered
- pending and failed saves behave correctly
- Tracks screen loading, error, empty, active-track, and group-selection behavior
- destructive track actions confirm, fail visibly, and call the correct runtime
  methods
- runtime schemas, policies, handlers, and repository invariants

## Validation

Run focused tests for touched suites first. If dependencies are available, finish
with `npm run check` and `npm run format`.

If dependencies are not installed, report the exact command that could not run
and the missing prerequisite.

## Cleanup Boundary

Stop and reassess if the implementation starts requiring broad production UI
refactors. The purpose of this pass is to reduce code and test debt, not to
reshape Tracks.
