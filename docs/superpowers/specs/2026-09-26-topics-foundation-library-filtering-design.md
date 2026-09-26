# Topics Foundation And Library Filtering

## Status And Authority

Design direction approved during brainstorming on 2026-09-26. This written
specification is ready for user review; implementation planning has not started.
Approval of the written specification is the next gate.

This is a planning artifact, not a claim of shipped behavior. Current authority
remains `docs/product.md`, `docs/architecture.md`, `docs/testing.md`, `design.md`,
`CONTRIBUTING.md`, and `docs/agent-governance.md`. This design revises the topic
semantics in the historical `2026-05-29-topic-graph-standardization-design.md`.

## Problem And Outcome

CogniPace needs consistent topic identity and meaningful nested relationships
before topics can reliably support Library discovery and future queue,
analytics, and track features.

The first release delivers a curated topic foundation and an improved Library
topic filter. Selecting Tree finds problems tagged Tree or a curated descendant
such as Binary Search Tree. Searching the topic picker for DFS finds
Depth-First Search. Selecting Tree and DFS with Match all finds problems with
both kinds of evidence; a DFS tag alone does not imply Tree membership.

The model separates three meanings:

| Meaning                                   | Example                                 | Effect                              |
| ----------------------------------------- | --------------------------------------- | ----------------------------------- |
| Same topic, another name                  | DFS resolves to Depth-First Search      | One canonical identity              |
| Narrower topic belongs to a broader topic | Binary Search Tree → Binary Tree → Tree | Transitive, deduplicated membership |
| Technique applies to a context            | Depth-First Search → Tree               | Discovery relationship only         |

Problem tags describe topic coverage. They do not prove that the learner used
or mastered every tagged technique.

## Approved Scope

- Cover the complete user-supplied topic inventory, including Meet in the Middle.
- Preserve stable topic identities and support deterministic, extensible aliases.
- Distinguish broader-topic relationships from applies-to relationships.
- Support multiple parents and arbitrary hierarchy depth without cycles.
- Provide shared direct-topic and ancestor read models.
- Improve the existing Library topic picker and filtering behavior.
- Correct known taxonomy mistakes without inventing historical information.
- Preserve local data during the schema upgrade and maintain backup compatibility.

The release does not add a topic explorer/editor, prerequisite engine, mastery
score, automatic classification, fuzzy auto-merging, topic-based queue ranking,
new analytics charts, or automatic track ordering. No account, backend, new
Chrome permission, or expanded sync behavior is required. Existing backup and
Gist transport must remain compatible with the changed persisted format.

## Current Implementation Findings

The existing seed contains 72 canonical labels, 39 aliases, and 34 parent links.
It includes Intervals in addition to the supplied inventory, but omits Meet in
the Middle. Heap already resolves to Heap (Priority Queue).

`topics`, `topic_aliases`, `topic_relations`, and `problem_topics` already exist.
Problems owns topic writes. Library edits replace direct assignments, while
LeetCode capture merges them. These semantics remain.

Current limitations verified in source:

- DFS and BFS have parent links to Tree, Binary Tree, and Graph Theory, mixing
  applicability with containment.
- Parent reads stop after one hop.
- Library filters direct IDs only and matches any selected topic.
- Topic lookup uses a URL slug normalizer that discards text after `/` and
  strips non-ASCII characters.
- Composite headings and narrower algorithms are sometimes treated as aliases.
- Seed aliases can silently change targets, while existing relation seeding
  cannot remove obsolete edges.
- Analytics reads direct labels; this release does not switch its aggregation
  to ancestor rollups.
- Database startup clears stored snapshots when the migration fingerprint
  changes. A preserving upgrade is a prerequisite for this release.

## Alternatives And Decision

1. **Small typed graph, selected.** Broader-topic edges support filtering and
   rollups; applies-to edges preserve useful cross-topic connections without
   fabricating membership. It adds a small amount of explicit data semantics.
2. **Parent-only graph.** Reuses the simplest structure, but omits the desired
   cross-cutting technique/context relationships.
3. **General knowledge graph.** Adds prerequisites, weights, implementation
   relationships, and other edge types. This exceeds current product needs and
   leaves too many undefined consumer rules.

## Topic Identity And Aliases

Existing canonical topic IDs are permanent. Renaming a display label must not
change its ID or problem assignments. New topics receive a collision-safe ID
once; ID creation is separate from lookup normalization.

