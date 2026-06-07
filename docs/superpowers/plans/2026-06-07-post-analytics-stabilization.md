# Post-Analytics Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize all post-`0caf86a` work by fixing Analytics runtime access,
closing runtime policy test gaps, moving GenAI secrets to trusted storage,
gating AI provider calls until permissions are approved, and aligning docs.

**Architecture:** Keep the existing small-app Bulletproof React shape:
`entrypoints -> app -> features -> platform/lib/components`. Runtime calls stay
behind `src/extension`, feature behavior stays inside owning feature folders,
and secrets use `src/platform/secrets`.

**Tech Stack:** WXT MV3, React 19, TypeScript, TanStack Query, Zod, Drizzle,
Vitest, Chrome extension runtime APIs.

---

## File Structure

- Modify `src/extension/messaging.ts`
  - Add an exported `protocolMethodNames` runtime list that is type-checked
    against `ProtocolMap`.
- Modify `src/extension/background/runtime-policy.ts`
  - Authorize `analytics.getSummary` for dashboard senders.
  - Export `extensionMethodNames` so tests can compare protocol coverage.
- Modify `src/extension/background/runtime-policy.test.ts`
  - Add Analytics policy tests.
  - Add protocol-to-policy coverage tests.
- Modify `src/extension/background/register-handlers.test.ts`
  - Mock Analytics service.
  - Add Analytics handler test through the background runtime path.
- Create `src/features/genai/server/genai-secret-storage.ts`
  - Map GenAI provider ids to platform secret provider ids.
  - Save, clear, read, and inspect GenAI secrets through `src/platform/secrets`.
- Modify `src/features/genai/server/genai-settings-service.ts`
  - Replace DB-backed GenAI secret storage with `genai-secret-storage.ts`.
  - Keep service function signatures stable for runtime handlers.
- Delete `src/features/genai/server/genai-secrets-store.ts`
  - Remove DB-backed raw secret persistence.
- Modify or delete `src/features/genai/server/genai-secrets-store.test.ts`
  - Replace with storage tests for the new trusted secret adapter.
- Modify `src/features/genai/server/genai-settings-service.test.ts`
  - Assert no `settings_kv` `genai-secrets` row is written.
- Modify `src/features/leetcode-review-assistant/server/runtime-handler-service.ts`
  - Gate AI provider calls with an explicit feature flag until host permissions
    are approved.
- Modify `src/features/leetcode-review-assistant/server/runtime-handler-service.test.ts`
  - Cover the gated response and prove provider network orchestration is not
    called while gated.
- Modify `wxt.config.ts`
  - Keep provider host permissions absent while AI calls are gated.
- Modify `src/testing/architecture-boundaries.test.ts`
  - Add static checks for manifest permission intent and GenAI DB secret
    storage removal.
- Modify `docs/product.md`
  - Document Analytics as a lightweight real dashboard route.
  - Document AI recommendations as configured but gated until provider host
    permissions are explicitly approved.
- Modify `docs/architecture.md`
  - Add Analytics and GenAI ownership notes.
  - Document GenAI secret storage under `src/platform/secrets`.
- Modify `docs/testing.md`
  - Add smoke coverage for Analytics.
  - Add AI settings and gated recommendation checks.
  - Add due-notification permission note.
- Modify `docs/superpowers/README.md`
  - Index this design and plan.

## Task 1: Runtime Policy And Analytics Authorization

**Files:**

- Modify: `src/extension/messaging.ts`
- Modify: `src/extension/background/runtime-policy.ts`
- Modify: `src/extension/background/runtime-policy.test.ts`
- Test: `src/extension/background/runtime-policy.test.ts`

- [ ] **Step 1: Add failing runtime policy tests**

Add these imports in `src/extension/background/runtime-policy.test.ts`:

```ts
import { protocolMethodNames } from '@/extension/messaging'
import {
  extensionMethodNames,
  assertCanCallExtensionMethod,
  assertCanSenderCallExtensionMethod,
  canCallExtensionMethod,
  getMessageSenderSurface,
  isExtensionMethod,
} from './runtime-policy'
```

Add these tests inside `describe('runtime-policy', () => { ... })`:

```ts
it('allows dashboard senders to read analytics summary', () => {
  expect(canCallExtensionMethod('analytics.getSummary', 'dashboard')).toBe(true)
  expect(canCallExtensionMethod('analytics.getSummary', 'popup')).toBe(false)
  expect(canCallExtensionMethod('analytics.getSummary', 'content-script')).toBe(
    false,
  )
})

it('keeps protocol methods covered by runtime sender policy', () => {
  expect([...extensionMethodNames].sort()).toEqual(
    [...protocolMethodNames].sort(),
  )
})
```

- [ ] **Step 2: Run the failing policy tests**

Run:

```sh
npm run test -- src/extension/background/runtime-policy.test.ts
```

Expected: fail because `protocolMethodNames` and `extensionMethodNames` do not
exist, and `analytics.getSummary` is not authorized.

- [ ] **Step 3: Add the protocol method list**

In `src/extension/messaging.ts`, add this after the `ProtocolMap` interface and
before `defineExtensionMessaging`:

```ts
export const protocolMethodNames = [
  'analytics.getSummary',
  'cache.invalidate',
  'runtime.ping',
  'app.getShellData',
  'app.openDashboard',
  'backup.exportFullBackup',
  'backup.validateFullBackup',
  'backup.restoreFullBackup',
  'backup.resetLocalData',
  'genai.getAiProviderSecretPresence',
  'genai.setAiProviderSecret',
  'genai.clearAiProviderSecret',
  'genai.recommendLeetCodeAssessment',
  'sync.getStatus',
  'sync.validateGithubToken',
  'sync.validateStoredGithubToken',
  'sync.saveGithubToken',
  'sync.deleteGithubToken',
  'sync.createGithubGist',
  'sync.connectGithubGist',
  'sync.setEnabled',
  'sync.checkRemoteOnOpen',
  'sync.pullLatest',
  'sync.pushLocal',
  'problems.upsertFromPage',
  'problems.getLibrary',
  'problems.getProblemForEdit',
  'problems.createProblem',
  'problems.updateProblem',
  'problems.deleteProblem',
  'problems.bulkUpdateProblems',
  'problems.bulkDelete',
  'practice.saveReviewResult',
  'practice.getDetails',
  'practice.overrideLastReviewResult',
  'practice.setSuspended',
  'practice.resetSchedule',
  'practice.updateCurrentLog',
  'queue.getTodayQueue',
  'tracks.getActiveTrack',
  'tracks.getWorkspace',
  'tracks.getTrackForEdit',
  'tracks.setActiveTrack',
  'tracks.clearActiveTrack',
  'tracks.setActiveGroup',
  'tracks.createTrack',
  'tracks.updateTrack',
  'tracks.deleteTrack',
  'tracks.resetTrackProgress',
  'settings.getSettings',
  'settings.updateSettings',
  'settings.toggleStudyMode',
  'settings.cycleThemeMode',
  'leetcode.readProblemMetadata',
  'leetcode.readProblemContent',
  'leetcode.readSubmissionResult',
] as const satisfies readonly (keyof ProtocolMap)[]

type MissingProtocolMethod = Exclude<
  keyof ProtocolMap,
  (typeof protocolMethodNames)[number]
>

const protocolMethodCoverageCheck: Record<MissingProtocolMethod, never> = {}
void protocolMethodCoverageCheck
```

- [ ] **Step 4: Authorize Analytics and export policy method names**

In `src/extension/background/runtime-policy.ts`, add Analytics to
`methodSurfaceAccess`:

```ts
const methodSurfaceAccess = {
  'analytics.getSummary': ['dashboard'],
  'runtime.ping': ['background', 'popup', 'dashboard', 'content-script'],
```

Add this export after the `methodSurfaceAccess` declaration:

```ts
export const extensionMethodNames = Object.keys(methodSurfaceAccess) as Array<
  keyof typeof methodSurfaceAccess
>
```

- [ ] **Step 5: Run policy tests**

Run:

```sh
npm run test -- src/extension/background/runtime-policy.test.ts
```

Expected: pass.

- [ ] **Step 6: Commit Task 1**

Run:

```sh
git add src/extension/messaging.ts \
  src/extension/background/runtime-policy.ts \
  src/extension/background/runtime-policy.test.ts
git commit -m "fix(runtime): authorize analytics and cover protocol policy"
```

