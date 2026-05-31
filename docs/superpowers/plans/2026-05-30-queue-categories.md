# Queue Categories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the queue domain contract by fixing the `new` category, tracking `excludedCount`, and surfacing `topRecommendation` / `recommendationReason` directly from the domain.

**Architecture:** All changes are contained in the queue domain (`queue.ts`), the messaging schema and its serializer, and the app-shell service that reads the recommendation. The queue's slot-filling priority changes from `due → new → reinforcement` to `due → reinforcement → new (fallback only)`. The app-shell service stops re-deriving the top recommendation from `items[0]` and reads the new `topRecommendation` field directly.

**Tech Stack:** TypeScript, Vitest, Zod (`z.enum`, `z.nullable`).

---

### Task 1: Update queue domain types and write failing tests

**Files:**
- Modify: `src/features/queue/domain/queue.ts`
- Modify: `src/features/queue/domain/queue.test.ts`

- [ ] **Step 1: Add `RecommendationReason` type and update `TodayQueue` in `queue.ts`**

  Replace the existing `TodayQueue` interface and add the new type. The `QueueItemCategory` union stays unchanged.

  ```typescript
  export type RecommendationReason =
    | 'overdue'
    | 'due-now'
    | 'reinforcement'
    | 'new-problem'

  export interface TodayQueue {
    generatedAt: Date
    dailyGoal: number
    dueCount: number
    newCount: number
    reinforcementCount: number
    excludedCount: number
    items: QueueItem[]
    topRecommendation: QueueItem | null
    recommendationReason: RecommendationReason | null
  }
  ```

  Also update the export in `src/features/queue/domain/index.ts` to include `RecommendationReason`:

  ```typescript
  export {
    buildTodayQueue,
    type QueueCandidate,
    type QueueItemCategory,
    type QueueItem,
    type TodayQueue,
    type RecommendationReason,
  } from './queue'
  ```

  And in `src/features/queue/index.ts`:

  ```typescript
  export {
    buildTodayQueue,
    type QueueCandidate,
    type QueueItemCategory,
    type QueueItem,
    type TodayQueue,
    type RecommendationReason,
  } from './domain'
  ```

- [ ] **Step 2: Write failing tests in `queue.test.ts`**

  Add the following test cases inside the existing `describe('buildTodayQueue', ...)` block. These all fail until Task 2 is complete.

  ```typescript
  it('counts excluded candidates without adding them to items', () => {
    const queue = buildTodayQueue(
      [
        candidate({ slug: 'suspended', practice: practice({ isSuspended: true }) }),
        candidate({ slug: 'mastered', practice: practice({ status: 'mastered' }) }),
        candidate({ slug: 'premium', isPremium: true }),
      ],
      {
        ...defaultUserSettings,
        practice: {
          ...defaultUserSettings.practice,
          problemFilters: { skipPremium: true },
        },
      },
      generatedAt,
    )

    expect(queue.excludedCount).toBe(3)
    expect(queue.items).toEqual([])
    expect(queue.topRecommendation).toBeNull()
    expect(queue.recommendationReason).toBeNull()
  })

  it('uses new items as fallback only when due and reinforcement are empty', () => {
    const queue = buildTodayQueue(
      [
        candidate({ slug: 'unstarted-a' }),
        candidate({ slug: 'unstarted-b' }),
      ],
      {
        ...defaultUserSettings,
        practice: {
          ...defaultUserSettings.practice,
          dailyGoal: 3,
        },
      },
      generatedAt,
    )

    expect(queue.newCount).toBe(2)
    expect(queue.items.map((item) => item.category)).toEqual(['new', 'new'])
    expect(queue.topRecommendation?.problemSlug).toBe('unstarted-a')
    expect(queue.recommendationReason).toBe('new-problem')
  })

  it('does not include new items in items[] when due items are present', () => {
    const queue = buildTodayQueue(
      [
        candidate({ slug: 'unstarted' }),
        candidate({
          slug: 'due',
          card: reviewCard({
            dueAt: new Date('2025-12-25T00:00:00.000Z'),
            lastReviewAt: new Date('2025-12-01T00:00:00.000Z'),
            stability: 1,
          }),
          practice: practice({ lastRating: 'again' }),
        }),
      ],
      defaultUserSettings,
      generatedAt,
    )

    expect(queue.newCount).toBe(1)
    expect(queue.items.map((i) => i.category)).toEqual(['due'])
    expect(queue.recommendationReason).toBe('overdue')
  })

  it('does not include new items in items[] when reinforcement items are present', () => {
    const queue = buildTodayQueue(
      [
        candidate({ slug: 'unstarted' }),
        candidate({
          slug: 'started',
          card: reviewCard({
            dueAt: new Date('2026-01-10T00:00:00.000Z'),
            lastReviewAt: new Date('2026-01-01T08:00:00.000Z'),
            stability: 30,
          }),
          practice: practice({ lastRating: 'good' }),
        }),
      ],
      defaultUserSettings,
      generatedAt,
    )

    expect(queue.newCount).toBe(1)
    expect(queue.items.map((i) => i.category)).toEqual(['reinforcement'])
    expect(queue.recommendationReason).toBe('reinforcement')
  })

  it('sets recommendationReason to due-now for a due item that is not overdue', () => {
    const queue = buildTodayQueue(
      [
        candidate({
          slug: 'due-now',
          card: reviewCard({
            dueAt: generatedAt,
            lastReviewAt: new Date('2025-12-01T00:00:00.000Z'),
            stability: 1,
          }),
          practice: practice({ lastRating: 'good' }),
        }),
      ],
      defaultUserSettings,
      generatedAt,
    )

    expect(queue.recommendationReason).toBe('due-now')
    expect(queue.topRecommendation?.problemSlug).toBe('due-now')
  })

  it('returns null topRecommendation and null recommendationReason for an empty queue', () => {
    const queue = buildTodayQueue([], defaultUserSettings, generatedAt)

    expect(queue.topRecommendation).toBeNull()
    expect(queue.recommendationReason).toBeNull()
    expect(queue.excludedCount).toBe(0)
  })
  ```

  Also update the two existing tests that need `excludedCount` assertions:

  In `'excludes manually suspended and premium-filtered candidates'`, add after `expect(queue.items).toEqual([])`:
  ```typescript
  expect(queue.excludedCount).toBe(2)
  ```

  In `'excludes mastered candidates from daily queue items'`, add after `expect(queue.items).toEqual([])`:
  ```typescript
  expect(queue.excludedCount).toBe(1)
  ```

  And update `'fills due and reinforcement categories while ignoring unstarted problems'` — the unstarted candidate now populates `newCount`. Change:
  ```typescript
  expect(queue.newCount).toBe(0)
  ```
  to:
  ```typescript
  expect(queue.newCount).toBe(1)
  ```

  And update `'caps by daily goal after due items first'` similarly — the unstarted candidate now produces `newCount: 1`. Add:
  ```typescript
  expect(queue.newCount).toBe(1)
  ```

