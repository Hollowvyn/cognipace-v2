# AI Provider Settings & Secret Handling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add user-configurable AI assessment settings and per-provider secret storage so issue #6 has a loader and the overlay can display an `aiAssessmentAvailable` flag. The apiKey never leaves background-only code.

**Architecture:** Safe fields (`enabled`, `provider`, `model`) live in `userSettings.aiAssessment`, written via the existing settings flow. Per-provider secrets (`{ apiKey, baseUrl? }`) live in a separate `settings_kv` row keyed `'genai-secrets'`, accessed only from `src/features/genai/server/`. A new background-only `loadActiveProviderConfig(db)` composes the safe settings with the active secret to return a resolved `GenAiProviderConfig | null`. App-shell overlay payload gains one boolean field; popup/dashboard expose the safe block. Two leak-defense layers: source-level architecture-boundary test + runtime serialization snapshots.

**Tech Stack:** TypeScript, Zod 4, Drizzle (existing SQLite WASM), TanStack Query, React, Vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-06-01-ai-provider-settings-and-secrets-design.md`

---

## File Plan

**Create:**
- `src/features/genai/domain/genai-secrets-types.ts`
- `src/features/genai/domain/genai-secrets-types.test.ts`
- `src/features/genai/server/genai-secrets-store.ts`
- `src/features/genai/server/genai-secrets-store.test.ts`
- `src/features/genai/server/genai-settings-service.ts`
- `src/features/genai/server/genai-settings-service.test.ts`
- `src/features/genai/api/genai-settings-contracts.ts`
- `src/features/genai/api/genai-settings-hooks.ts`
- `src/features/genai/api/genai-settings-hooks.test.tsx`
- `src/features/genai/api/index.ts`
- `src/features/settings/components/sections/ai-assessment-section.tsx`
- `src/features/settings/components/sections/ai-assessment-section.test.tsx`

**Modify:**
- `src/features/settings/domain/settings.ts` (add `aiAssessment` block + merge + diff)
- `src/features/settings/domain/settings.test.ts`
- `src/features/settings/hooks/use-settings-draft.ts` (new actions)
- `src/features/settings/hooks/use-settings-draft.test.tsx`
- `src/features/settings/components/settings-screen.tsx` (mount the new section)
- `src/features/genai/domain/index.ts` (re-export secrets types)
- `src/features/genai/index.ts` (re-export the hooks)
- `src/features/app-shell/api/app-shell-contracts.ts` (add fields)
- `src/features/app-shell/server/app-shell-service.ts` (compute availability)
- `src/features/app-shell/server/app-shell-service.test.ts` (leak snapshot)
- `src/extension/messaging.ts` (3 new methods in `ProtocolMap` + re-exports)
- `src/extension/background/runtime-policy.ts` (3 new entries with surface allowlist)
- `src/extension/background/runtime-policy.test.ts`
- `src/extension/background/register-handlers.ts` (3 new `onMessage` handlers)
- `src/platform/query/query-keys.ts` (add `genai.secretPresence`)
- `src/testing/architecture-boundaries.test.ts` (new `apiKey` leak test)

**Do not modify:**
- `src/platform/db/schema/settings-kv.ts` — same table, new row only.
- The backup feature — see spec's Non-Goals.

**Conventions:**
- Test files sit next to source.
- Run a single test file with `npx vitest run <path>`.
- Full validation: `npm run check`.
- Commit messages follow conventional commits.

---

## Task 1: Add `aiAssessment` to user settings schema

**Files:**
- Modify: `src/features/settings/domain/settings.ts`
- Modify: `src/features/settings/domain/settings.test.ts`

This task adds the safe public fields. The apiKey is added in later tasks (different storage path).

- [ ] **Step 1: Write the failing tests**

Open `src/features/settings/domain/settings.test.ts`. Append these tests inside the existing top-level `describe('user settings', …)` block (or append at the end of the file if the structure is flat; use the file's prevailing pattern):

```ts
import {
  defaultUserSettings,
  mergeUserSettings,
  parseStoredUserSettings,
  createUserSettingsPatch,
} from './settings'

describe('aiAssessment settings', () => {
  it('parses old rows missing the aiAssessment block by filling defaults', () => {
    const oldRow = {
      schemaVersion: 1,
      appearance: { themeMode: 'system' },
      practice: {
        dailyGoal: 4,
        mode: 'studyPlan',
        problemFilters: { skipPremium: false },
      },
      review: { targetRetention: 0.9, order: 'dueFirst' },
      assessment: {
        requireSolveTime: false,
        strictTiming: false,
        timeTargetsMinutes: { easy: 20, medium: 35, hard: 50 },
      },
      overlay: { autoDetectSolved: true },
      reminders: { daily: { enabled: false, time: '09:00' } },
    }
    const parsed = parseStoredUserSettings(oldRow)
    expect(parsed.aiAssessment).toEqual({
      enabled: false,
      provider: 'openai',
      model: '',
    })
  })

  it('defaultUserSettings.aiAssessment matches documented defaults', () => {
    expect(defaultUserSettings.aiAssessment).toEqual({
      enabled: false,
      provider: 'openai',
      model: '',
    })
  })

  it('merges an aiAssessment patch into existing settings', () => {
    const next = mergeUserSettings(defaultUserSettings, {
      aiAssessment: { enabled: true, model: 'gpt-test' },
    })
    expect(next.aiAssessment).toEqual({
      enabled: true,
      provider: 'openai',
      model: 'gpt-test',
    })
  })

  it('createUserSettingsPatch produces a diff containing changed aiAssessment fields only', () => {
    const draft = {
      ...defaultUserSettings,
      aiAssessment: {
        ...defaultUserSettings.aiAssessment,
        enabled: true,
        provider: 'anthropic' as const,
      },
    }
    const patch = createUserSettingsPatch(defaultUserSettings, draft)
    expect(patch).toEqual({
      aiAssessment: { enabled: true, provider: 'anthropic' },
    })
  })

  it('rejects an invalid provider value', () => {
    expect(() =>
      mergeUserSettings(defaultUserSettings, {
        // @ts-expect-error — invalid provider id, deliberately ill-typed
        aiAssessment: { provider: 'mistral' },
      }),
    ).toThrow()
  })
})
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npx vitest run src/features/settings/domain/settings.test.ts`
Expected: FAIL with messages about missing `aiAssessment` property on `defaultUserSettings`, etc.

- [ ] **Step 3: Add the schema**

Open `src/features/settings/domain/settings.ts`. Add the new schema near the other section schemas (e.g., immediately after `assessmentSettingsSchema`):

```ts
import { genAiProviderIds } from '@/features/genai'

export const aiAssessmentProviderSchema = z.enum(genAiProviderIds)

export const aiAssessmentModelSchema = z
  .string()
  .max(120, 'Maximum 120 characters')

const aiAssessmentSettingsSchema = z
  .object({
    enabled: z.boolean().default(false),
    provider: aiAssessmentProviderSchema.default('openai'),
    model: aiAssessmentModelSchema.default(''),
  })
  .strict()
```

- [ ] **Step 4: Wire it through `userSettingsSchema`**

In the same file, locate `userSettingsSchema` (around line 130). Add `aiAssessment` to its object (alphabetical-by-key would put it between `assessment` and `overlay` — match the existing field order):

```ts
export const userSettingsSchema = z
  .object({
    schemaVersion: z
      .literal(userSettingsSchemaVersion)
      .default(userSettingsSchemaVersion),
    appearance: appearanceSettingsSchema.default({ themeMode: 'system' }),
    practice: practiceSettingsSchema,
    review: reviewSettingsSchema,
    assessment: assessmentSettingsSchema,
    aiAssessment: aiAssessmentSettingsSchema.default({
      enabled: false,
      provider: 'openai',
      model: '',
    }),
    overlay: overlaySettingsSchema,
    reminders: remindersSettingsSchema,
  })
  .strict()
```

- [ ] **Step 5: Add to `userSettingsPatchSchema`**

In the same file, locate `userSettingsPatchSchema` (around line 144). Add an optional `aiAssessment` partial. Insert this entry between `assessment` and `overlay`:

```ts
    aiAssessment: z
      .object({
        enabled: aiAssessmentSettingsSchema.shape.enabled.optional(),
        provider: aiAssessmentSettingsSchema.shape.provider.optional(),
        model: aiAssessmentSettingsSchema.shape.model.optional(),
      })
      .strict()
      .optional(),
```

- [ ] **Step 6: Add to `defaultUserSettings`**

In the same file, locate `defaultUserSettings` (around line 191). Add the new block between `assessment` and `overlay`:

```ts
  aiAssessment: {
    enabled: false,
    provider: 'openai',
    model: '',
  },
```

- [ ] **Step 7: Add to `createMergedUserSettings`**

In the same file, locate `createMergedUserSettings` (around line 276). Add the new block — match the spread pattern used for the existing blocks:

```ts
    aiAssessment: {
      ...current.aiAssessment,
      ...patch.aiAssessment,
    },
