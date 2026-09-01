# Track Simple Recall Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `hard`, `good`, and `easy` complete active-track problems while `again` remains incomplete, preserving the original FSRS rating across persistence, runtime contracts, backup, and review corrections.

**Architecture:** FSRS continues to schedule practice cards, while Tracks owns the separate curriculum-completion decision. Widen the existing Tracks completion-rating union and shared Zod schema, then widen the repository parser and SQLite constraint through a generated migration; keep the current practice/track transaction workflow, runtime methods, and invalidation behavior unchanged.

**Tech Stack:** TypeScript 6, Vitest, Zod 4, Drizzle ORM/Kit, SQLite WASM, WXT Chrome MV3.

---

## Locked Decisions

- Simple recall means `hard | good | easy`; `again` is the only non-completing review rating.
- Persist the original recalled rating. Do not coerce `hard` to `good`.
- A later `again` review does not undo an existing completion.
- Correcting the controlling attempt to `again` clears completion; correcting it to any recalled rating completes or updates it.
- Free Practice, track reset, runtime methods, cache invalidation, backup version, sync envelope version, and FSRS scheduling remain unchanged.
- The schema migration must preserve existing `good` and `easy` progress rows.

## File Structure

- `src/features/tracks/domain/track.ts`: widen the domain completion-rating union.
- `src/features/tracks/api/tracks-contracts.ts`: widen the shared runtime/backup Zod completion-rating schema.
- `src/features/tracks/api/tracks-contracts.test.ts`: prove runtime rows accept `hard` and reject `again` as completion.
- `src/features/backup/api/backup-contracts.test.ts`: prove current backups accept and preserve `hard` through the shared schema.
- `src/features/tracks/data/tracks-repository.ts`: classify `hard` as a completing rating.
- `src/features/tracks/data/tracks-repository.test.ts`: prove initial and later hard reviews persist complete track progress.
- `src/features/practice/practice-core.integration.test.ts`: prove save and correction behavior across the practice/track transaction workflow.
- `src/platform/db/schema/track-problem-progress.ts`: widen the SQLite completion-pair check constraint.
- `src/platform/db/migrations/0007_track_simple_recall.sql`: generated SQLite table-rebuild migration.
- `src/platform/db/migrations/meta/0007_snapshot.json`: generated Drizzle schema snapshot.
- `src/platform/db/migrations/meta/_journal.json`: generated migration journal entry.
- `docs/product.md`: document the current simple-recall track policy.
- `docs/testing.md`: document the required hard/again manual smoke flow.

### Task 1: Widen Track And Backup Contracts

**Files:**

- Modify: `src/features/tracks/api/tracks-contracts.test.ts`
- Modify: `src/features/backup/api/backup-contracts.test.ts`
- Modify: `src/features/tracks/api/tracks-contracts.ts`
- Modify: `src/features/tracks/domain/track.ts`

- [ ] **Step 1: Write the failing track contract expectations**

Replace the completion-rating assertions in `src/features/tracks/api/tracks-contracts.test.ts` with:

```ts
it('only accepts recalled ratings that can complete track progress', () => {
  expect(trackCompletedRatingSchema.safeParse('hard').success).toBe(true)
  expect(trackCompletedRatingSchema.safeParse('good').success).toBe(true)
  expect(trackCompletedRatingSchema.safeParse('easy').success).toBe(true)
  expect(trackCompletedRatingSchema.safeParse('again').success).toBe(false)
})
```

Change the completed row in `accepts serialized track problem completion states` to use and expect `completedRating: 'hard'`. This proves the full serialized completion union accepts the new recalled rating, not only the standalone enum.

- [ ] **Step 2: Write the failing backup contract expectation**

Add this test to `src/features/backup/api/backup-contracts.test.ts`:

```ts
it('preserves hard as a recalled track completion rating', () => {
  const backup = createValidBackupFixture()
  const [progress] = backup.data.tracks.progress

  if (!progress) {
    throw new Error('Expected the backup fixture to include track progress.')
  }

  progress.completedRating = 'hard'

  expect(
    parseBackupFileForCurrentApp(backup).data.tracks.progress[0]
      ?.completedRating,
  ).toBe('hard')
})
```

