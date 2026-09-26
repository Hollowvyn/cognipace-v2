# Topics Phase 3: Library Filtering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Library users find canonical topics by alias and filter direct or descendant membership with Any/All matching.

**Architecture:** The Problems read model supplies direct tags, effective IDs, and alias-bearing canonical options. One pure predicate drives the existing hidden topic filter column. A dedicated topic picker extends the existing toolbar while other facets and global text search retain their current behavior.

**Tech Stack:** React 19, TypeScript, TanStack Table, Vitest, React Testing Library, existing Terra Compact UI primitives.

---

Depends on Phase 2's required `effectiveTopicIds` and `options.topics[].aliases`.
Do not add UI-side graph traversal or silently substitute direct IDs when the
runtime contract is missing the new fields. Read the approved design's complete
filter acceptance table before implementing.

## File Map

| File                                                                                    | Responsibility                                                                       |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Modify `src/features/problems/components/library/problem-library-filtering.ts`          | Filter state, defaults, membership predicate, reset detection.                       |
| Create `src/features/problems/components/library/problem-library-filtering.test.ts`     | Direct/effective Any/All truth table.                                                |
| Modify `src/features/problems/components/library/problem-library-columns.tsx`           | Wire topic-specific filter to the hidden topic column.                               |
| Create `src/features/problems/components/library/problem-library-topic-filter.tsx`      | Topic-only searchable picker, selected IDs, match mode, descendant switch.           |
| Create `src/features/problems/components/library/problem-library-topic-filter.test.tsx` | Alias search and keyboard/focus behavior.                                            |
| Modify `src/features/problems/components/library/problem-library-toolbar.tsx`           | Replace Topics facet only; retain other facets.                                      |
| Modify `src/features/problems/components/library/problem-library-screen.test.tsx`       | User-facing filtering, counts, and selected actions.                                 |
| Modify `src/features/problems/components/library/problem-library-screen.tsx`            | Let the local filter disclosure extend beyond the containing panel without clipping. |
| Inspect `src/features/problems/components/library/use-problem-library-table.ts`         | Existing pagination reset and stable problem IDs.                                    |
| Inspect `src/features/problems/components/library/problem-library-table.tsx`            | Filtered selected rows remain the action source.                                     |
| Modify `docs/product.md`, `docs/architecture.md`, `docs/testing.md`                     | Describe final behavior and smoke procedure.                                         |

## Task 1: Implement One Topic Predicate

- [ ] Add `topicMatchMode: 'any' | 'all'`, `includeSubtopics: boolean`, and
      `topicQuery: string` to `ProblemLibraryFilters`. Defaults are `any`, `true`,
      and `''`. `topicQuery` belongs to picker UI state and never directly filters
      problems. Add these two complete functions to `problem-library-filtering.ts`:

```ts
export type ProblemTopicFilter = Pick<
  ProblemLibraryFilters,
  'topicIds' | 'topicMatchMode' | 'includeSubtopics'
>

export function matchesProblemTopics(
  row: Pick<ProblemLibraryRow, 'topics' | 'effectiveTopicIds'>,
  filter: ProblemTopicFilter,
): boolean {
  if (filter.topicIds.length === 0) return true
  const actual = new Set(
    filter.includeSubtopics
      ? row.effectiveTopicIds
      : row.topics.map((topic) => topic.id),
  )
  return filter.topicMatchMode === 'all'
    ? filter.topicIds.every((id) => actual.has(id))
    : filter.topicIds.some((id) => actual.has(id))
}

export const problemLibraryTopicFilter: FilterFn<ProblemLibraryRow> = (
  row,
  _columnId,
  value: ProblemTopicFilter,
) => matchesProblemTopics(row.original, value)

problemLibraryTopicFilter.autoRemove = (value: ProblemTopicFilter) =>
  value.topicIds.length === 0
```

Only application-owned column state reaches this predicate. Runtime row values
have already passed Zod in Phase 2. Keep all other facets on
`problemLibraryIncludesAnyFilter`.

- [ ] Write this failing truth-table test before the implementation. Import
      `describe`, `expect`, `it` from Vitest and the predicate from the sibling file.

