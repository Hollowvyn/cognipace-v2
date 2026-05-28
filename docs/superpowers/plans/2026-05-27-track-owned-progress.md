# Track-Owned Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace group-owned track progress with track/problem-owned progress and correction-aware active-track review reconciliation.

**Architecture:** Tracks own curriculum membership and progress state; practice owns FSRS cards, review attempts, and global practice aggregates. A small practice server workflow composes the two feature services inside one database transaction so save/override writes remain atomic. Runtime handlers stay thin: parse, authorize, call the workflow, read fresh details, flush snapshots, and broadcast invalidation.

**Tech Stack:** TypeScript, Drizzle SQLite schema and migrations, Zod runtime/backup contracts, WXT runtime messaging, TanStack Query invalidation, Vitest.

---

## Locked Decisions

- One problem can appear at most once per track.
- `track_group_problems.track_id` becomes required and is unique with `problem_slug`.
- `track_problem_progress` is keyed by `(track_id, problem_slug)`.
- `track_problem_progress.review_attempt_id` is nullable in storage so legacy backups and global practice resets can preserve existing track progress after the source attempt is gone.
- New Study Plan review writes always include `reviewAttemptId`.
- `completed_at` and `completed_rating` are nullable as a pair. They are both present only for `good` or `easy`.
- `hard` and `again` write an incomplete progress state row when the problem belongs to the active track. That row does not count as complete, but lets a later override of the same attempt complete the track problem.
- Override reconciliation only updates an existing progress row whose `review_attempt_id` matches the overridden review attempt.
- Track reset deletes progress rows by `track_id`. Old practice overrides do not recreate deleted rows.
- Backup schema version bumps from `1` to `2`; exported backups use the v2 shape, and restore accepts v1 and v2 by normalizing v1 progress rows through their group track ids.
- Existing duplicate memberships in one track fail during migration or restore validation. The implementation does not silently drop user data.

## File Structure

- `src/platform/db/schema/track-groups.ts`: add composite identity support for group id + track id.
- `src/platform/db/schema/track-group-problems.ts`: add `trackId`, composite group/track FK, and unique track/problem identity.
- `src/platform/db/schema/track-problem-progress.ts`: replace `trackGroupId` with `trackId`, add nullable `reviewAttemptId`, nullable completion pair checks, and track/problem membership FK.
- `src/platform/db/seed.ts`: insert membership rows with `trackId`.
- `src/platform/db/migrations/*`: generated Drizzle migration and metadata.
- `src/features/tracks/domain/track.ts`: define track completion and review-progress input types.
- `src/features/tracks/data/tracks-repository.ts`: read/write progress by track/problem and remove group-move rescue logic.
- `src/features/tracks/server/tracks-service.ts`: expose track-owned review reconciliation functions.
- `src/features/tracks/api/tracks-contracts.ts`: validate serialized track completion state.
- `src/features/tracks/api/tracks-serializers.ts`: serialize the completion union.
- `src/features/tracks/components/active-track-workspace.tsx`: read completion state from the union.
- `src/features/practice/domain/practice.ts`: include `reviewAttemptId` in `ReviewResult`.
- `src/features/practice/data/practice-repository.ts`: return attempt ids and add transaction-scoped save/override helpers.
- `src/features/practice/server/practice-review-workflow.ts`: coordinate practice writes and track reconciliation in one transaction.
- `src/features/practice/server/practice-service.ts`: export workflow functions.
- `src/extension/background/register-handlers.ts`: call the workflow instead of coordinating tracks inline.
- `src/features/backup/api/backup-contracts.ts`: add backup v1/v2 parsing and v2 export types.
- `src/features/backup/data/backup-repository.ts`: export/import track-owned progress rows.
- `src/features/backup/server/backup-service.ts`: tighten restore validation.
- Focused tests in the matching `*.test.ts` and `*.test.tsx` files.

---

### Task 1: Write Failing Track Repository Tests

**Files:**

- Modify: `src/features/tracks/data/tracks-repository.test.ts`

- [ ] **Step 1: Add tests for track-owned progress identity**

Add these imports if missing:

```ts
import { asc, eq } from 'drizzle-orm'
import { fsrsCards, reviewAttempts } from '@/platform/db/schema'
```

Add this helper near `makeLeetCodeActive`:

```ts
async function insertReviewAttempt(
  db: Db,
  input: {
    id: string
    problemSlug: string
    rating: 'again' | 'hard' | 'good' | 'easy'
    reviewedAt: Date
  },
) {
  const timestamp = input.reviewedAt.getTime()
  const cardId = `${input.problemSlug}:default`

  await db.insert(fsrsCards).values({
    id: cardId,
    problemSlug: input.problemSlug,
    cardKind: 'default',
    dueAt: timestamp,
    stability: 0,
    difficulty: 0,
    elapsedDays: 0,
    scheduledDays: 0,
    learningSteps: 0,
    reps: 0,
    lapses: 0,
    state: 'new',
    lastReviewAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  })

  await db.insert(reviewAttempts).values({
    id: input.id,
    problemSlug: input.problemSlug,
    cardId,
    rating: input.rating,
    reviewMode: 'manual',
    reviewedAt: timestamp,
    elapsedSeconds: null,
    isCorrect: null,
    interviewPattern: null,
    timeComplexity: null,
    spaceComplexity: null,
    languages: null,
    notes: null,
    fsrsReviewLog: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
}
```