## Task 2: Analytics Background Handler Coverage

**Files:**

- Modify: `src/extension/background/register-handlers.test.ts`
- Test: `src/extension/background/register-handlers.test.ts`

- [ ] **Step 1: Add failing handler test setup**

In the hoisted `backgroundMocks` object in
`src/extension/background/register-handlers.test.ts`, add:

```ts
getAnalyticsSummary: vi.fn(),
```

Add this mock near the existing feature service mocks:

```ts
vi.mock('@/features/analytics/server/analytics-service', () => ({
  getAnalyticsSummary: backgroundMocks.getAnalyticsSummary,
}))
```

In `beforeEach`, add:

```ts
backgroundMocks.getAnalyticsSummary.mockResolvedValue({
  generatedAt: '2026-01-15T12:00:00.000Z',
  reviewDays: 3,
  totalReviews: 12,
  currentStreak: 2,
  retentionProxy: 0.75,
  retentionProxyLabel: '75%',
  retentionSampleSize: 12,
  lowSample: false,
  dueForecast14Days: Array.from({ length: 14 }, (_, index) => ({
    date: `2026-01-${String(15 + index).padStart(2, '0')}`,
    dueCount: index,
  })),
  weakProblems: [],
})
```

Add this test inside `describe('background handler registration', () => { ... })`:

```ts
it('registers analytics summary handling with dashboard policy and response parsing', async () => {
  const response = await sendRuntimeMessage('analytics.getSummary', {})

  expectRuntimePolicy('analytics.getSummary', 'dashboard')
  expect(backgroundMocks.getAppDb).toHaveBeenCalledTimes(1)
  expect(backgroundMocks.getAnalyticsSummary).toHaveBeenCalledWith(
    backgroundMocks.db,
  )
  expect(response).toMatchObject({
    generatedAt: '2026-01-15T12:00:00.000Z',
    reviewDays: 3,
    totalReviews: 12,
    currentStreak: 2,
    retentionProxyLabel: '75%',
    weakProblems: [],
  })
})
```

- [ ] **Step 2: Run handler test to verify failure**

Run:

```sh
npm run test -- src/extension/background/register-handlers.test.ts -t "analytics summary"
```

Expected: fail until the Analytics service mock is wired correctly.

- [ ] **Step 3: Fix any mock ordering or sender expectations**

If the sender helper defaults are not dashboard-compatible, call the handler
with dashboard sender data:

```ts
const response = await sendRuntimeMessage(
  'analytics.getSummary',
  {},
  { url: 'chrome-extension://extension-id/dashboard.html' },
)
```

Keep the assertion:

```ts
expectRuntimePolicy('analytics.getSummary', 'dashboard')
```

- [ ] **Step 4: Run handler tests**

Run:

```sh
npm run test -- src/extension/background/register-handlers.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit Task 2**

Run:

```sh
git add src/extension/background/register-handlers.test.ts
git commit -m "test(runtime): cover analytics handler registration"
```

## Task 3: Move GenAI Secrets To Trusted Storage

**Files:**

- Create: `src/features/genai/server/genai-secret-storage.ts`
- Modify: `src/features/genai/server/genai-settings-service.ts`
- Delete: `src/features/genai/server/genai-secrets-store.ts`
- Modify: `src/features/genai/server/genai-settings-service.test.ts`
- Modify: `src/features/genai/server/genai-secrets-store.test.ts`
- Test: `src/features/genai/server/genai-settings-service.test.ts`
- Test: `src/features/genai/server/genai-secrets-store.test.ts`

- [ ] **Step 1: Replace DB-store tests with trusted-storage tests**

Replace `src/features/genai/server/genai-secrets-store.test.ts` with:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearAiProviderSecretFromTrustedStorage,
  getAiProviderSecretPresenceFromTrustedStorage,
  loadAiProviderSecretFromTrustedStorage,
  saveAiProviderSecretToTrustedStorage,
} from './genai-secret-storage'

const secretStoreMocks = vi.hoisted(() => ({
  deleteSecret: vi.fn(),
  getSecretStatus: vi.fn(),
  readSecret: vi.fn(),
  saveSecret: vi.fn(),
}))

vi.mock('@/platform/secrets', () => ({
  deleteSecret: secretStoreMocks.deleteSecret,
  getSecretStatus: secretStoreMocks.getSecretStatus,
  readSecret: secretStoreMocks.readSecret,
  saveSecret: secretStoreMocks.saveSecret,
}))

describe('genai trusted secret storage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    secretStoreMocks.getSecretStatus.mockResolvedValue({
      provider: 'genai:openai',
      configured: false,
      updatedAt: null,
      fingerprint: null,
    })
    secretStoreMocks.readSecret.mockResolvedValue(null)
  })

  it('saves provider keys through platform secret storage', async () => {
    await saveAiProviderSecretToTrustedStorage('openai', {
      apiKey: ' sk-test ',
    })

    expect(secretStoreMocks.saveSecret).toHaveBeenCalledWith(
      'genai:openai',
      'sk-test',
    )
  })

  it('loads provider keys without exposing them through presence', async () => {
    secretStoreMocks.readSecret.mockResolvedValue('sk-test')

    await expect(
      loadAiProviderSecretFromTrustedStorage('openai'),
    ).resolves.toEqual({ apiKey: 'sk-test' })

    expect(secretStoreMocks.readSecret).toHaveBeenCalledWith('genai:openai')
  })

  it('maps Gemini to the existing genai:google secret provider id', async () => {
    await clearAiProviderSecretFromTrustedStorage('gemini')

    expect(secretStoreMocks.deleteSecret).toHaveBeenCalledWith('genai:google')
  })

  it('returns provider presence without raw secret values', async () => {
    secretStoreMocks.getSecretStatus.mockImplementation((provider: string) =>
      Promise.resolve({
        provider,
        configured: provider === 'genai:anthropic',
        updatedAt:
          provider === 'genai:anthropic' ? '2026-06-07T00:00:00.000Z' : null,
        fingerprint: provider === 'genai:anthropic' ? 'abcdef123456' : null,
      }),
    )

    const presence = await getAiProviderSecretPresenceFromTrustedStorage()

    expect(presence).toEqual({
      openai: false,
      anthropic: true,
      gemini: false,
    })
    expect(JSON.stringify(presence)).not.toContain('sk-')
  })
})
```

- [ ] **Step 2: Run the failing trusted-storage tests**

Run:

```sh
npm run test -- src/features/genai/server/genai-secrets-store.test.ts
```

Expected: fail because `genai-secret-storage.ts` does not exist.

- [ ] **Step 3: Add trusted GenAI secret adapter**

Create `src/features/genai/server/genai-secret-storage.ts`:

```ts
import {
  deleteSecret,
  getSecretStatus,
  readSecret,
  saveSecret,
  type SecretProviderId,
} from '@/platform/secrets'

import {
  makeEmptyAiProviderSecretPresence,
  type AiProviderSecret,
  type AiProviderSecretPresence,
} from '../domain/genai-secrets-types'
import { genAiProviderIds, type GenAiProviderId } from '../domain/genai-types'

const secretProviderByGenAiProvider = {
  openai: 'genai:openai',
  anthropic: 'genai:anthropic',
  gemini: 'genai:google',
} as const satisfies Record<GenAiProviderId, SecretProviderId>

export async function getAiProviderSecretPresenceFromTrustedStorage(): Promise<AiProviderSecretPresence> {
  const presence = makeEmptyAiProviderSecretPresence()

  await Promise.all(
    genAiProviderIds.map(async (provider) => {
      const status = await getSecretStatus(
        secretProviderByGenAiProvider[provider],
      )
      presence[provider] = status.configured
    }),
  )

  return presence
}

export async function saveAiProviderSecretToTrustedStorage(
  provider: GenAiProviderId,
  secret: AiProviderSecret,
): Promise<void> {
  await saveSecret(
    secretProviderByGenAiProvider[provider],
    secret.apiKey.trim(),
  )
}

export async function clearAiProviderSecretFromTrustedStorage(
  provider: GenAiProviderId,
): Promise<void> {
  await deleteSecret(secretProviderByGenAiProvider[provider])
}

export async function loadAiProviderSecretFromTrustedStorage(
  provider: GenAiProviderId,
): Promise<AiProviderSecret | null> {
  const apiKey = await readSecret(secretProviderByGenAiProvider[provider])

  return apiKey === null ? null : { apiKey }
}
```