```ts
describe('topic membership', () => {
  it.each([
    {
      direct: ['bst'],
      effective: ['bst', 'binary-tree', 'tree'],
      selected: ['tree'],
      mode: 'any',
      subtopics: true,
      result: true,
    },
    {
      direct: ['bst'],
      effective: ['bst', 'binary-tree', 'tree'],
      selected: ['tree'],
      mode: 'any',
      subtopics: false,
      result: false,
    },
    {
      direct: ['dfs', 'graph'],
      effective: ['dfs', 'graph'],
      selected: ['tree'],
      mode: 'any',
      subtopics: true,
      result: false,
    },
    {
      direct: ['dfs', 'binary-tree'],
      effective: ['dfs', 'binary-tree', 'tree'],
      selected: ['tree', 'dfs'],
      mode: 'all',
      subtopics: true,
      result: true,
    },
    {
      direct: ['binary-tree'],
      effective: ['binary-tree', 'tree'],
      selected: ['tree', 'dfs'],
      mode: 'all',
      subtopics: true,
      result: false,
    },
    {
      direct: ['dfs', 'graph'],
      effective: ['dfs', 'graph'],
      selected: ['tree', 'dfs'],
      mode: 'any',
      subtopics: true,
      result: true,
    },
    {
      direct: ['tree', 'binary-tree'],
      effective: ['tree', 'binary-tree'],
      selected: ['tree'],
      mode: 'any',
      subtopics: true,
      result: true,
    },
  ] as const)('$direct with $selected ($mode/$subtopics)', (example) => {
    const row = {
      topics: example.direct.map((id) => ({ id, label: id, parentTopics: [] })),
      effectiveTopicIds: [...example.effective],
    }
    expect(
      matchesProblemTopics(row, {
        topicIds: [...example.selected],
        topicMatchMode: example.mode,
        includeSubtopics: example.subtopics,
      }),
    ).toBe(example.result)
  })
  it('does not constrain an empty selection', () => {
    expect(
      matchesProblemTopics(
        { topics: [], effectiveTopicIds: [] },
        {
          topicIds: [],
          topicMatchMode: 'all',
          includeSubtopics: false,
        },
      ),
    ).toBe(true)
  })
})
```

- [ ] Run `rtk npx vitest run src/features/problems/components/library/problem-library-filtering.test.ts`
      red then green. Add ancestor-and-child selection with All and an untagged row.
- [ ] Replace the topic `pushArrayColumnFilter` call in
      `createProblemLibraryColumnFilters` with:

```ts
if (filters.topicIds.length > 0) {
  columnFilters.push({
    id: problemLibraryColumnIds.topicIds,
    value: {
      topicIds: filters.topicIds,
      topicMatchMode: filters.topicMatchMode,
      includeSubtopics: filters.includeSubtopics,
    } satisfies ProblemTopicFilter,
  })
}
```

Change only the Topics column's `filterFn` to `problemLibraryTopicFilter`; the
accessor can remain its existing direct-ID accessor because the predicate uses
`row.original`. Add its import. Extend `hasProblemLibraryFilters` with
`filters.topicQuery !== '' || filters.topicMatchMode !== 'any' ||
!filters.includeSubtopics` so Clear Filters remains available after UI-only
changes. These flags alone must not add a column filter.

- [ ] Run the filtering test and existing Library screen tests. Commit
      `feat(library): filter canonical topics with descendants and any-all matching`.

## Task 2: Add A Topic-Specific Searchable Picker

- [ ] Add the new component file. Use a native disclosure button, labeled
      search field, and checkbox group; do not put a search input inside a listbox
      or implement a second generic facet framework. Keep search and selection
      controlled by `ProblemLibraryFilters` so Clear Filters can reset both.
- [ ] Write this component test with a local controlled harness before building
      the component. The new component's interface is defined in the next block.

```tsx
function Harness() {
  const [filters, setFilters] = useState<ProblemLibraryFilters>({
    ...defaultProblemLibraryFilters,
  })
  return (
    <ProblemLibraryTopicFilter
      options={[
        {
          id: 'depth-first-search',
          label: 'Depth-First Search',
          aliases: ['DFS'],
        },
        { id: 'tree', label: 'Tree', aliases: ['Trees'] },
      ]}
      filters={filters}
      onChange={(patch) => setFilters((old) => ({ ...old, ...patch }))}
    />
  )
}

it('finds an alias and selects only the canonical topic', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  await user.click(screen.getByRole('button', { name: /Topics/ }))
  await user.type(
    screen.getByRole('searchbox', { name: 'Search topics' }),
    'DFS',
  )
  const option = screen.getByRole('checkbox', { name: 'Depth-First Search' })
  await user.click(option)
  expect(option).toBeChecked()
  expect(
    screen.queryByRole('checkbox', { name: 'Tree', exact: true }),
  ).toBeNull()
  expect(
    screen.getAllByRole('checkbox', { name: 'Depth-First Search' }),
  ).toHaveLength(1)
  await user.keyboard('{Escape}')
  expect(
    screen.getByRole('button', { name: /Topics: Depth-First Search/ }),
  ).toHaveFocus()
})
```

Imports: React `useState`; Testing Library `render, screen`; user-event;
Vitest `expect, it`; the new component and filter types/defaults. Extend this
test with empty query, slash query, unused option, query changes retaining
selected IDs, and duplicate alias strings yielding one canonical option.

