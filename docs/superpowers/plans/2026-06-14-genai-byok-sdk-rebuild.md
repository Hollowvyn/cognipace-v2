# GenAI BYOK SDK Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild CogniPace GenAI setup so provider BYOK configuration is a reusable Data Management connection workflow, Assessment has separate Auto and AI toggles, dev smoke reports the real state, and provider calls run behind Vercel AI SDK Core.

**Architecture:** `features/genai` owns provider connection metadata, redacted status contracts, trusted-secret composition, verification, and provider calls. Settings owns normal assessment rules plus Auto/AI assessment toggles only; provider/model/key state leaves Settings. Runtime calls stay Zod-validated and background-owned, with UI access through TanStack Query hooks.

**Tech Stack:** WXT Chrome MV3, React 19, TypeScript, Zod, TanStack Query, Vitest, Testing Library, `platform/secrets`, `chrome.storage.local`, Vercel AI SDK Core (`ai`, `@ai-sdk/google`, `@ai-sdk/openai`, `@ai-sdk/anthropic`).

---

## File Structure

### GenAI Domain, Storage, And API

- Create `src/features/genai/domain/genai-connection-types.ts`
  - Provider labels, model defaults, connection metadata schema, status schema,
    verification result types, and helpers.
- Create `src/features/genai/data/genai-connection-metadata-store.ts`
  - `chrome.storage.local` metadata persistence, Zod parsing, default fallback,
    patch helpers, provider invalidation helpers.
- Modify `src/features/genai/domain/index.ts`
  - Re-export connection metadata/status types and helpers.
- Modify `src/features/genai/index.ts`
  - Re-export new UI hooks and connection types.
- Replace `src/features/genai/api/genai-settings-contracts.ts`
  - Keep legacy secret presence contracts only if needed during migration; add
    provider status, save model, save secret, test draft, verify, select, and
    clear-secret contracts.
- Replace `src/features/genai/api/genai-settings-hooks.ts`
  - Provide status query and setup mutations that invalidate `queryKeys.genai`.
- Modify `src/platform/query/query-keys.ts`
  - Add `queryKeys.genai.status()`.
- Modify `src/platform/query/cache-invalidation.ts`
  - Add `genai` invalidation tag mapped to GenAI status, app-shell, and settings
    where needed.

### GenAI Server And Runtime

- Modify `src/features/genai/server/genai-secret-storage.ts`
  - Keep trusted secret keys; add optional helper to read the selected provider
    secret and invalidate provider verification when a secret changes.
- Modify `src/features/genai/server/genai-settings-service.ts`
  - Implement provider status, model save, secret save/clear, draft test,
    stored verification, provider selection, and active provider resolution.
- Create `src/features/genai/server/genai-provider-verification.ts`
  - Shared verification call using `generateJson` in early phases, then the SDK
    wrapper after the SDK replacement task.
- Modify `src/extension/messaging.ts`
  - Add runtime protocol methods and schemas.
- Modify `src/extension/background/runtime-policy.ts`
  - Allow dashboard setup/status calls; reject content-script setup calls.
- Modify `src/extension/background/register-handlers.ts`
  - Register GenAI setup/status handlers, flush/invalidate after writes, update
    dev-smoke GenAI read path.

### Settings And Assessment

- Modify `src/features/settings/domain/settings.ts`
  - Add `assessment.autoAssessmentEnabled`, default false, patch support, merge
    support, and patch diff support.
  - Keep `aiAssessment.enabled` but stop depending on provider/model in UI.
- Modify `src/features/settings/hooks/use-settings-draft.ts`
  - Replace provider/model actions with `setAutoAssessmentEnabled` and
    `setAiAssessmentEnabled`.
  - Enforce `AI on => Auto on` and `Auto off => AI off`.
- Replace `src/features/settings/components/sections/ai-assessment-section.tsx`
  - Rename to `assessment-section.tsx` or replace contents with an Assessment
    section that renders Auto assessment, AI assessment, and warning/status.
- Modify `src/features/settings/components/settings-screen.tsx`
  - Use the new Assessment section and pass provider status or hook output as
    needed.

### Data Management AI Provider UI

- Create `src/features/genai/hooks/use-genai-provider-controller.ts`
  - Compose status query and mutations into stable actions for the panel/dialog.
- Create `src/features/genai/components/ai-provider-settings-section.tsx`
  - Data Management panel matching GitHub Sync's connection-summary pattern.
- Create `src/features/genai/components/ai-provider-connection-dialog.tsx`
  - Provider/model/key/verify dialog with masked stored key behavior.
- Create focused component and hook tests for the controller, panel, and dialog.
- Modify `src/features/backup/components/data-management-screen.tsx`
  - Render the AI Provider panel next to GitHub Sync.

### App Shell, Overlay, Dev Smoke

- Modify `src/features/app-shell/server/app-shell-service.ts`
  - Overlay `aiAssessmentAvailable` depends on Auto assessment, AI assessment,
    selected verified provider, and trusted secret presence.
- Modify `src/features/app-shell/api/app-shell-contracts.ts`
  - `settings.assessment` includes `autoAssessmentEnabled`.
- Modify overlay tests that construct settings fixtures.
- Modify `src/extension/background/dev-smoke-service.ts`
  - Report Auto assessment, AI assessment, selected provider, selected model,
    secret presence, verification state, and specific unavailable reason.
- Modify `src/features/dev-smoke/api/dev-smoke-contracts.ts`
  - Add optional session-only diagnostics fields if needed.
- Modify `src/features/dev-smoke/components/dev-smoke-screen.tsx`
  - Render diagnostics without exposing secret values.

### Vercel AI SDK Runtime

- Modify `package.json` and `package-lock.json`
  - Add `ai`, `@ai-sdk/google`, `@ai-sdk/openai`, `@ai-sdk/anthropic`.
- Create `src/features/genai/server/providers/ai-sdk-provider.ts`
  - Resolve CogniPace provider config to an SDK language model and run
    `generateObject`.
- Modify `src/features/genai/server/genai-service.ts`
  - Delegate to the SDK-backed provider wrapper.
- Delete or stop importing `src/features/genai/server/providers/openai.ts`,
  `anthropic.ts`, and `gemini.ts` after replacement tests cover equivalent
  behavior.

### Docs

- Modify `docs/product.md`
- Modify `docs/architecture.md`
- Modify `docs/testing.md`
- Modify `docs/superpowers/README.md` if plan status needs indexing.

---

## Task 1: GenAI Connection Metadata Store

**Files:**

- Create: `src/features/genai/domain/genai-connection-types.ts`
- Create: `src/features/genai/data/genai-connection-metadata-store.ts`
- Test: `src/features/genai/data/genai-connection-metadata-store.test.ts`
- Modify: `src/features/genai/domain/index.ts`
- Modify: `src/features/genai/index.ts`

- [ ] **Step 1: Write the failing metadata store tests**

