# Queue Categories Design

## Context

Issue #12 calls for the queue to definitively answer "what should I study now?" by
completing category coverage, adding an excluded count, and surfacing a top
recommendation with a reason directly from the domain.

The current state has three gaps:

1. `new` is a declared category and `newCount` is a field on `TodayQueue`, but the
   partitioner silently skips unstarted problems with `continue` — `newCount` is
   always 0 and `new` items never appear in `items[]`.
2. Excluded candidates (mastered, suspended, premium-filtered) are silently dropped
   with no count or record.
3. `topRecommendation` and `recommendationReason` are derived in `app-shell-service`
   from `items[0]` and the item's category — logic that belongs in the queue domain.

## Goals

- Fix the `new` category: unstarted eligible problems enter the queue as a fallback
  when `due` and `reinforcement` are both empty.
- Track excluded candidates as `excludedCount` — count only, never in `items[]`.
- Add `topRecommendation` and `recommendationReason` to `TodayQueue` so consumers
  read the recommendation directly from the queue contract.
- Simplify `app-shell-service` to consume the new fields rather than re-derive them.

## Non-Goals

- Renaming existing fields (`dueCount`, `newCount`, etc.) to match the issue's
  proposed names (`dueToday`, `newAvailable`). The existing names are clear.
- A separate `QueueSummary` type — the fields land directly on `TodayQueue`.
- Exposing excluded items in `items[]` or as actionable recommendations.

## Queue Domain Contract

### Updated `TodayQueue`

```typescript
export interface TodayQueue {
  generatedAt: Date
  dailyGoal: number
  dueCount: number
  newCount: number
  reinforcementCount: number
  excludedCount: number                        // problems filtered out; count only
  items: QueueItem[]
  topRecommendation: QueueItem | null          // items[0], or null
  recommendationReason: RecommendationReason | null
}

export type RecommendationReason =
  | 'overdue'       // due item past its dueAt
  | 'due-now'       // due item not yet overdue
  | 'reinforcement' // started, not due; extra practice
  | 'new-problem'   // fallback: no due or reinforcement available
```

`QueueItemCategory` stays `'due' | 'new' | 'reinforcement'`. `excluded` is not a
category on items.

## Partitioner Changes

`partitionQueueCandidates` gains an `excludedCount` return value.

**Excluded candidates** — problems that hit `isEffectivelySuspended` — are counted
instead of silently dropped:

```typescript
if (isEffectivelySuspended(candidate, settings)) {
  excludedCount++
  continue
}
```

**Unstarted problems** push into `partitions.new` instead of being skipped:

```typescript
// before
if (!candidate.state.isStarted) {
  continue
}

// after
if (!candidate.state.isStarted) {
  partitions.new.push(mapQueueItem(candidate, 'new'))
  continue
}
```

## Slot-Filling Changes

The priority order changes from `due → new → reinforcement` to
`due → reinforcement → new (fallback only)`.

`new` items enter `items[]` only when both `due` and `reinforcement` produce zero
filled slots:

```
dueForQueue           = due.slice(0, dailyGoal)
slotsAfterDue         = dailyGoal - dueForQueue.length
reinforcementForQueue = reinforcement.slice(0, slotsAfterDue)
newForQueue           = (dueForQueue.length + reinforcementForQueue.length) === 0
                          ? new.slice(0, dailyGoal)
                          : []
items = [...dueForQueue, ...reinforcementForQueue, ...newForQueue]
```

## Recommendation Derivation

`topRecommendation` and `recommendationReason` are derived at the end of
`buildTodayQueue` from `items[0]`:

| Condition | `recommendationReason` |
|---|---|
| `items[0]` is `null` | `null` |
| `category === 'due'` and `state.isOverdue` | `'overdue'` |
| `category === 'due'` and not overdue | `'due-now'` |
| `category === 'reinforcement'` | `'reinforcement'` |
| `category === 'new'` | `'new-problem'` |

## Downstream Impact

### `app-shell-service.ts`

Stops deriving the recommendation from `queueItems[0]`. Reads directly from
`queue.topRecommendation`:

```typescript
recommendation: buildAppShellRecommendation(
  queue.topRecommendation
    ? serializeQueueItem(queue.topRecommendation)
    : null
)
```

`buildAppShellRecommendation` and its call signature stay unchanged. The
`readRecommendationReason` helper in `popup-app-shell.ts` that derives labels from
category can be simplified — `recommendationReason` from the queue already carries
the intent.

### Messaging Contract

`todayQueueSchema` in `messaging.ts` gains:

- `excludedCount: z.number().int().min(0)`
- `topRecommendation: queueItemSchema.nullable()`
- `recommendationReason: z.enum(['overdue', 'due-now', 'reinforcement', 'new-problem']).nullable()`

The serializer that maps `TodayQueue` to `SerializedTodayQueue` maps these fields
through directly.

## Tests

### `queue.test.ts`

- Update the existing test asserting `newCount: 0` and "ignoring unstarted problems"
  to reflect the new behavior.
- Add: `new` as fallback (appears in `items[]` only when due + reinforcement empty).
- Add: `excludedCount` is populated correctly for suspended, mastered, and
  premium-filtered candidates.
- Add: `topRecommendation` and `recommendationReason` derivation for each reason
  variant, including the `null` empty-queue case.

### Other

- `app-shell-service.test.ts` — update fixtures to include the three new fields.
- `popup-shell.test.tsx` — update fixtures accordingly.
- `messaging.ts` schema tests if they exist — validate new fields serialize and
  deserialize correctly.
