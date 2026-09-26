# Topics Phase 2: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the topic registry without losing local data, make aliases unambiguous, distinguish containment from applicability, and expose trustworthy Library membership and backup v4.

**Architecture:** Problems owns normalization, graph rules, reconciliation, and read models. Platform owns physical tables and staged snapshot migration; background composition supplies the Problems reconciliation callback before the staged database is published. Backup normalization uses the same pure reconciliation rules and preserves current-format custom data.

**Tech Stack:** TypeScript, Drizzle SQLite proxy, SQLite WASM, Zod 4, Vitest, Chrome local storage, existing runtime messaging.

---

## Execution Contract

Implement after Phase 1 passes its preserving-upgrade tests. Read the approved
`docs/superpowers/specs/2026-09-26-topics-foundation-library-filtering-design.md`
and the current authority documents first. Use the repository workflow,
database migration, Zod, and Vitest skills during execution. Fetch current
Context7 documentation before library-specific implementation decisions.

Commands below run from the execution worktree and use the required `rtk`
prefix. Do not execute this plan while merely reviewing the plan. Each task
contains its focused red/green command; broad validation happens once after
integration. Never regenerate the existing eight migrations (0000–0007) or accept a local
data reset to make tests pass.

Phase 1 supplies:

```ts
getAppDb(options?: {
  beforePublish?: (
    handle: DbHandle,
    context: { kind: 'fresh' | 'upgrade'; fromFingerprint: string | null },
  ) => Promise<void>
}): Promise<DbHandle>
```

The hook runs only for staged fresh/upgrade handles, after incremental SQL and
before snapshot publication or normal mutation hooks. Matching current
snapshots do not rerun it. `src/extension/background/app-db.ts` owns
`getBackgroundDb()`; handler registration imports that wrapper as `getAppDb`.
This phase supplies its callback. No `platform -> features` import is allowed.

Phase 3 consumes these required fields:

```ts
type TopicOption = { id: string; label: string; aliases: string[] }
type LibraryTopicMembership = { effectiveTopicIds: string[] }
```

Library rows retain existing direct `topics` and add `effectiveTopicIds`.
Existing `parentTopics` becomes the deduplicated transitive broader ancestors
of that direct topic. Aliases are display strings, not internal lookup keys.

## File Responsibilities

| File                                                   | Responsibility                                                                           |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `src/features/problems/domain/topic-taxonomy.ts`       | Search normalization, persisted-label validation, ID allocation, unique lookup namespace |
| `src/features/problems/domain/topic-graph.ts`          | Typed relation validation and iterative ancestor expansion                               |
| `src/features/problems/domain/topic-reconciliation.ts` | Pure versioned legacy corrections and collision-safe canonical reconciliation            |
| `src/features/problems/data/topic-reconciliation.ts`   | Read/apply reconciliation atomically through the Problems owner                          |
| `src/features/problems/data/topic-resolver.ts`         | Resolve all write inputs through the validated namespace                                 |
| `src/features/problems/data/topic-read-model.ts`       | Load a registry once and construct aliases/ancestor read helpers                         |
| `src/platform/db/topic-taxonomy-seed.ts`               | Explicit stable canonical IDs, alias keys, typed curated edges                           |
| `src/platform/db/schema/topic-relations.ts`            | Typed physical relation table                                                            |
| `src/platform/db/seed.ts`                              | Insert-only fresh defaults without destructive alias merging                             |
| `src/extension/background/app-db.ts`                   | Connect staged database opening to Problems reconciliation                               |
| `src/features/backup/api/backup-contracts.ts`          | v4 wire schema and explicit v1–3 normalization                                           |
| `src/features/backup/server/backup-service.ts`         | Shared taxonomy validation before restore                                                |
| `src/features/problems/api/problems-contracts.ts`      | Required Library membership and option fields                                            |

## Task 1: Separate Topic Keys From URLs And Validate One Namespace

**Files:**

- Modify: `src/features/problems/domain/topic-taxonomy.ts`
- Create: `src/features/problems/domain/topic-taxonomy.test.ts`

- [ ] **Step 1: Add regression tests for slash loss, Unicode, and collisions.**

```ts
import { describe, expect, it } from 'vitest'
import {
  buildTopicLookup,
  createTopicId,
  normalizeTopicLookupKey,
  normalizeTopicSearchKey,
} from './topic-taxonomy'

describe('topic identity', () => {
  it('preserves slash text and Unicode while normalizing typography', () => {
    expect(normalizeTopicLookupKey(' Tree / Graph ')).toBe('tree / graph')
    expect(normalizeTopicLookupKey('  动态规划  ')).toBe('动态规划')
    expect(normalizeTopicLookupKey('Union–Find')).toBe('union-find')
    expect(normalizeTopicLookupKey('Cafe\u0301')).toBe('café')
    expect(normalizeTopicSearchKey(' / ')).toBe('/')
    expect(normalizeTopicSearchKey('')).toBe('')
    expect(() => normalizeTopicLookupKey('/ &')).toThrow('letter or number')
  })

  it('rejects aliases shadowed by another canonical identity', () => {
    expect(() =>
      buildTopicLookup(
        [
          { id: 'tree', label: 'Tree' },
          { id: 'custom', label: 'DFS' },
        ],
        [{ aliasKey: 'dfs', label: 'DFS', topicId: 'tree' }],
      ),
    ).toThrow('dfs')
  })

  it('keeps ID allocation separate from lossy slug spelling', () => {
    const id = createTopicId(new Set(['topic-fixed']), () => 'fixed-2')
    expect(id).toBe('topic-fixed-2')
  })
})
```

- [ ] **Step 2: Run `rtk npm run test -- src/features/problems/domain/topic-taxonomy.test.ts`.** Expected: failure because the new exports do not exist and slash normalization is wrong.
- [ ] **Step 3: Replace the URL-normalizer dependency with these domain functions.** Keep `TopicSummary` as `{ id: string; label: string }` and retain the public `normalizeTopicLabelList` export used by the resolver.

