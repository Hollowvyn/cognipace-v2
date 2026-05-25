# Dashboard Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Dashboard Overview MVP as the main "what should I practice now?" surface.

**Architecture:** Keep `src/app/dashboard/screens/overview-page.tsx` thin, matching Tracks/Library/Settings. Put the real screen, view mapping, and cross-feature read composition in `features/app-shell`; keep queue rules in `features/queue`, track rules in `features/tracks`, and daily progress/streak rules in `features/practice`.

**Tech Stack:** WXT Chrome MV3, React 19, TypeScript, TanStack Query, TanStack Router, Zod, Drizzle, Vitest, React Testing Library, Tailwind tokens.

---

## File Structure

Create:

- `src/features/practice/domain/practice-progress.ts`  
  Pure daily-progress rules: unique practiced problems per local day, completed-today count, and goal-qualified streak.
- `src/features/practice/domain/practice-progress.test.ts`  
  Unit tests for unique problem counting, failed/Again counting, duplicate attempt handling, and streak behavior.
- `src/features/app-shell/domain/dashboard-overview.ts`  
  Pure mapper from `DashboardAppShellData` into Overview view props.
- `src/features/app-shell/domain/dashboard-overview.test.ts`  
  Mapper tests for recommendation, queue-clear fallback, active track, queue preview, and metric labels.
- `src/features/app-shell/components/overview-screen.tsx`  
  Query-owning feature screen with loading, error, and loaded states.
- `src/features/app-shell/components/overview/overview-panels.tsx`  
  Presentational Overview panels for recommendation, metrics, active track, and queue preview.
- `src/features/app-shell/components/overview-screen.test.tsx`  
  Component tests for populated, queue-clear, empty, loading, error, and action states.
- `src/testing/app-shell-fixtures.ts`  
  Shared dashboard app-shell fixtures for component and route tests.

Modify:

- `src/features/practice/domain/index.ts`  
  Export practice-progress types/functions.
- `src/features/practice/data/practice-repository.ts`  
  Add a read method that maps `review_attempts` rows into the pure progress summary.
- `src/features/practice/server/practice-service.ts`  
  Expose `getPracticeProgressSummary`.
- `src/features/practice/index.ts`  
  Export progress summary types/functions through the public feature boundary.
- `src/features/app-shell/api/app-shell-contracts.ts`  
  Add Zod-validated dashboard `overview.practiceProgress` and `overview.queuePreview`.
- `src/features/app-shell/api/app-shell-api.test.ts`  
  Cover existing dashboard query behavior when the payload grows.
- `src/features/app-shell/server/app-shell-service.ts`  
  Compose practice progress into the dashboard payload through the practice service.
- `src/features/app-shell/server/app-shell-service.test.ts`  
  Cover dashboard overview payload composition.
- `src/features/app-shell/index.ts`  
  Export `OverviewScreen`.
- `src/app/dashboard/screens/overview-page.tsx`  
  Replace the temporary Overview route with thin route composition.
- `src/app/dashboard/routes.test.tsx`  
  Update `/` route expectation for real Overview content and mock `app.getShellData`.

Do not modify:

- Chrome permissions.
- Database schema or migrations.
- Analytics route.
- Tracks/Library/Settings visual polish beyond imported shared primitives.

---

### Task 1: Practice Progress Domain

**Files:**

- Create: `src/features/practice/domain/practice-progress.ts`
- Create: `src/features/practice/domain/practice-progress.test.ts`
- Modify: `src/features/practice/domain/index.ts`

- [ ] **Step 1: Write the failing domain tests**

Create `src/features/practice/domain/practice-progress.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import {
  buildPracticeProgressSummary,
  toPracticeDateKey,
  type PracticeProgressAttempt,
} from './practice-progress'

const now = new Date('2026-05-25T16:30:00.000Z')

describe('buildPracticeProgressSummary', () => {
  it('counts unique practiced problems for the current local day', () => {
    const summary = buildPracticeProgressSummary(
      [
        attempt('two-sum', '2026-05-25T10:00:00.000Z'),
        attempt('two-sum', '2026-05-25T11:00:00.000Z'),
        attempt('valid-parentheses', '2026-05-25T12:00:00.000Z'),
      ],
      { dailyGoal: 4, now },
    )

    expect(summary).toMatchObject({
      completedToday: 2,
      dailyGoal: 4,
      goalMetToday: false,
      todayDateKey: toPracticeDateKey(now),
    })
  })

  it('counts every saved result rating because effort matters', () => {
    const summary = buildPracticeProgressSummary(
      [
        attempt('add-binary', '2026-05-25T10:00:00.000Z'),
        attempt('jump-game-iv', '2026-05-25T12:00:00.000Z'),
      ],
      { dailyGoal: 2, now },
    )

    expect(summary.completedToday).toBe(2)
    expect(summary.goalMetToday).toBe(true)
    expect(summary.currentStreak).toBe(1)
  })

  it('counts a streak only across consecutive days that meet the daily goal', () => {
    const summary = buildPracticeProgressSummary(
      [
        attempt('today-a', '2026-05-25T10:00:00.000Z'),
        attempt('today-b', '2026-05-25T11:00:00.000Z'),
        attempt('yesterday-a', '2026-05-24T10:00:00.000Z'),
        attempt('yesterday-b', '2026-05-24T11:00:00.000Z'),
        attempt('old-a', '2026-05-22T10:00:00.000Z'),
        attempt('old-b', '2026-05-22T11:00:00.000Z'),
      ],
      { dailyGoal: 2, now },
    )

    expect(summary.currentStreak).toBe(2)
  })

  it('does not preserve the current streak before today meets the goal', () => {
    const summary = buildPracticeProgressSummary(
      [
        attempt('today-a', '2026-05-25T10:00:00.000Z'),
        attempt('yesterday-a', '2026-05-24T10:00:00.000Z'),
        attempt('yesterday-b', '2026-05-24T11:00:00.000Z'),
      ],
      { dailyGoal: 2, now },
    )

    expect(summary.completedToday).toBe(1)
    expect(summary.goalMetToday).toBe(false)
    expect(summary.currentStreak).toBe(0)
  })

  it('handles a disabled daily goal without divide-by-zero behavior', () => {
    const summary = buildPracticeProgressSummary(
      [attempt('two-sum', '2026-05-25T10:00:00.000Z')],
      { dailyGoal: 0, now },
    )

    expect(summary).toMatchObject({
      completedToday: 1,
      dailyGoal: 0,
      goalMetToday: false,
      currentStreak: 0,
    })
  })
})

function attempt(
  problemSlug: string,
  reviewedAt: string,
): PracticeProgressAttempt {
  return {
    problemSlug,
    reviewedAt: new Date(reviewedAt),
  }
}
```