Topic lookup uses a dedicated normalization function: Unicode NFC, trim,
collapse whitespace, lowercase, and normalize typographic hyphens to the ASCII
hyphen. It preserves `/`, `&`, other meaningful punctuation, and non-ASCII
letters. Punctuation-only input and input without a Unicode letter or number
are rejected. Punctuation variants such as Union Find versus Union-Find are
explicit aliases, not an invitation to discard all punctuation globally.

Aliases point directly to a canonical ID; there are no alias chains. Canonical
labels, canonical IDs accepted as lookup inputs, and alias keys share one
collision validation policy. A key may repeat only when it identifies the same
topic. An input must never resolve differently because of lookup precedence.

Resolution is deterministic: validate and normalize input, resolve an existing
identity or alias, otherwise create an independent topic. Unknown labels keep
their display text and receive no inferred relationships. Repeated input and
multiple aliases for the same topic produce one direct assignment.

Safe aliases include curated plurals and abbreviations: DFS, BFS, DP, BST, BIT,
Fenwick Tree, Union Find, Disjoint Set Union, DSU, MST, and SCC. Existing safe
aliases remain. Heap, Heaps, Priority Queue, and Heap / Priority Queue resolve to
the existing combined Heap (Priority Queue) study topic. This is an explicit
product convention, not a claim that a heap and a priority queue are identical
technical concepts.

Correct the following legacy conflations:

- KMP and Knuth-Morris-Pratt identify one narrower String Matching topic.
- Rabin-Karp identifies a separate narrower String Matching topic.
- 1-D Dynamic Programming and 2-D Dynamic Programming remain distinct narrower
  topics, with 1-D DP and 2-D DP as their respective aliases.
- Binary is not a global alias for Bit Manipulation.
- Fast And Slow Pointers is a narrower Two Pointers topic, not an exact synonym.
- Advanced Graphs is a curriculum heading, not an exact synonym for Graph Theory.
- Arrays & Hashing, Array / String, Hash Map / Set, Hash Maps And Sets,
  Math And Geometry, and Sort And Search are composite headings, not aliases
  for one topic. Hash Map and Hash Set are narrower Hash Table study topics.
- Graphs - DFS, Binary Tree - DFS, Graphs - BFS, and Binary Tree - BFS are not
  unconditional aliases that discard their context.

For this release, unrecognized composite labels entered as problem metadata
remain independent topics; they are not automatically split into multiple
assignments. Track headings retain their existing meaning as group labels.
Source-specific interpretation of compound headings is deferred.

## Graph And Curated Taxonomy

The persisted relation model records source topic ID, target topic ID, relation
kind (`broader` or `applies-to`), and timestamps. Source is the narrower topic
for `broader` and the technique for `applies-to`. Existing parent/child storage
can be migrated to this explicit representation. Relation identity includes
kind and both endpoints; duplicate typed edges and self-links are rejected.

Only the `broader` subgraph must be acyclic. Applies-to links are never followed
for ancestor expansion, even when several such links form a path.

The initial curated broader edges are:

| Narrower topic(s)                                                                                                             | Direct broader topic(s)     |
| ----------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Binary Tree                                                                                                                   | Tree                        |
| Binary Search Tree                                                                                                            | Binary Tree                 |
| Segment Tree, Trie                                                                                                            | Tree                        |
| Topological Sort, Shortest Path, Minimum Spanning Tree, Eulerian Circuit, Strongly Connected Component, Biconnected Component | Graph Theory                |
| String Matching, Suffix Array                                                                                                 | String                      |
| KMP, Rabin-Karp                                                                                                               | String Matching             |
| Hash Map, Hash Set                                                                                                            | Hash Table                  |
| Monotonic Stack                                                                                                               | Stack                       |
| Monotonic Queue                                                                                                               | Queue                       |
| Doubly-Linked List                                                                                                            | Linked List                 |
| Merge Sort                                                                                                                    | Sorting; Divide and Conquer |
| Counting Sort, Bucket Sort, Radix Sort                                                                                        | Sorting                     |
| Quickselect                                                                                                                   | Divide and Conquer          |
| Number Theory, Combinatorics, Geometry, Probability and Statistics                                                            | Math                        |
| Bitmask                                                                                                                       | Bit Manipulation            |
| 1-D Dynamic Programming, 2-D Dynamic Programming                                                                              | Dynamic Programming         |
| Fast And Slow Pointers                                                                                                        | Two Pointers                |