Add these tests under the existing repository progress tests:

```ts
it('keeps progress when a completed problem moves between groups in the same track', async () => {
  const handle = await createTestDb({
    now: new Date('2026-01-01T00:00:00.000Z'),
  })
  const timestamp = new Date('2026-01-02T00:00:00.000Z')
  const repository = createTracksRepository(handle.db)

  await makeLeetCodeActive(handle.db)
  await insertReviewAttempt(handle.db, {
    id: 'review-two-sum-1',
    problemSlug: 'two-sum',
    rating: 'good',
    reviewedAt: timestamp,
  })
  await handle.db.insert(trackProblemProgress).values({
    trackId: 'leetcode-75',
    problemSlug: 'two-sum',
    reviewAttemptId: 'review-two-sum-1',
    completedAt: timestamp.getTime(),
    completedRating: 'good',
    createdAt: timestamp.getTime(),
    updatedAt: timestamp.getTime(),
  })

  await repository.updateTrack({
    trackId: 'leetcode-75',
    title: 'LeetCode 75',
    description: 'Focused starter track for high-signal interview patterns.',
    dueAt: null,
    groups: [
      {
        id: 'leetcode-75:arrays-hashing',
        title: 'Arrays and Hashing',
        problemSlugs: [],
      },
      {
        id: 'leetcode-75:stack',
        title: 'Stack',
        problemSlugs: ['valid-parentheses', 'two-sum'],
      },
    ],
  })

  const progressRows = await handle.db
    .select()
    .from(trackProblemProgress)
    .orderBy(
      asc(trackProblemProgress.trackId),
      asc(trackProblemProgress.problemSlug),
    )

  expect(progressRows).toMatchObject([
    {
      trackId: 'leetcode-75',
      problemSlug: 'two-sum',
      reviewAttemptId: 'review-two-sum-1',
      completedRating: 'good',
    },
  ])
})

it('stores incomplete active-track progress for hard review attempts', async () => {
  const handle = await createTestDb({
    now: new Date('2026-01-01T00:00:00.000Z'),
  })
  const repository = createTracksRepository(handle.db)

  await makeLeetCodeActive(handle.db)

  await expect(
    repository.recordActiveTrackProblemReview({
      problemSlug: 'two-sum',
      rating: 'hard',
      reviewedAt: new Date('2026-01-02T00:00:00.000Z'),
      reviewAttemptId: 'review-hard-1',
    }),
  ).resolves.toBe(true)

  await expect(
    handle.db.select().from(trackProblemProgress),
  ).resolves.toMatchObject([
    {
      trackId: 'leetcode-75',
      problemSlug: 'two-sum',
      reviewAttemptId: 'review-hard-1',
      completedAt: null,
      completedRating: null,
    },
  ])
})

it('reconciles overrides only for the controlling active-track attempt', async () => {
  const handle = await createTestDb({
    now: new Date('2026-01-01T00:00:00.000Z'),
  })
  const timestamp = new Date('2026-01-02T00:00:00.000Z')
  const repository = createTracksRepository(handle.db)

  await makeLeetCodeActive(handle.db)
  await insertReviewAttempt(handle.db, {
    id: 'review-newer',
    problemSlug: 'two-sum',
    rating: 'good',
    reviewedAt: timestamp,
  })
  await handle.db.insert(trackProblemProgress).values({
    trackId: 'leetcode-75',
    problemSlug: 'two-sum',
    reviewAttemptId: 'review-newer',
    completedAt: timestamp.getTime(),
    completedRating: 'good',
    createdAt: timestamp.getTime(),
    updatedAt: timestamp.getTime(),
  })

  await expect(
    repository.reconcileActiveTrackProblemReviewOverride({
      problemSlug: 'two-sum',
      rating: 'hard',
      reviewedAt: timestamp,
      reviewAttemptId: 'review-older',
    }),
  ).resolves.toBe(false)

  await expect(
    handle.db.select().from(trackProblemProgress),
  ).resolves.toMatchObject([
    {
      reviewAttemptId: 'review-newer',
      completedRating: 'good',
    },
  ])
})

it('reset deletes track progress by track id only', async () => {
  const handle = await createTestDb({
    now: new Date('2026-01-01T00:00:00.000Z'),
  })
  const timestamp = new Date('2026-01-02T00:00:00.000Z')

  await insertReviewAttempt(handle.db, {
    id: 'review-two-sum-1',
    problemSlug: 'two-sum',
    rating: 'good',
    reviewedAt: timestamp,
  })
  await handle.db.insert(trackProblemProgress).values({
    trackId: 'leetcode-75',
    problemSlug: 'two-sum',
    reviewAttemptId: 'review-two-sum-1',
    completedAt: timestamp.getTime(),
    completedRating: 'good',
    createdAt: timestamp.getTime(),
    updatedAt: timestamp.getTime(),
  })

  await createTracksRepository(handle.db).resetTrackProgress('leetcode-75')

  await expect(handle.db.select().from(trackProblemProgress)).resolves.toEqual(
    [],
  )
})
```

- [ ] **Step 2: Run the failing tests**

```bash
npm run test -- src/features/tracks/data/tracks-repository.test.ts
```

Expected: FAIL because `trackProblemProgress.trackId`, `recordActiveTrackProblemReview`, and `reconcileActiveTrackProblemReviewOverride` are not implemented.

