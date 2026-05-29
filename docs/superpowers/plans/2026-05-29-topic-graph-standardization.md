# Topic Graph Standardization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved topic graph foundation so problem topics resolve through stored aliases, support multiple parents, seed the LeetCode taxonomy, persist captured LeetCode topics, and round-trip through backup/sync.

**Architecture:** Extend the current `topics` and `problem_topics` model instead of replacing it. Topic writes go through one resolver that maps input labels to existing topics, aliases, or auto-created topics; read models expose direct topics plus parent rollups while the UI remains unchanged. Backup version `3` exports/imports topics, aliases, relations, and problem-topic joins, and old backups normalize into the new envelope.

**Tech Stack:** TypeScript, Drizzle SQLite schema and migrations, Zod runtime and backup contracts, WXT runtime messaging, TanStack Query invalidation, Vitest.

---

## Locked Decisions

- Topics, aliases, and relations do not store `isCanonical`, `source`, or any equivalent origin flag.
- All topics are ordinary assignable topics.
- `problem_topics` stores direct assignments only.
- Parent rollups are derived from `topic_relations`; they are not inserted into `problem_topics`.
- A topic can have multiple parents.
- Cycles and self-parent relations are invalid.
- Aliases are first-class stored rows keyed by one normalized lookup key.
- Unknown incoming topic labels auto-create ordinary topics.
- Manual Library create/edit/bulk topic writes keep replace-all behavior.
- LeetCode page capture topic writes merge into existing direct topics and never clear unrelated manual topics.
- The user-provided LeetCode counts are ignored completely.
- The full LeetCode label list, alias list, and parent links come from `docs/superpowers/specs/2026-05-29-topic-graph-standardization-design.md`.

## File Structure

- Create `src/platform/db/schema/topic-aliases.ts`.
- Create `src/platform/db/schema/topic-relations.ts`.
- Modify `src/platform/db/schema/topics.ts`.
- Modify `src/platform/db/schema/index.ts`.
- Create `src/platform/db/topic-taxonomy-seed.ts`.
- Modify `src/platform/db/seed.ts`.
- Add a generated migration under `src/platform/db/migrations/0006_*.sql` and matching Drizzle metadata.
- Create `src/features/problems/domain/topic-taxonomy.ts`.
- Create `src/features/problems/data/topic-resolver.ts`.
- Modify `src/features/problems/data/problems-repository.ts`.
- Modify `src/features/problems/server/problems-service.ts`.
- Modify `src/features/problems/api/problems-contracts.ts`.
- Modify `src/features/problems/api/problems-serializers.ts`.
- Modify `src/features/problems/api/problems-api.ts` only if TypeScript surface changes require it.
- Modify `src/features/overlay-session/hooks/use-leetcode-page-sync.ts`.
- Modify `src/features/backup/api/backup-contracts.ts`.
- Modify `src/features/backup/data/backup-repository.ts`.
- Modify `src/features/backup/server/backup-service.ts`.
- Modify focused tests beside the changed modules.
- Modify `docs/product.md`, `docs/architecture.md`, and `docs/testing.md` after behavior lands.

---

### Task 1: Add Topic Graph Tables And Typed Seed Data

**Files:**

- Modify: `src/platform/db/schema/topics.ts`
- Add: `src/platform/db/schema/topic-aliases.ts`
- Add: `src/platform/db/schema/topic-relations.ts`
- Modify: `src/platform/db/schema/index.ts`
- Add: `src/platform/db/topic-taxonomy-seed.ts`
- Modify: `src/testing/db-foundation.test.ts`

- [ ] **Step 1: Write the failing DB foundation assertion**

In `src/testing/db-foundation.test.ts`, extend `keeps migration indexes aligned with current query paths` so the index list includes the new topic graph indexes:

```ts
expect(indexNames).toEqual(
  expect.arrayContaining([
    'topic_aliases_topic_idx',
    'topic_relations_child_idx',
    'topic_relations_parent_idx',
  ]),
)
```

Add a table-column assertion in the same file:

```ts
it('creates topic graph storage tables', async () => {
  const handle = await createTestDb({ seed: false })

  expect(
    readSqliteRows(
      handle.rawDb,
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name in ('topic_aliases', 'topic_relations') ORDER BY name",
    ),
  ).toEqual([['topic_aliases'], ['topic_relations']])
  expect(
    readSqliteRows(handle.rawDb, "PRAGMA table_info('topics')").map(
      (row) => row[1],
    ),
  ).toEqual(expect.arrayContaining(['created_at', 'updated_at']))
})
```

Run it and confirm it fails before implementation:

```bash
npm test -- src/testing/db-foundation.test.ts --run
```

- [ ] **Step 2: Extend `topics` with timestamps**

Change `src/platform/db/schema/topics.ts` to include `createdAt` and `updatedAt`. Use defaults so old rows can migrate without losing data:

```ts
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const topics = sqliteTable('topics', {
  id: text('id').primaryKey(),
  label: text('label').notNull().unique(),
  createdAt: integer('created_at').notNull().default(0),
  updatedAt: integer('updated_at').notNull().default(0),
})
```

Keep the existing `topicsRelations` and add relation fields for aliases and parent/child edges after the new tables exist.

