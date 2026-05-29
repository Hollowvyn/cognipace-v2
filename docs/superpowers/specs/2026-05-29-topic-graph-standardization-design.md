# Topic Graph Standardization Design

## Status

Approved design from brainstorming on 2026-05-29. This is a planning artifact;
current product and architecture docs remain the source of truth until the
implementation lands.

## Context

CogniPace v2 currently stores topics as flat problem metadata:

- `topics` has `id` and `label`.
- `problem_topics` joins problems to topics.
- Library filters, problem forms, backups, and sync already understand those
  tables.
- LeetCode metadata capture already reads topic tag names and slugs, but page
  sync currently does not persist them.

Historical CogniPace had useful seed aliases, but aliases were only seed-time
normalization and were not stored. EasyRepeat had plain LeetCode topic strings
plus a separate skill taxonomy for analytics. For this pass, CogniPace should
standardize problem topics directly and avoid adding skill scoring or Analytics
UI.

## Decisions

- Use a stored topic graph, not seed-only normalization.
- Support multiple parents per topic.
- Store aliases as first-class rows.
- Treat parent topics as regular topics that can also be assigned directly to
  problems.
- Auto-create unknown incoming labels as topics.
- Ignore the pasted LeetCode counts entirely; they are not stored and do not
  drive behavior.
- Keep this pass internal-foundation only. Do not add topic graph management UI.
- Merge existing alias-matched local topics into their resolved target topics
  during the migration.
- Seed the LeetCode topic labels, aliases, and curated parent links.

## Goals

- Give CogniPace a durable standardized topic registry.
- Resolve LeetCode labels, old track labels, and user-entered variants through
  one topic resolver.
- Preserve existing Library topic editing behavior while standardizing stored
  topic IDs.
- Support future analytics rollups by parent topic without building analytics in
  this pass.
- Keep backup, restore, and Gist sync compatible with the new topic graph.

## Non-Goals

- No skill confidence scoring, decay, daily snapshots, or EasyRepeat-style Skill
  DNA.
- No Analytics page implementation.
- No topic or alias management UI.
- No generic user tags separate from topics.
- No use of LeetCode problem-count values from the pasted list.

## Data Model

The `problems` feature continues to own problem taxonomy. The current tables are
extended rather than replaced.

`topics` becomes the durable topic registry:

- `id`: stable slug-style topic ID.
- `label`: user-facing label.
- `createdAt` and `updatedAt`: timestamps for backup and troubleshooting.

Seeded, captured, imported, and manually created topics share the same table
shape. Runtime behavior should not branch on where a topic came from.

`topic_aliases` stores first-class aliases:

- `aliasKey`: normalized lookup key, unique across aliases.
- `label`: display form of the alias.
- `topicId`: resolved target topic.
- timestamps.

`topic_relations` stores graph edges:

- `parentTopicId`.
- `childTopicId`.
- timestamps.

Both sides of `topic_relations` point to regular `topics` rows. Parent topics
are assignable directly to problems.

`problem_topics` remains the direct problem-topic join. Direct topic assignments
are distinct from rollups. For example, a problem directly tagged
`Breadth-First Search` can roll up to `Graph Theory`, but it is still directly
tagged with `Breadth-First Search`.

## Topic Resolution

All topic writes go through one resolver before writing `problem_topics`.

Resolution order:

1. Normalize the incoming label or LeetCode slug.
2. Match an existing topic by ID or label key.
3. Match `topic_aliases.aliasKey`.
4. Auto-create a topic if no match exists.

The resolver is used by:

- Library create and edit forms.
- Library bulk metadata edits.
- LeetCode page sync.
- Backup restore and future selective import paths.
- Seed and migration normalization.

Manual Library editing keeps replace-all semantics for the user-selected topic
list. LeetCode page sync should not call the dashboard replace-all mutation
directly. It should use a capture-specific path that resolves captured LeetCode
topics and persists them without deleting unrelated existing direct topics.

## Migration Behavior

The migration standardizes known aliases:

- Seed target topics first.
- Seed aliases second.
- Move `problem_topics` rows from alias-matched old topic IDs to resolved target
  topic IDs.
