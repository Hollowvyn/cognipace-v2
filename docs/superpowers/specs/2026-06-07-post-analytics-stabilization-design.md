# Post-Analytics Stabilization Design

## Context

The cleanup covers the work from `0caf86a59dbbea6fa389b69efc3ba6a183656681`
through `c0820d7`. That range includes visible Analytics UI work plus later
cache invalidation, assessment policy, sync UX, due notifications, GenAI
provider support, AI provider settings/secrets, and the LeetCode review
assistant runtime endpoint.

Current validation passes with `npm run check`, but the audit found gaps that
tests do not catch:

- `analytics.getSummary` is declared and registered, but the runtime sender
  policy does not authorize it for the dashboard.
- Runtime tests do not prove that declared protocol methods are covered by
  sender policy.
- GenAI secrets bypass the existing `src/platform/secrets` trusted storage
  boundary and are stored in `settings_kv` under `genai-secrets`.
- AI provider network adapters exist, but the manifest does not grant host
  access to provider origins.
- The notification permission was added for due reminders and needs explicit
  documentation because Chrome permission expansion is a project safety rule.
- Product and testing docs still describe Analytics as reserved/incomplete even
  though a real dashboard Analytics route now exists.

## Goals

- Make the Analytics dashboard route load through the real extension runtime
  boundary.
- Add regression coverage for runtime method authorization and handler wiring.
- Move AI provider secrets behind the existing trusted secret-storage
  abstraction.
- Decide and encode whether AI provider network calls are shipped now or gated
  until manifest permission approval.
- Document any intentional Chrome permission expansion.
- Align product, architecture, and testing docs with the current shipped
  behavior.
- Preserve the repo's small-app Bulletproof React shape:
  `entrypoints -> app -> features -> platform/lib/components`.

## Non-Goals

- No new account, auth, hosted backend, team, or generic SaaS behavior.
- No new architecture layer or runtime-RPC abstraction.
- No redesign of Analytics visuals beyond changes required to make the surface
  correct and testable.
- No broad refactor of assessment, sync, settings, or overlay code outside the
  stabilization issues listed here.
- No rollback of useful feature work unless a specific shipped path cannot be
  made safe.

## Architecture

### Runtime Boundary

`src/extension/messaging.ts` remains the protocol declaration. Runtime sender
authorization remains in `src/extension/background/runtime-policy.ts`, and
handler registration remains in
`src/extension/background/register-handlers.ts`.

The fix adds `analytics.getSummary` to dashboard-authorized methods. It also
adds tests that fail when a protocol method is missing from sender policy. The
test should compare the method names exported by the protocol layer against the
policy allow-list through an explicit helper rather than parsing source text.
If a helper is needed, expose a readonly policy method list from
`runtime-policy.ts`.

Analytics remains a feature-owned read surface:

```text
src/app/dashboard/screens/analytics-page.tsx
  -> src/features/analytics/components
  -> src/features/analytics/api
  -> extension runtime
  -> src/features/analytics/server
  -> src/features/analytics/data
```

Dashboard app code may compose `AnalyticsScreen`, but Analytics data reads stay
inside the Analytics feature and the trusted background runtime.

### Secrets Boundary

AI provider API keys move from `settings_kv` to `src/platform/secrets`, which
already restricts `chrome.storage.local` to trusted contexts and returns status
without raw secret values.

Provider mapping:

```text
openai    -> genai:openai
anthropic -> genai:anthropic
gemini    -> genai:google
```

The GenAI feature keeps its current public API shape for UI callers:

- save a provider key
- clear a provider key
- read provider key presence
- resolve configured provider credentials inside the background service

The UI never receives raw keys. Backup, sync, app-shell, and settings payloads
must not serialize key values. The existing `genai-secrets` DB row becomes
legacy data: the stabilization should stop writing it and ignore or delete it
through a safe cleanup path.

### AI Network Shipping Decision

The implementation must make one explicit choice:

1. Ship AI provider calls now by adding provider host permissions for the
   supported default origins and documenting the permission expansion.
2. Keep AI settings visible but gate runtime recommendation calls until host
   permission approval lands.

The recommended path is option 2 unless product approval for extra provider host
permissions is confirmed during implementation. This avoids silently expanding
Chrome network access beyond LeetCode and GitHub.

If option 1 is approved, host permissions should be narrow:

```text
https://api.openai.com/*
https://api.anthropic.com/*
https://generativelanguage.googleapis.com/*
```

Custom `baseUrl` support should not imply wildcard host permissions. If custom
base URLs are retained, they need a separate optional-permission design.

### Notification Permission