```ts
export interface TopicAliasLookup {
  aliasKey: string
  label: string
  topicId: string
}

export function normalizeTopicSearchKey(value: string) {
  return value
    .normalize('NFC')
    .trim()
    .replace(/\s+/gu, ' ')
    .replace(/[\u2010-\u2015\u2212]/gu, '-')
    .toLowerCase()
    .normalize('NFC')
}

export function normalizeTopicLookupKey(value: string) {
  const key = normalizeTopicSearchKey(value)
  if (!/[\p{L}\p{N}]/u.test(key)) {
    throw new Error('Topic names must contain a Unicode letter or number.')
  }
  return key
}

export function normalizeTopicLabelList(labels: readonly string[]) {
  const seen = new Set<string>()
  return labels.flatMap((value) => {
    const label = value.normalize('NFC').trim().replace(/\s+/gu, ' ')
    const key = normalizeTopicLookupKey(label)
    if (seen.has(key)) return []
    seen.add(key)
    return [label]
  })
}

export function createTopicId(
  occupied: ReadonlySet<string>,
  nextId: () => string = () => crypto.randomUUID(),
) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const id = `topic-${nextId()}`
    if (!occupied.has(normalizeTopicLookupKey(id))) return id
  }
  throw new Error('Unable to allocate a unique topic ID.')
}

export function buildTopicLookup(
  topics: readonly TopicSummary[],
  aliases: readonly TopicAliasLookup[],
) {
  const byId = new Map<string, TopicSummary>()
  const lookup = new Map<string, TopicSummary>()
  const register = (input: string, topic: TopicSummary) => {
    const key = normalizeTopicLookupKey(input)
    const previous = lookup.get(key)
    if (previous && previous.id !== topic.id) {
      throw new Error(
        `Topic lookup collision for "${key}": ${previous.id} / ${topic.id}`,
      )
    }
    lookup.set(key, topic)
  }
  for (const topic of topics) {
    if (byId.has(topic.id)) throw new Error(`Duplicate topic ID: ${topic.id}`)
    byId.set(topic.id, topic)
    register(topic.id, topic)
    register(topic.label, topic)
  }
  const aliasKeys = new Set<string>()
  for (const alias of aliases) {
    if (alias.aliasKey !== normalizeTopicLookupKey(alias.label)) {
      throw new Error(`Invalid topic alias key: ${alias.aliasKey}`)
    }
    if (aliasKeys.has(alias.aliasKey))
      throw new Error(`Duplicate topic alias: ${alias.aliasKey}`)
    aliasKeys.add(alias.aliasKey)
    const topic = byId.get(alias.topicId)
    if (!topic) throw new Error(`Missing alias target: ${alias.topicId}`)
    register(alias.aliasKey, topic)
  }
  return lookup
}
```

All existing seeded IDs remain unchanged. UUID IDs apply only to newly created
unknown topics, and the resolver passes the complete namespace's occupied keys.
This prevents punctuation differences from turning into an accidental merge.

- [ ] **Step 4: Run `rtk npm run test -- src/features/problems/domain/topic-taxonomy.test.ts`.** Expected: all new tests pass. Also add an eight-collision allocator failure case and aliases that match their own canonical identity.
- [ ] **Step 5: Commit with `rtk git add src/features/problems/domain/topic-taxonomy.ts src/features/problems/domain/topic-taxonomy.test.ts` and `rtk git commit -m "feat(topics): define collision-safe topic identity"`.**

## Task 2: Implement Typed, Iterative Graph Expansion

**Files:**

- Create: `src/features/problems/domain/topic-graph.ts`
- Create: `src/features/problems/domain/topic-graph.test.ts`

- [ ] **Step 1: Add a graph test containing nesting, a diamond, and applicability.**

```ts
import { expect, it } from 'vitest'
import { buildTopicGraph, type TopicRelation } from './topic-graph'

it('deduplicates ancestors without treating applicability as membership', () => {
  const topics = ['tree', 'binary-tree', 'bst', 'dfs', 'graph'].map((id) => ({
    id,
    label: id,
  }))
  const relations: TopicRelation[] = [
    { sourceTopicId: 'bst', targetTopicId: 'binary-tree', kind: 'broader' },
    { sourceTopicId: 'binary-tree', targetTopicId: 'tree', kind: 'broader' },
    { sourceTopicId: 'bst', targetTopicId: 'tree', kind: 'broader' },
    { sourceTopicId: 'dfs', targetTopicId: 'tree', kind: 'applies-to' },
    { sourceTopicId: 'dfs', targetTopicId: 'graph', kind: 'applies-to' },
  ]
  const graph = buildTopicGraph(topics, relations)
  expect(graph.effectiveTopicIds(['bst', 'tree'])).toEqual([
    'binary-tree',
    'bst',
    'tree',
  ])
  expect(graph.ancestorsOf('dfs')).toEqual([])
  expect(() =>
    buildTopicGraph(topics, [
      ...relations,
      { sourceTopicId: 'tree', targetTopicId: 'bst', kind: 'broader' },
    ]),
  ).toThrow('cycle')
})
```

- [ ] **Step 2: Run `rtk npm run test -- src/features/problems/domain/topic-graph.test.ts`.** Expected: missing-module failure.
- [ ] **Step 3: Implement the pure graph with an iterative cycle check and memoized traversal.**

```ts
export type TopicRelationKind = 'broader' | 'applies-to'
export interface TopicRelation {
  sourceTopicId: string
  targetTopicId: string
  kind: TopicRelationKind
}

export function buildTopicGraph(
  topics: readonly { id: string }[],
  relations: readonly TopicRelation[],
) {
  const ids = new Set(topics.map((topic) => topic.id))
  if (ids.size !== topics.length) throw new Error('Duplicate topic ID.')
  const parents = new Map([...ids].map((id) => [id, new Set<string>()]))
  const incoming = new Map([...ids].map((id) => [id, 0]))
  const seenEdges = new Set<string>()
  for (const edge of relations) {
    const { sourceTopicId: source, targetTopicId: target, kind } = edge
    if (!ids.has(source) || !ids.has(target))
      throw new Error('Dangling topic relation.')
    if (source === target)
      throw new Error('Topic relation cannot link to itself.')
    if (kind !== 'broader' && kind !== 'applies-to')
      throw new Error('Unknown topic relation kind.')
    const key = JSON.stringify([kind, source, target])
    if (seenEdges.has(key)) throw new Error('Duplicate typed topic relation.')
    seenEdges.add(key)
    if (kind === 'broader') {
      parents.get(source)!.add(target)
      incoming.set(target, incoming.get(target)! + 1)
    }
  }
  const ready = [...incoming]
    .filter(([, count]) => count === 0)
    .map(([id]) => id)
  let visitedCount = 0
  for (let index = 0; index < ready.length; index += 1) {
    const id = ready[index]!
    visitedCount += 1
    for (const parent of parents.get(id)!) {
      const count = incoming.get(parent)! - 1
      incoming.set(parent, count)
      if (count === 0) ready.push(parent)
    }
  }
  if (visitedCount !== ids.size)
    throw new Error('Broader topic cycle detected.')

  const cache = new Map<string, readonly string[]>()
  const ancestorsOf = (id: string): readonly string[] => {
    if (!ids.has(id)) throw new Error(`Unknown direct topic: ${id}`)
    const cached = cache.get(id)
    if (cached) return cached
    const found = new Set<string>()
    const pending = [...parents.get(id)!]
    while (pending.length > 0) {
      const next = pending.pop()!
      if (found.has(next)) continue
      found.add(next)
      pending.push(...parents.get(next)!)
    }
    const ancestors = [...found].sort()
    cache.set(id, ancestors)
    return ancestors
  }
  const effectiveTopicIds = (directIds: readonly string[]) => {
    const result = new Set<string>()
    for (const id of directIds) {
      result.add(id)
      for (const ancestor of ancestorsOf(id)) result.add(ancestor)
    }
    return [...result].sort()
  }
  return { ancestorsOf, effectiveTopicIds }
}
```

