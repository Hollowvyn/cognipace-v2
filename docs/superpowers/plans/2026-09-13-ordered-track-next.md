# Ordered Track Next Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the active track's `Next` target in explicit group/problem order instead of allowing a later FSRS-due problem to jump the curriculum.

**Architecture:** Preserve the repository's existing ordered-membership read and the Tracks service's shared guidance path. Change only the service selection precedence: filter out completed memberships, then select the first non-suspended row while calculating due-review count independently from all incomplete rows.

**Tech Stack:** TypeScript, Vitest, Drizzle-backed test database, React-facing serialized Tracks workspace

---

### Task 1: Lock and correct ordered Tracks guidance

**Files:**

- Modify: `src/features/tracks/server/tracks-service.test.ts:278-353`
- Modify: `src/features/tracks/server/tracks-service.ts:328-343`

- [ ] **Step 1: Write the failing regression test**

Replace the due-first portion of the existing selection test with a focused
curriculum-order regression, while retaining separate coverage for suspended
and exhausted tracks:

```ts
it('keeps next problem in curriculum order when a later incomplete problem is due', async () => {
  const handle = await createTestDb({
    now: new Date('2026-01-01T00:00:00.000Z'),
  })

  await makeLeetCodeActive(handle.db)
  await addActiveTrackMembership(handle.db, {
    groupId: 'leetcode-75:stack',
    groupTitle: 'Stack',
    problemSlug: 'valid-parentheses',
    groupPosition: 2,
  })
  await makeProblemDue(handle.db, 'valid-parentheses', {
    now: new Date('2026-01-10T12:00:00.000Z'),
  })

  await expect(
    getWorkspace(handle.db, {
      surface: 'dashboard',
      at: '2026-01-10T12:00:00.000Z',
    }),
  ).resolves.toMatchObject({
    activeTrack: {
      nextProblem: {
        slug: 'two-sum',
      },
    },
    dueCount: 1,
  })
})
```

Rename the remainder to `skips suspended incomplete problems and returns no
next problem when the track is complete`; keep its existing suspension and
completion assertions.

- [ ] **Step 2: Run the regression test and verify RED**

Run:

```sh
npm test -- src/features/tracks/server/tracks-service.test.ts -t 'keeps next problem in curriculum order when a later incomplete problem is due'
```

Expected: FAIL because the current service returns `valid-parentheses` instead
of the earlier ordered `two-sum`, while `dueCount` remains `1`.

- [ ] **Step 3: Implement the minimal selection correction**

Change `selectActiveTrackNextRow` so due status no longer participates in
`nextRow` selection:

```ts
const nextRow =
  incompleteRows.find((row) => row.status !== 'suspended') ?? null
```

Keep the existing incomplete-row filter and due-count calculation unchanged.

- [ ] **Step 4: Run the full focused Tracks service test**

Run:

```sh
npm test -- src/features/tracks/server/tracks-service.test.ts
```

Expected: PASS with the new ordered regression, suspended-row coverage,
completed-row coverage, due-count coverage, and direct active-track guidance
coverage all green.

- [ ] **Step 5: Commit the service correction**

```sh
git add src/features/tracks/server/tracks-service.ts src/features/tracks/server/tracks-service.test.ts
git commit -m "fix(tracks): preserve curriculum order for next problem"
```

### Task 2: Make the current behavior authority explicit

**Files:**

- Modify: `docs/product.md:163-174`
- Modify: `docs/testing.md:205-228`

- [ ] **Step 1: Document the ordered Tracks contract**

Add this behavior to the Tracks product section:

```md
The active track's `Next` target is the first incomplete, non-suspended
membership in explicit group and problem order. FSRS due state does not reorder
track progression; due reviews remain a separate review target.
```

- [ ] **Step 2: Add the regression smoke expectation**

Extend the Tracks manual flow with a later-group due-review edge case:

```md
Confirm that a due review in a later group increases Due Reviews without
replacing an earlier ordered incomplete `Next` problem.
```

- [ ] **Step 3: Format and verify the touched authority docs**

Run:

```sh
npx prettier --check docs/product.md docs/testing.md
```

Expected: both files are already formatted correctly.

- [ ] **Step 4: Commit the authority-doc update**

```sh
git add docs/product.md docs/testing.md
git commit -m "docs(tracks): clarify ordered next progression"
```

### Task 3: Validate the behavior-changing Tracks fix

**Files:**

- Verify: `src/features/tracks/server/tracks-service.ts`
- Verify: `src/features/tracks/server/tracks-service.test.ts`
- Verify: `docs/product.md`
- Verify: `docs/testing.md`

- [ ] **Step 1: Run whitespace and formatting validation**

Run:

```sh
git diff --check origin/main...HEAD
npx prettier --check docs/superpowers/specs/2026-09-13-ordered-track-next-design.md docs/superpowers/plans/2026-09-13-ordered-track-next.md docs/superpowers/README.md docs/product.md docs/testing.md
```

Expected: no whitespace errors and all touched Markdown is formatted.

- [ ] **Step 2: Run required automated validation**

Run each command independently:

```sh
npm run lint
npm run check
npm run build
```

Expected: all commands exit successfully.

- [ ] **Step 3: Review the final branch diff**

Run:

```sh
git status --short --branch
git diff --stat origin/main...HEAD
git diff --check origin/main...HEAD
```

Expected: the branch contains only the approved design/plan, Tracks service and
test correction, and authority-doc clarification, with a clean worktree.

- [ ] **Step 4: Prepare the required human smoke checklist**

Before PR review or merge, a human engineer must load the built extension and
capture screenshot or screen-recording proof for:

1. Happy path: the Tracks workspace shows the earliest ordered incomplete
   membership as `Next` and completing it advances to the following ordered
   incomplete membership.
2. Edge case: a later-group incomplete problem becomes due, Due Reviews
   increases, and the earlier ordered incomplete `Next` target does not change.
3. Cross-surface check: dashboard, popup, and overlay guidance agree on the same
   ordered active-track `Next` problem.