- [ ] **Step 2: Run the failing tests**

Run:

```sh
npm run test -- src/features/practice/domain/practice-progress.test.ts
```

Expected: fail because `practice-progress.ts` does not exist.

- [ ] **Step 3: Implement the pure practice progress module**

Create `src/features/practice/domain/practice-progress.ts`:

```ts
export interface PracticeProgressAttempt {
  problemSlug: string
  reviewedAt: Date
}

export interface PracticeProgressSummaryInput {
  dailyGoal: number
  now?: Date | undefined
}

export interface PracticeProgressSummary {
  completedToday: number
  dailyGoal: number
  currentStreak: number
  goalMetToday: boolean
  todayDateKey: string
}

export function buildPracticeProgressSummary(
  attempts: readonly PracticeProgressAttempt[],
  input: PracticeProgressSummaryInput,
): PracticeProgressSummary {
  const dailyGoal = Math.max(0, Math.round(input.dailyGoal))
  const todayDateKey = toPracticeDateKey(input.now ?? new Date())
  const problemSlugsByDateKey = groupUniqueProblemSlugsByDateKey(attempts)
  const completedToday = readCompletedCount(problemSlugsByDateKey, todayDateKey)
  const goalMetToday = dailyGoal > 0 && completedToday >= dailyGoal

  return {
    completedToday,
    dailyGoal,
    currentStreak: readCurrentStreak({
      dailyGoal,
      problemSlugsByDateKey,
      todayDateKey,
    }),
    goalMetToday,
    todayDateKey,
  }
}

export function toPracticeDateKey(value: Date): string {
  if (Number.isNaN(value.getTime())) {
    return toPracticeDateKey(new Date())
  }

  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function groupUniqueProblemSlugsByDateKey(
  attempts: readonly PracticeProgressAttempt[],
) {
  const problemSlugsByDateKey = new Map<string, Set<string>>()

  for (const attempt of attempts) {
    const dateKey = toPracticeDateKey(attempt.reviewedAt)
    const problemSlugs = problemSlugsByDateKey.get(dateKey) ?? new Set<string>()

    problemSlugs.add(attempt.problemSlug)
    problemSlugsByDateKey.set(dateKey, problemSlugs)
  }

  return problemSlugsByDateKey
}

function readCurrentStreak(input: {
  dailyGoal: number
  problemSlugsByDateKey: ReadonlyMap<string, ReadonlySet<string>>
  todayDateKey: string
}) {
  if (input.dailyGoal <= 0) {
    return 0
  }

  let streak = 0
  let dateKey = input.todayDateKey

  while (
    readCompletedCount(input.problemSlugsByDateKey, dateKey) >= input.dailyGoal
  ) {
    streak += 1
    dateKey = readPreviousDateKey(dateKey)
  }

  return streak
}

function readCompletedCount(
  problemSlugsByDateKey: ReadonlyMap<string, ReadonlySet<string>>,
  dateKey: string,
) {
  return problemSlugsByDateKey.get(dateKey)?.size ?? 0
}

function readPreviousDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1)

  date.setDate(date.getDate() - 1)

  return toPracticeDateKey(date)
}
```

Modify `src/features/practice/domain/index.ts`:

```ts
export {
  buildPracticeProgressSummary,
  toPracticeDateKey,
  type PracticeProgressAttempt,
  type PracticeProgressSummary,
  type PracticeProgressSummaryInput,
} from './practice-progress'
```

Keep the existing exports in that file.

- [ ] **Step 4: Run the domain tests**

Run:

```sh
npm run test -- src/features/practice/domain/practice-progress.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```sh
git add src/features/practice/domain/practice-progress.ts src/features/practice/domain/practice-progress.test.ts src/features/practice/domain/index.ts
git commit -m "feat: add practice progress summary rules"
```

---

### Task 2: Practice Progress Repository And Service

**Files:**

- Modify: `src/features/practice/data/practice-repository.ts`
- Modify: `src/features/practice/server/practice-service.ts`
- Modify: `src/features/practice/index.ts`
- Create: `src/features/practice/server/practice-progress-service.test.ts`

- [ ] **Step 1: Write the failing service tests**

Create `src/features/practice/server/practice-progress-service.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { createTestDb } from '@/platform/db/test-db'

import { createPracticeRepository } from '../data/practice-repository'
import { getPracticeProgressSummary } from './practice-service'

describe('getPracticeProgressSummary', () => {
  it('counts unique problems practiced today through the repository boundary', async () => {
    const handle = await createTestDb()
    const repository = createPracticeRepository(handle.db)
    const now = new Date('2026-05-25T16:30:00.000Z')

    await repository.saveReviewResult({
      problemSlug: 'two-sum',
      rating: 'again',
      reviewedAt: new Date('2026-05-25T10:00:00.000Z'),
      reviewMode: 'manual',
    })
    await repository.saveReviewResult({
      problemSlug: 'two-sum',
      rating: 'good',
      reviewedAt: new Date('2026-05-25T11:00:00.000Z'),
      reviewMode: 'manual',
    })
    await repository.saveReviewResult({
      problemSlug: 'valid-parentheses',
      rating: 'again',
      reviewedAt: new Date('2026-05-25T12:00:00.000Z'),
      reviewMode: 'manual',
    })

    await expect(
      getPracticeProgressSummary(handle.db, {
        dailyGoal: 2,
        now,
      }),
    ).resolves.toMatchObject({
      completedToday: 2,
      currentStreak: 1,
      dailyGoal: 2,
      goalMetToday: true,
    })
  })

  it('requires today to meet the daily goal before reporting the current streak', async () => {
    const handle = await createTestDb()
    const repository = createPracticeRepository(handle.db)
    const now = new Date('2026-05-25T16:30:00.000Z')

    await repository.saveReviewResult({
      problemSlug: 'two-sum',
      rating: 'good',
      reviewedAt: new Date('2026-05-24T10:00:00.000Z'),
      reviewMode: 'manual',
    })
    await repository.saveReviewResult({
      problemSlug: 'valid-parentheses',
      rating: 'good',
      reviewedAt: new Date('2026-05-24T11:00:00.000Z'),
      reviewMode: 'manual',
    })
    await repository.saveReviewResult({
      problemSlug: 'two-sum',
      rating: 'again',
      reviewedAt: new Date('2026-05-25T12:00:00.000Z'),
      reviewMode: 'manual',
    })

    await expect(
      getPracticeProgressSummary(handle.db, {
        dailyGoal: 2,
        now,
      }),
    ).resolves.toMatchObject({
      completedToday: 1,
      currentStreak: 0,
      dailyGoal: 2,
      goalMetToday: false,
    })
  })
})
```

- [ ] **Step 2: Run the failing service tests**

Run:

```sh
npm run test -- src/features/practice/server/practice-progress-service.test.ts
```

Expected: fail because `getPracticeProgressSummary` is not exported.

- [ ] **Step 3: Add the repository read method**

In `src/features/practice/data/practice-repository.ts`, update the imports:

```ts
import { and, asc, desc, eq } from 'drizzle-orm'
```

Add these imports from `../domain`:

```ts
  buildPracticeProgressSummary,
  type PracticeProgressSummary,
  type PracticeProgressSummaryInput,