- [ ] **Step 3: Add `topic_aliases` schema**

Create `src/platform/db/schema/topic-aliases.ts`:

```ts
import { relations } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { topics } from './topics'

export const topicAliases = sqliteTable(
  'topic_aliases',
  {
    aliasKey: text('alias_key').primaryKey(),
    label: text('label').notNull(),
    topicId: text('topic_id')
      .notNull()
      .references(() => topics.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [index('topic_aliases_topic_idx').on(table.topicId)],
)

export const topicAliasesRelations = relations(topicAliases, ({ one }) => ({
  topic: one(topics, {
    fields: [topicAliases.topicId],
    references: [topics.id],
  }),
}))
```

- [ ] **Step 4: Add `topic_relations` schema**

Create `src/platform/db/schema/topic-relations.ts`:

```ts
import { relations, sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core'

import { topics } from './topics'

export const topicRelations = sqliteTable(
  'topic_relations',
  {
    parentTopicId: text('parent_topic_id')
      .notNull()
      .references(() => topics.id, { onDelete: 'cascade' }),
    childTopicId: text('child_topic_id')
      .notNull()
      .references(() => topics.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.parentTopicId, table.childTopicId] }),
    index('topic_relations_parent_idx').on(table.parentTopicId),
    index('topic_relations_child_idx').on(table.childTopicId),
    check(
      'topic_relations_not_self_check',
      sql`${table.parentTopicId} <> ${table.childTopicId}`,
    ),
  ],
)

export const topicRelationsRelations = relations(topicRelations, ({ one }) => ({
  parentTopic: one(topics, {
    fields: [topicRelations.parentTopicId],
    references: [topics.id],
    relationName: 'parentTopic',
  }),
  childTopic: one(topics, {
    fields: [topicRelations.childTopicId],
    references: [topics.id],
    relationName: 'childTopic',
  }),
}))
```

- [ ] **Step 5: Export the new schema modules**

Add these exports to `src/platform/db/schema/index.ts`:

```ts
export * from './topic-aliases'
export * from './topic-relations'
```

Update `src/platform/db/schema/topics.ts` relations after imports are available:

```ts
import { topicAliases } from './topic-aliases'
import { topicRelations } from './topic-relations'

export const topicsRelations = relations(topics, ({ many }) => ({
  aliases: many(topicAliases),
  childRelations: many(topicRelations, { relationName: 'parentTopic' }),
  parentRelations: many(topicRelations, { relationName: 'childTopic' }),
  problems: many(problemTopics),
}))
```

- [ ] **Step 6: Add typed seed taxonomy data**

Create `src/platform/db/topic-taxonomy-seed.ts` with exported readonly arrays:

```ts
export interface SeedTopicAlias {
  label: string
  topicLabel: string
}

export interface SeedTopicRelation {
  childLabel: string
  parentLabel: string
}

export const seedTopicLabels = [
  'Array',
  'String',
  'Hash Table',
  'Math',
  'Dynamic Programming',
  'Sorting',
  'Greedy',
  'Binary Search',
  'Depth-First Search',
  'Database',
  'Bit Manipulation',
  'Matrix',
  'Tree',
  'Breadth-First Search',
  'Two Pointers',
  'Prefix Sum',
  'Heap (Priority Queue)',
  'Simulation',
  'Counting',
  'Graph Theory',
  'Binary Tree',
  'Stack',
  'Sliding Window',
  'Enumeration',
  'Design',
  'Backtracking',
  'Union-Find',
  'Number Theory',
  'Linked List',
  'Segment Tree',
  'Ordered Set',
  'Monotonic Stack',
  'Divide and Conquer',
  'Combinatorics',
  'Trie',
  'Bitmask',
  'Queue',
  'Recursion',
  'Geometry',
  'Binary Indexed Tree',
  'Hash Function',
  'Memoization',
  'Binary Search Tree',
  'Topological Sort',
  'Shortest Path',
  'String Matching',
  'Rolling Hash',
  'Game Theory',
  'Interactive',
  'Data Stream',
  'Monotonic Queue',
  'Brainteaser',
  'Doubly-Linked List',
  'Merge Sort',
  'Randomized',
  'Counting Sort',
  'Iterator',
  'Concurrency',
  'Suffix Array',
  'Quickselect',
  'Sweep Line',
  'Probability and Statistics',
  'Minimum Spanning Tree',
  'Bucket Sort',
  'Shell',
  'Reservoir Sampling',
  'Eulerian Circuit',
  'Radix Sort',
  'Strongly Connected Component',
  'Rejection Sampling',
  'Biconnected Component',
] as const
```

Add aliases and relations from the approved spec. Include the legacy track aliases below in addition to the spec aliases:

```ts
export const seedTopicAliases = [
  { label: 'Fast And Slow Pointers', topicLabel: 'Two Pointers' },
  { label: 'Hash Maps And Sets', topicLabel: 'Hash Table' },
  { label: 'Sort And Search', topicLabel: 'Sorting' },
  { label: 'Math And Geometry', topicLabel: 'Math' },
] satisfies readonly SeedTopicAlias[]
```

Keep `Intervals` as a seeded regular topic by adding it to the local legacy topic list in `seed.ts`, not as an alias.

