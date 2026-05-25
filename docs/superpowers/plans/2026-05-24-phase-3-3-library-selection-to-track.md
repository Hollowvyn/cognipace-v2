# Phase 3.3 Library Selection To Track Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users select Library rows and create a new Track draft from exactly those selected problems.

**Architecture:** Library keeps table selection local and exposes a selected-row bulk action slot. Tracks owns the tab-local selection draft, grouping rules, Track form initialization, and final create payload. App/dashboard composes the Library modal route and navigation without importing feature internals.

**Tech Stack:** React, TypeScript, TanStack Router, TanStack Query, Vitest, React Testing Library, sessionStorage, existing runtime APIs.

---

## Execution Prep

- Work from `/Users/tobiolutimehin/WebstormProjects/cognipace-v2`.
- Start from latest `main`; create an implementation branch such as `codex/tracks-phase-3-3`.
- Do not touch the local fixture change in `src/platform/db/seed.ts` unless the user explicitly asks.
- Keep `.superpowers/` and `.codex/` out of commits unless the user asks to preserve brainstorming artifacts.

Recommended prep commands:

```bash
git status --short
git switch main
git pull --ff-only origin main
git switch -c codex/tracks-phase-3-3
npm run check
```

Expected before implementation: `npm run check` passes or only reports unrelated pre-existing local fixture issues. If `src/platform/db/seed.ts` is still modified, leave it unstaged.

## File Structure

Create:

- `src/features/tracks/utils/library-selection-track-draft.ts`
  - Owns tab-local draft serialization, validation, expiration, and cleanup.
- `src/features/tracks/utils/library-selection-track-draft.test.ts`
  - Unit tests for draft create/read/clear behavior.
- `src/features/tracks/hooks/track-form-initial-draft.ts`
  - Owns create-mode grouping rules and selected-row draft conversion into form groups.
- `src/features/tracks/hooks/track-form-initial-draft.test.ts`
  - Unit tests for none/difficulty/topic/company grouping.
- `src/features/tracks/components/library-selection-track-form.tsx`
  - Feature component that reads a draft id, loads Library rows, resolves selected rows, and renders `TrackForm`.

Modify:

- `src/features/tracks/hooks/use-track-form.ts`
  - Accept create-mode initial draft options, store `groupBy`, regroup from original rows, and move problems between groups.
- `src/features/tracks/components/track-form.tsx`
  - Add compact `Group by` dropdown for Library-selection drafts and compact group selector on selected problem rows.
- `src/features/tracks/components/track-form.test.tsx`
  - Cover seeded drafts, grouping dropdown, regrouping, move-to-group, and create payload.
- `src/features/tracks/index.ts`
  - Publicly export the draft helper and the Library-selection form component.
- `src/features/problems/components/library/problem-bulk-action-bar.tsx`
  - Accept and render an optional selected-row action.
- `src/features/problems/components/library/problem-library-table.tsx`
  - Thread selected-row action into the bulk action bar.
- `src/features/problems/components/library/problem-library-screen.tsx`
  - Expose selected-row action prop to app composition.
- `src/features/problems/components/library/problem-library-screen.test.tsx`
  - Assert selected-row action receives selected rows in table order.
- `src/app/dashboard/screens/library-page.tsx`
  - Add `Make Track` action that creates a Tracks draft and navigates to the Library modal route.
- `src/app/dashboard/screens/track-modal-pages.tsx`
  - Add a Library-scoped track creation modal page that closes to `/library`.
- `src/app/dashboard/navigation/route-manifest.ts`
  - Add `dashboardPaths.libraryTrackNew` and modal metadata.
- `src/app/dashboard/navigation/routes.tsx`
  - Add `/library/tracks/new` as a Library child modal route.
- `src/app/dashboard/routes.test.tsx`
  - Cover route rendering, closing, missing draft, and Library selection navigation.
- `src/testing/architecture-boundaries.test.ts`
  - No expected changes; run it to verify public-surface imports remain valid.

---

### Task 1: Track Selection Draft Helper

**Files:**
- Create: `src/features/tracks/utils/library-selection-track-draft.ts`
- Create: `src/features/tracks/utils/library-selection-track-draft.test.ts`
- Modify: `src/features/tracks/index.ts`

- [ ] **Step 1: Write failing draft helper tests**

Create `src/features/tracks/utils/library-selection-track-draft.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import {
  clearLibrarySelectionTrackDraft,
  createLibrarySelectionTrackDraft,
  readLibrarySelectionTrackDraft,
} from './library-selection-track-draft'

describe('library selection track draft', () => {
  it('stores and reads selected problem slugs by draft id', () => {
    const storage = new MemoryStorage()
    const draft = createLibrarySelectionTrackDraft(['two-sum', 'two-sum', 'binary-search'], {
      id: 'draft-1',
      now: new Date('2026-05-24T12:00:00.000Z'),
      storage,
    })

    expect(draft).toEqual({
      id: 'draft-1',
      source: 'library-selection',
      problemSlugs: ['two-sum', 'binary-search'],
      createdAt: '2026-05-24T12:00:00.000Z',
    })
    expect(readLibrarySelectionTrackDraft('draft-1', {
      now: new Date('2026-05-24T12:10:00.000Z'),
      storage,
    })).toEqual(draft)
  })

  it('rejects missing, malformed, empty, and expired drafts', () => {
    const storage = new MemoryStorage()

    expect(readLibrarySelectionTrackDraft(null, { storage })).toBeNull()
    expect(readLibrarySelectionTrackDraft('missing', { storage })).toBeNull()

    storage.setItem('cognipace:track-draft:bad-json', '{')
    expect(readLibrarySelectionTrackDraft('bad-json', { storage })).toBeNull()

    storage.setItem(
      'cognipace:track-draft:empty',
      JSON.stringify({
        id: 'empty',
        source: 'library-selection',
        problemSlugs: [],
        createdAt: '2026-05-24T12:00:00.000Z',
      }),
    )
    expect(readLibrarySelectionTrackDraft('empty', { storage })).toBeNull()

    const expired = createLibrarySelectionTrackDraft(['two-sum'], {
      id: 'expired',
      now: new Date('2026-05-24T12:00:00.000Z'),
      storage,
    })
    expect(expired.id).toBe('expired')
    expect(readLibrarySelectionTrackDraft('expired', {
      now: new Date('2026-05-24T13:01:00.000Z'),
      storage,
    })).toBeNull()
  })

  it('clears drafts by id', () => {
    const storage = new MemoryStorage()
    createLibrarySelectionTrackDraft(['two-sum'], {
      id: 'draft-1',
      now: new Date('2026-05-24T12:00:00.000Z'),
      storage,
    })

    clearLibrarySelectionTrackDraft('draft-1', { storage })

    expect(readLibrarySelectionTrackDraft('draft-1', { storage })).toBeNull()
  })
})

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>()

  get length() {
    return this.values.size
  }

  clear() {
    this.values.clear()
  }

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key: string) {
    this.values.delete(key)
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}
```