```

Add this method inside `PracticeRepository`:

```ts
  async getPracticeProgressSummary(
    input: PracticeProgressSummaryInput,
  ): Promise<PracticeProgressSummary> {
    const rows = await this.db
      .select({
        problemSlug: reviewAttempts.problemSlug,
        reviewedAt: reviewAttempts.reviewedAt,
      })
      .from(reviewAttempts)
      .orderBy(desc(reviewAttempts.reviewedAt))

    return buildPracticeProgressSummary(
      rows.map((row) => ({
        problemSlug: row.problemSlug,
        reviewedAt: new Date(row.reviewedAt),
      })),
      input,
    )
  }
```

- [ ] **Step 4: Add the service export**

In `src/features/practice/server/practice-service.ts`, import the input type:

```ts
  PracticeProgressSummaryInput,
```

Add this function:

```ts
export function getPracticeProgressSummary(
  db: Db,
  input: PracticeProgressSummaryInput,
) {
  return createPracticeRepository(db).getPracticeProgressSummary(input)
}
```

In `src/features/practice/index.ts`, add these exports:

```ts
  buildPracticeProgressSummary,
  toPracticeDateKey,
  type PracticeProgressAttempt,
  type PracticeProgressSummary,
  type PracticeProgressSummaryInput,
```

Keep all existing exports.

- [ ] **Step 5: Run the service tests**

Run:

```sh
npm run test -- src/features/practice/server/practice-progress-service.test.ts
```

Expected: pass.

- [ ] **Step 6: Commit**

```sh
git add src/features/practice/data/practice-repository.ts src/features/practice/server/practice-service.ts src/features/practice/index.ts src/features/practice/server/practice-progress-service.test.ts
git commit -m "feat: expose practice progress summary"
```

---

### Task 3: Dashboard App-Shell Overview Payload

**Files:**

- Modify: `src/features/app-shell/api/app-shell-contracts.ts`
- Modify: `src/features/app-shell/server/app-shell-service.ts`
- Modify: `src/features/app-shell/server/app-shell-service.test.ts`
- Modify: `src/features/app-shell/api/app-shell-api.test.ts`

- [ ] **Step 1: Write failing app-shell service coverage**

Append this test to `src/features/app-shell/server/app-shell-service.test.ts`:

```ts
it('composes dashboard overview progress from unique practiced problems', async () => {
  const handle = await createTestDb({
    now: new Date('2026-01-01T00:00:00.000Z'),
  })
  const practiceRepository = createPracticeRepository(handle.db)

  await createSettingsRepository(handle.db).updateSettings({
    practice: {
      dailyGoal: 2,
    },
  })
  await practiceRepository.saveReviewResult({
    problemSlug: 'two-sum',
    rating: 'again',
    reviewedAt: new Date('2026-01-01T08:00:00.000Z'),
    reviewMode: 'manual',
  })
  await practiceRepository.saveReviewResult({
    problemSlug: 'two-sum',
    rating: 'good',
    reviewedAt: new Date('2026-01-01T09:00:00.000Z'),
    reviewMode: 'manual',
  })
  await practiceRepository.saveReviewResult({
    problemSlug: 'valid-parentheses',
    rating: 'again',
    reviewedAt: new Date('2026-01-01T09:30:00.000Z'),
    reviewMode: 'manual',
  })

  const payload = await getDashboardPayload(handle)

  expect(payload.overview.practiceProgress).toMatchObject({
    completedToday: 2,
    dailyGoal: 2,
    currentStreak: 1,
    goalMetToday: true,
    todayDateKey: '2026-01-01',
  })
})
```

Also update the existing "composes dashboard payload with a larger queue preview"
test to assert the overview preview exists:

```ts
expect(payload.overview.queuePreview).toEqual(payload.dashboard.queuePreview)
```

- [ ] **Step 2: Run the failing app-shell service tests**

Run:

```sh
npm run test -- src/features/app-shell/server/app-shell-service.test.ts
```

Expected: fail because `overview` is not part of the dashboard contract.

- [ ] **Step 3: Extend the Zod contract**

In `src/features/app-shell/api/app-shell-contracts.ts`, add these schemas near
the dashboard data schemas:

```ts
const appShellPracticeProgressSchema = z.object({
  completedToday: z.number().int().min(0),
  dailyGoal: z.number().int().min(0),
  currentStreak: z.number().int().min(0),
  goalMetToday: z.boolean(),
  todayDateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

const dashboardOverviewSchema = z.object({
  practiceProgress: appShellPracticeProgressSchema,
  queuePreview: z.array(appShellQueueItemSchema),
})
```

Update `dashboardAppShellDataSchema`:

```ts
export const dashboardAppShellDataSchema = appShellBaseDataSchema.extend({
  surface: z.literal('dashboard'),
  overview: dashboardOverviewSchema,
  dashboard: z.object({
    queuePreview: z.array(appShellQueueItemSchema),
  }),
})
```

Export the inferred type for implementation code:

```ts
export type DashboardOverviewData = z.infer<typeof dashboardOverviewSchema>
```

- [ ] **Step 4: Compose overview data in the app-shell service**

In `src/features/app-shell/server/app-shell-service.ts`, add:

```ts
import { getPracticeProgressSummary } from '@/features/practice/server/practice-service'
```

Update `getDashboardAppShellData`:

```ts
async function getDashboardAppShellData(db: Db, now: Date) {
  const { baseData, queueItems } = await getMainAppShellData(db, now)
  const queuePreview = queueItems.slice(0, 5)

  return {
    ...baseData,
    surface: 'dashboard',
    overview: {
      practiceProgress: await getPracticeProgressSummary(db, {
        dailyGoal: baseData.settings.practice.dailyGoal,
        now,
      }),
      queuePreview,
    },
    dashboard: { queuePreview },
  } satisfies AppShellData
}
```

Keep popup preview at 3 items. Do not add a refresh timestamp to the UI model.

- [ ] **Step 5: Add an API test assertion for dashboard payload reads**

In `src/features/app-shell/api/app-shell-api.test.ts`, import
`getDashboardAppShellDataViaRuntime` and add:

```ts
it('reads dashboard app-shell data through the dashboard surface request', async () => {
  const payload = { surface: 'dashboard' } as AppShellData
  vi.mocked(sendMessage).mockResolvedValueOnce(payload)

  await expect(getDashboardAppShellDataViaRuntime()).resolves.toBe(payload)
  expect(sendMessage).toHaveBeenCalledWith('app.getShellData', {
    surface: 'dashboard',
  })
})
```

- [ ] **Step 6: Run app-shell tests**

Run:

```sh
npm run test -- src/features/app-shell/server/app-shell-service.test.ts src/features/app-shell/api/app-shell-api.test.ts
```

Expected: pass.

- [ ] **Step 7: Commit**

```sh
git add src/features/app-shell/api/app-shell-contracts.ts src/features/app-shell/server/app-shell-service.ts src/features/app-shell/server/app-shell-service.test.ts src/features/app-shell/api/app-shell-api.test.ts
git commit -m "feat: add dashboard overview app shell payload"
```

---

### Task 4: Dashboard Overview View Mapper And Fixtures

**Files:**

- Create: `src/features/app-shell/domain/dashboard-overview.ts`
- Create: `src/features/app-shell/domain/dashboard-overview.test.ts`
- Create: `src/testing/app-shell-fixtures.ts`
- Modify: `src/features/app-shell/index.ts`

- [ ] **Step 1: Create reusable app-shell fixtures**

Create `src/testing/app-shell-fixtures.ts`:

```ts
import type { DashboardAppShellData } from '@/features/app-shell'
import { createSerializedNormalizedPracticeState } from '@/testing/practice-fixtures'

export function createDashboardAppShellData(
  overrides: Partial<DashboardAppShellData> = {},
): DashboardAppShellData {
  const queueItem = createAppShellQueueItem()

  return {
    surface: 'dashboard',
    generatedAt: '2026-05-25T16:30:00.000Z',
    status: {
      label: 'Practice ready',
      detail: '1 due, 0 new, 0 reinforcement available.',
    },
    metrics: [
      { label: 'Due Today', value: '1' },
      { label: 'Streak', value: '1 day' },
    ],
    recommendation: {
      title: queueItem.problem.title,
      detail: 'Review easy.',
      category: 'due',
      problem: queueItem.problem,
      dueAt: queueItem.state.dueAt,
    },
    activeTrack: {
      state: 'ready',
      trackId: 'bytebytego-coding-patterns-101',
      title: 'ByteByteGo Coding Patterns 101',
      description: "ByteByteGo's coding patterns path.",
      groupTitle: 'Two Pointers',
      dueAt: null,
      progress: {
        completedCount: 1,
        totalCount: 101,
        percent: 1,
      },
      detail: 'Next: Pair Sum - Sorted',
      nextProblem: {
        problemSlug: 'two-sum-ii-input-array-is-sorted',
        title: 'Pair Sum - Sorted',
        difficulty: 'medium',
        isPremium: false,
      },
    },
    queue: {
      dailyGoal: 4,
      dueCount: 1,
      newCount: 0,
      reinforcementCount: 0,
      items: [queueItem],
    },
    settings: {
      practice: {
        dailyGoal: 4,
        mode: 'studyPlan',
        problemFilters: {
          skipPremium: false,
        },
      },
      review: {
        targetRetention: 0.9,
        order: 'dueFirst',
      },
      assessment: {
        requireSolveTime: false,
        strictTiming: false,
        timeTargetsMinutes: {
          easy: 20,
          medium: 35,
          hard: 50,
        },
      },
    },
    overview: {
      practiceProgress: {
        completedToday: 1,
        dailyGoal: 4,
        currentStreak: 0,
        goalMetToday: false,
        todayDateKey: '2026-05-25',
      },
      queuePreview: [queueItem],
    },
    dashboard: {
      queuePreview: [queueItem],
    },
    ...overrides,
  }
}

export function createAppShellQueueItem(
  overrides: Partial<DashboardAppShellData['queue']['items'][number]> = {},
): DashboardAppShellData['queue']['items'][number] {
  return {
    category: 'due',
    problem: {
      problemSlug: 'add-binary',
      title: 'Add Binary',
      difficulty: 'easy',
      isPremium: false,
    },
    state: createSerializedNormalizedPracticeState({
      problemSlug: 'add-binary',
      cardId: 'add-binary:default',
      status: 'review',
      phase: 'review',
      isStarted: true,
      isDue: true,
      isOverdue: true,
      overdueDays: 7,
      dueAt: '2026-05-18T00:00:00.000Z',
      lastReviewedAt: '2026-05-01T00:00:00.000Z',
      retrievability: 0.45,
      stability: 3,
      difficulty: 5,
      scheduledDays: 7,
      lapses: 1,
      reviewCount: 2,
    }),
    ...overrides,
  }
}
```

- [ ] **Step 2: Write failing mapper tests**

Create `src/features/app-shell/domain/dashboard-overview.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import {
  createAppShellQueueItem,
  createDashboardAppShellData,
} from '@/testing/app-shell-fixtures'

import { createDashboardOverviewView } from './dashboard-overview'

describe('createDashboardOverviewView', () => {
  it('maps a due recommendation into the primary review card', () => {
    const view = createDashboardOverviewView(createDashboardAppShellData())

    expect(view.primary).toMatchObject({
      kind: 'problem',
      kicker: 'Review Now',
      title: 'Add Binary',
      categoryLabel: 'Due',
      isOverdue: true,
      actionLabel: 'Open Problem',
    })
    expect(view.metrics).toEqual([
      {
        label: 'Due',
        value: '1',
        caption: 'Problems ready for review.',
      },
      {
        label: 'Completed Today',
        value: '1/4',
        caption: 'Unique problems practiced.',
      },
      {
        label: 'Streak',
        value: '0',
        caption: 'Goal-qualified days.',
      },
    ])
  })

  it('keeps queue clear separate from active-track next problem', () => {
    const view = createDashboardOverviewView(
      createDashboardAppShellData({
        recommendation: {
          title: 'Queue is clear',
          detail: 'No due reviews or extra practice are queued right now.',
          category: null,
          problem: null,
          dueAt: null,
        },
        queue: {
          dailyGoal: 4,
          dueCount: 0,
          newCount: 0,
          reinforcementCount: 0,
          items: [],
        },
        overview: {
          practiceProgress: {
            completedToday: 4,
            dailyGoal: 4,
            currentStreak: 3,
            goalMetToday: true,
            todayDateKey: '2026-05-25',
          },
          queuePreview: [],
        },
        dashboard: {
          queuePreview: [],
        },
      }),
    )

    expect(view.primary).toMatchObject({
      kind: 'queue-clear',
      title: 'Queue Clear',
      actionLabel: 'Open Library',
    })
    expect(view.activeTrack.nextProblem?.title).toBe('Pair Sum - Sorted')
    expect(view.queuePreview).toEqual([])
  })

  it('limits the queue preview to five rows', () => {
    const queuePreview = Array.from({ length: 6 }, (_, index) =>
      createAppShellQueueItem({
        problem: {
          problemSlug: `problem-${index + 1}`,
          title: `Problem ${index + 1}`,
          difficulty: 'easy',
          isPremium: false,
        },
      }),
    )
    const view = createDashboardOverviewView(
      createDashboardAppShellData({
        overview: {
          practiceProgress: {
            completedToday: 0,
            dailyGoal: 4,
            currentStreak: 0,
            goalMetToday: false,
            todayDateKey: '2026-05-25',
          },
          queuePreview,
        },
      }),
    )

    expect(view.queuePreview.map((item) => item.problem.title)).toEqual([
      'Problem 1',
      'Problem 2',
      'Problem 3',
      'Problem 4',
      'Problem 5',
    ])
  })
})
```

- [ ] **Step 3: Run the failing mapper tests**

Run:

```sh
npm run test -- src/features/app-shell/domain/dashboard-overview.test.ts
```

Expected: fail because `dashboard-overview.ts` does not exist.

- [ ] **Step 4: Implement the mapper**

Create `src/features/app-shell/domain/dashboard-overview.ts`:

```ts
import type {
  AppShellQueueItem,
  DashboardAppShellData,
} from '../api/app-shell-contracts'

export interface DashboardOverviewMetricView {
  label: string
  value: string
  caption: string
}

export type DashboardOverviewPrimaryView =
  | {
      kind: 'problem'
      kicker: 'Review Now'
      title: string
      detail: string
      actionLabel: 'Open Problem'
      categoryLabel: string
      dueAt: string | null
      isOverdue: boolean
      problem: NonNullable<DashboardAppShellData['recommendation']['problem']>
    }
  | {
      kind: 'queue-clear'
      kicker: 'Review Now'
      title: 'Queue Clear'
      detail: string
      actionLabel: 'Open Library'
    }

export interface DashboardOverviewView {
  primary: DashboardOverviewPrimaryView
  metrics: DashboardOverviewMetricView[]
  activeTrack: DashboardAppShellData['activeTrack']
  queuePreview: AppShellQueueItem[]
}

export function createDashboardOverviewView(
  data: DashboardAppShellData,
): DashboardOverviewView {
  return {
    primary: createPrimaryView(data),
    metrics: createMetricViews(data),
    activeTrack: data.activeTrack,
    queuePreview: data.overview.queuePreview.slice(0, 5),
  }
}

function createPrimaryView(
  data: DashboardAppShellData,
): DashboardOverviewPrimaryView {
  const problem = data.recommendation.problem

  if (!problem) {
    return {
      kind: 'queue-clear',
      kicker: 'Review Now',
      title: 'Queue Clear',
      detail:
        'No review pressure is waiting. Browse the Library when you want extra practice.',
      actionLabel: 'Open Library',
    }
  }

  const queueItem = data.queue.items.find(
    (item) => item.problem.problemSlug === problem.problemSlug,
  )

  return {
    kind: 'problem',
    kicker: 'Review Now',
    title: problem.title,
    detail: data.recommendation.detail,
    actionLabel: 'Open Problem',
    categoryLabel: readCategoryLabel(data.recommendation.category),
    dueAt: data.recommendation.dueAt,
    isOverdue: queueItem?.state.isOverdue ?? false,
    problem,
  }
}

function createMetricViews(
  data: DashboardAppShellData,
): DashboardOverviewMetricView[] {
  const progress = data.overview.practiceProgress

  return [
    {
      label: 'Due',
      value: String(data.queue.dueCount),
      caption: 'Problems ready for review.',
    },
    {
      label: 'Completed Today',
      value:
        progress.dailyGoal > 0
          ? `${progress.completedToday}/${progress.dailyGoal}`
          : String(progress.completedToday),
      caption:
        progress.dailyGoal > 0
          ? 'Unique problems practiced.'
          : 'Daily goal is disabled.',
    },
    {
      label: 'Streak',
      value: String(progress.currentStreak),
      caption: 'Goal-qualified days.',
    },
  ]
}

function readCategoryLabel(
  category: DashboardAppShellData['recommendation']['category'],
) {
  switch (category) {
    case 'due':
      return 'Due'
    case 'new':
      return 'New'
    case 'reinforcement':
      return 'Extra Practice'
    case null:
      return 'Review'
  }
}
```

Update `src/features/app-shell/index.ts`:

```ts
export {
  createDashboardOverviewView,
  type DashboardOverviewMetricView,
  type DashboardOverviewPrimaryView,
  type DashboardOverviewView,
} from './domain/dashboard-overview'
```

Keep existing exports.

- [ ] **Step 5: Run mapper tests**

Run:

```sh
npm run test -- src/features/app-shell/domain/dashboard-overview.test.ts
```

Expected: pass.

- [ ] **Step 6: Commit**

```sh
git add src/features/app-shell/domain/dashboard-overview.ts src/features/app-shell/domain/dashboard-overview.test.ts src/testing/app-shell-fixtures.ts src/features/app-shell/index.ts
git commit -m "feat: map dashboard overview view state"
```

---

### Task 5: Overview Feature Screen And Component Tests

**Files:**

- Create: `src/features/app-shell/components/overview-screen.tsx`
- Create: `src/features/app-shell/components/overview/overview-panels.tsx`
- Create: `src/features/app-shell/components/overview-screen.test.tsx`
- Modify: `src/features/app-shell/index.ts`

- [ ] **Step 1: Write failing component tests**

Create `src/features/app-shell/components/overview-screen.test.tsx`:

```tsx
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, afterEach } from 'vitest'

import { sendMessage } from '@/extension/messaging'
import {
  createDashboardAppShellData,
  createAppShellQueueItem,
} from '@/testing/app-shell-fixtures'
import { createQueryTestHarness } from '@/testing/query-test-harness'

import { OverviewScreen } from './overview-screen'

vi.mock('@/extension/messaging', () => ({
  sendMessage: vi.fn(),
}))

describe('OverviewScreen', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders the populated due-review state', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce(createDashboardAppShellData())

    renderOverview()

    expect(
      await screen.findByRole('heading', { name: 'Add Binary' }),
    ).toBeVisible()
    expect(screen.getByText('Due')).toBeVisible()
    expect(screen.getByText('Overdue')).toBeVisible()
    expect(screen.getByText('Easy')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Open Problem' })).toHaveAttribute(
      'href',
      'https://leetcode.com/problems/add-binary/',
    )
    expect(screen.getByText('Completed Today')).toBeVisible()
    expect(screen.getByText('1/4')).toBeVisible()
  })

  it('renders queue clear with a Library CTA instead of forcing track next', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce(
      createDashboardAppShellData({
        recommendation: {
          title: 'Queue is clear',
          detail: 'No due reviews or extra practice are queued right now.',
          category: null,
          problem: null,
          dueAt: null,
        },
        queue: {
          dailyGoal: 4,
          dueCount: 0,
          newCount: 0,
          reinforcementCount: 0,
          items: [],
        },
        overview: {
          practiceProgress: {
            completedToday: 0,
            dailyGoal: 4,
            currentStreak: 0,
            goalMetToday: false,
            todayDateKey: '2026-05-25',
          },
          queuePreview: [],
        },
        dashboard: {
          queuePreview: [],
        },
      }),
    )

    renderOverview()

    expect(
      await screen.findByRole('heading', { name: 'Queue Clear' }),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: 'Open Library' })).toHaveAttribute(
      'href',
      '#/library',
    )
    expect(screen.getByText('Pair Sum - Sorted')).toBeVisible()
  })

  it('renders active track and queue preview actions', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce(
      createDashboardAppShellData({
        overview: {
          practiceProgress: {
            completedToday: 2,
            dailyGoal: 4,
            currentStreak: 0,
            goalMetToday: false,
            todayDateKey: '2026-05-25',
          },
          queuePreview: [
            createAppShellQueueItem(),
            createAppShellQueueItem({
              category: 'reinforcement',
              problem: {
                problemSlug: 'jump-game-iv',
                title: 'Jump Game IV',
                difficulty: 'hard',
                isPremium: false,
              },
            }),
          ],
        },
      }),
    )

    renderOverview()

    expect(
      await screen.findByRole('heading', {
        name: 'ByteByteGo Coding Patterns 101',
      }),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: 'Continue Path' })).toHaveAttribute(
      'href',
      'https://leetcode.com/problems/two-sum-ii-input-array-is-sorted/',
    )
    const queue = screen.getByRole('region', { name: 'Today Queue' })

    expect(within(queue).getByText('Jump Game IV')).toBeVisible()
    expect(
      within(queue).getByRole('link', { name: 'Open Jump Game IV' }),
    ).toHaveAttribute('href', 'https://leetcode.com/problems/jump-game-iv/')
  })

  it('renders the empty new-user state', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce(
      createDashboardAppShellData({
        recommendation: {
          title: 'Queue is clear',
          detail: 'No due reviews or extra practice are queued right now.',
          category: null,
          problem: null,
          dueAt: null,
        },
        activeTrack: {
          state: 'no-active-track',
          trackId: null,
          title: 'No active track',
          description: null,
          groupTitle: null,
          dueAt: null,
          progress: {
            completedCount: 0,
            totalCount: 0,
            percent: 0,
          },
          detail: 'Choose a track to restore guided progression.',
          nextProblem: null,
        },
        queue: {
          dailyGoal: 4,
          dueCount: 0,
          newCount: 0,
          reinforcementCount: 0,
          items: [],
        },
        overview: {
          practiceProgress: {
            completedToday: 0,
            dailyGoal: 4,
            currentStreak: 0,
            goalMetToday: false,
            todayDateKey: '2026-05-25',
          },
          queuePreview: [],
        },
        dashboard: {
          queuePreview: [],
        },
      }),
    )

    renderOverview()

    expect(
      await screen.findByRole('heading', { name: 'Queue Clear' }),
    ).toBeVisible()
    expect(screen.getByText('No active track')).toBeVisible()
    expect(
      screen.getByText("No items are waiting in today's queue."),
    ).toBeVisible()
  })

  it('renders loading and error states with retry', async () => {
    vi.mocked(sendMessage).mockRejectedValueOnce(new Error('shell failed'))
    const user = userEvent.setup()

    renderOverview()

    expect(screen.getByText('Loading overview...')).toBeVisible()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Failed to load Overview.',
    )

    vi.mocked(sendMessage).mockResolvedValueOnce(createDashboardAppShellData())
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Add Binary' })).toBeVisible()
    })
  })
})