Due notifications may keep the `notifications` permission because Chrome
requires it for `chrome.notifications`. The docs must state why the permission
exists, which feature owns it, and how the feature remains local-first:

- scheduling and dedup state stay in the background service worker
- no host permissions are added for notifications
- React components do not call `chrome.notifications` directly

### Documentation

Docs must reflect current behavior after stabilization:

- `docs/product.md`: Analytics is either a real lightweight dashboard route or
  explicitly gated, matching the implementation.
- `docs/architecture.md`: include Analytics and GenAI ownership if they remain
  shipped, and document the secret-storage boundary for GenAI.
- `docs/testing.md`: add smoke checks for Analytics and any shipped AI or
  notification behavior.
- `docs/superpowers/README.md`: add this stabilization design and its
  implementation plan to the historical index.

## Components And Data Flow

### Analytics

The Analytics UI remains presentational:

- `AnalyticsScreen` owns query state and retry affordance.
- `AnalyticsMetricRow`, `AnalyticsForecast`, and `AnalyticsWeakProblems` render
  data only.
- `useAnalyticsSummary` owns the TanStack Query hook and runtime call.

Data flow:

```text
Dashboard Analytics route
-> useAnalyticsSummary()
-> sendMessage('analytics.getSummary', {})
-> runtime policy validates dashboard sender
-> analytics request schema parses input
-> analytics service reads DB-owned facts
-> analytics response schema parses output
-> query cache updates Analytics UI
```

### GenAI Settings And Assistant

Settings keeps draft state for provider/model/enabled controls. Secret actions
go through GenAI runtime methods and trusted secret storage.

Recommendation flow:

```text
content-script overlay
-> genai.recommendLeetCodeAssessment runtime method
-> runtime policy validates content-script sender
-> assistant runtime contract parses page/session payload
-> background service reads settings and provider secret
-> if AI network calls are allowed, provider adapter runs
-> response is normalized and parsed before returning to overlay
```

If AI network calls are gated, the same runtime method should return a typed
not-configured or unavailable response without attempting provider fetch.

## Error Handling

- Analytics runtime authorization failures should be covered by tests and should
  not be expected in normal dashboard use.
- Analytics UI keeps its retry state for DB/runtime failures.
- Missing AI provider key, missing model, missing host permission approval, or
  disabled AI should return typed non-secret errors.
- Provider errors must continue to redact API keys, raw headers, and raw
  provider bodies.
- Legacy malformed `genai-secrets` DB content should be ignored or cleaned
  without breaking Settings.

## Testing

Focused tests:

- `runtime-policy.test.ts`: `analytics.getSummary` dashboard-only access.
- Runtime policy completeness test: every runtime method in the protocol map is
  represented in sender policy.
- `register-handlers.test.ts`: analytics handler parses request, enforces
  dashboard sender, calls analytics service, and parses response.
- Analytics component tests remain behavior-focused and should not mock around
  runtime policy.
- GenAI settings/service tests prove secrets are saved through
  `src/platform/secrets`, presence checks do not expose raw values, and the DB
  `genai-secrets` row is not written.
- Backup/sync tests prove AI key material is absent from exported and synced
  payloads.
- AI recommendation runtime tests cover the selected shipping decision:
  provider calls with approved host permissions, or a typed gated response when
  permissions are not approved.
- Manifest/static tests cover intentional permissions:
  `notifications` is present for due reminders, provider host permissions are
  absent when AI calls are gated, or present only for approved provider origins.

Validation:

```sh
npm run test -- src/extension/background/runtime-policy.test.ts
npm run test -- src/extension/background/register-handlers.test.ts
npm run test -- src/features/analytics
npm run test -- src/features/genai src/features/leetcode-review-assistant
npm run check
npm run format
```

## Implementation Notes

- Keep changes incremental and scoped by owner.
- Fix runtime authorization before broader cleanup so Analytics stops failing.
- Move GenAI secret storage behind a small adapter that maps GenAI provider ids
  to `SecretProviderId`.
- Prefer deleting the `settings_kv` GenAI secret store after tests cover the new
  storage path.
- Do not add provider host permissions without explicit approval.
- Keep docs honest about whether AI provider calls are shipped or gated.

## Acceptance Criteria

- Analytics dashboard loads its summary through the background runtime.
- Runtime policy tests fail if a declared runtime method lacks sender policy.
- GenAI API keys are no longer stored in the app DB.
- Backup, sync, app-shell, and settings payloads do not include raw AI keys.
- AI recommendation behavior matches the selected manifest-permission decision.
- Notification permission is documented and tied to the due-notification feature.
- Product, architecture, and testing docs match current behavior.
- Focused tests and `npm run check` pass.