The initial applies-to edges are DFS and BFS to Tree and Graph Theory;
Union-Find to Graph Theory; Rolling Hash to String; and Memoization to Dynamic
Programming and Recursion. These replace misleading containment edges where
present. DFS/BFS applicability to Binary Tree is discoverable through the Tree
context if a later consumer needs it; no redundant Binary Tree edge is required.

Tree is a separate learning family from Graph Theory in this release: there is
no automatic Tree → Graph Theory rollup. Binary Indexed Tree and Heap (Priority
Queue) remain independent learning topics rather than inheriting Tree merely
because their names or implementations suggest it. This is a curriculum
taxonomy, not an exhaustive mathematical classification.

All supplied canonical labels remain present. The following topics have no
broader parent in the initial catalogue; roots need not be forced into a family:

Array, String, Hash Table, Math, Dynamic Programming, Sorting, Greedy, Binary
Search, Depth-First Search, Database, Bit Manipulation, Matrix, Prefix Sum, Tree,
Two Pointers, Breadth-First Search, Heap (Priority Queue), Simulation, Counting,
Graph Theory, Stack, Enumeration, Design, Backtracking, Union-Find, Linked List,
Ordered Set, Divide and Conquer, Queue, Binary Indexed Tree, Recursion, Hash
Function, Memoization, Rolling Hash, Game Theory, Interactive, Data Stream,
Brainteaser, Randomized, Iterator, Concurrency, Sweep Line, Shell, Meet in the
Middle, Reservoir Sampling, Rejection Sampling, Sliding Window, and Intervals.

The supplied problem counts are external catalogue observations. Do not store
them as local counts, priorities, or evidence of learner progress.

## Derived Membership Contract

For each problem:

`effectiveTopicIds = directTopicIds ∪ all broader ancestors of directTopicIds`

Use sets keyed by stable IDs. A diamond in the graph, a direct parent tag, or
several tagged descendants must not duplicate the same ancestor. Return direct
assignments separately from derived ancestor IDs. Do not persist ancestors in
`problem_topics` and do not show inherited topics as manually assigned chips.

Build adjacency once per loaded taxonomy and reuse computed ancestor sets
within that read. Do not issue a query per problem or use an arbitrary depth
limit. Validate cycles before publishing the graph and retain visited-node
protection during traversal.

Future consumers can use this contract without changing its meaning: distinct
problem counts deduplicate problem IDs; review counts deduplicate review IDs per
topic. Topic buckets overlap and must not be summed to obtain overall totals.
This release exposes the foundation but does not change analytics evidence,
FSRS schedules, queue priorities, or explicit track progression.

## Library Filtering And Interaction

Extend the existing Topics filter in the Library filter panel. Keep the existing
page layout and other facets.

- Add a search field inside the topic picker. Match canonical labels and stored
  aliases using the topic normalization rules and substring search. Search is
  discovery only: typing does not create, merge, or select topics.
  Partial search text is not subject to topic-creation validation: an empty
  query shows all options, and punctuation-only queries produce matching options
  or a normal no-results state without a validation error.
- Display one selectable result per canonical ID. An alias match may show a
  secondary label such as “DFS”; the selected value and summary use the canonical
  name. Unused registry topics remain selectable and may return zero problems.
- Add Include subtopics, on by default. Off uses only direct assignments; on
  uses effective membership through broader edges.
- Add Match any / Match all, default Any. Preserve all explicit selections even
  when one is an ancestor of another.
- Any requires at least one selected ID in the problem's chosen membership set.
  All requires every selected ID. An empty selection imposes no topic constraint
  in either mode. Selecting Tree and Binary Tree with All can be satisfied by
  a Binary Search Tree assignment when subtopics are included.
- Combine the topic predicate with other facets using the existing AND behavior.
  Global Search problems keeps its existing text-search semantics; alias lookup
  is guaranteed in the topic picker, not added as an unrelated global-search
  redesign.
- Return each problem once. Visible totals, due totals, selection actions, and
  track creation from filtered rows use the same filtered row set.
- Clear Filters clears selected IDs and picker search and restores Any and
  Include subtopics. Mode changes alone with no topics selected do not hide rows.
