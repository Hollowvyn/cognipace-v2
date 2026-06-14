# GenAI BYOK SDK Rebuild — Design

**Date:** 2026-06-14  
**Status:** Written for user review  
**Scope:** GenAI provider setup, Assessment settings cleanup, provider runtime,
and development smoke testing

## Context

The current GenAI setup puts provider, model, enablement, key presence, and key
editing inside Settings > AI assessment. That has made the feature brittle:

- Assessment enablement is coupled to provider/model validation.
- Provider keys are saved through a separate trusted-secret path, while
  provider/model live in the Settings draft form.
- The hidden dashboard smoke route has to reconstruct configuration from split
  state and can report stale or misleading status.
- The UI looks like a low-level settings form instead of the connection workflow
  already proven by GitHub Sync.

This design supersedes the provider-setup and hand-rolled network-adapter parts
of the 2026-06-01 GenAI provider specs. The assessment recommendation contract
and background-only secret boundary remain valid, but provider setup moves out
of Assessment settings and the provider call implementation moves behind Vercel
AI SDK Core.

## Goals

- Make GenAI a reusable local platform feature, starting with Assessment but not
  tied to Assessment.
- Move BYOK provider setup into Data Management beside GitHub Sync.
- Rename the visible `AI assessment` settings section to `Assessment`.
- Keep the Assessment toggle independent: it can be saved on or off without
  clearing provider/model state.
- Default provider setup to Gemini, with `gemini-2.5-flash` as the initial
  default model because Google's current Gemini API docs list it as a stable,
  structured-output capable model with free-tier pricing.
- Use Vercel AI SDK Core as the provider abstraction inside trusted background
  code.
- Preserve local-first and secret-redaction guarantees: raw provider keys never
  enter backups, sync payloads, logs, TanStack Query cache payloads, or normal UI
  state.
- Improve dev smoke so configuration, verification, request shape, and live
  provider behavior can be tested without exposing secrets.

## Non-Goals

- No hosted CogniPace backend.
- No Vercel AI Gateway as the default path.
- No account, team, billing, or SaaS setup.
- No new Chrome host permissions in the first implementation phase.
- No local or OpenAI-compatible provider support in phase 1 unless the required
  host permissions are explicitly approved.
- No chat UI, streaming UI, or AI SDK React hooks for this setup flow.

## Recommended Approach

Build a small GenAI connection system that mirrors GitHub Sync's separation of
connection metadata from trusted secrets:

- `features/genai` owns provider connection metadata, status contracts,
  verification, and provider runtime calls.
- `platform/secrets` continues to own raw provider key storage in
  `chrome.storage.local`.
- Assessment settings only own whether AI assistance is used during assessment.
- The trusted background runtime composes Assessment enablement plus the selected
  verified provider plus the saved secret into the active provider config.

Vercel AI SDK Core is used as a library dependency, not as a product boundary.
CogniPace still exposes its own narrow GenAI service API, so overlay,
Assessment, dev-smoke, and future recommendations or analytics features do not
depend on provider-specific SDK types.

## Product UX

### Data Management AI Provider Card

Add an `AI Provider` panel in Settings > Data Management, next to the GitHub
Sync panel and before lower-frequency backup/reset sections.

The card shows:

- selected provider badge, defaulting to Gemini
- connection status badge: `Not configured`, `Needs verification`, `Ready`, or
  `Error`
- selected model when present
- last verification time when present
- warning copy when no verified provider is available
- `Manage provider` action
- `Test selected` action when a provider is configured

The card should not expose raw key values. It should summarize provider setup
like GitHub Sync summarizes token/Gist state.

### Manage AI Provider Dialog

The dialog is the only place where provider connection setup happens.

It contains:

- provider selector ordered `Gemini`, `OpenAI`, `Anthropic`
- model input or curated model selector
- masked API key field
- `Test key` for unsaved draft keys
- `Save provider`
- `Verify selected`
- `Replace key`
- `Remove key`
- inline status for auth, rate-limit, network, timeout, invalid model, and
  invalid-output failures

Saving a model does not toggle Assessment. Saving a key does not toggle
Assessment. Removing a key marks that provider unavailable and clears any
verified status for that provider.

### Assessment Settings

Rename the visible section from `AI assessment` to `Assessment`.

The section keeps normal assessment settings and adds one AI-assistance toggle:

- `Use AI recommendations`

The toggle is always saveable. It is not disabled because provider setup is
missing. When enabled without a selected verified provider, the section shows an
amber warning status and a `Manage AI Provider` action. The warning is status,
not validation: it does not mutate the setting and does not block saving.

Provider, model, saved keys, and key editing are removed from this settings
section.

## Data Model And Storage

### Trusted Secrets

