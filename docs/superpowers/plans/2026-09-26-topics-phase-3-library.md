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
      problems. Implement the topic predicate in `problem-library-filtering.ts`:
      direct matching checks selected IDs against `row.topics`; with
      `includeSubtopics`, check against `row.effectiveTopicIds`. Any mode requires
      one match, All mode requires every selected ID, and an empty selection
      passes. Keep `topicQuery` out of row filtering.

Only application-owned column state reaches this predicate. Runtime row values
have already passed Zod in Phase 2. Keep all other facets on
`problemLibraryIncludesAnyFilter`.

- [ ] Write a truth-table test covering direct versus effective IDs, Any versus
      All, and the empty selection. Import `describe`, `expect`, `it` from Vitest
      and the predicate from the sibling file.

- [ ] Run `rtk npx vitest run src/features/problems/components/library/problem-library-filtering.test.ts`
      red then green. Add ancestor-and-child selection with All and an untagged row.
- [ ] Replace the topic `pushArrayColumnFilter` call in
      `createProblemLibraryColumnFilters` with the topic-specific predicate.

Change only the Topics column's `filterFn` to `problemLibraryTopicFilter`; the
accessor can remain its existing direct-ID accessor because the predicate uses
`row.original`. Add its import. Extend `hasProblemLibraryFilters` with
`filters.topicQuery !== '' || filters.topicMatchMode !== 'any' ||
!filters.includeSubtopics` so Clear Filters remains available after UI-only
changes. These flags alone must not add a column filter.

- [ ] Run the filtering test and existing Library screen tests. Commit
      `feat(library): filter canonical topics with descendants and any-all matching`.

Implemented in `src/features/problems/components/library/problem-library-filtering.ts`, `src/features/problems/components/library/problem-library-columns.tsx`; covered by `src/features/problems/components/library/problem-library-filtering.test.ts`, `src/features/problems/components/library/problem-library-screen.test.tsx`.

## Task 2: Add A Topic-Specific Searchable Picker

- [ ] Add the new component file. Use a native disclosure button, labeled
      search field, and checkbox group; do not put a search input inside a listbox
      or implement a second generic facet framework. Keep search and selection
      controlled by `ProblemLibraryFilters` so Clear Filters can reset both.
- [ ] Write this component test with a local controlled harness before building
      the component. Its interface is defined in
      `src/features/problems/components/library/problem-library-topic-filter.tsx`.

Imports: React `useState`; Testing Library `render, screen`; user-event;
Vitest `expect, it`; the new component and filter types/defaults. Extend this
test with empty query, slash query, unused option, query changes retaining
selected IDs, and duplicate alias strings yielding one canonical option.

- [ ] Run `rtk npx vitest run src/features/problems/components/library/problem-library-topic-filter.test.tsx`
      and expect the component import failure. Search canonical labels and aliases
      by normalized substring, but render and select each canonical option only
      once. Query changes preserve selected IDs; an All topics action clears
      selection, and an empty result shows a status message. Opening focuses the
      search field. An outside pointer closes the picker without moving focus
      from its destination; Escape closes it and restores trigger focus. Tab uses
      native controls without a focus trap. Keep match mode and Include subtopics
      visible while closed, using the toolbar's existing control styles and shared
      `Button`.

- [ ] Run the component test; expect pass. Verify visible options use canonical
      IDs as keys and never render alias rows as independently selectable topics.
- [ ] Commit `feat(library): add canonical topic picker with alias search`.

Implemented in `src/features/problems/components/library/problem-library-topic-filter.tsx`, `src/features/problems/components/library/problem-library-toolbar.tsx`; covered by `src/features/problems/components/library/problem-library-topic-filter.test.tsx`, `src/features/problems/components/library/problem-library-screen.test.tsx`.

## Task 3: Wire Toolbar Reset And Table Integration

- [ ] Replace the existing Topics `ProblemLibraryFacetFilter` in
      `problem-library-toolbar.tsx` only. Import the topic picker there and keep
      companies, tracks, status, and difficulty on the existing generic facet.

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

Implemented in `src/features/problems/components/library/problem-library-toolbar.tsx`, `src/features/problems/components/library/problem-library-table.tsx`; covered by `src/features/problems/components/library/problem-library-screen.test.tsx`.

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