- Preserve current session-local filter state; no saved-filter feature is added.
- Label controls explicitly, support keyboard operation and focus recovery, and
  keep the existing no-results state. The UI must make descendant inclusion and
  Any/All semantics visible without requiring a tooltip.

Concrete acceptance examples:

| Problem direct tags | Selection | Mode | Subtopics | Match        |
| ------------------- | --------- | ---- | --------- | ------------ |
| Binary Search Tree  | Tree      | Any  | On        | Yes          |
| Binary Search Tree  | Tree      | Any  | Off       | No           |
| DFS, Graph Theory   | Tree      | Any  | On        | No           |
| DFS, Binary Tree    | Tree, DFS | All  | On        | Yes          |
| Binary Tree         | Tree, DFS | All  | On        | No           |
| DFS, Graph Theory   | Tree, DFS | Any  | On        | Yes          |
| Binary Tree, Tree   | Tree      | Any  | On        | Yes, one row |

Aliases in this table stand for resolved canonical identities.

## Ownership And Data Flow

Problems remains the owner. Pure normalization, graph validation, and ancestor
calculations belong in `src/features/problems/domain`; writes and transactional
reconciliation stay behind its repository/service. Physical schema and snapshot
upgrade plumbing remain in `src/platform/db`.

The background Library read returns canonical topic options with aliases and
each row's direct and effective IDs. Library components own picker state and
the Any/All predicate. UI components do not query SQLite or implement a second
graph traversal. Existing direct-topic payload semantics must remain explicit
for other consumers.

Zod validates runtime requests/responses and backup data. Existing runtime
sender restrictions remain. After a successful topic write or restore, persist
the snapshot before notifying affected query families. Include Problems and
dependent Library, analytics, queue, track, and app-shell reads when their data
changes; reuse the existing invalidation mapping rather than assuming a tag
exists. Preserve existing sync dirty-marking and mutation serialization.

## Existing Data, Reconciliation, And Backup

This release must not use the current fingerprint-mismatch reset path for an
existing database. The preserving upgrade is a bounded prerequisite phase.

Create a fresh database only when both stored snapshot fields are absent.
Missing only one field, invalid field types, invalid encoded bytes, and corrupt
SQLite data are recovery errors, not evidence of a fresh installation. Retain
the original raw storage values even when decoding or schema inspection fails.

1. Recognize the exact pre-release migration fingerprint and validate its
   expected schema. Matching current snapshots continue to open normally.
2. Preserve the original snapshot bytes and fingerprint in a local recovery
   record before changing the active stored snapshot. If preserving that record
   fails, stop the upgrade.
3. Deserialize into an isolated handle, apply the incremental migration and
   topic reconciliation transactionally, and validate the result. Do not replay
   the complete fresh-database SQL bundle against the old database.
4. Publish the new snapshot and fingerprint only after validation and successful
   storage. Do not expose a writable handle or queue automatic pushes before
   this succeeds. Storage failure leaves the original recoverable.
5. On failure or an unsupported fingerprint, keep the original bytes and report
   a recoverable opening error. Never silently clear, reseed, or force a remote
   push. Extend the existing startup error path rather than adding a new
   recovery dashboard. Recovery instructions must identify how to export the
   retained data; automatic downgrade is not promised.

The compatibility boundary is the verified pre-release schema on main. Older
supported JSON backups remain importable; arbitrary historical binary snapshots
are retained on failure but not promised an automatic upgrade.

Use a versioned reconciliation manifest listing exact legacy alias and edge
changes. It must explicitly remove obsolete edges, not merely insert new ones.
Reapply the same idempotent rules after supported legacy backup normalization.
Recompute every retained alias key, including custom aliases, from its stored
display label using the new normalizer. Old slug keys such as `priority-queue`
must not survive as the sole lookup representation when the new key is
`priority queue`. Validate the complete canonical-ID, canonical-label, and alias
namespace after re-keying and before publishing; collapse duplicate keys only
when their target IDs agree. Current-format imports validate that stored alias
keys equal the normalized display labels. Canonical topic IDs are never re-keyed.
Exact known legacy mappings can be changed; conflicting custom mappings must
fail with a diagnostic before publishing changes, not be silently overwritten.
Unrelated custom topics and relations survive. A structurally valid custom
broader relation is preserved as user data rather than semantically guessed.