- [ ] **Step 3: Commit failing tests**

```bash
git add src/features/tracks/data/tracks-repository.test.ts
git commit -m "test: capture track-owned progress behavior"
```

---

### Task 2: Add Track-Owned Progress Schema

**Files:**

- Modify: `src/platform/db/schema/track-groups.ts`
- Modify: `src/platform/db/schema/track-group-problems.ts`
- Modify: `src/platform/db/schema/track-problem-progress.ts`
- Modify: `src/platform/db/seed.ts`
- Generate: `src/platform/db/migrations/0005_*.sql`
- Generate: `src/platform/db/migrations/meta/0005_snapshot.json`
- Modify: `src/platform/db/migrations/meta/_journal.json`
- Modify: `src/platform/db/migration-sql.ts`

- [ ] **Step 1: Add composite group identity**

In `src/platform/db/schema/track-groups.ts`, import `uniqueIndex` and change the table indexes:

```ts
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

export const trackGroups = sqliteTable(
  'track_groups',
  {
    id: text('id').primaryKey(),
    trackId: text('track_id')
      .notNull()
      .references(() => tracks.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    position: integer('position').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    index('track_groups_track_idx').on(table.trackId),
    uniqueIndex('track_groups_id_track_unique').on(table.id, table.trackId),
  ],
)
```

- [ ] **Step 2: Add `trackId` to memberships**

In `src/platform/db/schema/track-group-problems.ts`, import `foreignKey`, `uniqueIndex`, and `tracks`, then use this table definition:

```ts
export const trackGroupProblems = sqliteTable(
  'track_group_problems',
  {
    trackGroupId: text('track_group_id').notNull(),
    trackId: text('track_id')
      .notNull()
      .references(() => tracks.id, { onDelete: 'cascade' }),
    problemSlug: text('problem_slug')
      .notNull()
      .references(() => problems.slug, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.trackGroupId, table.problemSlug] }),
    foreignKey({
      name: 'track_group_problems_group_track_fk',
      columns: [table.trackGroupId, table.trackId],
      foreignColumns: [trackGroups.id, trackGroups.trackId],
    }).onDelete('cascade'),
    uniqueIndex('track_group_problems_track_problem_unique').on(
      table.trackId,
      table.problemSlug,
    ),
    index('track_group_problems_track_idx').on(table.trackId),
    index('track_group_problems_problem_slug_idx').on(table.problemSlug),
  ],
)
```

- [ ] **Step 3: Replace progress schema**

In `src/platform/db/schema/track-problem-progress.ts`, use this table definition:

```ts
export const trackProblemProgress = sqliteTable(
  'track_problem_progress',
  {
    trackId: text('track_id').notNull(),
    problemSlug: text('problem_slug').notNull(),
    reviewAttemptId: text('review_attempt_id').references(
      () => reviewAttempts.id,
      {
        onDelete: 'set null',
      },
    ),
    completedAt: integer('completed_at'),
    completedRating: text('completed_rating'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.trackId, table.problemSlug] }),
    foreignKey({
      name: 'track_problem_progress_membership_fk',
      columns: [table.trackId, table.problemSlug],
      foreignColumns: [
        trackGroupProblems.trackId,
        trackGroupProblems.problemSlug,
      ],
    }).onDelete('cascade'),
    check(
      'track_problem_progress_completion_pair_check',
      sql`((${table.completedAt} is null and ${table.completedRating} is null) or (${table.completedAt} is not null and ${table.completedRating} is not null and ${table.completedRating} in ('good', 'easy')))`,
    ),
    index('track_problem_progress_review_attempt_idx').on(
      table.reviewAttemptId,
    ),
    index('track_problem_progress_problem_slug_idx').on(table.problemSlug),
  ],
)
```

Update relations to reference `[trackProblemProgress.trackId, trackProblemProgress.problemSlug]`.

- [ ] **Step 4: Update seed membership inserts**

Every `trackGroupProblems` insert must include `trackId`:

```ts
await db.insert(trackGroupProblems).values(
  group.problems.map((problem, problemIndex) => ({
    trackGroupId: groupId,
    trackId,
    problemSlug: problem.slug,
    position: problemIndex + 1,
  })),
)
```

- [ ] **Step 5: Generate and inspect migration**

```bash
npm run db:generate
```

Expected: one new SQL migration, one snapshot, `_journal.json`, and `migration-sql.ts` change.

Inspect the generated SQL and ensure it backfills membership `track_id` from `track_groups.track_id` before applying `NOT NULL` and unique constraints:

```sql
UPDATE `track_group_problems`
SET `track_id` = (
  SELECT `track_groups`.`track_id`
  FROM `track_groups`
  WHERE `track_groups`.`id` = `track_group_problems`.`track_group_id`
);
```

Ensure old progress rows are copied with `review_attempt_id` as `NULL`:

```sql
INSERT INTO `__new_track_problem_progress` (
  `track_id`,
  `problem_slug`,
  `review_attempt_id`,
  `completed_at`,
  `completed_rating`,
  `created_at`,
  `updated_at`
)
SELECT
  `track_groups`.`track_id`,
  `track_problem_progress`.`problem_slug`,
  NULL,
  `track_problem_progress`.`completed_at`,
  `track_problem_progress`.`completed_rating`,
  `track_problem_progress`.`created_at`,
  `track_problem_progress`.`updated_at`
FROM `track_problem_progress`
INNER JOIN `track_groups`
  ON `track_groups`.`id` = `track_problem_progress`.`track_group_id`;
```

