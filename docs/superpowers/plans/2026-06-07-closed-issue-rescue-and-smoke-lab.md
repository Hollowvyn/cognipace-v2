# Closed Issue Rescue and Smoke Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit and repair issues #1-6 and #11-17, enable live GenAI provider
calls with approved narrow host permissions, and add a dev-only smoke lab that
proves analytics, queue, notifications, and GenAI behavior from the real
extension runtime.

**Architecture:** Preserve the existing feature boundaries and dependency
direction (`entrypoints -> app -> features -> platform/lib/components`). Runtime
handlers in `src/extension/background/register-handlers.ts` remain the
composition point for feature server code; app/dashboard code talks through
typed messaging only. GenAI provider calls stay background-only, secrets stay in
`src/platform/secrets`, and the smoke lab exposes status/redacted diagnostics
without exposing raw keys.

**Tech Stack:** WXT Manifest V3, React, TanStack Router, TanStack Query, Zod,
Drizzle SQLite, Vitest, React Testing Library, `@webext-core/messaging`.

---

## File Map

Create:

- `docs/superpowers/audits/2026-06-07-closed-issues-1-6-11-17.md` - issue
  contract matrix with keep/fix/reopen/defer outcomes.
- `src/features/analytics/components/analytics-memory-profile.tsx` - focused UI
  for the new analytics memory profile section.
- `src/features/dev-smoke/api/dev-smoke-contracts.ts` - Zod request/response
  contracts for dev-only smoke runtime methods.
- `src/features/dev-smoke/api/dev-smoke-api.ts` - dashboard query hook/client
  for smoke status.
- `src/features/dev-smoke/components/dev-smoke-screen.tsx` - dev-only dashboard
  smoke screen.
- `src/features/dev-smoke/components/dev-smoke-screen.test.tsx` - smoke screen
  UI tests.
- `src/features/dev-smoke/index.ts` - public feature barrel.
- `src/extension/background/dev-smoke-service.ts` - background-only smoke
  orchestration and redacted diagnostics.
- `src/extension/background/dev-smoke-service.test.ts` - smoke service tests.

Modify:

- `wxt.config.ts` - add approved GenAI host permissions.
- `src/testing/architecture-boundaries.test.ts` - change manifest permission
  expectation from absent to exact approved hosts.
- `src/features/leetcode-review-assistant/server/runtime-handler-service.ts` -
  remove the global host-permission gate.
- `src/features/leetcode-review-assistant/server/runtime-handler-service.test.ts`
  - replace gate test with configured/error live-path tests.
- `src/features/analytics/api/analytics-contracts.ts` - add dashboard surface,
  optional `at`, and `memoryProfile`.
- `src/features/analytics/api/analytics-api.ts` - send dashboard surface in the
  analytics summary request.
- `src/features/analytics/domain/summary.ts` - build `memoryProfile`.
- `src/features/analytics/domain/summary.test.ts` - memory profile domain
  coverage.
- `src/features/analytics/server/analytics-service.ts` - pass `now` from request
  and feed memory profile inputs.
- `src/features/analytics/components/analytics-screen.tsx` - render memory
  profile.
- `src/features/analytics/components/analytics-screen.test.tsx` - memory profile
  UI states.
- `src/extension/messaging.ts` - export dev-smoke contracts, update queue
  summary fields, update analytics request type.
- `src/extension/background/runtime-policy.ts` and
  `src/extension/background/runtime-policy.test.ts` - allow dev smoke from
  dashboard only.
- `src/extension/background/register-handlers.ts` and
  `src/extension/background/register-handlers.test.ts` - parse new analytics
  request, register dev smoke handler, serialize aligned queue fields.
- `src/features/queue/domain/queue.ts` and
  `src/features/queue/domain/queue.test.ts` - add summary aliases for #12.
- `src/extension/background/due-notification.ts` and
  `src/extension/background/due-notification.test.ts` - read aligned queue
  summary and expose dry-run result through injected deps.
- `src/app/dashboard/navigation/route-manifest.ts`,
  `src/app/dashboard/navigation/routes.tsx`, and
  `src/app/dashboard/routes.test.tsx` - add hidden dev smoke route.
- `docs/product.md`, `docs/architecture.md`, `docs/testing.md`, and
  `docs/superpowers/README.md` - align docs with completed rescue and smoke
  validation.

---

## Task 1: Write the Issue Contract Audit

**Files:**

- Create: `docs/superpowers/audits/2026-06-07-closed-issues-1-6-11-17.md`

- [ ] **Step 1: Create the audit directory**

Run:

```bash
mkdir -p docs/superpowers/audits
```

Expected: command exits 0.

- [ ] **Step 2: Write the audit document**

Create `docs/superpowers/audits/2026-06-07-closed-issues-1-6-11-17.md` with:

