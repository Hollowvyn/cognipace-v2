# Queue Categories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the queue domain contract by fixing the `new` category, tracking `excludedCount`, attaching `reason` to every `QueueItem`, exposing `topRecommendation`, and dropping the redundant `dailyGoal` field.

**Architecture:** All domain changes are in `queue.ts`. `reason` is derived per item inside `mapQueueItem` using category + `isOverdue`. `dailyGoal` is used internally in slot-filling but no longer returned. Downstream: the messaging schema, its serializer, app-shell-service, and app-shell-contracts each shed `dailyGoal` and adopt the new item shape. The app-shell service stops re-deriving the top recommendation from `items[0]` and reads `queue.topRecommendation` directly.

**Tech Stack:** TypeScript, Vitest, Zod.

---

### Task 1: Update queue domain types and write failing tests

**Files:**
- Modify: `src/features/queue/domain/queue.ts`
- Modify: `src/features/queue/domain/index.ts`
- Modify: `src/features/queue/index.ts`
- Modify: `src/features/queue/domain/queue.test.ts`

- [ ] **Step 1: Add `RecommendationReason`, update `QueueItem`, update `TodayQueue` in `queue.ts`**

  Add `RecommendationReason` above `QueueItem`. Add `reason` to `QueueItem`. Remove `dailyGoal` and `recommendationReason` from `TodayQueue`; keep `topRecommendation`.

  ```typescript
  export type RecommendationReason =
    | 'overdue'
    | 'due-now'
    | 'reinforcement'
    | 'new-problem'

  export interface QueueItem {
    category: QueueItemCategory
    problemSlug: ProblemSlug
    title: string
    difficulty: ProblemDifficulty
    isPremium: boolean
    state: NormalizedPracticeState
    reason: RecommendationReason
  }

  export interface TodayQueue {
    generatedAt: Date
    dueCount: number
    newCount: number
    reinforcementCount: number
    excludedCount: number
    items: QueueItem[]
    topRecommendation: QueueItem | null
  }
  ```

- [ ] **Step 2: Export `RecommendationReason` from both index files**

  In `src/features/queue/domain/index.ts`:

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

  In `src/features/queue/index.ts`:

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

- [ ] **Step 3: Write failing tests in `queue.test.ts`**

  Add the following cases inside the existing `describe('buildTodayQueue', ...)` block:

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
    expect(queue.items[0]?.reason).toBe('new-problem')
    expect(queue.topRecommendation?.problemSlug).toBe('unstarted-a')
    expect(queue.topRecommendation?.reason).toBe('new-problem')
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
    expect(queue.items[0]?.reason).toBe('overdue')
    expect(queue.topRecommendation?.reason).toBe('overdue')
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
    expect(queue.items[0]?.reason).toBe('reinforcement')
  })

  it('sets reason to due-now for a due item that is not overdue', () => {
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

    expect(queue.items[0]?.reason).toBe('due-now')
    expect(queue.topRecommendation?.reason).toBe('due-now')
  })

  it('returns null topRecommendation for an empty queue', () => {
    const queue = buildTodayQueue([], defaultUserSettings, generatedAt)

    expect(queue.topRecommendation).toBeNull()
    expect(queue.excludedCount).toBe(0)
  })
  ```

  Also update the two existing tests that check excluded behavior:

  In `'excludes manually suspended and premium-filtered candidates'`, add after `expect(queue.items).toEqual([])`:
  ```typescript
  expect(queue.excludedCount).toBe(2)
  ```

  In `'excludes mastered candidates from daily queue items'`, add after `expect(queue.items).toEqual([])`:
  ```typescript
  expect(queue.excludedCount).toBe(1)
  ```

  Update `'fills due and reinforcement categories while ignoring unstarted problems'` — change:
  ```typescript
  expect(queue.newCount).toBe(0)
  ```
  to:
  ```typescript
  expect(queue.newCount).toBe(1)
  ```

  Update `'caps by daily goal after due items first'` — add:
  ```typescript
  expect(queue.newCount).toBe(1)
  ```

- [ ] **Step 4: Run tests to confirm they fail**

  ```bash
  npx vitest run src/features/queue/domain/queue.test.ts
  ```

  Expected: TypeScript errors on the changed types, plus assertion failures. This is expected.

---

### Task 2: Implement partitioner, slot-filling, and `mapQueueItem` changes

**Files:**
- Modify: `src/features/queue/domain/queue.ts`

- [ ] **Step 1: Add `deriveRecommendationReason` helper**

  Add this function near the bottom of `queue.ts`, before `mapQueueItem`:

  ```typescript
  function deriveRecommendationReason(
    category: QueueItemCategory,
    isOverdue: boolean,
  ): RecommendationReason {
    if (category === 'due') return isOverdue ? 'overdue' : 'due-now'
    if (category === 'reinforcement') return 'reinforcement'
    return 'new-problem'
  }
  ```

- [ ] **Step 2: Update `mapQueueItem` to attach `reason`**

  Replace the existing `mapQueueItem`:

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
  ```