- [ ] **Step 6: Run database check**

```bash
npm run db:check
```

Expected: PASS.

- [ ] **Step 7: Commit schema and migration**

```bash
git add src/platform/db/schema/track-groups.ts src/platform/db/schema/track-group-problems.ts src/platform/db/schema/track-problem-progress.ts src/platform/db/seed.ts src/platform/db/migrations src/platform/db/migration-sql.ts
git commit -m "feat: make track progress schema track-owned"
```

---

### Task 3: Make Tracks Repository Track-Owned

**Files:**

- Modify: `src/features/tracks/domain/track.ts`
- Modify: `src/features/tracks/data/tracks-repository.ts`
- Modify: `src/features/tracks/server/tracks-service.ts`
- Modify: `src/features/tracks/data/tracks-repository.test.ts`
- Modify: `src/features/tracks/server/tracks-service.test.ts`

- [ ] **Step 1: Add domain types**

In `src/features/tracks/domain/track.ts`, add:

```ts
export type TrackProblemCompletion =
  | { status: 'incomplete'; reviewAttemptId: string | null }
  | {
      status: 'completed'
      completedAt: Date
      completedRating: TrackCompletedRating
      reviewAttemptId: string | null
    }

export interface TrackReviewProgressInput {
  problemSlug: string
  rating: 'again' | 'hard' | 'good' | 'easy'
  reviewedAt: Date
  reviewAttemptId: string
}
```

Update membership/domain rows to carry `completion: TrackProblemCompletion` instead of loose completion fields.

- [ ] **Step 2: Count completed progress by track/problem**

In `getProgressByTrack`, join progress by `trackId + problemSlug` and count only rows with `completedAt !== null`:

```ts
const rows = await this.db
  .select({
    trackId: trackGroupProblems.trackId,
    completedAt: trackProblemProgress.completedAt,
  })
  .from(trackGroupProblems)
  .leftJoin(
    trackProblemProgress,
    and(
      eq(trackProblemProgress.trackId, trackGroupProblems.trackId),
      eq(trackProblemProgress.problemSlug, trackGroupProblems.problemSlug),
    ),
  )
  .where(inArray(trackGroupProblems.trackId, requestedTrackIds))

for (const row of rows) {
  const progress = progressByTrack.get(row.trackId)
  if (!progress) continue

  progress.totalCount += 1
  if (row.completedAt !== null) progress.completedCount += 1
}
```

- [ ] **Step 3: Map membership completion as a union**

Add:

```ts
function mapTrackProblemCompletion(row: {
  completedAt: number | null
  completedRating: string | null
  reviewAttemptId: string | null
}): TrackProblemCompletion {
  const completedRating = parseTrackCompletedRating(row.completedRating)

  if (row.completedAt !== null && completedRating) {
    return {
      status: 'completed',
      completedAt: new Date(row.completedAt),
      completedRating,
      reviewAttemptId: row.reviewAttemptId,
    }
  }

  return {
    status: 'incomplete',
    reviewAttemptId: row.reviewAttemptId,
  }
}
```

- [ ] **Step 4: Remove group-progress rescue code**

Delete these repository-only helpers and interfaces:

```ts
type TrackProgressMoveInput
type TrackProgressMoveTarget
type TrackMembershipReplacementAnalysis
analyzeTrackMembershipReplacement
assignProgressMovesToDesiredMemberships
takeNextProgressMoveTarget
writeMovedProgressRows
```

In `updateTrack`, remove the replacement analysis call and the `writeMovedProgressRows` call. Progress survives group moves because its identity is now `trackId + problemSlug`.

- [ ] **Step 5: Insert memberships with track ids**

Update `NormalizedTrackGroupInput` to include `trackId`, then insert membership rows with:

```ts
await db.insert(trackGroupProblems).values({
  trackGroupId: group.id,
  trackId: group.trackId,
  problemSlug: membership.problemSlug,
  position: membership.position,
})
```

- [ ] **Step 6: Replace completion recording with review-state recording**

Add:

```ts
async recordActiveTrackProblemReview(
  input: TrackReviewProgressInput,
): Promise<boolean> {
  const problemSlug = normalizeProblemInput(input.problemSlug)
  const timestamp = input.reviewedAt.getTime()
  const completion = toTrackCompletionPatch(input.rating, timestamp)

  const session = await readRawSession(this.db)
  if (!session?.activeTrackId) return false

  const membership = await readTrackProblemMembershipIdentity(this.db, {
    trackId: session.activeTrackId,
    problemSlug,
  })
  if (!membership) return false

  await this.db
    .insert(trackProblemProgress)
    .values({
      trackId: membership.trackId,
      problemSlug: membership.problemSlug,
      reviewAttemptId: input.reviewAttemptId,
      completedAt: completion.completedAt,
      completedRating: completion.completedRating,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .onConflictDoUpdate({
      target: [trackProblemProgress.trackId, trackProblemProgress.problemSlug],
      set: {
        reviewAttemptId: input.reviewAttemptId,
        completedAt: completion.completedAt,
        completedRating: completion.completedRating,
        updatedAt: timestamp,
      },
    })

  return true
}

function toTrackCompletionPatch(
  rating: TrackReviewProgressInput['rating'],
  timestamp: number,
) {
  if (rating === 'good' || rating === 'easy') {
    return { completedAt: timestamp, completedRating: rating }
  }

  return { completedAt: null, completedRating: null }
}
```