```

- [ ] **Step 8: Add to `createUserSettingsPatch`**

In the same file, locate `createUserSettingsPatch` (around line 330). Add the diff logic — match the per-field pattern used for `assessment`:

```ts
  const aiAssessmentPatch: NonNullable<UserSettingsPatch['aiAssessment']> = {}
  if (saved.aiAssessment.enabled !== draft.aiAssessment.enabled) {
    aiAssessmentPatch.enabled = draft.aiAssessment.enabled
  }
  if (saved.aiAssessment.provider !== draft.aiAssessment.provider) {
    aiAssessmentPatch.provider = draft.aiAssessment.provider
  }
  if (saved.aiAssessment.model !== draft.aiAssessment.model) {
    aiAssessmentPatch.model = draft.aiAssessment.model
  }
  if (hasObjectKeys(aiAssessmentPatch)) {
    patch.aiAssessment = aiAssessmentPatch
  }
```

Add this block alphabetically between the `assessment` and `overlay` sections of `createUserSettingsPatch`.

- [ ] **Step 9: Run the tests and verify they pass**

Run: `npx vitest run src/features/settings/domain/settings.test.ts`
Expected: PASS (existing tests + 5 new aiAssessment tests).

Also run typecheck:

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 10: Commit**

```sh
git add src/features/settings/domain/settings.ts \
        src/features/settings/domain/settings.test.ts
git commit -m "feat(settings): add aiAssessment block to user settings"
```

---

## Task 2: GenAI secrets domain types

**Files:**
- Create: `src/features/genai/domain/genai-secrets-types.ts`
- Create: `src/features/genai/domain/genai-secrets-types.test.ts`
- Modify: `src/features/genai/domain/index.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/genai/domain/genai-secrets-types.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import {
  aiProviderSecretsSchema,
  emptyAiProviderSecrets,
  makeEmptyAiProviderSecretPresence,
} from './genai-secrets-types'

