# Track Form Compact Composer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bulky create/edit track modal composition with a scroll-contained compact composer for large tracks.

**Architecture:** Keep the existing track form reducer and runtime contracts. Update `RouteModal` so form modals own their scroll area, then refactor `TrackForm` rendering into compact group rows, one expanded selected group, dense problem rows, and small filtered problem search.

**Tech Stack:** React, TanStack Router route modals, TanStack Query hooks, Vitest, React Testing Library, local UI primitives (`Button`, `IconButton`, `InlineStatus`, `ProblemDifficultyBadge`).

---

## File Structure

- Modify `src/app/dashboard/layout/route-modal.tsx`
  - Owns generic route modal shell, form-modal max height, and internal scroll container.
- Modify `src/app/dashboard/routes.test.tsx`
  - Verifies route modal form variant remains route-backed and scroll-contained.
- Modify `src/features/tracks/components/track-form.tsx`
  - Keeps data submission and reducer usage.
  - Refactors group and problem rendering into compact rows.
  - Adds sticky form actions.
- Modify `src/features/tracks/components/track-form.test.tsx`
  - Verifies compact composer behavior, disabled destructive group removal, problem action order, filtered search, and unchanged payloads.

No schema, runtime API, repository, or service files should change.

---

### Task 1: Scroll-Contained Form Route Modal

**Files:**
- Modify: `src/app/dashboard/routes.test.tsx`
- Modify: `src/app/dashboard/layout/route-modal.tsx`

- [ ] **Step 1: Write the failing route modal scroll test**

Add this test near the existing track modal tests in `src/app/dashboard/routes.test.tsx`:

```tsx
it('renders track form modals with a scroll-contained form body', async () => {
  renderDashboard('/tracks/new')

  const dialog = await screen.findByRole('dialog', { name: 'New Track' })
  const modalBody = within(dialog).getByLabelText('Modal content')

  expect(dialog).toHaveClass('max-h-[calc(100vh-2rem)]', 'overflow-hidden')
  expect(modalBody).toHaveClass('min-h-0', 'overflow-y-auto')
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm run test -- src/app/dashboard/routes.test.tsx -t "scroll-contained form body"
```

Expected: FAIL because `Modal content` does not exist and the dialog does not yet have the max-height classes.

- [ ] **Step 3: Implement the modal shell change**

In `src/app/dashboard/layout/route-modal.tsx`, update the form variant classes.

Change the `Surface` className block to include viewport height for form modals:

```tsx
className={cn(
  'w-full shadow-overlay',
  isFormVariant
    ? 'flex max-h-[calc(100vh-2rem)] max-w-[46rem] flex-col overflow-hidden p-0'
    : 'max-w-lg',
)}
```

Update the dialog node to participate in the flex layout:

```tsx
className={cn(isFormVariant && 'flex min-h-0 flex-col')}
```

Add that `className` to the existing `<div role="dialog">`.

Replace the children wrapper with a labelled scroll container:

```tsx
{children ? (
  <div
    aria-label={isFormVariant ? 'Modal content' : undefined}
    className={cn(
      'text-[length:var(--cp-copy-font-size)] leading-relaxed text-muted-foreground',
      isFormVariant
        ? 'min-h-0 overflow-y-auto px-[var(--cp-panel-padding)] pt-[var(--cp-panel-padding)]'
        : 'mt-4',
    )}
  >
    {children}
  </div>
) : null}
```

- [ ] **Step 4: Run the route modal test to verify it passes**

Run:

```bash
npm run test -- src/app/dashboard/routes.test.tsx -t "scroll-contained form body"
```

Expected: PASS.

- [ ] **Step 5: Run route modal regression tests**

Run:

```bash
npm run test -- src/app/dashboard/routes.test.tsx -t "route modals|tracks/new|trackId/edit"
```

Expected: PASS for route modal close, backdrop, direct-load, and track form route tests.

- [ ] **Step 6: Commit Task 1**

```bash
git add src/app/dashboard/layout/route-modal.tsx src/app/dashboard/routes.test.tsx
git commit -m "fix: contain form modal scrolling"
```

---