Merge only identities proven equivalent, moving all joins and alias references
transactionally and deduplicating joins. Preserve stable canonical IDs and
unaffected timestamps. Keep problem metadata, reviews, FSRS dates, track order,
track completion, settings, and secrets intact.

Historical lossy aliases cannot be reversed: an existing Array assignment may
have originated from Array / String. Do not add a guessed String assignment.
Existing broad String Matching or Dynamic Programming assignments stay broad;
new specific input can resolve to KMP or 1-D Dynamic Programming going forward.

Export backup schema version 4 with typed relations. Continue accepting versions
1–3 through explicit normalization into v4; legacy parent edges become broader
edges before the known correction manifest runs. Validate aliases, endpoints,
typed-edge uniqueness, direct joins, and broader cycles before replacing data.
Current-format restores preserve custom data while ensuring canonical defaults
do not reintroduce removed aliases. Restoring the same data twice is stable.

Gist continues to carry the backup envelope. Older app versions may reject v4;
document that all participating installations need the update. Do not flatten
typed relations for old clients or change conflict/force-pull rules. Recovery
snapshots are local infrastructure, not additional backup or sync payload data.

## Failure Behavior And Verification

Alias collisions, invalid normalized labels, dangling references, self-links,
and broader cycles return actionable errors and leave prior persisted state
intact. Unknown valid labels are not errors. Empty filters and no matching
problems are normal UI states.

Required automated cases include:

- Slash-containing and non-ASCII labels survive normalization; empty and
  punctuation-only input is rejected.
- Alias duplicates collapse, IDs stay stable, and cross-namespace collisions
  fail consistently on writes, seed reconciliation, and restore.
- Safe and custom aliases remain resolvable after re-keying; a new collision
  introduced by normalization stops migration without changing the old snapshot.
- Deep chains, diamonds, disconnected roots, direct-plus-ancestor overlap,
  multiple parents, and applies-to isolation behave correctly.
- Every supplied topic resolves; every curated edge has valid endpoints; all
  declared safe aliases resolve to their intended target.
- A populated old snapshot upgrades without losing reviews, due dates,
  assignments, track progress, order, or settings. Retry after injected
  migration, validation, recovery-record, and final-storage failures preserves
  the old snapshot. Unsupported snapshots do not trigger clear/reseed.
- Partial snapshot storage, corrupt bytes, and invalid fingerprints enter
  recovery without being overwritten by a fresh database.
- Reconciliation is idempotent and does not restore obsolete mappings or alter
  conflicting custom mappings silently.
- Backup versions 1–3 import; v4 round-trips both relation kinds and custom
  topics. Gist rejects unsupported data before replacing local state.
- Library covers every example above, alias discovery without duplicate
  options, unused topics, clear/reset, keyboard controls, combined facets,
  accurate counts, and selection/bulk-action consistency.

Implementation validation follows `docs/agent-governance.md`. Run focused tests
first, then the required commands for schema, runtime, and dashboard work:

```sh
npm run db:generate
npm run db:check
npm run lint
npm run check
npm run build
npx prettier --check <touched markdown files>
```

The implementation plan will name exact focused test paths per phase. This
specification itself requires only formatting validation, not runtime tests.

Before PR review or merge, a human must run happy-path and edge-case smoke flows
and attach screenshot or recording proof: upgrade with populated local data;
alias selection; Tree descendant inclusion; Tree AND DFS; Any/All and direct-only
toggles; empty results; reset; capture merge versus manual replace; and backup
export/import. Recovery failures also need demonstrated preserved data. Agent
browser checks supplement this required human proof.

## Delivery Phases And Completion

Use one design with three phase-sized plans, in dependency order:

1. **Preserving upgrade path.** Establish supported fingerprint recognition,
   retained recovery data, failure behavior, and persistence proof before
   shipping a schema-changing release.
2. **Topic foundation.** Deliver corrected normalization, canonical catalogue,
   alias reconciliation, typed relations, transitive reads, and backup v4.
3. **Library integration.** Deliver alias-aware picker, descendant inclusion,
   Any/All behavior, accessibility, integration validation, and human smoke proof.

The release is complete only when all three phases pass their acceptance
criteria and the current product, architecture, and testing docs describe the
shipped behavior. No implementation or behavior validation is claimed by this
documentation change. The eventual product PR should use a Conventional Commit
feature title; this specification uses a docs title and does not itself trigger
a feature release.
