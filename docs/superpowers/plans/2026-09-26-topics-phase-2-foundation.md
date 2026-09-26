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

Phase 1 supplies the optional pre-publication hook on `getAppDb` (implemented in
`src/platform/db/instance.ts`).

The hook runs only for staged fresh/upgrade handles, after incremental SQL and
before snapshot publication or normal mutation hooks. Matching current
snapshots do not rerun it. `src/extension/background/app-db.ts` owns
`getBackgroundDb()`; handler registration imports that wrapper as `getAppDb`.
This phase supplies its callback. No `platform -> features` import is allowed.

Phase 3 consumes a topic option `{id, label, aliases}` and Library membership
`{effectiveTopicIds}`.

Library rows retain existing direct `topics` and add `effectiveTopicIds`.
Existing `parentTopics` becomes the deduplicated transitive broader ancestors
of that direct topic. Aliases are display strings, not internal lookup keys.

Implemented in `src/platform/db/instance.ts`, `src/extension/background/app-db.ts`, `src/features/problems/data/topic-read-model.ts`; covered by `src/platform/db/instance.test.ts`, `src/extension/background/app-db.test.ts`.

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

- [ ] **Step 2: Run `rtk npm run test -- src/features/problems/domain/topic-taxonomy.test.ts`.** Expected: failure because the new exports do not exist and slash normalization is wrong.
- [ ] **Step 3: Replace the URL-normalizer dependency with the functions exported from `topic-taxonomy.ts`.** Keep `TopicSummary` as `{ id: string; label: string }` and retain the public `normalizeTopicLabelList` export used by the resolver.

All existing seeded IDs remain unchanged. UUID IDs apply only to newly created
unknown topics, and the resolver passes the complete namespace's occupied keys.
This prevents punctuation differences from turning into an accidental merge.

- [ ] **Step 4: Run `rtk npm run test -- src/features/problems/domain/topic-taxonomy.test.ts`.** Expected: all new tests pass. Also add an eight-collision allocator failure case and aliases that match their own canonical identity.
- [ ] **Step 5: Commit with `rtk git add src/features/problems/domain/topic-taxonomy.ts src/features/problems/domain/topic-taxonomy.test.ts` and `rtk git commit -m "feat(topics): define collision-safe topic identity"`.**

Implemented in `src/features/problems/domain/topic-taxonomy.ts`, `src/features/problems/data/topic-resolver.ts`; covered by `src/features/problems/domain/topic-taxonomy.test.ts`, `src/features/problems/data/problems-repository.test.ts`.

## Task 2: Implement Typed, Iterative Graph Expansion

**Files:**

- Create: `src/features/problems/domain/topic-graph.ts`
- Create: `src/features/problems/domain/topic-graph.test.ts`

- [ ] **Step 1: Add a graph test containing nesting, a diamond, and applicability.**

- [ ] **Step 2: Run `rtk npm run test -- src/features/problems/domain/topic-graph.test.ts`.** Expected: missing-module failure.
- [ ] **Step 3: Implement the pure graph with an iterative cycle check and memoized traversal.**

- [ ] **Step 4: Add parameterized self-link, dangling-endpoint, duplicate-edge, disconnected-root, and applies-to-cycle tests; add a 2,000-node chain test whose single leaf returns 1,999 ancestors. Run `rtk npm run test -- src/features/problems/domain/topic-graph.test.ts`.** Expected: all pass without recursion overflow or depth truncation.
- [ ] **Step 5: Commit with `rtk git add src/features/problems/domain/topic-graph.ts src/features/problems/domain/topic-graph.test.ts` and `rtk git commit -m "feat(topics): derive membership from typed topic graph"`.**

Implemented in `src/features/problems/domain/topic-graph.ts`; covered by `src/features/problems/domain/topic-graph.test.ts`.

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

- [ ] **Step 1: Freeze the legacy alias rows before editing the seed.** Keep the existing 39 `{ label, topicLabel }` entries verbatim as `legacyTopicAliasRows` in `src/features/problems/domain/topic-legacy-manifest.ts`. Do not add a version constant or duplicate the historical relation list there. Keep the ten obsolete broader-pair corrections as the single explicit allowlist in `topic-reconciliation.ts`; it drives migration correction and conversion without guessing legacy provenance. Migration tests cover typed relation conversion, while reconciliation tests cover alias rekeying.

Inspect the exact inputs with `rtk cat src/platform/db/topic-taxonomy-seed.ts` while editing the seed.

- [ ] **Step 2: Write storage and catalogue tests before modifying storage.** In `topic-migration.test.ts`, construct a handle from Phase 1's allowlisted legacy SQL, insert `Tree`, `Binary Tree`, and one old relation using `rawDb.exec`, apply only `0008_topics_typed_relations.sql`, and query `source_topic_id`, `target_topic_id`, `kind`, `created_at`, `updated_at`. Assert the exact row `{source_topic_id:'binary-tree',target_topic_id:'tree',kind:'broader',created_at:1,updated_at:2}`. Also assert a `broader` and `applies-to` edge may share endpoints while a duplicate typed edge or self-link fails.