- [ ] **Step 2: Run the draft helper tests and verify failure**

Run:

```bash
npm run test -- src/features/tracks/utils/library-selection-track-draft.test.ts
```

Expected: FAIL because `library-selection-track-draft.ts` does not exist.

- [ ] **Step 3: Implement the draft helper**

Create `src/features/tracks/utils/library-selection-track-draft.ts`:

```ts
const DRAFT_STORAGE_PREFIX = 'cognipace:track-draft:'
const DRAFT_MAX_AGE_MS = 60 * 60 * 1000

export interface LibrarySelectionTrackDraft {
  createdAt: string
  id: string
  problemSlugs: string[]
  source: 'library-selection'
}

interface DraftStorageOptions {
  id?: string | undefined
  now?: Date | undefined
  storage?: Storage | undefined
}

export function createLibrarySelectionTrackDraft(
  problemSlugs: readonly string[],
  options: DraftStorageOptions = {},
): LibrarySelectionTrackDraft {
  const storage = options.storage ?? globalThis.sessionStorage
  const now = options.now ?? new Date()
  const id = options.id ?? createDraftId()
  const draft: LibrarySelectionTrackDraft = {
    id,
    source: 'library-selection',
    problemSlugs: uniqueProblemSlugs(problemSlugs),
    createdAt: now.toISOString(),
  }

  storage.setItem(getDraftStorageKey(id), JSON.stringify(draft))

  return draft
}

export function readLibrarySelectionTrackDraft(
  id: string | null | undefined,
  options: DraftStorageOptions = {},
) {
  if (!id) {
    return null
  }

  const storage = options.storage ?? globalThis.sessionStorage
  const rawDraft = storage.getItem(getDraftStorageKey(id))

  if (!rawDraft) {
    return null
  }

  try {
    const parsedDraft = JSON.parse(rawDraft) as unknown
    const draft = parseDraft(parsedDraft)

    if (!draft || isExpired(draft, options.now ?? new Date())) {
      storage.removeItem(getDraftStorageKey(id))
      return null
    }

    return draft
  } catch {
    storage.removeItem(getDraftStorageKey(id))
    return null
  }
}

export function clearLibrarySelectionTrackDraft(
  id: string | null | undefined,
  options: Pick<DraftStorageOptions, 'storage'> = {},
) {
  if (!id) {
    return
  }

  const storage = options.storage ?? globalThis.sessionStorage

  storage.removeItem(getDraftStorageKey(id))
}

function parseDraft(value: unknown): LibrarySelectionTrackDraft | null {
  if (!isObject(value)) {
    return null
  }

  const problemSlugs = Array.isArray(value.problemSlugs)
    ? value.problemSlugs.filter((slug): slug is string => typeof slug === 'string')
    : []

  if (
    typeof value.id !== 'string' ||
    value.source !== 'library-selection' ||
    typeof value.createdAt !== 'string' ||
    problemSlugs.length === 0
  ) {
    return null
  }

  return {
    id: value.id,
    source: 'library-selection',
    createdAt: value.createdAt,
    problemSlugs: uniqueProblemSlugs(problemSlugs),
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isExpired(draft: LibrarySelectionTrackDraft, now: Date) {
  const createdAt = Date.parse(draft.createdAt)

  return Number.isNaN(createdAt) || now.getTime() - createdAt > DRAFT_MAX_AGE_MS
}

function uniqueProblemSlugs(problemSlugs: readonly string[]) {
  return [...new Set(problemSlugs.filter((slug) => slug.trim().length > 0))]
}

function createDraftId() {
  return globalThis.crypto?.randomUUID() ?? `draft-${Date.now()}`
}

function getDraftStorageKey(id: string) {
  return `${DRAFT_STORAGE_PREFIX}${id}`
}
```

Modify `src/features/tracks/index.ts`:

```ts
export {
  clearLibrarySelectionTrackDraft,
  createLibrarySelectionTrackDraft,
  readLibrarySelectionTrackDraft,
  type LibrarySelectionTrackDraft,
} from './utils/library-selection-track-draft'
```

- [ ] **Step 4: Run the draft helper tests and verify pass**

Run:

```bash
npm run test -- src/features/tracks/utils/library-selection-track-draft.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

```bash
git add src/features/tracks/utils/library-selection-track-draft.ts src/features/tracks/utils/library-selection-track-draft.test.ts src/features/tracks/index.ts
git commit -m "feat: add library selection track drafts"
```

---

### Task 2: Track Form Initial Draft Grouping

**Files:**
- Create: `src/features/tracks/hooks/track-form-initial-draft.ts`
- Create: `src/features/tracks/hooks/track-form-initial-draft.test.ts`
- Modify: `src/features/tracks/hooks/use-track-form.ts`

- [ ] **Step 1: Write failing grouping tests**

Create `src/features/tracks/hooks/track-form-initial-draft.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { createSerializedProblem } from '@/testing/problem-fixtures'
import { createTrackProblemRow } from '@/testing/track-fixtures'

import {
  createGroupsFromInitialDraftRows,
  trackFormGroupByOptions,
} from './track-form-initial-draft'