- [ ] **Step 4: Update GenAI settings service**

In `src/features/genai/server/genai-settings-service.ts`, remove the
`createGenAiSecretsStore` import and replace secret operations with:

```ts
import {
  clearAiProviderSecretFromTrustedStorage,
  getAiProviderSecretPresenceFromTrustedStorage,
  loadAiProviderSecretFromTrustedStorage,
  saveAiProviderSecretToTrustedStorage,
} from './genai-secret-storage'
```

Use these function bodies:

```ts
export async function getAiProviderSecretPresence(
  _db: Db,
): Promise<AiProviderSecretPresence> {
  return getAiProviderSecretPresenceFromTrustedStorage()
}

export async function setAiProviderSecret(
  _db: Db,
  provider: GenAiProviderId,
  secret: AiProviderSecret,
): Promise<AiProviderSecretPresence> {
  await saveAiProviderSecretToTrustedStorage(provider, secret)
  return getAiProviderSecretPresenceFromTrustedStorage()
}

export async function clearAiProviderSecret(
  _db: Db,
  provider: GenAiProviderId,
): Promise<AiProviderSecretPresence> {
  await clearAiProviderSecretFromTrustedStorage(provider)
  return getAiProviderSecretPresenceFromTrustedStorage()
}
```

In `loadActiveProviderConfig`, replace DB secret reading with:

```ts
const secret = await loadAiProviderSecretFromTrustedStorage(ai.provider)
if (!secret) return null
```

- [ ] **Step 5: Delete DB-backed secret store implementation**

Run:

```sh
rm src/features/genai/server/genai-secrets-store.ts
```

- [ ] **Step 6: Update settings service tests**

In `src/features/genai/server/genai-settings-service.test.ts`, mock
`./genai-secret-storage` and add this test:

```ts
it('does not write GenAI API keys into settings_kv', async () => {
  const handle = await createTestDb()

  await setAiProviderSecret(handle.db, 'openai', { apiKey: 'sk-test' })

  const rows = await handle.db.select().from(settingsKv)
  expect(rows.some((row) => row.key === 'genai-secrets')).toBe(false)
})
```

If the file already uses real DB helpers, import `settingsKv` from
`@/platform/db/schema` and use the existing test DB setup in that file.

- [ ] **Step 7: Run GenAI tests**

Run:

```sh
npm run test -- src/features/genai/server/genai-secrets-store.test.ts \
  src/features/genai/server/genai-settings-service.test.ts
```

Expected: pass.

- [ ] **Step 8: Search for stale DB secret store references**

Run:

```sh
rg -n "createGenAiSecretsStore|GenAiSecretsStore|genai-secrets" src
```

Expected: only backup tests or architecture boundary tests may mention
`genai-secrets` as a forbidden legacy key. No production feature code should
reference the DB-backed store.

- [ ] **Step 9: Commit Task 3**

Run:

```sh
git add src/features/genai/server/genai-secret-storage.ts \
  src/features/genai/server/genai-settings-service.ts \
  src/features/genai/server/genai-secrets-store.test.ts \
  src/features/genai/server/genai-settings-service.test.ts
git add -u src/features/genai/server/genai-secrets-store.ts
git commit -m "fix(genai): store provider keys in trusted secrets"
```

## Task 4: Gate AI Provider Calls Until Host Permission Approval

**Files:**

- Modify: `src/features/leetcode-review-assistant/server/runtime-handler-service.ts`
- Modify: `src/features/leetcode-review-assistant/server/runtime-handler-service.test.ts`
- Modify: `wxt.config.ts`
- Modify: `src/testing/architecture-boundaries.test.ts`
- Test: `src/features/leetcode-review-assistant/server/runtime-handler-service.test.ts`
- Test: `src/testing/architecture-boundaries.test.ts`

- [ ] **Step 1: Add failing gated-runtime test**

In `src/features/leetcode-review-assistant/server/runtime-handler-service.test.ts`,
add a test that configures AI settings and a key, calls
`recommendLeetCodeAssessmentInBackground`, and expects an unavailable response:

```ts
it('returns unavailable while AI provider host permissions are not approved', async () => {
  const handle = await createTestDb()
  await updateSettings(handle.db, {
    aiAssessment: {
      enabled: true,
      provider: 'openai',
      model: 'gpt-test',
    },
  })
  await setAiProviderSecret(handle.db, 'openai', { apiKey: 'sk-test' })

  const response = await recommendLeetCodeAssessmentInBackground(
    handle.db,
    createRecommendLeetCodeAssessmentRequest(),
  )

  expect(response).toMatchObject({
    status: 'unavailable',
    message:
      'AI recommendations are disabled until provider host permissions are approved.',
  })
  expect(recommendAssessment).not.toHaveBeenCalled()
})
```

If the file uses a different fixture name, use its existing valid request
fixture and keep the assertion text exact.

- [ ] **Step 2: Add manifest static test**

In `src/testing/architecture-boundaries.test.ts`, add:

```ts
it('keeps AI provider host permissions absent while recommendation calls are gated', () => {
  const config = readFileSync(join(repoRoot, 'wxt.config.ts'), 'utf8')

  expect(config).not.toContain('https://api.openai.com/*')
  expect(config).not.toContain('https://api.anthropic.com/*')
  expect(config).not.toContain('https://generativelanguage.googleapis.com/*')
})

it('keeps the notifications permission documented for due reminders', () => {
  const config = readFileSync(join(repoRoot, 'wxt.config.ts'), 'utf8')

  expect(config).toContain("'notifications'")
})
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```sh
npm run test -- src/features/leetcode-review-assistant/server/runtime-handler-service.test.ts \
  src/testing/architecture-boundaries.test.ts
```

Expected: runtime handler test fails because provider calls are still attempted
when AI is configured.

- [ ] **Step 4: Add the explicit gate**

In `src/features/leetcode-review-assistant/server/runtime-handler-service.ts`,
add:

```ts
const AI_PROVIDER_HOST_PERMISSIONS_APPROVED = false

const HOST_PERMISSION_GATE_MESSAGE =
  'AI recommendations are disabled until provider host permissions are approved.'
```

After `providerConfig === null` handling and before `recommendAssessment(...)`,
add:

```ts
if (!AI_PROVIDER_HOST_PERMISSIONS_APPROVED) {
  return {
    status: 'unavailable',
    message: HOST_PERMISSION_GATE_MESSAGE,
    submissionFingerprint: request.submissionFingerprint,
  }
}
```

- [ ] **Step 5: Run gated-runtime tests**

Run:

```sh
npm run test -- src/features/leetcode-review-assistant/server/runtime-handler-service.test.ts \
  src/testing/architecture-boundaries.test.ts
```

Expected: pass.

- [ ] **Step 6: Commit Task 4**

Run:

```sh
git add src/features/leetcode-review-assistant/server/runtime-handler-service.ts \
  src/features/leetcode-review-assistant/server/runtime-handler-service.test.ts \
  src/testing/architecture-boundaries.test.ts \
  wxt.config.ts
git commit -m "fix(genai): gate provider calls until host permissions are approved"
```

## Task 5: Documentation Alignment

**Files:**

- Modify: `docs/product.md`
- Modify: `docs/architecture.md`
- Modify: `docs/testing.md`
- Modify: `docs/superpowers/README.md`
- Test: changed Markdown formatting

- [ ] **Step 1: Update product docs**

In `docs/product.md`, replace Analytics reserved/incomplete wording with:

```md
- Analytics is a lightweight dashboard route for local review health, due
  forecast, retention proxy, and weak-problem inspection.
```

In the Dashboard section, add:

```md
- Analytics shows local review-day totals, all-time review counts, current
  streak, a low-sample-aware retention proxy, a 14-day due forecast, and weak
  problems derived from local practice state.
```

In the Settings section, add:

```md
AI assessment settings can store provider preference and model configuration.
Provider API keys are stored in trusted local extension secret storage, never in
backup exports or sync payloads. AI provider calls are currently gated until
provider host permissions receive explicit approval.
```

- [ ] **Step 2: Update architecture docs**

In `docs/architecture.md`, add Analytics and GenAI ownership entries:

```md
- `analytics`: local dashboard review-health read models, due forecast,
  retention proxy, and weak-problem ranking.