The catalogue test must confirm the added Meet in the Middle and Heap labels;
Heap, Bit, DSU, and KMP lookup outcomes; rejection of Arrays & Hashing as an
alias; and no broader ancestors for BFS.

- [ ] **Step 3: Run `rtk npm run test -- src/features/problems/domain/topic-catalogue.test.ts src/features/problems/data/topic-migration.test.ts`.** Expected: the old exports/schema cannot satisfy these cases.
- [ ] **Step 4: Define the relation table fields and generate a named migration.**

Rename ORM relation names to `sourceTopic` and `targetTopic` consistently in
both schema files. Generate with `rtk npm run db:generate -- --name topics_typed_relations`.

Review the generated rebuild: copy the old child and parent IDs into the new source and target IDs, set `kind` to `broader`, and preserve both timestamps.

The generated table swap must preserve foreign keys and recreate the two
indexes. Phase 1 already bundles migration entries, so the new SQL file is
discovered automatically. Do not edit an old migration to correct semantics;
the Problems reconciliation callback corrects known rows after this conversion.

- [ ] **Step 5: Replace seed labels with explicit stable `{id,label}` rows.** Keep all 72 existing canonical IDs exactly as they are today. Add `meet-in-the-middle` / Meet in the Middle, `kmp` / KMP, `rabin-karp` / Rabin-Karp, `1-d-dynamic-programming` / 1-D Dynamic Programming, `2-d-dynamic-programming` / 2-D Dynamic Programming, `fast-and-slow-pointers` / Fast And Slow Pointers, `hash-map` / Hash Map, and `hash-set` / Hash Set.

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

- [ ] **Step 7: Run `rtk npm run db:check` and the Task 3 focused test command.** Expected: generated metadata is consistent, migration keeps old rows and timestamps, every inventory input resolves, and no curated cycle/collision exists.
- [ ] **Step 8: Commit the listed schema, seed, manifest, tests, and generated migration files with `rtk git commit -m "feat(topics): store typed relations and curated topic catalogue"`.** Stage only the paths listed in this task, including generated metadata.

Implemented in `src/platform/db/schema/topic-relations.ts`, `src/platform/db/topic-taxonomy-seed.ts`, `src/platform/db/seed.ts`, `src/platform/db/migrations/0008_topics_typed_relations.sql`; covered by `src/features/problems/domain/topic-catalogue.test.ts`, `src/features/problems/data/topic-migration.test.ts`.

## Task 4: Build One Pure Reconciliation Algorithm For Upgrade And Import

**Files:**

- Create: `src/features/problems/domain/topic-reconciliation.ts`
- Create: `src/features/problems/domain/topic-reconciliation.test.ts`
- Modify: `src/features/problems/domain/topic-legacy-manifest.ts`

- [ ] **Step 1: Define shared input/output types and an idempotence test.** These types deliberately support database milliseconds and backup ISO strings without changing timestamps.

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

Conflict handling and identity follow `src/features/problems/domain/topic-reconciliation.ts`.

When an old edge becomes an applies-to edge, retain its timestamps for that
converted edge; brand-new edges receive `now`. For duplicate edges created by
merging, retain the existing canonical edge when present. For alias-key
collapses, preserve the first row in a stable sort by old alias key and target;
do not refresh timestamps on retry. These rules make the idempotence test pass.

- [ ] **Step 4: Add executable tests for the remaining destructive boundaries.** Use `structuredClone(old)` variants from Step 1 and assert: canonical Array joins remain only Array; two alias topics resolving to Heap merge joins once; aliases and custom relations referencing a merged topic are remapped; an unrelated custom edge survives; conflicting aliases throw without modifying the input; a current-format malformed alias key throws; and a normalized canonical-label collision throws. Run `rtk npm run test -- src/features/problems/domain/topic-reconciliation.test.ts src/features/problems/domain/topic-catalogue.test.ts` and expect all pass.
- [ ] **Step 5: Commit with `rtk git add src/features/problems/domain/topic-reconciliation.ts src/features/problems/domain/topic-reconciliation.test.ts src/features/problems/domain/topic-legacy-manifest.ts` and `rtk git commit -m "feat(topics): reconcile legacy taxonomy without guessing assignments"`.**

Implemented in `src/features/problems/domain/topic-reconciliation.ts`, `src/features/problems/domain/topic-legacy-manifest.ts`; covered by `src/features/problems/domain/topic-reconciliation.test.ts`, `src/features/backup/server/backup-service.test.ts`.

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