- [ ] **Step 3: Run the tests to confirm they fail**

  ```bash
  npx vitest run src/features/queue/domain/queue.test.ts
  ```

  Expected: TypeScript compilation errors on `excludedCount`, `topRecommendation`, `recommendationReason` not on `TodayQueue`, plus test assertion failures. This is correct — the implementation hasn't happened yet.

---

### Task 2: Implement partitioner fixes, slot-filling change, and recommendation derivation

**Files:**
- Modify: `src/features/queue/domain/queue.ts`

- [ ] **Step 1: Update `partitionQueueCandidates` to count excluded and collect `new`**

  Replace the existing `partitionQueueCandidates` function:

  ```typescript
  function partitionQueueCandidates(
    candidates: QueueCandidate[],
    settings: UserSettings,
  ) {
    const partitions: Record<QueueItemCategory, QueueItem[]> = {
      due: [],
      new: [],
      reinforcement: [],
    }
    let excludedCount = 0

    for (const candidate of candidates) {
      if (isEffectivelySuspended(candidate, settings)) {
        excludedCount++
        continue
      }

      if (candidate.state.isDue) {
        partitions.due.push(mapQueueItem(candidate, 'due'))
        continue
      }

      if (!candidate.state.isStarted) {
        partitions.new.push(mapQueueItem(candidate, 'new'))
        continue
      }

      partitions.reinforcement.push(mapQueueItem(candidate, 'reinforcement'))
    }

    return { partitions, excludedCount }
  }
  ```

- [ ] **Step 2: Update `buildTodayQueue` — new slot-filling order, recommendation derivation**

  Replace the entire `buildTodayQueue` function:

  ```typescript
  export function buildTodayQueue(
    candidates: QueueCandidate[],
    settings: UserSettings,
    generatedAt = new Date(),
  ): TodayQueue {
    const dailyGoal = Math.max(0, Math.round(settings.practice.dailyGoal))
    const { partitions, excludedCount } = partitionQueueCandidates(
      candidates,
      settings,
    )
    const dueItems = orderQueueItems(partitions.due, settings.review.order)
    const newItems = orderQueueItems(partitions.new, settings.review.order)
    const reinforcementItems = orderQueueItems(
      partitions.reinforcement,
      settings.review.order,
    )

    const dueForQueue = dueItems.slice(0, dailyGoal)
    const slotsAfterDue = Math.max(0, dailyGoal - dueForQueue.length)
    const reinforcementForQueue = reinforcementItems.slice(0, slotsAfterDue)
    const newForQueue =
      dueForQueue.length + reinforcementForQueue.length === 0
        ? newItems.slice(0, dailyGoal)
        : []

    const items = [...dueForQueue, ...reinforcementForQueue, ...newForQueue]
    const topRecommendation = items[0] ?? null
    const recommendationReason = topRecommendation
      ? deriveRecommendationReason(topRecommendation)
      : null

    return {
      generatedAt,
      dailyGoal,
      dueCount: dueItems.length,
      newCount: newItems.length,
      reinforcementCount: reinforcementItems.length,
      excludedCount,
      items,
      topRecommendation,
      recommendationReason,
    }
  }
  ```