describe('track form initial draft grouping', () => {
  it('creates one Main group for none grouping', () => {
    expect(
      createGroupsFromInitialDraftRows(
        [
          row('two-sum', 'Two Sum'),
          row('binary-search', 'Binary Search'),
        ],
        'none',
      ),
    ).toEqual([
      {
        key: 'draft-group-1',
        title: 'Main',
        problemSlugs: ['two-sum', 'binary-search'],
      },
    ])
  })

  it('groups by difficulty in product order', () => {
    expect(
      createGroupsFromInitialDraftRows(
        [
          row('medium-one', 'Medium One', { difficulty: 'medium' }),
          row('easy-one', 'Easy One', { difficulty: 'easy' }),
          row('hard-one', 'Hard One', { difficulty: 'hard' }),
        ],
        'difficulty',
      ),
    ).toEqual([
      { key: 'draft-group-1', title: 'Easy', problemSlugs: ['easy-one'] },
      { key: 'draft-group-2', title: 'Medium', problemSlugs: ['medium-one'] },
      { key: 'draft-group-3', title: 'Hard', problemSlugs: ['hard-one'] },
    ])
  })

  it('groups by first topic and first company with fallback groups', () => {
    const rows = [
      row('two-sum', 'Two Sum', {
        topics: [
          { id: 'arrays', label: 'Arrays' },
          { id: 'hash-map', label: 'Hash Maps' },
        ],
        companies: [
          { id: 'meta', label: 'Meta' },
          { id: 'netflix', label: 'Netflix' },
        ],
      }),
      row('binary-search', 'Binary Search', {
        topics: [{ id: 'search', label: 'Search' }],
        companies: [],
      }),
      row('orphan', 'Orphan', {
        topics: [],
        companies: [],
      }),
    ]

    expect(createGroupsFromInitialDraftRows(rows, 'topic')).toEqual([
      { key: 'draft-group-1', title: 'Arrays', problemSlugs: ['two-sum'] },
      { key: 'draft-group-2', title: 'Search', problemSlugs: ['binary-search'] },
      { key: 'draft-group-3', title: 'No topic', problemSlugs: ['orphan'] },
    ])
    expect(createGroupsFromInitialDraftRows(rows, 'company')).toEqual([
      { key: 'draft-group-1', title: 'Meta', problemSlugs: ['two-sum'] },
      { key: 'draft-group-2', title: 'No company', problemSlugs: ['binary-search', 'orphan'] },
    ])
  })

  it('exposes compact dropdown options', () => {
    expect(trackFormGroupByOptions).toEqual([
      { label: 'None', value: 'none' },
      { label: 'Difficulty', value: 'difficulty' },
      { label: 'Topic', value: 'topic' },
      { label: 'Company', value: 'company' },
    ])
  })
})

function row(
  slug: string,
  title: string,
  overrides: {
    companies?: ReturnType<typeof createTrackProblemRow>['companies']
    difficulty?: 'easy' | 'medium' | 'hard'
    topics?: ReturnType<typeof createTrackProblemRow>['topics']
  } = {},
) {
  return createTrackProblemRow({
    problem: createSerializedProblem({
      difficulty: overrides.difficulty ?? 'easy',
      slug,
      title,
    }),
    companies: overrides.companies ?? [],
    topics: overrides.topics ?? [],
  })
}
```

- [ ] **Step 2: Run grouping tests and verify failure**

Run:

```bash
npm run test -- src/features/tracks/hooks/track-form-initial-draft.test.ts
```

Expected: FAIL because `track-form-initial-draft.ts` does not exist.

- [ ] **Step 3: Implement grouping helper**

Create `src/features/tracks/hooks/track-form-initial-draft.ts`:

```ts
import type { ProblemLibraryRow } from '@/features/problems'

import type { TrackFormGroupState } from './use-track-form'

export type TrackFormGroupBy = 'none' | 'difficulty' | 'topic' | 'company'

export const trackFormGroupByOptions = [
  { label: 'None', value: 'none' },
  { label: 'Difficulty', value: 'difficulty' },
  { label: 'Topic', value: 'topic' },
  { label: 'Company', value: 'company' },
] as const satisfies readonly Array<{ label: string; value: TrackFormGroupBy }>

export interface TrackFormInitialDraft {
  problemRows: readonly ProblemLibraryRow[]
  selectedCount: number
  source: 'library-selection'
}

export function createGroupsFromInitialDraftRows(
  problemRows: readonly ProblemLibraryRow[],
  groupBy: TrackFormGroupBy,
): TrackFormGroupState[] {
  if (groupBy === 'none') {
    return [
      {
        key: 'draft-group-1',
        title: 'Main',
        problemSlugs: problemRows.map((row) => row.problem.slug),
      },
    ]
  }

  if (groupBy === 'difficulty') {
    return createDifficultyGroups(problemRows)
  }

  return createMetadataGroups(problemRows, groupBy)
}

function createDifficultyGroups(problemRows: readonly ProblemLibraryRow[]) {
  const difficultyTitles = {
    easy: 'Easy',
    medium: 'Medium',
    hard: 'Hard',
  } as const
  const groups = new Map<string, string[]>()

  for (const difficultyTitle of Object.values(difficultyTitles)) {
    groups.set(difficultyTitle, [])
  }

  for (const row of problemRows) {
    const title = difficultyTitles[row.problem.difficulty] ?? 'Unknown'
    groups.set(title, [...(groups.get(title) ?? []), row.problem.slug])
  }

  return mapGroupsToState(groups)
}

function createMetadataGroups(
  problemRows: readonly ProblemLibraryRow[],
  groupBy: 'topic' | 'company',
) {
  const fallbackTitle = groupBy === 'topic' ? 'No topic' : 'No company'
  const groups = new Map<string, string[]>()

  for (const row of problemRows) {
    const metadata =
      groupBy === 'topic' ? row.topics[0]?.label : row.companies[0]?.label
    const title = metadata ?? fallbackTitle

    groups.set(title, [...(groups.get(title) ?? []), row.problem.slug])
  }

  return mapGroupsToState(groups)
}