```markdown
# Closed Issues #1-6 and #11-17 Audit

Audited range: `0caf86a59dbbea6fa389b69efc3ba6a183656681` through this
rescue branch.

Outcome meanings:

- `keep`: implementation meets contract and has useful tests.
- `fix`: implementation is close but misses a contract field or edge case.
- `reopen`: issue is materially incomplete and should not be considered closed.
- `defer`: requires product decision outside this rescue pass.

| Issue | Outcome | Evidence                                                                                                                          | Rescue Action                                                            |
| ----- | ------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| #1    | keep    | `features/assessment` exposes pure deterministic decisions and tests cover rating/lock/confidence behavior.                       | Preserve; no broad rewrite.                                              |
| #2    | keep    | `features/overlay-session` stores transient context and does not persist session data into practice state.                        | Preserve; verify SPA/reset tests.                                        |
| #3    | fix     | Provider adapters exist for OpenAI, Anthropic, and Gemini, but live calls were blocked by missing provider host permissions.      | Add approved hosts and live smoke path.                                  |
| #4    | keep    | Current branch moved provider secrets to trusted `platform/secrets` storage and keeps safe settings in app data.                  | Preserve; keep leak tests.                                               |
| #5    | keep    | Prompt/schema modules exist with conservative recommendation validation.                                                          | Preserve; include AI assessment smoke case.                              |
| #6    | fix     | Runtime endpoint exists and surface policy blocks non-content callers, but live recommendation path was globally gated.           | Remove gate after manifest hosts exist; test configured/error paths.     |
| #11   | keep    | Practice/queue consumers use normalized practice state rather than raw FSRS rows.                                                 | Preserve; include regression checks.                                     |
| #12   | fix     | Queue has due/new/reinforcement counts and top recommendation, but does not expose the exact shared summary names from the issue. | Add explicit shared aliases or documented replacement fields.            |
| #13   | fix     | Issue remains open while analytics backend/UI were closed.                                                                        | Resolve minimal shared analytics/queue summary contracts in this rescue. |
| #14   | fix     | `analytics.getSummary` is authorized now, but request is `{}` and summary lacks `memoryProfile`.                                  | Add request shape, `at`, memory profile.                                 |
| #15   | fix     | Analytics route renders metrics/forecast/weak problems, but no memory profile section.                                            | Add memory profile UI and tests.                                         |
| #16   | keep    | Central cache invalidation tag map expands practice/settings to derived read models.                                              | Preserve; verify emitters and docs.                                      |
| #17   | fix     | Scheduler dedupes and uses queue due count, but should read the aligned queue summary contract and support dry-run smoke.         | Align dependency shape and smoke dry-run.                                |

## Good Code To Preserve

- Normalized practice reads before queue/analytics consumers.
- Central `platform/query/cache-invalidation.ts` tag mapping.
- Background runtime policy and sender-surface checks.
- GenAI provider adapter tests and Zod-validated JSON facade.
- Trusted secret storage under `platform/secrets`.

## Confirmed Repair Scope

1. Add exact GenAI provider host permissions.
2. Restore live AI recommendation path after permission tests pass.
3. Resolve minimal shared analytics/queue summary contracts.
4. Add analytics memory profile backend and UI.
5. Align due notifications with serialized queue summary.
6. Add dev-only smoke lab and docs.
```

- [ ] **Step 3: Format the audit doc**

Run:

```bash
npx prettier --write docs/superpowers/audits/2026-06-07-closed-issues-1-6-11-17.md
```

Expected: Prettier writes the file.

- [ ] **Step 4: Commit**

Run:

```bash
git add docs/superpowers/audits/2026-06-07-closed-issues-1-6-11-17.md
git commit -m "docs: audit closed analytics and ai issues"
```

Expected: commit succeeds.

---

## Task 2: Enable Live GenAI Host Permissions

**Files:**

- Modify: `wxt.config.ts`
- Modify: `src/testing/architecture-boundaries.test.ts`
- Modify: `src/features/leetcode-review-assistant/server/runtime-handler-service.ts`
- Modify:
  `src/features/leetcode-review-assistant/server/runtime-handler-service.test.ts`

- [ ] **Step 1: Write the failing manifest permission test**

In `src/testing/architecture-boundaries.test.ts`, replace the current
`keeps AI provider host permissions absent while recommendation calls are gated`
test with:

```ts
it('declares only the approved AI provider host permissions', () => {
  const config = readFileSync(join(projectRoot, 'wxt.config.ts'), 'utf8')

  expect(config).toContain('https://api.openai.com/*')
  expect(config).toContain('https://api.anthropic.com/*')
  expect(config).toContain('https://generativelanguage.googleapis.com/*')
  expect(config).not.toContain('https://*/*')
  expect(config).not.toContain('*://*/*')
})
```

- [ ] **Step 2: Run the focused architecture test and verify it fails**

Run:

```bash
npx vitest run src/testing/architecture-boundaries.test.ts
```

Expected: FAIL because the provider hosts are not in `wxt.config.ts`.

- [ ] **Step 3: Add exact provider hosts**

Update `wxt.config.ts` host permissions to:

```ts
host_permissions: [
  'https://leetcode.com/*',
  'https://www.leetcode.com/*',
  'https://api.github.com/*',
  'https://api.openai.com/*',
  'https://api.anthropic.com/*',
  'https://generativelanguage.googleapis.com/*',
],
```

- [ ] **Step 4: Remove the global AI host-permission gate**

In
`src/features/leetcode-review-assistant/server/runtime-handler-service.ts`,
delete:

```ts
const AI_PROVIDER_HOST_PERMISSIONS_APPROVED = false

const HOST_PERMISSION_GATE_MESSAGE =
  'AI recommendations are disabled until provider host permissions are approved.'
```

Then delete this block:

```ts
if (!AI_PROVIDER_HOST_PERMISSIONS_APPROVED) {
  return {
    status: 'unavailable',
    message: HOST_PERMISSION_GATE_MESSAGE,
    submissionFingerprint: request.submissionFingerprint,
  }
}
```

- [ ] **Step 5: Replace the old gate test**

In
`src/features/leetcode-review-assistant/server/runtime-handler-service.test.ts`,
replace the unavailable-host-permission test with a configured live-path test:

```ts
it('returns a ready recommendation when provider settings and secret are configured', async () => {
  vi.mocked(loadActiveProviderConfig).mockResolvedValueOnce({
    provider: 'openai',
    model: 'gpt-4o-mini',
    apiKey: 'sk-test',
  })
  vi.mocked(recommendAssessment).mockResolvedValueOnce({
    status: 'ai',
    recommendation: createAssessmentRecommendation(),
    providerMetadata: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      latencyMs: 12,
    },
  })

  const result = await recommendLeetCodeAssessmentInBackground(
    testDb,
    createRecommendLeetCodeAssessmentRequest(),
  )

  expect(result.status).toBe('ready')
  expect(result).not.toHaveProperty('apiKey')
})
```

Use the existing fixture/helper names in the test file. If the file already has
equivalent fixture names, reuse those exact local names instead of creating new
duplicates.

- [ ] **Step 6: Run focused tests**

Run:

```bash
npx vitest run src/testing/architecture-boundaries.test.ts src/features/leetcode-review-assistant/server/runtime-handler-service.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add wxt.config.ts src/testing/architecture-boundaries.test.ts src/features/leetcode-review-assistant/server/runtime-handler-service.ts src/features/leetcode-review-assistant/server/runtime-handler-service.test.ts
git commit -m "fix(genai): enable approved provider hosts"
```

Expected: commit succeeds.

---