Provider API keys remain in `platform/secrets`:

- `genai:google` for Gemini
- `genai:openai` for OpenAI
- `genai:anthropic` for Anthropic

Secret reads remain background-only. UI runtime responses may return only
presence, provider id, and safe status metadata.

### GenAI Connection Metadata

Add a GenAI-owned metadata store under `src/features/genai/data`, backed by
`chrome.storage.local` and validated with Zod, following the pattern used by
GitHub Sync metadata. This avoids treating BYOK provider setup as user settings,
keeps provider verification local to this browser, and avoids a migration-driven
local data reset for the first rebuild phase.

Initial shape:

```ts
type GenAiConnectionMetadata = {
  schemaVersion: 1
  selectedProvider: 'gemini' | 'openai' | 'anthropic'
  providers: {
    gemini: GenAiProviderConnection
    openai: GenAiProviderConnection
    anthropic: GenAiProviderConnection
  }
  updatedAt: string
}

type GenAiProviderConnection = {
  model: string
  verification: {
    state: 'unverified' | 'valid' | 'invalid'
    verifiedAt: string | null
    checkedModel: string | null
    errorCode:
      | 'auth'
      | 'rate-limit'
      | 'network'
      | 'timeout'
      | 'invalid-model'
      | 'invalid-output'
      | 'unknown'
      | null
    message: string | null
  }
}
```

Defaults:

- selected provider: `gemini`
- Gemini model: `gemini-2.5-flash`
- OpenAI model: `gpt-4o-mini`
- Anthropic model: `claude-haiku-4-5`
- all verification states: `unverified`

Changing a provider's model sets that provider back to `unverified`. Saving or
removing a provider secret also sets that provider back to `unverified`.

### Assessment Settings Migration

Keep the existing persisted `aiAssessment.enabled` field for the first phase to
avoid broad settings migration churn. Stop using `aiAssessment.provider` and
`aiAssessment.model` in UI and active-provider resolution.

In a later cleanup phase, rename the persisted field to something like
`assessment.aiRecommendationsEnabled` and remove the unused provider/model
settings after backup/sync compatibility is reviewed.

## Runtime Contracts

Add or replace GenAI runtime methods behind dashboard-authorized calls:

- `genai.getProviderStatus`
- `genai.saveProviderModel`
- `genai.saveProviderSecret`
- `genai.testProviderDraft`
- `genai.verifyProvider`
- `genai.selectProvider`
- `genai.clearProviderSecret`

`genai.getProviderStatus` returns a redacted status view:

```ts
type GenAiProviderStatus = {
  selectedProvider: GenAiProviderId
  selectedReady: boolean
  providers: Array<{
    provider: GenAiProviderId
    label: string
    model: string
    secretConfigured: boolean
    verificationState: 'unverified' | 'valid' | 'invalid'
    verifiedAt: string | null
    lastErrorCode: string | null
    lastErrorMessage: string | null
  }>
}
```

All request and response payloads crossing `src/extension/messaging.ts` use Zod
schemas. `genai.testProviderDraft` accepts an unsaved key and model for a
non-persisting validation call. `genai.saveProviderSecret` accepts a key and
stores it. Raw key strings are accepted only by those two requests and are never
returned.

Runtime writes broadcast a `genai` invalidation tag. Assessment setting writes
continue to broadcast `settings`; UI routes that combine both status families
read both queries.

## Active Provider Resolution

Replace the current active-config logic with:

1. Load settings.
2. If `aiAssessment.enabled` is false, return `null`.
3. Load GenAI connection metadata.
4. Read the selected provider.
5. Require a non-empty selected provider model.
6. Require selected provider verification state `valid` for the same model.
7. Load the selected provider secret from trusted storage.
8. Return `{ provider, model, apiKey }`.

This makes provider setup reusable and keeps Assessment's toggle independent of
provider/model persistence.

## Vercel AI SDK Runtime

Install and use AI SDK Core provider packages in trusted background GenAI code:

- `ai`
- `@ai-sdk/google`
- `@ai-sdk/openai`
- `@ai-sdk/anthropic`

The SDK is wrapped by CogniPace-owned functions:

- `resolveLanguageModel(config)`
- `generateJson(request)`
- `verifyProviderConnection(input)`

The rest of the app continues to use CogniPace `GenAiProviderConfig`,
`GenAiGenerateJsonRequest`, and `GenAiGenerateJsonResult` types.

Provider-specific SDK imports stay under `src/features/genai/server`. React
components, hooks, Assessment, overlay session, and dev-smoke UI cannot import
SDK provider types.

Verification uses a tiny background call through `generateText` or
`generateObject` with a bounded prompt, low output limit, timeout, and redacted
error handling. Assessment recommendations continue to request structured JSON
through the GenAI service, now implemented with AI SDK Core rather than
hand-written REST adapters.