The temporary delete/reinsert is restricted to small taxonomy tables inside one
transaction. It preserves row values and never touches reviews, FSRS, tracks,
settings, secrets, or problem scalar metadata. No separate graph persistence
framework is needed.

- [ ] **Step 4: Wire the Phase 1 background bridge.**

In the bridge test, capture the supplied callback and invoke it with fresh and
upgrade contexts; assert `legacy:false` versus `legacy:true`. Inject a rejected
reconciliation promise and prove Phase 1 does not publish or enable normal
mutation hooks. In `register-handlers.ts`, replace the existing combined platform
import with a database getter from `./app-db` and `flushDbSnapshot` from the platform module so every existing handler uses the bridge.

All existing handler call sites remain unchanged. Update its test mock to mock
`./app-db`'s `getBackgroundDb` with the existing `backgroundMocks.getAppDb` spy;
keep `flushDbSnapshot` mocked through the platform module. Add
`src/extension/background/register-handlers.test.ts` to this task's modified
files and commit scope.

- [ ] **Step 5: Run both focused files and Phase 1's populated-upgrade regression command.** Expected: callbacks precede publication; collision errors preserve the old durable snapshot; repeated reconciliation produces identical rows.
- [ ] **Step 6: Commit the reconciliation files, bridge files, handler import, and handler test mock with `rtk git commit -m "feat(topics): reconcile staged databases before publication"`.**

Implemented in `src/features/problems/data/topic-reconciliation.ts`, `src/extension/background/app-db.ts`; covered by `src/features/problems/data/topic-reconciliation.test.ts`, `src/extension/background/app-db.test.ts`.

## Task 6: Replace Resolver Precedence With The Validated Namespace

**Files:**

- Modify: `src/features/problems/data/topic-resolver.ts`
- Modify: `src/features/problems/data/problems-repository.test.ts`

- [ ] **Step 1: Add repository cases for `Tree / Graph`, `动态规划`, `DSU`, and `KMP`.** Save a problem with `['Tree / Graph','动态规划','DSU','Union Find','KMP']`; expect four direct canonical identities, no inferred Tree assignment, and the KMP identity distinct from String Matching. Add a transaction rollback assertion when a later invalid label follows a valid one.
- [ ] **Step 2: Run `rtk npm run test -- src/features/problems/data/problems-repository.test.ts`.** Expected: old resolver helper signatures or old slug semantics fail.
- [ ] **Step 3: Replace the internal resolution chain with one registry read and validated lookup.** Retain merge/replace functions and their transaction ownership at existing callers.

Remove the old ID/label/alias precedence helpers and `createMissingTopics`.
Never use `onConflictDoNothing` to convert an unexpected ID collision into a
successful resolution. Background mutations already serialize writes; a
conflict still aborts the owning transaction.

- [ ] **Step 4: Update the old unknown-topic test to assert a stable stored UUID identity rather than a slug generated from its label.** Read the same label twice and assert equal IDs. Keep existing manual-replace and capture-merge tests unchanged in meaning. Run `rtk npm run test -- src/features/problems/data/problems-repository.test.ts -t 'resolves topic aliases|manual topic replacement|merges captured|slash and Unicode'` and expect the focused resolver cases to pass. Name the new Step 1 regression `resolves slash and Unicode labels without inferred assignments`. Task 7 updates the old BFS parent expectations before running the complete file.
- [ ] **Step 5: Commit the resolver and repository tests with `rtk git commit -m "fix(topics): resolve aliases without lossy precedence"`.**

Implemented in `src/features/problems/data/topic-resolver.ts`, `src/features/problems/data/problems-repository.ts`; covered by `src/features/problems/data/problems-repository.test.ts`.

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

Load this model once in `getLibrary`; pass it into `readLibraryRows` and
`readLibraryOptions` instead of querying it in each helper. Load it once in
`getLibraryRowsBySlug` and once in `getForEdit` when those are independent entry
points. Change `readLabelsByProblem` to accept this model for topic reads and
use `model.parentTopics(row.id)`; company reads keep their current behavior.
Delete `readParentTopicsByChildTopicId` and the obsolete `groupParentTopics`.

Each row adds `effectiveTopicIds: string[]`.

The names `status`, `state`, and date locals are the existing row derivations;
retain their current calculations. Do not rederive practice state for this task.

- [ ] **Step 4: Make the serialized contract fields required.**

Add `ProblemTopicOption` to the repository's domain interfaces, use it for
`ProblemLibraryOptions.topics`, and add `effectiveTopicIds: string[]` to its row
interface. Existing serializers spread these fields, so preserve them through
schema parsing and add missing-field rejection tests. Do not default effective
IDs to an empty array, which would hide a broken producer. Update all in-repo
typed Library fixtures with exact direct-only or expanded IDs as appropriate;
use `rtk rg -n 'ProblemLibraryRow|ProblemLibraryResponse|options:|parentTopics:' src/features/problems src/features/tracks src/app src/testing` to locate them.

