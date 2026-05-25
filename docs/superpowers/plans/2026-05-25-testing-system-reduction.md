# Testing System Reduction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the Vitest suite by about 50% while preserving high-value domain, runtime, database, and user-critical workflow coverage.

**Architecture:** Keep the production app behavior unchanged. Update the contributor/agent testing standard first, then prune tests by ownership area, moving coverage down to focused domain/table tests only when that creates a clearer boundary. Use Vitest parameterization and TypeScript shape guarantees to remove repeated runtime assertions.

**Tech Stack:** WXT, React 19, TypeScript 6.0.2, Vitest 4.1.6, React Testing Library, TanStack Query, Zod, Drizzle, SQLite WASM.

---

## Scope Check

This is one broad cleanup effort, but it is not multiple product subsystems. The work is organized by independent ownership areas so agents can prune and validate one area at a time without editing the same files concurrently.

## File Structure

### Documentation

- Modify `CONTRIBUTING.md`: add the lean testing standard and TDD cleanup rule.
- Modify `docs/testing.md`: add contributor validation guidance for pruned suites and broad deletion passes.
- Modify `AGENTS.md`: add testing reduction rules for agents.
- Modify `docs/superpowers/README.md`: index the new design and implementation plan.

### High-Impact Test Targets

- Modify `src/extension/background/register-handlers.test.ts`: collapse repeated handler tests with table-driven cases while keeping boundary guarantees.
- Modify `src/features/tracks/components/tracks-screen.test.tsx`: keep only track-screen workflows, remove table/details/UI mechanics.
- Create `src/features/tracks/components/track-problem-table.test.tsx`: move the reusable table expansion contract out of `tracks-screen.test.tsx`.
- Modify `src/features/tracks/components/track-form.test.tsx`: keep create/edit workflows and critical validation, remove form micro-tests.
- Modify `src/features/problems/components/library/problem-library-screen.test.tsx`: keep Library workflows, remove render/table/detail duplication.
- Modify selected large suites found during the final sweep, starting with:
  - `src/features/overlay-session/hooks/use-leetcode-overlay-session.test.tsx`
  - `src/app/dashboard/routes.test.tsx`
  - `src/features/practice/practice-core.integration.test.ts`
  - `src/features/app-shell/server/app-shell-service.test.ts`
  - `src/features/settings/hooks/use-settings-draft.test.tsx`
  - `src/features/backup/components/data-management-screen.test.tsx`
  - `src/features/settings/components/settings-screen.test.tsx`
  - `src/app/popup/popup-shell.test.tsx`
  - `src/features/app-shell/components/overview-screen.test.tsx`

### Shared Test Utilities

- Prefer existing fixtures in `src/testing/*-fixtures.ts`.
- Prefer existing `src/testing/query-test-harness.tsx` for React Query provider setup.
- Add shared helpers only when at least three remaining suites repeat the same setup after pruning.

---

### Task 1: Capture Baseline And Update Testing Standard Docs

**Files:**

- Modify: `CONTRIBUTING.md`
- Modify: `docs/testing.md`
- Modify: `AGENTS.md`
- Modify: `docs/superpowers/README.md`

- [ ] **Step 1: Capture current test metrics**

Run:

```sh
rg --files -g '*.{test,spec}.{ts,tsx}' -g '!node_modules' -g '!dist' -g '!coverage' | wc -l
rg -n '\b(it|test)\(' -g '*.{test,spec}.{ts,tsx}' src | wc -l
rg -n 'expect\(' -g '*.{test,spec}.{ts,tsx}' src | wc -l
rg --files -g '*.{test,spec}.{ts,tsx}' -g '!node_modules' -g '!dist' -g '!coverage' | xargs wc -l | sort -nr | head -30
```

Expected before pruning:

```txt
73 test/spec files
545 tests
1682 expect calls
21324 total test LOC
```

- [ ] **Step 2: Add the contributor testing standard**

In `CONTRIBUTING.md`, replace the current `## Testing` section body with this text:

````md
## Testing

Use Vitest and React Testing Library. TDD is encouraged while developing: write narrow tests to discover behavior, reproduce bugs, or drive implementation. Before pushing, prune those tests like production code. Keep only tests that protect a lasting contract, collapse duplicates, and delete scaffolding that only helped implementation.

Keep tests when they protect one of these contracts:

- user-critical workflows across a product surface, such as saving settings, restoring a backup, managing Library rows, tracking progress, or saving overlay reviews
- domain rules TypeScript cannot prove, such as scheduling, assessment, queue ordering, target-date rules, track completion, and form-state rules
- runtime/data boundaries, such as Zod contracts, Chrome sender authorization, DB repositories, migrations, cache invalidation, serialization, backup import/restore safety, and LeetCode DOM parsing
- bug regressions with a clear failure story

Delete or collapse tests that only verify render-only behavior, generic loading/empty/error boilerplate, CSS classes, button presence already covered by a workflow, component internals, table mechanics owned elsewhere, parent/child duplicates, or static shape TypeScript can prove.