- [ ] **Step 7: Add override reconciliation**

Add:

```ts
async reconcileActiveTrackProblemReviewOverride(
  input: TrackReviewProgressInput,
): Promise<boolean> {
  const problemSlug = normalizeProblemInput(input.problemSlug)
  const completion = toTrackCompletionPatch(input.rating, input.reviewedAt.getTime())

  const updatedRows = await this.db
    .update(trackProblemProgress)
    .set({
      completedAt: completion.completedAt,
      completedRating: completion.completedRating,
      updatedAt: input.reviewedAt.getTime(),
    })
    .where(
      and(
        eq(trackProblemProgress.problemSlug, problemSlug),
        eq(trackProblemProgress.reviewAttemptId, input.reviewAttemptId),
      ),
    )
    .returning({ trackId: trackProblemProgress.trackId })

  return updatedRows.length > 0
}
```

- [ ] **Step 8: Reset progress by track id**

Replace group-id based reset deletion with:

```ts
await this.db
  .delete(trackProblemProgress)
  .where(eq(trackProblemProgress.trackId, trackId))
```

- [ ] **Step 9: Update service exports**

In `src/features/tracks/server/tracks-service.ts`, export server wrappers:

```ts
export async function recordActiveTrackProblemReview(
  db: Db,
  input: TrackReviewProgressInput,
) {
  return createTracksRepository(db).recordActiveTrackProblemReview(input)
}

export async function reconcileActiveTrackProblemReviewOverride(
  db: Db,
  input: TrackReviewProgressInput,
) {
  return createTracksRepository(db).reconcileActiveTrackProblemReviewOverride(
    input,
  )
}
```

- [ ] **Step 10: Run focused track tests**

```bash
npm run test -- src/features/tracks/data/tracks-repository.test.ts src/features/tracks/server/tracks-service.test.ts
```

Expected: PASS.

- [ ] **Step 11: Commit tracks repository update**

```bash
git add src/features/tracks/domain/track.ts src/features/tracks/data/tracks-repository.ts src/features/tracks/server/tracks-service.ts src/features/tracks/data/tracks-repository.test.ts src/features/tracks/server/tracks-service.test.ts
git commit -m "feat: read and write track-owned progress"
```

---

### Task 4: Return Review Attempt IDs And Add Transaction Helpers

**Files:**

- Modify: `src/features/practice/domain/practice.ts`
- Modify: `src/features/practice/data/practice-repository.ts`
- Modify: `src/features/practice/api/practice-contracts.ts`
- Modify: `src/features/practice/api/practice-serializers.ts`
- Modify: `src/features/practice/practice-core.integration.test.ts`
- Modify: `src/features/practice/api/practice-contracts.test.ts`

- [ ] **Step 1: Add review attempt id to results**

In `src/features/practice/domain/practice.ts`:

```ts
export interface ReviewResult {
  problemSlug: ProblemSlug
  cardId: string
  reviewAttemptId: string
  rating: ReviewRating
  status: PracticeStatus
  dueAt: Date
  reviewedAt: Date
  card: FsrsCardSnapshot
  summary: PracticeSummary
}
```

- [ ] **Step 2: Split repository public methods from transaction-scoped helpers**

In `PracticeRepository`, keep public methods transactional and add helper methods used by the workflow:

```ts
async saveReviewResult(input: SaveReviewResultInput): Promise<ReviewResult> {
  return this.db.transaction((transactionDb) =>
    this.saveReviewResultInTransaction(input, transactionDb as unknown as Db),
  )
}

async saveReviewResultInTransaction(
  input: SaveReviewResultInput,
  writeDb: Db,
): Promise<ReviewResult>

async overrideLastReviewResult(
  input: OverrideLastReviewResultInput,
): Promise<ReviewResult> {
  return this.db.transaction((transactionDb) =>
    this.overrideLastReviewResultInTransaction(input, transactionDb as unknown as Db),
  )
}

async overrideLastReviewResultInTransaction(
  input: OverrideLastReviewResultInput,
  writeDb: Db,
): Promise<ReviewResult>
```

Place the existing `saveReviewResult` transaction callback body inside
`saveReviewResultInTransaction` and replace every `transactionDb` reference in
that body with `writeDb`. Place the existing `overrideLastReviewResult`
transaction callback body into `overrideLastReviewResultInTransaction` and make
the same `transactionDb` to `writeDb` replacement. The public wrappers above
must contain no scheduling or persistence logic after extraction.

The helper bodies must return `reviewAttemptId`:

```ts
return {
  problemSlug: input.problemSlug,
  cardId,
  reviewAttemptId,
  rating: input.rating,
  status,
  dueAt: scheduled.card.dueAt,
  reviewedAt,
  card: scheduled.card,
  summary,
}
```

For override:

```ts
return {
  problemSlug: input.problemSlug,
  cardId,
  reviewAttemptId: updatedAttempt.id,
  rating: input.rating,
  status,
  dueAt: replayedCard.dueAt,
  reviewedAt: updatedAttempt.reviewedAt,
  card: replayedCard,
  summary,
}
```

- [ ] **Step 3: Update practice contracts and serializers**

Add `reviewAttemptId`:

