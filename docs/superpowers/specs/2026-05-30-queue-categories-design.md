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
3. `topRecommendation` and recommendation reasoning are derived in `app-shell-service`
   from `items[0]` and the item's category — logic that belongs in the queue domain.

## Goals

- Fix the `new` category: unstarted eligible problems enter the queue as a fallback
  when `due` and `reinforcement` are both empty.
- Track excluded candidates as `excludedCount` — count only, never in `items[]`.
- Add `reason: RecommendationReason` to `QueueItem` so every item carries its own
  reason, and `topRecommendation` (which is `items[0]`) exposes the reason via
  `topRecommendation?.reason`.
- Drop `dailyGoal` from `TodayQueue` — it is already in `UserSettings.practice.dailyGoal`
  and redundant on the queue contract.
- Simplify `app-shell-service` to consume `queue.topRecommendation` rather than
  re-derive the recommendation from `items[0]`.

## Non-Goals

- Renaming existing fields (`dueCount`, `newCount`, etc.) to match the issue's
  proposed names (`dueToday`, `newAvailable`). The existing names are clear.
- A separate `QueueSummary` type — the fields land directly on `TodayQueue`.
- Exposing excluded items in `items[]` or as actionable recommendations.
- Adding `reason` to `AppShellQueueItem` — the app-shell has its own
  `recommendation.category` field which already drives display labels.

## Queue Domain Contract

### Updated `QueueItem`

`reason` is added directly to `QueueItem`. Every item in the queue carries its
own reason — derived from its category and overdue state at creation time.

```typescript
export interface QueueItem {
  category: QueueItemCategory
  problemSlug: ProblemSlug
  title: string
  difficulty: ProblemDifficulty
  isPremium: boolean
  state: NormalizedPracticeState
  reason: RecommendationReason
}

export type RecommendationReason =
  | 'overdue'       // due item past its dueAt
  | 'due-now'       // due item not yet overdue
  | 'reinforcement' // started, not due; extra practice
  | 'new-problem'   // fallback: no due or reinforcement available
```

### Updated `TodayQueue`

`dailyGoal` is removed (read from `settings.practice.dailyGoal` instead).
`topRecommendation` is `items[0]` — its `reason` is already on the item.
No separate `recommendationReason` field is needed on the queue.

```typescript
export interface TodayQueue {
  generatedAt: Date
  dueCount: number
  newCount: number
  reinforcementCount: number
  excludedCount: number           // problems filtered out; count only
  items: QueueItem[]
  topRecommendation: QueueItem | null
}
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

`mapQueueItem` is updated to derive and attach `reason` at creation time:

```typescript
function mapQueueItem(
  candidate: QueueCandidate,
  category: QueueItemCategory,
): QueueItem {
  return {
    category,
    problemSlug: candidate.problem.slug,
    title: candidate.problem.title,
    difficulty: candidate.problem.difficulty,
    isPremium: candidate.problem.isPremium,
    state: candidate.state,
    reason: deriveRecommendationReason(category, candidate.state.isOverdue),
  }
}

function deriveRecommendationReason(
  category: QueueItemCategory,
  isOverdue: boolean,
): RecommendationReason {
  if (category === 'due') return isOverdue ? 'overdue' : 'due-now'
  if (category === 'reinforcement') return 'reinforcement'
  return 'new-problem'
}
```

## Slot-Filling Changes

The priority order changes from `due → new → reinforcement` to
`due → reinforcement → new (fallback only)`.

`new` items enter `items[]` only when both `due` and `reinforcement` produce zero
filled slots. `dailyGoal` is read from settings and used internally but no longer
returned on the queue:

```
dailyGoal             = settings.practice.dailyGoal (internal only)
dueForQueue           = due.slice(0, dailyGoal)
slotsAfterDue         = dailyGoal - dueForQueue.length
reinforcementForQueue = reinforcement.slice(0, slotsAfterDue)
newForQueue           = (dueForQueue.length + reinforcementForQueue.length) === 0
                          ? new.slice(0, dailyGoal)
                          : []
items = [...dueForQueue, ...reinforcementForQueue, ...newForQueue]
topRecommendation = items[0] ?? null
```

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

Removes `dailyGoal` from the queue payload it assembles:

```typescript
queue: {
  dueCount: queue.dueCount,
  newCount: queue.newCount,
  reinforcementCount: queue.reinforcementCount,
  items: queueItems,
},
```

### `app-shell-contracts.ts`

Removes `dailyGoal` from `appShellBaseDataSchema.queue`.

### Messaging Contract

`queueItemSchema` in `messaging.ts` gains `reason`:

```typescript
export const queueItemSchema = z.object({
  category: z.enum(['due', 'new', 'reinforcement']),
  problemSlug: problemSlugSchema,
  title: z.string(),
  difficulty: problemDifficultySchema,
  isPremium: z.boolean(),
  state: normalizedPracticeStateSchema,
  reason: z.enum(['overdue', 'due-now', 'reinforcement', 'new-problem']),
})
```

`todayQueueSchema` removes `dailyGoal` and gains `excludedCount` and
`topRecommendation`:

```typescript
export const todayQueueSchema = z.object({
  generatedAt: z.iso.datetime(),
  dueCount: z.number().int().min(0),
  newCount: z.number().int().min(0),
  reinforcementCount: z.number().int().min(0),
  excludedCount: z.number().int().min(0),
  items: z.array(queueItemSchema),
  topRecommendation: queueItemSchema.nullable(),
})
```

The serializer in `register-handlers.ts` maps the new fields and removes `dailyGoal`.

## Tests

### `queue.test.ts`

- Update the existing test asserting `newCount: 0` and "ignoring unstarted problems"
  to reflect the new behavior.
- Add: `new` as fallback (appears in `items[]` only when due + reinforcement empty).
- Add: `excludedCount` is populated correctly for suspended, mastered, and
  premium-filtered candidates.
- Add: `reason` on items for each variant (`overdue`, `due-now`, `reinforcement`,
  `new-problem`) and `topRecommendation` pointing to `items[0]`.
- Add: `topRecommendation` is null for empty queue.

### Other

- `app-shell-service.test.ts` — remove `dailyGoal` from queue fixture assertions.
- `popup-shell.test.tsx` — remove `dailyGoal` from `shellData.queue`.
- `register-handlers.test.ts` — validate new `reason` field serializes correctly
  and `dailyGoal` is absent.