Create `src/features/genai/data/genai-connection-metadata-store.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'

import {
  defaultGenAiConnectionMetadata,
  readGenAiConnectionMetadata,
  resetProviderVerification,
  selectGenAiProvider,
  updateGenAiProviderModel,
  writeGenAiConnectionMetadata,
} from './genai-connection-metadata-store'

describe('genai connection metadata store', () => {
  beforeEach(async () => {
    await chrome.storage.local.clear()
  })

  it('defaults to Gemini with model defaults and unverified providers', async () => {
    await expect(readGenAiConnectionMetadata()).resolves.toEqual(
      defaultGenAiConnectionMetadata,
    )
  })

  it('falls back to defaults when stored metadata is invalid', async () => {
    await chrome.storage.local.set({
      cognipace_genai_connection_metadata_v1: { selectedProvider: 'bad' },
    })

    await expect(readGenAiConnectionMetadata()).resolves.toEqual(
      defaultGenAiConnectionMetadata,
    )
  })

  it('persists selected provider changes with updatedAt', async () => {
    const next = await selectGenAiProvider(
      'openai',
      new Date('2026-06-14T10:00:00.000Z'),
    )

    expect(next.selectedProvider).toBe('openai')
    expect(next.updatedAt).toBe('2026-06-14T10:00:00.000Z')
    await expect(readGenAiConnectionMetadata()).resolves.toMatchObject({
      selectedProvider: 'openai',
    })
  })

  it('saves model changes and resets verification for that provider', async () => {
    await writeGenAiConnectionMetadata({
      ...defaultGenAiConnectionMetadata,
      providers: {
        ...defaultGenAiConnectionMetadata.providers,
        gemini: {
          ...defaultGenAiConnectionMetadata.providers.gemini,
          verification: {
            state: 'valid',
            verifiedAt: '2026-06-14T09:00:00.000Z',
            checkedModel: 'gemini-2.5-flash',
            errorCode: null,
            message: null,
          },
        },
      },
      updatedAt: '2026-06-14T09:00:00.000Z',
    })

    const next = await updateGenAiProviderModel(
      'gemini',
      'gemini-3.5-flash',
      new Date('2026-06-14T10:00:00.000Z'),
    )

    expect(next.providers.gemini.model).toBe('gemini-3.5-flash')
    expect(next.providers.gemini.verification).toEqual({
      state: 'unverified',
      verifiedAt: null,
      checkedModel: null,
      errorCode: null,
      message: null,
    })
  })

  it('resets verification when a provider secret changes', async () => {
    await writeGenAiConnectionMetadata({
      ...defaultGenAiConnectionMetadata,
      providers: {
        ...defaultGenAiConnectionMetadata.providers,
        openai: {
          ...defaultGenAiConnectionMetadata.providers.openai,
          verification: {
            state: 'valid',
            verifiedAt: '2026-06-14T09:00:00.000Z',
            checkedModel: 'gpt-4o-mini',
            errorCode: null,
            message: null,
          },
        },
      },
      updatedAt: '2026-06-14T09:00:00.000Z',
    })

    const next = await resetProviderVerification(
      'openai',
      new Date('2026-06-14T10:00:00.000Z'),
    )

    expect(next.providers.openai.verification.state).toBe('unverified')
    expect(next.providers.gemini.verification.state).toBe('unverified')
  })
})
```

- [ ] **Step 2: Run the failing metadata store tests**

Run:

```sh
npx vitest run src/features/genai/data/genai-connection-metadata-store.test.ts
```

Expected: FAIL because the new metadata types/store do not exist.

- [ ] **Step 3: Implement connection types**

Create `src/features/genai/domain/genai-connection-types.ts`:

```ts
import { z } from 'zod'

import {
  genAiProviderIds,
  type GenAiError,
  type GenAiProviderId,
} from './genai-types'

export const genAiProviderLabels = {
  gemini: 'Gemini',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
} as const satisfies Record<GenAiProviderId, string>

export const genAiProviderDefaultModels = {
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-haiku-4-5',
} as const satisfies Record<GenAiProviderId, string>

export const genAiVerificationStates = [
  'unverified',
  'valid',
  'invalid',
] as const
export type GenAiVerificationState = (typeof genAiVerificationStates)[number]

export const genAiVerificationErrorCodes = [
  'auth',
  'rate-limit',
  'network',
  'timeout',
  'invalid-model',
  'invalid-output',
  'unknown',
] as const
export type GenAiVerificationErrorCode =
  (typeof genAiVerificationErrorCodes)[number]

export const genAiProviderVerificationSchema = z.strictObject({
  state: z.enum(genAiVerificationStates),
  verifiedAt: z.iso.datetime().nullable(),
  checkedModel: z.string().nullable(),
  errorCode: z.enum(genAiVerificationErrorCodes).nullable(),
  message: z.string().nullable(),
})

export const genAiProviderConnectionSchema = z.strictObject({
  model: z.string().max(120),
  verification: genAiProviderVerificationSchema,
})

export const genAiConnectionMetadataSchema = z.strictObject({
  schemaVersion: z.literal(1),
  selectedProvider: z.enum(genAiProviderIds),
  providers: z.strictObject({
    gemini: genAiProviderConnectionSchema,
    openai: genAiProviderConnectionSchema,
    anthropic: genAiProviderConnectionSchema,
  }),
  updatedAt: z.iso.datetime(),
})

export type GenAiProviderVerification = z.infer<
  typeof genAiProviderVerificationSchema
>
export type GenAiProviderConnection = z.infer<
  typeof genAiProviderConnectionSchema
>
export type GenAiConnectionMetadata = z.infer<
  typeof genAiConnectionMetadataSchema
>

export type GenAiProviderStatus = {
  selectedProvider: GenAiProviderId
  selectedReady: boolean
  providers: Array<{
    provider: GenAiProviderId
    label: string
    model: string
    secretConfigured: boolean
    verificationState: GenAiVerificationState
    verifiedAt: string | null
    lastErrorCode: GenAiVerificationErrorCode | null
    lastErrorMessage: string | null
  }>
}

export type GenAiProviderAction =
  | 'save-model'
  | 'save-secret'
  | 'clear-secret'
  | 'select-provider'
  | 'test-draft'
  | 'verify-provider'

export type GenAiProviderActionResult = {
  action: GenAiProviderAction
  outcome: 'success' | 'error'
  message: string
  status: GenAiProviderStatus
  occurredAt: string
}

export function createUnverifiedProviderVerification(): GenAiProviderVerification {
  return {
    state: 'unverified',
    verifiedAt: null,
    checkedModel: null,
    errorCode: null,
    message: null,
  }
}

export function mapGenAiErrorToVerificationError(
  code: GenAiError,
): GenAiVerificationErrorCode {
  if (code === 'not-configured') return 'unknown'
  return code === 'invalid-output' ? 'invalid-output' : code
}
```

- [ ] **Step 4: Implement metadata store**

Create `src/features/genai/data/genai-connection-metadata-store.ts`:

```ts
import { z } from 'zod'

import {
  createUnverifiedProviderVerification,
  genAiConnectionMetadataSchema,
  genAiProviderDefaultModels,
  type GenAiConnectionMetadata,
} from '../domain/genai-connection-types'
import type { GenAiProviderId } from '../domain/genai-types'

const genAiConnectionMetadataKey = 'cognipace_genai_connection_metadata_v1'
const defaultTimestamp = '2026-06-14T00:00:00.000Z'

export const defaultGenAiConnectionMetadata: GenAiConnectionMetadata = {
  schemaVersion: 1,
  selectedProvider: 'gemini',
  providers: {
    gemini: {
      model: genAiProviderDefaultModels.gemini,
      verification: createUnverifiedProviderVerification(),
    },
    openai: {
      model: genAiProviderDefaultModels.openai,
      verification: createUnverifiedProviderVerification(),
    },
    anthropic: {
      model: genAiProviderDefaultModels.anthropic,
      verification: createUnverifiedProviderVerification(),
    },
  },
  updatedAt: defaultTimestamp,
}

export async function readGenAiConnectionMetadata(): Promise<GenAiConnectionMetadata> {
  const result = await readChromeLocalStorage().get(genAiConnectionMetadataKey)
  const parsed = genAiConnectionMetadataSchema.safeParse(
    result[genAiConnectionMetadataKey],
  )

  return parsed.success
    ? parsed.data
    : structuredClone(defaultGenAiConnectionMetadata)
}

export async function writeGenAiConnectionMetadata(
  metadata: GenAiConnectionMetadata,
): Promise<GenAiConnectionMetadata> {
  const next = genAiConnectionMetadataSchema.parse(metadata)
  await readChromeLocalStorage().set({ [genAiConnectionMetadataKey]: next })
  return next
}

export async function selectGenAiProvider(
  provider: GenAiProviderId,
  now = new Date(),
): Promise<GenAiConnectionMetadata> {
  const current = await readGenAiConnectionMetadata()
  return writeGenAiConnectionMetadata({
    ...current,
    selectedProvider: provider,
    updatedAt: now.toISOString(),
  })
}

export async function updateGenAiProviderModel(
  provider: GenAiProviderId,
  model: string,
  now = new Date(),
): Promise<GenAiConnectionMetadata> {
  const current = await readGenAiConnectionMetadata()
  return writeGenAiConnectionMetadata({
    ...current,
    providers: {
      ...current.providers,
      [provider]: {
        ...current.providers[provider],
        model,
        verification: createUnverifiedProviderVerification(),
      },
    },
    updatedAt: now.toISOString(),
  })
}

export async function resetProviderVerification(
  provider: GenAiProviderId,
  now = new Date(),
): Promise<GenAiConnectionMetadata> {
  const current = await readGenAiConnectionMetadata()
  return writeGenAiConnectionMetadata({
    ...current,
    providers: {
      ...current.providers,
      [provider]: {
        ...current.providers[provider],
        verification: createUnverifiedProviderVerification(),
      },
    },
    updatedAt: now.toISOString(),
  })
}

export async function updateProviderVerification(
  provider: GenAiProviderId,
  verification: GenAiConnectionMetadata['providers'][GenAiProviderId]['verification'],
  now = new Date(),
): Promise<GenAiConnectionMetadata> {
  const current = await readGenAiConnectionMetadata()
  return writeGenAiConnectionMetadata({
    ...current,
    providers: {
      ...current.providers,
      [provider]: {
        ...current.providers[provider],
        verification,
      },
    },
    updatedAt: now.toISOString(),
  })
}

function readChromeLocalStorage(): ChromeStorageLocal {
  if (
    typeof chrome === 'undefined' ||
    typeof chrome.storage === 'undefined' ||
    typeof chrome.storage.local === 'undefined'
  ) {
    throw new Error('chrome.storage.local is not available.')
  }

  return chrome.storage.local
}

type ChromeStorageLocal = {
  get(keys: string[] | string): Promise<Record<string, unknown>>
  set(values: Record<string, unknown>): Promise<void>
}
```

