# Tracks Phase 3.2 Active Guidance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make active-track next-problem guidance consistent across Tracks workspace, popup/app-shell, and overlay while keeping Phase 3.2 infrastructure-only.

**Architecture:** Tracks owns the active guidance resolver in `src/features/tracks/server/tracks-service.ts`. App shell consumes that guidance and only applies surface adaptation, including the overlay-only queue fallback. Free Practice blocks active-track reads and practice-save progress writes.

**Tech Stack:** TypeScript, React 19, TanStack Query cache invalidation, WXT runtime messaging, Drizzle ORM, Zod, Vitest.

---

## Scope Checkpoint

Before writing implementation code, confirm the expected touch set and LOC budget.

**Expected production files:**

- Modify: `src/features/tracks/server/tracks-service.ts`
- Modify: `src/features/app-shell/api/app-shell-contracts.ts`
- Modify: `src/features/app-shell/server/app-shell-service.ts`
- Modify: `src/features/app-shell/domain/popup-app-shell.ts`
- Modify: `src/extension/background/register-handlers.ts`

**Expected test files:**

- Modify: `src/features/tracks/server/tracks-service.test.ts`
- Modify: `src/features/app-shell/server/app-shell-service.test.ts`
- Modify: `src/extension/background/register-handlers.test.ts`

**Guardrails:**

- Target production delta: 150-300 net LOC.
- Stop and reassess if production delta exceeds 350 net LOC.
- Target total delta: 450-800 net LOC including tests.
- Stop and reassess if total delta exceeds 1,000 LOC.
- Do not add Overview UI, Library track creation, target-date pacing, a new transport, a global store, or a schema migration.

- [ ] **Step 1: Verify branch and clean state**

Run:

```bash
git status --short --branch
```

Expected:

```text
## codex/tracks-phase-3-2
```

No uncommitted production changes should be present before Task 1 begins.

- [ ] **Step 2: Estimate post-plan touch set**

Run:

```bash
git diff --stat
```

Expected before code edits: no implementation diff. After each task, check that only the task's files changed.

---

### Task 1: Add failing service tests for shared active-track guidance

**Files:**

- Modify: `src/features/tracks/server/tracks-service.test.ts`

- [ ] **Step 1: Add tests that expose the current mismatch**

Add these tests after the existing test named `chooses next problem from incomplete active rows by due, non-suspended, then null`:

```ts
  it('uses the workspace next-problem algorithm for direct active-track reads', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })

    await addActiveTrackMembership(handle.db, {
      groupId: 'leetcode-75:stack',
      groupTitle: 'Stack',
      problemSlug: 'valid-parentheses',
      groupPosition: 2,
    })
    await makeProblemDue(handle.db, 'valid-parentheses', {
      now: new Date('2026-01-10T12:00:00.000Z'),
    })

    const activeTrack = await getActiveTrack(
      handle.db,
      new Date('2026-01-10T12:00:00.000Z'),
    )

    expect(activeTrack?.nextProblem?.slug).toBe('valid-parentheses')
  })

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

- [ ] **Step 2: Run the focused failing tests**

Run:

```bash
npm run test -- src/features/tracks/server/tracks-service.test.ts
```

Expected: the new direct active-track tests fail because `getActiveTrack` still uses the repository's ordered-only `getNextProblemInTrack` path.

- [ ] **Step 3: Commit failing tests**

```bash
git add src/features/tracks/server/tracks-service.test.ts
git commit -m "test: cover shared active track guidance"
```

---

### Task 2: Implement the Tracks-owned guidance resolver

**Files:**

- Modify: `src/features/tracks/server/tracks-service.ts`
- Modify: `src/features/tracks/server/tracks-service.test.ts`

- [ ] **Step 1: Update imports and `getActiveTrack` signature**

In `src/features/tracks/server/tracks-service.ts`, add `Problem` and `SerializedProblem` type imports:

```ts
import type { Problem } from '@/features/problems'
import type { SerializedProblem } from '@/features/problems/api/problems-contracts'
import type { Track, TrackGroup, TrackSessionState } from '../domain/track'
```

Change the active-track read signature:

```ts
export async function getActiveTrack(db: Db, now = new Date()) {
  const settings = await getSettings(db)

  if (settings.practice.mode === 'freePractice') {
    return null
  }

  const repository = createTracksRepository(db)
  const guidance = await readActiveTrackGuidance(db, repository, now)

  if (!guidance.activeTrack) {
    return null
  }

  return {
    track: guidance.activeTrack.track,
    activeGroup: guidance.activeTrack.activeGroup,
    progress: guidance.activeTrack.progress,
    nextProblem: guidance.activeTrack.nextProblem
      ? deserializeProblem(guidance.activeTrack.nextProblem)
      : null,
  }
}
```

- [ ] **Step 2: Route `getWorkspace` through the same guidance helper**

Replace the active-track block in `getWorkspace` after the catalog/session read with:

```ts
  const guidance = await readActiveTrackGuidance(db, repository, generatedAt, {
    catalog,
    session,
  })

  return serializeTrackWorkspace({
    generatedAt,
    activeTrack: guidance.activeTrack,
    tracks: catalog,
    activeTrackGroups: guidance.activeTrackGroups,
    activeTrackRows: guidance.activeTrackRows,
    dueCount: guidance.dueCount,
  })