Prefer one high-signal workflow test plus critical destructive/error cases. Most tests should assert one to three meaningful outcomes. If many similar domain cases remain, use `it.each`, `test.each`, `describe.each`, or `test.for` when the table makes the behavior clearer. Use `satisfies`, discriminated unions, `as const`, const type parameters, and `never` exhaustiveness checks to remove runtime tests for static guarantees.

Use typed fixtures and local helpers first. Promote shared helpers only after repeated setup appears in multiple suites and the helper keeps the test easier to read.

Run before handing off substantial changes:

```sh
npm run check
npm run format
```

For docs-only changes, run Prettier on the changed markdown files. Do not claim runtime validation unless `npm run check` or focused runtime tests were actually run.

If an existing branch is already failing, state the exact failing command and test instead of hiding it.
````

- [ ] **Step 3: Add contributor validation guidance to the testing guide**

Append this section after `## Validation Commands` in `docs/testing.md`:

```md
## Contributor Test Selection

Keep the committed suite lean. TDD can use extra temporary tests during development, but before pushing, delete or collapse tests that do not protect a lasting contract.

Use focused validation by change type:

- docs-only: run Prettier on changed Markdown files
- pruned test suites: run the affected focused tests
- runtime, database, or contract changes: run the focused boundary tests for that layer
- broad deletion pass: run `npm run check` before handoff

Do not preserve tests for coverage percentages alone. Prefer domain, runtime, repository, and user-critical workflow coverage over repeated component assertions.
```

- [ ] **Step 4: Add agent testing reduction rules**

Append this section after `## Validation` in `AGENTS.md`:

```md
## Testing Reduction Rules

- TDD is welcome during development.
- Before finishing, prune temporary TDD tests that do not protect a lasting contract.
- Do not add tests for behavior already protected by TypeScript, Zod at a stronger boundary, or a parent workflow.
- Prefer typed fixtures, local helpers, table-driven Vitest tests, and high-signal workflows.
- Avoid render-only, CSS, duplicated parent/child, and generic table-mechanic tests.
- Large test files are a design smell. Simplify, split by real ownership boundary, move behavior down, or delete duplication instead of adding explanatory comments.
```

- [ ] **Step 5: Index the new Superpowers artifacts**

In `docs/superpowers/README.md`, add these bullets under the existing Specs and Plans lists:

```md
- [`specs/2026-05-25-testing-system-reduction-design.md`](./specs/2026-05-25-testing-system-reduction-design.md): approved design for aggressively reducing the test suite while preserving high-value contracts.
```

```md
- [`plans/2026-05-25-testing-system-reduction.md`](./plans/2026-05-25-testing-system-reduction.md): implementation plan for the broad testing reduction pass.
```

- [ ] **Step 6: Format and validate docs**

Run:

```sh
npx prettier --check CONTRIBUTING.md docs/testing.md AGENTS.md docs/superpowers/README.md
```

Expected: Prettier passes.

- [ ] **Step 7: Commit docs standard**

Run:

```sh
git add CONTRIBUTING.md docs/testing.md AGENTS.md docs/superpowers/README.md
git commit -m "docs: define lean testing standard"
```

Expected: commit succeeds.

---

### Task 2: Collapse Background Handler Tests With Tables

**Files:**

- Modify: `src/extension/background/register-handlers.test.ts`

- [ ] **Step 1: Replace repeated read-handler tests with one table**

Keep one direct test for `app-shell.getData` because it covers payload parsing and surface policy. Replace separate read-only tests for active track, workspace, track edit, settings, Library, backup export, and backup validation with an `it.each` table like this:

```ts
it.each([
  {
    method: 'tracks.getActiveTrack',
    request: { surface: 'dashboard' as const },
    service: backgroundMocks.getActiveTrack,
    response: createActiveTrack(null),
    expectedPolicySurface: 'dashboard' as const,
  },
  {
    method: 'tracks.getWorkspace',
    request: { surface: 'dashboard' as const },
    service: backgroundMocks.getWorkspace,
    response: trackWorkspaceResponse,
    expectedPolicySurface: 'dashboard' as const,
  },
  {
    method: 'tracks.getTrackForEdit',
    request: { surface: 'dashboard' as const, trackId: 'leetcode-75' },
    service: backgroundMocks.getTrackForEdit,
    response: trackForEditResponse,
    expectedPolicySurface: 'dashboard' as const,
  },
  {
    method: 'settings.getSettings',
    request: { surface: 'dashboard' as const },
    service: backgroundMocks.getSettings,
    response: defaultUserSettings,
    expectedPolicySurface: 'dashboard' as const,
  },
  {
    method: 'problems.getLibrary',
    request: { surface: 'dashboard' as const },
    service: backgroundMocks.getProblemLibrary,
    response: problemLibraryResponse,
    expectedPolicySurface: 'dashboard' as const,
  },
  {
    method: 'backup.exportFullBackup',
    request: { surface: 'dashboard' as const },
    service: backgroundMocks.backupExportFullBackup,
    response: validBackup,
    expectedPolicySurface: 'dashboard' as const,
  },
  {
    method: 'backup.validateFullBackup',
    request: {
      surface: 'dashboard' as const,
      backup: validBackup,
    },
    service: backgroundMocks.backupValidateFullBackup,
    response: createBackupSummary(validBackup),
    expectedPolicySurface: 'dashboard' as const,
  },
])(
  'registers $method as a read-only runtime boundary',
  async ({ method, request, service, response, expectedPolicySurface }) => {
    service.mockResolvedValue(response)

    await expect(sendRuntimeMessage(method, request)).resolves.toEqual(response)

    expectRuntimePolicy(method, expectedPolicySurface)
    expect(backgroundMocks.flushDbSnapshot).not.toHaveBeenCalled()
    expect(backgroundMocks.broadcastCacheInvalidation).not.toHaveBeenCalled()
  },
)
```