- [ ] **Step 7: Run the focused failing test again**

```bash
npm test -- src/testing/db-foundation.test.ts --run
```

It should still fail until the migration task runs.

---

### Task 2: Seed, Migration, And Existing Topic Standardization

**Files:**

- Modify: `src/platform/db/seed.ts`
- Add/modify: `src/platform/db/migrations/0006_*.sql`
- Modify: `src/platform/db/migrations/meta/*`
- Modify: `src/testing/db-foundation.test.ts`

- [ ] **Step 1: Add a failing seed standardization test**

Add this test to `src/testing/db-foundation.test.ts`:

```ts
it('seeds the topic graph and merges known alias topics', async () => {
  const handle = await createTestDb({ seed: false })

  handle.rawDb.exec(`
    INSERT INTO problems (slug, title, difficulty, is_premium, created_at, updated_at)
    VALUES ('heap-problem', 'Heap Problem', 'medium', false, 1, 1);
    INSERT INTO topics (id, label, created_at, updated_at)
    VALUES
      ('heaps', 'Heaps', 1, 1),
      ('priority-queue', 'Priority Queue', 1, 1);
    INSERT INTO problem_topics (problem_slug, topic_id)
    VALUES
      ('heap-problem', 'heaps'),
      ('heap-problem', 'priority-queue');
  `)

  await seedInitialCatalog(handle.db, new Date('2026-05-29T12:00:00.000Z'))

  expect(
    readSqliteRows(
      handle.rawDb,
      "SELECT topic_id FROM problem_topics WHERE problem_slug = 'heap-problem' ORDER BY topic_id",
    ),
  ).toEqual([['heap-priority-queue']])
  expect(
    readSqliteRows(
      handle.rawDb,
      "SELECT alias_key, topic_id FROM topic_aliases WHERE alias_key in ('heaps', 'priority-queue') ORDER BY alias_key",
    ),
  ).toEqual([
    ['heaps', 'heap-priority-queue'],
    ['priority-queue', 'heap-priority-queue'],
  ])
})
```

- [ ] **Step 2: Update seed topic inserts**

In `src/platform/db/seed.ts`, import the new schema and seed arrays:

```ts
import { eq, inArray } from 'drizzle-orm'
import { normalizeLeetCodeSlug } from '@/lib/leetcode'

import {
  seedTopicAliases,
  seedTopicLabels,
  seedTopicRelations,
} from './topic-taxonomy-seed'
import { problemTopics, topicAliases, topicRelations } from './schema'
```

Replace the old `seedTopics` definition with:

```ts
const legacyLocalTopicLabels = ['Intervals'] as const

const seedTopics = [
  ...seedTopicLabels.map((label) => ({
    id: topicIdForLabel(label),
    label,
  })),
  ...legacyLocalTopicLabels.map((label) => ({
    id: topicIdForLabel(label),
    label,
  })),
]
```

Use this helper in `seed.ts`:

```ts
function topicIdForLabel(label: string) {
  return normalizeLeetCodeSlug(label)
}
```

- [ ] **Step 3: Insert topics with timestamps**

Update the topic insert in `seedInitialCatalog`:

```ts
await db
  .insert(topics)
  .values(
    seedTopics.map((topic) => ({
      ...topic,
      createdAt: timestamp,
      updatedAt: timestamp,
    })),
  )
  .onConflictDoNothing()
```

- [ ] **Step 4: Add idempotent alias merge standardization**

Add a helper in `src/platform/db/seed.ts` and call it after seeding topics:

```ts
await standardizeSeedTopicAliases(db, timestamp)
```

The helper must:

- Resolve every seed alias target by `topicIdForLabel(alias.topicLabel)`.
- If an old topic has the alias key as `id`, move its `problem_topics` rows to the target topic.
- If an old topic has the alias label, move its `problem_topics` rows to the target topic.
- Delete the old alias topic after moving links.
- Insert the alias row into `topic_aliases`.
- Keep one join if several old topics collapse to the same target.

Use delete-then-insert for join moves so SQLite primary keys cannot create duplicate failures:

```ts
await db
  .insert(problemTopics)
  .values(
    rowsToMove.map((row) => ({
      problemSlug: row.problemSlug,
      topicId: targetTopicId,
    })),
  )
  .onConflictDoNothing()
await db.delete(problemTopics).where(eq(problemTopics.topicId, oldTopic.id))
await db.delete(topics).where(eq(topics.id, oldTopic.id))
```

- [ ] **Step 5: Add idempotent relation seed insert**

Add a helper in `src/platform/db/seed.ts` and call it after alias standardization:

```ts
await seedTopicGraphRelations(db, timestamp)
```

Insert rows like this:

```ts
await db
  .insert(topicRelations)
  .values(
    seedTopicRelations.map((relation) => ({
      childTopicId: topicIdForLabel(relation.childLabel),
      parentTopicId: topicIdForLabel(relation.parentLabel),
      createdAt: timestamp,
      updatedAt: timestamp,
    })),
  )
  .onConflictDoNothing()
```

- [ ] **Step 6: Generate and inspect the migration**

Run:

```bash
npm run db:generate
```

Inspect the new `0006_*.sql`. It must:

- Add `created_at` and `updated_at` to `topics` with defaults.
- Create `topic_aliases`.
- Create `topic_relations`.
- Create the three indexes asserted by the foundation test.
- Include the `topic_relations_not_self_check` check.

If Drizzle emits a table rebuild for `topics`, verify it copies existing `id` and `label` values.

- [ ] **Step 7: Run foundation tests**

```bash
npm test -- src/testing/db-foundation.test.ts --run
```

- [ ] **Step 8: Commit Task 1-2**

```bash
git add src/platform/db src/testing/db-foundation.test.ts
git commit -m "feat: add topic graph storage"
```

---

### Task 3: Implement Topic Resolution For Problem Writes

**Files:**

- Add: `src/features/problems/domain/topic-taxonomy.ts`
- Add: `src/features/problems/data/topic-resolver.ts`
- Modify: `src/features/problems/data/problems-repository.ts`
- Modify: `src/features/problems/data/problems-repository.test.ts`

- [ ] **Step 1: Add failing repository tests for aliases and unknown labels**

Add these tests to `src/features/problems/data/problems-repository.test.ts`:

```ts
it('resolves topic aliases and auto-creates unknown topics on manual writes', async () => {
  const handle = await createTestDb({
    now: new Date('2026-05-29T12:00:00.000Z'),
  })

  await createProblem(handle.db, {
    ...newProblemInput(),
    slugOrUrl: 'heap-drill',
    title: 'Heap Drill',
    topicLabels: ['Heaps', 'Priority Queue', 'Brand New Pattern'],
  })

  const saved = await createProblemsRepository(handle.db).getForEdit(
    'heap-drill',
  )

  expect(saved?.topics.map((topic) => topic.label)).toEqual([
    'Brand New Pattern',
    'Heap (Priority Queue)',
  ])
  expect(saved?.topics.map((topic) => topic.id)).toEqual([
    'brand-new-pattern',
    'heap-priority-queue',
  ])
})

it('keeps manual topic replacement semantics after alias resolution', async () => {
  const handle = await createTestDb()

  await createProblem(handle.db, {
    ...newProblemInput(),
    slugOrUrl: 'replace-topic-drill',
    title: 'Replace Topic Drill',
    topicLabels: ['Array', 'Heaps'],
  })
  await updateProblem(handle.db, {
    ...updateProblemInput(),
    problemSlug: 'replace-topic-drill',
    title: 'Replace Topic Drill',
    topicLabels: ['DP'],
  })

  const saved = await createProblemsRepository(handle.db).getForEdit(
    'replace-topic-drill',
  )

  expect(saved?.topics.map((topic) => topic.label)).toEqual([
    'Dynamic Programming',
  ])
})
```

- [ ] **Step 2: Add pure topic taxonomy helpers**

Create `src/features/problems/domain/topic-taxonomy.ts`:

```ts
import { normalizeLeetCodeSlug } from '@/lib/leetcode'

export interface TopicSummary {
  id: string
  label: string
}

export function normalizeTopicLookupKey(value: string) {
  return normalizeLeetCodeSlug(value)
}

export function normalizeTopicLabelList(labels: readonly string[]) {
  const seen = new Set<string>()
  const normalizedLabels: string[] = []

  for (const label of labels) {
    const normalizedLabel = label.trim().replace(/\s+/g, ' ')
    const key = normalizeTopicLookupKey(normalizedLabel)

    if (!normalizedLabel || seen.has(key)) {
      continue
    }

    seen.add(key)
    normalizedLabels.push(normalizedLabel)
  }

  return normalizedLabels
}

export function createTopicId(label: string) {
  return normalizeTopicLookupKey(label)
}
```

- [ ] **Step 3: Add DB resolver**

Create `src/features/problems/data/topic-resolver.ts`. It should export:

```ts
export async function resolveTopicLabels(
  db: TopicResolverDb,
  labels: readonly string[],
  now = new Date(),
): Promise<TopicSummary[]>

export async function replaceProblemTopicLabels(
  db: TopicResolverDb,
  problemSlug: string,
  labels: readonly string[],
  now = new Date(),
): Promise<void>

export async function mergeProblemTopicLabels(
  db: TopicResolverDb,
  problemSlug: string,
  labels: readonly string[],
  now = new Date(),
): Promise<void>
```

Resolver order:

1. Normalize the label list with `normalizeTopicLabelList`.
2. Match existing topics by `topics.id`.
3. Match existing topics by normalized `topics.label`.
4. Match aliases by `topicAliases.aliasKey`.
5. Insert missing topics with `id = createTopicId(label)`.
6. Return resolved topics sorted by the input label order, with duplicates collapsed by topic id.

The insert path must use timestamps:

```ts
await db
  .insert(topics)
  .values(
    missingLabels.map((label) => ({
      id: createTopicId(label),
      label,
      createdAt: timestamp,
      updatedAt: timestamp,
    })),
  )
  .onConflictDoNothing()
```

- [ ] **Step 4: Route topic writes through the resolver**

In `src/features/problems/data/problems-repository.ts`:

- Keep company handling inside the existing generic taxonomy helpers.
- Replace topic branches inside `setProblemLabels` and `setProblemTaxonomyLabels` with calls to `replaceProblemTopicLabels`.
- Pass `now` from `createProblem`, `updateProblem`, and `bulkUpdateProblems` into taxonomy writes.
- Remove `createTaxonomyId` for topics; keep company IDs created from labels.