function mapGroupsToState(groups: ReadonlyMap<string, readonly string[]>) {
  return [...groups.entries()]
    .filter(([, problemSlugs]) => problemSlugs.length > 0)
    .map(([title, problemSlugs], index) => ({
      key: `draft-group-${index + 1}`,
      title,
      problemSlugs: [...problemSlugs],
    }))
}
```

- [ ] **Step 4: Modify `useTrackForm` to accept initial drafts**

In `src/features/tracks/hooks/use-track-form.ts`, import the helper:

```ts
import {
  createGroupsFromInitialDraftRows,
  type TrackFormGroupBy,
  type TrackFormInitialDraft,
} from './track-form-initial-draft'
```

Change state and actions:

```ts
export type TrackFormAction =
  | { type: 'set-title'; title: string }
  | { type: 'set-description'; description: string }
  | { type: 'set-due-at'; dueAt: string }
  | { type: 'set-active-after-create'; checked: boolean }
  | { type: 'set-group-by'; groupBy: TrackFormGroupBy; problemRows: readonly ProblemLibraryRow[] }
  | { type: 'add-group' }
  | { type: 'rename-group'; groupKey: string; title: string }
  | { type: 'remove-group'; groupKey: string }
  | { type: 'move-group'; groupKey: string; direction: 'up' | 'down' }
  | { type: 'select-group'; groupKey: string }
  | { type: 'add-problem'; groupKey: string; problemSlug: string }
  | { type: 'remove-problem'; groupKey: string; problemSlug: string }
  | { type: 'move-problem-to-group'; fromGroupKey: string; toGroupKey: string; problemSlug: string }
  | {
      type: 'move-problem'
      groupKey: string
      problemSlug: string
      direction: 'up' | 'down'
    }
```

Add to `TrackFormState`:

```ts
groupBy: TrackFormGroupBy
```

Change the hook signature:

```ts
interface UseTrackFormOptions {
  initialDraft?: TrackFormInitialDraft | undefined
}

interface InitialTrackFormStateInput {
  initialDraft?: TrackFormInitialDraft | undefined
  source: TrackForEditResponse
}

export function useTrackForm(
  source: TrackForEditResponse,
  options: UseTrackFormOptions = {},
) {
  const [state, dispatch] = useReducer(
    trackFormReducer,
    { source, initialDraft: options.initialDraft },
    createInitialTrackFormState,
  )
  // keep existing return body
}
```

Add reducer cases:

```ts
case 'set-group-by': {
  const groups = createGroupsFromInitialDraftRows(action.problemRows, action.groupBy)
  const firstGroup = groups[0] ?? createFallbackMainGroup()

  return {
    ...state,
    groupBy: action.groupBy,
    groups,
    nextGroupNumber: groups.length + 1,
    selectedGroupKey: firstGroup.key,
  }
}
case 'move-problem-to-group': {
  if (action.fromGroupKey === action.toGroupKey) {
    return state
  }

  const targetGroupExists = state.groups.some(
    (group) => group.key === action.toGroupKey,
  )

  if (!targetGroupExists) {
    return state
  }

  return {
    ...state,
    groups: state.groups.map((group) => {
      if (group.key === action.fromGroupKey) {
        return {
          ...group,
          problemSlugs: group.problemSlugs.filter(
            (problemSlug) => problemSlug !== action.problemSlug,
          ),
        }
      }

      if (group.key === action.toGroupKey) {
        return {
          ...group,
          problemSlugs: group.problemSlugs.includes(action.problemSlug)
            ? group.problemSlugs
            : [...group.problemSlugs, action.problemSlug],
        }
      }

      return group
    }),
  }
}
```

Change `createInitialTrackFormState`:

```ts
function createInitialTrackFormState({
  initialDraft,
  source,
}: InitialTrackFormStateInput): TrackFormState {
  const groups = createInitialGroups(source, initialDraft)
  const firstGroup = groups[0] ?? createFallbackMainGroup()

  return {
    description: source.track?.description ?? '',
    dueAt: toDateInputValue(source.track?.dueAt ?? null),
    groupBy: 'none',
    groups,
    nextGroupNumber: groups.length + 1,
    selectedGroupKey: firstGroup.key,
    setActiveAfterCreate: false,
    title: source.track?.title ?? '',
  }
}

function createInitialGroups(
  source: TrackForEditResponse,
  initialDraft?: TrackFormInitialDraft | undefined,
) {
  if (!source.track && initialDraft && initialDraft.problemRows.length > 0) {
    return createGroupsFromInitialDraftRows(initialDraft.problemRows, 'none')
  }

  // keep existing sorted group logic
}
```

Add the missing import:

```ts
import type { ProblemLibraryRow } from '@/features/problems'
```

- [ ] **Step 5: Run grouping tests and typecheck**

Run:

```bash
npm run test -- src/features/tracks/hooks/track-form-initial-draft.test.ts
npm run typecheck
```

Expected: tests PASS and typecheck PASS.

- [ ] **Step 6: Commit Task 2**

```bash
git add src/features/tracks/hooks/track-form-initial-draft.ts src/features/tracks/hooks/track-form-initial-draft.test.ts src/features/tracks/hooks/use-track-form.ts
git commit -m "feat: seed track forms from library selections"
```

---

### Task 3: Track Form UI For Group By And Move-To-Group

**Files:**
- Modify: `src/features/tracks/components/track-form.tsx`
- Modify: `src/features/tracks/components/track-form.test.tsx`

- [ ] **Step 1: Write failing TrackForm tests for Library selection drafts**

Add tests to `src/features/tracks/components/track-form.test.tsx`:

```ts
it('seeds create mode from selected Library rows and shows compact group by dropdown', async () => {
  const user = userEvent.setup()
  mockTrackFormRuntime(createTrackDefaultsWithSelectionRows())

  renderTrackForm(
    <TrackForm
      initialDraft={{
        source: 'library-selection',
        selectedCount: 3,
        problemRows: createSelectedProblemRows(),
      }}
      mode="create"
      onCancel={vi.fn()}
      onSaved={vi.fn()}
    />,
  )

  expect(await screen.findByText('3 selected Library problems')).toBeVisible()
  expect(screen.getByLabelText('Group by')).toHaveValue('none')
  expect(screen.getByLabelText('Target date')).toBeVisible()
  expect(screen.getByLabelText('Group title')).toHaveValue('Main')
  expect(screen.getByRole('listitem', { name: '1. Two Sum' })).toBeVisible()
  expect(screen.getByRole('listitem', { name: '2. Group Anagrams' })).toBeVisible()
  expect(screen.getByRole('listitem', { name: '3. 01 Matrix' })).toBeVisible()

  await user.type(screen.getByLabelText('Title'), 'Netflix Prep')
  await user.click(screen.getByRole('button', { name: 'SAVE' }))

  await waitFor(() => {
    expect(sendMessage).toHaveBeenCalledWith('tracks.createTrack', {
      surface: 'dashboard',
      title: 'Netflix Prep',
      description: null,
      dueAt: null,
      groups: [
        {
          title: 'Main',
          problemSlugs: ['two-sum', 'group-anagrams', '01-matrix'],
        },
      ],
    } satisfies TracksCreateTrackRequest)
  })
})