- [ ] **Step 5: Re-export metadata types**

Modify `src/features/genai/domain/index.ts` and `src/features/genai/index.ts` to export the new types and helpers. Use explicit exports, following existing style.

- [ ] **Step 6: Run metadata tests**

Run:

```sh
npx vitest run src/features/genai/data/genai-connection-metadata-store.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 1**

```sh
git add src/features/genai/domain src/features/genai/data src/features/genai/index.ts
git commit -m "feat(genai): add provider connection metadata"
```

---

## Task 2: GenAI Status Contracts, Hooks, And Runtime Methods

**Files:**

- Modify: `src/features/genai/api/genai-settings-contracts.ts`
- Modify: `src/features/genai/api/genai-settings-contracts.test.ts`
- Modify: `src/features/genai/api/genai-settings-hooks.ts`
- Modify: `src/features/genai/api/genai-settings-hooks.test.tsx`
- Modify: `src/platform/query/query-keys.ts`
- Modify: `src/platform/query/cache-invalidation.ts`
- Modify: `src/extension/messaging.ts`
- Modify: `src/extension/background/runtime-policy.ts`
- Modify: `src/extension/background/runtime-policy.test.ts`

- [ ] **Step 1: Write failing contract tests**

Extend `src/features/genai/api/genai-settings-contracts.test.ts`:

```ts
import {
  genAiProviderActionResultSchema,
  genAiProviderStatusSchema,
  saveGenAiProviderSecretRequestSchema,
  testGenAiProviderDraftRequestSchema,
} from './genai-settings-contracts'

it('accepts redacted provider status without secret values', () => {
  const status = genAiProviderStatusSchema.parse({
    selectedProvider: 'gemini',
    selectedReady: false,
    providers: [
      {
        provider: 'gemini',
        label: 'Gemini',
        model: 'gemini-2.5-flash',
        secretConfigured: true,
        verificationState: 'unverified',
        verifiedAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    ],
  })

  expect(JSON.stringify(status)).not.toMatch(/apiKey|AIza|sk-/)
})

it('keeps raw keys request-only and never in action results', () => {
  expect(
    saveGenAiProviderSecretRequestSchema.parse({
      surface: 'dashboard',
      provider: 'gemini',
      secret: { apiKey: 'AIza-test' },
    }),
  ).toEqual({
    surface: 'dashboard',
    provider: 'gemini',
    secret: { apiKey: 'AIza-test' },
  })

  expect(
    testGenAiProviderDraftRequestSchema.parse({
      surface: 'dashboard',
      provider: 'openai',
      model: 'gpt-4o-mini',
      secret: { apiKey: 'sk-test' },
    }),
  ).toMatchObject({ provider: 'openai', model: 'gpt-4o-mini' })

  const result = genAiProviderActionResultSchema.parse({
    action: 'verify-provider',
    outcome: 'success',
    message: 'Provider verified.',
    occurredAt: '2026-06-14T10:00:00.000Z',
    status: {
      selectedProvider: 'gemini',
      selectedReady: true,
      providers: [],
    },
  })
  expect(JSON.stringify(result)).not.toMatch(/apiKey|AIza|sk-/)
})
```

- [ ] **Step 2: Run contract tests to verify failure**

Run:

```sh
npx vitest run src/features/genai/api/genai-settings-contracts.test.ts
```

Expected: FAIL because new schemas are missing.

- [ ] **Step 3: Implement contracts**

Update `src/features/genai/api/genai-settings-contracts.ts` with these additional schemas and exported types:

```ts
export const genAiSetupSurfaceSchema = z.literal('dashboard')

export const genAiProviderVerificationStateSchema = z.enum([
  'unverified',
  'valid',
  'invalid',
])

export const genAiProviderStatusSchema = z.strictObject({
  selectedProvider: z.enum(genAiProviderIds),
  selectedReady: z.boolean(),
  providers: z.array(
    z.strictObject({
      provider: z.enum(genAiProviderIds),
      label: z.string(),
      model: z.string(),
      secretConfigured: z.boolean(),
      verificationState: genAiProviderVerificationStateSchema,
      verifiedAt: z.iso.datetime().nullable(),
      lastErrorCode: z
        .enum([
          'auth',
          'rate-limit',
          'network',
          'timeout',
          'invalid-model',
          'invalid-output',
          'unknown',
        ])
        .nullable(),
      lastErrorMessage: z.string().nullable(),
    }),
  ),
})

export const genAiProviderActionResultSchema = z.strictObject({
  action: z.enum([
    'save-model',
    'save-secret',
    'clear-secret',
    'select-provider',
    'test-draft',
    'verify-provider',
  ]),
  outcome: z.enum(['success', 'error']),
  message: z.string(),
  status: genAiProviderStatusSchema,
  occurredAt: z.iso.datetime(),
})

export const getGenAiProviderStatusRequestSchema = z.strictObject({
  surface: genAiSetupSurfaceSchema,
})

export const saveGenAiProviderModelRequestSchema = z.strictObject({
  surface: genAiSetupSurfaceSchema,
  provider: z.enum(genAiProviderIds),
  model: z.string().trim().min(1).max(120),
})

export const saveGenAiProviderSecretRequestSchema = z.strictObject({
  surface: genAiSetupSurfaceSchema,
  provider: z.enum(genAiProviderIds),
  secret: aiProviderSecretBodySchema,
})

export const testGenAiProviderDraftRequestSchema = z.strictObject({
  surface: genAiSetupSurfaceSchema,
  provider: z.enum(genAiProviderIds),
  model: z.string().trim().min(1).max(120),
  secret: aiProviderSecretBodySchema,
})

export const verifyGenAiProviderRequestSchema = z.strictObject({
  surface: genAiSetupSurfaceSchema,
  provider: z.enum(genAiProviderIds),
})

export const selectGenAiProviderRequestSchema = z.strictObject({
  surface: genAiSetupSurfaceSchema,
  provider: z.enum(genAiProviderIds),
})

export const clearGenAiProviderSecretRequestSchema = z.strictObject({
  surface: genAiSetupSurfaceSchema,
  provider: z.enum(genAiProviderIds),
})
```

Export `z.infer` types for every new schema.

- [ ] **Step 4: Add query keys and invalidation**

Update `src/platform/query/query-keys.ts`:

```ts
genai: {
  all: ['genai'] as const,
  status: () => [...queryKeys.genai.all, 'status'] as const,
  secretPresence: () => [...queryKeys.genai.all, 'secret-presence'] as const,
},
```

Update `src/platform/query/cache-invalidation.ts`:

```ts
export const cacheInvalidationTags = [
  'analytics',
  'app-shell',
  'genai',
  'practice',
  'problems',
  'queue',
  'settings',
  'sync',
  'tracks',
] as const
```

Map `genai` to `[queryKeys.genai.all, queryKeys.appShell.all]`.

- [ ] **Step 5: Implement hooks**

Replace `src/features/genai/api/genai-settings-hooks.ts` with a status-first API:

```ts
export function useGenAiProviderStatusQuery() {
  return useQuery({
    queryKey: queryKeys.genai.status(),
    queryFn: () =>
      sendMessage('genai.getProviderStatus', { surface: 'dashboard' }),
  })
}

export function useGenAiProviderAction<TVariables>(
  mutationFn: (variables: TVariables) => Promise<unknown>,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.genai.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.appShell.all })
    },
  })
}
```

Add concrete hooks:

- `useSaveGenAiProviderModelMutation`
- `useSaveGenAiProviderSecretMutation`
- `useTestGenAiProviderDraftMutation`
- `useVerifyGenAiProviderMutation`
- `useSelectGenAiProviderMutation`
- `useClearGenAiProviderSecretMutation`

Keep legacy `useGenAiSecretPresenceQuery`, `useSetAiProviderSecretMutation`,
and `useClearAiProviderSecretMutation` as wrappers only if old tests still need
them during this phase. Remove old UI use in later tasks.

- [ ] **Step 6: Update hook tests**

Update `src/features/genai/api/genai-settings-hooks.test.tsx` to assert:

```ts
expect(sendMessage).toHaveBeenCalledWith('genai.getProviderStatus', {
  surface: 'dashboard',
})
expect(sendMessage).toHaveBeenCalledWith('genai.saveProviderModel', {
  surface: 'dashboard',
  provider: 'gemini',
  model: 'gemini-2.5-flash',
})
expect(sendMessage).toHaveBeenCalledWith('genai.saveProviderSecret', {
  surface: 'dashboard',
  provider: 'gemini',
  secret: { apiKey: 'AIza-test' },
})
expect(sendMessage).toHaveBeenCalledWith('genai.testProviderDraft', {
  surface: 'dashboard',
  provider: 'gemini',
  model: 'gemini-2.5-flash',
  secret: { apiKey: 'AIza-test' },
})
```

- [ ] **Step 7: Add protocol and runtime policy**

Modify `src/extension/messaging.ts`:

- Import and export the new request schemas.
- Add `ProtocolMap` methods:
  - `genai.getProviderStatus`
  - `genai.saveProviderModel`
  - `genai.saveProviderSecret`
  - `genai.testProviderDraft`
  - `genai.verifyProvider`
  - `genai.selectProvider`
  - `genai.clearProviderSecret`

Modify `src/extension/background/runtime-policy.ts`:

```ts
'genai.getProviderStatus': ['dashboard'],
'genai.saveProviderModel': ['dashboard'],
'genai.saveProviderSecret': ['dashboard'],
'genai.testProviderDraft': ['dashboard'],
'genai.verifyProvider': ['dashboard'],
'genai.selectProvider': ['dashboard'],
'genai.clearProviderSecret': ['dashboard'],
```

Update `src/extension/background/runtime-policy.test.ts` to prove dashboard is
allowed and content-script is rejected for all setup methods.

- [ ] **Step 8: Run focused tests**

Run:

```sh
npx vitest run src/features/genai/api/genai-settings-contracts.test.ts src/features/genai/api/genai-settings-hooks.test.tsx src/extension/background/runtime-policy.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit Task 2**