- [ ] **Step 3: Run the contract tests and verify RED**

Run:

```sh
npm run test -- src/features/tracks/api/tracks-contracts.test.ts src/features/backup/api/backup-contracts.test.ts
```

Expected: FAIL because `trackCompletedRatingSchema` rejects `hard`.

- [ ] **Step 4: Widen the domain and shared Zod rating sets**

In `src/features/tracks/domain/track.ts`, change the domain type to:

```ts
export type TrackCompletedRating = 'hard' | 'good' | 'easy'
```

In `src/features/tracks/api/tracks-contracts.ts`, change the shared schema to:

```ts
export const trackCompletedRatingSchema = z.enum(['hard', 'good', 'easy'])
```

Do not add a backup-specific rating schema; `backup-contracts.ts` already imports this shared Tracks schema.

- [ ] **Step 5: Run the contract tests and verify GREEN**

Run:

```sh
npm run test -- src/features/tracks/api/tracks-contracts.test.ts src/features/backup/api/backup-contracts.test.ts
```

Expected: PASS with no warnings or unhandled errors.

- [ ] **Step 6: Commit the contract change**

```sh
git add src/features/tracks/domain/track.ts src/features/tracks/api/tracks-contracts.ts src/features/tracks/api/tracks-contracts.test.ts src/features/backup/api/backup-contracts.test.ts
git commit -m "feat(tracks): define simple recall completion ratings"
```

### Task 2: Persist Hard As Completed Track Progress

**Files:**

- Modify: `src/features/tracks/data/tracks-repository.test.ts`
- Modify: `src/features/practice/practice-core.integration.test.ts`
- Modify: `src/features/tracks/data/tracks-repository.ts`
- Modify: `src/platform/db/schema/track-problem-progress.ts`
- Create: `src/platform/db/migrations/0007_track_simple_recall.sql`
- Create: `src/platform/db/migrations/meta/0007_snapshot.json`
- Modify: `src/platform/db/migrations/meta/_journal.json`

- [ ] **Step 1: Change the repository hard-review test to expect completion**

Rename `stores incomplete active-track progress for hard review attempts` to `completes active-track progress for hard review attempts`, then replace its final expectation with:

```ts
await expect(
  handle.db.select().from(trackProblemProgress),
).resolves.toMatchObject([
  {
    trackId: 'leetcode-75',
    problemSlug: 'two-sum',
    reviewAttemptId: 'review-hard-1',
    completedAt: reviewedAt.getTime(),
    completedRating: 'hard',
  },
])
```

In `keeps completed active-track progress when a later hard review is saved`, keep the two review writes but change the expected controlling completion to:

```ts
expect(progressRows).toMatchObject([
  {
    trackId: 'leetcode-75',
    problemSlug: 'two-sum',
    reviewAttemptId: 'review-hard-after-good',
    completedAt: hardReviewedAt.getTime(),
    completedRating: 'hard',
  },
])
```

This matches existing behavior for later recalled ratings: the latest recalled attempt controls the still-complete row.

- [ ] **Step 2: Change the practice/track integration matrix**

Rename `study plan review writes incomplete active-track progress for hard and again ratings` to `study plan review completes hard recall but keeps again incomplete`.

After the hard review, expect one completion:

```ts
const catalogAfterHard = await tracksRepository.getTrackCatalog()
expect(readTrackProgress(catalogAfterHard, 'leetcode-75').completedCount).toBe(
  1,
)
```

After the separate `again` review, keep the count at one and expect one completed row plus one incomplete row:

```ts
const catalogAfterAgain = await tracksRepository.getTrackCatalog()
expect(readTrackProgress(catalogAfterAgain, 'leetcode-75').completedCount).toBe(
  1,
)

const progressRows = await handle.db.select().from(trackProblemProgress)
expect(progressRows).toEqual(
  expect.arrayContaining([
    expect.objectContaining({
      trackId: 'leetcode-75',
      problemSlug: 'two-sum',
      reviewAttemptId: 'workflow-hard-1',
      completedAt: new Date('2026-01-01T10:00:00.000Z').getTime(),
      completedRating: 'hard',
    }),
    expect.objectContaining({
      trackId: 'leetcode-75',
      problemSlug: 'valid-parentheses',
      reviewAttemptId: 'workflow-again-1',
      completedAt: null,
      completedRating: null,
    }),
  ]),
)
```