The replacement branch should read like:

```ts
if (labels.topicLabels !== undefined) {
  await replaceProblemTopicLabels(db, problemSlug, labels.topicLabels, now)
}
```

- [ ] **Step 5: Run focused repository tests**

```bash
npm test -- src/features/problems/data/problems-repository.test.ts --run
```

- [ ] **Step 6: Commit Task 3**

```bash
git add src/features/problems/domain/topic-taxonomy.ts src/features/problems/data/topic-resolver.ts src/features/problems/data/problems-repository.ts src/features/problems/data/problems-repository.test.ts
git commit -m "feat: resolve problem topics through aliases"
```

---

### Task 4: Expose Parent Topic Rollups In Read Models

**Files:**

- Modify: `src/features/problems/data/problems-repository.ts`
- Modify: `src/features/problems/api/problems-contracts.ts`
- Modify: `src/features/problems/api/problems-serializers.ts`
- Modify: `src/features/problems/data/problems-repository.test.ts`
- Modify focused component/test fixtures if TypeScript requires the new field.

- [ ] **Step 1: Add failing repository test for parent rollups**

Add this test to `src/features/problems/data/problems-repository.test.ts`:

```ts
it('returns parent rollups for direct problem topics', async () => {
  const handle = await createTestDb()

  await createProblem(handle.db, {
    ...newProblemInput(),
    slugOrUrl: 'graph-rollup',
    title: 'Graph Rollup',
    topicLabels: ['BFS'],
  })

  const saved = await createProblemsRepository(handle.db).getForEdit(
    'graph-rollup',
  )

  expect(saved?.topics).toEqual([
    {
      id: 'breadth-first-search',
      label: 'Breadth-First Search',
      parentTopics: [
        { id: 'binary-tree', label: 'Binary Tree' },
        { id: 'graph-theory', label: 'Graph Theory' },
        { id: 'tree', label: 'Tree' },
      ],
    },
  ])
})
```

- [ ] **Step 2: Extend the repository type**

Change `ProblemTaxonomyLabel` in `src/features/problems/data/problems-repository.ts`:

```ts
export interface ProblemTopicParentLabel {
  id: string
  label: string
}

export interface ProblemTaxonomyLabel extends ProblemTopicParentLabel {
  parentTopics?: ProblemTopicParentLabel[]
}
```

Use `parentTopics: []` for topics without parents when serializing problem rows. Company labels must not get this field.

- [ ] **Step 3: Read parents for topic labels**

Add a helper in `problems-repository.ts`:

```ts
async function readParentTopicsByChildTopicId(
  db: ProblemReadDb,
  childTopicIds: readonly string[],
) {
  if (childTopicIds.length === 0) {
    return new Map<string, ProblemTaxonomyLabel[]>()
  }

  const rows = await db
    .select({
      childTopicId: topicRelations.childTopicId,
      id: topics.id,
      label: topics.label,
    })
    .from(topicRelations)
    .innerJoin(topics, eq(topics.id, topicRelations.parentTopicId))
    .where(inArray(topicRelations.childTopicId, [...childTopicIds]))
    .orderBy(asc(topics.label))

  return groupParentTopics(rows)
}
```

Call it from `readLabelsByProblem` only for `kind === 'topic'`, then attach `parentTopics` to each returned direct topic.

- [ ] **Step 4: Update API schemas and serializers**

In `src/features/problems/api/problems-contracts.ts`, split base topic summaries from problem topics:

```ts
export const problemTopicSummarySchema = z.object({
  id: z.string(),
  label: z.string(),
})

export const problemTopicSchema = problemTopicSummarySchema.extend({
  parentTopics: z.array(problemTopicSummarySchema).default(() => []),
})
```

Ensure `problemLibraryOptionsSchema` still uses the simple `{ id, label }` shape for option lists. Update serializers so every problem topic has `parentTopics`.

- [ ] **Step 5: Update fixture fallout**

Run typecheck to identify fixtures that need `parentTopics: []`:

```bash
npm run typecheck
```

Update only fixtures that fail compile. Do not add UI copy or new UI affordances for parent topics in this pass.

- [ ] **Step 6: Run focused tests**

```bash
npm test -- src/features/problems/data/problems-repository.test.ts src/features/problems/api/problems-contracts.test.ts --run
```

- [ ] **Step 7: Commit Task 4**

```bash
git add src/features/problems
git commit -m "feat: expose topic parent rollups"
```

---

### Task 5: Persist Captured LeetCode Topics Without Clearing Manual Topics

**Files:**

- Modify: `src/features/problems/api/problems-contracts.ts`
- Modify: `src/features/problems/server/problems-service.ts`
- Modify: `src/features/problems/data/problems-repository.ts`
- Modify: `src/features/overlay-session/hooks/use-leetcode-page-sync.ts`
- Modify: `src/features/problems/api/problems-contracts.test.ts`
- Modify: `src/features/problems/data/problems-repository.test.ts`
- Modify: `src/features/overlay-session/hooks/use-leetcode-overlay-session.test.tsx`

- [ ] **Step 1: Add failing contract test**

