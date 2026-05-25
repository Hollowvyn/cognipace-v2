# Last Implementation Pruning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove last-implementation planning bloat and brittle tests while preserving current CogniPace behavior.

**Architecture:** Keep the cleanup intentionally narrow. Delete only the last implementation's superpowers artifacts, fix the stale Problems import that blocks build health, and prune tests that assert implementation details instead of behavior. Do not introduce compound components, HOCs, render props, shared UI abstractions, schema changes, or broad Tracks component refactors.

**Tech Stack:** TypeScript, React 19, TanStack Query, WXT runtime messaging, Drizzle ORM, Zod, Vitest, React Testing Library.

---

## Scope Checkpoint

**Files expected to change:**

- Modify: `src/features/problems/api/problems-contracts.ts`
- Delete: `docs/superpowers/specs/2026-05-24-tracks-phase-3-2-design.md`
- Delete: `docs/superpowers/specs/2026-05-24-track-form-compact-composer-design.md`
- Delete: `docs/superpowers/plans/2026-05-24-tracks-phase-3-2.md`
- Delete: `docs/superpowers/plans/2026-05-24-track-form-compact-composer.md`
- Modify: `src/app/dashboard/routes.test.tsx`
- Modify: `src/features/tracks/components/track-form.test.tsx`
- Modify: `src/features/tracks/components/tracks-screen.test.tsx`
- Modify: `src/features/tracks/server/tracks-service.test.ts`
- Modify: `src/features/app-shell/server/app-shell-service.test.ts`

**Files not expected to change:**

- `src/features/tracks/components/track-form.tsx`
- `src/features/tracks/components/track-actions.tsx`
- `src/features/tracks/components/active-track-workspace.tsx`
- `src/features/tracks/data/tracks-repository.ts`
- `src/features/tracks/server/tracks-service.ts`
- database schema and migration files

- [ ] **Step 1: Confirm branch and working tree**

Run:

```bash
git status --short --branch
```

Expected:

```text
## codex/last-implementation-pruning-design
```

No uncommitted changes should be present unless they are the plan commit.

- [ ] **Step 2: Confirm no implementation refactor has started**

Run:

```bash
git diff --stat
```

Expected: no production or test diff before Task 1 begins.

---

### Task 1: Fix Deleted Problem Catalog Import

**Files:**

- Modify: `src/features/problems/api/problems-contracts.ts`

- [ ] **Step 1: Verify the stale import exists**

Run:

```bash
rg -n "@/lib/problem-catalog|problemDifficulties" src/features/problems/api/problems-contracts.ts
```

Expected before the fix:

```text
src/features/problems/api/problems-contracts.ts:4:import { problemDifficulties } from '@/lib/problem-catalog'
src/features/problems/api/problems-contracts.ts:6:export const problemDifficultySchema = z.enum(problemDifficulties)
```

- [ ] **Step 2: Replace the import with the Problems domain source**

In `src/features/problems/api/problems-contracts.ts`, replace:

```ts
import { problemDifficulties } from '@/lib/problem-catalog'
```

with:

```ts
import { problemDifficulties } from '../domain'
```

- [ ] **Step 3: Verify no deleted module imports remain**

Run:

```bash
rg -n "@/lib/problem-catalog" src
```

Expected: no output.

- [ ] **Step 4: Run focused type validation when dependencies are installed**

Run:

```bash
npm run typecheck
```

Expected: PASS. If this fails with `vitest: command not found`, `wxt: command not found`, or another missing dependency executable, run:

```bash
npm install
npm run typecheck
```

- [ ] **Step 5: Commit Task 1**

```bash
git add src/features/problems/api/problems-contracts.ts
git commit -m "fix: use problems domain difficulty values"
```

---

### Task 2: Remove Last-Implementation Superpowers Artifacts

**Files:**

- Delete: `docs/superpowers/specs/2026-05-24-tracks-phase-3-2-design.md`
- Delete: `docs/superpowers/specs/2026-05-24-track-form-compact-composer-design.md`
- Delete: `docs/superpowers/plans/2026-05-24-tracks-phase-3-2.md`
- Delete: `docs/superpowers/plans/2026-05-24-track-form-compact-composer.md`

- [ ] **Step 1: Delete the four last-implementation planning files**

Run:

```bash
git rm \
  docs/superpowers/specs/2026-05-24-tracks-phase-3-2-design.md \
  docs/superpowers/specs/2026-05-24-track-form-compact-composer-design.md \
  docs/superpowers/plans/2026-05-24-tracks-phase-3-2.md \
  docs/superpowers/plans/2026-05-24-track-form-compact-composer.md
```

- [ ] **Step 2: Confirm no `docs/superpowers` links target those deleted files**

Run:

```bash
rg -n "tracks-phase-3-2|track-form-compact-composer" docs/superpowers
```

Expected: no output.

- [ ] **Step 3: Commit Task 2**

```bash
git add docs/superpowers
git commit -m "docs: remove last implementation planning artifacts"
```

---

### Task 3: Prune Route And Track Form Test Internals

**Files:**

- Modify: `src/app/dashboard/routes.test.tsx`
- Modify: `src/features/tracks/components/track-form.test.tsx`

- [ ] **Step 1: Remove the route modal layout-class test**

In `src/app/dashboard/routes.test.tsx`, delete the whole test:

```tsx
it('renders track form modals with a scroll-contained form body', async () => {
  renderDashboard('/tracks/new')

  const dialog = await screen.findByRole('dialog', { name: 'New Track' })
  const modalBody = within(dialog).getByRole('region', {
    name: 'Modal content',
  })

  expect(dialog).toHaveClass(
    'max-h-[calc(100vh-5rem)]',
    'sm:max-h-[calc(100vh-2rem)]',
    'overflow-hidden',
  )
  expect(modalBody).toHaveClass('min-h-0', 'overflow-y-auto')
})
```

- [ ] **Step 2: Delete low-value TrackForm visual tests**

In `src/features/tracks/components/track-form.test.tsx`, delete these whole
test blocks by name:

- `constrains long problem titles before form action controls`
- `keeps track form actions in a sticky footer`
- `keeps group and selected problem rows in internal scroll containers`

- [ ] **Step 3: Shrink the compact group-row test to behavior only**

In `src/features/tracks/components/track-form.test.tsx`, keep the test named `renders compact group rows and expands only the selected group title input`, but remove these implementation-detail assertions:

```tsx
expect(within(arraysRow).getByText('Arrays and Hashing')).toHaveClass(
  'text-[length:var(--cp-copy-font-size)]',
)
expect(dynamicRow).toHaveClass('cursor-pointer')
```

Keep the remaining assertions that prove problem counts are visible and only the selected group exposes the title input.

- [ ] **Step 4: Replace the selected problem row visual test**

In `src/features/tracks/components/track-form.test.tsx`, replace the test named `selected group problems render as dense rows with remove after move controls` with:

```tsx
it('shows selected group problems with move and remove controls', async () => {
  mockTrackFormRuntime(createEditResponse())

  renderTrackForm(
    <TrackForm
      mode="edit"
      onCancel={vi.fn()}
      onLoaded={vi.fn()}
      onSaved={vi.fn()}
      trackId="leetcode-75"
    />,
  )

  const selectedProblems = await screen.findByLabelText('Selected problems')
  const selectedGroupProblems = screen.getByRole('region', {
    name: 'Selected group problems',
  })
  const twoSumRow = within(selectedProblems).getByRole('listitem', {
    name: '1. Two Sum',
  })

  expect(within(selectedGroupProblems).getByText('2 selected')).toBeVisible()
  expect(within(twoSumRow).getByText('Two Sum')).toBeVisible()
  expect(
    within(twoSumRow).getByRole('button', { name: 'Move Two Sum up' }),
  ).toBeDisabled()
  expect(
    within(twoSumRow).getByRole('button', { name: 'Move Two Sum down' }),
  ).toBeEnabled()
  expect(
    within(twoSumRow).getByRole('button', { name: 'Remove Two Sum' }),
  ).toBeEnabled()
})
```

- [ ] **Step 5: Shrink the autocomplete test to behavior only**

In `src/features/tracks/components/track-form.test.tsx`, keep the test named `only shows up to four autocomplete results after searching`, but remove all `toHaveClass(...)` assertions from it.

Keep these behavior assertions:

```tsx
expect(
  screen.queryByRole('region', { name: 'Library problem suggestions' }),
).not.toBeInTheDocument()

expect(
  screen.queryByRole('button', { name: 'Add Two Sum' }),
).not.toBeInTheDocument()
expect(screen.getByText('No matching Library problems.')).toBeVisible()

expect(resultRows).toHaveLength(4)
expect(addBinarySearchButton).toBeVisible()
expect(screen.queryByText('Binary Tree Path Sum')).toBeNull()

await user.click(addBinarySearchButton)

expect(searchInput).toHaveValue('')
expect(
  screen.queryByRole('region', { name: 'Library problem suggestions' }),
).not.toBeInTheDocument()
```

- [ ] **Step 6: Delete the unused TrackForm action-order helper**

Verify the helper has no remaining references:

```bash
rg -n "expectActionOrder" src/features/tracks/components/track-form.test.tsx
```

Expected before deletion: exactly one match for the function declaration. Then
delete this helper from `src/features/tracks/components/track-form.test.tsx`:

```tsx
function expectActionOrder(container: HTMLElement, actions: readonly string[]) {
  const buttons = within(container).getAllByRole('button')
  const actionIndexes = actions.map((action) =>
    buttons.findIndex((button) => button.getAttribute('aria-label') === action),
  )

  expect(actionIndexes).not.toContain(-1)
  expect(actionIndexes).toEqual([...actionIndexes].sort((a, b) => a - b))
}
```

- [ ] **Step 7: Run focused route and TrackForm tests**

Run:

```bash
npm run test -- src/app/dashboard/routes.test.tsx src/features/tracks/components/track-form.test.tsx
```

Expected: PASS. If dependencies are missing, run `npm install` once, then rerun the command.

- [ ] **Step 8: Commit Task 3**

```bash
git add src/app/dashboard/routes.test.tsx src/features/tracks/components/track-form.test.tsx
git commit -m "test: prune track form layout assertions"
```

---

### Task 4: Prune Tracks Screen Test Internals

**Files:**

- Modify: `src/features/tracks/components/tracks-screen.test.tsx`

- [ ] **Step 1: Delete long-copy visual class tests**

In `src/features/tracks/components/tracks-screen.test.tsx`, delete these whole
test blocks by name:

- `lets long active track copy wrap before it can crowd header actions`
- `constrains long active group labels inside their buttons`

- [ ] **Step 2: Shrink the multi-group row test**

In `src/features/tracks/components/tracks-screen.test.tsx`, keep the test named `renders active groups as a single horizontally scrollable tab row`, but remove these class assertions:

```tsx
expect(tabList).toHaveClass('overflow-x-auto', 'flex-nowrap')
expect(tabs[0]).toHaveClass('shrink-0')
expect(tabs[0]).toHaveClass('border-primary', 'text-primary')
```

Keep the semantic assertions:

```tsx
expect(tabs).toHaveLength(4)
expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
expect(tabs[0]).toHaveTextContent('1/2')
expect(tabs[1]).toHaveAttribute('aria-selected', 'false')
expect(tabs[1]).toHaveTextContent('0/1')
```

- [ ] **Step 3: Remove summary-copy absence checks**

In `src/features/tracks/components/tracks-screen.test.tsx`, remove both occurrences of:

```tsx
expect(screen.queryByText('Summary only')).not.toBeInTheDocument()
```

- [ ] **Step 4: Remove action-order and icon-only text assertions**

In `src/features/tracks/components/tracks-screen.test.tsx`, delete these assertions and helper calls:

```tsx
expectActionOrder(activeRowActions, [
  { name: 'Clear Active', role: 'button' },
  { name: 'Edit Track', role: 'link' },
  { name: 'Reset Progress', role: 'button' },
  { name: 'Delete Track', role: 'button' },
])

expect(clearActiveButton).not.toHaveTextContent('Clear Active')

expectActionOrder(activeHeaderActions, [
  { name: 'Clear Active', role: 'button' },
  { name: 'Edit Track', role: 'link' },
  { name: 'Reset Progress', role: 'button' },
  { name: 'Delete Track', role: 'button' },
])

expect(setActiveButton).not.toHaveTextContent('Set Active')
expect(editLink).not.toHaveTextContent('Edit Track')
expect(resetButton).not.toHaveTextContent('Reset Progress')
expect(deleteButton).not.toHaveTextContent('Delete Track')
```

Keep the assertions that actions are present and call the expected runtime methods.

- [ ] **Step 5: Delete the unused TracksScreen action-order helper**

Verify the helper has no remaining references:

```bash
rg -n "expectActionOrder" src/features/tracks/components/tracks-screen.test.tsx
```

Expected before deletion: exactly one match for the function declaration. Then
delete this helper:

```tsx
function expectActionOrder(
  container: HTMLElement,
  actions: readonly {
    name: string
    role: 'button' | 'link'
  }[],
) {
  const elements = actions.map((action) =>
    within(container).getByRole(action.role, { name: action.name }),
  )

  for (let index = 0; index < elements.length - 1; index += 1) {
    const current = elements[index]
    const next = elements[index + 1]

    if (!current || !next) {
      throw new Error('Expected contiguous action elements.')
    }

    expect(
      current.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  }
}
```

- [ ] **Step 6: Run focused TracksScreen tests**

Run:

```bash
npm run test -- src/features/tracks/components/tracks-screen.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit Task 4**

```bash
git add src/features/tracks/components/tracks-screen.test.tsx
git commit -m "test: prune tracks screen layout assertions"
```

---

### Task 5: Prune Duplicated Service Tests

**Files:**

- Modify: `src/features/tracks/server/tracks-service.test.ts`
- Modify: `src/features/app-shell/server/app-shell-service.test.ts`

- [ ] **Step 1: Remove the duplicated direct active-track suspended test**

In `src/features/tracks/server/tracks-service.test.ts`, delete the whole test:

```tsx
it('skips suspended active-track rows for direct active-track reads', async () => {
  const handle = await createTestDb({
    now: new Date('2026-01-01T00:00:00.000Z'),
  })

  await addActiveTrackMembership(handle.db, {
    groupId: 'leetcode-75:stack',
    groupTitle: 'Stack',
    problemSlug: 'valid-parentheses',
    groupPosition: 2,
  })
  await suspendProblem(handle.db, 'two-sum')

  const activeTrack = await getActiveTrack(
    handle.db,
    new Date('2026-01-10T12:00:00.000Z'),
  )

  expect(activeTrack?.nextProblem?.slug).toBe('valid-parentheses')
})
```

Keep the previous direct-read test that proves `getActiveTrack` uses the shared workspace algorithm.

- [ ] **Step 2: Fold the app-shell exhausted-state assertion into the ledger test**

In `src/features/app-shell/server/app-shell-service.test.ts`, update the final assertion in `uses the track ledger instead of global practice history for popup progress`.

Replace:

```ts
expect(payloadAfterLedgerCompletion.activeTrack).toMatchObject({
  progress: {
    completedCount: 1,
    totalCount: 1,
    percent: 100,
  },
  nextProblem: null,
})
```

with:

```ts
expect(payloadAfterLedgerCompletion.activeTrack).toMatchObject({
  state: 'exhausted',
  trackId: 'leetcode-75',
  detail: 'No more problems in track.',
  progress: {
    completedCount: 1,
    totalCount: 1,
    percent: 100,
  },
  nextProblem: null,
})
expect(payloadAfterLedgerCompletion.recommendation.problem).toBeNull()
```

- [ ] **Step 3: Delete the now-duplicated app-shell exhausted test**

In `src/features/app-shell/server/app-shell-service.test.ts`, delete the whole test:

```ts
it('marks active track guidance exhausted instead of falling back to queue in popup data', async () => {
  const handle = await createTestDb({
    now: new Date('2026-01-01T00:00:00.000Z'),
  })

  await recordActiveTrackProblemCompletion(handle.db, {
    problemSlug: 'two-sum',
    rating: 'good',
    completedAt: new Date(generatedAt),
  })

  const payload = await getPopupPayload(handle)

  expect(payload.activeTrack).toMatchObject({
    state: 'exhausted',
    trackId: 'leetcode-75',
    detail: 'No more problems in track.',
    nextProblem: null,
  })
  expect(payload.recommendation.problem).toBeNull()
})
```

- [ ] **Step 4: Run focused service tests**

Run:

```bash
npm run test -- src/features/tracks/server/tracks-service.test.ts src/features/app-shell/server/app-shell-service.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 5**

```bash
git add src/features/tracks/server/tracks-service.test.ts src/features/app-shell/server/app-shell-service.test.ts
git commit -m "test: fold duplicate track guidance coverage"
```

---

### Task 6: Final Validation

**Files:**

- No planned source changes.

- [ ] **Step 1: Confirm the cleanup stayed in scope**

Run:

```bash
git diff --stat main...HEAD
```

Expected: deleted superpowers artifacts, one Problems import fix, and test-suite reductions. No Tracks production component refactor should appear.

- [ ] **Step 2: Confirm no forbidden abstraction work was introduced**

Run:

```bash
git diff -U0 main...HEAD -- src | rg -n "^\\+.*(createContext|forwardRef|with[A-Z]|render[A-Z]|\\.Provider|compound)"
```

Expected: no output.

- [ ] **Step 3: Run focused changed suites**

Run:

```bash
npm run test -- \
  src/app/dashboard/routes.test.tsx \
  src/features/tracks/components/track-form.test.tsx \
  src/features/tracks/components/tracks-screen.test.tsx \
  src/features/tracks/server/tracks-service.test.ts \
  src/features/app-shell/server/app-shell-service.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run full project verification**

Run:

```bash
npm run check
npm run format
```

Expected: PASS. If dependencies are missing, run `npm install` once and retry. If the branch already has unrelated failures, record the exact failing command and first failing test or diagnostic.

- [ ] **Step 5: Final status**

Run:

```bash
git status --short
```

Expected: clean working tree after the task commits.

## Self-Review

- Spec coverage: tasks cover the stale import fix, last-implementation docs deletion, brittle route/form/screen test pruning, duplicated service-test pruning, and validation.
- Scope boundary: no production Tracks UI refactor, no shared UI abstraction, no compound component, no HOC, no render-prop work, no schema change.
- Placeholder scan: no placeholder markers are intentionally left for implementation.