Rename `study plan override from good to hard clears active-track completion for the sourced attempt` to `study plan override from good to hard keeps active-track completion`. After the override, assert both the count and rating:

```ts
const catalog = await tracksRepository.getTrackCatalog()
const [progress] = await handle.db.select().from(trackProblemProgress)

expect(readTrackProgress(catalog, 'leetcode-75').completedCount).toBe(1)
expect(progress).toMatchObject({
  reviewAttemptId: 'workflow-good-to-hard-1',
  completedRating: 'hard',
})
```

Rename `study plan override from hard to good restores active-track completion for the sourced attempt` to `study plan override from hard to good keeps active-track completion and updates the rating`. Assert completion is one before the override, then assert it remains one and the stored rating becomes `good` afterward.

Keep the existing `easy -> again`, `again -> easy`, reset, older-attempt, and Free Practice tests unchanged; they cover the non-recall and ownership boundaries.

- [ ] **Step 3: Run focused behavior tests and verify RED**

Run:

```sh
npm run test -- src/features/tracks/data/tracks-repository.test.ts src/features/practice/practice-core.integration.test.ts
```

Expected: FAIL because the repository still maps `hard` to incomplete progress. The current migration constraint also does not permit a persisted `hard` completion.

- [ ] **Step 4: Widen the repository completion parser**

In `src/features/tracks/data/tracks-repository.ts`, replace `parseTrackCompletedRating` with:

```ts
function parseTrackCompletedRating(
  rating: string | null,
): TrackCompletedRating | null {
  if (rating === 'hard' || rating === 'good' || rating === 'easy') {
    return rating
  }

  return null
}
```

Do not alter the existing completed-row preservation branch. It still prevents a later `again` review from clearing an already completed problem while allowing a correction of the controlling attempt to reconcile the stored state.

- [ ] **Step 5: Widen the Drizzle check constraint**

In `src/platform/db/schema/track-problem-progress.ts`, change only the allowed rating set inside `track_problem_progress_completion_pair_check`:

```ts
check(
  'track_problem_progress_completion_pair_check',
  sql`((${table.completedAt} is null and ${table.completedRating} is null) or (${table.completedAt} is not null and ${table.completedRating} is not null and ${table.completedRating} in ('hard', 'good', 'easy')))`,
),
```

- [ ] **Step 6: Generate the deterministic migration**

Run:

```sh
npm run db:generate -- --name track_simple_recall
```

Expected: Drizzle creates exactly:

- `src/platform/db/migrations/0007_track_simple_recall.sql`
- `src/platform/db/migrations/meta/0007_snapshot.json`
- a new `0007_track_simple_recall` entry in `src/platform/db/migrations/meta/_journal.json`

Inspect `0007_track_simple_recall.sql`. It must rebuild `track_problem_progress`, copy every existing column and row into the replacement table, preserve the primary key, foreign keys, and indexes, and change only the completion constraint to `in ('hard', 'good', 'easy')`.

- [ ] **Step 7: Run focused database and behavior validation**

Run:

```sh
npm run db:check
npm run test -- src/features/tracks/data/tracks-repository.test.ts src/features/practice/practice-core.integration.test.ts src/testing/db-foundation.test.ts
```

Expected: PASS. The repository test proves a fresh database built from migration SQL accepts `hard`; `db:check` proves the schema snapshot and migration history agree; the existing DB foundation test proves the full migration chain still boots and seeds.

- [ ] **Step 8: Commit persistence and migration**

```sh
git add src/features/tracks/data/tracks-repository.ts src/features/tracks/data/tracks-repository.test.ts src/features/practice/practice-core.integration.test.ts src/platform/db/schema/track-problem-progress.ts src/platform/db/migrations/0007_track_simple_recall.sql src/platform/db/migrations/meta/0007_snapshot.json src/platform/db/migrations/meta/_journal.json
git commit -m "feat(tracks): count hard recall as completion"
```