## Task 3: Add Analytics Request Shape and Memory Profile Contract

**Files:**

- Modify: `src/features/analytics/api/analytics-contracts.ts`
- Modify: `src/features/analytics/api/analytics-api.ts`
- Modify: `src/features/analytics/domain/summary.ts`
- Modify: `src/features/analytics/domain/summary.test.ts`
- Modify: `src/features/analytics/server/analytics-service.ts`
- Modify: `src/extension/background/register-handlers.ts`

- [ ] **Step 1: Write the failing contract/domain tests**

Add to `src/features/analytics/domain/summary.test.ts`:

```ts
it('builds a memory profile from normalized card buckets', () => {
  const result = buildMemoryProfile({
    totalTracked: 5,
    dueToday: 2,
    overdue: 1,
    learning: 1,
    review: 2,
    mastered: 1,
    suspended: 1,
    retrievabilities: [0.8, 0.6],
  })

  expect(result).toEqual({
    totalTracked: 5,
    dueToday: 2,
    overdue: 1,
    learning: 1,
    review: 2,
    mastered: 1,
    suspended: 1,
    averageRetrievability: 0.7,
    lowSample: true,
  })
})

it('returns null average retrievability when no retrievability samples exist', () => {
  const result = buildMemoryProfile({
    totalTracked: 0,
    dueToday: 0,
    overdue: 0,
    learning: 0,
    review: 0,
    mastered: 0,
    suspended: 0,
    retrievabilities: [],
  })

  expect(result.averageRetrievability).toBeNull()
  expect(result.lowSample).toBe(true)
})
```

Add an analytics contract test to the same file or create
`src/features/analytics/api/analytics-contracts.test.ts`:

```ts
it('requires dashboard surface and accepts optional at for analytics summary requests', () => {
  expect(
    analyticsSummaryRequestSchema.parse({
      surface: 'dashboard',
      at: '2026-06-07T12:00:00.000Z',
    }),
  ).toEqual({
    surface: 'dashboard',
    at: '2026-06-07T12:00:00.000Z',
  })

  expect(() => analyticsSummaryRequestSchema.parse({})).toThrow()
})
```

- [ ] **Step 2: Run the focused analytics tests and verify they fail**

Run:

```bash
npx vitest run src/features/analytics/domain/summary.test.ts src/features/analytics/api/analytics-contracts.test.ts
```

Expected: FAIL because `buildMemoryProfile` and the request schema do not exist
yet. If the contract test was placed in `summary.test.ts`, run only that file.

- [ ] **Step 3: Update analytics contracts**

In `src/features/analytics/api/analytics-contracts.ts`, change the request and
add memory profile schema:

```ts
export const analyticsSummaryRequestSchema = z.object({
  surface: z.literal('dashboard'),
  at: z.iso.datetime().optional(),
})

export const memoryProfileSchema = z.object({
  totalTracked: z.number().int().nonnegative(),
  dueToday: z.number().int().nonnegative(),
  overdue: z.number().int().nonnegative(),
  learning: z.number().int().nonnegative(),
  review: z.number().int().nonnegative(),
  mastered: z.number().int().nonnegative(),
  suspended: z.number().int().nonnegative(),
  averageRetrievability: z.number().nullable(),
  lowSample: z.boolean(),
})
```

Then add to `analyticsSummarySchema`:

```ts
memoryProfile: memoryProfileSchema,
```

- [ ] **Step 4: Update the analytics API hook**

In `src/features/analytics/api/analytics-api.ts`, change the query function to:

```ts
queryFn: () => sendMessage('analytics.getSummary', { surface: 'dashboard' }),
```

- [ ] **Step 5: Implement memory profile domain helpers**

In `src/features/analytics/domain/summary.ts`, add:

```ts
export interface MemoryProfileInput {
  totalTracked: number
  dueToday: number
  overdue: number
  learning: number
  review: number
  mastered: number
  suspended: number
  retrievabilities: number[]
}

export interface MemoryProfile {
  totalTracked: number
  dueToday: number
  overdue: number
  learning: number
  review: number
  mastered: number
  suspended: number
  averageRetrievability: number | null
  lowSample: boolean
}

export function buildMemoryProfile(input: MemoryProfileInput): MemoryProfile {
  const averageRetrievability =
    input.retrievabilities.length === 0
      ? null
      : roundToTwoDecimals(
          input.retrievabilities.reduce((sum, value) => sum + value, 0) /
            input.retrievabilities.length,
        )

  return {
    totalTracked: input.totalTracked,
    dueToday: input.dueToday,
    overdue: input.overdue,
    learning: input.learning,
    review: input.review,
    mastered: input.mastered,
    suspended: input.suspended,
    averageRetrievability,
    lowSample: input.retrievabilities.length < 10,
  }
}

function roundToTwoDecimals(value: number) {
  return Math.round(value * 100) / 100
}
```

Add `memoryProfile: MemoryProfile` to `AnalyticsSummaryInput` and
`AnalyticsSummary`, and return `memoryProfile: input.memoryProfile` in
`buildAnalyticsSummary`.

- [ ] **Step 6: Feed memory profile from analytics service**

In `src/features/analytics/server/analytics-service.ts`, import
`buildMemoryProfile`. Build a minimal profile from existing data:

```ts
const memoryProfile = buildMemoryProfile({
  totalTracked: enrichedCandidates.length,
  dueToday: forecast[0]?.dueCount ?? 0,
  overdue: upcomingCards.filter((card) => card.dueAt < now).length,
  learning: 0,
  review: enrichedCandidates.length,
  mastered: 0,
  suspended: 0,
  retrievabilities: enrichedCandidates.map(
    (candidate) => candidate.retrievability,
  ),
})
```

Pass `memoryProfile` into `buildAnalyticsSummary`. This is intentionally
minimal. A richer bucket source can be added later after the shared summary
contract settles.

- [ ] **Step 7: Use request surface and `at` in the runtime handler**

In `src/extension/background/register-handlers.ts`, update the analytics handler
body:

```ts
const request = analyticsSummaryRequestSchema.parse(data)

assertCanSenderCallExtensionMethod(
  'analytics.getSummary',
  request.surface,
  sender,
)

return getAppDb().then(async ({ db }) =>
  analyticsSummarySchema.parse(
    await getAnalyticsSummary(
      db,
      request.at ? new Date(request.at) : undefined,
    ),
  ),
)
```