function renderOverview() {
  const { wrapper } = createQueryTestHarness()

  render(
    <OverviewScreen
      libraryAction={<a href="#/library">Open Library</a>}
      tracksAction={<a href="#/tracks">Open Tracks</a>}
    />,
    { wrapper },
  )
}
```

- [ ] **Step 2: Run the failing component tests**

Run:

```sh
npm run test -- src/features/app-shell/components/overview-screen.test.tsx
```

Expected: fail because `overview-screen.tsx` does not exist.

- [ ] **Step 3: Implement presentational panels**

Create `src/features/app-shell/components/overview/overview-panels.tsx`:

```tsx
import { ExternalLink } from 'lucide-react'
import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { InlineStatus } from '@/components/ui/inline-status'
import { Surface } from '@/components/ui/surface'
import { ProblemDifficultyBadge } from '@/features/problems'
import { createLeetCodeProblemUrl } from '@/lib/leetcode'

import type {
  AppShellProblemSummary,
  AppShellQueueItem,
  DashboardAppShellData,
} from '../../api/app-shell-contracts'
import type {
  DashboardOverviewMetricView,
  DashboardOverviewPrimaryView,
} from '../../domain/dashboard-overview'

export function OverviewPrimaryPanel({
  libraryAction,
  primary,
}: {
  libraryAction: ReactNode
  primary: DashboardOverviewPrimaryView
}) {
  return (
    <Surface aria-labelledby="overview-primary-title" className="grid gap-4">
      <div className="grid gap-1">
        <p className="m-0 text-[length:var(--cp-kicker-font-size)] font-bold uppercase leading-none text-muted-foreground">
          {primary.kicker}
        </p>
        <h2
          className="m-0 text-[length:var(--cp-title-font-size)] font-bold leading-tight text-foreground"
          id="overview-primary-title"
        >
          {primary.title}
        </h2>
      </div>
      <p className="m-0 text-[length:var(--cp-copy-font-size)] leading-relaxed text-muted-foreground">
        {primary.detail}
      </p>
      {primary.kind === 'problem' ? (
        <>
          <ProblemBadges
            categoryLabel={primary.categoryLabel}
            isOverdue={primary.isOverdue}
            problem={primary.problem}
          />
          <Button asChild>
            <a
              href={createLeetCodeProblemUrl(primary.problem.problemSlug)}
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink aria-hidden="true" />
              {primary.actionLabel}
            </a>
          </Button>
        </>
      ) : (
        <Button asChild>{libraryAction}</Button>
      )}
    </Surface>
  )
}