- [ ] **Step 2: Replace repeated track write tests with one table**

Keep `expectTrackWrite` and drive it with this table:

```ts
it.each([
  {
    method: 'tracks.setActiveTrack',
    request: { surface: 'dashboard' as const, trackId: 'leetcode-75' },
    schema: tracksSetActiveTrackRequestSchema,
    service: backgroundMocks.setActiveTrack,
    expectedResponse: null,
    expectedTags: ['tracks', 'app-shell'] as const,
  },
  {
    method: 'tracks.clearActiveTrack',
    request: { surface: 'dashboard' as const },
    schema: tracksClearActiveTrackRequestSchema,
    service: backgroundMocks.clearActiveTrack,
    expectedResponse: null,
    expectedTags: ['tracks', 'app-shell'] as const,
  },
  {
    method: 'tracks.setActiveGroup',
    request: {
      surface: 'dashboard' as const,
      trackId: 'leetcode-75',
      groupId: 'leetcode-75:arrays-hashing',
    },
    schema: tracksSetActiveGroupRequestSchema,
    service: backgroundMocks.setActiveGroup,
    expectedResponse: null,
    expectedTags: ['tracks', 'app-shell'] as const,
  },
  {
    method: 'tracks.deleteTrack',
    request: { surface: 'dashboard' as const, trackId: 'leetcode-75' },
    schema: tracksDeleteTrackRequestSchema,
    service: backgroundMocks.deleteTrack,
    expectedResponse: null,
    expectedTags: ['tracks', 'app-shell', 'problems'] as const,
  },
  {
    method: 'tracks.resetTrackProgress',
    request: { surface: 'dashboard' as const, trackId: 'leetcode-75' },
    schema: tracksResetTrackProgressRequestSchema,
    service: backgroundMocks.resetTrackProgress,
    expectedResponse: null,
    expectedTags: ['tracks', 'app-shell'] as const,
  },
  {
    method: 'tracks.createTrack',
    request: createTrackRequest(),
    schema: tracksCreateTrackRequestSchema,
    service: backgroundMocks.createTrack,
    expectedResponse: trackForEditResponse,
    expectedTags: ['tracks', 'app-shell', 'problems'] as const,
  },
  {
    method: 'tracks.updateTrack',
    request: {
      surface: 'dashboard' as const,
      trackId: 'leetcode-75',
      title: 'LeetCode 75',
      description: 'Updated track.',
      dueAt: null,
      groups: [
        {
          id: 'leetcode-75:arrays-hashing',
          title: 'Arrays',
          problemSlugs: ['two-sum'],
        },
      ],
    },
    schema: tracksUpdateTrackRequestSchema,
    service: backgroundMocks.updateTrack,
    expectedResponse: trackForEditResponse,
    expectedTags: ['tracks', 'app-shell', 'problems'] as const,
  },
])('flushes and broadcasts invalidation for $method', async (input) => {
  await expectTrackWrite(input)
})
```

- [ ] **Step 3: Collapse practice-save rating variants**

Replace separate `good` and `easy` active-track progress tests with this table:

```ts
it.each(['good', 'easy'] as const)(
  'records active-track progress for %s saved reviews',
  async (rating) => {
    resetRuntimeMutationMocks()
    backgroundMocks.recordActiveTrackProblemCompletion.mockResolvedValueOnce(
      true,
    )

    await sendRuntimeMessage('practice.saveReviewResult', {
      surface: 'dashboard',
      problemSlug: 'two-sum',
      rating,
      reviewedAt: '2026-01-01T10:00:00.000Z',
      durationSeconds: 300,
      log: null,
    })

    expect(
      backgroundMocks.recordActiveTrackProblemCompletion,
    ).toHaveBeenCalledWith(backgroundMocks.db, {
      problemSlug: 'two-sum',
      rating,
      reviewedAt: new Date('2026-01-01T10:00:00.000Z'),
    })
    expect(backgroundMocks.broadcastCacheInvalidation).toHaveBeenCalledWith({
      reason: 'practice-updated',
      source: 'dashboard',
      tags: ['practice', 'problems', 'queue', 'app-shell', 'tracks'],
    })
  },
)
```