- [ ] **Step 8: Run focused analytics/runtime tests**

Run:

```bash
npx vitest run src/features/analytics src/extension/background/register-handlers.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

Run:

```bash
git add src/features/analytics src/extension/background/register-handlers.ts src/extension/background/register-handlers.test.ts
git commit -m "fix(analytics): add summary request and memory profile"
```

Expected: commit succeeds.

---

## Task 4: Render Analytics Memory Profile

**Files:**

- Create: `src/features/analytics/components/analytics-memory-profile.tsx`
- Modify: `src/features/analytics/components/analytics-screen.tsx`
- Modify: `src/features/analytics/components/analytics-screen.test.tsx`
- Modify: `src/features/analytics/components/index.ts`
- Modify: `src/testing/analytics-fixtures.ts`

- [ ] **Step 1: Update analytics fixtures**

In `src/testing/analytics-fixtures.ts`, add `memoryProfile` to the serialized
summary fixture:

```ts
memoryProfile: {
  totalTracked: 12,
  dueToday: 3,
  overdue: 1,
  learning: 2,
  review: 8,
  mastered: 1,
  suspended: 1,
  averageRetrievability: 0.74,
  lowSample: false,
},
```

- [ ] **Step 2: Write the failing UI tests**

Add to `src/features/analytics/components/analytics-screen.test.tsx`:

```ts
it('renders memory profile totals and retrievability', async () => {
  vi.mocked(sendMessage).mockResolvedValueOnce(createAnalyticsSummary())

  renderAnalyticsScreen()

  const region = await screen.findByRole('region', { name: 'Memory profile' })
  expect(within(region).getByText('12')).toBeVisible()
  expect(within(region).getByText('74%')).toBeVisible()
  expect(within(region).getByText('3 due today')).toBeVisible()
})

it('renders low-sample memory profile state', async () => {
  vi.mocked(sendMessage).mockResolvedValueOnce(
    createAnalyticsSummary({
      memoryProfile: {
        totalTracked: 0,
        dueToday: 0,
        overdue: 0,
        learning: 0,
        review: 0,
        mastered: 0,
        suspended: 0,
        averageRetrievability: null,
        lowSample: true,
      },
    }),
  )

  renderAnalyticsScreen()

  const region = await screen.findByRole('region', { name: 'Memory profile' })
  expect(within(region).getByText('Not enough review data')).toBeVisible()
})
```

- [ ] **Step 3: Run UI tests and verify they fail**

Run:

```bash
npx vitest run src/features/analytics/components/analytics-screen.test.tsx
```

Expected: FAIL because the memory profile component is missing.

- [ ] **Step 4: Add the memory profile component**

Create `src/features/analytics/components/analytics-memory-profile.tsx`:

```tsx
import type { SerializedAnalyticsSummary } from '../api/analytics-contracts'

interface AnalyticsMemoryProfileProps {
  profile: SerializedAnalyticsSummary['memoryProfile']
}

export function AnalyticsMemoryProfile({
  profile,
}: AnalyticsMemoryProfileProps) {
  const retrievabilityLabel =
    profile.averageRetrievability === null
      ? 'Not enough review data'
      : `${Math.round(profile.averageRetrievability * 100)}%`

  return (
    <section className="space-y-3" aria-label="Memory profile">
      <div>
        <h2 className="text-sm font-semibold text-foreground">
          Memory profile
        </h2>
        <p className="text-xs text-muted-foreground">
          Local review memory from tracked practice state.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-border bg-card p-3">
          <div className="text-2xl font-semibold">{profile.totalTracked}</div>
          <div className="text-xs text-muted-foreground">tracked problems</div>
        </div>
        <div className="rounded-md border border-border bg-card p-3">
          <div className="text-2xl font-semibold">{retrievabilityLabel}</div>
          <div className="text-xs text-muted-foreground">
            average retrievability
          </div>
        </div>
        <div className="rounded-md border border-border bg-card p-3">
          <div className="text-2xl font-semibold">{profile.overdue}</div>
          <div className="text-xs text-muted-foreground">overdue</div>
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        {profile.dueToday} due today · {profile.learning} learning ·{' '}
        {profile.review} review · {profile.mastered} mastered ·{' '}
        {profile.suspended} suspended
      </div>
    </section>
  )
}
```

- [ ] **Step 5: Render it from the analytics screen**

In `src/features/analytics/components/analytics-screen.tsx`, import and render:

```tsx
import { AnalyticsMemoryProfile } from './analytics-memory-profile'
```

Then add after `<AnalyticsMetricRow summary={data} />`:

```tsx
<AnalyticsMemoryProfile profile={data.memoryProfile} />
```

- [ ] **Step 6: Export from component barrel**

In `src/features/analytics/components/index.ts`, export:

```ts
export { AnalyticsMemoryProfile } from './analytics-memory-profile'
```

- [ ] **Step 7: Run focused UI tests**

Run:

```bash
npx vitest run src/features/analytics/components/analytics-screen.test.tsx src/app/dashboard/routes.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add src/features/analytics/components src/testing/analytics-fixtures.ts src/app/dashboard/routes.test.tsx
git commit -m "feat(analytics): render memory profile"
```

Expected: commit succeeds.

---

## Task 5: Align Queue Summary and Due Notification Contract

**Files:**

- Modify: `src/features/queue/domain/queue.ts`
- Modify: `src/features/queue/domain/queue.test.ts`
- Modify: `src/extension/messaging.ts`
- Modify: `src/extension/background/register-handlers.ts`
- Modify: `src/extension/background/due-notification.ts`
- Modify: `src/extension/background/due-notification.test.ts`

- [ ] **Step 1: Write failing queue contract tests**

Add to `src/features/queue/domain/queue.test.ts`:

```ts
it('exposes shared summary aliases for due, new, load, and recommendation reason', () => {
  const queue = buildTodayQueue(
    [makeQueueCandidate({ slug: 'two-sum', dueAt: generatedAt })],
    defaultUserSettings,
    generatedAt,
  )

  expect(queue.dueToday).toBe(queue.dueCount)
  expect(queue.newAvailable).toBe(queue.newCount)
  expect(queue.queueLoad).toBe(queue.items.length)
  expect(queue.recommendationReason).toBe(queue.topRecommendation?.reason)
})
```

Use the existing local fixture helper names in `queue.test.ts`.

- [ ] **Step 2: Run queue test and verify it fails**

Run:

```bash
npx vitest run src/features/queue/domain/queue.test.ts
```

Expected: FAIL because the alias fields are missing.

- [ ] **Step 3: Add summary aliases to `TodayQueue`**

In `src/features/queue/domain/queue.ts`, update `TodayQueue`:

```ts
dueToday: number
newAvailable: number
queueLoad: number
recommendationReason: RecommendationReason | null
```

In the `return` from `buildTodayQueue`, add:

```ts
dueToday: dueItems.length,
newAvailable: newItems.length,
queueLoad: items.length,
recommendationReason: items[0]?.reason ?? null,
```

- [ ] **Step 4: Serialize the aligned queue fields**

In `src/extension/messaging.ts`, add these fields to `todayQueueSchema`:

```ts
dueToday: z.number().int().min(0),
newAvailable: z.number().int().min(0),
queueLoad: z.number().int().min(0),
recommendationReason: z
  .enum(['overdue', 'due-now', 'reinforcement', 'new-problem'])
  .nullable(),
