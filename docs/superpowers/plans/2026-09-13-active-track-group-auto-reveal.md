# Active Track Group Auto-Reveal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically reveal the restored or newly selected active track group
with nearest-edge alignment in the dashboard Tracks workspace.

**Architecture:** Keep the behavior inside the existing `ActiveTrackGroups`
feature component, which already owns the group tab list and scroll controls.
Track the rendered active tab with a ref, reveal it in a layout effect keyed only
to active-track, active-group, and group-order changes, and preserve manual scroll
position across unrelated workspace refreshes.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Vitest, React Testing Library

---

### Task 1: Reveal the active group at the nearest visible edge

**Files:**

- Modify: `src/features/tracks/components/tracks-screen.test.tsx:341-502`
- Modify: `src/features/tracks/components/active-track-workspace.tsx:1-416`

- [x] **Step 1: Write the failing restored-group test**

Add a focused test beside the existing group-tab tests. It must select a later
group in the workspace response, install a local `scrollIntoView` mock, and
assert the selected tab requests immediate nearest-edge visibility and carries
the scroll margin needed for the arrow overlays:

```tsx
it('reveals a restored active group at the nearest visible edge', async () => {
  const activeTrack = twoGroupWorkspace.activeTrack

  if (!activeTrack) {
    throw new Error('Expected active track fixture.')
  }

  const binarySearchGroup = createSerializedTrackGroup({
    id: 'leetcode-75:binary-search',
    title: 'Binary Search',
    position: 4,
  })
  const scrollIntoView = mockElementScrollIntoView()

  try {
    vi.mocked(sendMessage).mockResolvedValueOnce({
      ...twoGroupWorkspace,
      activeTrack: {
        ...activeTrack,
        activeGroup: binarySearchGroup,
      },
      activeTrackGroups: [
        ...twoGroupWorkspace.activeTrackGroups,
        createSerializedTrackGroup({
          id: 'leetcode-75:graphs',
          title: 'Graphs',
          position: 3,
        }),
        binarySearchGroup,
      ],
    })

    renderTracksScreen()

    const activeTab = await screen.findByRole('tab', {
      name: 'Binary Search, 0 of 0 completed',
    })

    await waitFor(() => {
      expect(scrollIntoView.mock).toHaveBeenCalledWith({
        behavior: 'auto',
        block: 'nearest',
        inline: 'nearest',
      })
    })
    expect(scrollIntoView.mock.mock.instances.at(-1)).toBe(activeTab)
    expect(activeTab).toHaveClass('scroll-mx-14')
  } finally {
    scrollIntoView.restore()
  }
})
```

Add this test-only helper near the existing scroll-metric helper:

```tsx
function mockElementScrollIntoView() {
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'scrollIntoView',
  )
  const mock = vi.fn()

  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: mock,
  })

  return {
    mock,
    restore: () => {
      if (descriptor) {
        Object.defineProperty(
          HTMLElement.prototype,
          'scrollIntoView',
          descriptor,
        )
        return
      }

      delete (HTMLElement.prototype as unknown as Record<string, unknown>)[
        'scrollIntoView'
      ]
    },
  }
}
```

- [x] **Step 2: Run the restored-group test and verify RED**

Run:

```sh
npm test -- src/features/tracks/components/tracks-screen.test.tsx -t "reveals a restored active group at the nearest visible edge"
```

Expected: FAIL because the active tab does not call `scrollIntoView` and does not
have `scroll-mx-14`.

- [x] **Step 3: Write the failing active-group-change test**

Add a second focused test beside the restored-group case. It must clear the
initial reveal call, change the active group through the real tab interaction,
allow the query invalidation to return the updated workspace, and assert the new
active element is revealed:

```tsx
it('reveals the newly selected active group', async () => {
  const user = userEvent.setup()
  const activeTrack = twoGroupWorkspace.activeTrack

  if (!activeTrack) {
    throw new Error('Expected active track fixture.')
  }

  let activeGroup = twoGroupWorkspace.activeTrackGroups[0] ?? null
  const scrollIntoView = mockElementScrollIntoView()

  try {
    vi.mocked(sendMessage).mockImplementation((method, request) => {
      if (method === 'tracks.setActiveGroup') {
        activeGroup =
          twoGroupWorkspace.activeTrackGroups.find(
            (group) => group.id === request.groupId,
          ) ?? null

        return Promise.resolve(null)
      }

      if (method === 'tracks.getWorkspace') {
        return Promise.resolve({
          ...twoGroupWorkspace,
          activeTrack: {
            ...activeTrack,
            activeGroup,
          },
        })
      }

      return Promise.resolve(null)
    })

    renderTracksScreen()

    await screen.findByRole('tab', {
      name: 'Arrays and Hashing, 1 of 2 completed',
    })
    scrollIntoView.mock.mockClear()

    const nextTab = screen.getByRole('tab', {
      name: 'Dynamic Programming, 0 of 1 completed',
    })
    await user.click(nextTab)

    await waitFor(() => {
      expect(nextTab).toHaveAttribute('aria-selected', 'true')
      expect(scrollIntoView.mock.mock.instances.at(-1)).toBe(nextTab)
    })
  } finally {
    scrollIntoView.restore()
  }
})
```

- [x] **Step 4: Run both reveal tests and verify RED**

Run:

```sh
npm test -- src/features/tracks/components/tracks-screen.test.tsx -t "reveals"
```

Expected: both new tests FAIL because the component does not yet retain or
reveal the active tab.

- [x] **Step 5: Implement the minimal active-tab reveal**

In `active-track-workspace.tsx`, import `useLayoutEffect`, then retain the active
tab and derive a stable group-order key beside `tabListRef`:

```tsx
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

// Inside ActiveTrackGroups, beside tabListRef:
const activeTabRef = useRef<HTMLButtonElement | null>(null)
const groupOrderKey = groups.map((group) => group.id).join('\u0000')
```

Immediately after the existing `updateScrollState` callback declaration, reveal
the active element only when the active track, active group, or order changes:

```tsx
useLayoutEffect(() => {
  activeTabRef.current?.scrollIntoView?.({
    behavior: 'auto',
    block: 'nearest',
    inline: 'nearest',
  })
  updateScrollState()
}, [activeGroupId, groupOrderKey, trackId, updateScrollState])
```

Attach the ref only to the active group tab and add an inline scroll margin
equal to the existing `w-14` scroll-button overlay:

```tsx
<button
  aria-label={`${group.title}, ${progress.completedCount} of ${progress.totalCount} completed`}
  aria-selected={isActive}
  className={cn(
    'inline-flex min-h-12 min-w-0 max-w-[min(18rem,72vw)] shrink-0 scroll-mx-14 items-center gap-2 border-b-2 px-0 py-3 text-[length:var(--cp-badge-font-size)] font-bold uppercase leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    isActive
      ? 'border-primary text-primary'
      : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
  )}
  disabled={setActiveGroup.isPending}
  key={group.id}
  onClick={() => {
    void selectGroup(group.id)
  }}
  ref={isActive ? activeTabRef : undefined}
  role="tab"
  type="button"
>
```

The optional method call keeps JSDOM-compatible tests that do not install the
DOM method focused on their existing assertions; supported Chrome dashboard
runtimes provide `scrollIntoView`.

- [x] **Step 6: Run the focused component suite and verify GREEN**

Run:

```sh
npm test -- src/features/tracks/components/tracks-screen.test.tsx
```

Expected: PASS, including both new reveal cases and the existing group scroll,
selection, empty-state, and track-action cases.

- [x] **Step 7: Commit the behavior and tests**

```sh
git add src/features/tracks/components/active-track-workspace.tsx src/features/tracks/components/tracks-screen.test.tsx
git commit -m "fix(tracks): reveal the active group tab"
```

### Task 2: Document the dashboard behavior and smoke flow (Skipped by user)