- [ ] **Step 3: Update `partitionQueueCandidates` to count excluded and collect `new`**

  Replace the existing function:

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

- [ ] **Step 4: Update `buildTodayQueue` — new slot-filling, drop `dailyGoal` from return**

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

    return {
      generatedAt,
      dueCount: dueItems.length,
      newCount: newItems.length,
      reinforcementCount: reinforcementItems.length,
      excludedCount,
      items,
      topRecommendation: items[0] ?? null,
    }
  }
  ```

- [ ] **Step 5: Run the queue tests**

  ```bash
  npx vitest run src/features/queue/domain/queue.test.ts
  ```

  Expected: all tests pass.

- [ ] **Step 6: Commit**

  ```bash
  git add src/features/queue/domain/queue.ts src/features/queue/domain/queue.test.ts src/features/queue/domain/index.ts src/features/queue/index.ts
  git commit -m "feat(queue): add reason to QueueItem, excludedCount, new fallback, topRecommendation; drop dailyGoal"
  ```

---

### Task 3: Update messaging schema and serializer

**Files:**
- Modify: `src/extension/messaging.ts` (lines 187–204)
- Modify: `src/extension/background/register-handlers.ts` (lines 1218–1235)

- [ ] **Step 1: Add `reason` to `queueItemSchema` and update `todayQueueSchema` in `messaging.ts`**

  Replace the two schemas:

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

- [ ] **Step 2: Update `serializeTodayQueue` in `register-handlers.ts`**

  Replace the function (currently at line 1218):

  ```typescript
  function serializeTodayQueue(queue: TodayQueue): SerializedTodayQueue {
    const serializeItem = (item: QueueItem) => ({
      category: item.category,
      problemSlug: item.problemSlug,
      title: item.title,
      difficulty: item.difficulty,
      isPremium: item.isPremium,
      state: serializeNormalizedPracticeState(item.state),
      reason: item.reason,
    })

    return todayQueueSchema.parse({
      generatedAt: queue.generatedAt.toISOString(),
      dueCount: queue.dueCount,
      newCount: queue.newCount,
      reinforcementCount: queue.reinforcementCount,
      excludedCount: queue.excludedCount,
      items: queue.items.map(serializeItem),
      topRecommendation: queue.topRecommendation
        ? serializeItem(queue.topRecommendation)
        : null,
    })
  }
  ```

- [ ] **Step 3: Run typecheck and handler tests**

  ```bash
  npm run typecheck && npx vitest run src/extension/background/register-handlers.test.ts
  ```

  Expected: no type errors, tests pass.

- [ ] **Step 4: Commit**

  ```bash
  git add src/extension/messaging.ts src/extension/background/register-handlers.ts
  git commit -m "feat(messaging): add reason to queue item schema, drop dailyGoal, add excludedCount and topRecommendation"
  ```

---

### Task 4: Update app-shell-service and app-shell-contracts

**Files:**
- Modify: `src/features/app-shell/server/app-shell-service.ts`
- Modify: `src/features/app-shell/api/app-shell-contracts.ts`
- Modify: `src/features/app-shell/server/app-shell-service.test.ts`
- Modify: `src/app/popup/popup-shell.test.tsx`

- [ ] **Step 1: Remove `dailyGoal` from `appShellBaseDataSchema.queue` in `app-shell-contracts.ts`**

  Locate this section in `appShellBaseDataSchema`:

  ```typescript
  queue: z.object({
    dailyGoal: z.number().int().min(0),
    dueCount: z.number().int().min(0),
    newCount: z.number().int().min(0),
    reinforcementCount: z.number().int().min(0),
    items: z.array(appShellQueueItemSchema),
  }),
  ```

  Replace with:

  ```typescript
  queue: z.object({
    dueCount: z.number().int().min(0),
    newCount: z.number().int().min(0),
    reinforcementCount: z.number().int().min(0),
    items: z.array(appShellQueueItemSchema),
  }),
  ```

- [ ] **Step 2: Update `getMainAppShellData` in `app-shell-service.ts`**

  Locate the queue payload assembly and recommendation line. Make two changes:

  Change the recommendation line from:
  ```typescript
  recommendation: buildAppShellRecommendation(queueItems[0] ?? null),
  ```
  to:
  ```typescript
  recommendation: buildAppShellRecommendation(
    queue.topRecommendation
      ? serializeQueueItem(queue.topRecommendation)
      : null,
  ),
  ```

  Change the queue payload from:
  ```typescript
  queue: {
    dailyGoal: queue.dailyGoal,
    dueCount: queue.dueCount,
    newCount: queue.newCount,
    reinforcementCount: queue.reinforcementCount,
    items: queueItems,
  },
  ```
  to:
  ```typescript
  queue: {
    dueCount: queue.dueCount,
    newCount: queue.newCount,
    reinforcementCount: queue.reinforcementCount,
    items: queueItems,
  },
  ```

- [ ] **Step 3: Remove `dailyGoal` from the queue fixture in `app-shell-service.test.ts`**

  Find all occurrences of `dailyGoal` inside `queue:` objects in the test file and remove them. They look like:

  ```typescript
  queue: {
    dailyGoal: 4,       // remove this line
    dueCount: 0,
    newCount: 0,
    reinforcementCount: 0,
  },
  ```

- [ ] **Step 4: Remove `dailyGoal` from the queue fixture in `popup-shell.test.tsx`**

  Locate `shellData.queue` and remove the `dailyGoal` line:

  ```typescript
  queue: {
    dailyGoal: 4,       // remove this line
    dueCount: 1,
    newCount: 1,
    reinforcementCount: 0,
    items: [...],
  },
  ```

- [ ] **Step 5: Run typecheck and all affected tests**

  ```bash
  npm run typecheck && npx vitest run src/features/app-shell src/app/popup
  ```

  Expected: no type errors, all tests pass.

- [ ] **Step 6: Commit**

  ```bash
  git add src/features/app-shell/server/app-shell-service.ts src/features/app-shell/api/app-shell-contracts.ts src/features/app-shell/server/app-shell-service.test.ts src/app/popup/popup-shell.test.tsx
  git commit -m "refactor(app-shell): drop queue dailyGoal, read topRecommendation from queue domain"
  ```

---

### Task 5: Full check

- [ ] **Step 1: Run the full check**

  ```bash
  npm run check
  ```

  Expected: all lint, typecheck, and tests pass.

- [ ] **Step 2: Commit if any lint autofixes were applied**

  If `npm run check` applied formatting changes:

  ```bash
  git add -p
  git commit -m "chore: lint fixes after queue categories implementation"
  ```