```

In `src/extension/background/register-handlers.ts`, add to
`serializeTodayQueue`:

```ts
dueToday: queue.dueToday,
newAvailable: queue.newAvailable,
queueLoad: queue.queueLoad,
recommendationReason: queue.recommendationReason,
```

- [ ] **Step 5: Update due notification dependency shape**

In `src/extension/background/due-notification.ts`, change:

```ts
readQueueSummary: () => Promise<{ dueCount: number }>
```

to:

```ts
readQueueSummary: () => Promise<{ dueToday: number }>
```

Then change:

```ts
const { dueCount } = await deps.readQueueSummary()

if (state.lastNotifiedDate !== today && dueCount > 0) {
```

to:

```ts
const { dueToday } = await deps.readQueueSummary()

if (state.lastNotifiedDate !== today && dueToday > 0) {
```

And update the notification message to use `dueToday`.

In `src/extension/background/register-handlers.ts`, change the scheduler queue
reader to:

```ts
return { dueToday: queue.dueToday }
```

- [ ] **Step 6: Update due notification tests**

In `src/extension/background/due-notification.test.ts`, replace all
`{ dueCount: N }` fake queue summaries with `{ dueToday: N }`. Keep expected
messages unchanged.

- [ ] **Step 7: Run focused queue and notification tests**

Run:

```bash
npx vitest run src/features/queue/domain/queue.test.ts src/extension/background/due-notification.test.ts src/extension/background/register-handlers.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add src/features/queue/domain/queue.ts src/features/queue/domain/queue.test.ts src/extension/messaging.ts src/extension/background/register-handlers.ts src/extension/background/due-notification.ts src/extension/background/due-notification.test.ts src/extension/background/register-handlers.test.ts
git commit -m "fix(queue): align summary contract for reminders"
```

Expected: commit succeeds.

---

## Task 6: Add Dev Smoke Contracts and Background Service

**Files:**

- Create: `src/features/dev-smoke/api/dev-smoke-contracts.ts`
- Create: `src/features/dev-smoke/index.ts`
- Create: `src/extension/background/dev-smoke-service.ts`
- Create: `src/extension/background/dev-smoke-service.test.ts`
- Modify: `src/extension/messaging.ts`
- Modify: `src/extension/background/runtime-policy.ts`
- Modify: `src/extension/background/runtime-policy.test.ts`
- Modify: `src/extension/background/register-handlers.ts`
- Modify: `src/extension/background/register-handlers.test.ts`

- [ ] **Step 1: Create smoke contracts**

Create `src/features/dev-smoke/api/dev-smoke-contracts.ts`:

```ts
import { z } from 'zod'

export const devSmokeRequestSchema = z.object({
  surface: z.literal('dashboard'),
  runLiveGenAi: z.boolean().optional(),
})

export type DevSmokeRequest = z.infer<typeof devSmokeRequestSchema>

export const devSmokeCheckStatusSchema = z.enum([
  'pass',
  'fail',
  'skip',
  'warn',
])

export const devSmokeCheckSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: devSmokeCheckStatusSchema,
  detail: z.string(),
  latencyMs: z.number().int().nonnegative().optional(),
})

export const devSmokeReportSchema = z.object({
  generatedAt: z.iso.datetime(),
  checks: z.array(devSmokeCheckSchema),
})

export type DevSmokeReport = z.infer<typeof devSmokeReportSchema>
```

Create `src/features/dev-smoke/index.ts`:

```ts
export {
  devSmokeCheckSchema,
  devSmokeCheckStatusSchema,
  devSmokeReportSchema,
  devSmokeRequestSchema,
} from './api/dev-smoke-contracts'
export type { DevSmokeReport, DevSmokeRequest } from './api/dev-smoke-contracts'
```

- [ ] **Step 2: Export contracts through messaging**

In `src/extension/messaging.ts`, import/export:

```ts
import type { DevSmokeReport, DevSmokeRequest } from '@/features/dev-smoke'
export {
  devSmokeReportSchema,
  devSmokeRequestSchema,
} from '@/features/dev-smoke'
```

Add to `ProtocolMap` if the file has the message map below the shown section:

```ts
'devSmoke.run'(request: DevSmokeRequest): DevSmokeReport
```

Add to `protocolMethodNames`:

```ts
'devSmoke.run',
```

- [ ] **Step 3: Write smoke service tests**

Create `src/extension/background/dev-smoke-service.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

import { createDevSmokeService } from './dev-smoke-service'

