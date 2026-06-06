# Runtime endpoint for AI assessment recommendation — Design

**Issue:** [#6](https://github.com/Hollowvyn/cognipace-v2/issues/6) — Add runtime endpoint for AI assessment recommendation

**Depends on:** #3 (genai network layer), #4 (settings + secrets), #5 (review assistant prompt + schema) — all merged

**Unblocks:** #7 (overlay recommendation hook), #8 (recommendation component), #10 (end-to-end test)

## Goal

Expose one runtime method, `genai.recommendLeetCodeAssessment`, that the LeetCode-page content-script overlay can call to request an AI assessment recommendation. The background handler validates the request and sender, reads provider config in background-only code, calls the existing `recommendAssessment` orchestrator from #5, and returns a wire-safe response that never carries API keys.

This PR adds the runtime wiring. The overlay hook that consumes it ships in #7.

## Architecture

```
content-script (overlay)
    │  sendMessage('genai.recommendLeetCodeAssessment', request)
    ▼
extension/background/register-handlers.ts
    │  validate request schema (zod)
    │  assertCanSenderCallExtensionMethod (sender == content-script)
    ▼
features/leetcode-review-assistant/server/runtime-handler-service.ts
    │  1. assertConsistentProblemSlug (internal slugs match)
    │  2. resolveActiveProviderConfig (reads settings + secret)
    │  3. if null → return status: 'unavailable'
    │  4. delegate to recommendAssessment (from #5)
    │  5. map output to wire response (ready | error)
    │  6. redact secrets, echo submissionFingerprint
    ▼
content-script
```

The handler is a thin runtime layer: it has no business logic of its own, only request mapping, error translation, and the boundary checks. All AI logic lives in the orchestrator from #5.

### Why this shape

- **Co-located in `leetcode-review-assistant/server/`** rather than `genai/server/` so the orchestrator + runtime entry point ship together and version together. Matches how `leetcode-capture` co-locates its `readLeetCodeProblemMetadataInBackground` runtime handler with its capture logic.
- **No background state about active problems.** The internal-consistency check is purely structural (slugs agree across the request). The content-script aborts its own in-flight request on navigation via `AbortController`. This avoids a tab→slug map and the lifecycle bugs that come with one.
- **Wire shape `ready | unavailable | error`** is independent of the orchestrator's `ai | fallback` tagged union. Error/unavailable branches do NOT carry a fallback recommendation — the overlay already has the deterministic decision from #1 and renders it directly when AI is unavailable.

## Wire contracts

### Request schema

`features/leetcode-review-assistant/api/runtime-contracts.ts` exports `recommendLeetCodeAssessmentRequestSchema`:

```ts
z.object({
  surface: z.literal('content-script'),
  problemSlug: problemSlugSchema,                       // from features/problems
  submissionFingerprint: z.string().min(1).max(200),    // opaque, echoed back
  problem: assessmentRecommendationProblemSchema,       // new: zod for #5 type
  submission: assessmentRecommendationSubmissionSchema, // new: discriminated union
  timing: assessmentRecommendationTimingSchema,         // new
  deterministicDecision: leetCodeAssessmentDecisionSchema,    // from features/assessment
  sessionContext: overlayAssessmentSessionContextSchema,      // from features/overlay-session
}).strict()
```

Notes:
- `.strict()` rejects unknown wire fields.
- No `problemId` (the issue mentions it; the codebase canonical identifier is `problemSlug`).
- No `providerConfig` — background fills it in.
- The five `assessmentRecommendation*Schema` zod schemas for the problem/submission/timing/decision/sessionContext shapes are new in this PR. Issue #5 only declared the TypeScript types because the orchestrator was called intra-process; the runtime boundary needs runtime validation. Where a sibling feature already exports a zod schema for the type (e.g. `leetCodeAssessmentDecisionSchema` may not yet exist as a schema), we add it inside `leetcode-review-assistant/api/runtime-contracts.ts` rather than widening the sibling feature's contract surface.

### Response schema

```ts
z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ready'),
    recommendation: assessmentRecommendationSchema,    // from #5
    providerMetadata: genAiProviderMetadataSchema,     // from #3
    submissionFingerprint: z.string(),
  }).strict(),
  z.object({
    status: z.literal('unavailable'),
    message: z.string(),
    submissionFingerprint: z.string(),
  }).strict(),
  z.object({
    status: z.literal('error'),
    code: z.enum(['auth', 'rate-limit', 'network', 'timeout', 'invalid-output', 'unknown']),
    message: z.string(),
    providerMetadata: genAiProviderMetadataSchema.optional(),
    submissionFingerprint: z.string(),
  }).strict(),
])
```

The `code` enum intentionally excludes `'not-configured'` — that case maps to `status: 'unavailable'` because step 2 of the handler short-circuits before reaching the orchestrator's error path. `genAiProviderMetadataSchema` carries `provider`, `model`, `durationMs` — already secret-free per #3.

## Handler logic

`features/leetcode-review-assistant/server/runtime-handler-service.ts`:

```ts
export async function recommendLeetCodeAssessmentInBackground(
  db: Db,
  request: RecommendLeetCodeAssessmentRequest,
): Promise<RecommendLeetCodeAssessmentResponse> {
  assertConsistentProblemSlug(request)

  const providerConfig = await resolveActiveProviderConfig(db)
  if (providerConfig === null) {
    return {
      status: 'unavailable',
      message: 'AI is not configured. Add a provider in settings to get recommendations.',
      submissionFingerprint: request.submissionFingerprint,
    }
  }

  const result = await recommendAssessment({
    problem: request.problem,
    submission: request.submission,
    timing: request.timing,
    deterministicDecision: request.deterministicDecision,
    sessionContext: request.sessionContext,
    providerConfig,
  })

  if (result.status === 'ai') {
    return {
      status: 'ready',
      recommendation: result.recommendation,
      providerMetadata: result.providerMetadata,
      submissionFingerprint: request.submissionFingerprint,
    }
  }

  return {
    status: 'error',
    code: result.error.code,
    message: mapErrorToUserMessage(result.error.code),
    submissionFingerprint: request.submissionFingerprint,
  }
}
```

### Internal-consistency check

`assertConsistentProblemSlug(request)` throws when:
- `request.problemSlug !== request.problem.slug`
- the `deterministicDecision` carries a slug field (verify against the type from #1) and it disagrees
- the `sessionContext` carries a slug field (verify against the type from #2) and it disagrees

The thrown error surfaces at the runtime boundary the same way a zod parse error does — the wire receives an extension messaging error, not a structured response. (The overlay hook in #7 treats messaging errors as `status: 'error'` with code `unknown`.)

If `deterministicDecision` and `sessionContext` do NOT actually carry slug fields after inspecting their declared types, the check reduces to `request.problemSlug === request.problem.slug` and an explanatory comment in the function.

### Provider config resolution

`resolveActiveProviderConfig(db)`:
1. Reads `getSettings(db).aiAssessment.activeProvider` (from #4) — returns null if no active provider.
2. Reads `getAiProviderSecret(db, activeProvider)` (from #4) — returns null if no secret.
3. Reads the provider's model from settings.
4. Returns `{ provider, model, apiKey }` if everything is present; `null` otherwise.

The `apiKey` literal token stays inside `features/genai/` (existing architecture rule). The runtime handler receives an opaque `providerConfig` object whose `apiKey` field is accessed only by passing the object to `recommendAssessment`. We must not destructure or log it.

### Error → user message mapping

`mapErrorToUserMessage(code)` is exhaustive over `Exclude<GenAiError, 'not-configured'>`:

| code | message |
|---|---|
| `auth` | `"AI authentication failed. Check the API key in settings."` |
| `rate-limit` | `"AI is rate-limited. Try again in a moment."` |
| `network` | `"AI request could not reach the provider."` |
| `timeout` | `"AI request timed out."` |
| `invalid-output` | `"AI returned an unexpected response."` |
| `unknown` | `"AI request failed."` |

These messages are user-facing UI strings. They are different from the AI-prompt-side `FALLBACK_REASON_BY_CODE` in the normalizer (which describes the error for log/debug purposes). Issue #7's overlay hook renders these strings verbatim.

## Files and public surface

### New files

| Path | Purpose |
|---|---|
| `features/leetcode-review-assistant/api/runtime-contracts.ts` | Request + response zod schemas, inferred types, the five sub-schemas. |
| `features/leetcode-review-assistant/api/index.ts` | Re-exports the runtime contracts. |
| `features/leetcode-review-assistant/server/runtime-handler-service.ts` | `recommendLeetCodeAssessmentInBackground` + private helpers. |
| `features/leetcode-review-assistant/server/runtime-handler-service.test.ts` | Unit tests with mocked dependencies. |

### Modified files

| Path | Change |
|---|---|
| `features/leetcode-review-assistant/server/index.ts` | Re-export `recommendLeetCodeAssessmentInBackground`. |
| `features/leetcode-review-assistant/index.ts` | Re-export the runtime contracts from `./api` (types + schemas, no server functions). |
| `extension/messaging.ts` | Add `'genai.recommendLeetCodeAssessment'` to `ProtocolMap`. Import + re-export `recommendLeetCodeAssessmentRequestSchema` and `recommendLeetCodeAssessmentResponseSchema`. |
| `extension/background/runtime-policy.ts` | Add `'genai.recommendLeetCodeAssessment': ['content-script']` to `methodSurfaceAccess`. |
| `extension/background/register-handlers.ts` | Add `onMessage('genai.recommendLeetCodeAssessment', ...)` block with schema parse + sender assertion + handler call. |

### Why `runtime-handler-service.ts` (not `runtime-handler.ts`)

The architecture-boundary test's cross-feature deep-import regex only allows paths matching `server/*service`. The new file must satisfy that pattern so `register-handlers.ts` can import it cleanly. Same fix pattern that issue #3 used to rename `genai-client.ts` → `genai-service.ts`.

### Public surface after this PR

Root `features/leetcode-review-assistant/index.ts` exports:
- (existing) domain types, `assessmentRecommendationSchema`, `assessmentRecommendationSchemaLimits`
- (new) `recommendLeetCodeAssessmentRequestSchema`, `recommendLeetCodeAssessmentResponseSchema`, `RecommendLeetCodeAssessmentRequest`, `RecommendLeetCodeAssessmentResponse`

The orchestrator (`recommendAssessment`) and the new runtime handler (`recommendLeetCodeAssessmentInBackground`) are NOT in the root barrel — they're reached via the `server/*service` deep path per the existing architecture rule.

## Error handling

| Source | Surface |
|---|---|
| Zod parse failure on the wire request | Extension messaging error (thrown), not a structured response. Symmetric with how `leetcode.readSubmissionResult` behaves today. |
| `assertCanSenderCallExtensionMethod` failure | Extension messaging error. Sender attempted to claim a surface it doesn't own. |
| Internal-consistency check failure | Extension messaging error (thrown from the handler). |
| Provider config null | Structured `status: 'unavailable'`. |
| Orchestrator returns `fallback` with code `'not-configured'` | Cannot happen — pre-check covers it. If it ever does (defensive), it maps to `status: 'unavailable'` via the same message path. |
| Orchestrator returns `fallback` with any other code | Structured `status: 'error'` with mapped message. |
| Orchestrator throws (e.g. AbortError from generateJson) | Propagates as extension messaging error — content-script's `AbortController` cancellation surfaces correctly. |

## Testing

### Unit tests (`runtime-handler-service.test.ts`)

Mocks `recommendAssessment` from `./recommendation-service` and the settings/secret readers from `@/features/genai`.

1. **Valid request → `status: 'ready'`** — provider configured, orchestrator returns `'ai'`, handler returns ready with recommendation + providerMetadata + echoed fingerprint.
2. **No active provider → `status: 'unavailable'`** — `getSettings` reports no active provider; orchestrator is never called.
3. **Provider configured but secret missing → `status: 'unavailable'`** — secret reader returns null; orchestrator is never called.
4. **Each operational error code → `status: 'error'`** — `it.each` over `auth | rate-limit | network | timeout | invalid-output | unknown`; verify the user-facing message matches the table.
5. **Mismatched slug → thrown error** — `request.problemSlug !== request.problem.slug` throws. Other slug fields tested if they exist on the underlying types.
6. **Fingerprint echoed in all three branches** — single fingerprint string round-trips through ready / unavailable / error.
7. **Response contains no `apiKey` literal** — JSON-serialize the response across all three branches; regex assertion.
8. **Practice repository never touched** — vitest spy on `practice-service` / `practice-repository`; assert zero calls across all branches.

### Register-handlers integration tests

9. **Content-script sender → flows through** — happy path with stubbed handler.
10. **Popup sender → throws** — `assertCanSenderCallExtensionMethod` rejects.
11. **Dashboard sender → throws** — same.
12. **Background sender → throws** — same.

### Architecture-boundary checks (existing suite — no new tests required)

- `apiKey` literal must remain absent from new `api/` and `server/runtime-handler-service.ts` files.
- The new `register-handlers.ts` import of `@/features/leetcode-review-assistant/server/runtime-handler-service` matches the `server/*service` allowlist.

### Acceptance criteria coverage

| Criterion (from issue #6) | Test |
|---|---|
| Content script can request a recommendation | 1, 9 |
| Popup/dashboard cannot claim content-script | 10, 11 |
| Handler validates request and sender policy | 5, 10–12 |
| Handler reads provider config in background | 2, 3 |
| Handler does not mutate practice data | 8 |
| Handler does not broadcast practice invalidation | 8 + absence of broadcaster import |
| Stale problem slug/request mismatch is rejected | 5 |
| Response never includes API keys or secret provider config | 7 |

## Non-goals

- **Overlay UI hook.** Lives in #7.
- **Recommendation rendering component.** Lives in #8.
- **AI notes guardrails.** Lives in #9.
- **End-to-end test.** Lives in #10.
- **Background state for "active problem per tab".** Not added; the content-script governs its own request lifecycle.
- **A fallback recommendation in error/unavailable branches.** Intentionally dropped — overlay uses the deterministic decision when AI is not available.