- [ ] **Step 4: Keep dedicated boundary tests**

Keep focused tests for:

- invalid settings patches rejected before writes
- invalid problem writes rejected before mutation side effects
- backup payloads validated by service before app/version rejection
- restore and reset local data flushing plus broad invalidation
- queue request/response timestamp schema validation
- override invalidates tracks

Delete tests that become duplicates of the read/write tables.

- [ ] **Step 5: Validate background handler tests**

Run:

```sh
npm run test -- src/extension/background/register-handlers.test.ts
```

Expected: focused test file passes.

- [ ] **Step 6: Commit background handler reduction**

Run:

```sh
git add src/extension/background/register-handlers.test.ts
git commit -m "test: collapse background handler coverage"
```

Expected: commit succeeds.

---

### Task 3: Split Track Table Coverage And Prune Tracks Screen

**Files:**

- Modify: `src/features/tracks/components/tracks-screen.test.tsx`
- Create: `src/features/tracks/components/track-problem-table.test.tsx`

- [ ] **Step 1: Create a focused track problem table test**

Create `src/features/tracks/components/track-problem-table.test.tsx` with this content:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { Button } from '@/components/ui/button'
import type { SerializedProblem } from '@/features/problems'
import { createSerializedProblem } from '@/testing/problem-fixtures'
import { createQueryTestHarness } from '@/testing/query-test-harness'
import { createTrackProblemRow } from '@/testing/track-fixtures'

import { TrackProblemTable } from './track-problem-table'