- [ ] **Step 4: Add parameterized self-link, dangling-endpoint, duplicate-edge, disconnected-root, and applies-to-cycle tests; add a 2,000-node chain test whose single leaf returns 1,999 ancestors. Run `rtk npm run test -- src/features/problems/domain/topic-graph.test.ts`.** Expected: all pass without recursion overflow or depth truncation.
- [ ] **Step 5: Commit with `rtk git add src/features/problems/domain/topic-graph.ts src/features/problems/domain/topic-graph.test.ts` and `rtk git commit -m "feat(topics): derive membership from typed topic graph"`.**

## Task 3: Define Typed Storage And The Complete Canonical Catalogue

**Files:**

- Modify: `src/platform/db/schema/topic-relations.ts`
- Modify: `src/platform/db/schema/topics.ts`
- Modify: `src/platform/db/topic-taxonomy-seed.ts`
- Modify: `src/platform/db/seed.ts`
- Create: `src/platform/db/migrations/0008_topics_typed_relations.sql`
- Generated: `src/platform/db/migrations/meta/0008_snapshot.json`
- Modify generated: `src/platform/db/migrations/meta/_journal.json`
- Create: `src/features/problems/domain/topic-catalogue.test.ts`
- Create: `src/features/problems/data/topic-migration.test.ts`

- [ ] **Step 1: Freeze the legacy alias rows before editing the seed.** Create `src/features/problems/domain/topic-legacy-manifest.ts` with `legacyTopicAliasRows` containing the existing 39 `{ label, topicLabel }` entries verbatim and version constant `topicReconciliationVersion = 1`. This is intentional historical data, not a second live catalogue. Snapshot the 34 old edges as `legacyTopicBroaderEdges` with existing stable IDs and source=old child. This permits exact label/target matching and avoids guessing legacy provenance.

Use this command to inspect the exact inputs, then copy their literal data:

```sh
rtk cat src/platform/db/topic-taxonomy-seed.ts
```

- [ ] **Step 2: Write storage and catalogue tests before modifying storage.** In `topic-migration.test.ts`, construct a handle from Phase 1's allowlisted legacy SQL, insert `Tree`, `Binary Tree`, and one old relation using `rawDb.exec`, apply only `0008_topics_typed_relations.sql`, and query `source_topic_id`, `target_topic_id`, `kind`, `created_at`, `updated_at`. Assert the exact row `{source_topic_id:'binary-tree',target_topic_id:'tree',kind:'broader',created_at:1,updated_at:2}`. Also assert a `broader` and `applies-to` edge may share endpoints while a duplicate typed edge or self-link fails.

The catalogue test must check the new cases and canonical keys:

```ts
expect(seedTopics.find((row) => row.id === 'meet-in-the-middle')?.label).toBe(
  'Meet in the Middle',
)
expect(seedTopics.find((row) => row.id === 'heap-priority-queue')?.label).toBe(
  'Heap (Priority Queue)',
)
const lookup = buildTopicLookup(seedTopics, seedTopicAliases)
expect(lookup.get('heap')?.id).toBe('heap-priority-queue')
expect(lookup.get('bit')?.id).toBe('binary-indexed-tree')
expect(lookup.get('dsu')?.id).toBe('union-find')
expect(lookup.get('kmp')?.id).toBe('kmp')
expect(lookup.get('arrays & hashing')).toBeUndefined()
expect(
  buildTopicGraph(seedTopics, seedTopicRelations).ancestorsOf(
    'breadth-first-search',
  ),
).toEqual([])
```

- [ ] **Step 3: Run `rtk npm run test -- src/features/problems/domain/topic-catalogue.test.ts src/features/problems/data/topic-migration.test.ts`.** Expected: the old exports/schema cannot satisfy these cases.
- [ ] **Step 4: Define the relation table fields and generate a named migration.**

```ts
export const topicRelations = sqliteTable(
  'topic_relations',
  {
    sourceTopicId: text('source_topic_id')
      .notNull()
      .references(() => topics.id, { onDelete: 'cascade' }),
    targetTopicId: text('target_topic_id')
      .notNull()
      .references(() => topics.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ['broader', 'applies-to'] }).notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.kind, table.sourceTopicId, table.targetTopicId],
    }),
    index('topic_relations_source_idx').on(table.sourceTopicId),
    index('topic_relations_target_idx').on(table.targetTopicId),
    check(
      'topic_relations_no_self_check',
      sql`${table.sourceTopicId} <> ${table.targetTopicId}`,
    ),
    check(
      'topic_relations_kind_check',
      sql`${table.kind} IN ('broader', 'applies-to')`,
    ),
  ],
)
```

Rename ORM relation names to `sourceTopic` and `targetTopic` consistently in
both schema files. Generate with:

```sh
rtk npm run db:generate -- --name topics_typed_relations
```

Review the generated rebuild and ensure its copy statement preserves all rows:

```sql
INSERT INTO `__new_topic_relations`
  (`source_topic_id`, `target_topic_id`, `kind`, `created_at`, `updated_at`)
SELECT `child_topic_id`, `parent_topic_id`, 'broader', `created_at`, `updated_at`
FROM `topic_relations`;
```

The generated table swap must preserve foreign keys and recreate the two
indexes. Phase 1 already bundles migration entries, so the new SQL file is
discovered automatically. Do not edit an old migration to correct semantics;
the Problems reconciliation callback corrects known rows after this conversion.

- [ ] **Step 5: Replace seed labels with explicit stable `{id,label}` rows.** Keep all 72 existing canonical IDs exactly as they are today. Add these eight rows:

```ts
{ id: 'meet-in-the-middle', label: 'Meet in the Middle' },
{ id: 'kmp', label: 'KMP' },
{ id: 'rabin-karp', label: 'Rabin-Karp' },
{ id: '1-d-dynamic-programming', label: '1-D Dynamic Programming' },
{ id: '2-d-dynamic-programming', label: '2-D Dynamic Programming' },
{ id: 'fast-and-slow-pointers', label: 'Fast And Slow Pointers' },
{ id: 'hash-map', label: 'Hash Map' },
{ id: 'hash-set', label: 'Hash Set' },
```