```ts
export const practiceReviewResultSchema = z.object({
  problemSlug: z.string(),
  cardId: z.string(),
  reviewAttemptId: z.string(),
  rating: z.enum(reviewRatings),
  status: z.enum(practiceStatuses),
  dueAt: z.iso.datetime(),
  reviewedAt: z.iso.datetime(),
  summary: practiceSummarySchema,
})
```

Serializer:

```ts
return practiceReviewResultSchema.parse({
  problemSlug: result.problemSlug,
  cardId: result.cardId,
  reviewAttemptId: result.reviewAttemptId,
  rating: result.rating,
  status: result.status,
  dueAt: result.dueAt.toISOString(),
  reviewedAt: result.reviewedAt.toISOString(),
  summary: serializePracticeResultSummary(result.summary),
})
```

- [ ] **Step 4: Add practice assertions**

In practice save/override tests, assert:

```ts
expect(result.reviewAttemptId).toBe('review-1')
expect(override.reviewAttemptId).toBe('review-2')
```

- [ ] **Step 5: Run practice tests**

```bash
npm run test -- src/features/practice/practice-core.integration.test.ts src/features/practice/api/practice-contracts.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit practice result update**

```bash
git add src/features/practice/domain/practice.ts src/features/practice/data/practice-repository.ts src/features/practice/api/practice-contracts.ts src/features/practice/api/practice-serializers.ts src/features/practice/practice-core.integration.test.ts src/features/practice/api/practice-contracts.test.ts
git commit -m "feat: expose practice review attempt ids"
```

---

### Task 5: Add Atomic Practice And Track Workflow

**Files:**

- Create: `src/features/practice/server/practice-review-workflow.ts`
- Modify: `src/features/practice/server/practice-service.ts`
- Modify: `src/extension/background/register-handlers.ts`
- Modify: `src/extension/background/register-handlers.test.ts`
- Modify: `src/features/practice/practice-core.integration.test.ts`

- [ ] **Step 1: Create the workflow**

Create `src/features/practice/server/practice-review-workflow.ts`:

```ts
import type { UserSettings } from '@/features/settings/domain'
import {
  reconcileActiveTrackProblemReviewOverride,
  recordActiveTrackProblemReview,
} from '@/features/tracks/server/tracks-service'
import type { Db } from '@/platform/db'

import { createPracticeRepository } from '../data/practice-repository'
import type {
  OverrideLastReviewResultInput,
  ReviewResult,
  SaveReviewResultInput,
} from '../domain'

export async function saveReviewResultWithTrackProgress(
  db: Db,
  input: SaveReviewResultInput,
  settings: UserSettings,
): Promise<ReviewResult> {
  return db.transaction(async (transactionDb) => {
    const tx = transactionDb as unknown as Db
    const result = await createPracticeRepository(
      tx,
    ).saveReviewResultInTransaction(input, tx)

    if (settings.practice.mode === 'studyPlan') {
      await recordActiveTrackProblemReview(tx, {
        problemSlug: result.problemSlug,
        rating: result.rating,
        reviewedAt: result.reviewedAt,
        reviewAttemptId: result.reviewAttemptId,
      })
    }

    return result
  })
}

export async function overrideLastReviewResultWithTrackProgress(
  db: Db,
  input: OverrideLastReviewResultInput,
  settings: UserSettings,
): Promise<ReviewResult> {
  return db.transaction(async (transactionDb) => {
    const tx = transactionDb as unknown as Db
    const result = await createPracticeRepository(
      tx,
    ).overrideLastReviewResultInTransaction(input, tx)

    if (settings.practice.mode === 'studyPlan') {
      await reconcileActiveTrackProblemReviewOverride(tx, {
        problemSlug: result.problemSlug,
        rating: result.rating,
        reviewedAt: result.reviewedAt,
        reviewAttemptId: result.reviewAttemptId,
      })
    }

    return result
  })
}
```

- [ ] **Step 2: Export workflow functions**

In `src/features/practice/server/practice-service.ts`:

```ts
export {
  overrideLastReviewResultWithTrackProgress,
  saveReviewResultWithTrackProgress,
} from './practice-review-workflow'
```

- [ ] **Step 3: Update runtime handlers**

In `src/extension/background/register-handlers.ts`, replace direct practice save/override calls and the old `recordActiveTrackProblemCompletion` call with:

```ts
await saveReviewResultWithTrackProgress(
  db,
  {
    ...reviewInput,
    reviewedAt,
    ...(request.reviewMode ? { reviewMode: request.reviewMode } : {}),
  },
  settings,
)
```

For override:

```ts
await overrideLastReviewResultWithTrackProgress(
  db,
  {
    problemSlug: request.problemSlug,
    rating: request.rating,
    elapsedSeconds: request.elapsedSeconds,
    isCorrect: request.isCorrect,
    log: readReviewLogRequest(request),
    targetRetention: settings.review.targetRetention,
  },
  settings,
)
```

- [ ] **Step 4: Update handler tests**

Mock and assert workflow calls:

```ts
saveReviewResultWithTrackProgress: vi.fn(),
overrideLastReviewResultWithTrackProgress: vi.fn(),