### Task 3: Document Current Product Behavior And Smoke Proof

**Files:**

- Modify: `docs/product.md`
- Modify: `docs/testing.md`

- [ ] **Step 1: Document the completion policy in product authority**

Add this paragraph to `docs/product.md` under `### Tracks`:

```md
Active-track completion follows simple recall: `hard`, `good`, and `easy`
reviews complete a track problem, while `again` leaves it incomplete. FSRS
scheduling and global practice history remain separate from track completion.
```

- [ ] **Step 2: Add the manual Tracks and cross-surface smoke cases**

In `docs/testing.md`, replace the existing reset step 7 with these steps:

```md
7. From the overlay, save a `hard` review for an incomplete problem in the
   active track, then confirm Tracks counts it complete and advances guidance.
8. Reset that track's progress only when intentionally testing reset behavior,
   save an `again` review for the same active-track problem, and confirm it
   remains incomplete.
```

Extend the expected result with:

```md
`hard`, `good`, and `easy` count as recalled track completions; `again` does
not.
```

Keep the existing Cross-Surface Refresh flow; these new steps already require checking the overlay-to-dashboard transition.

- [ ] **Step 3: Run Markdown formatting validation**

Run:

```sh
npx prettier --check docs/product.md docs/testing.md
```

Expected: PASS.

- [ ] **Step 4: Commit the authority-doc update**

```sh
git add docs/product.md docs/testing.md
git commit -m "docs(tracks): document simple recall progress"
```

### Task 4: Run Required Validation And Prepare Handoff

**Files:**

- Verify all files changed by Tasks 1-3.

- [ ] **Step 1: Run the complete automated validation matrix**

Run exactly:

```sh
npm run db:check
npm run lint
npm run check
npm run build
```

Expected: all commands PASS with no warnings or unhandled errors. `npm run check` repeats DB, type, lint, and full Vitest validation by repository policy; `npm run build` proves the changed cross-surface behavior still packages as a Chrome MV3 extension. Record every exact invocation in the handoff.

- [ ] **Step 2: Inspect the final change set**

Run:

```sh
git status --short --branch
git diff origin/main...HEAD --check
git diff origin/main...HEAD --stat
git log --oneline origin/main..HEAD
```

Expected: the worktree is clean; the diff contains only the approved design/plan, completion policy, generated migration, focused tests, and authority-doc updates; `git diff --check` produces no output.

- [ ] **Step 3: Prepare the required human smoke checklist**

The PR-ready handoff must leave these items unchecked for a human engineer:

```md
- [ ] Happy path: in Study Plan mode, save `hard` for an incomplete active-track
      problem and confirm Tracks progress increments and next guidance advances.
- [ ] Existing recalled ratings: repeat with `good` and `easy` and confirm both
      still complete progress.
- [ ] Edge path: after resetting track progress, save `again` and confirm the
      problem remains incomplete and guidance does not advance.
- [ ] Correction path: change the controlling review between `again` and
      `hard`, then confirm completion clears and restores without changing
      global practice history ownership.
- [ ] Cross-surface refresh: confirm overlay save, popup guidance, and dashboard
      Tracks progress agree after each rating.
- [ ] Attach screenshot or screen-recording proof of the `hard` happy path and
      `again` edge path before PR review or merge.
```

State that automated checks do not replace this real-time extension smoke proof. Note that sender authorization, runtime payload routing, secrets, permissions, and sync orchestration were not changed; the shared backup/sync completion schema now accepts `hard` without a version bump. Note that the migration preserves existing rows, but extension developers should still back up disposable local data before testing any migration because the local database fingerprint changes.

## Done When

- `hard`, `good`, and `easy` persist as completed active-track ratings.
- `again` remains incomplete.
- Save, later-review, controlling-correction, reset, Free Practice, runtime serialization, backup parsing, and migration behavior are covered.
- Existing backup and sync shapes remain compatible without a version bump.
- Product and testing authority docs describe the shipped policy.
- Focused tests, `npm run db:check`, `npm run lint`, `npm run check`, and
  `npm run build` pass.
- The handoff lists exact commands run, exact commands skipped with reasons, remaining risk, and the required unchecked human smoke/visual-proof checklist.