- [ ] Run `rtk npx vitest run src/features/problems/components/library/problem-library-topic-filter.test.tsx`
      and expect the component import failure. Implement the component with this
      complete behavior skeleton, using existing control classes from the toolbar
      and shared `Button` for visual consistency:

```tsx
import { useEffect, useId, useRef, useState } from 'react'
import { normalizeTopicSearchKey } from '../../domain/topic-taxonomy'
import type { ProblemLibraryOptions } from '../../api/problems-contracts'
import type { ProblemLibraryFilters } from './problem-library-filtering'

export function ProblemLibraryTopicFilter({
  options,
  filters,
  onChange,
}: {
  options: ProblemLibraryOptions['topics']
  filters: ProblemLibraryFilters
  onChange: (patch: Partial<ProblemLibraryFilters>) => void
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const panelId = useId()
  const key = normalizeTopicSearchKey(filters.topicQuery)
  const visible = options.filter((option) =>
    [option.label, ...option.aliases].some((label) =>
      normalizeTopicSearchKey(label).includes(key),
    ),
  )
  const selectedNames = options
    .filter((option) => filters.topicIds.includes(option.id))
    .map((option) => option.label)
  const summary =
    selectedNames.length === 0
      ? 'All topics'
      : selectedNames.length === 1
        ? selectedNames[0]
        : `${selectedNames.length} selected`

  useEffect(() => {
    if (!open) return
    search.current?.focus()
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setOpen(false)
      trigger.current?.focus()
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  const toggle = (id: string) =>
    onChange({
      topicIds: filters.topicIds.includes(id)
        ? filters.topicIds.filter((selected) => selected !== id)
        : [...filters.topicIds, id],
    })

  return (
    <div ref={root} className="relative min-w-0">
      <button
        type="button"
        ref={trigger}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
        className="min-h-10 w-full rounded border border-border bg-card px-3 text-left"
      >
        Topics: {summary}
      </button>
      {open && (
        <div
          id={panelId}
          className="absolute left-0 top-full z-30 grid max-h-96 w-full min-w-56 gap-3 overflow-y-auto rounded border border-border bg-popover p-3"
        >
          <label>
            Search topics
            <input
              ref={search}
              type="search"
              value={filters.topicQuery}
              onChange={(event) => onChange({ topicQuery: event.target.value })}
              className="w-full rounded border border-border bg-card px-2 py-1"
            />
          </label>
          <button type="button" onClick={() => onChange({ topicIds: [] })}>
            All topics
          </button>
          <fieldset>
            <legend className="sr-only">Topic choices</legend>
            {visible.map((option) => (
              <label
                key={option.id}
                className="flex min-h-9 items-center gap-2"
              >
                <input
                  type="checkbox"
                  checked={filters.topicIds.includes(option.id)}
                  onChange={() => toggle(option.id)}
                />
                {option.label}
              </label>
            ))}
            {visible.length === 0 && (
              <p role="status">No topics match this search.</p>
            )}
          </fieldset>
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <label>
          Topic matching
          <select
            value={filters.topicMatchMode}
            onChange={(event) =>
              onChange({
                topicMatchMode: event.target.value === 'all' ? 'all' : 'any',
              })
            }
          >
            <option value="any">Match any</option>
            <option value="all">Match all</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={filters.includeSubtopics}
            onChange={(event) =>
              onChange({ includeSubtopics: event.target.checked })
            }
          />{' '}
          Include subtopics
        </label>
      </div>
    </div>
  )
}
```

The mode and descendant controls remain visible when the picker closes. Align
their final spacing, height, and typography with the existing control tokens;
this skeleton is a behavior reference, not a new visual theme. Closing because
of an outside pointer leaves focus at its clicked destination. Escape restores
trigger focus. Normal Tab movement uses native controls without a focus trap.

- [ ] Run the component test; expect pass. Verify visible options use canonical
      IDs as keys and never render alias rows as independently selectable topics.
- [ ] Commit `feat(library): add canonical topic picker with alias search`.

## Task 3: Wire Toolbar Reset And Table Integration

- [ ] Replace the existing Topics `ProblemLibraryFacetFilter` in
      `problem-library-toolbar.tsx` only:

```tsx
<ProblemLibraryTopicFilter
  options={library.options.topics}
  filters={filters}
  onChange={patchFilters}
/>
```

Import the component. Keep companies, tracks, status, and difficulty on the
existing generic facet. Clear Filters continues to pass
`defaultProblemLibraryFilters`; the controlled picker then clears its query,
selected IDs, Any/All mode, and descendant switch together. Closing the outer
filter panel unmounts the disclosure, while filter choices remain in table
state until reset or page unmount.