Export the resulting 81 rows as `seedTopics`; retain `seedTopicLabels =
seedTopics.map(topic => topic.label)` only if an existing caller still needs it.
The source-of-truth inventory test contains the user's 73 labels including Heap
and Meet in the Middle; Heap resolves by alias, so every input must resolve even
though there is no second Heap row. Include Intervals as an additional retained
canonical topic. Do not add counts to any record.

Use this exact safe alias mapping; each tuple becomes a literal
`{label,aliasKey,topicId}` row with its normalized lowercase label as aliasKey:

| Alias display text                                 | Target ID                    |
| -------------------------------------------------- | ---------------------------- |
| Arrays                                             | array                        |
| DP                                                 | dynamic-programming          |
| DFS                                                | depth-first-search           |
| BFS                                                | breadth-first-search         |
| Graph; Graphs                                      | graph-theory                 |
| Heap; Heaps; Priority Queue; Heap / Priority Queue | heap-priority-queue          |
| Trees                                              | tree                         |
| Tries                                              | trie                         |
| Stacks                                             | stack                        |
| Linked Lists                                       | linked-list                  |
| Prefix Sums                                        | prefix-sum                   |
| Union Find; Disjoint Set Union; DSU                | union-find                   |
| Fenwick Tree; BIT                                  | binary-indexed-tree          |
| BST                                                | binary-search-tree           |
| Bit Mask                                           | bitmask                      |
| MST                                                | minimum-spanning-tree        |
| SCC                                                | strongly-connected-component |
| Knuth-Morris-Pratt                                 | kmp                          |
| 1-D DP                                             | 1-d-dynamic-programming      |
| 2-D DP                                             | 2-d-dynamic-programming      |

Canonical labels such as Hash Map, KMP, and Rabin-Karp do not need alias rows
mapping to themselves. Preserve existing unknown valid aliases during
reconciliation; this table specifies defaults, not a global allowlist.

Replace `seedTopicRelations` with the complete broader table and eight
applies-to rows from the approved design. Use explicit IDs and kinds; no new
Tree→Graph edge. The eight applicability pairs are DFS→Tree, DFS→Graph Theory,
BFS→Tree, BFS→Graph Theory, Union-Find→Graph Theory, Rolling Hash→String,
Memoization→Dynamic Programming, and Memoization→Recursion.

- [ ] **Step 6: Make `seedInitialCatalog` insert these explicit records without retargeting existing rows.** Remove its local `seedTopics` projection, remove the call and implementation of `standardizeSeedTopicAliases`, and change alias insertion to `onConflictDoNothing()`. Insert relation rows by spreading explicit `sourceTopicId`, `targetTopicId`, and `kind`. All topic records receive `createdAt`/`updatedAt` only on insertion; existing rows keep timestamps. No platform file imports the feature normalizer; the literal alias-key invariant is checked by the catalogue test.

```ts
await db
  .insert(topics)
  .values(
    seedTopics.map((row) => ({
      ...row,
      createdAt: timestamp,
      updatedAt: timestamp,
    })),
  )
  .onConflictDoNothing()
await db
  .insert(topicAliases)
  .values(
    seedTopicAliases.map((row) => ({
      ...row,
      createdAt: timestamp,
      updatedAt: timestamp,
    })),
  )
  .onConflictDoNothing()
await db
  .insert(topicRelations)
  .values(
    seedTopicRelations.map((row) => ({
      ...row,
      createdAt: timestamp,
      updatedAt: timestamp,
    })),
  )
  .onConflictDoNothing()
```

- [ ] **Step 7: Run `rtk npm run db:check` and the Task 3 focused test command.** Expected: generated metadata is consistent, migration keeps old rows and timestamps, every inventory input resolves, and no curated cycle/collision exists.
- [ ] **Step 8: Commit the listed schema, seed, manifest, tests, and generated migration files with `rtk git commit -m "feat(topics): store typed relations and curated topic catalogue"`.** Stage only the paths listed in this task, including generated metadata.

## Task 4: Build One Pure Reconciliation Algorithm For Upgrade And Import

**Files:**

- Create: `src/features/problems/domain/topic-reconciliation.ts`
- Create: `src/features/problems/domain/topic-reconciliation.test.ts`
- Modify: `src/features/problems/domain/topic-legacy-manifest.ts`

- [ ] **Step 1: Define shared input/output types and an idempotence test.** These types deliberately support database milliseconds and backup ISO strings without changing timestamps.

```ts
type Timestamp = number | string
export interface TopicRows<T extends Timestamp> {
  topics: Array<{ id: string; label: string; createdAt: T; updatedAt: T }>
  topicAliases: Array<{
    aliasKey: string
    label: string
    topicId: string
    createdAt: T
    updatedAt: T
  }>
  topicRelations: Array<TopicRelation & { createdAt: T; updatedAt: T }>
  problemTopics: Array<{ problemSlug: string; topicId: string }>
}
export interface ReconcileTopicOptions<T extends Timestamp> {
  legacy: boolean
  now: T
}
```

```ts
it('rekeys custom aliases and corrects old edges without inventing assignments', () => {
  const old: TopicRows<number> = {
    topics: [
      { id: 'tree', label: 'Tree', createdAt: 1, updatedAt: 2 },
      {
        id: 'depth-first-search',
        label: 'Depth-First Search',
        createdAt: 1,
        updatedAt: 2,
      },
      { id: 'array', label: 'Array', createdAt: 1, updatedAt: 2 },
    ],
    topicAliases: [
      {
        aliasKey: 'my-tree-name',
        label: 'My Tree Name',
        topicId: 'tree',
        createdAt: 3,
        updatedAt: 4,
      },
    ],
    topicRelations: [
      {
        sourceTopicId: 'depth-first-search',
        targetTopicId: 'tree',
        kind: 'broader',
        createdAt: 5,
        updatedAt: 6,
      },
    ],
    problemTopics: [{ problemSlug: 'two-sum', topicId: 'array' }],
  }
  const result = reconcileTopicRows(old, { legacy: true, now: 10 })
  expect(result.topicAliases).toContainEqual({
    aliasKey: 'my tree name',
    label: 'My Tree Name',
    topicId: 'tree',
    createdAt: 3,
    updatedAt: 4,
  })
  expect(result.topicRelations).not.toContainEqual(
    expect.objectContaining({
      sourceTopicId: 'depth-first-search',
      targetTopicId: 'tree',
      kind: 'broader',
    }),
  )
  expect(result.problemTopics).toEqual(old.problemTopics)
  expect(reconcileTopicRows(result, { legacy: true, now: 20 })).toEqual(result)
})
```