The implementation must prove WXT can bundle the SDK in the MV3 background
service worker. If static imports bloat or break non-background chunks, use a
background-only dynamic import wrapper while preserving the same CogniPace GenAI
API.

## Future Provider Expansion

The provider abstraction should support later providers without reshaping
Assessment:

- OpenAI-compatible cloud providers through `@ai-sdk/openai-compatible`
- OpenRouter or other aggregator providers after host-permission and product
  approval
- local LM Studio/Ollama-style providers after explicit localhost host
  permission approval
- browser/on-device providers after their API and permission model is known

Those are not phase 1 work. Phase 1 stays on the already approved OpenAI,
Anthropic, and Gemini hosts.

## Dev Smoke And Diagnostics

Dev smoke should report:

- selected provider
- selected model
- secret presence
- verification state
- whether Assessment AI is enabled
- why active config is unavailable
- live provider result when the opt-in checkbox is enabled

When live smoke is enabled, record session-only diagnostics in the dev smoke UI
or console:

- provider id
- model id
- request purpose, such as `verify-provider` or `assessment-smoke`
- prompt character counts and schema name
- duration
- token usage when reported
- normalized result status

Diagnostics must not persist across sessions and must not include raw provider
keys. Prompt text may be shown only in the hidden dev smoke route and only after
being clearly marked as development diagnostics. Secret-like substrings are
redacted before display.

## Testing Strategy

Focused tests:

- GenAI metadata store defaults, parsing, persistence, and invalid stored state.
- Secret save/remove invalidates provider verification without returning raw
  key values.
- Provider status contract rejects secret-shaped fields.
- Runtime policy allows dashboard setup calls and rejects content-script setup
  calls.
- `loadActiveProviderConfig` uses Assessment enablement plus selected verified
  provider metadata plus trusted secret presence.
- Assessment settings draft no longer mutates provider/model.
- AI Provider card and dialog show configured, unverified, verified, invalid,
  and no-secret states.
- Dev smoke explains missing model, missing secret, unverified provider,
  disabled Assessment, and successful configured provider separately.
- SDK runtime wrapper maps auth, rate-limit, network, timeout, invalid-output,
  and unknown failures to safe GenAI errors.

Full validation for implementation phases:

```sh
npm run lint
npm run check
npm run build
```

If database schema is changed in a later cleanup phase, that phase must also run:

```sh
npm run db:generate
npm run db:check
```

Manual smoke before PR review or merge:

- Configure Gemini with a test key and default model.
- Verify the provider in the AI Provider dialog.
- Enable Assessment AI recommendations and save Settings.
- Reload dashboard and confirm AI Provider and Assessment states persist.
- Open `/dev/smoke` with live smoke off and confirm GenAI config reports ready.
- Open `/dev/smoke` with live smoke on and confirm the provider call succeeds or
  fails with a safe redacted message.
- Remove the provider key and confirm Assessment remains saved while warning
  that GenAI setup is missing.
- Export backup and confirm raw provider keys are absent.

## Rollout Plan

Phase 1: Provider setup and status

- Add GenAI metadata store and status contracts.
- Add dashboard-authorized provider model, key, selection, draft-test, and
  stored-verification runtime methods.
- Update active-provider resolution to use Assessment enablement plus selected
  verified provider metadata plus trusted secret presence.
- Keep existing provider secrets and migrate no raw secret data.

Phase 2: Dashboard provider UI and Assessment cleanup

- Add dashboard AI Provider card/dialog.
- Move provider/model/key UI out of Assessment settings.
- Rename visible AI assessment section to Assessment.
- Keep Assessment toggle independent and warning-based.
- Add focused settings draft regression tests for the previously reported model
  clearing behavior.

Phase 3: SDK runtime replacement

- Add AI SDK Core dependencies.
- Replace hand-written provider REST adapters with CogniPace's SDK-backed
  wrapper.
- Preserve existing GenAI result types and assessment recommendation contract.
- Update live dev smoke to exercise the SDK wrapper.

Phase 4: Documentation and smoke proof

- Update `docs/product.md`, `docs/architecture.md`, and `docs/testing.md`.
- Update hidden dev smoke copy.
- Capture human-run screenshot or screen recording proof for AI Provider,
  Assessment warning, and dev smoke live/non-live states.

## Open Decisions Resolved

- Use Vercel AI SDK Core, but only behind the GenAI background service.
- Do not use AI SDK React hooks for this flow.
- Do not use Vercel AI Gateway by default.
- Default setup to Gemini.
- Store provider connection metadata outside Settings and outside raw secret
  payloads.
- Keep local/on-device/OpenAI-compatible providers as a later approved phase.