### Task 2: Compact Group Rows With One Expanded Selected Group

**Files:**
- Modify: `src/features/tracks/components/track-form.test.tsx`
- Modify: `src/features/tracks/components/track-form.tsx`

- [ ] **Step 1: Write failing group composition tests**

Add these tests to `src/features/tracks/components/track-form.test.tsx` after the create payload test:

```tsx
it('renders compact group rows and expands only the selected group title input', async () => {
  const user = userEvent.setup()
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

  expect(await screen.findByLabelText('Title')).toHaveValue('LeetCode 75')

  const groups = screen.getByLabelText('Groups')
  const arraysRow = within(groups).getByRole('listitem', {
    name: /Arrays and Hashing/i,
  })
  const dynamicRow = within(groups).getByRole('listitem', {
    name: /Dynamic Programming/i,
  })

  expect(within(arraysRow).getByText('2 problems')).toBeVisible()
  expect(within(dynamicRow).getByText('1 problem')).toBeVisible()
  expect(within(arraysRow).getByLabelText('Group title')).toHaveValue(
    'Arrays and Hashing',
  )
  expect(within(dynamicRow).queryByLabelText('Group title')).toBeNull()

  await user.click(
    within(groups).getByRole('button', {
      name: 'Select Dynamic Programming',
    }),
  )

  expect(within(arraysRow).queryByLabelText('Group title')).toBeNull()
  expect(within(dynamicRow).getByLabelText('Group title')).toHaveValue(
    'Dynamic Programming',
  )
})

it('keeps group removal disabled for non-empty groups and the final group', async () => {
  const user = userEvent.setup()
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

  const groups = await screen.findByLabelText('Groups')

  expect(
    within(groups).getByRole('button', { name: 'Remove Arrays and Hashing' }),
  ).toBeDisabled()

  await user.click(screen.getByRole('button', { name: 'New Group' }))
  const emptyGroup = within(groups).getByRole('listitem', { name: /Group 3/i })

  expect(
    within(emptyGroup).getByRole('button', { name: 'Remove Group 3' }),
  ).toBeEnabled()
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
npm run test -- src/features/tracks/components/track-form.test.tsx -t "compact group rows|group removal"
```

Expected: FAIL because all groups currently expose numbered `Group N title` inputs and the add button says `Add group`.

- [ ] **Step 3: Rename the add-group action label**

In `TrackGroupList`, change the add button text and accessible name from `Add group` to `New Group`:

```tsx
<Button
  onClick={() => dispatch({ type: 'add-group' })}
  size="sm"
  type="button"
  variant="outline"
>
  <Plus aria-hidden="true" />
  New Group
</Button>
```

Update existing tests that click `Add group` so they click `New Group`.

- [ ] **Step 4: Replace full group cards with compact rows**

In `TrackGroupList`, replace the `groups.map` card body with this row structure:

```tsx
<div
  aria-label={`${displayTitle}, ${formatProblemCount(group.problemSlugs.length)}`}
  className={cn(
    'grid min-w-0 gap-2 rounded-[var(--cp-control-radius)] border border-border px-2 py-1.5',
    isSelected && 'border-primary bg-muted/45',
  )}
  key={group.key}
  role="listitem"
>
  <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
    <button
      aria-label={`Select ${displayTitle}`}
      aria-pressed={isSelected}
      className="grid min-w-0 justify-items-start gap-0.5 rounded-[var(--cp-control-radius)] px-2 py-1 text-left transition-colors hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      onClick={() => dispatch({ groupKey: group.key, type: 'select-group' })}
      type="button"
    >
      <span className="min-w-0 max-w-full truncate text-[length:var(--cp-control-font-size)] font-bold text-foreground">
        {displayTitle}
      </span>
      <span className="text-[length:var(--cp-badge-font-size)] text-muted-foreground">
        {formatProblemCount(group.problemSlugs.length)}
      </span>
    </button>
    <div className="flex shrink-0 items-center gap-1">
      <IconButton
        disabled={index === 0}
        label={`Move ${displayTitle} up`}
        onClick={() =>
          dispatch({ direction: 'up', groupKey: group.key, type: 'move-group' })
        }
        size="sm"
        tooltip="Move up"
        type="button"
        variant="ghost"
      >
        <ArrowUp aria-hidden="true" />
      </IconButton>
      <IconButton
        disabled={index === groups.length - 1}
        label={`Move ${displayTitle} down`}
        onClick={() =>
          dispatch({
            direction: 'down',
            groupKey: group.key,
            type: 'move-group',
          })
        }
        size="sm"
        tooltip="Move down"
        type="button"
        variant="ghost"
      >
        <ArrowDown aria-hidden="true" />
      </IconButton>
      <IconButton
        disabled={groups.length <= 1 || group.problemSlugs.length > 0}
        label={`Remove ${displayTitle}`}
        onClick={() => dispatch({ groupKey: group.key, type: 'remove-group' })}
        size="sm"
        tooltip="Remove empty group"
        type="button"
        variant="ghost"
      >
        <X aria-hidden="true" />
      </IconButton>
    </div>
  </div>
  {isSelected ? (
    <TrackTextField
      describedBy={showErrors && groupTitleError ? 'track-form-error' : undefined}
      invalid={showErrors && Boolean(groupTitleError)}
      label="Group title"
      name={`track-group-${index + 1}-title`}
      onChange={(title) =>
        dispatch({
          groupKey: group.key,
          title,
          type: 'rename-group',
        })
      }
      required
      value={group.title}
    />
  ) : null}
</div>
```

Add this helper near `getGroupDisplayTitle`:

```tsx
function formatProblemCount(count: number) {
  return `${count} ${count === 1 ? 'problem' : 'problems'}`
}
```

- [ ] **Step 5: Run group tests to verify they pass**

Run:

```bash
npm run test -- src/features/tracks/components/track-form.test.tsx -t "compact group rows|group removal|creates a track|loads existing"
```

Expected: PASS after updating existing label expectations from `Group 1 title` to `Group title` where they target the selected group.

- [ ] **Step 6: Commit Task 2**

```bash
git add src/features/tracks/components/track-form.tsx src/features/tracks/components/track-form.test.tsx
git commit -m "feat: compact track group editor"
```

---

### Task 3: Dense Selected Problem Rows And Small Filtered Search

**Files:**
- Modify: `src/features/tracks/components/track-form.test.tsx`
- Modify: `src/features/tracks/components/track-form.tsx`

- [ ] **Step 1: Add failing problem row and search tests**

Add this helper near the bottom of `track-form.test.tsx`:

```tsx
function expectActionOrder(
  container: HTMLElement,
  actions: readonly { name: string; role: 'button' | 'link' }[],
) {
  const elements = actions.map((action) =>
    within(container).getByRole(action.role, { name: action.name }),
  )

  for (let index = 0; index < elements.length - 1; index += 1) {
    const current = elements[index]
    const next = elements[index + 1]

    if (!current || !next) {
      throw new Error('Expected action elements.')
    }

    expect(
      current.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  }
}
```

Add this test after the duplicate-search test:

```tsx
it('renders selected group problems as dense rows with remove after move controls', async () => {
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
  const twoSumRow = within(selectedProblems).getByRole('listitem', {
    name: /Two Sum/i,
  })

  expect(twoSumRow).toHaveClass('grid-cols-[auto_minmax(0,1fr)_auto]')
  expect(within(twoSumRow).getByText('Two Sum')).toHaveClass('truncate')
  expectActionOrder(twoSumRow, [
    { role: 'button', name: 'Move Two Sum up' },
    { role: 'button', name: 'Move Two Sum down' },
    { role: 'button', name: 'Remove Two Sum' },
  ])
})

it('renders compact search results and excludes problems already in the track', async () => {
  const user = userEvent.setup()
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

  await user.type(await screen.findByLabelText('Search Library problems'), 'two')

  expect(screen.queryByRole('button', { name: 'Add Two Sum' })).toBeNull()
  expect(screen.getByText('No matching Library problems.')).toBeVisible()

  await user.clear(screen.getByLabelText('Search Library problems'))
  await user.type(screen.getByLabelText('Search Library problems'), 'maximum')

  const results = screen.getByLabelText('Library problem results')
  const resultRow = within(results).getByRole('listitem', {
    name: /Maximum Subarray/i,
  })

  expect(resultRow).toHaveClass('grid-cols-[minmax(0,1fr)_auto]')
  expect(within(resultRow).getByRole('button', { name: 'Add Maximum Subarray' }))
    .toBeVisible()
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
npm run test -- src/features/tracks/components/track-form.test.tsx -t "dense rows|compact search"
```