describe('genai secrets domain', () => {
  it('accepts a row with per-provider secrets', () => {
    const parsed = aiProviderSecretsSchema.parse({
      openai: { apiKey: 'sk-test', baseUrl: 'https://api.openai.com/v1' },
      anthropic: { apiKey: 'sk-ant-test' },
    })
    expect(parsed.openai?.apiKey).toBe('sk-test')
    expect(parsed.anthropic?.baseUrl).toBeUndefined()
    expect(parsed.gemini).toBeUndefined()
  })

  it('accepts an empty row', () => {
    expect(aiProviderSecretsSchema.parse({})).toEqual({})
  })

  it('rejects unknown providers via .strict()', () => {
    expect(() =>
      aiProviderSecretsSchema.parse({
        mistral: { apiKey: 'sk-x' },
      }),
    ).toThrow()
  })

  it('rejects empty apiKey', () => {
    expect(() =>
      aiProviderSecretsSchema.parse({ openai: { apiKey: '' } }),
    ).toThrow()
  })

  it('rejects invalid baseUrl', () => {
    expect(() =>
      aiProviderSecretsSchema.parse({
        openai: { apiKey: 'sk-x', baseUrl: 'not-a-url' },
      }),
    ).toThrow()
  })

  it('emptyAiProviderSecrets is an empty object', () => {
    expect(emptyAiProviderSecrets).toEqual({})
  })

  it('makeEmptyAiProviderSecretPresence returns all-false for known providers', () => {
    expect(makeEmptyAiProviderSecretPresence()).toEqual({
      openai: false,
      anthropic: false,
      gemini: false,
    })
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npx vitest run src/features/genai/domain/genai-secrets-types.test.ts`
Expected: FAIL with `Failed to resolve import "./genai-secrets-types"`.

- [ ] **Step 3: Create `genai-secrets-types.ts`**

Create `src/features/genai/domain/genai-secrets-types.ts`:

```ts
import { z } from 'zod'

import { genAiProviderIds, type GenAiProviderId } from './genai-types'

const aiProviderSecretSchema = z
  .object({
    apiKey: z.string().min(1, 'Required'),
    baseUrl: z.string().url().optional(),
  })
  .strict()

export type AiProviderSecret = z.infer<typeof aiProviderSecretSchema>

export const aiProviderSecretsSchema = z
  .object({
    openai: aiProviderSecretSchema.optional(),
    anthropic: aiProviderSecretSchema.optional(),
    gemini: aiProviderSecretSchema.optional(),
  })
  .strict()

export type AiProviderSecrets = z.infer<typeof aiProviderSecretsSchema>

export type AiProviderSecretPresence = Record<GenAiProviderId, boolean>

export const emptyAiProviderSecrets: AiProviderSecrets = {}

export function makeEmptyAiProviderSecretPresence(): AiProviderSecretPresence {
  return Object.fromEntries(
    genAiProviderIds.map((id) => [id, false]),
  ) as AiProviderSecretPresence
}
```

- [ ] **Step 4: Re-export from `domain/index.ts`**

Open `src/features/genai/domain/index.ts` and add a re-export block for the new types. Add it at the end of the file:

```ts
export {
  aiProviderSecretsSchema,
  emptyAiProviderSecrets,
  makeEmptyAiProviderSecretPresence,
  type AiProviderSecretPresence,
  type AiProviderSecrets,
} from './genai-secrets-types'
```

Note: `AiProviderSecret` (with the `apiKey` field) is intentionally NOT re-exported here. Consumers that need to build a secret object should go through the typed hook in Task 6, which renames the field at the boundary.

- [ ] **Step 5: Run the test and verify it passes**

Run: `npx vitest run src/features/genai/domain/genai-secrets-types.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 6: Commit**

```sh
git add src/features/genai/domain/genai-secrets-types.ts \
        src/features/genai/domain/genai-secrets-types.test.ts \
        src/features/genai/domain/index.ts
git commit -m "feat(genai): add per-provider secrets domain types"
```

---

## Task 3: Secrets store (background-only)

**Files:**
- Create: `src/features/genai/server/genai-secrets-store.ts`
- Create: `src/features/genai/server/genai-secrets-store.test.ts`

This task uses the existing in-memory SQLite test harness. Look at `src/features/settings/data/settings-repository.test.ts` for the pattern (it uses the same `settings_kv` table).

- [ ] **Step 1: Write the failing test**

Create `src/features/genai/server/genai-secrets-store.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  closeTestDb,
  createTestDb,
  type Db,
} from '@/platform/db/testing'

import {
  emptyAiProviderSecrets,
  type AiProviderSecret,
} from '../domain/genai-secrets-types'
import { GenAiSecretsStore, createGenAiSecretsStore } from './genai-secrets-store'

let db: Db
let store: GenAiSecretsStore

beforeEach(async () => {
  db = await createTestDb()
  store = createGenAiSecretsStore(db)
})

afterEach(async () => {
  await closeTestDb(db)
})

const openaiSecret: AiProviderSecret = { apiKey: 'sk-openai-test' }
const anthropicSecret: AiProviderSecret = {
  apiKey: 'sk-ant-test',
  baseUrl: 'https://api.anthropic.com',
}

describe('GenAiSecretsStore', () => {
  it('returns empty when no row exists', async () => {
    expect(await store.read()).toEqual(emptyAiProviderSecrets)
  })

  it('sets a provider secret and reads it back', async () => {
    await store.setProvider('openai', openaiSecret)
    expect(await store.read()).toEqual({ openai: openaiSecret })
  })

  it('preserves both providers when set independently', async () => {
    await store.setProvider('openai', openaiSecret)
    await store.setProvider('anthropic', anthropicSecret)
    expect(await store.read()).toEqual({
      openai: openaiSecret,
      anthropic: anthropicSecret,
    })
  })

  it('clearProvider removes only the named provider', async () => {
    await store.setProvider('openai', openaiSecret)
    await store.setProvider('anthropic', anthropicSecret)
    await store.clearProvider('openai')
    expect(await store.read()).toEqual({ anthropic: anthropicSecret })
  })

  it('clearAll empties the row', async () => {
    await store.setProvider('openai', openaiSecret)
    await store.setProvider('gemini', { apiKey: 'g-test' })
    await store.clearAll()
    expect(await store.read()).toEqual(emptyAiProviderSecrets)
  })

  it('returns empty when the stored value is corrupted JSON', async () => {
    await db
      .insert(settingsKv)
      .values({
        key: 'genai-secrets',
        value: '{not valid json',
        updatedAt: Date.now(),
      })
    expect(await store.read()).toEqual(emptyAiProviderSecrets)
  })

  it('returns empty when the stored shape fails Zod validation', async () => {
    await db
      .insert(settingsKv)
      .values({
        key: 'genai-secrets',
        value: JSON.stringify({ openai: 'not-an-object' }),
        updatedAt: Date.now(),
      })
    expect(await store.read()).toEqual(emptyAiProviderSecrets)
  })
})
```

Note the test imports `settingsKv` and the test-db helpers. Add these imports near the top of the test file:

```ts
import { settingsKv } from '@/platform/db/schema'
```

If `createTestDb`/`closeTestDb` are not the exact names in the codebase, look at `src/features/settings/data/settings-repository.test.ts` and match its helper names exactly. The test-db infrastructure already exists; the conventions are stable.

- [ ] **Step 2: Run the test and verify it fails**

Run: `npx vitest run src/features/genai/server/genai-secrets-store.test.ts`
Expected: FAIL with `Failed to resolve import "./genai-secrets-store"`.

- [ ] **Step 3: Implement `genai-secrets-store.ts`**

Create `src/features/genai/server/genai-secrets-store.ts`:

```ts
import { eq } from 'drizzle-orm'

import type { Db } from '@/platform/db'
import { settingsKv } from '@/platform/db/schema'

import {
  aiProviderSecretsSchema,
  emptyAiProviderSecrets,
  type AiProviderSecret,
  type AiProviderSecrets,
} from '../domain/genai-secrets-types'
import type { GenAiProviderId } from '../domain/genai-types'

const SECRETS_KEY = 'genai-secrets'

export function createGenAiSecretsStore(db: Db) {
  return new GenAiSecretsStore(db)
}

export class GenAiSecretsStore {
  constructor(private readonly db: Db) {}

  async read(): Promise<AiProviderSecrets> {
    const row = await this.db
      .select({ value: settingsKv.value })
      .from(settingsKv)
      .where(eq(settingsKv.key, SECRETS_KEY))
      .get()
    if (!row) return emptyAiProviderSecrets

    let parsedJson: unknown
    try {
      parsedJson = JSON.parse(row.value)
    } catch {
      return emptyAiProviderSecrets
    }
    const parsed = aiProviderSecretsSchema.safeParse(parsedJson)
    return parsed.success ? parsed.data : emptyAiProviderSecrets
  }

  async setProvider(
    provider: GenAiProviderId,
    secret: AiProviderSecret,
    now = new Date(),
  ): Promise<AiProviderSecrets> {
    return this.write((current) => ({ ...current, [provider]: secret }), now)
  }

  async clearProvider(
    provider: GenAiProviderId,
    now = new Date(),
  ): Promise<AiProviderSecrets> {
    return this.write((current) => {
      const next = { ...current }
      delete next[provider]
      return next
    }, now)
  }

  async clearAll(now = new Date()): Promise<AiProviderSecrets> {
    return this.write(() => ({}), now)
  }

  private async write(
    mutate: (current: AiProviderSecrets) => AiProviderSecrets,
    now: Date,
  ): Promise<AiProviderSecrets> {
    return this.db.transaction(async (tx) => {
      const current = await this.read()
      const next = mutate(current)
      const timestamp = now.getTime()
      const serialized = JSON.stringify(next)
      await tx
        .insert(settingsKv)
        .values({
          key: SECRETS_KEY,
          value: serialized,
          updatedAt: timestamp,
        })
        .onConflictDoUpdate({
          target: settingsKv.key,
          set: { value: serialized, updatedAt: timestamp },
        })
      return next
    })
  }
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npx vitest run src/features/genai/server/genai-secrets-store.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```sh
git add src/features/genai/server/genai-secrets-store.ts \
        src/features/genai/server/genai-secrets-store.test.ts
git commit -m "feat(genai): add background-only secrets KV store"
```

---

## Task 4: Settings service + `loadActiveProviderConfig` composer

**Files:**
- Create: `src/features/genai/server/genai-settings-service.ts`
- Create: `src/features/genai/server/genai-settings-service.test.ts`

This service is the canonical place where settings + secrets compose into `GenAiProviderConfig`. The runtime endpoint (#6) and app-shell (next task) call into it.

- [ ] **Step 1: Write the failing tests**

Create `src/features/genai/server/genai-settings-service.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  closeTestDb,
  createTestDb,
  type Db,
} from '@/platform/db/testing'
import {
  getSettings,
  updateSettings,
} from '@/features/settings/server/settings-service'

import {
  clearAiProviderSecret,
  getAiProviderSecretPresence,
  isAiAssessmentAvailable,
  loadActiveProviderConfig,
  setAiProviderSecret,
} from './genai-settings-service'

let db: Db

beforeEach(async () => {
  db = await createTestDb()
})

afterEach(async () => {
  await closeTestDb(db)
})

describe('getAiProviderSecretPresence', () => {
  it('returns all-false on empty store', async () => {
    expect(await getAiProviderSecretPresence(db)).toEqual({
      openai: false,
      anthropic: false,
      gemini: false,
    })
  })

  it('reflects which providers have keys', async () => {
    await setAiProviderSecret(db, 'anthropic', { apiKey: 'sk-ant' })
    expect(await getAiProviderSecretPresence(db)).toEqual({
      openai: false,
      anthropic: true,
      gemini: false,
    })
  })
})

describe('setAiProviderSecret / clearAiProviderSecret', () => {
  it('set returns updated presence', async () => {
    const presence = await setAiProviderSecret(db, 'openai', { apiKey: 'sk-o' })
    expect(presence.openai).toBe(true)
  })

  it('clear removes only the named provider', async () => {
    await setAiProviderSecret(db, 'openai', { apiKey: 'sk-o' })
    await setAiProviderSecret(db, 'gemini', { apiKey: 'g-x' })
    const presence = await clearAiProviderSecret(db, 'openai')
    expect(presence).toEqual({ openai: false, anthropic: false, gemini: true })
  })
})

describe('loadActiveProviderConfig', () => {
  it('returns null when aiAssessment.enabled is false', async () => {
    await updateSettings(db, {
      aiAssessment: { enabled: false, provider: 'openai', model: 'gpt-test' },
    })
    await setAiProviderSecret(db, 'openai', { apiKey: 'sk-test' })
    expect(await loadActiveProviderConfig(db)).toBeNull()
  })

  it('returns null when model is empty', async () => {
    await updateSettings(db, {
      aiAssessment: { enabled: true, provider: 'openai', model: '' },
    })
    await setAiProviderSecret(db, 'openai', { apiKey: 'sk-test' })
    expect(await loadActiveProviderConfig(db)).toBeNull()
  })

  it('returns null when the active provider has no secret', async () => {
    await updateSettings(db, {
      aiAssessment: { enabled: true, provider: 'anthropic', model: 'claude' },
    })
    await setAiProviderSecret(db, 'openai', { apiKey: 'sk-test' })
    expect(await loadActiveProviderConfig(db)).toBeNull()
  })

  it('returns a full config when all conditions are met', async () => {
    await updateSettings(db, {
      aiAssessment: { enabled: true, provider: 'openai', model: 'gpt-test' },
    })
    await setAiProviderSecret(db, 'openai', { apiKey: 'sk-test' })
    expect(await loadActiveProviderConfig(db)).toEqual({
      provider: 'openai',
      model: 'gpt-test',
      apiKey: 'sk-test',
    })
  })

  it('includes baseUrl when the secret has one', async () => {
    await updateSettings(db, {
      aiAssessment: { enabled: true, provider: 'gemini', model: 'gemini-test' },
    })
    await setAiProviderSecret(db, 'gemini', {
      apiKey: 'g-test',
      baseUrl: 'https://proxy.example.test',
    })
    expect(await loadActiveProviderConfig(db)).toEqual({
      provider: 'gemini',
      model: 'gemini-test',
      apiKey: 'g-test',
      baseUrl: 'https://proxy.example.test',
    })
  })

  it('treats whitespace-only model as empty', async () => {
    await updateSettings(db, {
      aiAssessment: { enabled: true, provider: 'openai', model: '   ' },
    })
    await setAiProviderSecret(db, 'openai', { apiKey: 'sk-test' })
    expect(await loadActiveProviderConfig(db)).toBeNull()
  })
})

describe('isAiAssessmentAvailable', () => {
  it('returns false when no config can be resolved', async () => {
    expect(await isAiAssessmentAvailable(db)).toBe(false)
  })

  it('returns true when a full config can be resolved', async () => {
    await updateSettings(db, {
      aiAssessment: { enabled: true, provider: 'openai', model: 'gpt-test' },
    })
    await setAiProviderSecret(db, 'openai', { apiKey: 'sk-test' })
    expect(await isAiAssessmentAvailable(db)).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npx vitest run src/features/genai/server/genai-settings-service.test.ts`
Expected: FAIL with `Failed to resolve import "./genai-settings-service"`.

- [ ] **Step 3: Implement `genai-settings-service.ts`**

Create `src/features/genai/server/genai-settings-service.ts`:

```ts
import { getSettings } from '@/features/settings/server/settings-service'
import type { Db } from '@/platform/db'

import type {
  AiProviderSecret,
  AiProviderSecretPresence,
} from '../domain/genai-secrets-types'
import { makeEmptyAiProviderSecretPresence } from '../domain/genai-secrets-types'
import type {
  GenAiProviderConfig,
  GenAiProviderId,
} from '../domain/genai-types'
import { genAiProviderIds } from '../domain/genai-types'
import { createGenAiSecretsStore } from './genai-secrets-store'

export async function getAiProviderSecretPresence(
  db: Db,
): Promise<AiProviderSecretPresence> {
  const secrets = await createGenAiSecretsStore(db).read()
  const presence = makeEmptyAiProviderSecretPresence()
  for (const id of genAiProviderIds) {
    presence[id] = secrets[id] !== undefined
  }
  return presence
}

export async function setAiProviderSecret(
  db: Db,
  provider: GenAiProviderId,
  secret: AiProviderSecret,
): Promise<AiProviderSecretPresence> {
  await createGenAiSecretsStore(db).setProvider(provider, secret)
  return getAiProviderSecretPresence(db)
}

export async function clearAiProviderSecret(
  db: Db,
  provider: GenAiProviderId,
): Promise<AiProviderSecretPresence> {
  await createGenAiSecretsStore(db).clearProvider(provider)
  return getAiProviderSecretPresence(db)
}

export async function loadActiveProviderConfig(
  db: Db,
): Promise<GenAiProviderConfig | null> {
  const settings = await getSettings(db)
  const ai = settings.aiAssessment

  if (!ai.enabled) return null
  if (ai.model.trim() === '') return null

  const secrets = await createGenAiSecretsStore(db).read()
  const secret = secrets[ai.provider]
  if (!secret) return null

  return {
    provider: ai.provider,
    model: ai.model,
    apiKey: secret.apiKey,
    ...(secret.baseUrl !== undefined ? { baseUrl: secret.baseUrl } : {}),
  }
}

export async function isAiAssessmentAvailable(db: Db): Promise<boolean> {
  return (await loadActiveProviderConfig(db)) !== null
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npx vitest run src/features/genai/server/genai-settings-service.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```sh
git add src/features/genai/server/genai-settings-service.ts \
        src/features/genai/server/genai-settings-service.test.ts
git commit -m "feat(genai): compose settings + secrets into a resolved provider config"
```

---

## Task 5: Runtime plumbing (contracts, ProtocolMap, policy, handlers)

**Files:**
- Create: `src/features/genai/api/genai-settings-contracts.ts`
- Create: `src/features/genai/api/index.ts`
- Modify: `src/extension/messaging.ts`
- Modify: `src/extension/background/runtime-policy.ts`
- Modify: `src/extension/background/runtime-policy.test.ts`
- Modify: `src/extension/background/register-handlers.ts`

- [ ] **Step 1: Create request contracts**

Create `src/features/genai/api/genai-settings-contracts.ts`:

```ts
import { z } from 'zod'

import { genAiProviderIds } from '../domain/genai-types'

const surfaceSchema = z.enum(['popup', 'dashboard'])

const aiProviderSecretBodySchema = z
  .object({
    apiKey: z.string().min(1),
    baseUrl: z.string().url().optional(),
  })
  .strict()

export const getAiProviderSecretPresenceRequestSchema = z
  .object({
    surface: surfaceSchema,
  })
  .strict()

export const setAiProviderSecretRequestSchema = z
  .object({
    surface: surfaceSchema,
    provider: z.enum(genAiProviderIds),
    secret: aiProviderSecretBodySchema,
  })
  .strict()

export const clearAiProviderSecretRequestSchema = z
  .object({
    surface: surfaceSchema,
    provider: z.enum(genAiProviderIds),
  })
  .strict()

export type GetAiProviderSecretPresenceRequest = z.infer<
  typeof getAiProviderSecretPresenceRequestSchema
>
export type SetAiProviderSecretRequest = z.infer<
  typeof setAiProviderSecretRequestSchema
>
export type ClearAiProviderSecretRequest = z.infer<
  typeof clearAiProviderSecretRequestSchema
>
```

- [ ] **Step 2: Create `src/features/genai/api/index.ts`**

Create `src/features/genai/api/index.ts`:

```ts
export {
  clearAiProviderSecretRequestSchema,
  getAiProviderSecretPresenceRequestSchema,
  setAiProviderSecretRequestSchema,
  type ClearAiProviderSecretRequest,
  type GetAiProviderSecretPresenceRequest,
  type SetAiProviderSecretRequest,
} from './genai-settings-contracts'
```

(Task 6 will add a hooks re-export to this same file.)

- [ ] **Step 3: Register the three methods in `runtime-policy.ts`**

Open `src/extension/background/runtime-policy.ts`. Locate `methodSurfaceAccess` (the big object). Add these three entries; placement should follow the existing alphabetical-ish grouping (after the `leetcode.*` entries):

```ts
  'genai.getAiProviderSecretPresence': ['popup', 'dashboard'],
  'genai.setAiProviderSecret': ['popup', 'dashboard'],
  'genai.clearAiProviderSecret': ['popup', 'dashboard'],
```

- [ ] **Step 4: Update `runtime-policy.test.ts`**

Open `src/extension/background/runtime-policy.test.ts`. There's an existing test that asserts on the policy table. Append three assertions verifying the new entries (use whatever expectation pattern the existing tests use — e.g., `expect(canCallExtensionMethod('settings.getSettings', 'popup')).toBe(true)` etc.):

```ts
describe('genai method surface enforcement', () => {
  it('allows popup and dashboard to call genai secret methods', () => {
    for (const method of [
      'genai.getAiProviderSecretPresence',
      'genai.setAiProviderSecret',
      'genai.clearAiProviderSecret',
    ] as const) {
      expect(canCallExtensionMethod(method, 'popup')).toBe(true)
      expect(canCallExtensionMethod(method, 'dashboard')).toBe(true)
    }
  })

  it('blocks content-script and background from calling genai secret methods', () => {
    for (const method of [
      'genai.getAiProviderSecretPresence',
      'genai.setAiProviderSecret',
      'genai.clearAiProviderSecret',
    ] as const) {
      expect(canCallExtensionMethod(method, 'content-script')).toBe(false)
      expect(canCallExtensionMethod(method, 'background')).toBe(false)
    }
  })
})
```

If `canCallExtensionMethod` is not directly imported in the test file already, add the import:

```ts
import { canCallExtensionMethod } from './runtime-policy'
```

- [ ] **Step 5: Add ProtocolMap entries in `messaging.ts`**

Open `src/extension/messaging.ts`. Near the top (matching the existing imports from other features), add a block:

```ts
import {
  clearAiProviderSecretRequestSchema,
  getAiProviderSecretPresenceRequestSchema,
  setAiProviderSecretRequestSchema,
  type ClearAiProviderSecretRequest,
  type GetAiProviderSecretPresenceRequest,
  type SetAiProviderSecretRequest,
} from '@/features/genai/api'
import type { AiProviderSecretPresence } from '@/features/genai'

export {
  clearAiProviderSecretRequestSchema,
  getAiProviderSecretPresenceRequestSchema,
  setAiProviderSecretRequestSchema,
} from '@/features/genai/api'
```

In the `ProtocolMap` interface (the one starting around line 290), add three new methods. Place them alphabetically — between `backup.*` and `leetcode.*` is the natural spot if alphabetical:

```ts
  'genai.getAiProviderSecretPresence'(
    request: GetAiProviderSecretPresenceRequest,
  ): AiProviderSecretPresence
  'genai.setAiProviderSecret'(
    request: SetAiProviderSecretRequest,
  ): AiProviderSecretPresence
  'genai.clearAiProviderSecret'(
    request: ClearAiProviderSecretRequest,
  ): AiProviderSecretPresence
```

- [ ] **Step 6: Register handlers in `register-handlers.ts`**

Open `src/extension/background/register-handlers.ts`. At the top, add imports next to the other feature service imports:

```ts
import {
  clearAiProviderSecretRequestSchema,
  getAiProviderSecretPresenceRequestSchema,
  setAiProviderSecretRequestSchema,
} from '@/extension/messaging'
import {
  clearAiProviderSecret,
  getAiProviderSecretPresence,
  setAiProviderSecret,
} from '@/features/genai/server/genai-settings-service'
```

Inside the function that contains all the `onMessage(...)` registrations (look at the end of the file — `onMessage('leetcode.readSubmissionResult', ...)`'s neighborhood), add three new registrations BEFORE the closing brace of that function:

```ts
  onMessage('genai.getAiProviderSecretPresence', ({ data, sender }) => {
    const request = getAiProviderSecretPresenceRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'genai.getAiProviderSecretPresence',
      request.surface,
      sender,
    )
    return getAppDb().then(({ db }) => getAiProviderSecretPresence(db))
  })

  onMessage('genai.setAiProviderSecret', ({ data, sender }) => {
    const request = setAiProviderSecretRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'genai.setAiProviderSecret',
      request.surface,
      sender,
    )
    return getAppDb().then(({ db }) =>
      setAiProviderSecret(db, request.provider, request.secret),
    )
  })

  onMessage('genai.clearAiProviderSecret', ({ data, sender }) => {
    const request = clearAiProviderSecretRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'genai.clearAiProviderSecret',
      request.surface,
      sender,
    )
    return getAppDb().then(({ db }) =>
      clearAiProviderSecret(db, request.provider),
    )
  })
```

- [ ] **Step 7: Run typecheck + runtime-policy tests**

Run: `npm run typecheck`
Expected: PASS.

Run: `npx vitest run src/extension/background/runtime-policy.test.ts`
Expected: PASS (existing tests + 2 new tests).

- [ ] **Step 8: Commit**

```sh
git add src/features/genai/api/genai-settings-contracts.ts \
        src/features/genai/api/index.ts \
        src/extension/messaging.ts \
        src/extension/background/runtime-policy.ts \
        src/extension/background/runtime-policy.test.ts \
        src/extension/background/register-handlers.ts
git commit -m "feat(genai): expose secret-management runtime methods"
```

---

## Task 6: TanStack Query hooks (in the genai feature)

**Files:**
- Create: `src/features/genai/api/genai-settings-hooks.ts`
- Create: `src/features/genai/api/genai-settings-hooks.test.tsx`
- Modify: `src/features/genai/api/index.ts`
- Modify: `src/features/genai/index.ts`
- Modify: `src/platform/query/query-keys.ts`

The hooks live in `features/genai/` so the `apiKey` field-rename can happen inside the genai feature (architecture-boundary test scans every other feature for the literal `apiKey`).

- [ ] **Step 1: Add a query key namespace**

Open `src/platform/query/query-keys.ts`. Locate the `queryKeys` object. Add a new section (alphabetical order would put it between `appShell` and `practice`, but match the existing convention if different):

```ts
  genai: {
    all: ['genai'] as const,
    secretPresence: () => [...queryKeys.genai.all, 'secret-presence'] as const,
  },
```

- [ ] **Step 2: Write the failing test**

Create `src/features/genai/api/genai-settings-hooks.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/extension/messaging', () => ({
  sendMessage: vi.fn(),
}))

import { sendMessage } from '@/extension/messaging'

import {
  useClearAiProviderSecretMutation,
  useGenAiSecretPresenceQuery,
  useSetAiProviderSecretMutation,
} from './genai-settings-hooks'

let queryClient: QueryClient
function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  vi.mocked(sendMessage).mockReset()
})

afterEach(() => {
  queryClient.clear()
})

describe('useGenAiSecretPresenceQuery', () => {
  it('fetches presence via sendMessage with dashboard surface', async () => {
    vi.mocked(sendMessage).mockResolvedValue({
      openai: true,
      anthropic: false,
      gemini: false,
    } as never)

    const { result } = renderHook(() => useGenAiSecretPresenceQuery(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({
      openai: true,
      anthropic: false,
      gemini: false,
    })
    expect(sendMessage).toHaveBeenCalledWith(
      'genai.getAiProviderSecretPresence',
      { surface: 'dashboard' },
    )
  })
})

describe('useSetAiProviderSecretMutation', () => {
  it('translates the hook input key to apiKey at the runtime boundary', async () => {
    vi.mocked(sendMessage).mockResolvedValue({
      openai: true,
      anthropic: false,
      gemini: false,
    } as never)

    const { result } = renderHook(() => useSetAiProviderSecretMutation(), {
      wrapper,
    })

    await act(async () => {
      await result.current.mutateAsync({
        provider: 'openai',
        key: 'sk-test-key',
      })
    })

    expect(sendMessage).toHaveBeenCalledWith('genai.setAiProviderSecret', {
      surface: 'dashboard',
      provider: 'openai',
      secret: { apiKey: 'sk-test-key' },
    })
  })

  it('includes baseUrl in the runtime payload when provided', async () => {
    vi.mocked(sendMessage).mockResolvedValue({
      openai: true,
      anthropic: false,
      gemini: false,
    } as never)

    const { result } = renderHook(() => useSetAiProviderSecretMutation(), {
      wrapper,
    })

    await act(async () => {
      await result.current.mutateAsync({
        provider: 'gemini',
        key: 'g-test',
        baseUrl: 'https://proxy.example.test',
      })
    })

    expect(sendMessage).toHaveBeenCalledWith('genai.setAiProviderSecret', {
      surface: 'dashboard',
      provider: 'gemini',
      secret: { apiKey: 'g-test', baseUrl: 'https://proxy.example.test' },
    })
  })

  it('updates the presence cache on success', async () => {
    const presence = { openai: false, anthropic: true, gemini: false }
    vi.mocked(sendMessage).mockResolvedValue(presence as never)

    const { result } = renderHook(() => useSetAiProviderSecretMutation(), {
      wrapper,
    })

    await act(async () => {
      await result.current.mutateAsync({
        provider: 'anthropic',
        key: 'sk-ant-test',
      })
    })

    expect(queryClient.getQueryData(['genai', 'secret-presence'])).toEqual(
      presence,
    )
  })
})

describe('useClearAiProviderSecretMutation', () => {
  it('calls clearAiProviderSecret via sendMessage and updates the cache', async () => {
    const presence = { openai: false, anthropic: false, gemini: false }
    vi.mocked(sendMessage).mockResolvedValue(presence as never)

    const { result } = renderHook(() => useClearAiProviderSecretMutation(), {
      wrapper,
    })

    await act(async () => {
      await result.current.mutateAsync({ provider: 'openai' })
    })

    expect(sendMessage).toHaveBeenCalledWith('genai.clearAiProviderSecret', {
      surface: 'dashboard',
      provider: 'openai',
    })
    expect(queryClient.getQueryData(['genai', 'secret-presence'])).toEqual(
      presence,
    )
  })
})
```

- [ ] **Step 3: Run the test and verify it fails**

Run: `npx vitest run src/features/genai/api/genai-settings-hooks.test.tsx`
Expected: FAIL with `Failed to resolve import "./genai-settings-hooks"`.

- [ ] **Step 4: Implement the hooks**

Create `src/features/genai/api/genai-settings-hooks.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { sendMessage } from '@/extension/messaging'
import { queryKeys } from '@/platform/query/query-keys'

import type { AiProviderSecretPresence } from '../domain/genai-secrets-types'
import type { GenAiProviderId } from '../domain/genai-types'

export function useGenAiSecretPresenceQuery() {
  return useQuery({
    queryKey: queryKeys.genai.secretPresence(),
    queryFn: (): Promise<AiProviderSecretPresence> =>
      sendMessage('genai.getAiProviderSecretPresence', {
        surface: 'dashboard',
      }),
  })
}

export type SetAiProviderSecretHookInput = {
  provider: GenAiProviderId
  key: string
  baseUrl?: string
}

export function useSetAiProviderSecretMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SetAiProviderSecretHookInput) =>
      sendMessage('genai.setAiProviderSecret', {
        surface: 'dashboard',
        provider: input.provider,
        secret: {
          apiKey: input.key,
          ...(input.baseUrl !== undefined ? { baseUrl: input.baseUrl } : {}),
        },
      }),
    onSuccess: (presence) => {
      queryClient.setQueryData(queryKeys.genai.secretPresence(), presence)
    },
  })
}

export type ClearAiProviderSecretHookInput = {
  provider: GenAiProviderId
}

export function useClearAiProviderSecretMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ClearAiProviderSecretHookInput) =>
      sendMessage('genai.clearAiProviderSecret', {
        surface: 'dashboard',
        provider: input.provider,
      }),
    onSuccess: (presence) => {
      queryClient.setQueryData(queryKeys.genai.secretPresence(), presence)
    },
  })
}
```

- [ ] **Step 5: Re-export through the api barrel**

Open `src/features/genai/api/index.ts` and add at the end:

```ts
export {
  useClearAiProviderSecretMutation,
  useGenAiSecretPresenceQuery,
  useSetAiProviderSecretMutation,
  type ClearAiProviderSecretHookInput,
  type SetAiProviderSecretHookInput,
} from './genai-settings-hooks'
```

- [ ] **Step 6: Re-export from the root barrel**

Open `src/features/genai/index.ts`. Add this export block at the end:

```ts
export {
  useClearAiProviderSecretMutation,
  useGenAiSecretPresenceQuery,
  useSetAiProviderSecretMutation,
  type AiProviderSecretPresence,
  type ClearAiProviderSecretHookInput,
  type SetAiProviderSecretHookInput,
} from './api'
```

(`AiProviderSecretPresence` is exported here too because the UI component will use it for typing. `AiProviderSecret` — the type with the `apiKey` field — is intentionally NOT re-exported at the root.)

- [ ] **Step 7: Run the tests and verify they pass**

Run: `npx vitest run src/features/genai/api/genai-settings-hooks.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 8: Commit**

```sh
git add src/features/genai/api \
        src/features/genai/index.ts \
        src/platform/query/query-keys.ts
git commit -m "feat(genai): expose React Query hooks for secret management"
```

---

## Task 7: App-shell exposure + leak defense

**Files:**
- Modify: `src/features/app-shell/api/app-shell-contracts.ts`
- Modify: `src/features/app-shell/server/app-shell-service.ts`
- Modify: `src/features/app-shell/server/app-shell-service.test.ts`
- Modify: `src/testing/architecture-boundaries.test.ts`

- [ ] **Step 1: Write the failing app-shell tests**

Open `src/features/app-shell/server/app-shell-service.test.ts`. Find the existing overlay-data test or create a new `describe('aiAssessmentAvailable on overlay payload', …)` block. Add these tests:

```ts
describe('aiAssessmentAvailable on overlay payload', () => {
  it('is false when aiAssessment.enabled is false', async () => {
    // The default user-settings row has aiAssessment.enabled = false.
    const payload = await getOverlayAppShellData(db, baseOverlayRequest, now)
    expect(payload.overlay.aiAssessmentAvailable).toBe(false)
  })

  it('is false when enabled but model is empty', async () => {
    await updateSettings(db, { aiAssessment: { enabled: true, model: '' } })
    await setAiProviderSecret(db, 'openai', { apiKey: 'sk-x' })
    const payload = await getOverlayAppShellData(db, baseOverlayRequest, now)
    expect(payload.overlay.aiAssessmentAvailable).toBe(false)
  })

  it('is false when enabled and model set but key missing', async () => {
    await updateSettings(db, {
      aiAssessment: { enabled: true, provider: 'openai', model: 'gpt-test' },
    })
    // no setAiProviderSecret call
    const payload = await getOverlayAppShellData(db, baseOverlayRequest, now)
    expect(payload.overlay.aiAssessmentAvailable).toBe(false)
  })

  it('is true when fully configured', async () => {
    await updateSettings(db, {
      aiAssessment: { enabled: true, provider: 'openai', model: 'gpt-test' },
    })
    await setAiProviderSecret(db, 'openai', { apiKey: 'sk-must-not-leak' })
    const payload = await getOverlayAppShellData(db, baseOverlayRequest, now)
    expect(payload.overlay.aiAssessmentAvailable).toBe(true)
  })

  it('serialized overlay payload never contains apiKey or the literal key string', async () => {
    await updateSettings(db, {
      aiAssessment: { enabled: true, provider: 'openai', model: 'gpt-test' },
    })
    await setAiProviderSecret(db, 'openai', { apiKey: 'sk-must-not-leak' })
    const payload = await getOverlayAppShellData(db, baseOverlayRequest, now)
    const serialized = JSON.stringify(payload)
    expect(serialized).not.toContain('apiKey')
    expect(serialized).not.toContain('sk-must-not-leak')
  })
})

describe('settings.aiAssessment on popup/dashboard payloads', () => {
  it('popup payload exposes safe aiAssessment fields', async () => {
    await updateSettings(db, {
      aiAssessment: { enabled: true, provider: 'anthropic', model: 'claude-x' },
    })
    await setAiProviderSecret(db, 'anthropic', { apiKey: 'sk-ant-must-not-leak' })
    const payload = await getPopupAppShellData(db, basePopupRequest, now)
    expect(payload.settings.aiAssessment).toEqual({
      enabled: true,
      provider: 'anthropic',
      model: 'claude-x',
    })
    const serialized = JSON.stringify(payload)
    expect(serialized).not.toContain('apiKey')
    expect(serialized).not.toContain('sk-ant-must-not-leak')
  })

  it('dashboard payload exposes safe aiAssessment fields but no apiKey', async () => {
    await updateSettings(db, {
      aiAssessment: { enabled: true, provider: 'gemini', model: 'gemini-x' },
    })
    await setAiProviderSecret(db, 'gemini', { apiKey: 'g-must-not-leak' })
    const payload = await getDashboardAppShellData(db, baseDashboardRequest, now)
    expect(payload.settings.aiAssessment).toEqual({
      enabled: true,
      provider: 'gemini',
      model: 'gemini-x',
    })
    const serialized = JSON.stringify(payload)
    expect(serialized).not.toContain('apiKey')
    expect(serialized).not.toContain('g-must-not-leak')
  })
})
```

If the test file uses different request-builder helpers, match the file's existing pattern. The `setAiProviderSecret` import comes from `@/features/genai/server/genai-settings-service`; `updateSettings` from `@/features/settings/server/settings-service`. Add these imports at the top of the test file if not already present.

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npx vitest run src/features/app-shell/server/app-shell-service.test.ts`
Expected: FAIL — `overlay.aiAssessmentAvailable` doesn't exist on the payload yet, and `settings.aiAssessment` is absent from popup/dashboard.

- [ ] **Step 3: Update contracts**

Open `src/features/app-shell/api/app-shell-contracts.ts`. Locate `appShellSettingsSummarySchema` and add `aiAssessment` (alphabetical-ish, follow surrounding order):

```ts
const appShellAiAssessmentSettingsSchema = userSettingsSchema.shape.aiAssessment

const appShellSettingsSummarySchema = z.object({
  appearance: userSettingsSchema.shape.appearance,
  practice: userSettingsSchema.shape.practice,
  review: userSettingsSchema.shape.review,
  assessment: appShellAssessmentSettingsSchema,
  aiAssessment: appShellAiAssessmentSettingsSchema,
})
```

Then locate `overlayAppShellDataSchema` and add the boolean field:

```ts
export const overlayAppShellDataSchema = z.object({
  generatedAt: z.iso.datetime(),
  surface: z.literal('overlay'),
  overlay: z.object({
    appearance: userSettingsSchema.shape.appearance,
    automation: overlayAutomationSettingsSchema,
    problem: appShellProblemSummarySchema.nullable(),
    practice: practiceDetailsSchema.nullable(),
    timing: appShellAssessmentSettingsSchema,
    nextStep: overlayNextStepSchema.nullable(),
    aiAssessmentAvailable: z.boolean(),
  }),
})
```

- [ ] **Step 4: Wire `isAiAssessmentAvailable` into the service**

Open `src/features/app-shell/server/app-shell-service.ts`. Add the import at the top with the other feature-service imports:

```ts
import { isAiAssessmentAvailable } from '@/features/genai/server/genai-settings-service'
```

Locate `getOverlayAppShellData` (or whatever function builds the overlay payload). Compute the flag and include it in the overlay block:

```ts
const aiAssessmentAvailable = await isAiAssessmentAvailable(db)

return {
  generatedAt: ...,
  surface: 'overlay' as const,
  overlay: {
    appearance: ...,
    automation: ...,
    problem: ...,
    practice: ...,
    timing: ...,
    nextStep: ...,
    aiAssessmentAvailable,
  },
}
```

The popup and dashboard builders need NO additional wiring — they already use the full `settings` summary which now includes `aiAssessment` automatically because we extended `appShellSettingsSummarySchema`.

- [ ] **Step 5: Add the architecture-boundary leak test**

Open `src/testing/architecture-boundaries.test.ts`. After the existing `describe('architecture boundaries', …)` block's last `it`, add:

```ts
  it('keeps the apiKey literal out of every feature except genai', () => {
    const apiKeyPattern = /\bapiKey\b/
    const genaiPath = `${join(srcRoot, 'features/genai')}/`
    const offenders = sourceFiles([
      'app',
      'components',
      'entrypoints',
      'features',
      'hooks',
      'lib',
      'platform',
      'utils',
    ])
      .filter((file) => !file.startsWith(genaiPath))
      .filter((file) => apiKeyPattern.test(readFileSync(file, 'utf8')))

    expect(offenders.map(toRepoPath)).toEqual([])
  })
```

The `sourceFiles` helper already excludes `.test.ts(x)` files, so test fixtures that use `'apiKey'` literals (e.g., the hooks test in Task 6) don't trip the check.

- [ ] **Step 6: Run the app-shell + architecture tests**

Run: `npx vitest run src/features/app-shell/server/app-shell-service.test.ts`
Expected: PASS (new tests + existing tests).

Run: `npx vitest run src/testing/architecture-boundaries.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```sh
git add src/features/app-shell/api/app-shell-contracts.ts \
        src/features/app-shell/server/app-shell-service.ts \
        src/features/app-shell/server/app-shell-service.test.ts \
        src/testing/architecture-boundaries.test.ts
git commit -m "feat(app-shell): expose aiAssessmentAvailable + lock down apiKey leaks"
```

---

## Task 8: Settings UI section + reducer + screen mount

**Files:**
- Create: `src/features/settings/components/sections/ai-assessment-section.tsx`
- Create: `src/features/settings/components/sections/ai-assessment-section.test.tsx`
- Modify: `src/features/settings/hooks/use-settings-draft.ts`
- Modify: `src/features/settings/hooks/use-settings-draft.test.tsx`
- Modify: `src/features/settings/components/settings-screen.tsx`

- [ ] **Step 1: Extend the settings-draft reducer**

Open `src/features/settings/hooks/use-settings-draft.ts`. The file exposes a `SettingsDraftActions` interface (the public surface) and a private `SettingsDraftAction` union (the reducer actions). You'll add to both.

At the top of the file, add the import:

```ts
import type { GenAiProviderId } from '@/features/genai'
```

In the `SettingsDraftActions` interface (around line 36), add three setters alphabetically (between `setAutoDetectSolved` and `setNumberInput`):

```ts
  setAiEnabled: (value: boolean) => void
  setAiModel: (value: string) => void
  setAiProvider: (value: GenAiProviderId) => void
```

In the private `SettingsDraftAction` union (around line 77), add three new action variants alphabetically (between `'set-auto-detect-solved'` and `'set-require-solve-time'`):

```ts
  | { type: 'set-ai-enabled'; value: boolean }
  | { type: 'set-ai-model'; value: string }
  | { type: 'set-ai-provider'; value: GenAiProviderId }
```

In the reducer's switch statement (search for `case 'set-auto-detect-solved':`), add three new cases following the existing per-field-update pattern:

```ts
    case 'set-ai-enabled':
      if (!state.draft) return state
      return {
        ...state,
        draft: {
          ...state.draft,
          aiAssessment: { ...state.draft.aiAssessment, enabled: action.value },
        },
      }
    case 'set-ai-model':
      if (!state.draft) return state
      return {
        ...state,
        draft: {
          ...state.draft,
          aiAssessment: { ...state.draft.aiAssessment, model: action.value },
        },
      }
    case 'set-ai-provider':
      if (!state.draft) return state
      return {
        ...state,
        draft: {
          ...state.draft,
          aiAssessment: { ...state.draft.aiAssessment, provider: action.value },
        },
      }
```

In the `actions` object the hook returns (search for `setAutoDetectSolved: (value)`), wire the three new callbacks. Add them alphabetically:

```ts
      setAiEnabled: (value) => dispatch({ type: 'set-ai-enabled', value }),
      setAiModel: (value) => dispatch({ type: 'set-ai-model', value }),
      setAiProvider: (value) => dispatch({ type: 'set-ai-provider', value }),
```

- [ ] **Step 2: Add reducer tests**

Open `src/features/settings/hooks/use-settings-draft.test.tsx`. Append these tests inside the existing top-level `describe('useSettingsDraft', …)` block (match the file's existing render/wrapper pattern — the new tests should use the same `renderHook` helper and any wrapper the existing tests use):

```ts
it('sets aiAssessment.enabled via actions.setAiEnabled', async () => {
  const { result } = renderSettingsDraftHook()
  await waitFor(() => expect(result.current.draft).not.toBeNull())
  act(() => result.current.actions.setAiEnabled(true))
  expect(result.current.draft?.aiAssessment.enabled).toBe(true)
})

it('sets aiAssessment.provider via actions.setAiProvider', async () => {
  const { result } = renderSettingsDraftHook()
  await waitFor(() => expect(result.current.draft).not.toBeNull())
  act(() => result.current.actions.setAiProvider('anthropic'))
  expect(result.current.draft?.aiAssessment.provider).toBe('anthropic')
})

it('sets aiAssessment.model via actions.setAiModel', async () => {
  const { result } = renderSettingsDraftHook()
  await waitFor(() => expect(result.current.draft).not.toBeNull())
  act(() => result.current.actions.setAiModel('gpt-test'))
  expect(result.current.draft?.aiAssessment.model).toBe('gpt-test')
})

it('switching provider does not auto-disable enabled', async () => {
  const { result } = renderSettingsDraftHook({
    aiAssessment: { enabled: true, provider: 'openai', model: 'gpt-x' },
  })
  await waitFor(() => expect(result.current.draft).not.toBeNull())
  act(() => result.current.actions.setAiProvider('gemini'))
  expect(result.current.draft?.aiAssessment.enabled).toBe(true)
  expect(result.current.draft?.aiAssessment.provider).toBe('gemini')
})
```

The helper `renderSettingsDraftHook(overrides?)` should already exist in the test file (look for how the existing tests set up the hook with a settings fixture). If it doesn't exist under that exact name, match the existing convention — these tests are illustrative of the SHAPE; adapt to the file's actual helpers.

- [ ] **Step 3: Run the reducer tests and verify failures, then pass**

Run: `npx vitest run src/features/settings/hooks/use-settings-draft.test.tsx`
Expected before reducer changes: FAIL (`setAiEnabled is not a function`).
After the changes from Step 1: PASS.

- [ ] **Step 4: Write the section component test**

The section follows the codebase's existing convention: it takes `actions: Pick<SettingsDraftActions, ...>` plus `draft: UserSettings` (see `advanced-review-section.tsx` for the template). The component primitives are `SwitchControl`, `SegmentedControl`, `SettingsRow`, `SettingsSection`, plus `Button` and `Badge` from `@/components/ui/*`.

Create `src/features/settings/components/sections/ai-assessment-section.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

vi.mock('@/extension/messaging', () => ({
  sendMessage: vi.fn(),
}))

import { sendMessage } from '@/extension/messaging'

import { defaultUserSettings, type UserSettings } from '@/features/settings/domain'

import { AiAssessmentSection } from './ai-assessment-section'

let queryClient: QueryClient
function Wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

function renderSection(draftOverrides: Partial<UserSettings['aiAssessment']> = {}) {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const draft: UserSettings = {
    ...defaultUserSettings,
    aiAssessment: { ...defaultUserSettings.aiAssessment, ...draftOverrides },
  }
  const actions = {
    setAiEnabled: vi.fn(),
    setAiModel: vi.fn(),
    setAiProvider: vi.fn(),
  }
  return {
    actions,
    ...render(<AiAssessmentSection actions={actions} draft={draft} />, {
      wrapper: Wrapper,
    }),
  }
}

beforeEach(() => {
  vi.mocked(sendMessage).mockReset()
  vi.mocked(sendMessage).mockResolvedValue({
    openai: false,
    anthropic: false,
    gemini: false,
  } as never)
})

afterEach(() => {
  queryClient.clear()
})

describe('AiAssessmentSection', () => {
  it('renders a segmented control with all three providers', async () => {
    renderSection()
    await waitFor(() => expect(sendMessage).toHaveBeenCalled())
    expect(screen.getByRole('radio', { name: /openai/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /anthropic/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /gemini/i })).toBeInTheDocument()
  })

  it('disables the enabled switch when the active provider has no key', async () => {
    renderSection({ provider: 'openai', model: 'gpt-test', enabled: false })
    await waitFor(() => expect(sendMessage).toHaveBeenCalled())
    const toggle = screen.getByRole('switch', { name: /enabled/i })
    expect(toggle).toHaveAttribute('aria-disabled', 'true')
  })

  it('disables the enabled switch when the model is empty', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce({
      openai: true,
      anthropic: false,
      gemini: false,
    } as never)
    renderSection({ provider: 'openai', model: '', enabled: false })
    await waitFor(() => expect(sendMessage).toHaveBeenCalled())
    expect(
      screen.getByRole('switch', { name: /enabled/i }),
    ).toHaveAttribute('aria-disabled', 'true')
  })

  it('shows a Key set badge for providers with stored secrets', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce({
      openai: false,
      anthropic: true,
      gemini: false,
    } as never)
    renderSection()
    await waitFor(() => expect(screen.queryByText(/key set/i)).toBeInTheDocument())
    expect(screen.getAllByText(/key set/i)).toHaveLength(1)
  })

  it('saves a key via the runtime and clears the input on success', async () => {
    vi.mocked(sendMessage)
      .mockResolvedValueOnce({ openai: false, anthropic: false, gemini: false } as never) // initial presence
      .mockResolvedValueOnce({ openai: true, anthropic: false, gemini: false } as never)  // after set
    renderSection({ provider: 'openai', model: 'gpt-test', enabled: false })
    await waitFor(() => expect(sendMessage).toHaveBeenCalled())

    const user = userEvent.setup()
    const keyInput = screen.getByLabelText(/openai api key/i)
    await user.type(keyInput, 'sk-test')
    await user.click(screen.getByRole('button', { name: /save key/i }))

    await waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith(
        'genai.setAiProviderSecret',
        expect.objectContaining({
          surface: 'dashboard',
          provider: 'openai',
        }),
      ),
    )
    expect(keyInput).toHaveValue('')
  })

  it('removes a key via the runtime when the remove button is clicked', async () => {
    vi.mocked(sendMessage)
      .mockResolvedValueOnce({ openai: true, anthropic: false, gemini: false } as never)
      .mockResolvedValueOnce({ openai: false, anthropic: false, gemini: false } as never)
    renderSection({ provider: 'openai', model: 'gpt-test', enabled: false })
    await waitFor(() => expect(screen.queryByText(/key set/i)).toBeInTheDocument())

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /remove key/i }))

    await waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith(
        'genai.clearAiProviderSecret',
        { surface: 'dashboard', provider: 'openai' },
      ),
    )
  })

  it('calls actions.setAiModel when the model input changes', async () => {
    const { actions } = renderSection()
    await waitFor(() => expect(sendMessage).toHaveBeenCalled())

    const user = userEvent.setup()
    const modelInput = screen.getByLabelText(/^model$/i)
    await user.type(modelInput, 'gpt-test')
    expect(actions.setAiModel).toHaveBeenCalled()
  })
})
```

- [ ] **Step 5: Run the section test and verify it fails**

Run: `npx vitest run src/features/settings/components/sections/ai-assessment-section.test.tsx`
Expected: FAIL with `Failed to resolve import "./ai-assessment-section"`.

- [ ] **Step 6: Implement the section component**

Create `src/features/settings/components/sections/ai-assessment-section.tsx`. The primitive names below are verified against `advanced-review-section.tsx` (the closest analog in the codebase) and `github-sync-connection-dialog.tsx` (which uses a native `<input type="password">` for token entry).

```tsx
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  genAiProviderIds,
  useClearAiProviderSecretMutation,
  useGenAiSecretPresenceQuery,
  useSetAiProviderSecretMutation,
  type GenAiProviderId,
} from '@/features/genai'

import type { UserSettings } from '../../domain'
import type { SettingsDraftActions } from '../../hooks/use-settings-draft'
import { SegmentedControl, SwitchControl } from '../settings-controls'
import { readSettingsRowLabelId, SettingsRow } from '../settings-row'
import { SettingsSection } from '../settings-section'

interface AiAssessmentSectionProps {
  actions: Pick<
    SettingsDraftActions,
    'setAiEnabled' | 'setAiModel' | 'setAiProvider'
  >
  draft: UserSettings
}

const providerOptions: ReadonlyArray<{ label: string; value: GenAiProviderId }> = [
  { label: 'OpenAI', value: 'openai' },
  { label: 'Anthropic', value: 'anthropic' },
  { label: 'Gemini', value: 'gemini' },
]

const providerLabels: Record<GenAiProviderId, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Gemini',
}

const providerModelPlaceholders: Record<GenAiProviderId, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-haiku-4-5',
  gemini: 'gemini-2.5-flash',
}

export function AiAssessmentSection({ actions, draft }: AiAssessmentSectionProps) {
  const presenceQuery = useGenAiSecretPresenceQuery()
  const setSecret = useSetAiProviderSecretMutation()
  const clearSecret = useClearAiProviderSecretMutation()
  const [keyInput, setKeyInput] = useState('')

  const { provider, enabled, model } = draft.aiAssessment
  const presence = presenceQuery.data
  const activeProviderHasKey = presence?.[provider] ?? false
  const enableDisabled = model.trim() === '' || !activeProviderHasKey
  const enableDisabledReason = !activeProviderHasKey
    ? `Save a ${providerLabels[provider]} key first.`
    : 'Enter a model id first.'

  const handleSaveKey = async () => {
    if (keyInput === '') return
    await setSecret.mutateAsync({ provider, key: keyInput })
    setKeyInput('')
  }

  const handleClearKey = async () => {
    await clearSecret.mutateAsync({ provider })
    setKeyInput('')
  }

  return (
    <SettingsSection id="ai-assessment-settings" title="AI assessment">
      <SettingsRow
        controlClassName="w-full md:max-w-28"
        hint="When on, CogniPace asks an AI provider to refine the deterministic rating."
        id="ai-enabled-row"
        label="Enabled"
        labelFor="ai-enabled"
      >
        <SwitchControl
          ariaLabelledBy={readSettingsRowLabelId('ai-enabled-row')}
          checked={enabled}
          disabled={enableDisabled}
          disabledReason={enableDisabledReason}
          id="ai-enabled"
          onChange={actions.setAiEnabled}
        />
      </SettingsRow>

      <SettingsRow
        controlClassName="w-full md:max-w-[34rem]"
        id="ai-provider-row"
        label="Provider"
      >
        <SegmentedControl
          ariaLabelledBy={readSettingsRowLabelId('ai-provider-row')}
          label="Provider"
          name="ai-provider"
          onChange={actions.setAiProvider}
          options={providerOptions}
          value={provider}
        />
      </SettingsRow>

      {/*
        Render Key-set badges in a row directly under the provider segmented
        control so the user can see which providers have keys without
        switching segments. Each badge corresponds to one provider option.
      */}
      <SettingsRow
        controlClassName="flex flex-wrap gap-2"
        id="ai-provider-presence-row"
        label="Saved keys"
      >
        {genAiProviderIds.map((id) =>
          presence?.[id] ? (
            <Badge key={id}>{providerLabels[id]}: Key set</Badge>
          ) : null,
        )}
      </SettingsRow>

      <SettingsRow
        controlClassName="w-full md:max-w-[34rem]"
        id="ai-model-row"
        label="Model"
        labelFor="ai-model"
      >
        <input
          className="w-full rounded-[var(--cp-control-radius)] border border-border bg-background px-3 py-2 text-[length:var(--cp-copy-font-size)]"
          id="ai-model"
          maxLength={120}
          onChange={(event) => actions.setAiModel(event.currentTarget.value)}
          placeholder={providerModelPlaceholders[provider]}
          spellCheck={false}
          type="text"
          value={model}
        />
      </SettingsRow>

      <SettingsRow
        controlClassName="flex min-w-0 flex-wrap items-center gap-2"
        hint="Stored locally. Not synced. Never sent to anyone but the provider."
        id="ai-key-row"
        label={`${providerLabels[provider]} API key`}
        labelFor="ai-key"
      >
        <input
          autoComplete="off"
          className="min-w-[16rem] flex-1 rounded-[var(--cp-control-radius)] border border-border bg-background px-3 py-2 text-[length:var(--cp-copy-font-size)]"
          id="ai-key"
          onChange={(event) => setKeyInput(event.currentTarget.value)}
          placeholder={
            activeProviderHasKey
              ? '••••••••  (set; enter a new value to replace)'
              : 'Enter key'
          }
          spellCheck={false}
          type="password"
          value={keyInput}
        />
        <Button
          disabled={keyInput === '' || setSecret.isPending}
          onClick={() => {
            void handleSaveKey()
          }}
          size="sm"
        >
          Save key
        </Button>
        {activeProviderHasKey ? (
          <Button
            disabled={clearSecret.isPending}
            onClick={() => {
              void handleClearKey()
            }}
            size="sm"
            variant="outline"
          >
            Remove key
          </Button>
        ) : null}
      </SettingsRow>
    </SettingsSection>
  )
}
```

Two things to flag for the implementer:

- The native `<input>` className strings are copied directly from the existing GitHub sync dialog (`github-sync-connection-dialog.tsx:216,303`) to match the prevailing visual conventions. If the implementer prefers to wrap them in a reusable `<TextField>` later, that's a refactor for a different PR.
- The "Saved keys" badge row is a small UX improvement so the user sees all per-provider presence at a glance (the segmented control hides this when other providers aren't selected). This row only renders badges for providers with keys.

- [ ] **Step 7: Mount the section in `settings-screen.tsx`**

Open `src/features/settings/components/settings-screen.tsx`. Import the new section near the other section imports (e.g., next to `AdvancedReviewSection`):

```ts
import { AiAssessmentSection } from './sections/ai-assessment-section'
```

Locate where `AdvancedReviewSection` is rendered. Sections in this codebase receive `actions` (a `Pick<>` of `SettingsDraftActions`) plus `draft`. Add the new section after `AdvancedReviewSection`, with a Pick of the three new setters:

```tsx
<AiAssessmentSection
  actions={{
    setAiEnabled: controller.actions.setAiEnabled,
    setAiModel: controller.actions.setAiModel,
    setAiProvider: controller.actions.setAiProvider,
  }}
  draft={draft}
/>
```

The exact local name for the controller object (e.g., `controller`, `settings`) may differ — match the file's prevailing convention by inspecting how the existing `AdvancedReviewSection` receives its `actions` prop.

- [ ] **Step 8: Run the section + reducer tests**

Run: `npx vitest run src/features/settings/components/sections/ai-assessment-section.test.tsx src/features/settings/hooks/use-settings-draft.test.tsx`
Expected: PASS.

- [ ] **Step 9: Commit**

```sh
git add src/features/settings/components/sections/ai-assessment-section.tsx \
        src/features/settings/components/sections/ai-assessment-section.test.tsx \
        src/features/settings/hooks/use-settings-draft.ts \
        src/features/settings/hooks/use-settings-draft.test.tsx \
        src/features/settings/components/settings-screen.tsx
git commit -m "feat(settings): add AI assessment section to dashboard settings"
```

---

## Task 9: Whole-project validation

**Files:** none modified (unless Step 2 catches something)

- [ ] **Step 1: Run the full check**

Run: `npm run check`
Expected: PASS for all four phases (drizzle, typecheck, lint, vitest).

- [ ] **Step 2: Resolve any failures**

If any phase fails, read the output and fix the root cause. Common cases:
- Missing barrel export → add it.
- An ESLint import-order or unused-import violation → reformat.
- The architecture-boundary `apiKey` test catches a new leak (e.g., a `// apiKey: ...` comment in a UI test fixture) → rename the literal.
- The serialization snapshot test catches a leak path → trace why the key reached the payload and fix at the source.

Re-run `npm run check` until it passes. If you make fixes, commit with a focused message such as `fix(genai): align lint formatting in settings section`.

If `package-lock.json` shows as modified in `git status`, discard those auto-changes with `git checkout -- package-lock.json`.

- [ ] **Step 3: Confirm clean state**

Run: `git status`
Expected: `nothing to commit, working tree clean`.

Run: `git log --oneline -12`
Expected (most recent first):
- `feat(settings): add AI assessment section to dashboard settings`
- `feat(app-shell): expose aiAssessmentAvailable + lock down apiKey leaks`
- `feat(genai): expose React Query hooks for secret management`
- `feat(genai): expose secret-management runtime methods`
- `feat(genai): compose settings + secrets into a resolved provider config`
- `feat(genai): add background-only secrets KV store`
- `feat(genai): add per-provider secrets domain types`
- `feat(settings): add aiAssessment block to user settings`
- (optionally) a `fix:` commit from Step 2
- `docs: plan AI provider settings and secret handling implementation (#4)`
- `docs: design AI provider settings and secret handling (#4)`

Implementation complete.