describe('createDevSmokeService', () => {
  it('returns pass checks for reachable analytics and queue dependencies', async () => {
    const service = createDevSmokeService({
      now: () => new Date('2026-06-07T12:00:00.000Z'),
      readAnalyticsSummary: vi.fn(async () => ({
        generatedAt: '2026-06-07T12:00:00.000Z',
        memoryProfile: {
          totalTracked: 1,
          dueToday: 1,
          overdue: 0,
          learning: 0,
          review: 1,
          mastered: 0,
          suspended: 0,
          averageRetrievability: 0.8,
          lowSample: true,
        },
      })),
      readQueueSummary: vi.fn(async () => ({
        dueToday: 1,
        newAvailable: 0,
        queueLoad: 1,
        recommendationReason: 'due-now',
      })),
      readGenAiConfig: vi.fn(async () => ({
        enabled: true,
        provider: 'openai',
        model: 'gpt-4o-mini',
        hasSecret: true,
      })),
      runLiveGenAi: vi.fn(async () => ({
        status: 'pass',
        detail: 'Provider returned schema-valid JSON.',
        latencyMs: 10,
      })),
      runNotificationDryRun: vi.fn(async () => ({
        status: 'pass',
        detail: 'Would notify for 1 due review.',
      })),
    })

    const report = await service.run({ runLiveGenAi: true })

    expect(report.generatedAt).toBe('2026-06-07T12:00:00.000Z')
    expect(report.checks.map((check) => check.id)).toEqual([
      'health',
      'analytics',
      'queue',
      'notifications',
      'genai.config',
      'genai.live',
    ])
    expect(report.checks.every((check) => check.status === 'pass')).toBe(true)
  })

  it('skips live GenAI when not requested', async () => {
    const runLiveGenAi = vi.fn()
    const service = createDevSmokeService({
      now: () => new Date('2026-06-07T12:00:00.000Z'),
      readAnalyticsSummary: vi.fn(async () => ({ memoryProfile: {} })),
      readQueueSummary: vi.fn(async () => ({
        dueToday: 0,
        newAvailable: 0,
        queueLoad: 0,
        recommendationReason: null,
      })),
      readGenAiConfig: vi.fn(async () => ({
        enabled: false,
        provider: 'openai',
        model: 'gpt-4o-mini',
        hasSecret: false,
      })),
      runLiveGenAi,
      runNotificationDryRun: vi.fn(async () => ({
        status: 'skip',
        detail: 'No due reviews.',
      })),
    })

    const report = await service.run({ runLiveGenAi: false })

    expect(runLiveGenAi).not.toHaveBeenCalled()
    expect(
      report.checks.find((check) => check.id === 'genai.live'),
    ).toMatchObject({
      status: 'skip',
    })
  })
})
```

- [ ] **Step 4: Run smoke service test and verify it fails**

Run:

```bash
npx vitest run src/extension/background/dev-smoke-service.test.ts
```

Expected: FAIL because `dev-smoke-service.ts` does not exist.

- [ ] **Step 5: Implement smoke service factory**

Create `src/extension/background/dev-smoke-service.ts`:

```ts
import type { DevSmokeReport } from '@/features/dev-smoke'

type SmokeStatus = DevSmokeReport['checks'][number]['status']

interface DevSmokeDeps {
  now: () => Date
  readAnalyticsSummary: () => Promise<{ memoryProfile?: unknown }>
  readQueueSummary: () => Promise<{
    dueToday: number
    newAvailable: number
    queueLoad: number
    recommendationReason: string | null
  }>
  readGenAiConfig: () => Promise<{
    enabled: boolean
    provider: string
    model: string
    hasSecret: boolean
  }>
  runNotificationDryRun: () => Promise<{ status: SmokeStatus; detail: string }>
  runLiveGenAi: () => Promise<{
    status: SmokeStatus
    detail: string
    latencyMs?: number
  }>
}

export function createDevSmokeService(deps: DevSmokeDeps) {
  async function run(input: {
    runLiveGenAi?: boolean
  }): Promise<DevSmokeReport> {
    const generatedAt = deps.now().toISOString()
    const checks: DevSmokeReport['checks'] = [
      {
        id: 'health',
        label: 'Background runtime',
        status: 'pass',
        detail: 'Background smoke service is reachable.',
      },
    ]

    try {
      const analytics = await deps.readAnalyticsSummary()
      checks.push({
        id: 'analytics',
        label: 'Analytics summary',
        status: analytics.memoryProfile ? 'pass' : 'fail',
        detail: analytics.memoryProfile
          ? 'Analytics summary includes memory profile.'
          : 'Analytics summary is missing memory profile.',
      })
    } catch (error) {
      checks.push({
        id: 'analytics',
        label: 'Analytics summary',
        status: 'fail',
        detail: redactError(error),
      })
    }

    try {
      const queue = await deps.readQueueSummary()
      checks.push({
        id: 'queue',
        label: 'Queue summary',
        status: 'pass',
        detail: `${queue.dueToday} due, ${queue.newAvailable} new, ${queue.queueLoad} queued.`,
      })
    } catch (error) {
      checks.push({
        id: 'queue',
        label: 'Queue summary',
        status: 'fail',
        detail: redactError(error),
      })
    }

    const notification = await deps.runNotificationDryRun()
    checks.push({
      id: 'notifications',
      label: 'Due notification dry-run',
      status: notification.status,
      detail: notification.detail,
    })

    const genAiConfig = await deps.readGenAiConfig()
    checks.push({
      id: 'genai.config',
      label: 'GenAI configuration',
      status: genAiConfig.enabled && genAiConfig.hasSecret ? 'pass' : 'warn',
      detail: `${genAiConfig.provider}/${genAiConfig.model}; secret configured: ${genAiConfig.hasSecret ? 'yes' : 'no'}.`,
    })

    if (input.runLiveGenAi) {
      const live = await deps.runLiveGenAi()
      checks.push({
        id: 'genai.live',
        label: 'Live GenAI provider',
        status: live.status,
        detail: live.detail,
        ...(live.latencyMs !== undefined ? { latencyMs: live.latencyMs } : {}),
      })
    } else {
      checks.push({
        id: 'genai.live',
        label: 'Live GenAI provider',
        status: 'skip',
        detail: 'Live provider call was not requested.',
      })
    }

    return { generatedAt, checks }
  }

  return { run }
}