Expected: FAIL because current rows are card-like and the selected problem list has no `Selected problems` label.

- [ ] **Step 3: Make selected problem rows dense**

In `OrderedProblemList`, change the empty state and list markup:

```tsx
if (selectedGroup.problemSlugs.length === 0) {
  return <InlineStatus>No problems in this group.</InlineStatus>
}

return (
  <ol aria-label="Selected problems" className="m-0 grid list-none gap-1 p-0">
    {selectedGroup.problemSlugs.map((problemSlug, index) => {
      const row = problemRowsBySlug.get(problemSlug)
      const title = row?.problem.title ?? problemSlug

      return (
        <li
          aria-label={`${index + 1}. ${title}`}
          className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-[var(--cp-control-radius)] border border-border px-2 py-1.5"
          key={problemSlug}
        >
          <span className="w-6 text-right text-[length:var(--cp-badge-font-size)] font-bold text-muted-foreground tabular-nums">
            {index + 1}
          </span>
          <ProblemSummary row={row} title={title} slug={problemSlug} compact />
          <div className="flex shrink-0 items-center gap-1">
            <IconButton
              disabled={index === 0}
              label={`Move ${title} up`}
              onClick={() =>
                dispatch({
                  direction: 'up',
                  groupKey: selectedGroup.key,
                  problemSlug,
                  type: 'move-problem',
                })
              }
              size="sm"
              tooltip="Move up"
              type="button"
              variant="ghost"
            >
              <ArrowUp aria-hidden="true" />
            </IconButton>
            <IconButton
              disabled={index === selectedGroup.problemSlugs.length - 1}
              label={`Move ${title} down`}
              onClick={() =>
                dispatch({
                  direction: 'down',
                  groupKey: selectedGroup.key,
                  problemSlug,
                  type: 'move-problem',
                })
              }
              size="sm"
              tooltip="Move down"
              type="button"
              variant="ghost"
            >
              <ArrowDown aria-hidden="true" />
            </IconButton>
            <IconButton
              label={`Remove ${title}`}
              onClick={() =>
                dispatch({
                  groupKey: selectedGroup.key,
                  problemSlug,
                  type: 'remove-problem',
                })
              }
              size="sm"
              tooltip="Remove"
              type="button"
              variant="ghost"
            >
              <X aria-hidden="true" />
            </IconButton>
          </div>
        </li>
      )
    })}
  </ol>
)
```

The X remove action stays last after the up/down ordering controls.

- [ ] **Step 4: Add compact `ProblemSummary` support**

Change the `ProblemSummary` signature:

```tsx
function ProblemSummary({
  compact = false,
  row,
  slug,
  title,
}: {
  compact?: boolean
  row: ProblemLibraryRow | undefined
  slug: string
  title: string
}) {
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="min-w-0 max-w-full truncate text-[length:var(--cp-control-font-size)] font-bold text-foreground">
          {title}
        </span>
        <ProblemDifficultyBadge difficulty={row?.problem.difficulty} />
      </div>
      {!compact ? (
        <p className="m-0 mt-1 truncate text-[length:var(--cp-badge-font-size)] text-muted-foreground">
          {slug}
        </p>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 5: Make search results compact rows**

In `ProblemSearchResult`, change the wrapper from a card div to a listitem row:

```tsx
<div
  aria-label={row.problem.title}
  className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-[var(--cp-control-radius)] border border-border px-2 py-1.5"
  role="listitem"