- [ ] **Step 2: Run `rtk npm run test -- src/features/problems/domain/topic-reconciliation.test.ts`.** Expected: missing reconciliation export.
- [ ] **Step 3: Encode the exact correction manifest and transform in this order.**

1. Clone arrays/records; do not mutate caller data. In legacy mode, use exact
   old alias display label plus old target ID to recognize a former default.
   Remove a former default when it is absent from the new defaults or its target
   changed. Reject a custom row that uses a reserved new alias key with another
   target. Do not apply old-key spelling rules to current-format rows.
2. Build equivalence only from new safe aliases: a noncanonical topic whose
   normalized display label exactly matches a safe alias can merge into that
   alias's canonical target. Never infer equivalence from a slug-like ID alone.
   Do not merge any of the 81 canonical IDs. A colliding canonical ID is an error.
3. Remap every problem join, alias target, and both edge endpoints through the
   equivalence map. Retain old equivalent labels as direct aliases to the final
   target. Drop only self-edges produced by a proven identity merge; reject
   self-edges that already existed in the input. Collapse joins/typed edges
   produced by a merge. Reject pre-existing duplicate joins/edges before merging.
4. Add missing canonical rows without changing existing canonical IDs, labels,
   or timestamps. Do not replace custom canonical labels silently.
5. In legacy mode remove exactly the old broader pairs that the approved design
   changes: DFS/BFS→Tree/Binary Tree/Graph Theory, Union-Find→Graph Theory,
   Rolling Hash→String, Memoization→Dynamic Programming/Recursion. Other custom
   broader edges survive. Add all new curated typed edges.
6. In legacy mode re-key every retained alias from its display label; collapse
   equal keys only if targets agree. In current mode require existing keys to
   already match the display label. Add missing safe aliases, rejecting a
   differing target rather than overwriting it.
7. Run `buildTopicLookup`, `buildTopicGraph`, and direct-join reference checks.
   Sort all arrays by stable identities before returning so repeated operations
   are observably stable.

Use these concrete helper implementations for conflict handling and identity:

```ts
function edgeKey(edge: TopicRelation) {
  return JSON.stringify([edge.kind, edge.sourceTopicId, edge.targetTopicId])
}

function deduplicateAliases<T extends number | string>(
  aliases: TopicRows<T>['topicAliases'],
  legacy: boolean,
) {
  const result = new Map<string, TopicRows<T>['topicAliases'][number]>()
  for (const alias of aliases) {
    const key = normalizeTopicLookupKey(alias.label)
    if (!legacy && alias.aliasKey !== key) {
      throw new Error(`Invalid topic alias key: ${alias.aliasKey}`)
    }
    const previous = result.get(key)
    if (previous && previous.topicId !== alias.topicId) {
      throw new Error(
        `Conflicting alias "${alias.label}": ${previous.topicId} / ${alias.topicId}`,
      )
    }
    if (!previous) result.set(key, { ...alias, aliasKey: key })
  }
  return [...result.values()].sort((a, b) =>
    a.aliasKey.localeCompare(b.aliasKey),
  )
}

function removeObsoleteBroaderEdges<T extends number | string>(
  edges: TopicRows<T>['topicRelations'],
) {
  const removed = new Set([
    ...['depth-first-search', 'breadth-first-search'].flatMap((source) =>
      ['tree', 'binary-tree', 'graph-theory'].map((target) =>
        JSON.stringify(['broader', source, target]),
      ),
    ),
    JSON.stringify(['broader', 'union-find', 'graph-theory']),
    JSON.stringify(['broader', 'rolling-hash', 'string']),
    JSON.stringify(['broader', 'memoization', 'dynamic-programming']),
    JSON.stringify(['broader', 'memoization', 'recursion']),
  ])
  return edges.filter((edge) => !removed.has(edgeKey(edge)))
}
```

When an old edge becomes an applies-to edge, retain its timestamps for that
converted edge; brand-new edges receive `now`. For duplicate edges created by
merging, retain the existing canonical edge when present. For alias-key
collapses, preserve the first row in a stable sort by old alias key and target;
do not refresh timestamps on retry. These rules make the idempotence test pass.

- [ ] **Step 4: Add executable tests for the remaining destructive boundaries.** Use `structuredClone(old)` variants from Step 1 and assert: canonical Array joins remain only Array; two alias topics resolving to Heap merge joins once; aliases and custom relations referencing a merged topic are remapped; an unrelated custom edge survives; conflicting aliases throw without modifying the input; a current-format malformed alias key throws; and a normalized canonical-label collision throws. Run `rtk npm run test -- src/features/problems/domain/topic-reconciliation.test.ts src/features/problems/domain/topic-catalogue.test.ts` and expect all pass.
- [ ] **Step 5: Commit with `rtk git add src/features/problems/domain/topic-reconciliation.ts src/features/problems/domain/topic-reconciliation.test.ts src/features/problems/domain/topic-legacy-manifest.ts` and `rtk git commit -m "feat(topics): reconcile legacy taxonomy without guessing assignments"`.**

## Task 5: Apply Reconciliation Before Any Upgraded Snapshot Is Published

**Files:**

- Create: `src/features/problems/data/topic-reconciliation.ts`
- Create: `src/features/problems/data/topic-reconciliation.test.ts`
- Create: `src/extension/background/app-db.ts`
- Create: `src/extension/background/app-db.test.ts`
- Modify: `src/extension/background/register-handlers.ts`

- [ ] **Step 1: Add a repository test with legacy alias keys and a custom relation.** Use `createTestDb({seed:false})`, insert topic rows and an alias `{aliasKey:'custom-name',label:'Custom Name',topicId:'tree',createdAt:1,updatedAt:2}`, then run the exported reconciler twice and compare complete table snapshots. Add a collision case and compare before/after rows to establish rollback.
- [ ] **Step 2: Run `rtk npm run test -- src/features/problems/data/topic-reconciliation.test.ts src/extension/background/app-db.test.ts`.** Expected: missing repository export and missing callback invocation.
- [ ] **Step 3: Implement the owning transaction using the pure transform.** Read all four topic tables inside one transaction, call `reconcileTopicRows`, and write only taxonomy tables. All validation occurs before the first delete. Clear joins/relations/aliases before deleting merged topic rows; insert missing canonical topics before inserting references. Existing canonical rows are not deleted or rewritten.