```

Remove the old early return and duplicated `activeTrackGroups`, `activeTrackMemberships`, `incompleteRows`, and `nextRow` logic from `getWorkspace`.

- [ ] **Step 3: Add the shared helper types and functions**

Add these helpers below `resetTrackProgress`/`recordActiveTrackProblemCompletion` and above `readTrackProblemRows`:

```ts
type ActiveTrackGuidanceInput = {
  catalog?: readonly { track: Track; progress: TrackProgress }[]
  session?: TrackSessionState
}

type ActiveTrackGuidance = {
  activeTrack: {
    track: Track
    activeGroup: TrackGroup | null
    progress: TrackProgress
    nextProblem: SerializedProblem | null
  } | null
  activeTrackGroups: TrackGroup[]
  activeTrackRows: TrackProblemRowSerializationInput[]
  dueCount: number
}

async function readActiveTrackGuidance(
  db: Db,
  repository: ReturnType<typeof createTracksRepository>,
  generatedAt: Date,
  input: ActiveTrackGuidanceInput = {},
): Promise<ActiveTrackGuidance> {
  const [catalog, session] = await Promise.all([
    input.catalog ?? repository.getTrackCatalog(),
    input.session ?? repository.getSession(),
  ])

  if (!session.activeTrack) {
    return {
      activeTrack: null,
      activeTrackGroups: [],
      activeTrackRows: [],
      dueCount: 0,
    }
  }

  const [activeTrackGroups, activeTrackMemberships] = await Promise.all([
    repository.getGroups(session.activeTrack.id),
    repository.getMemberships(session.activeTrack.id),
  ])
  const activeTrackRows = await readTrackProblemRows(
    db,
    activeTrackMemberships,
    generatedAt,
  )
  const { nextRow, dueCount } = selectActiveTrackNextRow(activeTrackRows)

  return {
    activeTrack: {
      track: session.activeTrack,
      activeGroup: session.activeGroup ?? activeTrackGroups[0] ?? null,
      progress: readCatalogProgress(catalog, session.activeTrack.id),
      nextProblem: nextRow?.problem ?? null,
    },
    activeTrackGroups,
    activeTrackRows,
    dueCount,
  }
}

function selectActiveTrackNextRow(
  rows: readonly TrackProblemRowSerializationInput[],
) {
  const incompleteRows = rows.filter((row) => !row.membership.completedAt)
  const nextRow =
    incompleteRows.find((row) => row.status === 'due') ??
    incompleteRows.find((row) => row.status !== 'suspended') ??
    null

  return {
    nextRow,
    dueCount: incompleteRows.filter((row) => row.status === 'due').length,
  }
}