```sh
git add src/features/genai/api src/platform/query src/extension/messaging.ts src/extension/background/runtime-policy.ts src/extension/background/runtime-policy.test.ts
git commit -m "feat(genai): add provider setup contracts"
```

---

## Task 3: GenAI Server Status, Verification, And Active Config

**Files:**

- Create: `src/features/genai/server/genai-provider-verification.ts`
- Create: `src/features/genai/server/genai-provider-verification.test.ts`
- Modify: `src/features/genai/server/genai-settings-service.ts`
- Modify: `src/features/genai/server/genai-settings-service.test.ts`
- Modify: `src/extension/background/register-handlers.ts`
- Modify: `src/extension/background/register-handlers.test.ts`

- [ ] **Step 1: Write failing service tests**

Update `src/features/genai/server/genai-settings-service.test.ts` so active config requires Auto assessment, AI assessment, selected verified metadata, and a trusted secret:

```ts
it('returns null when auto assessment is disabled even if AI and provider are configured', async () => {
  const handle = await createTestDb({ seed: false })
  await updateSettings(handle.db, {
    assessment: { autoAssessmentEnabled: false },
    aiAssessment: { enabled: true },
  })
  await saveGenAiProviderModel(handle.db, 'gemini', 'gemini-2.5-flash')
  await setAiProviderSecret(handle.db, 'gemini', { apiKey: 'AIza-test' })
  await verifyGenAiProviderWithResult(handle.db, 'gemini', {
    status: 'success',
    durationMs: 10,
  })

  await expect(loadActiveProviderConfig(handle.db)).resolves.toBeNull()
})

it('returns null when AI assessment is disabled but auto assessment is enabled', async () => {
  const handle = await createTestDb({ seed: false })
  await updateSettings(handle.db, {
    assessment: { autoAssessmentEnabled: true },
    aiAssessment: { enabled: false },
  })
  await saveGenAiProviderModel(handle.db, 'gemini', 'gemini-2.5-flash')
  await setAiProviderSecret(handle.db, 'gemini', { apiKey: 'AIza-test' })
  await verifyGenAiProviderWithResult(handle.db, 'gemini', {
    status: 'success',
    durationMs: 10,
  })

  await expect(loadActiveProviderConfig(handle.db)).resolves.toBeNull()
})

it('returns null when selected provider is unverified', async () => {
  const handle = await createTestDb({ seed: false })
  await updateSettings(handle.db, {
    assessment: { autoAssessmentEnabled: true },
    aiAssessment: { enabled: true },
  })
  await saveGenAiProviderModel(handle.db, 'gemini', 'gemini-2.5-flash')
  await setAiProviderSecret(handle.db, 'gemini', { apiKey: 'AIza-test' })

  await expect(loadActiveProviderConfig(handle.db)).resolves.toBeNull()
})

it('returns selected verified provider config without leaking status secrets', async () => {
  const handle = await createTestDb({ seed: false })
  await updateSettings(handle.db, {
    assessment: { autoAssessmentEnabled: true },
    aiAssessment: { enabled: true },
  })
  await saveGenAiProviderModel(handle.db, 'gemini', 'gemini-2.5-flash')
  await setAiProviderSecret(handle.db, 'gemini', { apiKey: 'AIza-test' })
  await verifyGenAiProviderWithResult(handle.db, 'gemini', {
    status: 'success',
    durationMs: 10,
  })

  await expect(loadActiveProviderConfig(handle.db)).resolves.toEqual({
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    apiKey: 'AIza-test',
  })

  const status = await getGenAiProviderStatus(handle.db)
  expect(status.selectedReady).toBe(true)
  expect(JSON.stringify(status)).not.toContain('AIza-test')
})
```

`verifyGenAiProviderWithResult` is a test helper exported from the service test
or injected by dependency; if production API does not expose it, implement the
test by writing metadata through `updateProviderVerification`.

- [ ] **Step 2: Run service tests to verify failure**

Run:

```sh
npx vitest run src/features/genai/server/genai-settings-service.test.ts
```

Expected: FAIL because service methods and Auto assessment setting are missing.

- [ ] **Step 3: Implement verification helper**

Create `src/features/genai/server/genai-provider-verification.ts`:

```ts
import { z } from 'zod'

import type { GenAiProviderConfig } from '../domain'
import type {
  GenAiProviderVerification,
  GenAiVerificationErrorCode,
} from '../domain/genai-connection-types'
import { generateJson } from './genai-service'

const verificationSchema = z.strictObject({ ok: z.literal(true) })

export type GenAiProviderVerificationResult =
  | { status: 'success'; durationMs: number }
  | {
      status: 'error'
      code: GenAiVerificationErrorCode
      message: string
      durationMs: number
    }

export async function verifyProviderConnection(
  config: GenAiProviderConfig,
): Promise<GenAiProviderVerificationResult> {
  const result = await generateJson({
    ...config,
    prompt: {
      system:
        'Return compact JSON for a CogniPace provider verification test. No prose.',
      user: 'Return {"ok":true}.',
    },
    schema: verificationSchema,
    temperature: 0,
    timeoutMs: 10_000,
  })

  if (result.status === 'success') {
    return {
      status: 'success',
      durationMs: result.providerMetadata.durationMs,
    }
  }

  return {
    status: 'error',
    code: result.code === 'not-configured' ? 'unknown' : result.code,
    message: result.message,
    durationMs: result.providerMetadata.durationMs,
  }
}

export function buildVerificationMetadata(
  model: string,
  result: GenAiProviderVerificationResult,
  now = new Date(),
): GenAiProviderVerification {
  if (result.status === 'success') {
    return {
      state: 'valid',
      verifiedAt: now.toISOString(),
      checkedModel: model,
      errorCode: null,
      message: null,
    }
  }

  return {
    state: 'invalid',
    verifiedAt: now.toISOString(),
    checkedModel: model,
    errorCode: result.code,
    message: result.message,
  }
}
```

- [ ] **Step 4: Implement server service methods**

Update `src/features/genai/server/genai-settings-service.ts`:

- `getGenAiProviderStatus(db)`
- `saveGenAiProviderModel(db, provider, model)`
- `saveGenAiProviderSecret(db, provider, secret)`
- `testGenAiProviderDraft(db, provider, model, secret)`
- `verifyGenAiProvider(db, provider)`
- `selectGenAiProvider(db, provider)`
- `clearGenAiProviderSecret(db, provider)`
- `loadActiveProviderConfig(db)`

The status builder must combine:

- `readGenAiConnectionMetadata()`
- `getAiProviderSecretPresenceFromTrustedStorage()`
- provider labels/default order

`selectedReady` is true only when selected provider has non-empty model,
matching `verification.checkedModel`, `verification.state === 'valid'`, and
secret presence.

`saveGenAiProviderSecret` and `clearGenAiProviderSecret` must reset verification
for that provider before returning status.

- [ ] **Step 5: Register background handlers**

Update `src/extension/background/register-handlers.ts`:

- Parse every new request schema.
- Authorize sender before service calls.
- For writes, use the existing mutation queue/snapshot/invalidation helper
  pattern.
- Broadcast invalidation tags `['genai', 'app-shell']`; when Assessment settings
  are also mutated in a later task, keep `settings` on settings writes only.

Action result helper:

```ts
function createGenAiActionResult(input: {
  action: GenAiProviderAction
  outcome?: 'success' | 'error'
  message: string
  status: GenAiProviderStatus
  now?: Date
}): GenAiProviderActionResult {
  return {
    action: input.action,
    outcome: input.outcome ?? 'success',
    message: input.message,
    status: input.status,
    occurredAt: (input.now ?? new Date()).toISOString(),
  }
}
```

- [ ] **Step 6: Update handler tests**

Update `src/extension/background/register-handlers.test.ts` to assert:

- `genai.getProviderStatus` returns Gemini default and no secret fields.
- `genai.saveProviderModel` changes model and resets verification.
- `genai.saveProviderSecret` stores key and returns redacted status.
- `genai.clearProviderSecret` clears key and returns redacted status.
- content-script sender cannot call setup methods.

- [ ] **Step 7: Run focused service and handler tests**

Run:

```sh
npx vitest run src/features/genai/server/genai-settings-service.test.ts src/features/genai/server/genai-provider-verification.test.ts src/extension/background/register-handlers.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit Task 3**

```sh
git add src/features/genai/server src/extension/background/register-handlers.ts src/extension/background/register-handlers.test.ts
git commit -m "feat(genai): resolve provider setup status"
```

---

## Task 4: Settings Domain Auto Assessment And Draft Invariants

**Files:**

- Modify: `src/features/settings/domain/settings.ts`
- Modify: `src/features/settings/domain/settings.test.ts`
- Modify: `src/features/settings/hooks/use-settings-draft.ts`
- Modify: `src/features/settings/hooks/use-settings-draft.test.tsx`
- Modify fixtures in tests that assert full `defaultUserSettings`

- [ ] **Step 1: Write failing settings domain tests**

Extend `src/features/settings/domain/settings.test.ts`:

```ts
it('defaults auto assessment to off while preserving existing assessment fields', () => {
  expect(defaultUserSettings.assessment.autoAssessmentEnabled).toBe(false)
  expect(parseStoredUserSettings({})).toMatchObject({
    assessment: {
      autoAssessmentEnabled: false,
      requireSolveTime: false,
      strictTiming: false,
    },
  })
})

it('creates minimal patches for auto assessment and AI assessment independently', () => {
  const draft = {
    ...defaultUserSettings,
    assessment: {
      ...defaultUserSettings.assessment,
      autoAssessmentEnabled: true,
    },
    aiAssessment: {
      ...defaultUserSettings.aiAssessment,
      enabled: true,
    },
  }

  expect(createUserSettingsPatch(defaultUserSettings, draft)).toEqual({
    assessment: { autoAssessmentEnabled: true },
    aiAssessment: { enabled: true },
  })
})

it('merges auto assessment patches without dropping timing settings', () => {
  expect(
    mergeUserSettings(defaultUserSettings, {
      assessment: { autoAssessmentEnabled: true },
    }),
  ).toEqual({
    ...defaultUserSettings,
    assessment: {
      ...defaultUserSettings.assessment,
      autoAssessmentEnabled: true,
    },
  })
})
```

- [ ] **Step 2: Write failing draft invariant tests**

Extend `src/features/settings/hooks/use-settings-draft.test.tsx`:

```ts
it('turns auto assessment on when AI assessment is enabled', async () => {
  vi.mocked(sendMessage).mockResolvedValue(defaultUserSettings)
  const { wrapper } = createQueryTestHarness()
  const { result } = renderHook(() => useSettingsDraft(), { wrapper })

  await waitFor(() => {
    expect(result.current.draft).toEqual(defaultUserSettings)
  })

  act(() => {
    result.current.actions.setAiAssessmentEnabled(true)
  })

  expect(result.current.draft?.assessment.autoAssessmentEnabled).toBe(true)
  expect(result.current.draft?.aiAssessment.enabled).toBe(true)
})

it('turns AI assessment off when auto assessment is disabled', async () => {
  const enabledSettings = {
    ...defaultUserSettings,
    assessment: {
      ...defaultUserSettings.assessment,
      autoAssessmentEnabled: true,
    },
    aiAssessment: {
      ...defaultUserSettings.aiAssessment,
      enabled: true,
    },
  }
  vi.mocked(sendMessage).mockResolvedValue(enabledSettings)
  const { wrapper } = createQueryTestHarness()
  const { result } = renderHook(() => useSettingsDraft(), { wrapper })

  await waitFor(() => {
    expect(result.current.draft).toEqual(enabledSettings)
  })

  act(() => {
    result.current.actions.setAutoAssessmentEnabled(false)
  })

  expect(result.current.draft?.assessment.autoAssessmentEnabled).toBe(false)
  expect(result.current.draft?.aiAssessment.enabled).toBe(false)
})
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```sh
npx vitest run src/features/settings/domain/settings.test.ts src/features/settings/hooks/use-settings-draft.test.tsx
```

Expected: FAIL because `autoAssessmentEnabled` and new draft actions are missing.

- [ ] **Step 4: Implement settings schema and patching**

Modify `src/features/settings/domain/settings.ts`:

- Add `autoAssessmentEnabled: z.boolean().default(false)` to
  `assessmentSettingsSchema`.
- Add optional `autoAssessmentEnabled` to `userSettingsPatchSchema.assessment`.
- Add `autoAssessmentEnabled: false` to `defaultUserSettings.assessment`.
- Add diff logic in `createUserSettingsPatch`.
- Existing `createMergedUserSettings` nested merge will preserve it once the
  patch schema includes it.

- [ ] **Step 5: Implement draft actions**

Modify `src/features/settings/hooks/use-settings-draft.ts`:

- Replace action interface names:
  - remove `setAiModel`
  - remove `setAiProvider`
  - rename `setAiEnabled` to `setAiAssessmentEnabled`
  - add `setAutoAssessmentEnabled`
- Reducer behavior:

```ts
case 'set-auto-assessment-enabled':
  return updateDraft(state, (draft) => ({
    ...draft,
    assessment: {
      ...draft.assessment,
      autoAssessmentEnabled: action.value,
    },
    aiAssessment: {
      ...draft.aiAssessment,
      enabled: action.value ? draft.aiAssessment.enabled : false,
    },
  }))
case 'set-ai-assessment-enabled':
  return updateDraft(state, (draft) => ({
    ...draft,
    assessment: {
      ...draft.assessment,
      autoAssessmentEnabled: action.value
        ? true
        : draft.assessment.autoAssessmentEnabled,
    },
    aiAssessment: {
      ...draft.aiAssessment,
      enabled: action.value,
    },
  }))
```

- [ ] **Step 6: Run focused settings tests**

Run:

```sh
npx vitest run src/features/settings/domain/settings.test.ts src/features/settings/hooks/use-settings-draft.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit Task 4**

```sh
git add src/features/settings/domain src/features/settings/hooks
git commit -m "feat(settings): separate auto and AI assessment"
```

---

## Task 5: Assessment Settings UI Cleanup

**Files:**

- Delete or replace: `src/features/settings/components/sections/ai-assessment-section.tsx`
- Delete or replace: `src/features/settings/components/sections/ai-assessment-section.test.tsx`
- Create: `src/features/settings/components/sections/assessment-section.tsx`
- Create: `src/features/settings/components/sections/assessment-section.test.tsx`
- Modify: `src/features/settings/components/settings-screen.tsx`

- [ ] **Step 1: Write failing Assessment section tests**

Create `src/features/settings/components/sections/assessment-section.test.tsx`:

```ts
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { defaultUserSettings } from '../../domain'
import { AssessmentSection } from './assessment-section'