```ts
export async function reconcileTopicTaxonomy(
  db: Db,
  options: { legacy: boolean; now: Date },
) {
  await db.transaction(async (tx) => {
    const before = {
      topics: await tx.select().from(topics),
      topicAliases: await tx.select().from(topicAliases),
      topicRelations: await tx.select().from(topicRelations),
      problemTopics: await tx.select().from(problemTopics),
    }
    const after = reconcileTopicRows(before, {
      legacy: options.legacy,
      now: options.now.getTime(),
    })
    const keepIds = new Set(after.topics.map((row) => row.id))
    const removedIds = before.topics
      .filter((row) => !keepIds.has(row.id))
      .map((row) => row.id)
    await tx.delete(problemTopics)
    await tx.delete(topicRelations)
    await tx.delete(topicAliases)
    if (removedIds.length)
      await tx.delete(topics).where(inArray(topics.id, removedIds))
    if (after.topics.length)
      await tx.insert(topics).values(after.topics).onConflictDoNothing()
    if (after.topicAliases.length)
      await tx.insert(topicAliases).values(after.topicAliases)
    if (after.topicRelations.length)
      await tx.insert(topicRelations).values(after.topicRelations)
    if (after.problemTopics.length)
      await tx.insert(problemTopics).values(after.problemTopics)
  })
}
```

The temporary delete/reinsert is restricted to small taxonomy tables inside one
transaction. It preserves row values and never touches reviews, FSRS, tracks,
settings, secrets, or problem scalar metadata. No separate graph persistence
framework is needed.

- [ ] **Step 4: Wire the Phase 1 background bridge.**

```ts
import { getAppDb } from '@/platform/db'
import { reconcileTopicTaxonomy } from '@/features/problems/data/topic-reconciliation'

export function getBackgroundDb() {
  return getAppDb({
    beforePublish: async (handle, context) => {
      await reconcileTopicTaxonomy(handle.db, {
        legacy: context.kind === 'upgrade',
        now: new Date(),
      })
    },
  })
}
```

In the bridge test, capture the supplied callback and invoke it with fresh and
upgrade contexts; assert `legacy:false` versus `legacy:true`. Inject a rejected
reconciliation promise and prove Phase 1 does not publish or enable normal
mutation hooks. In `register-handlers.ts`, replace the existing combined platform
import with these two imports so every existing handler uses the bridge:

```ts
import { flushDbSnapshot, type Db } from '@/platform/db'
import { getBackgroundDb as getAppDb } from './app-db'
```

All existing handler call sites remain unchanged. Update its test mock to mock
`./app-db`'s `getBackgroundDb` with the existing `backgroundMocks.getAppDb` spy;
keep `flushDbSnapshot` mocked through the platform module. Add
`src/extension/background/register-handlers.test.ts` to this task's modified
files and commit scope.

- [ ] **Step 5: Run both focused files and Phase 1's populated-upgrade regression command.** Expected: callbacks precede publication; collision errors preserve the old durable snapshot; repeated reconciliation produces identical rows.
- [ ] **Step 6: Commit the reconciliation files, bridge files, handler import, and handler test mock with `rtk git commit -m "feat(topics): reconcile staged databases before publication"`.**

## Task 6: Replace Resolver Precedence With The Validated Namespace

**Files:**

- Modify: `src/features/problems/data/topic-resolver.ts`
- Modify: `src/features/problems/data/problems-repository.test.ts`

- [ ] **Step 1: Add repository cases for `Tree / Graph`, `动态规划`, `DSU`, and `KMP`.** Save a problem with `['Tree / Graph','动态规划','DSU','Union Find','KMP']`; expect four direct canonical identities, no inferred Tree assignment, and the KMP identity distinct from String Matching. Add a transaction rollback assertion when a later invalid label follows a valid one.
- [ ] **Step 2: Run `rtk npm run test -- src/features/problems/data/problems-repository.test.ts`.** Expected: old resolver helper signatures or old slug semantics fail.
- [ ] **Step 3: Replace the internal resolution chain with one registry read and validated lookup.** Retain merge/replace functions and their transaction ownership at existing callers.

```ts
export async function resolveTopicLabels(
  db: TopicResolverDb,
  labels: readonly string[],
  now = new Date(),
): Promise<TopicSummary[]> {
  const normalized = normalizeTopicLabelList(labels)
  if (!normalized.length) return []
  const topicRows = await db.select().from(topics)
  const aliasRows = await db.select().from(topicAliases)
  const lookup = buildTopicLookup(topicRows, aliasRows)
  const seen = new Set<string>()
  const result: TopicSummary[] = []
  for (const label of normalized) {
    const key = normalizeTopicLookupKey(label)
    let topic = lookup.get(key)
    if (!topic) {
      const id = createTopicId(new Set(lookup.keys()))
      topic = { id, label }
      await db.insert(topics).values({
        ...topic,
        createdAt: now.getTime(),
        updatedAt: now.getTime(),
      })
      lookup.set(key, topic)
      lookup.set(normalizeTopicLookupKey(id), topic)
    }
    if (!seen.has(topic.id)) {
      seen.add(topic.id)
      result.push(topic)
    }
  }
  return result
}
```

Remove the old ID/label/alias precedence helpers and `createMissingTopics`.
Never use `onConflictDoNothing` to convert an unexpected ID collision into a
successful resolution. Background mutations already serialize writes; a
conflict still aborts the owning transaction.

- [ ] **Step 4: Update the old unknown-topic test to assert a stable stored UUID identity rather than a slug generated from its label.** Read the same label twice and assert equal IDs. Keep existing manual-replace and capture-merge tests unchanged in meaning. Run `rtk npm run test -- src/features/problems/data/problems-repository.test.ts -t 'resolves topic aliases|manual topic replacement|merges captured|slash and Unicode'` and expect the focused resolver cases to pass. Name the new Step 1 regression `resolves slash and Unicode labels without inferred assignments`. Task 7 updates the old BFS parent expectations before running the complete file.
- [ ] **Step 5: Commit the resolver and repository tests with `rtk git commit -m "fix(topics): resolve aliases without lossy precedence"`.**

## Task 7: Publish Alias Options And Transitive Membership Once Per Read

**Files:**

- Create: `src/features/problems/data/topic-read-model.ts`
- Modify: `src/features/problems/data/problems-repository.ts`
- Modify: `src/features/problems/api/problems-contracts.ts`
- Modify: `src/features/problems/api/problems-serializers.ts`
- Modify: `src/features/problems/data/problems-repository.test.ts`
- Modify: `src/features/problems/api/problems-contracts.test.ts`
- Create: `src/features/problems/api/problems-serializers.test.ts`
- Modify: `src/testing/problem-fixtures.ts`