export function OverviewMetrics({
  metrics,
}: {
  metrics: readonly DashboardOverviewMetricView[]
}) {
  return (
    <section
      aria-label="Practice metrics"
      className="grid min-w-0 gap-3 md:grid-cols-3"
    >
      {metrics.map((metric) => (
        <Surface className="grid gap-1" key={metric.label}>
          <p className="m-0 text-[length:var(--cp-kicker-font-size)] font-bold uppercase leading-none text-muted-foreground">
            {metric.label}
          </p>
          <div className="text-2xl font-bold leading-none text-foreground tabular-nums">
            {metric.value}
          </div>
          <p className="m-0 text-[length:var(--cp-copy-font-size)] leading-snug text-muted-foreground">
            {metric.caption}
          </p>
        </Surface>
      ))}
    </section>
  )
}

export function OverviewActiveTrackPanel({
  activeTrack,
  tracksAction,
}: {
  activeTrack: DashboardAppShellData['activeTrack']
  tracksAction: ReactNode
}) {
  const nextProblem = activeTrack.nextProblem

  return (
    <Surface
      aria-labelledby="overview-active-track-title"
      className="grid gap-4"
    >
      <div className="grid gap-1">
        <p className="m-0 text-[length:var(--cp-kicker-font-size)] font-bold uppercase leading-none text-muted-foreground">
          Active Track
        </p>
        <h2
          className="m-0 text-[length:var(--cp-title-font-size)] font-bold leading-tight text-foreground"
          id="overview-active-track-title"
        >
          {activeTrack.title}
        </h2>
        <p className="m-0 text-[length:var(--cp-copy-font-size)] leading-relaxed text-muted-foreground">
          {activeTrack.description ?? activeTrack.detail}
        </p>
      </div>
      {activeTrack.trackId ? (
        <TrackProgress progress={activeTrack.progress} />
      ) : null}
      {activeTrack.groupTitle ? (
        <Badge className="w-fit" tone="neutral" variant="outline">
          {activeTrack.groupTitle}
        </Badge>
      ) : null}
      {nextProblem ? (
        <div className="grid gap-3 rounded-[var(--cp-radius-md)] border border-border bg-muted p-3">
          <div className="min-w-0">
            <p className="m-0 text-[length:var(--cp-kicker-font-size)] font-bold uppercase leading-none text-muted-foreground">
              Next Problem
            </p>
            <p className="m-0 mt-2 truncate text-[length:var(--cp-copy-font-size)] font-bold text-foreground">
              {nextProblem.title}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <a
                href={createLeetCodeProblemUrl(nextProblem.problemSlug)}
                rel="noreferrer"
                target="_blank"
              >
                <ExternalLink aria-hidden="true" />
                Continue Path
              </a>
            </Button>
            <Button asChild size="sm" variant="outline">
              {tracksAction}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            {tracksAction}
          </Button>
        </div>
      )}
    </Surface>
  )
}

