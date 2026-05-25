# Testing System Reduction Design

## Context

CogniPace currently has a large Vitest suite for a small local-first Chrome MV3
extension. The suite is valuable in places, especially around runtime
boundaries, local persistence, domain rules, and LeetCode capture behavior, but
it has grown into broad component and workflow coverage that is expensive to
read and maintain.

Initial audit on May 25, 2026:

- 73 test/spec files
- 21,324 test LOC
- 545 tests
- 1,682 assertions
- largest areas by LOC:
  - `src/features/tracks`: 5,135 LOC
  - `src/lib`: 2,418 LOC
  - `src/features/problems`: 2,051 LOC
  - `src/extension`: 1,630 LOC
- component tests alone account for about 5,291 LOC

The current docs already encourage behavior-focused tests. The missing piece is
a stronger standard for which tests should survive after TDD and a concrete
cleanup strategy that reduces the suite heavily.

## Goals

- Reduce test LOC by about 50%.
- Keep tests that protect user-critical workflows, domain rules, and
  runtime/data boundaries.
- Delete or collapse tests that only protect implementation details, repeated
  presentation, or behavior already covered elsewhere.
- Make TDD explicitly welcome during development while requiring cleanup before
  push.
- Use TypeScript and Vitest features to make remaining tests shorter and clearer.
- Update contributor and agent guidance so future changes do not recreate the
  test bloat.

## Non-Goals

- Do not preserve tests for the sake of coverage percentages.
- Do not add a written justification process for large test files.
- Do not add broad new testing abstractions or a separate testing framework.
- Do not rewrite product behavior as part of the cleanup.
- Do not remove high-value boundary tests only because they are not UI-facing.

## Approved Approach

Use an aggressive ROI prune.

Delete or collapse low-signal test coverage first, especially component/screen
tests and large mock-heavy files. Preserve focused tests for behavior TypeScript
cannot prove and for runtime paths that can fail in the extension environment.

The suite should be smaller, easier to explain, and easier to change. The target
is about a 50% LOC reduction, but the test's value matters more than an exact
number.

## Testing Standard

A test should survive only when it protects one of these contracts:

1. A user-critical workflow across a product surface, such as saving settings,
   restoring a backup, managing Library rows, tracking progress, or saving an
   overlay review.
2. A domain rule TypeScript cannot prove, such as scheduling, assessment, queue
   ordering, target-date rules, track completion, or form-state rules.
3. A runtime/data boundary, such as Zod contracts, Chrome sender authorization,
   DB repositories, migrations, cache invalidation, serialization, backup
   import/restore safety, or LeetCode DOM parsing.
4. A bug regression with a clear failure story.

Tests should not survive when they only verify:

- render-only behavior
- generic loading, empty, or error boilerplate
- CSS classes, styling, or icons without a user-facing contract
- button presence already covered by a workflow
- component internals or state implementation
- every small UI branch
- generic table mechanics already covered by the table or row component
- behavior already covered by a parent workflow or child unit
- static shape that TypeScript can prove

Component tests should usually keep one high-signal happy path plus only the
critical destructive or error cases. Most tests should assert one to three
meaningful outcomes. If a test needs many assertions, it should be collapsed into
a clearer workflow, moved to a lower-level rule, or deleted.

## TDD Lifecycle Rule

TDD is encouraged during development. It is fine to create narrow tests while
discovering behavior, reproducing bugs, or driving implementation.

Before pushing, TDD tests must be reviewed like production code:

- keep tests that protect a lasting contract
- collapse duplicates into a single meaningful workflow or table-driven case
- delete scaffolding tests that only helped implementation
- remove tests for behavior now guaranteed by TypeScript, composition, or a
  lower-level boundary

The development process can use many temporary tests. The final merged suite
should remain lean.

## Pruning Rules

Use a keep, delete, or collapse decision for each suite.

Delete tests that prove presentation details, repeated UI states, table behavior
owned elsewhere, or parent/child duplicates.

Collapse repeated narrow tests into one flow and one critical edge case. Runtime
handler tests should use tables and shared helpers when the same parse, policy,
mutation, flush, and invalidation structure repeats.

Keep pure domain, runtime boundary, repository, database, backup safety, and
LeetCode parsing tests where the failure would be real and TypeScript cannot
replace the check.

Large files are a smell, not a paperwork trigger. If a suite remains large after
pruning, simplify it, split it by a real ownership boundary, move behavior down
to a cheaper domain/helper test, or delete more duplication. Do not add comments
or written justifications just to explain why a large test file exists.

## First Cleanup Targets

Start with the largest and most duplicated suites:

- `src/features/tracks/components/tracks-screen.test.tsx`
- `src/features/tracks/components/track-form.test.tsx`
- `src/features/problems/components/library/problem-library-screen.test.tsx`
- `src/extension/background/register-handlers.test.ts`
- large hook/controller suites where surface workflows or domain tests already
  cover the lasting behavior

Tracks should not test reusable table expansion or row-detail mechanics when
that behavior belongs to the table, row detail, or a shared workflow. Tracks
should test track-specific outcomes: active workspace behavior, active group
selection, track progress, destructive management actions, and the user flow that
matters for curriculum progression.

## Fixtures, Helpers, And TypeScript

Keep shared fixtures only for stable app contracts used across multiple suites:

- serialized problems
- practice state
- track workspace data
- app-shell data
- backup payloads
- runtime sender/message shapes

Use local builders for one-off component details. Fixture builders should return
fully valid objects and accept typed partial overrides. Prefer `satisfies` when
it keeps contract shape honest without widening literals.

Promote helpers only after repeated setup appears in multiple suites. Good
shared helpers include:

- render helpers for repeated provider setup
- runtime message mock setup
- repository/database seed setup
- meaningful repeated user workflows

Avoid helpers that hide the point of a test, create magical defaults, or make
assertions indirect.

Delete tests that only verify static shape, prop wiring, enum exhaustiveness, or
impossible states when TypeScript can prove the contract. Keep Zod/runtime
validation tests only at actual external boundaries: extension messages, backup
imports, persisted settings, LeetCode capture payloads, and DB serialization.

## Tooling Leverage

Use current Vitest and TypeScript capabilities to make the remaining tests more
compact and precise.

Use Vitest table-driven APIs when they improve clarity:

- `test.each` or `it.each` for input-output matrices
- `describe.each` for the same behavior across modes
- `test.for` when object cases or test context make cases cleaner
- `expectTypeOf` or `assertType` only for meaningful public type contracts

Use TypeScript to remove runtime tests for static guarantees:

- `satisfies` for fixture and contract shape
- `as const` and const type parameters for literal preservation
- discriminated unions for impossible states
- `never` exhaustiveness checks for branching logic
- strict inference and typed boundaries instead of runtime shape assertions

This should not become clever test golf. If parameterization makes the story
harder to read, keep the clearer single test or delete the low-value cases.

Documentation checked for this design:

- Vitest 4.1.6 docs for `test.each`, `test.for`, `describe.each`, and type
  testing
- TypeScript 6.0.2 docs/source examples for `satisfies`, const inference, and
  exhaustiveness checking

## React Composition Guidance

If a component needs many tests because it has many modes, boolean branches, or
rigid prop combinations, reduce the component complexity rather than preserving
all tests.

Prefer:

- smaller explicit components
- local hooks for workflow state
- pure domain/view-model functions for decisions
- composition over boolean prop sprawl

Do not introduce compound components, broad providers, or new architecture
layers unless the existing component truly needs them.

## Documentation Updates

Implementation should update the live docs after the spec is approved.

### `CONTRIBUTING.md`

Add the testing standard contributors should follow:

- test user-critical workflows, domain rules, and runtime/data boundaries
- avoid render-only, CSS, duplicated parent/child, and table-mechanic tests
- prefer one high-signal workflow test plus critical destructive/error cases
- use typed fixtures and local helpers before shared helpers
- use Vitest parameterization when it makes domain and logic tests clearer
- delete temporary TDD scaffolding before push when it does not protect a
  lasting contract

### `docs/testing.md`

Keep this friend/manual-QA focused, but add a short contributor validation
section:

- docs-only: run Prettier on changed Markdown
- pruned test suites: run affected focused tests
- runtime/DB/contract changes: run focused boundary tests
- broad deletion pass: run `npm run check` before handoff

### `AGENTS.md`

Add the testing reduction standard for agents:

- TDD is welcome during development
- prune temporary tests before finishing
- do not add tests for behavior already protected by TypeScript or a stronger
  boundary
- prefer typed fixtures, table-driven tests, and high-signal workflows
- do not recreate broad component micro-test coverage

## Validation Strategy

Prune incrementally by ownership area. Run focused tests after each area, then
run full validation at the end.

Expected validation:

- focused tests for each changed test ownership area
- `npm run check` before handoff for the broad deletion pass
- `npm run format` before handoff

Do not claim runtime validation unless the command actually ran.

## Success Criteria

- Test LOC is reduced by about 50%.
- Remaining tests map to the approved ROI categories.
- Large component/screen tests are deleted, collapsed, or split by real
  ownership boundaries.
- Temporary TDD tests are treated as development scaffolding unless they protect
  lasting contracts.
- Contributor and agent docs encode the standard for future work.
- Full validation passes, or any failure is reported with the exact command and
  failure.