describe('AssessmentSection', () => {
  it('renders Auto assessment and AI assessment without provider fields', () => {
    render(
      <AssessmentSection
        actions={{
          setAutoAssessmentEnabled: vi.fn(),
          setAiAssessmentEnabled: vi.fn(),
        }}
        draft={defaultUserSettings}
        providerReady={false}
      />,
    )

    expect(screen.getByRole('switch', { name: /auto assessment/i })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: /^ai assessment$/i })).toBeInTheDocument()
    expect(screen.queryByLabelText(/^model$/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/api key/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: /openai/i })).not.toBeInTheDocument()
  })

  it('warns when AI assessment is enabled but provider is not ready', () => {
    render(
      <AssessmentSection
        actions={{
          setAutoAssessmentEnabled: vi.fn(),
          setAiAssessmentEnabled: vi.fn(),
        }}
        draft={{
          ...defaultUserSettings,
          assessment: {
            ...defaultUserSettings.assessment,
            autoAssessmentEnabled: true,
          },
          aiAssessment: {
            ...defaultUserSettings.aiAssessment,
            enabled: true,
          },
        }}
        providerReady={false}
      />,
    )

    expect(screen.getByText(/ai provider setup is not ready/i)).toBeInTheDocument()
  })

  it('lets the user toggle AI assessment without disabling the control for missing provider setup', async () => {
    const actions = {
      setAutoAssessmentEnabled: vi.fn(),
      setAiAssessmentEnabled: vi.fn(),
    }
    render(
      <AssessmentSection
        actions={actions}
        draft={defaultUserSettings}
        providerReady={false}
      />,
    )

    const user = userEvent.setup()
    await user.click(screen.getByRole('switch', { name: /^ai assessment$/i }))

    expect(actions.setAiAssessmentEnabled).toHaveBeenCalledWith(true)
  })
})
```

- [ ] **Step 2: Run test to verify failure**

Run:

```sh
npx vitest run src/features/settings/components/sections/assessment-section.test.tsx
```

Expected: FAIL because `AssessmentSection` does not exist.

- [ ] **Step 3: Implement AssessmentSection**

Create `src/features/settings/components/sections/assessment-section.tsx`:

```tsx
import { SettingsSection } from '../settings-section'
import { SettingsRow, readSettingsRowLabelId } from '../settings-row'
import { SwitchControl } from '../settings-controls'
import { InlineStatus } from '@/components/ui/inline-status'
import type { UserSettings } from '../../domain'
import type { SettingsDraftActions } from '../../hooks/use-settings-draft'

type AssessmentSectionProps = {
  actions: Pick<
    SettingsDraftActions,
    'setAutoAssessmentEnabled' | 'setAiAssessmentEnabled'
  >
  draft: UserSettings
  providerReady: boolean
}

export function AssessmentSection({
  actions,
  draft,
  providerReady,
}: AssessmentSectionProps) {
  const showProviderWarning = draft.aiAssessment.enabled && !providerReady

  return (
    <SettingsSection id="assessment-settings" title="Assessment">
      <SettingsRow
        controlClassName="w-full md:max-w-28"
        hint="Use CogniPace's deterministic assessment policy to preselect ratings."
        id="auto-assessment-row"
        label="Auto assessment"
        labelFor="auto-assessment"
      >
        <SwitchControl
          ariaLabelledBy={readSettingsRowLabelId('auto-assessment-row')}
          checked={draft.assessment.autoAssessmentEnabled}
          id="auto-assessment"
          onChange={actions.setAutoAssessmentEnabled}
        />
      </SettingsRow>
      <SettingsRow
        controlClassName="w-full md:max-w-28"
        hint="Use the selected AI provider to refine automatic assessment when available."
        id="ai-assessment-row"
        label="AI assessment"
        labelFor="ai-assessment"
      >
        <SwitchControl
          ariaLabelledBy={readSettingsRowLabelId('ai-assessment-row')}
          checked={draft.aiAssessment.enabled}
          id="ai-assessment"
          onChange={actions.setAiAssessmentEnabled}
        />
      </SettingsRow>
      {showProviderWarning ? (
        <SettingsRow
          controlClassName="w-full"
          id="ai-assessment-warning-row"
          label="AI provider"
        >
          <InlineStatus tone="warning">
            AI provider setup is not ready. Auto assessment will use the
            deterministic policy.
          </InlineStatus>
        </SettingsRow>
      ) : null}
    </SettingsSection>
  )
}
```

- [ ] **Step 4: Wire SettingsScreen**

Modify `src/features/settings/components/settings-screen.tsx`:

- Import `AssessmentSection`.
- Remove `AiAssessmentSection`.
- Get provider status using `useGenAiProviderStatusQuery`.
- Pass `providerReady={providerStatus.data?.selectedReady ?? false}`.
- Pass new actions.

- [ ] **Step 5: Remove old component and tests**

Delete old provider/key Settings UI files or leave a temporary re-export only if
imports still exist. The final code must not render provider/model/key fields in
Settings.

- [ ] **Step 6: Run focused UI tests**

Run:

```sh
npx vitest run src/features/settings/components/sections/assessment-section.test.tsx src/features/settings/hooks/use-settings-draft.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit Task 5**

```sh
git add src/features/settings/components src/features/settings/hooks src/features/settings/domain
git commit -m "feat(settings): simplify assessment settings"
```

---

## Task 6: Data Management AI Provider Panel And Dialog

**Files:**

- Create: `src/features/genai/hooks/use-genai-provider-controller.ts`
- Create: `src/features/genai/hooks/use-genai-provider-controller.test.tsx`
- Create: `src/features/genai/components/ai-provider-settings-section.tsx`
- Create: `src/features/genai/components/ai-provider-settings-section.test.tsx`
- Create: `src/features/genai/components/ai-provider-connection-dialog.tsx`
- Create: `src/features/genai/components/ai-provider-connection-dialog.test.tsx`
- Modify: `src/features/genai/index.ts`
- Modify: `src/features/backup/components/data-management-screen.tsx`

- [ ] **Step 1: Write controller tests**

Create `src/features/genai/hooks/use-genai-provider-controller.test.tsx`:

```ts
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { sendMessage } from '@/extension/messaging'
import { createQueryTestHarness } from '@/testing/query-test-harness'

import { useGenAiProviderController } from './use-genai-provider-controller'

vi.mock('@/extension/messaging', () => ({ sendMessage: vi.fn() }))

const status = {
  selectedProvider: 'gemini' as const,
  selectedReady: false,
  providers: [
    {
      provider: 'gemini' as const,
      label: 'Gemini',
      model: 'gemini-2.5-flash',
      secretConfigured: false,
      verificationState: 'unverified' as const,
      verifiedAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
    },
  ],
}

describe('useGenAiProviderController', () => {
  beforeEach(() => {
    vi.mocked(sendMessage).mockReset()
  })

  it('loads provider status and exposes setup actions', async () => {
    vi.mocked(sendMessage).mockResolvedValue(status)
    const { wrapper } = createQueryTestHarness()
    const { result } = renderHook(() => useGenAiProviderController(), {
      wrapper,
    })

    await waitFor(() => expect(result.current.status).toEqual(status))
    expect(result.current.isLoading).toBe(false)

    await act(async () => {
      await result.current.actions.onSaveModel('gemini', 'gemini-2.5-flash')
    })

    expect(sendMessage).toHaveBeenCalledWith('genai.saveProviderModel', {
      surface: 'dashboard',
      provider: 'gemini',
      model: 'gemini-2.5-flash',
    })
  })
})
```

- [ ] **Step 2: Implement controller**

Create `src/features/genai/hooks/use-genai-provider-controller.ts`:

```ts
import {
  useClearGenAiProviderSecretMutation,
  useGenAiProviderStatusQuery,
  useSaveGenAiProviderModelMutation,
  useSaveGenAiProviderSecretMutation,
  useSelectGenAiProviderMutation,
  useTestGenAiProviderDraftMutation,
  useVerifyGenAiProviderMutation,
} from '../api'
import type { GenAiProviderId } from '../domain'

export function useGenAiProviderController() {
  const status = useGenAiProviderStatusQuery()
  const saveModel = useSaveGenAiProviderModelMutation()
  const saveSecret = useSaveGenAiProviderSecretMutation()
  const testDraft = useTestGenAiProviderDraftMutation()
  const verifyProvider = useVerifyGenAiProviderMutation()
  const selectProvider = useSelectGenAiProviderMutation()
  const clearSecret = useClearGenAiProviderSecretMutation()

  return {
    status: status.data ?? null,
    isLoading: status.isPending,
    isPending:
      saveModel.isPending ||
      saveSecret.isPending ||
      testDraft.isPending ||
      verifyProvider.isPending ||
      selectProvider.isPending ||
      clearSecret.isPending,
    actions: {
      onSaveModel: (provider: GenAiProviderId, model: string) =>
        saveModel.mutateAsync({ provider, model }),
      onSaveSecret: (provider: GenAiProviderId, key: string) =>
        saveSecret.mutateAsync({ provider, key }),
      onTestDraft: (provider: GenAiProviderId, model: string, key: string) =>
        testDraft.mutateAsync({ provider, model, key }),
      onVerifyProvider: (provider: GenAiProviderId) =>
        verifyProvider.mutateAsync({ provider }),
      onSelectProvider: (provider: GenAiProviderId) =>
        selectProvider.mutateAsync({ provider }),
      onClearSecret: (provider: GenAiProviderId) =>
        clearSecret.mutateAsync({ provider }),
    },
  }
}
```

- [ ] **Step 3: Write panel/dialog component tests**

Create tests that assert:

- Panel renders `AI Provider`, Gemini default, `Not configured`, and
  `Manage provider`.
- Panel select button only offers ready providers.
- Dialog shows provider selector in Gemini/OpenAI/Anthropic order.
- Dialog masks stored key with dots and never renders raw saved keys.
- Dialog `Save provider` calls `onSaveModel` then `onSaveSecret` when both model
  and key are provided.
- Dialog `Verify selected` calls `onVerifyProvider`.
- Dialog `Remove key` calls `onClearSecret`.

- [ ] **Step 4: Implement panel and dialog**

Follow GitHub Sync layout patterns:

- `Surface` card.
- Header with badges.
- Inner framed block for configured/unconfigured state.
- Dialog with focus trap and Escape behavior copied from
  `github-sync-connection-dialog.tsx`.
- Use lucide icons for `Settings2`, `KeyRound`, `CheckCircle2`, `Trash2`,
  `Loader2`.

Keep text compact. Do not add provider explanations beyond status and action
labels.

- [ ] **Step 5: Render in Data Management**

Modify `src/features/backup/components/data-management-screen.tsx`:

```tsx
import { AiProviderSettingsSection } from '@/features/genai'
```

Render `<AiProviderSettingsSection />` next to `<GitHubSyncSettingsSection />`.

- [ ] **Step 6: Run UI tests**

Run:

```sh
npx vitest run src/features/genai/hooks/use-genai-provider-controller.test.tsx src/features/genai/components/ai-provider-settings-section.test.tsx src/features/genai/components/ai-provider-connection-dialog.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit Task 6**

```sh
git add src/features/genai src/features/backup/components/data-management-screen.tsx
git commit -m "feat(genai): add BYOK provider setup UI"
```

---

## Task 7: App Shell And Dev Smoke State Reporting

**Files:**

- Modify: `src/features/app-shell/server/app-shell-service.ts`
- Modify: `src/features/app-shell/server/app-shell-service.test.ts`
- Modify: `src/features/app-shell/api/app-shell-contracts.ts`
- Modify: `src/extension/background/dev-smoke-service.ts`
- Modify: `src/extension/background/dev-smoke-service.test.ts`
- Modify: `src/extension/background/register-handlers.ts`
- Modify: `src/extension/background/register-handlers.test.ts`
- Modify: `src/features/dev-smoke/api/dev-smoke-contracts.ts`
- Modify: `src/features/dev-smoke/components/dev-smoke-screen.tsx`

- [ ] **Step 1: Update app-shell tests**

Replace old "fully configured" setup in
`src/features/app-shell/server/app-shell-service.test.ts` with:

```ts
await updateSettings(handle.db, {
  assessment: { autoAssessmentEnabled: true },
  aiAssessment: { enabled: true },
})
await saveGenAiProviderModel(handle.db, 'gemini', 'gemini-2.5-flash')
await setAiProviderSecret(handle.db, 'gemini', { apiKey: 'AIza-must-not-leak' })
await updateProviderVerification('gemini', {
  state: 'valid',
  verifiedAt: '2026-06-14T10:00:00.000Z',
  checkedModel: 'gemini-2.5-flash',
  errorCode: null,
  message: null,
})
```

Add cases:

- auto off + AI on => `aiAssessmentAvailable=false`
- auto on + AI off => `aiAssessmentAvailable=false`
- auto on + AI on + verified provider => `true`

- [ ] **Step 2: Update dev-smoke tests**

In `src/extension/background/dev-smoke-service.test.ts`, expected messages
should distinguish:

- `Auto assessment is disabled.`
- `AI assessment is disabled.`
- `Provider gemini is selected with model gemini-2.5-flash; verification unverified; secret present: yes.`
- `Provider gemini is ready with model gemini-2.5-flash; secret present: yes.`

- [ ] **Step 3: Implement app-shell changes**

`isAiAssessmentAvailable(db)` should now return true only when
`loadActiveProviderConfig(db)` resolves a provider config. App shell does not
need provider/model details.

Ensure app-shell safe settings payload includes `assessment.autoAssessmentEnabled`
but never exposes secret values.

- [ ] **Step 4: Implement dev-smoke config model**

Update `DevSmokeDeps.readGenAiConfig` return type to:

```ts
{
  autoAssessmentEnabled: boolean
  aiAssessmentEnabled: boolean
  provider: string
  model: string
  secretPresent: boolean
  verificationState: 'unverified' | 'valid' | 'invalid'
  ready: boolean
  reason:
    | 'auto-assessment-disabled'
    | 'ai-assessment-disabled'
    | 'model-missing'
    | 'secret-missing'
    | 'provider-unverified'
    | 'provider-invalid'
    | null
}
```

Generate a warning unless `ready === true`; make each reason human-readable.

- [ ] **Step 5: Add session-only live diagnostics**

If `devSmokeReportSchema` needs diagnostics, add:

```ts
diagnostics: z.array(
  z.strictObject({
    purpose: z.string(),
    provider: z.string(),
    model: z.string(),
    promptChars: z.number().int().nonnegative(),
    schemaName: z.string(),
    durationMs: z.number().int().nonnegative().optional(),
    status: z.string(),
  }),
).optional()
```

Render diagnostics in the hidden dev smoke route only. Redact details with the
existing `sanitizeSmokeDetail`.

- [ ] **Step 6: Run focused tests**

Run:

```sh
npx vitest run src/features/app-shell/server/app-shell-service.test.ts src/extension/background/dev-smoke-service.test.ts src/extension/background/register-handlers.test.ts src/features/dev-smoke/components/dev-smoke-screen.test.tsx
```

If `dev-smoke-screen.test.tsx` does not exist, add focused component tests for
diagnostic rendering and secret redaction.

- [ ] **Step 7: Commit Task 7**

```sh
git add src/features/app-shell src/extension/background src/features/dev-smoke
git commit -m "feat(genai): improve assessment smoke state"
```

---

## Task 8: Replace Hand-Written Provider Calls With Vercel AI SDK Core

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/features/genai/server/providers/ai-sdk-provider.ts`
- Create: `src/features/genai/server/providers/ai-sdk-provider.test.ts`
- Modify: `src/features/genai/server/genai-service.ts`
- Modify: `src/features/genai/server/genai-service.test.ts`
- Delete or stop importing: `src/features/genai/server/providers/openai.ts`
- Delete or stop importing: `src/features/genai/server/providers/anthropic.ts`
- Delete or stop importing: `src/features/genai/server/providers/gemini.ts`

- [ ] **Step 1: Install SDK packages**

Run:

```sh
npm install ai @ai-sdk/google @ai-sdk/openai @ai-sdk/anthropic
```

Expected: `package.json` and `package-lock.json` update.

- [ ] **Step 2: Write SDK wrapper tests**

Create `src/features/genai/server/providers/ai-sdk-provider.test.ts` with mocks:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