- [ ] **Step 1: Add a repository test for an unused alias option and nested membership.** Create a Library problem directly tagged Binary Search Tree; require direct `topics` to contain only BST, `effectiveTopicIds` to equal `['binary-search-tree','binary-tree','tree']`, and the BST's `parentTopics` to include Binary Tree and Tree. Require the options to contain `{id:'depth-first-search',label:'Depth-First Search',aliases:['DFS']}` even if no problem uses DFS. Update the old tests that expect BFS to inherit Tree/Graph so `parentTopics` is now empty.
- [ ] **Step 2: Run `rtk npm run test -- src/features/problems/data/problems-repository.test.ts src/features/problems/api/problems-contracts.test.ts src/features/problems/api/problems-serializers.test.ts`.** Expected: missing effective IDs/aliases and old one-hop reads fail.
- [ ] **Step 3: Add a reusable read builder with one registry load.**

```ts
export async function readTopicReadModel(db: Pick<Db, 'select'>) {
  const [topicRows, aliases, relations] = await Promise.all([
    db.select().from(topics),
    db.select().from(topicAliases),
    db.select().from(topicRelations),
  ])
  buildTopicLookup(topicRows, aliases)
  const graph = buildTopicGraph(topicRows, relations)
  const byId = new Map(
    topicRows.map((row) => [row.id, { id: row.id, label: row.label }]),
  )
  const aliasesById = new Map<string, string[]>()
  for (const alias of aliases) {
    const values = aliasesById.get(alias.topicId) ?? []
    values.push(alias.label)
    aliasesById.set(alias.topicId, values)
  }
  const options = [...byId.values()]
    .sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id))
    .map((topic) => ({
      ...topic,
      aliases: (aliasesById.get(topic.id) ?? []).sort(),
    }))
  return {
    options,
    effectiveTopicIds: graph.effectiveTopicIds,
    parentTopics: (id: string) =>
      graph
        .ancestorsOf(id)
        .map((parentId) => byId.get(parentId)!)
        .sort(
          (a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id),
        ),
  }
}
```

Load this model once in `getLibrary`; pass it into `readLibraryRows` and
`readLibraryOptions` instead of querying it in each helper. Load it once in
`getLibraryRowsBySlug` and once in `getForEdit` when those are independent entry
points. Change `readLabelsByProblem` to accept this model for topic reads and
use `model.parentTopics(row.id)`; company reads keep their current behavior.
Delete `readParentTopicsByChildTopicId` and the obsolete `groupParentTopics`.

Each row adds:

```ts
const directTopics = topicsBySlug.get(problem.slug) ?? []
return {
  problem,
  status,
  state,
  nextReviewAt,
  lastReviewedAt,
  lastSolvedAt,
  topics: directTopics,
  effectiveTopicIds: topicReadModel.effectiveTopicIds(
    directTopics.map((topic) => topic.id),
  ),
  companies: companiesBySlug.get(problem.slug) ?? [],
  trackMemberships: tracksBySlug.get(problem.slug) ?? [],
}
```

The names `status`, `state`, and date locals are the existing row derivations;
retain their current calculations. Do not rederive practice state for this task.

- [ ] **Step 4: Make the serialized contract fields required.**

```ts
export const problemTopicOptionSchema = problemTopicSummarySchema.extend({
  aliases: z.array(z.string()),
})
// Add to problemLibraryRowSchema:
effectiveTopicIds: z.array(z.string()),
// Replace the topics field in problemLibraryOptionsSchema:
topics: z.array(problemTopicOptionSchema),
```

Add `ProblemTopicOption` to the repository's domain interfaces, use it for
`ProblemLibraryOptions.topics`, and add `effectiveTopicIds: string[]` to its row
interface. Existing serializers spread these fields, so preserve them through
schema parsing and add missing-field rejection tests. Do not default effective
IDs to an empty array, which would hide a broken producer. Update all in-repo
typed Library fixtures with exact direct-only or expanded IDs as appropriate;
use `rtk rg -n 'ProblemLibraryRow|ProblemLibraryResponse|options:|parentTopics:' src/features/problems src/features/tracks src/app src/testing` to locate them.

- [ ] **Step 5: Run Task 7's focused command, then `rtk npm run typecheck`.** Expected: all producers and fixtures satisfy required fields, direct chips remain unchanged, and no consumer assumes applies-to membership.
- [ ] **Step 6: Commit the read model, repository, contracts, serializers, and affected fixtures with `rtk git commit -m "feat(topics): expose aliases and effective Library membership"`.**

## Task 8: Version Backups Without Changing Sync Conflict Rules

**Files:**

- Modify: `src/features/backup/api/backup-contracts.ts`
- Modify: `src/features/backup/api/backup-contracts.test.ts`
- Modify: `src/features/backup/data/backup-repository.ts`
- Modify: `src/features/backup/data/backup-repository.test.ts`
- Modify: `src/features/backup/server/backup-service.ts`
- Modify: `src/features/backup/server/backup-service.test.ts`
- Modify: `src/features/sync/domain/sync-envelope.test.ts`
- Modify: `src/features/sync/server/sync-service.test.ts`

- [ ] **Step 1: Add v3→v4 tests before changing the parser.** Use the existing backup fixture with `schemaVersion:3`, old `parentTopicId`/`childTopicId` edges, and alias key `priority-queue`; require output version 4, normalized `priority queue`, typed relations, and removed false BFS containment. Keep literal v1 and v2 fixtures so older track-progress normalization remains tested. Add a v4 malformed alias-key test that must reject rather than repair.
- [ ] **Step 2: Run `rtk npm run test -- src/features/backup/api/backup-contracts.test.ts src/features/backup/server/backup-service.test.ts`.** Expected: output remains v3 and typed rows are rejected.
- [ ] **Step 3: Keep explicit legacy schemas and add the v4 schema.**

```ts
export const backupSchemaVersion = 4
const backupTopicRelationV3RowSchema = z.strictObject({
  parentTopicId: durableIdSchema,
  childTopicId: durableIdSchema,
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
})
export const backupTopicRelationRowSchema = z.strictObject({
  sourceTopicId: durableIdSchema,
  targetTopicId: durableIdSchema,
  kind: z.enum(['broader', 'applies-to']),
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
})
const backupDataV3Schema = backupDataSchema.extend({
  topicRelations: z.array(backupTopicRelationV3RowSchema),
})
const backupFileV3Schema = backupFileSchema.extend({
  schemaVersion: z.literal(3),
  data: backupDataV3Schema,
})
type BackupFileV3 = z.infer<typeof backupFileV3Schema>

function normalizeBackupV3ToV4(backup: BackupFileV3): BackupFile {
  const taxonomy = reconcileTopicRows(
    {
      topics: backup.data.topics,
      topicAliases: backup.data.topicAliases,
      problemTopics: backup.data.problemTopics,
      topicRelations: backup.data.topicRelations.map((edge) => ({
        sourceTopicId: edge.childTopicId,
        targetTopicId: edge.parentTopicId,
        kind: 'broader' as const,
        createdAt: edge.createdAt,
        updatedAt: edge.updatedAt,
      })),
    },
    { legacy: true, now: backup.exportedAt },
  )
  return backupFileSchema.parse({
    ...backup,
    schemaVersion: 4,
    data: { ...backup.data, ...taxonomy },
  })
}
```