>
  <ProblemSummary
    compact
    row={row}
    slug={row.problem.slug}
    title={row.problem.title}
  />
  <IconButton
    label={`Add ${row.problem.title}`}
    onClick={onAdd}
    size="sm"
    tooltip="Add"
    type="button"
    variant="ghost"
  >
    <Plus aria-hidden="true" />
  </IconButton>
</div>
```

Keep the current duplicate exclusion logic in `SelectedGroupProblems`.

- [ ] **Step 6: Run problem row/search tests**

Run:

```bash
npm run test -- src/features/tracks/components/track-form.test.tsx -t "dense rows|compact search|does not offer"
```

Expected: PASS.

- [ ] **Step 7: Commit Task 3**

```bash
git add src/features/tracks/components/track-form.tsx src/features/tracks/components/track-form.test.tsx
git commit -m "feat: compact track problem membership editor"
```

---

### Task 4: Sticky Form Footer And Final Regression Pass

**Files:**
- Modify: `src/features/tracks/components/track-form.test.tsx`
- Modify: `src/features/tracks/components/track-form.tsx`

- [ ] **Step 1: Add failing sticky footer test**

Add this test before the pending-save test:

```tsx
it('keeps track form actions in a sticky footer', async () => {
  mockTrackFormRuntime(createTrackDefaults())

  renderTrackForm(
    <TrackForm mode="create" onCancel={vi.fn()} onSaved={vi.fn()} />,
  )

  await screen.findByLabelText('Title')
  const actions = screen.getByLabelText('Track form actions')

  expect(actions).toHaveClass('sticky', 'bottom-0')
  expect(within(actions).getByRole('button', { name: 'CANCEL' })).toBeVisible()
  expect(within(actions).getByRole('button', { name: 'SAVE' })).toBeVisible()
})
```

- [ ] **Step 2: Run the sticky footer test to verify it fails**

Run:

```bash
npm run test -- src/features/tracks/components/track-form.test.tsx -t "sticky footer"
```

Expected: FAIL because the footer is not labelled and not sticky.

- [ ] **Step 3: Implement sticky labelled form actions**

In `TrackFormFields`, replace the final action wrapper with:

```tsx
<div
  aria-label="Track form actions"
  className="-mx-[var(--cp-panel-padding)] sticky bottom-0 z-10 mt-1 flex justify-end gap-3 border-t border-border bg-card px-[var(--cp-panel-padding)] py-4"
>
  <Button onClick={onCancel} type="button" variant="ghost">
    CANCEL
  </Button>
  <Button disabled={pending} type="submit">
    {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
    SAVE
  </Button>
</div>
```

- [ ] **Step 4: Run full track form tests**

Run:

```bash
npm run test -- src/features/tracks/components/track-form.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Run route and focused track suites**

Run:

```bash
npm run test -- src/app/dashboard/routes.test.tsx src/features/tracks/components/track-form.test.tsx src/features/tracks/components/tracks-screen.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Run typecheck and lint for touched files**

Run:

```bash
npm run typecheck
npx eslint src/app/dashboard/layout/route-modal.tsx src/app/dashboard/routes.test.tsx src/features/tracks/components/track-form.tsx src/features/tracks/components/track-form.test.tsx
```

Expected: both commands pass.

- [ ] **Step 7: Run full check and record known external status**

Run:

```bash
npm run check
```

Expected in the current workspace: DB check and typecheck pass; lint may still stop on existing `.claude/skill-validation/.../output.ts` parsing errors unless those files are excluded or removed outside this task.

- [ ] **Step 8: Commit Task 4**

```bash
git add src/features/tracks/components/track-form.tsx src/features/tracks/components/track-form.test.tsx
git commit -m "fix: keep track form actions reachable"
```

---

## Self-Review

- Spec coverage: modal scroll is in Task 1; compact metadata/composer is in Tasks 2-4; compact groups and selected-only title editing are in Task 2; dense problem rows and filtered search are in Task 3; sticky actions and final verification are in Task 4.
- Placeholder scan: no placeholder markers or unspecified implementation steps.
- Type consistency: tests and implementation steps use current names from `TrackForm`, `useTrackForm`, `RouteModal`, `TrackFormGroupState`, `ProblemLibraryRow`, and existing local UI primitives.