In `src/features/problems/api/problems-contracts.test.ts`, add:

```ts
it('parses LeetCode page topic labels for capture upserts', () => {
  expect(
    problemsUpsertFromPageRequestSchema.parse({
      surface: 'content-script',
      url: 'https://leetcode.com/problems/two-sum/',
      slug: 'two-sum',
      title: 'Two Sum',
      difficulty: 'Easy',
      isPremium: false,
      topicLabels: ['Array', 'Hash Table'],
    }),
  ).toMatchObject({
    topicLabels: ['Array', 'Hash Table'],
  })
})
```

- [ ] **Step 2: Add failing repository/service merge test**

In `src/features/problems/data/problems-repository.test.ts`, extend the page upsert coverage:

```ts
it('merges captured LeetCode topics without clearing manual topics', async () => {
  const handle = await createTestDb()

  await createProblem(handle.db, {
    ...newProblemInput(),
    slugOrUrl: 'two-sum',
    title: 'Two Sum',
    topicLabels: ['Custom Local Topic'],
  })
  await upsertProblemFromPage(handle.db, {
    url: 'https://leetcode.com/problems/two-sum/',
    slug: 'two-sum',
    title: 'Two Sum',
    difficulty: 'Easy',
    isPremium: false,
    topicLabels: ['Array', 'Hash Map'],
  })

  const saved = await createProblemsRepository(handle.db).getForEdit('two-sum')

  expect(saved?.topics.map((topic) => topic.label)).toEqual([
    'Array',
    'Custom Local Topic',
    'Hash Table',
  ])
})
```

- [ ] **Step 3: Add failing overlay hook assertion**

In `src/features/overlay-session/hooks/use-leetcode-overlay-session.test.tsx`, add a test that emits `page-ready` and verifies the runtime request:

```ts
it('sends captured topic labels when syncing the LeetCode page', async () => {
  renderOverlaySession()

  emitPageReady()
  await waitFor(() =>
    expect(upsertProblemFromPageViaRuntime).toHaveBeenCalledWith(
      expect.objectContaining({
        topicLabels: ['Array'],
      }),
    ),
  )
})
```

- [ ] **Step 4: Add `topicLabels` to the runtime request schema**

In `src/features/problems/api/problems-contracts.ts`:

```ts
export const problemsUpsertFromPageRequestSchema = z.object({
  surface: problemsUpsertFromPageSurfaceSchema,
  url: z.string(),
  slug: problemSlugSchema.nullish(),
  title: z.string().nullish(),
  difficulty: z.string().nullish(),
  isPremium: z.boolean().nullish(),
  topicLabels: z.array(z.string().trim().min(1)).optional(),
})
```

- [ ] **Step 5: Thread capture topic labels through service and repository**

In `src/features/problems/server/problems-service.ts`, include `topicLabels` in `UpsertProblemFromPageInput` and pass it to the repository:

```ts
await createProblemsRepository(db).upsertFromLeetCode(
  {
    slug,
    title: input.title,
    difficulty: input.difficulty,
    isPremium: input.isPremium,
    topicLabels: input.topicLabels,
  },
  now,
)
```

In `ProblemsRepository.upsertFromLeetCode`, after the problem row upsert and inside the same transaction, call:

```ts
if (input.topicLabels !== undefined) {
  await mergeProblemTopicLabels(
    transactionDb,
    problem.slug,
    input.topicLabels,
    now,
  )
}
```

- [ ] **Step 6: Send topics from the page sync hook**

In `src/features/overlay-session/hooks/use-leetcode-page-sync.ts`:

```ts
topicLabels: nextMetadata.topics.map((topic) => topic.name),
```

Place it in the `upsertProblemFromPageViaRuntime` request next to `isPremium`.

- [ ] **Step 7: Run focused tests**

```bash
npm test -- src/features/problems/api/problems-contracts.test.ts src/features/problems/data/problems-repository.test.ts src/features/overlay-session/hooks/use-leetcode-overlay-session.test.tsx --run
```

- [ ] **Step 8: Commit Task 5**

```bash
git add src/features/problems src/features/overlay-session/hooks
git commit -m "feat: persist captured problem topics"
```

---

### Task 6: Add Backup, Restore, And Sync Compatibility

**Files:**

- Modify: `src/features/backup/api/backup-contracts.ts`
- Modify: `src/features/backup/api/backup-contracts.test.ts`
- Modify: `src/features/backup/data/backup-repository.ts`
- Modify: `src/features/backup/server/backup-service.ts`
- Modify: `src/features/backup/server/backup-service.test.ts`

- [ ] **Step 1: Add failing backup contract tests**

In `src/features/backup/api/backup-contracts.test.ts`, update `createValidBackupFixture` so topics include timestamps and the data object includes `topicAliases` and `topicRelations`:

```ts
topics: [
  { id: 'array', label: 'Array', createdAt: timestamp, updatedAt: timestamp },
  {
    id: 'hash-table',
    label: 'Hash Table',
    createdAt: timestamp,
    updatedAt: timestamp,
  },
],
topicAliases: [
  {
    aliasKey: 'hash-map',
    label: 'Hash Map',
    topicId: 'hash-table',
    createdAt: timestamp,
    updatedAt: timestamp,
  },
],
topicRelations: [
  {
    parentTopicId: 'array',
    childTopicId: 'hash-table',
    createdAt: timestamp,
    updatedAt: timestamp,
  },
],
```