expect(backgroundMocks.saveReviewResultWithTrackProgress).toHaveBeenCalledWith(
  backgroundMocks.db,
  expect.objectContaining({
    problemSlug: 'two-sum',
    rating: 'good',
  }),
  defaultUserSettings,
)
```

- [ ] **Step 5: Add workflow integration tests**

In `src/features/practice/practice-core.integration.test.ts`, add tests for these cases:

```ts
expect(activeTrackAfterGood?.progress.completedCount).toBe(1)
expect(inactiveTrackWithSameProblem?.progress.completedCount).toBe(0)
expect(activeTrackAfterHard?.progress.completedCount).toBe(0)
expect(activeTrackAfterGoodToHardOverride?.progress.completedCount).toBe(0)
expect(activeTrackAfterHardToGoodOverride?.progress.completedCount).toBe(1)
expect(activeTrackAfterFreePracticeGood?.progress.completedCount).toBe(0)
```

- [ ] **Step 6: Run workflow tests**

```bash
npm run test -- src/extension/background/register-handlers.test.ts src/features/practice/practice-core.integration.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit workflow**

```bash
git add src/features/practice/server/practice-review-workflow.ts src/features/practice/server/practice-service.ts src/extension/background/register-handlers.ts src/extension/background/register-handlers.test.ts src/features/practice/practice-core.integration.test.ts
git commit -m "feat: reconcile track progress in review workflow"
```

---

### Task 6: Update Track Contracts And UI Serialization

**Files:**

- Modify: `src/features/tracks/api/tracks-contracts.ts`
- Modify: `src/features/tracks/api/tracks-serializers.ts`
- Modify: `src/features/tracks/components/active-track-workspace.tsx`
- Modify: `src/features/tracks/api/tracks-contracts.test.ts`
- Modify: `src/features/tracks/components/tracks-screen.test.tsx`

- [ ] **Step 1: Add serialized completion schema**

In `src/features/tracks/api/tracks-contracts.ts`:

```ts
const trackProblemCompletionSchema = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('incomplete'),
    reviewAttemptId: z.string().nullable(),
  }),
  z.strictObject({
    status: z.literal('completed'),
    completedAt: z.iso.datetime(),
    completedRating: trackCompletedRatingSchema,
    reviewAttemptId: z.string().nullable(),
  }),
])

export const trackProblemRowSchema = problemLibraryRowSchema.extend({
  membership: z.strictObject({
    trackId: trackIdSchema,
    groupId: trackGroupIdSchema,
    groupTitle: z.string(),
    groupPosition: z.number().int().min(1),
    problemPosition: z.number().int().min(1),
    completion: trackProblemCompletionSchema,
  }),
})
```

- [ ] **Step 2: Serialize completion**

In `src/features/tracks/api/tracks-serializers.ts`:

```ts
completion:
  row.membership.completion.status === 'completed'
    ? {
        status: 'completed',
        completedAt: row.membership.completion.completedAt.toISOString(),
        completedRating: row.membership.completion.completedRating,
        reviewAttemptId: row.membership.completion.reviewAttemptId,
      }
    : row.membership.completion,
```

- [ ] **Step 3: Read completion union in UI**

Replace completion checks like `row.membership.completedAt` with:

```ts
row.membership.completion.status === 'completed'
```

Replace incomplete filters with:

```ts
const incompleteRows = rows.filter(
  (row) => row.membership.completion.status !== 'completed',
)
```

- [ ] **Step 4: Update fixtures**

Use:

```ts
completion: { status: 'incomplete', reviewAttemptId: null }
```

and:

```ts
completion: {
  status: 'completed',
  completedAt: '2026-01-01T00:00:00.000Z',
  completedRating: 'good',
  reviewAttemptId: 'review-two-sum-1',
}
```

- [ ] **Step 5: Run contract and UI tests**

```bash
npm run test -- src/features/tracks/api/tracks-contracts.test.ts src/features/tracks/components/tracks-screen.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit contract/UI update**

```bash
git add src/features/tracks/api/tracks-contracts.ts src/features/tracks/api/tracks-contracts.test.ts src/features/tracks/api/tracks-serializers.ts src/features/tracks/components/active-track-workspace.tsx src/features/tracks/components/tracks-screen.test.tsx
git commit -m "feat: serialize track progress state"
```

---

### Task 7: Update Backup And Sync Compatibility

**Files:**

- Modify: `src/features/backup/api/backup-contracts.ts`
- Modify: `src/features/backup/data/backup-repository.ts`
- Modify: `src/features/backup/server/backup-service.ts`
- Modify: `src/features/backup/api/backup-contracts.test.ts`
- Modify: `src/features/backup/data/backup-repository.test.ts`
- Modify: `src/features/backup/server/backup-service.test.ts`
- Modify: `src/features/sync/domain/sync-envelope.test.ts`
- Modify: `src/features/sync/server/sync-service.test.ts`

- [ ] **Step 1: Add backup v1/v2 schemas**

In `src/features/backup/api/backup-contracts.ts`, set:

```ts
export const backupSchemaVersion = 2
export const minimumSupportedBackupSchemaVersion = 1
```

Add progress schemas:

```ts
const backupTrackProgressV1RowSchema = z.strictObject({
  trackGroupId: trackGroupIdSchema,
  problemSlug: problemSlugSchema,
  completedAt: isoDatetimeSchema,
  completedRating: trackCompletedRatingSchema,
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
})