it('regroups selected Library rows and moves a problem with the compact group selector', async () => {
  const user = userEvent.setup()
  mockTrackFormRuntime(createTrackDefaultsWithSelectionRows())

  renderTrackForm(
    <TrackForm
      initialDraft={{
        source: 'library-selection',
        selectedCount: 3,
        problemRows: createSelectedProblemRows(),
      }}
      mode="create"
      onCancel={vi.fn()}
      onSaved={vi.fn()}
    />,
  )

  await screen.findByLabelText('Group by')
  await user.selectOptions(screen.getByLabelText('Group by'), 'topic')

  expect(screen.getByRole('button', { name: 'Select Arrays' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Select Hash Maps' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Select No topic' })).toBeVisible()
  expect(screen.getByRole('listitem', { name: '1. Two Sum' })).toBeVisible()

  await user.selectOptions(
    screen.getByLabelText('Group for Two Sum'),
    'draft-group-2',
  )

  await user.click(screen.getByRole('button', { name: 'Select Hash Maps' }))

  expect(screen.getByRole('listitem', { name: '2. Two Sum' })).toBeVisible()

  await user.selectOptions(screen.getByLabelText('Group by'), 'company')
  expect(screen.getByRole('button', { name: 'Select Meta' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Select No company' })).toBeVisible()
})
```

Add helpers near the existing helpers:

```ts
function createTrackDefaultsWithSelectionRows() {
  return createTrackForEditResponse({
    track: null,
    groups: [],
    problemRows: createSelectedProblemRows(),
  })
}

function createSelectedProblemRows() {
  return [
    problemRowWithMetadata('two-sum', 'Two Sum', {
      topics: [{ id: 'arrays', label: 'Arrays' }],
      companies: [{ id: 'meta', label: 'Meta' }],
    }),
    problemRowWithMetadata('group-anagrams', 'Group Anagrams', {
      difficulty: 'medium',
      topics: [{ id: 'hash-maps', label: 'Hash Maps' }],
      companies: [{ id: 'meta', label: 'Meta' }],
    }),
    problemRowWithMetadata('01-matrix', '01 Matrix', {
      difficulty: 'medium',
      topics: [],
      companies: [],
    }),
  ]
}

function problemRowWithMetadata(
  slug: string,
  title: string,
  overrides: {
    companies?: ReturnType<typeof createTrackProblemRow>['companies']
    difficulty?: ProblemDifficulty
    topics?: ReturnType<typeof createTrackProblemRow>['topics']
  } = {},
) {
  return createTrackProblemRow({
    problem: createSerializedProblem({
      difficulty: overrides.difficulty ?? 'easy',
      slug,
      title,
    }),
    companies: overrides.companies ?? [],
    topics: overrides.topics ?? [],
  })
}
```

- [ ] **Step 2: Run TrackForm tests and verify failure**

Run:

```bash
npm run test -- src/features/tracks/components/track-form.test.tsx
```

Expected: FAIL because `TrackForm` has no `initialDraft` prop and no `Group by` dropdown.

- [ ] **Step 3: Implement the TrackForm UI**

In `src/features/tracks/components/track-form.tsx`, import the grouping types:

```ts
import {
  trackFormGroupByOptions,
  type TrackFormInitialDraft,
} from '../hooks/track-form-initial-draft'
```

Extend create props:

```ts
type TrackFormProps =
  | {
      initialDraft?: TrackFormInitialDraft | undefined
      mode: 'create'
      onCancel: () => void
      onSaved: () => void
    }
  | {
      mode: 'edit'
      onCancel: () => void
      onLoaded?: ((track: SerializedTrack) => void) | undefined
      onSaved: () => void
      trackId: string
    }
```

Pass `initialDraft` into `TrackFormFields`:

```tsx
<TrackFormFields
  initialDraft={props.mode === 'create' ? props.initialDraft : undefined}
  key={editQuery.data.track?.id ?? props.mode}
  mode={props.mode}
  onCancel={props.onCancel}
  onSaved={props.onSaved}
  source={editQuery.data}
  trackId={trackId}
/>
```

In `TrackFormFields`, call the hook with options:

```ts
const { canSubmit, dispatch, fieldErrors, payload, selectedGroup, state } =
  useTrackForm(source, { initialDraft })
const shouldShowGroupBy = mode === 'create' && Boolean(initialDraft)
const availableProblemRows = useMemo(
  () => mergeProblemRows(source.problemRows, initialDraft?.problemRows ?? []),
  [initialDraft?.problemRows, source.problemRows],
)
```

Add selected count and metadata row:

```tsx
{initialDraft ? (
  <InlineStatus>{initialDraft.selectedCount} selected Library problems</InlineStatus>
) : null}

<div className={cn('grid gap-4', shouldShowGroupBy && 'md:grid-cols-2')}>
  <TrackTextField
    label="Target date"
    name="track-due-at"
    onChange={(dueAt) => dispatch({ type: 'set-due-at', dueAt })}
    type="date"
    value={state.dueAt}
  />
  {shouldShowGroupBy ? (
    <TrackSelectField
      label="Group by"
      name="track-group-by"
      onChange={(groupBy) =>
        dispatch({
          groupBy,
          problemRows: initialDraft.problemRows,
          type: 'set-group-by',
        })
      }
      options={trackFormGroupByOptions}
      value={state.groupBy}
    />
  ) : null}
</div>
```

Add `TrackSelectField` near `TrackTextField`:

```tsx
function TrackSelectField<TValue extends string>({
  label,
  name,
  onChange,
  options,
  value,
}: {
  label: string
  name: string
  onChange: (value: TValue) => void
  options: readonly Array<{ label: string; value: TValue }>
  value: TValue
}) {
  return (
    <label className="relative block pt-2">
      <span className={floatingLabelClassName}>{label}</span>
      <select
        className={fieldClassName}
        name={name}
        onChange={(event) => onChange(event.target.value as TValue)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
```

Thread all groups into selected problem rows:

```tsx
<SelectedGroupProblems
  dispatch={dispatch}
  groups={state.groups}
  problemRowsBySlug={problemRowsBySlug}
  selectedGroup={selectedGroup}
/>
```

Build `problemRowsBySlug` and search rows from `availableProblemRows`, not only
`source.problemRows`, so selected rows display by title even when the mocked
track edit source does not include every selected row:

```ts
const problemRowsBySlug = useMemo(
  () =>
    new Map(
      availableProblemRows.map((row) => [row.problem.slug, row] as const),
    ),
  [availableProblemRows],
)
```

Pass `availableProblemRows` into `TrackProblemSearch`:

```tsx
<TrackProblemSearch
  dispatch={dispatch}
  groups={state.groups}
  problemRows={availableProblemRows}
  searchQuery={searchQuery}
  selectedGroup={selectedGroup}
  setSearchQuery={setSearchQuery}
/>
```

Add a local merge helper:

```ts
function mergeProblemRows(
  sourceRows: readonly ProblemLibraryRow[],
  draftRows: readonly ProblemLibraryRow[],
) {
  const rowsBySlug = new Map<string, ProblemLibraryRow>()

  for (const row of [...sourceRows, ...draftRows]) {
    rowsBySlug.set(row.problem.slug, row)
  }

  return [...rowsBySlug.values()]
}
```

Update `OrderedProblemList` row action area to include compact group selector before move buttons:

```tsx
<select
  aria-label={`Group for ${title}`}
  className="h-8 max-w-36 rounded-[var(--cp-control-radius)] border border-border bg-background px-2 text-[length:var(--cp-badge-font-size)] text-foreground"
  onChange={(event) =>
    dispatch({
      fromGroupKey: selectedGroup.key,
      problemSlug,
      toGroupKey: event.target.value,
      type: 'move-problem-to-group',
    })
  }
  value={selectedGroup.key}
>
  {groups.map((group) => (
    <option key={group.key} value={group.key}>
      {group.title.trim() || 'Untitled group'}
    </option>
  ))}
</select>
```

Use this row grid:

```tsx
className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-[var(--cp-control-radius)] border border-border bg-background/30 px-3 py-2"
```

Keep the action order: group select, move up, move down, remove.

- [ ] **Step 4: Run TrackForm tests and verify pass**

Run:

```bash
npm run test -- src/features/tracks/components/track-form.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

```bash
git add src/features/tracks/components/track-form.tsx src/features/tracks/components/track-form.test.tsx
git commit -m "feat: add grouped library track drafts to form"
```

---

### Task 4: Library Bulk Action Slot

**Files:**
- Modify: `src/features/problems/components/library/problem-bulk-action-bar.tsx`
- Modify: `src/features/problems/components/library/problem-library-table.tsx`
- Modify: `src/features/problems/components/library/problem-library-screen.tsx`
- Modify: `src/features/problems/components/library/problem-library-screen.test.tsx`

- [ ] **Step 1: Write failing Library selected-action test**

In `src/features/problems/components/library/problem-library-screen.test.tsx`, add:

```ts
it('renders a selected-row action with selected rows in table order', async () => {
  const user = userEvent.setup()
  const onMakeTrack = vi.fn()
  vi.mocked(sendMessage).mockResolvedValueOnce(libraryResponse)
  renderProblemLibrary({
    renderSelectedRowsAction: (selectedRows) => (
      <Button
        onClick={() => onMakeTrack(selectedRows.map((row) => row.problem.slug))}
        size="sm"
        type="button"
        variant="outline"
      >
        Make Track
      </Button>
    ),
  })

  await user.click(await screen.findByRole('checkbox', { name: 'Select Two Sum' }))
  await user.click(screen.getByRole('checkbox', { name: 'Select Binary Search' }))

  const bulkBar = screen.getByRole('region', { name: 'Bulk actions' })

  await user.click(within(bulkBar).getByRole('button', { name: 'Make Track' }))

  expect(onMakeTrack).toHaveBeenCalledWith(['two-sum', 'binary-search'])
})
```

Change the helper signature:

```ts
function renderProblemLibrary(
  props: Partial<Parameters<typeof ProblemLibraryScreen>[0]> = {},
) {
  const { wrapper } = createQueryTestHarness()

  return render(
    <ProblemLibraryScreen
      newProblemAction={/* keep existing action */}
      renderEditProblemAction={/* keep existing action */}
      {...props}
    />,
    { wrapper },
  )
}
```

- [ ] **Step 2: Run Library screen tests and verify failure**

Run:

```bash
npm run test -- src/features/problems/components/library/problem-library-screen.test.tsx
```

Expected: FAIL because `ProblemLibraryScreen` does not accept `renderSelectedRowsAction`.

- [ ] **Step 3: Implement the selected-row action slot**

In `src/features/problems/components/library/problem-bulk-action-bar.tsx`, import `ReactNode`:

```ts
import { useMemo, useState, type ReactNode } from 'react'
```

Add prop:

```ts
renderSelectedRowsAction?: ((selectedRows: readonly ProblemLibraryRow[]) => ReactNode) | undefined
```

Render after selected count:

```tsx
{renderSelectedRowsAction ? renderSelectedRowsAction(selectedRows) : null}
```

In `src/features/problems/components/library/problem-library-table.tsx`, add the same prop:

```ts
renderSelectedRowsAction?: ((selectedRows: readonly ProblemLibraryRow[]) => ReactNode) | undefined
```

Pass it into `ProblemBulkActionBar`:

```tsx
<ProblemBulkActionBar
  onClearSelection={() => table.resetRowSelection()}
  options={options}
  renderSelectedRowsAction={renderSelectedRowsAction}
  selectedRows={selectedRows}
/>
```

In `src/features/problems/components/library/problem-library-screen.tsx`, add the prop and pass it into `ProblemLibraryTable`.

- [ ] **Step 4: Run Library screen tests and verify pass**

Run:

```bash
npm run test -- src/features/problems/components/library/problem-library-screen.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit Task 4**

```bash
git add src/features/problems/components/library/problem-bulk-action-bar.tsx src/features/problems/components/library/problem-library-table.tsx src/features/problems/components/library/problem-library-screen.tsx src/features/problems/components/library/problem-library-screen.test.tsx
git commit -m "feat: expose library selected row actions"
```

---

### Task 5: Library-Scoped Track Modal Route

**Files:**
- Create: `src/features/tracks/components/library-selection-track-form.tsx`
- Modify: `src/features/tracks/index.ts`
- Modify: `src/app/dashboard/screens/track-modal-pages.tsx`
- Modify: `src/app/dashboard/navigation/route-manifest.ts`
- Modify: `src/app/dashboard/navigation/routes.tsx`
- Modify: `src/app/dashboard/routes.test.tsx`

- [ ] **Step 1: Write failing route tests**

In `src/app/dashboard/routes.test.tsx`, add `sessionStorage.clear()` to `afterEach`:

```ts
sessionStorage.clear()
```

Add the direct-route missing-draft test:

```ts
it('/library/tracks/new without a valid draft shows a recoverable modal state', async () => {
  renderDashboard('/library/tracks/new?draft=missing')

  expect(await screen.findByRole('heading', { name: 'Library' })).toBeVisible()
  const dialog = screen.getByRole('dialog', { name: 'New Track' })

  expect(within(dialog).getByRole('alert')).toHaveTextContent(
    'Track selection draft was not found.',
  )
  expect(within(dialog).getByRole('button', { name: 'Return to Library' })).toBeVisible()
})
```

Update existing route arrays:

```ts
['/library/tracks/new?draft=missing', 'Library', /New Track/i, null],
```

and:

```ts
['/library/tracks/new?draft=missing', '/library'],
```

Update modal metadata assertions:

```ts
expect(dashboardModalRouteMeta.libraryTrackNew.staticData.presentation).toBe('modal')
expect(dashboardModalRouteMeta.libraryTrackNew.description).not.toMatch(/later phase/i)
```

- [ ] **Step 2: Run dashboard route tests and verify failure**

Run:

```bash
npm run test -- src/app/dashboard/routes.test.tsx
```

Expected: FAIL because `/library/tracks/new` is not defined.

- [ ] **Step 3: Implement the Library selection Track form component**

Create `src/features/tracks/components/library-selection-track-form.tsx`:

```tsx
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { InlineStatus } from '@/components/ui/inline-status'
import { useProblemLibrary } from '@/features/problems'

import {
  clearLibrarySelectionTrackDraft,
  readLibrarySelectionTrackDraft,
} from '../utils/library-selection-track-draft'
import { TrackForm } from './track-form'

export function LibrarySelectionTrackForm({
  draftId,
  onCancel,
  onSaved,
}: {
  draftId: string | null | undefined
  onCancel: () => void
  onSaved: () => void
}) {
  const libraryQuery = useProblemLibrary({ surface: 'dashboard' })
  const draft = readLibrarySelectionTrackDraft(draftId)

  if (!draft) {
    return (
      <RecoverableDraftError
        message="Track selection draft was not found."
        onReturn={onCancel}
      />
    )
  }

  if (libraryQuery.isPending) {
    return (
      <InlineStatus>
        <Loader2 aria-hidden="true" className="animate-spin" />
        Loading selected Library problems…
      </InlineStatus>
    )
  }

  if (libraryQuery.isError || !libraryQuery.data) {
    return (
      <RecoverableDraftError
        message="Selected Library problems could not be loaded."
        onReturn={onCancel}
      />
    )
  }

  const rowsBySlug = new Map(
    libraryQuery.data.rows.map((row) => [row.problem.slug, row] as const),
  )
  const problemRows = draft.problemSlugs.flatMap((slug) => {
    const row = rowsBySlug.get(slug)

    return row ? [row] : []
  })

  if (problemRows.length === 0) {
    return (
      <RecoverableDraftError
        message="No selected Library problems are still available."
        onReturn={onCancel}
      />
    )
  }

  return (
    <div className="grid gap-3">
      {problemRows.length < draft.problemSlugs.length ? (
        <InlineStatus>
          Some selected problems are no longer available.
        </InlineStatus>
      ) : null}
      <TrackForm
        initialDraft={{
          source: 'library-selection',
          selectedCount: problemRows.length,
          problemRows,
        }}
        mode="create"
        onCancel={onCancel}
        onSaved={() => {
          clearLibrarySelectionTrackDraft(draft.id)
          onSaved()
        }}
      />
    </div>
  )
}

function RecoverableDraftError({
  message,
  onReturn,
}: {
  message: string
  onReturn: () => void
}) {
  return (
    <div className="grid gap-3">
      <InlineStatus role="alert" tone="danger">
        {message}
      </InlineStatus>
      <div>
        <Button onClick={onReturn} type="button" variant="outline">
          Return to Library
        </Button>
      </div>
    </div>
  )
}
```

Export from `src/features/tracks/index.ts`:

```ts
export { LibrarySelectionTrackForm } from './components/library-selection-track-form'
```

- [ ] **Step 4: Implement route manifest and route**

In `src/app/dashboard/navigation/route-manifest.ts`, add path:

```ts
libraryTrackNew: '/library/tracks/new',
```

Add modal metadata:

```ts
libraryTrackNew: {
  closeTo: dashboardPaths.library,
  description: 'Create a track from selected Library problems.',
  relativePath: 'tracks/new',
  staticData: {
    presentation: 'modal',
    section: 'library',
    title: 'New Track',
  },
},
```

In `src/app/dashboard/screens/track-modal-pages.tsx`, import the component:

```ts
import { LibrarySelectionTrackForm, TrackForm } from '@/features/tracks'
import { useSearch } from '@tanstack/react-router'
```

Add the page:

```tsx
export function NewLibrarySelectionTrackModalPage() {
  const closeToLibrary = useCloseToLibrary()
  const search = useSearch({ from: dashboardPaths.libraryTrackNew })

  return (
    <RouteModal
      closeTo={dashboardModalRouteMeta.libraryTrackNew.closeTo}
      title="New Track"
      variant="form"
    >
      <LibrarySelectionTrackForm
        draftId={search.draft}
        onCancel={closeToLibrary}
        onSaved={closeToLibrary}
      />
    </RouteModal>
  )
}

function useCloseToLibrary() {
  const navigate = useNavigate()

  return () => {
    void navigate({ replace: true, to: dashboardPaths.library })
  }
}
```

In `src/app/dashboard/navigation/routes.tsx`, import the page and add a route:

```ts
const libraryTrackNewRoute = createRoute({
  getParentRoute: () => libraryRoute,
  path: dashboardModalRouteMeta.libraryTrackNew.relativePath,
  component: NewLibrarySelectionTrackModalPage,
  validateSearch: (search: Record<string, unknown>) => ({
    draft: typeof search.draft === 'string' ? search.draft : undefined,
  }),
  staticData: dashboardModalRouteMeta.libraryTrackNew.staticData,
})
```

Add it to Library children:

```ts
libraryRoute.addChildren([
  problemNewRoute,
  problemEditRoute,
  libraryTrackNewRoute,
])
```

- [ ] **Step 5: Run dashboard route tests and verify route behavior**

Run:

```bash
npm run test -- src/app/dashboard/routes.test.tsx
```

Expected: PASS for the direct-route missing-draft test and modal metadata assertions.

- [ ] **Step 6: Commit route skeleton**

Commit this task after the direct-route and modal metadata tests pass.

Commit command:

```bash
git add src/features/tracks/components/library-selection-track-form.tsx src/features/tracks/index.ts src/app/dashboard/screens/track-modal-pages.tsx src/app/dashboard/navigation/route-manifest.ts src/app/dashboard/navigation/routes.tsx src/app/dashboard/routes.test.tsx
git commit -m "feat: add library track creation route"
```

---

### Task 6: Make Track Action In LibraryPage

**Files:**
- Modify: `src/app/dashboard/screens/library-page.tsx`
- Modify: `src/app/dashboard/routes.test.tsx`

- [ ] **Step 1: Add failing route test for selected-row navigation**

Add this test:

```ts
it('creates a track from selected Library rows through a Library-scoped modal', async () => {
  const { router, user } = renderDashboard('/library')

  expect(await screen.findByRole('heading', { name: 'Library' })).toBeVisible()
  await user.click(await screen.findByRole('checkbox', { name: 'Select Binary Search' }))
  await user.click(screen.getByRole('button', { name: 'Make Track' }))

  await waitFor(() => {
    expect(router.state.location.pathname).toBe('/library/tracks/new')
  })

  const dialog = await screen.findByRole('dialog', { name: 'New Track' })
  expect(within(dialog).getByText('1 selected Library problems')).toBeVisible()
  expect(within(dialog).getByRole('listitem', { name: '1. Binary Search' })).toBeVisible()
})
```

- [ ] **Step 2: Run the route test and verify failure**

Run:

```bash
npm run test -- src/app/dashboard/routes.test.tsx -t "creates a track from selected Library rows"
```

Expected: FAIL because `Make Track` is not rendered by `LibraryPage`.

- [ ] **Step 3: Implement `Make Track` action**

In `src/app/dashboard/screens/library-page.tsx`, import:

```ts
import { useNavigate } from '@tanstack/react-router'
import { MapPlus, Plus } from 'lucide-react'
import type { ProblemLibraryRow } from '@/features/problems'
import {
  ProblemLibraryScreen,
} from '@/features/problems'
import { createLibrarySelectionTrackDraft } from '@/features/tracks'
```

Inside `LibraryPage`:

```ts
const navigate = useNavigate()

function createTrackFromSelection(selectedRows: readonly ProblemLibraryRow[]) {
  const draft = createLibrarySelectionTrackDraft(
    selectedRows.map((row) => row.problem.slug),
  )

  void navigate({
    search: { draft: draft.id },
    to: dashboardPaths.libraryTrackNew,
  })
}
```

Pass the action:

```tsx
renderSelectedRowsAction={(selectedRows) => (
  <Button
    onClick={() => createTrackFromSelection(selectedRows)}
    size="sm"
    type="button"
    variant="outline"
  >
    <MapPlus aria-hidden="true" />
    Make Track
  </Button>
)}
```

- [ ] **Step 4: Run route tests and verify pass**

Run:

```bash
npm run test -- src/app/dashboard/routes.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit Task 6**

```bash
git add src/app/dashboard/screens/library-page.tsx src/app/dashboard/routes.test.tsx
git commit -m "feat: create tracks from library selections"
```

---

### Task 7: Full Verification And Architecture Check

**Files:**
- Modify only files needed to fix Phase 3.3 failures found by verification.

- [ ] **Step 1: Run focused feature tests**

Run:

```bash
npm run test -- src/features/tracks/utils/library-selection-track-draft.test.ts
npm run test -- src/features/tracks/hooks/track-form-initial-draft.test.ts
npm run test -- src/features/tracks/components/track-form.test.tsx
npm run test -- src/features/problems/components/library/problem-library-screen.test.tsx
npm run test -- src/app/dashboard/routes.test.tsx
```

Expected: all PASS.

- [ ] **Step 2: Run architecture boundary test**

Run:

```bash
npm run test -- src/testing/architecture-boundaries.test.ts
```

Expected: PASS. If it fails, replace nested feature imports with public barrel imports and keep root feature barrels free of `data` and `server` exports.

- [ ] **Step 3: Run full project check**

Run:

```bash
npm run check
```

Expected: PASS.

- [ ] **Step 4: Inspect final diff**

Run:

```bash
git status --short
git diff --stat
git diff -- src/features/tracks src/features/problems src/app/dashboard docs/superpowers/plans/2026-05-24-phase-3-3-library-selection-to-track.md
```

Expected:

- No changes to `src/platform/db/seed.ts` are staged.
- `.superpowers/` and `.codex/` are not staged.
- Diff only contains Phase 3.3 implementation and tests.

- [ ] **Step 5: Commit verification fixes if needed**

If Step 1-3 required fixes, commit them:

```bash
git add <phase-3-3-files-only>
git commit -m "fix: harden library selection track creation"
```

Skip this commit if no files changed after the previous task commits.

---

## Self-Review Checklist

- The plan implements selected rows, not all filtered rows.
- The selected-row state remains local to Library until the user clicks `Make Track`.
- The handoff stores slugs in `sessionStorage`, not in a global app store or DB.
- Tracks owns draft creation, draft reading, grouping, and form payload construction.
- App/dashboard only composes route behavior.
- The `Group by` control is a compact dropdown beside `Target date`.
- Problem membership rows do not gain problem metadata chips.
- The move-to-group control is compact and sits with row ordering controls.
- Tests cover draft helper, grouping, Library selection action, route modal, missing draft, Track form payload, and architecture boundaries.