- [ ] Update the existing screen-test helper only for Topics: select its native
      checkbox by canonical name; all other facets continue using listbox options.
      Reuse `renderProblemLibrary`, `findProblemRow`, and the existing mocked runtime
      response harness. Add a fixture with four problems: DFS+Graph, DFS+Binary Tree,
      BST, and an untagged problem, each with correct Phase 2 effective IDs.

In `problem-library-screen.tsx`, change the populated Library panel from
`className="grid w-full overflow-hidden p-0"` to
`className="grid w-full overflow-visible p-0"`. This keeps the absolute picker
visible even when filtering yields very few rows. Preserve the table's own
horizontal overflow container and the panel's existing border/radius tokens.

```tsx
await user.click(screen.getByRole('button', { name: 'Expand filters' }))
await user.click(screen.getByRole('button', { name: /Topics:/ }))
await user.click(screen.getByRole('checkbox', { name: 'Tree', exact: true }))
await user.click(
  screen.getByRole('checkbox', { name: 'Depth-First Search', exact: true }),
)
await user.selectOptions(screen.getByLabelText('Topic matching'), 'all')
expect(getProblemRow('Tree traversal')).toBeVisible()
expect(queryProblemRow('Graph traversal')).not.toBeInTheDocument()
expect(queryProblemRow('BST lookup')).not.toBeInTheDocument()
await user.click(screen.getByRole('button', { name: 'Clear Filters' }))
expect(getProblemRow('Graph traversal')).toBeVisible()
expect(screen.getByLabelText('Topic matching')).toHaveValue('any')
expect(screen.getByLabelText('Include subtopics')).toBeChecked()
```

- [ ] Add assertions for Tree matching BST by default, direct-only removing it,
      DFS alias query, unused registry topic yielding no results, search text
      without selection not filtering problems, and global Search problems keeping
      its previous semantics. Test combinations with difficulty and suspended/premium
      controls so the topic predicate does not bypass other constraints.
- [ ] Keep `getRowId: row.problem.slug`, pagination reset on filter changes,
      `getFilteredRowModel()` counts, and `getFilteredSelectedRowModel()` action
      inputs. Do not generate one row per matching ancestor. Select several rows,
      filter one away, then verify the bulk-action and create-track callback receive
      only the remaining filtered selected rows. Switching back may restore the
      still-selected row; selection state need not be destructively cleared.
- [ ] Run `rtk npx vitest run src/features/problems/components/library/problem-library-screen.test.tsx
src/features/problems/components/library/problem-library-filtering.test.ts
src/features/problems/components/library/problem-library-topic-filter.test.tsx
src/features/tracks/utils/library-selection-track-draft.test.ts`.
- [ ] Commit `feat(library): integrate topic filters with counts and selected actions`.

## Task 4: Visual Proof, Docs, And Release Gate

- [ ] Update `docs/product.md`: Library supports alias search in the Topics
      picker, descendant inclusion by default, optional direct-only, and Any/All.
      Preserve the statement that there is no topic graph management UI. Update
      `docs/architecture.md` with direct/effective read-model ownership and filter
      semantics; do not claim analytics now uses ancestor evidence.
- [ ] Add the exact acceptance examples from the design to the Library section
      of `docs/testing.md`. Include repeated paths, unused topic, empty selection,
      Clear Filters, keyboard search/selection/Escape, combined facets, and selected
      actions after changing filters.
- [ ] Run focused tests from Task 3, then `rtk npm run db:check`,
      `rtk npm run lint`, `rtk npm run check`, and `rtk npm run build`. Run Prettier
      on touched code and Markdown. Skip `rtk npm run db:generate` in this phase
      because schema changes were completed in Phase 2. Name every failure or
      unavailable command in the handoff.
- [ ] Open the built extension Library and inspect the topic picker at narrow
      and desktop widths. Verify the dropdown is not clipped by the Library surface,
      the longest label fits, the toolbar remains usable, and selected controls are
      visible in both normal and empty-result states. Verify the local
      `overflow-visible` change from Task 3 fixes clipping without altering the
      dashboard shell. Repeat affected component checks after any visual correction.
- [ ] A human runs happy-path and edge-case realtime smoke on the actual
      extension: upgrade populated data, filter Tree, query DFS, Tree AND DFS,
      direct-only, reset, empty results, and backup export/import. Capture screenshots
      or a recording showing the filter controls and resulting rows/counts. Attach
      proof before PR review or merge. Record the upgrade/backup evidence from
      earlier phases rather than falsely treating the UI smoke as a migration test.
- [ ] Commit `docs(topics): document library filtering and validation flows`.

Done when the approved filter table holds through the real Library read path,
topic graph expansion exists only in Problems, all required automated checks
pass, and human smoke evidence is attached. Runtime topic-management mutation
APIs, a new explorer page, analytics changes, and queue/track policy changes
remain outside this release.
