# Active Track Group Auto-Reveal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reveal the restored or newly selected active group tab at the nearest
visible edge in the dashboard Tracks workspace.

**Architecture:** Keep the behavior in `ActiveTrackGroups`, which already owns
the tab strip and scroll controls. Measure overflow before revealing the active
tab, and key the one-shot reveal to active-track, active-group, and group-order
changes so unrelated refreshes do not reset manual scrolling.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Vitest, React Testing Library

---

## Implementation

**Files:**

- `src/features/tracks/components/active-track-workspace.tsx`
- `src/features/tracks/components/tracks-screen.test.tsx`

- [x] Add a failing test for restoring an active group beyond the initial
      viewport, including overflow-gutter ordering and arrow clearance.
- [x] Add a failing test for revealing a newly selected group after workspace
      invalidation.
- [x] Confirm both tests fail before implementation.
- [x] Retain the active tab, measure the group-strip layout, and reveal it with
      `scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' })`.
- [x] Apply `scroll-mx-14` to clear the existing `w-14` arrow overlays.
- [x] Preserve zero/one-group behavior, group order, and manual scrolling.
- [x] Run the focused Tracks suite: 31 tests passed.
- [x] Commit the tested behavior.

## Documentation

Task 2 was skipped at the user's request. This branch does not change
`docs/product.md` or `docs/testing.md`.

## Validation

Completed:

```sh
npm test -- src/features/tracks/components/tracks-screen.test.tsx
npm run lint
npm run check
npm run build
npm run zip
npx prettier --check src/features/tracks/components/active-track-workspace.tsx src/features/tracks/components/tracks-screen.test.tsx docs/superpowers/specs/2026-09-13-active-track-group-auto-reveal-design.md docs/superpowers/plans/2026-09-13-active-track-group-auto-reveal.md docs/superpowers/README.md
git diff --check origin/main...HEAD
```

The build emitted the existing non-blocking large-chunk warning. Automated PR
checks passed.

Pending human proof before merge:

- [ ] Open Tracks with a persisted active group outside the initial viewport;
      confirm its tab is visible, selected, unobscured, and matches the rows.
- [ ] Select another group and confirm its tab and rows update.
- [ ] Manually scroll both directions and confirm the selected tab is not pinned.
- [ ] Repeat at a narrow dashboard width.
- [ ] Attach screenshot or screen-recording proof to the PR.
