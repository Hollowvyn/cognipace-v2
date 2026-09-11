# Expanded Overlay Width Containment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the expanded overlay's post-submit actions and next-problem card within its responsive 420px surface when the next title is long.

**Architecture:** Fix the intrinsic sizing boundary in the `overlay-session`-owned expanded footer. Give the footer a zero minimum width and an explicit `minmax(0, 1fr)` track so its existing title truncation can take effect without changing global surface overflow or other overlay modes.

**Tech Stack:** React 19, TypeScript, Tailwind CSS utilities, Vitest, React Testing Library

---

### Task 1: Add the long-title regression test

**Files:**

- Modify: `src/features/overlay-session/components/modes/expanded/expanded-overlay.test.tsx:74`
- Reference: `docs/superpowers/specs/2026-09-11-expanded-overlay-width-containment-design.md`

- [ ] **Step 1: Install locked dependencies if the worktree has no `node_modules`**

Run:

```sh
npm install
```

Expected: dependencies install successfully from `package-lock.json` without a
lockfile diff.

- [ ] **Step 2: Write the failing regression test**

Insert this test after `renders post-submit update actions without duplicate submit`:

```tsx
it('keeps the submitted footer shrinkable for a long next title', () => {
  const longTitle = 'Find First and Last Position of Element in Sorted Array'

  renderExpanded({
    view: {
      overlay: {
        ...createSubmittedOverlay(),
        nextStep: {
          status: 'ready',
          value: {
            ...nextStep,
            problem: {
              ...nextStep.problem,
              title: longTitle,
            },
            title: longTitle,
          },
          message: null,
        },
      },
    },
  })

  const nextCard = screen.getByRole('region', { name: 'Up next' })

  expect(nextCard.parentElement).toHaveClass(
    'min-w-0',
    'grid-cols-[minmax(0,1fr)]',
  )
  expect(screen.getByRole('heading', { name: longTitle })).toHaveClass(
    'truncate',
  )
  expect(screen.getByRole('button', { name: 'Restart' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Open' })).toBeInTheDocument()
})
```

- [ ] **Step 3: Run the focused test and verify RED**

Run:

```sh
npm run test -- src/features/overlay-session/components/modes/expanded/expanded-overlay.test.tsx --run
```

Expected: FAIL in `keeps the submitted footer shrinkable for a long next title`
because the footer lacks `min-w-0` and
`grid-cols-[minmax(0,1fr)]`. Existing tests should still pass.

### Task 2: Constrain the expanded footer sizing boundary

**Files:**

- Modify: `src/features/overlay-session/components/modes/expanded/expanded-overlay.tsx:180`
- Test: `src/features/overlay-session/components/modes/expanded/expanded-overlay.test.tsx`

- [ ] **Step 1: Apply the minimal footer sizing fix**

Replace the footer opening element with:

```tsx
<div className="grid min-w-0 shrink-0 grid-cols-[minmax(0,1fr)] gap-3 border-t border-border bg-card p-3">
```

Do not change `SurfaceRoot`, global overflow, `OverlayNextCard` text behavior, or
the collapsed and docked modes.

- [ ] **Step 2: Run the focused test and verify GREEN**

Run:

```sh
npm run test -- src/features/overlay-session/components/modes/expanded/expanded-overlay.test.tsx --run
```

Expected: PASS for the new long-title regression and all existing
`ExpandedOverlay` tests, with no warnings.

- [ ] **Step 3: Check formatting and the focused diff**

Run:

```sh
npx prettier --check src/features/overlay-session/components/modes/expanded/expanded-overlay.tsx src/features/overlay-session/components/modes/expanded/expanded-overlay.test.tsx
git diff --check
```

Expected: both commands exit successfully with no formatting or whitespace
errors. Confirm the diff contains only the regression test and the footer class
change.

- [ ] **Step 4: Commit the regression and fix**

```sh
git add src/features/overlay-session/components/modes/expanded/expanded-overlay.tsx src/features/overlay-session/components/modes/expanded/expanded-overlay.test.tsx
git commit -m "fix(overlay): contain expanded footer width"
```

Expected: one Conventional Commit containing the test-first overlay fix.

### Task 3: Run overlay UI validation and prepare visual proof

**Files:**

- Verify: `src/features/overlay-session/components/modes/expanded/expanded-overlay.tsx`
- Verify: `src/features/overlay-session/components/modes/expanded/expanded-overlay.test.tsx`
- Reference: `docs/testing.md:279`
- Reference: `docs/agent-governance.md:177`

- [ ] **Step 1: Run lint**

Run:

```sh
npm run lint
```

Expected: PASS with no ESLint errors.

- [ ] **Step 2: Run the required full check**

Run:

```sh
npm run check
```

Expected: PASS for database validation, WXT preparation, TypeScript, ESLint,
and the full Vitest suite.

- [ ] **Step 3: Build the extension**

Run:

```sh
npm run build
```

Expected: PASS and a Chrome MV3 build under `.output/chrome-mv3`.

- [ ] **Step 4: Prepare the required human-run overlay smoke checklist**

The human engineer must load `.output/chrome-mv3` and verify:

1. Open a LeetCode problem and expand the overlay.
2. Submit a successful review whose next problem has a short title; confirm the
   restart/update row and next card remain inside the overlay.
3. Repeat with a long next-problem title; confirm the title truncates with an
   ellipsis, the Open action remains visible, and neither footer section crosses
   the overlay border.
4. Narrow the browser viewport and repeat the long-title check.
5. Confirm pre-submit submit/fail actions, feedback wrapping, dock, and restore
   still work.
6. Attach screenshot or screen-recording proof for the normal-width and narrow
   long-title states before PR review or merge.

Expected: happy-path and edge-case proof is recorded. If it cannot be run in
this environment, report it as skipped with the reason and remaining visual
risk; do not mark it N/A.

- [ ] **Step 5: Record the final validation evidence**

List every exact command run, every skipped command with its reason, remaining
risk, release impact, and rollback notes in the handoff. The rollback is to
revert `fix(overlay): contain expanded footer width`; there are no data,
permission, runtime, or migration effects.