function redactError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]')
}
```

- [ ] **Step 6: Add runtime policy for dev smoke**

In `src/extension/background/runtime-policy.ts`, add:

```ts
'devSmoke.run': ['dashboard'],
```

Add to `src/extension/background/runtime-policy.test.ts`:

```ts
it('allows dashboard senders to run dev smoke checks', () => {
  expect(canCallExtensionMethod('devSmoke.run', 'dashboard')).toBe(true)
  expect(canCallExtensionMethod('devSmoke.run', 'content-script')).toBe(false)
})
```

- [ ] **Step 7: Register the background handler**

In `src/extension/background/register-handlers.ts`, import:

```ts
import {
  devSmokeReportSchema,
  devSmokeRequestSchema,
} from '@/features/dev-smoke'
import { createDevSmokeService } from './dev-smoke-service'
```

Add a handler near other read-only dashboard handlers:

```ts
onMessage('devSmoke.run', ({ data, sender }) => {
  const request = devSmokeRequestSchema.parse(data)
  assertCanSenderCallExtensionMethod('devSmoke.run', request.surface, sender)

  return getAppDb().then(async ({ db }) => {
    const service = createDevSmokeService({
      now: () => new Date(),
      readAnalyticsSummary: async () => getAnalyticsSummary(db),
      readQueueSummary: async () => {
        const queue = await getTodayQueue(db, new Date())
        return {
          dueToday: queue.dueToday,
          newAvailable: queue.newAvailable,
          queueLoad: queue.queueLoad,
          recommendationReason: queue.recommendationReason,
        }
      },
      readGenAiConfig: async () => {
        const config = await loadActiveProviderConfig(db)
        return {
          enabled: config !== null,
          provider: config?.provider ?? 'openai',
          model: config?.model ?? 'not-configured',
          hasSecret: config !== null,
        }
      },
      runNotificationDryRun: async () => ({
        status: 'skip',
        detail: 'Dry-run wiring is available; notification was not sent.',
      }),
      runLiveGenAi: async () => ({
        status: 'skip',
        detail:
          'Live GenAI smoke call will be added after provider path tests.',
      }),
    })

    return devSmokeReportSchema.parse(
      await service.run({ runLiveGenAi: request.runLiveGenAi }),
    )
  })
})
```

- [ ] **Step 8: Run focused smoke/runtime tests**

Run:

```bash
npx vitest run src/extension/background/dev-smoke-service.test.ts src/extension/background/runtime-policy.test.ts src/extension/background/register-handlers.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

Run:

```bash
git add src/features/dev-smoke src/extension/messaging.ts src/extension/background/dev-smoke-service.ts src/extension/background/dev-smoke-service.test.ts src/extension/background/runtime-policy.ts src/extension/background/runtime-policy.test.ts src/extension/background/register-handlers.ts src/extension/background/register-handlers.test.ts
git commit -m "feat(dev-smoke): add background smoke checks"
```

Expected: commit succeeds.

---

## Task 7: Add Hidden Dashboard Smoke Route

**Files:**

- Create: `src/features/dev-smoke/api/dev-smoke-api.ts`
- Create: `src/features/dev-smoke/components/dev-smoke-screen.tsx`
- Create: `src/features/dev-smoke/components/dev-smoke-screen.test.tsx`
- Modify: `src/features/dev-smoke/index.ts`
- Modify: `src/app/dashboard/navigation/route-manifest.ts`
- Modify: `src/app/dashboard/navigation/routes.tsx`
- Modify: `src/app/dashboard/routes.test.tsx`

- [ ] **Step 1: Create dashboard API hook**

Create `src/features/dev-smoke/api/dev-smoke-api.ts`:

```ts
import { useQuery } from '@tanstack/react-query'

import { sendMessage } from '@/extension/messaging'

export const devSmokeQueryKey = ['dev-smoke'] as const

export function useDevSmokeReport(runLiveGenAi: boolean) {
  return useQuery({
    queryKey: [...devSmokeQueryKey, runLiveGenAi],
    queryFn: () =>
      sendMessage('devSmoke.run', {
        surface: 'dashboard',
        runLiveGenAi,
      }),
  })
}
```

- [ ] **Step 2: Write smoke screen UI tests**

Create `src/features/dev-smoke/components/dev-smoke-screen.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { sendMessage } from '@/extension/messaging'

import { DevSmokeScreen } from './dev-smoke-screen'

vi.mock('@/extension/messaging', () => ({
  sendMessage: vi.fn(),
}))

describe('DevSmokeScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders smoke check statuses', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce({
      generatedAt: '2026-06-07T12:00:00.000Z',
      checks: [
        {
          id: 'analytics',
          label: 'Analytics summary',
          status: 'pass',
          detail: 'Analytics summary includes memory profile.',
        },
        {
          id: 'genai.live',
          label: 'Live GenAI provider',
          status: 'skip',
          detail: 'Live provider call was not requested.',
        },
      ],
    })

    render(<DevSmokeScreen />, { wrapper: createWrapper() })

    const analytics = await screen.findByRole('listitem', {
      name: /Analytics summary/,
    })
    expect(within(analytics).getByText('pass')).toBeVisible()
    expect(screen.getByText('Live GenAI provider')).toBeVisible()
  })
})

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}
```

- [ ] **Step 3: Run smoke screen test and verify it fails**

Run:

```bash
npx vitest run src/features/dev-smoke/components/dev-smoke-screen.test.tsx
```

Expected: FAIL because `DevSmokeScreen` does not exist.

- [ ] **Step 4: Implement smoke screen**

Create `src/features/dev-smoke/components/dev-smoke-screen.tsx`:

```tsx
import { useState } from 'react'

import { InlineStatus } from '@/components/inline-status'

import { useDevSmokeReport } from '../api/dev-smoke-api'

export function DevSmokeScreen() {
  const [runLiveGenAi, setRunLiveGenAi] = useState(false)
  const query = useDevSmokeReport(runLiveGenAi)

  if (query.isPending) {
    return <InlineStatus>Loading smoke checks...</InlineStatus>
  }

  if (query.isError) {
    return <InlineStatus>Failed to load smoke checks.</InlineStatus>
  }

  return (
    <section className="space-y-4" aria-label="Dev smoke checks">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={runLiveGenAi}
          onChange={(event) => setRunLiveGenAi(event.currentTarget.checked)}
        />
        Run live GenAI provider smoke
      </label>

      <ul className="space-y-2">
        {query.data.checks.map((check) => (
          <li
            key={check.id}
            aria-label={`${check.label} ${check.status}`}
            className="rounded-md border border-border bg-card p-3"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">{check.label}</span>
              <span className="text-xs uppercase text-muted-foreground">
                {check.status}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{check.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
```