> **Skipped:** The user requested a PR without Task 2. No `docs/product.md` or
> `docs/testing.md` edits are included in this branch.

**Files:**

- Modify: `docs/product.md:163-174`
- Modify: `docs/testing.md:203-226`

- [ ] **Step 1: SKIPPED — Update the current product behavior**

Add this paragraph after the opening Tracks paragraph in `docs/product.md`:

```md
When a track has multiple groups, the dashboard restores its selected group and
automatically reveals that group's tab with nearest-edge alignment. The tab is
not pinned; the existing horizontal scrolling controls remain available.
```

- [ ] **Step 2: SKIPPED — Update the Tracks manual smoke flow**

Replace Tracks smoke steps 5 and 6 in `docs/testing.md` with:

```md
5. Set a track with enough groups to overflow the tab row active, select a group
   beyond the initial visible area, then leave and reopen Tracks.
6. Confirm the restored selected group's tab is visible at the nearest edge,
   remains selected, and is not covered by a scroll arrow.
7. Change the active group, then manually scroll left and right.
8. Confirm the new selected tab is revealed and manual scrolling still works.
```

Renumber the remaining review and reset steps to 9 and 10.

- [ ] **Step 3: SKIPPED — Format and check the touched Markdown**

Run:

```sh
npx prettier --check docs/product.md docs/testing.md
```

Expected: PASS.

- [ ] **Step 4: SKIPPED — Commit current behavior documentation**

```sh
git add docs/product.md docs/testing.md
git commit -m "docs(tracks): document active group reveal"
```

### Task 3: Validate and prepare the handoff

**Files:**

- Modify: `docs/superpowers/plans/2026-09-13-active-track-group-auto-reveal.md`

- [x] **Step 1: Run required automated validation**

Run these commands exactly:

```sh
npm run lint
npm run check
npm run build
npx prettier --check src/features/tracks/components/active-track-workspace.tsx src/features/tracks/components/tracks-screen.test.tsx docs/product.md docs/testing.md docs/superpowers/plans/2026-09-13-active-track-group-auto-reveal.md
git diff --check origin/main...HEAD
```

Expected: every command exits successfully. Record any failure rather than
hiding or reclassifying it.

Recorded results: `npm run lint`, `npm run check`, `npm run build`, the changed-
file Prettier check, and `git diff --check origin/main...HEAD` all passed. The
build emitted the existing non-blocking large-chunk warning.

- [ ] **Step 2: Prepare required human smoke and visual proof**

Record these checks as pending until a human engineer runs them in the built
dashboard:

```md
- [ ] Happy path: Open Tracks with an overflowed group strip whose persisted
      active group is outside the initial viewport; confirm its selected tab is
      immediately visible at the nearest edge and matches the rendered rows.
- [ ] Change path: Select another visible group; confirm its tab remains visible
      and the corresponding problem rows load.
- [ ] Edge case: Manually scroll away and back with both arrow controls; confirm
      the selected tab is not permanently pinned and neither arrow obscures it
      when auto-revealed.
- [ ] Responsive edge case: Repeat at a narrow dashboard width.
- [ ] Attach a screenshot or screen recording showing the restored selected tab.
```

- [x] **Step 3: Mark completed plan checkboxes and commit the plan record**

Use checkbox state to reflect only work and validation actually completed. Keep
human-run smoke and visual-proof items unchecked until evidence exists, then run:

```sh
git add docs/superpowers/plans/2026-09-13-active-track-group-auto-reveal.md
git commit -m "docs(tracks): record active group validation"
```

## Done When

- The selected group tab is automatically visible on Tracks load and group
  changes, using immediate nearest-edge alignment.
- Unrelated workspace refreshes do not reset manual group-strip scrolling.
- Manual arrows, horizontal scrolling, tab semantics, and group order remain
  unchanged.
- Focused tests, lint, check, build, formatting, and whitespace validation pass.
- Human-run happy-path and edge-case dashboard smoke plus visual proof are
  recorded before PR review or merge.