describe('TrackProblemTable', () => {
  it('expands one practice-only row detail at a time', async () => {
    const user = userEvent.setup()
    const rows = [
      createTrackProblemRow({
        problem: createSerializedProblem({ slug: 'two-sum', title: 'Two Sum' }),
        membership: {
          trackId: 'leetcode-75',
          groupId: 'leetcode-75:arrays-hashing',
          groupTitle: 'Arrays and Hashing',
          groupPosition: 1,
          problemPosition: 1,
          completedAt: null,
          completedRating: null,
        },
      }),
      createTrackProblemRow({
        problem: createSerializedProblem({
          slug: 'binary-search',
          title: 'Binary Search',
        }),
        membership: {
          trackId: 'leetcode-75',
          groupId: 'leetcode-75:arrays-hashing',
          groupTitle: 'Arrays and Hashing',
          groupPosition: 1,
          problemPosition: 2,
          completedAt: null,
          completedRating: null,
        },
      }),
    ]

    renderTrackProblemTable(rows)

    await user.click(screen.getByRole('button', { name: 'Expand Two Sum' }))

    expect(screen.getByRole('heading', { name: 'Details' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute(
      'href',
      '#/library/problems/two-sum/edit',
    )
    expect(
      screen.queryByRole('button', { name: 'Delete' }),
    ).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Expand Binary Search' }),
    )

    expect(
      screen.getByRole('button', { name: 'Collapse Binary Search' }),
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Collapse Two Sum' }),
    ).not.toBeInTheDocument()
  })
})

function renderTrackProblemTable(
  rows: Parameters<typeof TrackProblemTable>[0]['rows'],
) {
  const { wrapper } = createQueryTestHarness()

  return render(
    <TrackProblemTable
      renderEditProblemAction={(problem: SerializedProblem) => (
        <Button asChild size="sm" variant="ghost">
          <a href={`#/library/problems/${problem.slug}/edit`}>Edit</a>
        </Button>
      )}
      rows={rows}
    />,
    { wrapper },
  )
}
```

- [ ] **Step 2: Remove table and accordion mechanics from TracksScreen**

In `src/features/tracks/components/tracks-screen.test.tsx`, delete these tests:

- `renders the loading state`
- `renders the error state with Retry`
- `renders the no tracks empty state`
- `keeps New Track reachable from the active workspace`
- `renders active groups as a single horizontally scrollable tab row`
- `shows group scroll indicators as the tab row scrolls`
- `hides group tabs for a single-group track`
- `keeps all tracks collapsed by default and marks the active row when expanded`
- `opens all tracks when a track is added after the catalog mounts`
- `toggles all tracks when the accordion header row is clicked`
- `does not toggle all tracks when New Track is clicked`
- `keeps the forced-open all tracks row from collapsing when there is no active track`
- `keeps all tracks actions available when expanded`
- `renders universal management actions for inactive track rows`
- `traps confirmation focus, closes with Escape, and restores focus`
- `closes confirmation when the backdrop is clicked`
- `keeps confirmation focus stable while an action is pending`
- `expands problem rows with reusable practice actions and no global Delete`

- [ ] **Step 3: Keep and collapse track-specific screen workflows**

Keep these track-specific tests, renaming as needed:

- `renders all tracks expanded when no active track is selected`
- `renders the active workspace title, summaries, metrics, groups, and active rows`
- `renders track completion separately from review status`
- `formats target summary and catalog metadata without local timezone drift`
- `labels due count as due reviews instead of track target date`
- `marks overdue track targets without making the row an error state`
- `sets the active group from the group buttons`
- `sets another track active without rendering inactive track tables`
- `clears the active track from the active workspace header`
- `uses local confirmation dialogs for Delete and Reset Progress`
- `shows delete and reset rejection errors inside the confirmation dialog`

If two kept tests assert the same labels from the same workspace fixture, merge them into one workflow with no more than three assertions after each user action.

- [ ] **Step 4: Remove dead helpers and imports**

Delete unused imports and helper code from `tracks-screen.test.tsx`, including:

- `fireEvent` if no kept test uses it
- `OtherTracksAccordion`
- `renderOtherTracksAccordion`
- `createOtherTracksAccordionElement`
- `mockTrackGroupTabScrollMetrics` if scroll tests are deleted

- [ ] **Step 5: Validate tracks component tests**

Run:

```sh
npm run test -- src/features/tracks/components/tracks-screen.test.tsx src/features/tracks/components/track-problem-table.test.tsx
```

Expected: both focused test files pass.

- [ ] **Step 6: Commit tracks screen reduction**

Run:

```sh
git add src/features/tracks/components/tracks-screen.test.tsx src/features/tracks/components/track-problem-table.test.tsx
git commit -m "test: prune tracks screen coverage"
```

Expected: commit succeeds.

---

### Task 4: Prune Track Form Tests And Parameterize Date Rules

**Files:**

- Modify: `src/features/tracks/components/track-form.test.tsx`

- [ ] **Step 1: Keep the form tests that protect lasting behavior**

Keep these tests:

- `requires a title and starts create mode with a Main group`
- `creates a track with ordered groups and selected-group problem membership`
- `seeds create mode from selected Library rows and shows compact Group by`
- `regroups and moves draft problems with compact group selectors`
- `shows save failures inside the form`
- `loads existing metadata, groups, and memberships for edit submit replacement`

Delete these tests because they are form mechanics or duplicated by hook/domain coverage:

- `does not submit the modal when Enter is pressed inside form fields`
- `sends setActive only when the create checkbox is checked`
- `does not offer a problem already selected in another group`
- `keeps Cancel available while a create save is pending`
- `renders compact group rows and expands only the selected group title input`
- `keeps group removal disabled for non-empty groups and the final group`
- `shows selected group problems with move and remove controls`
- `shows up to five autocomplete results while searching or focused`
- `expands the first invalid group title on submit`

- [ ] **Step 2: Replace separate target-date tests with `it.each`**

Replace the tests named below with one parameterized block:

- `blocks a past target date in create mode`
- `allows a same-day target date during local evening hours`
- `allows an unchanged saved past target date in edit mode`
- `blocks a changed past target date in edit mode`
- `clears a target date to null`

Use this shape:

```tsx
it.each([
  {
    name: 'blocks a past target date in create mode',
    mode: 'create' as const,
    source: createTrackDefaults(),
    inputDate: '2026-05-24',
    expectedMessage: 'Target date cannot be in the past.',
    expectedDueAt: null,
  },
  {
    name: 'allows a same-day target date during local evening hours',
    mode: 'create' as const,
    source: createTrackDefaults(),
    inputDate: '2026-05-25',
    expectedMessage: null,
    expectedDueAt: '2026-05-25T00:00:00.000Z',
  },
  {
    name: 'allows an unchanged saved past target date in edit mode',
    mode: 'edit' as const,
    source: createEditResponse({ dueAt: '2026-05-24T00:00:00.000Z' }),
    inputDate: '2026-05-24',
    expectedMessage: null,
    expectedDueAt: '2026-05-24T00:00:00.000Z',
  },
  {
    name: 'blocks a changed past target date in edit mode',
    mode: 'edit' as const,
    source: createEditResponse({ dueAt: '2026-05-26T00:00:00.000Z' }),
    inputDate: '2026-05-24',
    expectedMessage: 'Target date cannot be in the past.',
    expectedDueAt: null,
  },
  {
    name: 'clears a target date to null',
    mode: 'edit' as const,
    source: createEditResponse({ dueAt: '2026-05-26T00:00:00.000Z' }),
    inputDate: '',
    expectedMessage: null,
    expectedDueAt: null,
  },
])(
  '$name',
  async ({ mode, source, inputDate, expectedMessage, expectedDueAt }) => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 4, 25, 20, 0, 0))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    mockTrackFormRuntime(source)

    renderTrackForm(
      <TrackForm mode={mode} onCancel={vi.fn()} onSaved={vi.fn()} />,
    )

    await user.type(await screen.findByLabelText('Title'), 'Interview Track')
    await user.clear(screen.getByLabelText('Target date'))
    if (inputDate) {
      await user.type(screen.getByLabelText('Target date'), inputDate)
    }
    await user.click(screen.getByRole('button', { name: 'SAVE' }))

    if (expectedMessage) {
      expect(await screen.findByRole('alert')).toHaveTextContent(
        expectedMessage,
      )
      expect(sendMessage).not.toHaveBeenCalledWith(
        mode === 'create' ? 'tracks.createTrack' : 'tracks.updateTrack',
        expect.anything(),
      )
      return
    }

    await waitFor(() => {
      const expectedRequest =
        mode === 'edit'
          ? expect.objectContaining({
              trackId: 'leetcode-75',
              dueAt: expectedDueAt,
            })
          : expect.objectContaining({ dueAt: expectedDueAt })

      expect(sendMessage).toHaveBeenCalledWith(
        mode === 'create' ? 'tracks.createTrack' : 'tracks.updateTrack',
        expectedRequest,
      )
    })
  },
)
```

- [ ] **Step 3: Validate track form tests**

Run:

```sh
npm run test -- src/features/tracks/components/track-form.test.tsx
```

Expected: focused test file passes.

- [ ] **Step 4: Commit track form reduction**

Run:

```sh
git add src/features/tracks/components/track-form.test.tsx
git commit -m "test: prune track form coverage"
```

Expected: commit succeeds.

---

### Task 5: Prune Library Screen Tests

**Files:**

- Modify: `src/features/problems/components/library/problem-library-screen.test.tsx`

- [ ] **Step 1: Delete generic and duplicated Library tests**

Delete these tests:

- `renders the loading state`
- `renders the error state with retry affordance`
- `renders the empty state`
- `allows multiple values in one facet filter`
- `renders the MVP table columns and row selection controls`
- `hides premium and suspended rows from switch filters`
- `shows summary counts and expandable row details`
- `sorts rows and uses contextual empty date labels`
- `shows resume for suspended rows`
- `disables delete while a practice row action is pending`
- `renders reusable practice-only row details without delete`
- `closes problem delete confirmation when the backdrop is clicked`
- `renders a selected-row action with selected rows in bulk-selection order`
- `closes bulk metadata dialog when the backdrop is clicked`

- [ ] **Step 2: Keep and tighten user-critical Library workflows**

Keep these tests with no more than three assertions per interaction block:

- `filters Library rows by search and metadata controls`
- `shows row actions and runs practice-owned suspend and reset writes`
- `deletes any library problem with confirmation`
- `runs bulk suspend, resume, reset, and delete actions for selected rows`
- `bulk-edits metadata with explicit enabled replacement fields`
- `bulk metadata omits disabled fields and clears enabled empty labels`

When a kept test checks multiple nearly identical mutations, use an array of expected calls and one assertion:

```ts
expect(sendMessage).toHaveBeenCalledWith(
  'problems.bulkUpdateProblems',
  expect.objectContaining({
    problemSlugs: ['two-sum', 'binary-search'],
    practice: expect.objectContaining({ suspended: true }),
  }),
)
```

- [ ] **Step 3: Remove dead imports and helpers**

Remove imports for direct `ProblemRowActionsBar`, `ProblemRowDetails`, and `ProblemRowPracticeActions` rendering if no kept test renders those components directly.

Remove helper functions only used by deleted tests, including `getProblemTitleOrder` if sorting coverage is deleted.

- [ ] **Step 4: Validate Library screen tests**

Run:

```sh
npm run test -- src/features/problems/components/library/problem-library-screen.test.tsx
```

Expected: focused test file passes.

- [ ] **Step 5: Commit Library screen reduction**

Run:

```sh
git add src/features/problems/components/library/problem-library-screen.test.tsx
git commit -m "test: prune library screen coverage"
```

Expected: commit succeeds.

---

### Task 6: Parameterize Track Hook And Utility Logic Tests

**Files:**

- Modify: `src/features/tracks/hooks/track-form-initial-draft.test.ts`
- Modify: `src/features/tracks/utils/library-selection-track-draft.test.ts`
- Modify: `src/features/tracks/hooks/use-track-form.test.tsx`

- [ ] **Step 1: Parameterize initial draft grouping cases**

In `track-form-initial-draft.test.ts`, replace the four separate grouping tests with this `it.each` shape:

```ts
it.each([
  {
    groupBy: 'none' as const,
    rows: [
      row('two-sum', 'Two Sum'),
      row('valid-parentheses', 'Valid Parentheses'),
      row('binary-search', 'Binary Search'),
    ],
    expected: [
      {
        key: 'draft-group-1',
        problemSlugs: ['two-sum', 'valid-parentheses', 'binary-search'],
        title: 'Main',
      },
    ],
  },
  {
    groupBy: 'difficulty' as const,
    rows: [
      row('unknown-problem', 'Unknown Problem', { difficulty: 'unknown' }),
      row('hard-problem', 'Hard Problem', { difficulty: 'hard' }),
      row('easy-problem', 'Easy Problem', { difficulty: 'easy' }),
    ],
    expected: [
      { key: 'draft-group-1', problemSlugs: ['easy-problem'], title: 'Easy' },
      { key: 'draft-group-2', problemSlugs: ['hard-problem'], title: 'Hard' },
      {
        key: 'draft-group-3',
        problemSlugs: ['unknown-problem'],
        title: 'Unknown',
      },
    ],
  },
  {
    groupBy: 'topic' as const,
    rows: [
      row('two-sum', 'Two Sum', {
        topics: [
          { id: 'arrays', label: 'Arrays' },
          { id: 'hashing', label: 'Hashing' },
        ],
      }),
      row('binary-tree', 'Binary Tree', {
        topics: [{ id: 'trees', label: 'Trees' }],
      }),
      row('untagged', 'Untagged'),
    ],
    expected: [
      { key: 'draft-group-1', problemSlugs: ['two-sum'], title: 'Arrays' },
      { key: 'draft-group-2', problemSlugs: ['binary-tree'], title: 'Trees' },
      { key: 'draft-group-3', problemSlugs: ['untagged'], title: 'No topic' },
    ],
  },
  {
    groupBy: 'company' as const,
    rows: [
      row('two-sum', 'Two Sum', {
        companies: [
          { id: 'meta', label: 'Meta' },
          { id: 'google', label: 'Google' },
        ],
      }),
      row('merge-intervals', 'Merge Intervals', {
        companies: [{ id: 'amazon', label: 'Amazon' }],
      }),
      row('unlabeled', 'Unlabeled'),
    ],
    expected: [
      { key: 'draft-group-1', problemSlugs: ['two-sum'], title: 'Meta' },
      {
        key: 'draft-group-2',
        problemSlugs: ['merge-intervals'],
        title: 'Amazon',
      },
      {
        key: 'draft-group-3',
        problemSlugs: ['unlabeled'],
        title: 'No company',
      },
    ],
  },
])('groups selected rows by $groupBy', ({ groupBy, rows, expected }) => {
  expect(createGroupsFromInitialDraftRows(rows, groupBy)).toEqual(expected)
})
```

- [ ] **Step 2: Collapse malformed draft rejection cases**

In `library-selection-track-draft.test.ts`, split the large malformed rejection test into table-driven invalid stored payloads:

```ts
it.each([
  ['bad-json', '{'],
  [
    'wrong-shape',
    JSON.stringify({
      id: 'wrong-shape',
      source: 'library-selection',
      problemSlugs: 'two-sum',
      createdAt: '2026-05-24T12:00:00.000Z',
    }),
  ],
  [
    'empty',
    JSON.stringify({
      id: 'empty',
      source: 'library-selection',
      problemSlugs: [],
      createdAt: '2026-05-24T12:00:00.000Z',
    }),
  ],
  [
    'invalid-created-at',
    JSON.stringify({
      id: 'invalid-created-at',
      source: 'library-selection',
      problemSlugs: ['two-sum'],
      createdAt: 'not-a-date',
    }),
  ],
  [
    'impossible-created-at',
    JSON.stringify({
      id: 'impossible-created-at',
      source: 'library-selection',
      problemSlugs: ['two-sum'],
      createdAt: '2026-02-31T12:00:00.000Z',
    }),
  ],
])('rejects invalid stored draft %s', (id, payload) => {
  const storage = new MemoryStorage()
  storage.setItem(`cognipace:track-draft:${id}`, payload)

  expect(readLibrarySelectionTrackDraft(id, { storage })).toBeNull()
  expect(storage.getItem(`cognipace:track-draft:${id}`)).toBeNull()
})
```

Keep separate tests for missing drafts, valid round trip, expired draft, and clear by id.

- [ ] **Step 3: Keep `useTrackForm` hook tests only for non-UI state transitions**

In `use-track-form.test.tsx`, keep:

- create-mode initial draft initialization
- edit-mode source group preservation
- groupBy rebuild
- moving a problem between groups

Delete `does not move a problem when the source and target are invalid or the same` if TypeScript and reducer guards make those invalid inputs unreachable from the UI. If the reducer is exported and used directly, keep it as a table-driven reducer guard test.

- [ ] **Step 4: Validate track logic tests**

Run:

```sh
npm run test -- src/features/tracks/hooks/track-form-initial-draft.test.ts src/features/tracks/utils/library-selection-track-draft.test.ts src/features/tracks/hooks/use-track-form.test.tsx
```

Expected: focused tests pass.

- [ ] **Step 5: Commit track logic test reduction**

Run:

```sh
git add src/features/tracks/hooks/track-form-initial-draft.test.ts src/features/tracks/utils/library-selection-track-draft.test.ts src/features/tracks/hooks/use-track-form.test.tsx
git commit -m "test: tighten track logic coverage"
```

Expected: commit succeeds.

---

### Task 7: Whole-Suite ROI Sweep

**Files:**

- Modify selected test files from the generated top-LOC list.

- [ ] **Step 1: Regenerate top-LOC list**

Run:

```sh
rg --files -g '*.{test,spec}.{ts,tsx}' -g '!node_modules' -g '!dist' -g '!coverage' | xargs wc -l | sort -nr | head -40
```

Expected: the top-LOC list no longer starts with `tracks-screen.test.tsx`, `track-form.test.tsx`, `problem-library-screen.test.tsx`, and `register-handlers.test.ts` at their original sizes.

- [ ] **Step 2: Prune remaining component/screen suites over 300 LOC**

Apply the same keep/delete/collapse standard to these files if they still exceed 300 LOC:

- `src/features/backup/components/data-management-screen.test.tsx`
- `src/features/settings/components/settings-screen.test.tsx`
- `src/app/popup/popup-shell.test.tsx`
- `src/features/app-shell/components/overview-screen.test.tsx`
- `src/app/dashboard/routes.test.tsx`

Keep one workflow per product surface and critical destructive/error cases. Delete render-only, loading-only, route-label, CSS, and repeated button-presence tests.

- [ ] **Step 3: Prune remaining hook/controller suites over 300 LOC**

Apply the standard to these files if they still exceed 300 LOC:

- `src/features/overlay-session/hooks/use-leetcode-overlay-session.test.tsx`
- `src/features/settings/hooks/use-settings-draft.test.tsx`
- `src/features/app-shell/hooks/use-popup-app-shell-controller.test.tsx`

Keep async runtime transitions and error recovery. Delete tests for internal state names, duplicated pending flags, and branches already covered by surface workflows.

- [ ] **Step 4: Prune remaining server/integration suites over 300 LOC**

Apply the standard to these files if they still exceed 300 LOC:

- `src/features/practice/practice-core.integration.test.ts`
- `src/features/app-shell/server/app-shell-service.test.ts`
- `src/features/backup/server/backup-service.test.ts`
- `src/features/backup/data/backup-repository.test.ts`

Keep database writes, serialization, backup safety, and cross-feature derivations. Use `it.each` for repeated ratings, invalid payloads, or date cases. Do not delete tests that protect destructive restore/reset behavior.

- [ ] **Step 5: Validate changed focused files**

Run focused tests for the sweep candidates:

```sh
npm run test -- src/features/backup/components/data-management-screen.test.tsx src/features/settings/components/settings-screen.test.tsx src/app/popup/popup-shell.test.tsx src/features/app-shell/components/overview-screen.test.tsx src/app/dashboard/routes.test.tsx
npm run test -- src/features/overlay-session/hooks/use-leetcode-overlay-session.test.tsx src/features/settings/hooks/use-settings-draft.test.tsx src/features/app-shell/hooks/use-popup-app-shell-controller.test.tsx
npm run test -- src/features/practice/practice-core.integration.test.ts src/features/app-shell/server/app-shell-service.test.ts src/features/backup/server/backup-service.test.ts src/features/backup/data/backup-repository.test.ts
```

Expected: focused changed tests pass.

- [ ] **Step 6: Commit whole-suite sweep**

Run:

```sh
git add src
git commit -m "test: prune remaining low-value coverage"
```

Expected: commit succeeds and includes only intentional test changes.

---

### Task 8: Final Metrics And Full Validation

**Files:**

- Validate all changed files.

- [ ] **Step 1: Capture final metrics**

Run:

```sh
rg --files -g '*.{test,spec}.{ts,tsx}' -g '!node_modules' -g '!dist' -g '!coverage' | wc -l
rg -n '\b(it|test)\(' -g '*.{test,spec}.{ts,tsx}' src | wc -l
rg -n 'expect\(' -g '*.{test,spec}.{ts,tsx}' src | wc -l
rg --files -g '*.{test,spec}.{ts,tsx}' -g '!node_modules' -g '!dist' -g '!coverage' | xargs wc -l | tail -1
```

Expected: test LOC is near 10,500 or lower. If it is higher, run one more ROI pass on the largest remaining component/screen tests before full validation.

- [ ] **Step 2: Run full validation**

Run:

```sh
npm run check
npm run format
```

Expected: both commands pass.

- [ ] **Step 3: Commit final validation notes if docs changed after Task 1**

If no docs changed after Task 1, skip this commit. If docs were changed, run:

```sh
git add CONTRIBUTING.md docs/testing.md AGENTS.md docs/superpowers/README.md
git commit -m "docs: update testing reduction notes"
```

Expected: commit succeeds only when there are doc changes.

- [ ] **Step 4: Prepare handoff summary**

Include these facts in the handoff:

- starting test LOC: 21,324
- final test LOC from the metrics command
- largest deleted/collapsed suites
- focused tests run by ownership area
- full validation commands and results
- any known residual risk