- `genai`: AI provider settings contracts, trusted provider key storage,
  provider network adapters, and gated assistant availability.
```

In External APIs and Secrets, add:

```md
GenAI provider keys use `src/platform/secrets` with provider ids
`genai:openai`, `genai:anthropic`, and `genai:google`. UI and runtime status
payloads may expose presence only. Raw keys must not be written to the app
database, backup exports, sync envelopes, logs, or query cache.
```

- [ ] **Step 3: Update testing docs**

In `docs/testing.md`, add an Analytics smoke flow:

```md
### Dashboard Analytics

1. Open the dashboard.
2. Navigate to Analytics.
3. Confirm metric tiles render for review days, total reviews, and retention.
4. Confirm the 14-day due forecast renders.
5. Confirm the weak-problems section renders an empty state or local problem
   rows.

Expected: Analytics loads through the extension runtime without the failed-load
state, and it only reflects local practice data.
```

Add AI settings smoke coverage:

```md
### AI Assessment Settings

1. Open Settings.
2. Find AI assessment.
3. Select a provider and enter a model id.
4. Save and remove a test API key.
5. Confirm the UI shows key presence without revealing the key value.

Expected: provider keys are stored locally in trusted extension secret storage.
AI recommendations remain unavailable until provider host permissions are
explicitly approved.
```

Update incomplete surfaces so Analytics is removed from the reserved list.

- [ ] **Step 4: Index the spec and plan**

In `docs/superpowers/README.md`, add:

```md
- [`specs/2026-06-07-post-analytics-stabilization-design.md`](./specs/2026-06-07-post-analytics-stabilization-design.md):
  approved design for stabilizing post-Analytics work across runtime policy,
  Analytics wiring, GenAI trusted secrets, AI permission gating, notification
  permission documentation, and docs alignment.
```

and:

```md
- [`plans/2026-06-07-post-analytics-stabilization.md`](./plans/2026-06-07-post-analytics-stabilization.md):
  implementation plan for the post-Analytics stabilization pass.
```

- [ ] **Step 5: Format docs**

Run:

```sh
npx prettier --write docs/product.md docs/architecture.md docs/testing.md \
  docs/superpowers/README.md
```

Expected: Prettier completes without errors.

- [ ] **Step 6: Commit Task 5**

Run:

```sh
git add docs/product.md docs/architecture.md docs/testing.md \
  docs/superpowers/README.md
git commit -m "docs: align stabilized analytics and ai behavior"
```

## Task 6: Final Verification And Cleanup

**Files:**

- Modify only files required by failures found in this task.
- Test: focused suites and full checks.

- [ ] **Step 1: Run focused runtime and feature tests**

Run:

```sh
npm run test -- src/extension/background/runtime-policy.test.ts \
  src/extension/background/register-handlers.test.ts \
  src/features/analytics \
  src/features/genai \
  src/features/leetcode-review-assistant \
  src/testing/architecture-boundaries.test.ts
```

Expected: pass.

- [ ] **Step 2: Run stale-reference scans**

Run:

```sh
rg -n "createGenAiSecretsStore|GenAiSecretsStore" src
rg -n "genai-secrets" src/features src/extension src/app
rg -n "https://api.openai.com/\\*|https://api.anthropic.com/\\*|https://generativelanguage.googleapis.com/\\*" wxt.config.ts
```

Expected:

- First command returns no output.
- Second command returns no production writes or reads of `genai-secrets`.
- Third command returns no output while AI provider calls are gated.

- [ ] **Step 3: Run full validation**

Run:

```sh
npm run check
npm run format
```

Expected: both pass.

- [ ] **Step 4: Inspect final diff**

Run:

```sh
git status --short
git diff --stat main..HEAD
git diff --check
```

Expected:

- `git status --short` shows only intentional unstaged changes before the final
  commit.
- `git diff --check` reports no whitespace errors.

- [ ] **Step 5: Commit final cleanup if needed**

If Step 1 through Step 4 required edits not already committed, run:

```sh
git add <changed-files>
git commit -m "chore: complete post-analytics stabilization validation"
```

If no files changed after Task 5, do not create an empty commit.