Preserve the v1→v2 track-progress transform. Change the old v2→v3 function to
return `BackupFileV3` using `backupFileV3Schema.parse` and literal version 3;
then call v3→v4. Dispatch v1, v2, and v3 through that chain. Parse v4 directly
and validate its complete namespace/graph without applying the legacy removal
manifest. Keep the supported minimum at 1. Unknown future versions fail before
any destructive operation.

- [ ] **Step 4: Share validation and make restore reconciliation transactional.** Replace the service's private topic lookup/cycle implementation with
      `buildTopicLookup(data.topics,data.topicAliases)` and
      `buildTopicGraph(data.topics,data.topicRelations)`. Keep all existing non-topic
      backup validation. Typed-edge duplicate keys use
      `JSON.stringify([row.kind,row.sourceTopicId,row.targetTopicId])`; direct join
      uniqueness and references remain checked.

In `clearAndRestoreBackupData`, compute current-format reconciliation before
the transaction using `reconcileTopicRows` with `legacy:false`; validate it,
then clear/insert/seed in the existing transaction. Because legacy parsing has
already corrected old rows, every restore reaches this path with v4 semantics.
After insert-only seeding, read and validate the final namespace and graph
within that transaction before committing. Do not call the wrapper reconciler
inside this transaction or create a nested transaction. Export snapshots with
both relation kinds; repository spreading already preserves their fields.

For reset, seed fresh defaults and validate the final registry in its existing
transaction. Do not change secret filtering or delete any additional storage.

- [ ] **Step 5: Add round-trip and sync behavior assertions.**

```ts
const exported = await exportFullBackup(source.db)
expect(exported.schemaVersion).toBe(4)
expect(exported.data.topicRelations).toContainEqual(
  expect.objectContaining({
    sourceTopicId: 'depth-first-search',
    targetTopicId: 'tree',
    kind: 'applies-to',
  }),
)
await restoreFullBackup(target.db, exported)
const first = await createBackupRepository(target.db).readBackupData()
await restoreFullBackup(target.db, exported)
expect(await createBackupRepository(target.db).readBackupData()).toEqual(first)
```

Update the sync envelope fixtures to carry v4 through the unchanged envelope
version. A pull containing `schemaVersion:5` must reject before restore; a v3
pull must normalize and pass the same validator. Dirty-local skips, overwrite
confirmation defaults, and force-push authorization tests must remain passing.
Do not modify transport or conflict policy to accommodate the schema change.

- [ ] **Step 6: Run `rtk npm run test -- src/features/backup src/features/sync/domain/sync-envelope.test.ts src/features/sync/server/sync-service.test.ts`.** Expected: v1–3 import, v4 round-trip, custom timestamp preservation, duplicate/collision rejection, and unchanged sync policy all pass.
- [ ] **Step 7: Commit the eight listed files with `rtk git commit -m "feat(backup): preserve typed topic graph in schema v4"`.**

## Task 9: Verify Integration And Update Current Authority

**Files:**

- Modify: `docs/architecture.md`
- Modify: `docs/product.md`
- Modify: `docs/testing.md`
- Modify: `src/extension/background/register-handlers.test.ts` when fixture fields require updates
- Modify: `src/platform/query/cache-invalidation.ts`
- Modify: `src/platform/query/cache-invalidation.test.ts`

- [ ] **Step 1: Run the integrated focused suite.**

```sh
rtk npm run test -- src/features/problems src/features/backup src/features/sync src/extension/background/app-db.test.ts src/extension/background/register-handlers.test.ts
```

Expected: all tests pass. Add the Phase 1 populated legacy snapshot fixture to
the actual `0008` upgrade integration: compare reviews, FSRS due dates, problem
metadata, track order/progress, and settings before/after; verify custom aliases
resolve after re-keying and BFS never gains Tree membership. The callback must
run before the new snapshot is stored. Inject a normalization collision and
assert the original stored snapshot and recovery record are unchanged.

Add `queryKeys.analytics.all` to the existing `problems` entry in
`queryKeysByInvalidationTag`. Topic edits affect Analytics' current direct-label
reads even though ancestor aggregation is deferred. Preserve the other existing
query families. Add this regression with the existing imports in
`cache-invalidation.test.ts`:

```ts
it('invalidates Analytics after problem topic metadata changes', () => {
  expect(readQueryKeysForInvalidation(['problems'])).toContainEqual(
    queryKeys.analytics.all,
  )
})
```

Run `rtk npm run test -- src/platform/query/cache-invalidation.test.ts`
red before the mapping edit and green after it. Keep handler persistence,
mutation serialization, sync dirty marking, and broadcasts in their existing
order; the topic read-model change adds no new sender capability.

- [ ] **Step 2: Update current docs with the shipped foundation behavior.** Document typed edge direction, direct/ancestor separation, unknown-topic IDs,
      exact alias lookup, backup v4/client compatibility, and the preserving-upgrade
      boundary. Keep the current Library UI description unchanged until Phase 3
      ships; this phase only adds its read-model fields. Document human smoke cases
      for capture merge versus manual replace, non-ASCII/slash labels, a populated
      upgrade, a rejected collision, and backup round-trip.

- [ ] **Step 3: Run required broad validation once.**

```sh
rtk npm run db:check
rtk npm run lint
rtk npm run check
rtk npm run build
rtk npx prettier --check docs/architecture.md docs/product.md docs/testing.md docs/superpowers/plans/2026-09-26-topics-phase-2-foundation.md
```

Expected: each command exits 0. The generation command was run in Task 3; do
not regenerate merely to make a clean diff. Report exact skipped commands and
reasons if the environment prevents a check. A failed command is not a pass.

- [ ] **Step 4: Obtain required human smoke evidence before product PR review or merge.** Prepare the exact checklist from Step 2 and attach screenshots or recordings showing preserved populated data, successful corrected topic writes,
      and a recoverable failure. Automated browser checks supplement this proof.

- [ ] **Step 5: Commit docs and final test fixtures with `rtk git commit -m "docs(topics): describe typed taxonomy and preserving backup upgrade"`.** Hand Phase 3 the passing required runtime fields and the exact validation log. Do not claim Library Any/All or alias-picker behavior is implemented by this phase.