export function OverviewQueuePreview({
  items,
}: {
  items: readonly AppShellQueueItem[]
}) {
  return (
    <Surface
      aria-labelledby="overview-queue-title"
      aria-label="Today Queue"
      className="grid gap-3"
      role="region"
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 text-[length:var(--cp-kicker-font-size)] font-bold uppercase leading-none text-muted-foreground">
            Today Queue
          </p>
          <h2
            className="m-0 mt-1 text-[length:var(--cp-title-font-size)] font-bold leading-tight text-foreground"
            id="overview-queue-title"
          >
            Live Intake
          </h2>
        </div>
        <Badge tone="neutral" variant="outline">
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </Badge>
      </div>
      {items.length === 0 ? (
        <InlineStatus>No items are waiting in today's queue.</InlineStatus>
      ) : (
        <div className="grid gap-2">
          {items.map((item) => (
            <QueuePreviewRow item={item} key={item.problem.problemSlug} />
          ))}
        </div>
      )}
    </Surface>
  )
}

function ProblemBadges({
  categoryLabel,
  isOverdue,
  problem,
}: {
  categoryLabel: string
  isOverdue: boolean
  problem: AppShellProblemSummary
}) {
  return (
    <div className="flex min-w-0 flex-wrap gap-1.5">
      <Badge tone="warning">{categoryLabel}</Badge>
      <ProblemDifficultyBadge difficulty={problem.difficulty} />
      {isOverdue ? <Badge tone="danger">Overdue</Badge> : null}
    </div>
  )
}