function deserializeProblem(problem: SerializedProblem): Problem {
  return {
    ...problem,
    createdAt: new Date(problem.createdAt),
    updatedAt: new Date(problem.updatedAt),
  }
}
```

- [ ] **Step 4: Run the Tracks service tests**

Run:

```bash
npm run test -- src/features/tracks/server/tracks-service.test.ts
```

Expected: all tests in the file pass.

- [ ] **Step 5: Commit the resolver implementation**

```bash
git add src/features/tracks/server/tracks-service.ts src/features/tracks/server/tracks-service.test.ts
git commit -m "fix: share active track guidance selection"
```

---

### Task 3: Adapt app-shell to explicit active-track guidance states

**Files:**

- Modify: `src/features/app-shell/api/app-shell-contracts.ts`
- Modify: `src/features/app-shell/server/app-shell-service.ts`
- Modify: `src/features/app-shell/domain/popup-app-shell.ts`
- Modify: `src/features/app-shell/server/app-shell-service.test.ts`

- [ ] **Step 1: Add failing app-shell expectations**

In `src/features/app-shell/server/app-shell-service.test.ts`, update the popup composition expectation to include `state: 'ready'`:

```ts
      activeTrack: {
        state: 'ready',
        trackId: 'leetcode-75',
        title: 'LeetCode 75',
```

Update the free-practice test expectation:

```ts
    expect(payload.activeTrack).toMatchObject({
      state: 'disabled-free-practice',
      trackId: null,
      title: 'Track guidance disabled',
      nextProblem: null,
    })
```

Add this test after the ledger progress test:

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

- [ ] **Step 2: Run the focused failing app-shell tests**

Run:

```bash
npm run test -- src/features/app-shell/server/app-shell-service.test.ts
```

Expected: app-shell schema parsing fails because `activeTrack.state` does not exist yet.

- [ ] **Step 3: Add `state` to the app-shell contract**

In `src/features/app-shell/api/app-shell-contracts.ts`, add:

```ts
const appShellActiveTrackStateSchema = z.enum([
  'disabled-free-practice',
  'no-active-track',
  'ready',
  'exhausted',
])
```

Then add `state` to `appShellActiveTrackSchema`:

```ts
const appShellActiveTrackSchema = z.object({
  state: appShellActiveTrackStateSchema,
  trackId: z.string().nullable(),
  title: z.string(),
```

- [ ] **Step 4: Pass `now` and settings mode into app-shell active-track serialization**

In `src/features/app-shell/server/app-shell-service.ts`, update active-track reads:

```ts
  const activeTrack = await getActiveTrack(db, now)
```

Use that form in both `getMainAppShellData` and `getOverlayPayload`.

Change the base payload call:

```ts
    activeTrack: serializeActiveTrack(activeTrack, settings.practice.mode),
```

Change the serializer signature and empty-state handling:

```ts
function serializeActiveTrack(
  activeTrack: ActiveTrack | null,
  practiceMode: UserSettings['practice']['mode'],
) {
  if (practiceMode === 'freePractice') {
    return {
      state: 'disabled-free-practice' as const,
      trackId: null,
      title: 'Track guidance disabled',
      description: null,
      groupTitle: null,
      dueAt: null,
      progress: {
        completedCount: 0,
        totalCount: 0,
        percent: 0,
      },
      detail: 'Free Practice uses queue recommendations only.',
      nextProblem: null,
    }
  }

  if (!activeTrack) {
    return {
      state: 'no-active-track' as const,
      trackId: null,
      title: 'No active track',
      description: null,
      groupTitle: null,
      dueAt: null,
      progress: {
        completedCount: 0,
        totalCount: 0,
        percent: 0,
      },
      detail: 'Choose a track to restore guided progression.',
      nextProblem: null,
    }
  }

  return {
    state: activeTrack.nextProblem ? ('ready' as const) : ('exhausted' as const),
    trackId: activeTrack.track.id,
    title: activeTrack.track.title,
    description: activeTrack.track.description,
    groupTitle: activeTrack.activeGroup?.title ?? null,
    dueAt: activeTrack.track.dueAt?.toISOString() ?? null,
    progress: activeTrack.progress,
    detail: readActiveTrackDetail(activeTrack),
    nextProblem: activeTrack.nextProblem
      ? serializeProblemSummary(activeTrack.nextProblem)
      : null,
  }
}

function readActiveTrackDetail(activeTrack: ActiveTrack) {
  if (activeTrack.nextProblem) {
    return `Next: ${activeTrack.nextProblem.title}`
  }

  return 'No more problems in track.'
}
```

- [ ] **Step 5: Keep popup view rendering derived from app-shell state**

In `src/features/app-shell/domain/popup-app-shell.ts`, update `readActiveTrackBody`:

```ts
  if (activeTrack.state === 'disabled-free-practice') {
    return 'Queue-first practice without track guidance.'
  }

  if (!activeTrack.trackId) {
    return 'Choose a track in the dashboard to restore guided progression.'
  }

  if (activeTrack.state === 'exhausted') {
    return 'No more problems in track.'
  }
```

Leave recommendation shuffle behavior unchanged.

- [ ] **Step 6: Run app-shell tests**

Run:

```bash
npm run test -- src/features/app-shell/server/app-shell-service.test.ts src/features/app-shell/hooks/use-popup-app-shell-controller.test.tsx
```

Expected: all tests pass. If controller fixture data needs the new `state` field, add `state: 'ready'` or the correct state to the fixture objects only.

- [ ] **Step 7: Commit app-shell adaptation**

```bash
git add src/features/app-shell/api/app-shell-contracts.ts src/features/app-shell/server/app-shell-service.ts src/features/app-shell/domain/popup-app-shell.ts src/features/app-shell/server/app-shell-service.test.ts src/features/app-shell/hooks/use-popup-app-shell-controller.test.tsx
git commit -m "fix: expose active track guidance states"
```

---

### Task 4: Block active-track progress writes in Free Practice

**Files:**

- Modify: `src/extension/background/register-handlers.ts`
- Modify: `src/extension/background/register-handlers.test.ts`

- [ ] **Step 1: Add a failing runtime test**

In `src/extension/background/register-handlers.test.ts`, add this test after `records active-track progress for easy saved reviews`:

```ts
  it('does not record active-track progress for free-practice saved reviews', async () => {
    resetRuntimeMutationMocks()
    backgroundMocks.getSettings.mockResolvedValueOnce({
      ...defaultUserSettings,
      practice: {
        ...defaultUserSettings.practice,
        mode: 'freePractice',
      },
    })

    await sendRuntimeMessage('practice.saveReviewResult', {
      surface: 'dashboard',
      problemSlug: 'two-sum',
      rating: 'good',
      reviewedAt: '2026-01-05T00:00:00.000Z',
    })

    expect(
      backgroundMocks.recordActiveTrackProblemCompletion,
    ).not.toHaveBeenCalled()
    expect(backgroundMocks.broadcastCacheInvalidation).toHaveBeenCalledWith({
      problemSlug: 'two-sum',
      reason: 'practice-updated',
      source: 'dashboard',
      tags: ['practice', 'problems', 'queue', 'app-shell', 'tracks'],
    })
  })
```

- [ ] **Step 2: Run the focused failing runtime test file**

Run:

```bash
npm run test -- src/extension/background/register-handlers.test.ts
```

Expected: the new test fails because the handler records track completion for Good/Easy even in Free Practice.

- [ ] **Step 3: Guard the practice save completion side effect**

In `src/extension/background/register-handlers.ts`, change:

```ts
        if (isTrackCompletionRating(request.rating)) {
```

to:

```ts
        if (
          settings.practice.mode === 'studyPlan' &&
          isTrackCompletionRating(request.rating)
        ) {
```

- [ ] **Step 4: Run runtime handler tests**

Run:

```bash
npm run test -- src/extension/background/register-handlers.test.ts
```

Expected: all tests in the file pass.

- [ ] **Step 5: Commit the Free Practice guard**

```bash
git add src/extension/background/register-handlers.ts src/extension/background/register-handlers.test.ts
git commit -m "fix: skip track progress in free practice"
```

---

### Task 5: Verify integration and scope budget

**Files:**

- No production files unless verification finds a Phase 3.2 regression.

- [ ] **Step 1: Run focused Phase 3.2 tests**

Run:

```bash
npm run test -- src/features/tracks/server/tracks-service.test.ts src/features/app-shell/server/app-shell-service.test.ts src/features/app-shell/hooks/use-popup-app-shell-controller.test.tsx src/extension/background/register-handlers.test.ts
```

Expected: all focused tests pass.

- [ ] **Step 2: Run full project check**

Run:

```bash
npm run check
```

Expected: `db:check`, `typecheck`, `lint`, and `test` all pass.

- [ ] **Step 3: Check scope guardrails**

Run:

```bash
git diff --stat origin/main...HEAD
git diff --numstat origin/main...HEAD -- 'src/**/*.ts' 'src/**/*.tsx'
```

Expected:

- Production delta remains under 350 net LOC.
- Total delta remains under 1,000 LOC.
- Production files stay close to the five-file target.

If the budget is exceeded, stop before adding more code and remove nonessential contract churn or test duplication.

- [ ] **Step 4: Final status**

Run:

```bash
git status --short --branch
git log --oneline --decorate -8
```

Expected: branch `codex/tracks-phase-3-2` contains the plan/spec commits plus the focused implementation commits.