- Collapse duplicate joins after merging.
- Preserve old labels as aliases pointing to the resolved target topic.
- Preserve unmatched existing topics as ordinary topics.

Example: if local data contains `Heaps`, `Priority Queue`, and
`Heap (Priority Queue)`, all problem links should end up on
`heap-priority-queue`, while the other labels become aliases.

The migration must not discard problem-topic links. If a merge would create a
duplicate `(problemSlug, topicId)` pair, keep one target row.

## Seed Taxonomy

The implementation must seed LeetCode topic labels. The seed list is based on
the user-provided LeetCode topic copy paste, but counts are ignored.

Topic labels to seed:

- Array
- String
- Hash Table
- Math
- Dynamic Programming
- Sorting
- Greedy
- Binary Search
- Depth-First Search
- Database
- Bit Manipulation
- Matrix
- Tree
- Breadth-First Search
- Two Pointers
- Prefix Sum
- Heap (Priority Queue)
- Simulation
- Counting
- Graph Theory
- Binary Tree
- Stack
- Sliding Window
- Enumeration
- Design
- Backtracking
- Union-Find
- Number Theory
- Linked List
- Segment Tree
- Ordered Set
- Monotonic Stack
- Divide and Conquer
- Combinatorics
- Trie
- Bitmask
- Queue
- Recursion
- Geometry
- Binary Indexed Tree
- Hash Function
- Memoization
- Binary Search Tree
- Topological Sort
- Shortest Path
- String Matching
- Rolling Hash
- Game Theory
- Interactive
- Data Stream
- Monotonic Queue
- Brainteaser
- Doubly-Linked List
- Merge Sort
- Randomized
- Counting Sort
- Iterator
- Concurrency
- Suffix Array
- Quickselect
- Sweep Line
- Probability and Statistics
- Minimum Spanning Tree
- Bucket Sort
- Shell
- Reservoir Sampling
- Eulerian Circuit
- Radix Sort
- Strongly Connected Component
- Rejection Sampling
- Biconnected Component

Seed aliases should include old CogniPace and common LeetCode/track variants:

- `Arrays`, `Arrays & Hashing`, `Array / String` -> `Array`
- `Hash Map`, `Hash Set`, `Hash Map / Set`, `Hash Maps And Sets` ->
  `Hash Table`
- `DP`, `1-D Dynamic Programming`, `2-D Dynamic Programming` ->
  `Dynamic Programming`
- `DFS`, `Graphs - DFS`, `Binary Tree - DFS` -> `Depth-First Search`
- `BFS`, `Graphs - BFS`, `Binary Tree - BFS` -> `Breadth-First Search`
- `Graph`, `Graphs`, `Advanced Graphs` -> `Graph Theory`
- `Heap`, `Heaps`, `Priority Queue`, `Heap / Priority Queue` ->
  `Heap (Priority Queue)`
- `Trees` -> `Tree`
- `Tries` -> `Trie`
- `Stacks` -> `Stack`
- `Linked Lists` -> `Linked List`
- `Prefix Sums` -> `Prefix Sum`
- `Union Find` -> `Union-Find`
- `Fenwick Tree` -> `Binary Indexed Tree`
- `Binary` -> `Bit Manipulation`
- `Bit Mask` -> `Bitmask`
- `KMP`, `Rabin-Karp` -> `String Matching`
- `MST` -> `Minimum Spanning Tree`
- `SCC` -> `Strongly Connected Component`

Seed parent links should be curated typed data. The notation below is
`child topic` -> `parent topic`. Minimum relationships:

- `Binary Tree` -> `Tree`
- `Binary Search Tree` -> `Binary Tree`
- `Depth-First Search` -> `Graph Theory`, `Tree`, `Binary Tree`
- `Breadth-First Search` -> `Graph Theory`, `Tree`, `Binary Tree`
- `Topological Sort`, `Shortest Path`, `Minimum Spanning Tree`,
  `Eulerian Circuit`, `Strongly Connected Component`,
  `Biconnected Component`, and `Union-Find` -> `Graph Theory`