- [ ] **Step 5: Run Task 7's focused command, then `rtk npm run typecheck`.** Expected: all producers and fixtures satisfy required fields, direct chips remain unchanged, and no consumer assumes applies-to membership.
- [ ] **Step 6: Commit the read model, repository, contracts, serializers, and affected fixtures with `rtk git commit -m "feat(topics): expose aliases and effective Library membership"`.**

Implemented in `src/features/problems/data/topic-read-model.ts`, `src/features/problems/data/problems-repository.ts`, `src/features/problems/api/problems-contracts.ts`, `src/features/problems/api/problems-serializers.ts`; covered by `src/features/problems/data/problems-repository.test.ts`, `src/features/problems/api/problems-contracts.test.ts`, `src/features/problems/api/problems-serializers.test.ts`.

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

Update the sync envelope fixtures to carry v4 through the unchanged envelope
version. A pull containing `schemaVersion:5` must reject before restore; a v3
pull must normalize and pass the same validator. Dirty-local skips, overwrite
confirmation defaults, and force-push authorization tests must remain passing.
Do not modify transport or conflict policy to accommodate the schema change.

- [ ] **Step 6: Run `rtk npm run test -- src/features/backup src/features/sync/domain/sync-envelope.test.ts src/features/sync/server/sync-service.test.ts`.** Expected: v1–3 import, v4 round-trip, custom timestamp preservation, duplicate/collision rejection, and unchanged sync policy all pass.
- [ ] **Step 7: Commit the eight listed files with `rtk git commit -m "feat(backup): preserve typed topic graph in schema v4"`.**

Implemented in `src/features/backup/api/backup-contracts.ts`, `src/features/backup/server/backup-service.ts`; covered by `src/features/backup/api/backup-contracts.test.ts`, `src/features/backup/server/backup-service.test.ts`, `src/features/sync/domain/sync-envelope.test.ts`, `src/features/sync/server/sync-service.test.ts`.

## Task 9: Verify Integration And Update Current Authority

**Files:**

- Modify: `docs/architecture.md`
- Modify: `docs/product.md`
- Modify: `docs/testing.md`
- Modify: `src/extension/background/register-handlers.test.ts` when fixture fields require updates
- Modify: `src/platform/query/cache-invalidation.ts`
- Modify: `src/platform/query/cache-invalidation.test.ts`

- [ ] **Step 1: Run the integrated focused suite** with `rtk npm run test -- src/features/problems src/features/backup src/features/sync src/extension/background/app-db.test.ts src/extension/background/register-handlers.test.ts`.

Expected: all tests pass. Add the Phase 1 populated legacy snapshot fixture to
the actual `0008` upgrade integration: compare reviews, FSRS due dates, problem
metadata, track order/progress, and settings before/after; verify custom aliases
resolve after re-keying and BFS never gains Tree membership. The callback must
run before the new snapshot is stored. Inject a normalization collision and
assert the original stored snapshot and recovery record are unchanged.

Add `queryKeys.analytics.all` to the existing `problems` entry in
`queryKeysByInvalidationTag`. Topic edits affect Analytics' current direct-label
reads even though ancestor aggregation is deferred. Preserve the other existing
query families. Add a regression asserting that
`readQueryKeysForInvalidation(['problems'])` includes `queryKeys.analytics.all`
in `cache-invalidation.test.ts`.

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

- [ ] **Step 3: Run required broad validation once:**
  - `rtk npm run db:check`
  - `rtk npm run lint`
  - `rtk npm run check`
  - `rtk npm run build`
  - `rtk npx prettier --check docs/architecture.md docs/product.md docs/testing.md docs/superpowers/plans/2026-09-26-topics-phase-2-foundation.md`

Expected: each command exits 0. The generation command was run in Task 3; do
not regenerate merely to make a clean diff. Report exact skipped commands and
reasons if the environment prevents a check. A failed command is not a pass.

- [ ] **Step 4: Obtain required human smoke evidence before product PR review or merge.** Prepare the exact checklist from Step 2 and attach screenshots or recordings showing preserved populated data, successful corrected topic writes,
      and a recoverable failure. Automated browser checks supplement this proof.

- [ ] **Step 5: Commit docs and final test fixtures with `rtk git commit -m "docs(topics): describe typed taxonomy and preserving backup upgrade"`.** Hand Phase 3 the passing required runtime fields and the exact validation log. Do not claim Library Any/All or alias-picker behavior is implemented by this phase.

Implemented in `src/platform/query/cache-invalidation.ts`, `docs/architecture.md`, `docs/product.md`, `docs/testing.md`; covered by `src/platform/query/cache-invalidation.test.ts`, `src/extension/background/app-db.test.ts`, `src/extension/background/register-handlers.test.ts`.