Update summary counts to include:

```ts
topicAliases: 1,
topicRelations: 1,
```

Add a v2 normalization test:

```ts
it('normalizes v2 backups into v3 topic graph backups', () => {
  const v2Backup = {
    ...createValidBackupFixture(),
    schemaVersion: 2,
    data: {
      ...createValidBackupFixture().data,
      topics: [{ id: 'array', label: 'Array' }],
      topicAliases: undefined,
      topicRelations: undefined,
    },
  }

  const parsed = parseBackupFileForCurrentApp(v2Backup)

  expect(parsed.schemaVersion).toBe(3)
  expect(parsed.data.topics[0]).toMatchObject({
    id: 'array',
    label: 'Array',
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  expect(parsed.data.topicAliases).toEqual([])
  expect(parsed.data.topicRelations).toEqual([])
})
```

- [ ] **Step 2: Add failing backup service validation tests**

In `src/features/backup/server/backup-service.test.ts`, import `topicAliases` and `topicRelations`, then add tests:

```ts
it('exports and restores topic aliases and relations', async () => {
  const source = await createTestDb({ now })
  await insertCustomState(source.db)
  await source.db.insert(topicAliases).values({
    aliasKey: 'custom-alias',
    label: 'Custom Alias',
    topicId: 'custom-topic',
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  await source.db.insert(topics).values({
    id: 'custom-parent',
    label: 'Custom Parent',
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  await source.db.insert(topicRelations).values({
    parentTopicId: 'custom-parent',
    childTopicId: 'custom-topic',
    createdAt: timestamp,
    updatedAt: timestamp,
  })

  const backup = await exportFullBackup(source.db, { exportedAt: now })
  const target = await createTestDb({ now })

  await restoreFullBackup(target.db, backup)

  expect(await target.db.select().from(topicAliases)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ aliasKey: 'custom-alias' }),
    ]),
  )
  expect(await target.db.select().from(topicRelations)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        parentTopicId: 'custom-parent',
        childTopicId: 'custom-topic',
      }),
    ]),
  )
})

it('rejects cyclic topic relation graphs', async () => {
  const { db } = await createTestDb({ now })
  await insertCustomState(db)
  const backup = await exportFullBackup(db, { exportedAt: now })

  expect(() =>
    validateFullBackup({
      ...backup,
      data: {
        ...backup.data,
        topics: [
          ...backup.data.topics,
          {
            id: 'topic-a',
            label: 'Topic A',
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
          },
          {
            id: 'topic-b',
            label: 'Topic B',
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
          },
        ],
        topicRelations: [
          {
            parentTopicId: 'topic-a',
            childTopicId: 'topic-b',
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
          },
          {
            parentTopicId: 'topic-b',
            childTopicId: 'topic-a',
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
          },
        ],
      },
    } satisfies BackupFile),
  ).toThrow(/cyclic topic relation/i)
})
```

Add smaller validation cases for dangling aliases, dangling relation parents/children, duplicate alias keys, and self-parent relations.

- [ ] **Step 3: Bump backup schema to v3**

In `src/features/backup/api/backup-contracts.ts`:

```ts
export const backupSchemaVersion = 3
export const minimumSupportedBackupSchemaVersion = 1
```

Add schemas:

```ts
export const backupTopicRowSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export const backupTopicAliasRowSchema = z.object({
  aliasKey: z.string().min(1),
  label: z.string().min(1),
  topicId: z.string().min(1),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export const backupTopicRelationRowSchema = z.object({
  parentTopicId: z.string().min(1),
  childTopicId: z.string().min(1),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})
```

Add `topicAliases` and `topicRelations` to the backup data schema and summary counts.

- [ ] **Step 4: Normalize old backups**

Extend `parseBackupFileForCurrentApp` normalization so:

- v1 backups normalize track progress as today, then normalize topics to v3.
- v2 backups normalize directly to v3.
- v1/v2 topic rows without timestamps receive `exportedAt` for `createdAt` and `updatedAt`.
- v1/v2 backups receive empty `topicAliases` and `topicRelations`.

Keep unsupported future versions rejected.

- [ ] **Step 5: Export and import graph rows**

In `src/features/backup/data/backup-repository.ts`:

- Import `topicAliases` and `topicRelations`.
- Read both tables in `readBackupData`.
- Add both arrays to returned backup data.
- Clear tables before deleting `topics`.
- Insert `topics` before aliases and relations.
- Insert aliases and relations before `problemTopics`.

Clear order:

```ts
await db.delete(problemTopics)
await db.delete(topicRelations)
await db.delete(topicAliases)
await db.delete(topics)
```

Insert order:

```ts
await insertIfAny(db, topics, data.topics)
await insertIfAny(db, topicAliases, data.topicAliases)
await insertIfAny(db, topicRelations, data.topicRelations)
await insertIfAny(db, problemTopics, data.problemTopics)
```

- [ ] **Step 6: Validate graph references and cycles**

In `src/features/backup/server/backup-service.ts`, extend `validateBackupReferences`:

- `uniqueValues(data.topicAliases, (row) => row.aliasKey, 'topic alias key')`
- `uniqueValues(data.topicRelations, (row) => \`\${row.parentTopicId}:\${row.childTopicId}\`, 'topic relation')`
- Every alias topic exists.
- Every relation parent and child exists.
- `parentTopicId !== childTopicId`.
- Alias keys must not collide with a different topic lookup key.
- Parent graph must be acyclic.

Implement cycle detection with a pure DFS helper:

```ts
function assertAcyclicTopicRelations(
  relations: readonly { parentTopicId: string; childTopicId: string }[],
) {
  const parentsByChild = new Map<string, string[]>()

  for (const relation of relations) {
    const parents = parentsByChild.get(relation.childTopicId) ?? []
    parents.push(relation.parentTopicId)
    parentsByChild.set(relation.childTopicId, parents)
  }

  const visiting = new Set<string>()
  const visited = new Set<string>()

  function visit(topicId: string) {
    if (visited.has(topicId)) {
      return
    }
    if (visiting.has(topicId)) {
      throw new Error(`Cyclic topic relation involving ${topicId}.`)
    }

    visiting.add(topicId)
    for (const parentId of parentsByChild.get(topicId) ?? []) {
      visit(parentId)
    }
    visiting.delete(topicId)
    visited.add(topicId)
  }

  for (const topicId of parentsByChild.keys()) {
    visit(topicId)
  }
}
```

- [ ] **Step 7: Run focused backup tests**

```bash
npm test -- src/features/backup/api/backup-contracts.test.ts src/features/backup/server/backup-service.test.ts --run
```

- [ ] **Step 8: Commit Task 6**

```bash
git add src/features/backup
git commit -m "feat: back up topic graph data"
```

---

### Task 7: Documentation And Full Validation

**Files:**

- Modify: `docs/product.md`
- Modify: `docs/architecture.md`
- Modify: `docs/testing.md`
- Modify: `docs/superpowers/README.md` if the plan link is not already present.

- [ ] **Step 1: Update product docs**

In `docs/product.md`, update problem topic behavior to say:

- Library topics remain editable as problem metadata.
- Topic labels are standardized through stored aliases.
- Captured LeetCode page topics are merged into the problem without clearing local topics.
- Topic graph management UI is not part of current behavior.

- [ ] **Step 2: Update architecture docs**

In `docs/architecture.md`, update the problems and database sections:

- `topics` is the durable registry.
- `topic_aliases` resolves variant labels.
- `topic_relations` stores parent rollups.
- Manual writes use replace semantics.
- Capture writes use merge semantics.
- Backup schema v3 includes aliases and relations.

- [ ] **Step 3: Update testing docs**

In `docs/testing.md`, add topic graph focused checks:

```bash
npm test -- src/testing/db-foundation.test.ts --run
npm test -- src/features/problems/data/problems-repository.test.ts --run
npm test -- src/features/backup/api/backup-contracts.test.ts src/features/backup/server/backup-service.test.ts --run
```

- [ ] **Step 4: Format changed docs and code**

```bash
npm run format -- docs/product.md docs/architecture.md docs/testing.md docs/superpowers/README.md docs/superpowers/plans/2026-05-29-topic-graph-standardization.md
npm run format -- src/platform/db src/features/problems src/features/backup src/features/overlay-session/hooks/use-leetcode-page-sync.ts src/testing/db-foundation.test.ts
```

- [ ] **Step 5: Run database checks**

```bash
npm run db:check
```

- [ ] **Step 6: Run focused feature tests**

```bash
npm test -- src/testing/db-foundation.test.ts src/features/problems/data/problems-repository.test.ts src/features/problems/api/problems-contracts.test.ts src/features/overlay-session/hooks/use-leetcode-overlay-session.test.tsx src/features/backup/api/backup-contracts.test.ts src/features/backup/server/backup-service.test.ts --run
```

- [ ] **Step 7: Run full validation**

```bash
npm run check
```

- [ ] **Step 8: Commit final docs and cleanup**

```bash
git add docs src
git commit -m "docs: document topic graph behavior"
```

---

## Execution Notes

- Use the approved design spec as the exact seed taxonomy source.
- Keep the implementation internal. Do not add topic graph management UI.
- Preserve user data on standardization. Moving problem-topic rows from alias topics to target topics is allowed; dropping links is not.
- Do not alter company taxonomy behavior except for any type fallout from separating topic and company helpers.
- After every task commit, check `git status --short` and inspect unstaged changes before proceeding.

## Final Self-Review Checklist

- Topic storage has `topics`, `topic_aliases`, `topic_relations`, and unchanged direct `problem_topics`.
- Topics have no canonical/source/origin flags.
- Seed creates the LeetCode labels, stored aliases, parent links, and legacy `Intervals` topic.
- Known aliases merge old problem-topic rows into the target topic.
- Manual writes replace direct topics after resolution.
- LeetCode capture merges direct topics after resolution.
- Read models expose parent rollups without adding management UI.
- Backup v3 exports/imports aliases and relations.
- v1/v2 backups still restore through normalization.
- Cycle, dangling reference, duplicate alias, and duplicate join cases are rejected before restore writes.
- `npm run check` passes.