- `Rolling Hash`, `String Matching`, and `Suffix Array` -> `String`
- `Monotonic Stack` -> `Stack`
- `Monotonic Queue` -> `Queue`
- `Merge Sort`, `Counting Sort`, `Radix Sort`, and `Bucket Sort` -> `Sorting`
- `Quickselect` and `Merge Sort` -> `Divide and Conquer`
- `Combinatorics`, `Number Theory`, `Probability and Statistics`, and
  `Geometry` -> `Math`
- `Memoization` -> `Dynamic Programming`, `Recursion`
- `Bitmask` -> `Bit Manipulation`
- `Doubly-Linked List` -> `Linked List`

Seed operations must be idempotent. They create missing topics, aliases, and
relations, but they do not clobber unrelated user-created topics.

## Read Models

Existing Library UI behavior remains:

- topic filters
- topic search
- topic chips
- create/edit problem metadata
- bulk metadata edits

New read support should expose:

- direct topics for each problem
- parent rollups for each direct topic
- topic options from the registry, not only from used problem joins
- repository helpers that future analytics can use to aggregate by direct topic
  or rolled-up parent topic

No charts or Analytics route behavior are included in this pass.

## Backup, Restore, And Sync

Backup schema changes cover both export/restore and Gist sync because sync wraps
the backup payload.

Backup data should include:

- `topics`
- `topicAliases`
- `topicRelations`
- `problemTopics`

Restore validation must reject:

- dangling aliases
- dangling parent or child topic relation references
- duplicate alias keys
- aliases that point at missing topics
- self-parent relations
- cyclic parent graphs
- duplicate problem-topic joins

Multiple parents are valid. Cycles are not.

If the backup schema version changes, the parser should normalize supported old
backup versions into the new shape where possible. Existing v2 backups without
aliases or relations should restore with empty `topicAliases` and
`topicRelations`.

## Runtime And Ownership

The topic graph remains under `features/problems`.

Expected implementation surfaces:

- `src/platform/db/schema/topics.ts`
- new `src/platform/db/schema/topic-aliases.ts`
- new `src/platform/db/schema/topic-relations.ts`
- `src/platform/db/schema/problem-topics.ts`
- `src/platform/db/seed.ts` or a dedicated typed problems seed module
- `src/features/problems/data/problems-repository.ts`
- `src/features/problems/server/problems-service.ts`
- `src/features/problems/api/problems-contracts.ts`
- `src/features/problems/api/problems-serializers.ts`
- `src/features/backup/*`
- `src/features/sync/*` only as needed through backup envelope changes
- LeetCode page sync code that currently drops captured topics

Runtime payloads crossing the extension boundary must stay Zod-validated.
Database writes stay behind the problems repository/service. Writes that affect
topic metadata should invalidate `problems`; include dependent families such as
`tracks`, `queue`, and `app-shell` when derived views can change.

## Error Handling

- Resolver conflicts should fail loudly when one alias key would point at two
  different target topics.
- Restore validation should return clear messages for dangling references and
  cycles.
- Unknown labels should not fail normal capture/import. They become topics.
- Seed should be safe to run repeatedly.

## Testing

Focused tests should cover:

- resolver maps aliases to target topics
- resolver auto-creates unknown labels as topics
- migration merges alias-matched topics into target IDs without losing
  problem links
- duplicate joins collapse during standardization
- LeetCode page sync persists captured topics
- backup export/restore round-trips topics, aliases, relations, and joins
- restore rejects dangling aliases
- restore rejects dangling parent links
- restore rejects cyclic parent graphs
- Library filters still work with standardized topics
- Library create/edit and bulk metadata edits still work
- seed is idempotent and does not clobber unrelated user-created topics

Validation expectations:

- Run focused repository, backup, contract, and page-sync tests.
- Run `npm run db:generate` and `npm run db:check` for schema changes.
- Run `npm run check` before handoff for the implementation.

## Rollout Notes

This is a database migration. During development, changing migrations changes the
migration fingerprint, so local extension snapshots may reset and reseed. The
implementation handoff should call that out clearly.

The first shipped version should prioritize correctness of topic IDs, aliases,
parent links, backup/restore, and LeetCode capture persistence over management
UI.