export const backupTrackProgressRowSchema = z.strictObject({
  trackId: trackIdSchema,
  problemSlug: problemSlugSchema,
  reviewAttemptId: durableIdSchema.nullable(),
  completedAt: isoDatetimeSchema.nullable(),
  completedRating: trackCompletedRatingSchema.nullable(),
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
})
```

Create `backupFileV1Schema` with v1 progress rows and `backupFileSchema` with v2 progress rows. Update `parseBackupFileForCurrentApp`:

```ts
if (envelope.schemaVersion === 1) {
  return normalizeBackupV1ToV2(backupFileV1Schema.parse(input))
}

return backupFileSchema.parse(input)
```

- [ ] **Step 2: Normalize v1 backup progress**

Add:

```ts
function normalizeBackupV1ToV2(backup: BackupFileV1): BackupFile {
  const groupsById = new Map(
    backup.data.tracks.groups.map((group) => [group.id, group]),
  )

  return backupFileSchema.parse({
    ...backup,
    schemaVersion: backupSchemaVersion,
    data: {
      ...backup.data,
      tracks: {
        ...backup.data.tracks,
        progress: backup.data.tracks.progress.map((row) => {
          const group = groupsById.get(row.trackGroupId)
          if (!group) {
            throw new Error(
              `Invalid backup: progress references missing group ${row.trackGroupId}.`,
            )
          }

          return {
            trackId: group.trackId,
            problemSlug: row.problemSlug,
            reviewAttemptId: null,
            completedAt: row.completedAt,
            completedRating: row.completedRating,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          }
        }),
      },
    },
  })
}
```

- [ ] **Step 3: Export v2 progress rows**

In `src/features/backup/data/backup-repository.ts`, map progress rows as:

```ts
progress: progressRows.map((row) => ({
  trackId: row.trackId,
  problemSlug: row.problemSlug,
  reviewAttemptId: row.reviewAttemptId,
  completedAt: toIsoOrNull(row.completedAt),
  completedRating: row.completedRating,
  createdAt: toIso(row.createdAt),
  updatedAt: toIso(row.updatedAt),
})),
```

- [ ] **Step 4: Import v2 progress rows**

In `insertBackupData`, insert:

```ts
await db.insert(trackProblemProgress).values(
  data.tracks.progress.map((row) => ({
    trackId: row.trackId,
    problemSlug: row.problemSlug,
    reviewAttemptId: row.reviewAttemptId,
    completedAt: toMillisOrNull(row.completedAt),
    completedRating: row.completedRating,
    createdAt: toMillis(row.createdAt),
    updatedAt: toMillis(row.updatedAt),
  })),
)
```

- [ ] **Step 5: Tighten restore validation**

In `src/features/backup/server/backup-service.ts`, add validation:

```ts
uniqueValues(
  data.tracks.memberships,
  (row) => {
    const group = trackGroupsById.get(row.trackGroupId)
    return `${group?.trackId ?? 'missing'}\u0000${row.problemSlug}`
  },
  'track problem identity',
)

if (data.tracks.session.length > 1) {
  throw new Error('Invalid backup: expected at most one active track session.')
}

for (const row of data.tracks.session) {
  if (row.id !== 'active') {
    throw new Error(`Invalid backup: unsupported track session id ${row.id}.`)
  }

  if (row.activeTrackId === null && row.activeGroupId !== null) {
    throw new Error(
      `Invalid backup: session ${row.id} cannot have an active group without an active track.`,
    )
  }
}
```

- [ ] **Step 6: Add compatibility tests**

Add tests that parse a v1 backup and assert:

```ts
expect(parsed.schemaVersion).toBe(2)
expect(parsed.data.tracks.progress[0]).toMatchObject({
  trackId: 'leetcode-75',
  problemSlug: 'two-sum',
  reviewAttemptId: null,
})
```

Add validation tests:

```ts
expect(() => validateFullBackup(backupWithDuplicateTrackProblem)).toThrow(
  'track problem identity',
)

expect(() => validateFullBackup(backupWithInvalidSessionId)).toThrow(
  'unsupported track session id',
)

expect(() => validateFullBackup(backupWithGroupWithoutTrack)).toThrow(
  'cannot have an active group without an active track',
)
```

- [ ] **Step 7: Run backup and sync tests**

```bash
npm run test -- src/features/backup/api/backup-contracts.test.ts src/features/backup/data/backup-repository.test.ts src/features/backup/server/backup-service.test.ts src/features/sync/domain/sync-envelope.test.ts src/features/sync/server/sync-service.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit backup compatibility**

```bash
git add src/features/backup/api/backup-contracts.ts src/features/backup/api/backup-contracts.test.ts src/features/backup/data/backup-repository.ts src/features/backup/data/backup-repository.test.ts src/features/backup/server/backup-service.ts src/features/backup/server/backup-service.test.ts src/features/sync/domain/sync-envelope.test.ts src/features/sync/server/sync-service.test.ts
git commit -m "feat: migrate backup track progress shape"
```

---

### Task 8: Final Verification

**Files:**

- Inspect all files touched by Tasks 1-7.

- [ ] **Step 1: Run architecture boundary tests**

```bash
npm run test -- src/testing/architecture-boundaries.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run database check**

```bash
npm run db:check
```

Expected: PASS.

- [ ] **Step 3: Run full project check**

```bash
npm run check
```

Expected: PASS with exit code `0`.

- [ ] **Step 4: Check formatting-sensitive diff output**

```bash
git diff --check
```

Expected: no output.

- [ ] **Step 5: Check branch status**

```bash
git status --short
```

Expected: no output after all task commits.