- [ ] **Step 3: Add `deriveRecommendationReason` helper at the bottom of `queue.ts`**

  ```typescript
  function deriveRecommendationReason(item: QueueItem): RecommendationReason {
    if (item.category === 'due') {
      return item.state.isOverdue ? 'overdue' : 'due-now'
    }
    if (item.category === 'reinforcement') {
      return 'reinforcement'
    }
    return 'new-problem'
  }
  ```

- [ ] **Step 4: Run the queue tests**

  ```bash
  npx vitest run src/features/queue/domain/queue.test.ts
  ```

  Expected: all tests pass.

- [ ] **Step 5: Commit**

  ```bash
  git add src/features/queue/domain/queue.ts src/features/queue/domain/queue.test.ts src/features/queue/domain/index.ts src/features/queue/index.ts
  git commit -m "feat(queue): add excludedCount, new fallback, topRecommendation, recommendationReason"
  ```

---

### Task 3: Update the messaging schema and serializer

**Files:**
- Modify: `src/extension/messaging.ts` (lines 196–204)
- Modify: `src/extension/background/register-handlers.ts` (lines 1218–1235)

- [ ] **Step 1: Add new fields to `todayQueueSchema` in `messaging.ts`**

  Replace the existing `todayQueueSchema`:

  ```typescript
  export const todayQueueSchema = z.object({
    generatedAt: z.iso.datetime(),
    dailyGoal: z.number(),
    dueCount: z.number().int().min(0),
    newCount: z.number().int().min(0),
    reinforcementCount: z.number().int().min(0),
    excludedCount: z.number().int().min(0),
    items: z.array(queueItemSchema),
    topRecommendation: queueItemSchema.nullable(),
    recommendationReason: z
      .enum(['overdue', 'due-now', 'reinforcement', 'new-problem'])
      .nullable(),
  })
  ```

- [ ] **Step 2: Update `serializeTodayQueue` in `register-handlers.ts`**

  The function is at line 1218. Replace it:

  ```typescript
  function serializeTodayQueue(queue: TodayQueue): SerializedTodayQueue {
    return todayQueueSchema.parse({
      generatedAt: queue.generatedAt.toISOString(),
      dailyGoal: queue.dailyGoal,
      dueCount: queue.dueCount,
      newCount: queue.newCount,
      reinforcementCount: queue.reinforcementCount,
      excludedCount: queue.excludedCount,
      items: queue.items.map((item) => ({
        category: item.category,
        problemSlug: item.problemSlug,
        title: item.title,
        difficulty: item.difficulty,
        isPremium: item.isPremium,
        state: serializeNormalizedPracticeState(item.state),
      })),
      topRecommendation: queue.topRecommendation
        ? {
            category: queue.topRecommendation.category,
            problemSlug: queue.topRecommendation.problemSlug,
            title: queue.topRecommendation.title,
            difficulty: queue.topRecommendation.difficulty,
            isPremium: queue.topRecommendation.isPremium,
            state: serializeNormalizedPracticeState(
              queue.topRecommendation.state,
            ),
          }
        : null,
      recommendationReason: queue.recommendationReason,
    })
  }
  ```

- [ ] **Step 3: Run typecheck and tests**

  ```bash
  npm run typecheck && npx vitest run src/extension/background/register-handlers.test.ts
  ```

  Expected: no type errors, tests pass.

- [ ] **Step 4: Commit**

  ```bash
  git add src/extension/messaging.ts src/extension/background/register-handlers.ts
  git commit -m "feat(messaging): add excludedCount, topRecommendation, recommendationReason to queue schema"
  ```

---

### Task 4: Simplify app-shell-service recommendation derivation

**Files:**
- Modify: `src/features/app-shell/server/app-shell-service.ts`

- [ ] **Step 1: Update `getMainAppShellData` to read `topRecommendation` from queue**

  Locate this line in `getMainAppShellData`:

  ```typescript
  recommendation: buildAppShellRecommendation(queueItems[0] ?? null),
  ```

  Replace it with:

  ```typescript
  recommendation: buildAppShellRecommendation(
    queue.topRecommendation
      ? serializeQueueItem(queue.topRecommendation)
      : null,
  ),
  ```

- [ ] **Step 2: Run typecheck and app-shell service tests**

  ```bash
  npm run typecheck && npx vitest run src/features/app-shell/server/app-shell-service.test.ts
  ```

  Expected: no type errors, all existing tests still pass (behavior is identical — `topRecommendation` is `items[0]`).

- [ ] **Step 3: Commit**

  ```bash
  git add src/features/app-shell/server/app-shell-service.ts
  git commit -m "refactor(app-shell): read topRecommendation from queue domain instead of deriving from items[0]"
  ```

---

### Task 5: Full check

- [ ] **Step 1: Run the full check**

  ```bash
  npm run check
  ```

  Expected: all lint, typecheck, and tests pass with no errors.

- [ ] **Step 2: Commit if any lint autofixes were applied**

  If `npm run check` applied any formatting changes:

  ```bash
  git add -p
  git commit -m "chore: lint fixes after queue categories implementation"
  ```