- [ ] **Step 5: Export smoke UI and API**

In `src/features/dev-smoke/index.ts`, add:

```ts
export { useDevSmokeReport } from './api/dev-smoke-api'
export { DevSmokeScreen } from './components/dev-smoke-screen'
```

- [ ] **Step 6: Add hidden route path and screen**

In `src/app/dashboard/navigation/route-manifest.ts`, add:

```ts
devSmoke: '/dev/smoke',
```

to `dashboardPaths`. Do not add it to `DashboardTopLevelPath` or
`dashboardTopLevelRoutes`.

In `src/app/dashboard/navigation/routes.tsx`, import:

```ts
import { DevSmokeScreen } from '@/features/dev-smoke'
```

Add route:

```ts
const devSmokeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dev/smoke',
  component: DevSmokeScreen,
  staticData: {
    presentation: 'page',
    section: 'settings',
    title: 'Dev Smoke',
  },
})
```

Add `devSmokeRoute` to `rootRoute.addChildren([...])`.

- [ ] **Step 7: Add route test**

In `src/app/dashboard/routes.test.tsx`, add:

```ts
it('renders hidden dev smoke route without adding it to primary navigation', async () => {
  vi.mocked(sendMessage).mockResolvedValueOnce({
    generatedAt: '2026-06-07T12:00:00.000Z',
    checks: [
      {
        id: 'health',
        label: 'Background runtime',
        status: 'pass',
        detail: 'Background smoke service is reachable.',
      },
    ],
  })

  renderDashboardAt('/dev/smoke')

  expect(await screen.findByText('Background runtime')).toBeVisible()
  expect(
    screen.queryByRole('link', { name: 'Dev Smoke' }),
  ).not.toBeInTheDocument()
})
```

Use the existing route-test render helper name in the file.

- [ ] **Step 8: Run focused dashboard tests**

Run:

```bash
npx vitest run src/features/dev-smoke/components/dev-smoke-screen.test.tsx src/app/dashboard/routes.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit**

Run:

```bash
git add src/features/dev-smoke src/app/dashboard/navigation/route-manifest.ts src/app/dashboard/navigation/routes.tsx src/app/dashboard/routes.test.tsx
git commit -m "feat(dev-smoke): add hidden dashboard smoke route"
```

Expected: commit succeeds.

---

## Task 8: Update Product, Architecture, and Testing Docs

**Files:**

- Modify: `docs/product.md`
- Modify: `docs/architecture.md`
- Modify: `docs/testing.md`
- Modify: `docs/superpowers/README.md`

- [ ] **Step 1: Update docs**

Make these concrete doc updates:

- `docs/product.md`: state that AI recommendations can run against configured
  OpenAI, Anthropic, or Gemini providers after BYOK setup, and that a dev-only
  smoke route exists at `#/dev/smoke`.
- `docs/architecture.md`: document the GenAI live path, exact provider host
  permissions, `memoryProfile`, queue summary aliases, and dev-smoke runtime
  boundary.
- `docs/testing.md`: add manual smoke checklist:

```markdown
## Dev Smoke Checks

Open the dashboard route `#/dev/smoke` in a development build.

Expected checks:

- Background runtime: `pass`
- Analytics summary: `pass`
- Queue summary: `pass`
- Due notification dry-run: `pass`, `skip`, or `warn` with a clear reason
- GenAI configuration: `pass` when enabled with a stored key, otherwise `warn`
- Live GenAI provider: `skip` unless "Run live GenAI provider smoke" is checked

When live GenAI smoke is checked, the result must never display an API key.
```

- `docs/superpowers/README.md`: link the new design, plan, and audit files.

- [ ] **Step 2: Format touched docs**

Run:

```bash
npx prettier --write docs/product.md docs/architecture.md docs/testing.md docs/superpowers/README.md
```

Expected: Prettier writes the touched docs.

- [ ] **Step 3: Commit**

Run:

```bash
git add docs/product.md docs/architecture.md docs/testing.md docs/superpowers/README.md
git commit -m "docs: document rescue smoke validation"
```

Expected: commit succeeds.

---

## Task 9: Final Verification

**Files:**

- No intended source edits.
- If verification exposes a real failure in touched behavior, fix it with a
  focused commit before re-running verification.

- [ ] **Step 1: Run focused suites**

Run:

```bash
npx vitest run src/testing/architecture-boundaries.test.ts src/features/leetcode-review-assistant src/features/analytics src/features/queue src/extension/background src/features/dev-smoke src/app/dashboard/routes.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run full project check**

Run:

```bash
npm run check
```

Expected: PASS.

- [ ] **Step 3: Check worktree**

Run:

```bash
git status --short --branch
```

Expected: clean branch on `codex/post-analytics-stabilization`.

- [ ] **Step 4: Commit validation note if docs changed during fixes**

If final verification required docs corrections, commit them:

```bash
git add docs/product.md docs/architecture.md docs/testing.md docs/superpowers/README.md
git commit -m "docs: align final rescue validation"
```

Expected: commit succeeds only if docs changed. If no docs changed, skip this
step.

---

## Self-Review

- Spec coverage: Tasks cover audit matrix, provider host permissions, GenAI live
  path, analytics request/memory profile, queue aliases, notification alignment,
  dev smoke runtime/UI, docs, and full verification.
- Scope: This remains one coordinated rescue because #13/#14/#15, #12/#17, and
  #3/#6 are coupled by runtime contracts and smoke validation.
- Type consistency: `dueToday`, `newAvailable`, `queueLoad`,
  `recommendationReason`, `memoryProfile`, and `devSmoke.run` are introduced
  once and used consistently across domain, Zod contracts, serialization, and
  UI.
- No broad rewrites: The plan preserves normalized practice reads, cache
  invalidation tags, provider adapters, trusted secret storage, and runtime
  sender policy.