vi.mock('ai', () => ({
  generateObject: vi.fn(),
}))
vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: vi.fn(() => (model: string) => ({
    provider: 'gemini',
    model,
  })),
}))
vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(() => (model: string) => ({ provider: 'openai', model })),
}))
vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn(() => (model: string) => ({
    provider: 'anthropic',
    model,
  })),
}))

import { generateObject } from 'ai'
import { requestJsonWithAiSdk } from './ai-sdk-provider'

const schema = z.strictObject({ ok: z.literal(true) })

describe('requestJsonWithAiSdk', () => {
  beforeEach(() => {
    vi.mocked(generateObject).mockReset()
  })

  it('maps a successful Gemini object result to CogniPace metadata', async () => {
    vi.mocked(generateObject).mockResolvedValue({
      object: { ok: true },
      usage: { totalTokens: 12 },
      response: { modelId: 'gemini-2.5-flash' },
    } as never)

    const result = await requestJsonWithAiSdk({
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      apiKey: 'AIza-secret',
      prompt: { system: 'sys', user: 'user' },
      schema,
      temperature: 0,
    })

    expect(result.status).toBe('success')
    expect(JSON.stringify(result)).not.toContain('AIza-secret')
    expect(generateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'user',
        system: 'sys',
        schema,
        temperature: 0,
      }),
    )
  })

  it('maps SDK auth-style errors without leaking the API key', async () => {
    vi.mocked(generateObject).mockRejectedValue(
      Object.assign(new Error('bad key sk-secret'), { statusCode: 401 }),
    )

    const result = await requestJsonWithAiSdk({
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: 'sk-secret',
      prompt: { system: 'sys', user: 'user' },
      schema,
    })

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.code).toBe('auth')
      expect(result.message).not.toContain('sk-secret')
    }
  })
})
```

- [ ] **Step 3: Implement SDK wrapper**

Create `src/features/genai/server/providers/ai-sdk-provider.ts`:

```ts
import { generateObject } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'

import type {
  GenAiGenerateJsonRequest,
  GenAiGenerateJsonResult,
} from '../../domain'

export async function requestJsonWithAiSdk<T>(
  request: GenAiGenerateJsonRequest<T>,
): Promise<GenAiGenerateJsonResult<T>> {
  const startedAt = Date.now()

  try {
    const result = await generateObject({
      model: resolveLanguageModel(request),
      schema: request.schema,
      system: request.prompt.system,
      prompt: request.prompt.user,
      temperature: request.temperature ?? 0.2,
      abortSignal: request.signal,
    })

    return {
      status: 'success',
      data: result.object,
      providerMetadata: {
        provider: request.provider,
        model: request.model,
        modelVersion: readModelVersion(result),
        durationMs: Date.now() - startedAt,
        totalTokens: readTotalTokens(result),
      },
    }
  } catch (error) {
    return {
      status: 'error',
      code: mapSdkError(error),
      message: redactSdkErrorMessage(request.provider, error, request.apiKey),
      providerMetadata: {
        provider: request.provider,
        model: request.model,
        durationMs: Date.now() - startedAt,
      },
    }
  }
}

function resolveLanguageModel<T>(request: GenAiGenerateJsonRequest<T>) {
  switch (request.provider) {
    case 'gemini':
      return createGoogleGenerativeAI({ apiKey: request.apiKey })(request.model)
    case 'openai':
      return createOpenAI({ apiKey: request.apiKey })(request.model)
    case 'anthropic':
      return createAnthropic({ apiKey: request.apiKey })(request.model)
  }
}
```

Complete helper functions:

- `readModelVersion`
- `readTotalTokens`
- `mapSdkError`
- `redactSdkErrorMessage`

Use `unknown` and narrow object properties safely. Map `statusCode` or
`status` 401/403 to `auth`, 429 to `rate-limit`, 5xx to `network`, abort errors
to `timeout`, schema/validation output failures to `invalid-output`, otherwise
`unknown`.

- [ ] **Step 4: Delegate genai-service**

Modify `src/features/genai/server/genai-service.ts`:

```ts
import { requestJsonWithAiSdk } from './providers/ai-sdk-provider'

export async function generateJson<T>(
  request: GenAiGenerateJsonRequest<T>,
): Promise<GenAiGenerateJsonResult<T>> {
  return requestJsonWithAiSdk(request)
}
```

- [ ] **Step 5: Retire old provider tests**

Either delete old provider-specific tests or convert them to SDK wrapper tests.
Keep shared redaction tests only if helpers are still used.

- [ ] **Step 6: Run SDK and service tests**

Run:

```sh
npx vitest run src/features/genai/server/providers/ai-sdk-provider.test.ts src/features/genai/server/genai-service.test.ts src/features/leetcode-review-assistant/server/recommendation-service.test.ts
npm run build
```

Expected: PASS. The build is required here because WXT/MV3 bundling must prove
the SDK imports are compatible.

- [ ] **Step 7: Commit Task 8**

```sh
git add package.json package-lock.json src/features/genai/server
git commit -m "feat(genai): use Vercel AI SDK providers"
```

---

## Task 9: Docs, Smoke Checklist, And Final Validation

**Files:**

- Modify: `docs/product.md`
- Modify: `docs/architecture.md`
- Modify: `docs/testing.md`
- Modify: `docs/superpowers/README.md` if status wording changes

- [ ] **Step 1: Update product docs**

In `docs/product.md`:

- Settings owns Assessment toggles.
- Data Management owns AI Provider setup.
- Auto assessment can run without AI.
- AI assessment depends on Auto assessment and selected verified provider.
- Provider keys remain trusted local secrets.

- [ ] **Step 2: Update architecture docs**

In `docs/architecture.md`:

- `features/genai` owns provider connection metadata and SDK provider wrapper.
- `features/settings` no longer owns provider/model/key UI.
- GenAI status metadata is local `chrome.storage.local`; secrets remain
  `platform/secrets`.
- Vercel AI SDK Core imports stay in `src/features/genai/server`.

- [ ] **Step 3: Update testing docs**

In `docs/testing.md`:

- Replace AI Assessment Settings smoke with:
  - Settings > Assessment toggle smoke.
  - Settings > Data Management > AI Provider setup smoke.
  - `/dev/smoke` live/non-live GenAI smoke.
- Include manual proof that provider key is absent from backup export.

- [ ] **Step 4: Run docs formatting**

Run:

```sh
npx prettier --check docs/product.md docs/architecture.md docs/testing.md docs/superpowers/README.md
```

Expected: PASS.

- [ ] **Step 5: Run full validation**

Run:

```sh
npm run lint
npm run check
npm run build
```

Expected: PASS.

- [ ] **Step 6: Manual smoke checklist for human engineer**

The PR handoff must include these manual checks:

- Load the extension from `.output/chrome-mv3`.
- Open Settings.
- Turn on Auto assessment, save, reload, and confirm it stays on.
- Turn on AI assessment and confirm Auto assessment also turns on.
- Turn Auto assessment off and confirm AI assessment turns off.
- Open Data Management > AI Provider.
- Confirm Gemini is the default provider and `gemini-2.5-flash` is the default model.
- Save and verify a test Gemini key.
- Confirm AI Provider card reports ready.
- Open `/dev/smoke` with live smoke off and confirm GenAI config reports ready.
- Open `/dev/smoke` with live smoke on and confirm live result is pass/warn/fail with redacted detail.
- Remove the provider key and confirm Assessment settings remain saved but show the warning.
- Export backup and confirm no raw provider key appears.

- [ ] **Step 7: Commit Task 9**

```sh
git add docs/product.md docs/architecture.md docs/testing.md docs/superpowers/README.md
git commit -m "docs(genai): update provider setup smoke"
```

---

## Final Review Checklist

- [ ] Provider/model/key UI is gone from Settings > Assessment.
- [ ] Data Management has an AI Provider card beside GitHub Sync.
- [ ] Gemini is the default provider and `gemini-2.5-flash` is the default model.
- [ ] Auto assessment can be enabled without AI.
- [ ] AI assessment turns Auto assessment on.
- [ ] Turning Auto assessment off turns AI assessment off.
- [ ] Active GenAI config requires Auto assessment, AI assessment, selected verified provider, matching model, and trusted secret.
- [ ] Dev smoke reports exact unavailable reasons.
- [ ] Secret values never appear in runtime status, query cache payloads, backups, sync payloads, logs, or visible UI.
- [ ] SDK provider imports are contained to `src/features/genai/server`.
- [ ] Focused tests, `npm run lint`, `npm run check`, and `npm run build` pass.
- [ ] Human smoke proof is attached before PR review or merge.