function TrackProgress({
  progress,
}: {
  progress: DashboardAppShellData['activeTrack']['progress']
}) {
  return (
    <div
      aria-label={`${progress.percent}% complete`}
      className="grid gap-2"
      role="img"
    >
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
      <p className="m-0 text-[length:var(--cp-copy-font-size)] text-muted-foreground tabular-nums">
        {progress.completedCount}/{progress.totalCount} complete
      </p>
    </div>
  )
}

function QueuePreviewRow({ item }: { item: AppShellQueueItem }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-[var(--cp-radius-md)] border border-border bg-background px-3 py-2">
      <div className="min-w-0">
        <p className="m-0 truncate text-[length:var(--cp-copy-font-size)] font-bold text-foreground">
          {item.problem.title}
        </p>
        <p className="m-0 mt-1 text-[length:var(--cp-badge-font-size)] font-semibold uppercase text-muted-foreground">
          {readQueueCategoryLabel(item.category)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <ProblemDifficultyBadge difficulty={item.problem.difficulty} />
        <Button asChild size="sm" variant="outline">
          <a
            aria-label={`Open ${item.problem.title}`}
            href={createLeetCodeProblemUrl(item.problem.problemSlug)}
            rel="noreferrer"
            target="_blank"
          >
            Open
          </a>
        </Button>
      </div>
    </div>
  )
}

