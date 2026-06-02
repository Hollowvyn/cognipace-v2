# AI Provider Settings & Secret Handling Design

## Status

Approved design from brainstorming on 2026-06-01. This is a planning artifact
for issue #4 (Add AI provider settings and secret handling). Second of four
specs in the GenAI plumbing cluster (#3, #4, #5, #6); #3 has already shipped
(`features/genai/` with `generateJson`). Current product and architecture docs
remain the source of truth until the implementation lands.

## Context

Issue #3 shipped the provider abstraction: callers pass a fully-resolved
`GenAiProviderConfig` to `generateJson`. Issue #4 supplies that config by
adding user settings (provider/model preferences) plus secret storage (the
apiKey). The overlay needs a single boolean signal "AI is available" — it
must never see the apiKey, the model, or the provider name.

CogniPace already stores user settings as a JSON-blob row in the
`settings_kv` table (`key, value, updatedAt`). `parseStoredUserSettings`
loads old rows by falling back to a partial-patch merge with defaults, so
adding a new top-level block to `userSettingsSchema` round-trips cleanly
without a DB migration or schema-version bump. Settings cross feature
boundaries via `userSettingsSchema.shape.X` reuses; app-shell payloads pick
curated subsets per surface.

The architecture-boundary test (`src/testing/architecture-boundaries.test.ts`)
enforces:
- Root feature barrels must not export from `./data` or `./server`.
- Cross-feature deep imports must match `domain`, `api/*contracts`, or
  `server/*service`.
- Shared infrastructure must not import app or feature code.

## Decisions

- The safe public AI fields (`enabled`, `provider`, `model`) live inside
  `userSettings.aiAssessment`, written via the existing settings flow.
- The apiKey lives in a **separate `settings_kv` row** keyed `'genai-secrets'`,
  storing a partial record of per-provider entries:
  `{ openai?: {apiKey, baseUrl?}, anthropic?: {...}, gemini?: {...} }`.
  Per-provider slots preserve previously-entered keys when the user
  toggles between providers.
- Secrets are read and written only through `src/features/genai/server/`
  code. No app-shell payload, content-script state, or React prop ever
  carries the apiKey.
- A new background-only helper `loadActiveProviderConfig(db)` composes
  the safe settings with the active provider's secret to return a full
  `GenAiProviderConfig | null`. Returns `null` when settings disable AI,
  the model is empty, or the active provider's secret is missing.
- App-shell overlay payload gains one new field: `aiAssessmentAvailable:
  boolean`. App-shell popup/dashboard payloads gain `settings.aiAssessment`
  (the safe block) so the dashboard settings UI can read it.
- Three new runtime methods (`genai.getAiProviderSecretPresence`,
  `setAiProviderSecret`, `clearAiProviderSecret`) accept only `surface:
  'popup' | 'dashboard'`. None of them returns key material — all three
  resolve to `AiProviderSecretPresence` (a `Record<GenAiProviderId,
  boolean>`).
- Two layers of leak defense: a new architecture-boundary test asserts no
  source file outside `features/genai/` references the literal `apiKey`;
  serialization-snapshot tests assert no app-shell payload's JSON form
  contains `apiKey` or the literal key string.
- A minimal "AI assessment" section ships in the dashboard settings UI.
  The apiKey input is local component state — it never flows through the
  settings draft reducer or any persistent state container.

## Goals

- Make AI assessment configurable without exposing the API key beyond the
  background service worker.
- Preserve backward compatibility: old rows missing `aiAssessment` load to
  documented defaults via the existing `parseStoredUserSettings` flow. No
  DB migration. No `schemaVersion` bump.
- Give the runtime endpoint (#6) one stable function call to retrieve a
  resolved provider config or learn it's unavailable.
- Give the overlay one stable boolean signal in the app-shell payload to
  decide whether to render the AI affordance.

## Non-Goals

- No prompt construction or AI request orchestration. That's #5 / #6.
- No "secret manager" UI beyond a single password input + Save/Remove.
  Key rotation, multi-account, or organization-scoped keys are out of
  scope.
- No `chrome.storage.local` integration. Secrets live in SQLite via the
  same KV table as settings.
- No backup/sync exclusion logic for the secrets row in this issue. The
  current backup feature already does not export `settings_kv` row by row
  (it serializes the parsed `userSettings` shape); the secrets row is
  invisible to that pipeline by construction. If a future backup feature
  begins serializing raw `settings_kv`, that PR must explicitly exclude
  the `'genai-secrets'` key.
- No telemetry, usage tracking, or per-provider quota awareness.
- No key validation against the live provider API.

## File Layout

**Create:**
- `src/features/genai/domain/genai-secrets-types.ts`
- `src/features/genai/domain/genai-secrets-types.test.ts`
- `src/features/genai/server/genai-secrets-store.ts`
- `src/features/genai/server/genai-secrets-store.test.ts`
- `src/features/genai/server/genai-settings-service.ts`
- `src/features/genai/server/genai-settings-service.test.ts`
- `src/features/genai/api/genai-settings-contracts.ts`
- `src/features/genai/api/genai-settings-api.ts` (runtime client helpers)
- `src/features/genai/api/genai-settings-hooks.ts` (TanStack Query hooks)
- `src/features/genai/api/genai-settings-hooks.test.tsx`
- `src/features/settings/components/sections/ai-assessment-section.tsx`
- `src/features/settings/components/sections/ai-assessment-section.test.tsx`
- `src/features/app-shell/server/app-shell-service.ai-assessment.test.ts`
  (or a new section in the existing service test file)

**Modify:**
- `src/features/settings/domain/settings.ts` — add `aiAssessmentSettingsSchema`;
  thread through `userSettingsSchema`, `userSettingsPatchSchema`,
  `defaultUserSettings`, `mergeUserSettings`, `createUserSettingsPatch`.
- `src/features/settings/domain/settings.test.ts` — old-row, default, merge,
  diff tests for the new block.
- `src/features/settings/hooks/use-settings-draft.ts` — add `'set-ai-enabled'`,
  `'set-ai-provider'`, `'set-ai-model'` reducer actions.
- `src/features/settings/components/settings-screen.tsx` — mount
  `<AiAssessmentSection />`.
- `src/features/settings/index.ts` and `src/features/genai/index.ts` — barrel
  re-exports for new domain types only.
- `src/features/genai/domain/index.ts` — re-export new types.
- `src/features/genai/api/index.ts` (create if absent) — re-export request
  schemas + runtime client helpers + hooks.
- `src/features/genai/index.ts` — re-export the three TanStack Query hooks
  so the settings UI imports them via `@/features/genai` (per the
  cross-feature root-barrel pattern).
- `src/features/app-shell/api/app-shell-contracts.ts` — add
  `aiAssessment` to `appShellSettingsSummarySchema`; add
  `aiAssessmentAvailable: z.boolean()` to `overlayAppShellDataSchema`.
- `src/features/app-shell/server/app-shell-service.ts` — compute
  `aiAssessmentAvailable` via `isAiAssessmentAvailable(db)`.
- `src/extension/background/register-handlers.ts` — register three new
  runtime handlers.
- `src/extension/messaging.ts` — register the new method names.
- `src/testing/architecture-boundaries.test.ts` — new test enforcing
  `apiKey` literal stays inside `features/genai/`.

**Do not modify:**
- `src/platform/db/schema/settings-kv.ts` — same table, new key only.
- The backup feature in this PR — see Non-Goals.

## Settings Schema

`src/features/settings/domain/settings.ts`:

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

Added to `userSettingsSchema`:

```ts
aiAssessment: aiAssessmentSettingsSchema.default({
  enabled: false,
  provider: 'openai',
  model: '',
}),
```

`userSettingsPatchSchema` gains an optional `aiAssessment` partial:

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

`defaultUserSettings.aiAssessment = { enabled: false, provider: 'openai', model: '' }`.

`mergeUserSettings` / `createUserSettingsPatch` get one more block following
the existing per-field-diff pattern (see the existing `assessment` and
`reminders` blocks for the template).

**`schemaVersion` stays at `1`.** `parseStoredUserSettings` already handles
old rows missing `aiAssessment` via its full-parse → patch-merge fallback;
the per-field defaults make the merge succeed without a version bump.

## Secrets Types

`src/features/genai/domain/genai-secrets-types.ts`:

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

`AiProviderSecret` (with `apiKey` field) is exported from `domain/` but
never re-exported through the root `src/features/genai/index.ts`. The
root barrel exposes only `AiProviderSecretPresence` and helpers — never
types that contain the `apiKey` field. This protects against accidental
deep-import shortcuts.

## Secrets Store

`src/features/genai/server/genai-secrets-store.ts`:

Background-only. Reads and writes the `'genai-secrets'` row in
`settings_kv` via Drizzle. Defensive parsing: corrupted JSON or
schema-mismatched rows fall back to `emptyAiProviderSecrets` instead of
throwing.

Exports:

```ts
export class GenAiSecretsStore {
  constructor(db: Db)
  read(): Promise<AiProviderSecrets>
  setProvider(
    provider: GenAiProviderId,
    secret: AiProviderSecret,
    now?: Date,
  ): Promise<AiProviderSecrets>
  clearProvider(
    provider: GenAiProviderId,
    now?: Date,
  ): Promise<AiProviderSecrets>
  clearAll(now?: Date): Promise<AiProviderSecrets>
}

export function createGenAiSecretsStore(db: Db): GenAiSecretsStore
```

All writes happen inside a single Drizzle transaction with
`onConflictDoUpdate` against the `settings_kv` primary key, mirroring
the existing `SettingsRepository.updateSettings` pattern.

## Settings Service

`src/features/genai/server/genai-settings-service.ts`:

```ts
export async function getAiProviderSecretPresence(
  db: Db,
): Promise<AiProviderSecretPresence>

export async function setAiProviderSecret(
  db: Db,
  provider: GenAiProviderId,
  secret: AiProviderSecret,
): Promise<AiProviderSecretPresence>

export async function clearAiProviderSecret(
  db: Db,
  provider: GenAiProviderId,
): Promise<AiProviderSecretPresence>

/**
 * Background-only. Returns the resolved provider config when AI is enabled,
 * a model is set, and the active provider's secret is present. Returns null
 * otherwise so the runtime endpoint (#6) can map to 'not-configured'.
 */
export async function loadActiveProviderConfig(
  db: Db,
): Promise<GenAiProviderConfig | null>

/** Cheap version that doesn't return key material; used by app-shell. */
export async function isAiAssessmentAvailable(db: Db): Promise<boolean>
```

`loadActiveProviderConfig` composition rules:

1. `userSettings.aiAssessment.enabled === false` → `null`.
2. `userSettings.aiAssessment.model.trim() === ''` → `null`.
3. No secret for `userSettings.aiAssessment.provider` → `null`.
4. Otherwise returns `{ provider, model, apiKey, baseUrl? }` where
   `baseUrl` is included only when the stored secret has a defined
   `baseUrl` field.

The composition is centralized here. The runtime endpoint (#6) and
app-shell (this issue, via `isAiAssessmentAvailable`) call this single
function — there is no duplicated availability logic.

## Runtime Methods

Three new background-handled runtime methods. None returns key material.

| Method | Args | Returns | Surface allowlist |
|---|---|---|---|
| `genai.getAiProviderSecretPresence` | `{ surface }` | `AiProviderSecretPresence` | `popup`, `dashboard` |
| `genai.setAiProviderSecret` | `{ surface, provider, secret: { apiKey, baseUrl? } }` | `AiProviderSecretPresence` | `popup`, `dashboard` |
| `genai.clearAiProviderSecret` | `{ surface, provider }` | `AiProviderSecretPresence` | `popup`, `dashboard` |

Request validation lives in `src/features/genai/api/genai-settings-contracts.ts`:

```ts
const aiProviderSecretBodySchema = z
  .object({ apiKey: z.string().min(1), baseUrl: z.string().url().optional() })
  .strict()

export const setAiProviderSecretRequestSchema = z
  .object({
    surface: z.enum(['popup', 'dashboard']),
    provider: z.enum(genAiProviderIds),
    secret: aiProviderSecretBodySchema,
  })
  .strict()

export const clearAiProviderSecretRequestSchema = z
  .object({
    surface: z.enum(['popup', 'dashboard']),
    provider: z.enum(genAiProviderIds),
  })
  .strict()

export const getAiProviderSecretPresenceRequestSchema = z
  .object({ surface: z.enum(['popup', 'dashboard']) })
  .strict()
```

The surface enum explicitly omits `'content-script'`. Overlay code that
attempted to call any of these methods would fail schema validation
inside the background handler with a clear error, before reaching the
store.

Runtime client helpers in `src/features/genai/api/genai-settings-api.ts`:

```ts
export async function getAiProviderSecretPresenceViaRuntime(
  request: GetAiProviderSecretPresenceRequest,
): Promise<AiProviderSecretPresence>

export async function setAiProviderSecretViaRuntime(
  request: SetAiProviderSecretRequest,
): Promise<AiProviderSecretPresence>

export async function clearAiProviderSecretViaRuntime(
  request: ClearAiProviderSecretRequest,
): Promise<AiProviderSecretPresence>
```

These follow the existing `*ViaRuntime` pattern in `features/practice/api/`
and elsewhere — thin wrappers that call into `@/extension/messaging`.

## App-Shell Exposure

`src/features/app-shell/api/app-shell-contracts.ts`:

```ts
const appShellAiAssessmentSettingsSchema = userSettingsSchema.shape.aiAssessment

const appShellSettingsSummarySchema = z.object({
  appearance: userSettingsSchema.shape.appearance,
  practice: userSettingsSchema.shape.practice,
  review: userSettingsSchema.shape.review,
  assessment: appShellAssessmentSettingsSchema,
  aiAssessment: appShellAiAssessmentSettingsSchema,
})

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

`src/features/app-shell/server/app-shell-service.ts`:

- `getOverlayAppShellData` calls `isAiAssessmentAvailable(db)` from
  `@/features/genai/server/genai-settings-service` and sets
  `overlay.aiAssessmentAvailable` on the response.
- `getPopupAppShellData` / `getDashboardAppShellData` need no extra
  wiring; they reuse `userSettingsSchema.shape.aiAssessment` through the
  shared `settings` summary, which already flows from `getSettings(db)`.

The cross-feature import path `@/features/genai/server/genai-settings-service`
matches the architecture-boundary test's `server/*service` allowlist.

## Leak Defense

Two independent layers.

**Source-level guard** — new `it` block in
`src/testing/architecture-boundaries.test.ts`:

```ts
it('keeps the apiKey literal out of every feature except genai', () => {
  const apiKeyPattern = /\bapiKey\b/
  const genaiPath = `${join(srcRoot, 'features/genai')}/`
  const offenders = sourceFiles([
    'app',
    'components',
    'entrypoints',
    'features',  // scan ALL features...
    'hooks',
    'lib',
    'platform',
    'utils',
  ])
    .filter((file) => !file.startsWith(genaiPath))  // ...except genai
    .filter((file) => apiKeyPattern.test(readFileSync(file, 'utf8')))

  expect(offenders.map(toRepoPath)).toEqual([])
})
```

Scanning all features (rather than a hand-maintained per-feature
allowlist) catches future leaks automatically — e.g., when #5 adds
`features/leetcode-review-assistant`, the test enforces no `apiKey`
literal there without anyone updating the test.

`sourceFiles` already excludes `.test.ts(x)` files, so the AI settings
UI tests (which legitimately use `'sk-test'` as a fixture inside
`secret: { apiKey: ... }` arguments) do not trip the regex.

**Runtime-level guard** — serialization snapshot tests in
`src/features/app-shell/server/app-shell-service.test.ts` (or a new
`.ai-assessment.test.ts` sibling if the file is large):

```ts
it('overlay payload reports aiAssessmentAvailable=false when settings disabled', async () => { ... })
it('overlay payload reports aiAssessmentAvailable=false when enabled but key missing', async () => { ... })
it('overlay payload reports aiAssessmentAvailable=true when fully configured', async () => { ... })
it('overlay payload never contains apiKey or the literal key string', async () => {
  await setupConfiguredAiProvider(db, { provider: 'openai', model: 'gpt-test', apiKey: 'sk-must-not-leak' })
  const payload = await getOverlayAppShellData(db, request, now)
  const serialized = JSON.stringify(payload)
  expect(serialized).not.toContain('apiKey')
  expect(serialized).not.toContain('sk-must-not-leak')
})
it('popup payload exposes safe aiAssessment fields but no apiKey', async () => { ... })
it('dashboard payload exposes safe aiAssessment fields but no apiKey', async () => { ... })
```

Both layers are needed. The source test catches direct field accesses
(`secret.apiKey`); the snapshot test catches indirect leaks (object
spread, accidental serialization of an intermediate value).

## Settings UI

A new section in the dashboard settings screen following the existing
`SettingsSection` / `SettingsRow` pattern used by
`advanced-review-section.tsx`. The component lives at
`src/features/settings/components/sections/ai-assessment-section.tsx`.

UX shape:

- **Enabled toggle** — bound to `draft.aiAssessment.enabled`. Disabled
  (with explanatory `disabledReason` tooltip) when the active provider
  has no key or when model is empty. Mirrors the existing
  `strictTiming`/`requireSolveTime` dependency pattern.
- **Provider radio group** — three options: OpenAI, Anthropic, Gemini.
  Each row shows a "Key set" badge when `presence[id] === true`.
- **Model text input** — bound to `draft.aiAssessment.model`. Free-form
  string, `maxLength={120}`. Placeholder hints at sensible defaults
  per provider but does not enforce a list.
- **API key input** — local component state (`useState<string>('')`),
  NOT part of `draft`. `type="password"`, `autoComplete="off"`,
  placeholder reflects current presence. Save button disabled until
  the input is non-empty. Remove button shown only when a key is
  already set for the active provider.

The key input never flows through the settings reducer. It is saved via
a separate mutation (`useSetAiProviderSecretMutation`) and cleared
locally on success. The settings save button (which commits the rest of
the draft) handles only the safe `aiAssessment.{enabled, provider,
model}` block; the key write is independent.

The component invokes the mutation with `{ provider, key: keyInput }`
— the field name `key` is intentional. The literal token `apiKey` does
NOT appear anywhere in `src/features/settings/`; it lives only in the
genai hook's body (`{ apiKey: key, ... }`), which is allowed by the
architecture-boundary test because that file is inside `features/genai`.

API hooks live inside the **genai** feature, not settings, so the
`apiKey` literal never appears outside genai. The settings UI imports
them via the genai root barrel:

```ts
// src/features/genai/api/genai-settings-hooks.ts
export function useGenAiSecretPresenceQuery(): UseQueryResult<AiProviderSecretPresence>

export function useSetAiProviderSecretMutation(): UseMutationResult<
  AiProviderSecretPresence,
  Error,
  { provider: GenAiProviderId; key: string; baseUrl?: string }
>

export function useClearAiProviderSecretMutation(): UseMutationResult<
  AiProviderSecretPresence,
  Error,
  { provider: GenAiProviderId }
>
```

The set-mutation accepts `key: string` (not `secret: AiProviderSecret`).
The hook's body — which lives in `features/genai/` where the `apiKey`
literal is allowed — translates `key` → `{ apiKey: key }` inside the
mutation function before calling `setAiProviderSecretViaRuntime`. The
UI component never types `apiKey` anywhere.

Each mutation's `onSuccess` updates the TanStack Query cache for
`['genai', 'secret-presence']` to keep the UI consistent without a
re-fetch.

Re-exported from `src/features/genai/index.ts` so the settings UI can
import:

```ts
import {
  useGenAiSecretPresenceQuery,
  useSetAiProviderSecretMutation,
  useClearAiProviderSecretMutation,
} from '@/features/genai'
```

This is a barrel import (not a deep import), so the
architecture-boundary test's `feature_deep_import_pattern` does not
flag it.

Reducer additions in `use-settings-draft.ts`:

```ts
| { type: 'set-ai-enabled'; value: boolean }
| { type: 'set-ai-provider'; value: GenAiProviderId }
| { type: 'set-ai-model'; value: string }
```

Each handler shapes the next draft's `aiAssessment` block. Following the
existing pattern (e.g., `'set-strict-timing'`), if changing the provider
results in `enabled: true` but no key for the new provider, **do not
auto-clear `enabled`**. The toggle's disabled state handles the
inconsistency visually; the next save will reject the patch only if the
underlying schema fails to validate, which it won't (`enabled: true`
without a key is a parseable state).

## Test Plan

Vitest, colocated next to source.

### `settings.test.ts` additions

- Old row without `aiAssessment` parses to defaults `{enabled:false,
  provider:'openai', model:''}`.
- Partial patch `{ aiAssessment: { enabled: true } }` merges cleanly,
  preserving `provider`/`model`.
- `createUserSettingsPatch` returns a diff containing the changed
  field(s) only.
- `mergeUserSettings` round-trips a full update through the schema.

### `genai-secrets-types.test.ts`

- Surface-stability: `aiProviderSecretsSchema` accepts known providers,
  rejects unknown keys (`.strict()`).

### `genai-secrets-store.test.ts`

- Empty store returns `emptyAiProviderSecrets`.
- `setProvider('openai', secret)` then `read` returns the stored secret.
- Setting two providers preserves both.
- `clearProvider` removes only the named provider.
- `clearAll` empties the row.
- Corrupted JSON in the row → empty.
- Schema-mismatched row (e.g., `{ openai: 'not-an-object' }`) → empty.

### `genai-settings-service.test.ts`

- `getAiProviderSecretPresence` returns `{openai:false, anthropic:false,
  gemini:false}` empty.
- After `setAiProviderSecret('anthropic', ...)`, presence shows
  `anthropic:true`.
- `loadActiveProviderConfig` returns `null` when `enabled:false`.
- Returns `null` when `enabled:true` but `model === ''`.
- Returns `null` when `enabled:true`, `model` set, but no secret for
  active provider.
- Returns `{provider, model, apiKey}` when all three conditions met.
- Returns `{provider, model, apiKey, baseUrl}` when secret has
  `baseUrl`.
- `isAiAssessmentAvailable` mirrors the above truthiness for true/false.

### `app-shell-service` (new ai-assessment tests)

- Overlay payload: `aiAssessmentAvailable: false` when disabled.
- Overlay payload: `aiAssessmentAvailable: false` when enabled but key
  missing.
- Overlay payload: `aiAssessmentAvailable: true` when fully configured.
- Overlay payload: serialized JSON does not contain `'apiKey'` or the
  literal key string.
- Popup/Dashboard payload: `settings.aiAssessment = {enabled, provider,
  model}` but no `apiKey` in serialized JSON.

### `architecture-boundaries.test.ts` additions

- New `it` block: source files outside `features/genai/` and outside
  test files contain no `apiKey` literal.

### `ai-assessment-section.test.tsx`

- Renders all three provider radios; badges reflect presence.
- Toggle disabled when no key for active provider; enabled when model
  set and key present.
- Toggle's `disabledReason` tooltip renders the expected text.
- Switching provider preserves keys (presence badges for prior provider
  remain).
- Save key calls `setAiProviderSecretViaRuntime` with the expected
  payload; clears local input on success.
- Clear key calls `clearAiProviderSecretViaRuntime`; presence badge
  disappears.
- Test fixtures use `'sk-test'` (not a real-looking key).

### `use-settings-draft.test.tsx` additions

- `'set-ai-enabled'`/`'set-ai-provider'`/`'set-ai-model'` actions
  mutate `draft.aiAssessment` correctly.
- Changing provider does NOT auto-disable `enabled` (the toggle's
  disabled state handles the visual).
- Dirty-state computation across saved↔draft for `aiAssessment` works.

### Manual smoke (covered in #6 / #7 once runtime endpoint lands)

- Toggle AI in dashboard settings → load LeetCode → overlay's
  `aiAssessmentAvailable` reflects state.
- Clear key → overlay's `aiAssessmentAvailable` flips to false on next
  app-shell refresh.

## Acceptance Criteria Mapping

- "User settings parse old rows without AI fields." → Settings Schema
  (defaults + Zod merge) + `settings.test.ts` old-row test.
- "AI defaults to disabled unless provider and key are configured." →
  Settings Schema (`enabled: false`) + `loadActiveProviderConfig`'s
  three-step null gate.
- "Overlay app-shell payload exposes only safe availability flags." →
  App-Shell Exposure (`aiAssessmentAvailable: z.boolean()`) + serialization
  snapshot tests.
- "Runtime method fails with `not-configured` when no valid provider
  config exists." → `loadActiveProviderConfig` returns `null` for the
  three failure modes. #6 maps `null` → `'not-configured'`.
- "Tests prove API keys never appear in app-shell payloads." →
  serialization snapshot tests + source-level architecture-boundary
  test.

## Dependencies

Depends on: #3 (provides `GenAiProviderId`, `GenAiProviderConfig`, the
provider-id const array). Already merged.

Unblocks: #6 (runtime endpoint calls `loadActiveProviderConfig`), #7
(overlay reads `aiAssessmentAvailable`).