function readQueueCategoryLabel(category: AppShellQueueItem['category']) {
  switch (category) {
    case 'due':
      return 'Due'
    case 'new':
      return 'New'
    case 'reinforcement':
      return 'Extra Practice'
  }
}
```

- [ ] **Step 4: Implement the query-owning screen**

Create `src/features/app-shell/components/overview-screen.tsx`:

```tsx
import { RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { InlineStatus } from '@/components/ui/inline-status'
import { Surface } from '@/components/ui/surface'

import { useDashboardAppShellData } from '../api/app-shell-api'
import { createDashboardOverviewView } from '../domain/dashboard-overview'
import {
  OverviewActiveTrackPanel,
  OverviewMetrics,
  OverviewPrimaryPanel,
  OverviewQueuePreview,
} from './overview/overview-panels'

export interface OverviewScreenProps {
  libraryAction: ReactNode
  tracksAction: ReactNode
}

export function OverviewScreen({
  libraryAction,
  tracksAction,
}: OverviewScreenProps) {
  const overviewQuery = useDashboardAppShellData()

  if (overviewQuery.isPending) {
    return (
      <Surface className="w-full">
        <InlineStatus>Loading overview...</InlineStatus>
      </Surface>
    )
  }

  if (overviewQuery.isError || !overviewQuery.data) {
    return (
      <Surface className="grid w-full gap-3">
        <InlineStatus role="alert" tone="danger">
          Failed to load Overview.
        </InlineStatus>
        <div>
          <Button
            onClick={() => {
              void overviewQuery.refetch()
            }}
            size="sm"
            variant="outline"
          >
            <RefreshCw aria-hidden="true" />
            Retry
          </Button>
        </div>
      </Surface>
    )
  }

  const view = createDashboardOverviewView(overviewQuery.data)

  return (
    <div className="grid min-w-0 gap-[var(--cp-surface-gap)]">
      <OverviewPrimaryPanel
        libraryAction={libraryAction}
        primary={view.primary}
      />
      <OverviewMetrics metrics={view.metrics} />
      <OverviewActiveTrackPanel
        activeTrack={view.activeTrack}
        tracksAction={tracksAction}
      />
      <OverviewQueuePreview items={view.queuePreview} />
    </div>
  )
}
```

Update `src/features/app-shell/index.ts`:

```ts
export { OverviewScreen } from './components/overview-screen'
```

- [ ] **Step 5: Run component tests**

Run:

```sh
npm run test -- src/features/app-shell/components/overview-screen.test.tsx
```

Expected: pass.

- [ ] **Step 6: Commit**

```sh
git add src/features/app-shell/components/overview-screen.tsx src/features/app-shell/components/overview/overview-panels.tsx src/features/app-shell/components/overview-screen.test.tsx src/features/app-shell/index.ts
git commit -m "feat: build dashboard overview screen"
```

---

### Task 6: Route Integration

**Files:**

- Modify: `src/app/dashboard/screens/overview-page.tsx`
- Modify: `src/app/dashboard/routes.test.tsx`

- [ ] **Step 1: Update route tests to mock Overview data**

In `src/app/dashboard/routes.test.tsx`, import the fixture:

```ts
import { createDashboardAppShellData } from '@/testing/app-shell-fixtures'
```

In the `beforeEach` `sendMessage` mock, add this branch before the default
settings response:

```ts
if (method === 'app.getShellData') {
  return Promise.resolve(createDashboardAppShellData())
}
```

Update the top-level route table row for `/`:

```ts
    ['/', 'Overview', 'What should I practice now'],
```

Add this route-specific test:

```ts
it('renders the real Overview route with Library and Tracks navigation', async () => {
  renderDashboard('/')

  expect(await screen.findByRole('heading', { name: 'Overview' })).toBeVisible()
  expect(screen.getByRole('heading', { name: 'Add Binary' })).toBeVisible()
  expect(screen.getByRole('link', { name: 'Open Library' })).toBeVisible()
  expect(screen.getByRole('link', { name: 'Open Tracks' })).toBeVisible()
})
```

- [ ] **Step 2: Run failing route tests**

Run:

```sh
npm run test -- src/app/dashboard/routes.test.tsx
```

Expected: fail because `OverviewPage` still renders the temporary route copy.

- [ ] **Step 3: Replace the temporary route**

Replace `src/app/dashboard/screens/overview-page.tsx` with:

```tsx
import { Link } from '@tanstack/react-router'
import { BookOpen, Map } from 'lucide-react'

import {
  DashboardPage,
  DashboardPageBody,
  DashboardPageHeader,
} from '@/app/dashboard/layout/dashboard-page'
import {
  dashboardPaths,
  dashboardRouteMeta,
} from '@/app/dashboard/navigation/route-manifest'
import { Button } from '@/components/ui/button'
import { OverviewScreen } from '@/features/app-shell'

export function OverviewPage() {
  return (
    <DashboardPage className="mx-auto w-full max-w-[64rem]">
      <DashboardPageHeader title={dashboardRouteMeta.overview.staticData.title}>
        What should I practice now?
      </DashboardPageHeader>
      <DashboardPageBody>
        <OverviewScreen
          libraryAction={
            <Link to={dashboardPaths.library}>
              <BookOpen aria-hidden="true" />
              Open Library
            </Link>
          }
          tracksAction={
            <Link to={dashboardPaths.tracks}>
              <Map aria-hidden="true" />
              Open Tracks
            </Link>
          }
        />
      </DashboardPageBody>
    </DashboardPage>
  )
}
```

- [ ] **Step 4: Run route tests**

Run:

```sh
npm run test -- src/app/dashboard/routes.test.tsx
```

Expected: pass.

- [ ] **Step 5: Commit**

```sh
git add src/app/dashboard/screens/overview-page.tsx src/app/dashboard/routes.test.tsx
git commit -m "feat: wire dashboard overview route"
```

---

### Task 7: Focused Validation And Full Check

**Files:**

- No source files are expected to change in this task.

- [ ] **Step 1: Run focused Overview and service tests**

Run:

```sh
npm run test -- src/features/practice/domain/practice-progress.test.ts src/features/practice/server/practice-progress-service.test.ts src/features/app-shell/server/app-shell-service.test.ts src/features/app-shell/domain/dashboard-overview.test.ts src/features/app-shell/components/overview-screen.test.tsx src/app/dashboard/routes.test.tsx
```

Expected: pass.

- [ ] **Step 2: Run full project verification**

Run:

```sh
npm run check
```

Expected: pass.

- [ ] **Step 3: Run formatting check**

Run:

```sh
npm run format
```

Expected: pass.

- [ ] **Step 4: Inspect git status**

Run:

```sh
git status --short
```

Expected: no unstaged implementation changes.

- [ ] **Step 5: Final implementation summary**

Report:

- practice progress summary behavior
- app-shell Overview payload fields
- Overview route/component behavior
- focused tests run
- `npm run check` result
- `npm run format` result

Do not claim validation that did not run.
