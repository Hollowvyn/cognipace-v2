# Overlay Recommendation Hook — Design

**Issue:** [#7](https://github.com/Hollowvyn/cognipace-v2/issues/7) — Wire overlay hook for AI recommendation lifecycle

**Depends on:** #1 (deterministic decision), #2 (session context), #6 (runtime endpoint) — all merged

**Unblocks:** #8 (recommendation component), #9 (AI notes guardrails), #10 (end-to-end test)

## Goal

Wire the AI recommendation into the existing overlay session as a self-contained React hook. The hook owns the full request lifecycle — when to fire, dedupe, abort on navigation, preselect the rating only when safe — without spreading effects across UI components or mutating any persisted state.

This PR adds the hook and the reducer pieces it depends on. The UI rendering of `aiRecommendation` ships in #8.

## Architecture

```
useLeetCodeOverlaySession
    │
    ├── useOverlayTimer
    ├── useOverlayDraft
    ├── useLeetCodePageSync   ← submission.result
    ├── useOverlayReviewActions
    ├── useLeetCodeSubmissionAutomation  ← deterministic auto-save
    └── useLeetCodeAssessmentRecommendation  ← NEW
            │
            ├── sendMessage('genai.recommendLeetCodeAssessment', …)  (from #6)
            └── dispatch({ type: 'ai-preselect-rating', rating })    (when safe)
```

The new hook composes alongside `useLeetCodeSubmissionAutomation`. Both watch the same `pageSync.submission.result` but for orthogonal purposes: one auto-saves the deterministic review; one asks the AI. They never coordinate — that's the point. The deterministic save is fire-and-forget at terminal-result time; the AI request runs in parallel and never blocks anything.

### Why a hook (not a reducer slice, not a query)

The overlay-session reducer is for serializable session state that survives reducer-action tracing. The AI recommendation has lifecycle concerns the reducer is bad at: AbortController, in-flight tracking, fingerprint dedupe across mount/unmount. TanStack Query would solve those but is not used anywhere else in `overlay-session/hooks/`. A local hook with the same refs+effects pattern as `use-leetcode-submission-automation.ts` keeps everything consistent with the existing codebase.

### Trigger condition (terminal LeetCode result only)

The hook fires on terminal `submissionResult` arrival when:
- `aiEnabled` (from settings) is `true`
- `activeProblemSlug` is set
- `submissionResult.location.slug === activeProblemSlug`
- The submission `problem` and overlay `context` are loaded
- The submission fingerprint has not been seen before

The manual-overlay path (no submission) does NOT auto-fire the AI. That can be added in #8 or #10 if needed.

## Reducer changes

Three additions to `features/overlay-session/domain/overlay-session-state.ts`:

### 1. New field on `OverlaySessionState`

```ts
export type OverlaySessionState = {
  // … existing fields …
  userTouchedRating: boolean   // NEW
}
```

Initial value `false` (in `initialOverlaySessionState`). Reset to `false` on every action that resets session state: `problem-loaded`, `page-changed`, `restart-local-session`, `problem-context-refreshed`.

### 2. Modify `set-selected-rating`

User-initiated rating changes now also flip `userTouchedRating` to true:

```ts
case 'set-selected-rating':
  if (state.ratingLockReason) return state
  return withDerivedReviewStatus({
    ...state,
    selectedRating: action.rating,
    userTouchedRating: true,
  })
```

The existing UI buttons that dispatch `set-selected-rating` need no changes — the action's behavior changes, not its shape.

### 3. New action `ai-preselect-rating`

```ts
| { type: 'ai-preselect-rating'; rating: ReviewRating }

case 'ai-preselect-rating':
  if (state.ratingLockReason) return state
  if (state.userTouchedRating) return state
  if (state.selectedRating === action.rating) return state
  return withDerivedReviewStatus({
    ...state,
    selectedRating: action.rating,
    // userTouchedRating stays false — AI preselects are not "touches"
  })
```

`withDerivedReviewStatus` already transitions `reviewStatus` to `submitted-dirty` when a submitted session exists and the new rating differs from `submittedSession.rating`. That covers the "mark dirty so `Update` can replace the latest review" requirement automatically.

## Hook contract

`features/overlay-session/hooks/use-leetcode-assessment-recommendation.ts`:

### Options

```ts
type UseLeetCodeAssessmentRecommendationOptions = {
  activeProblemSlug: string | null
  problem: LeetCodeProblemMetadata | null
  submissionResult: LeetCodeSubmissionResult | null
  submittedSession: OverlaySubmittedSession | null
  overlayState: OverlaySessionState
  context: LeetCodeOverlayContext | null
  timing: {
    elapsedSeconds: number
    targetSeconds: number
    timerUsed: boolean
  }
  aiEnabled: boolean
  dispatch: (action: OverlaySessionAction) => void
}
```

### Return shape

```ts
export type AssessmentRecommendationState =
  | { status: 'idle' }
  | { status: 'pending'; fingerprint: string }
  | {
      status: 'ready'
      fingerprint: string
      recommendation: AssessmentRecommendation
      providerMetadata: GenAiProviderMetadata
    }
  | { status: 'unavailable'; fingerprint: string; message: string }
  | {
      status: 'error'
      fingerprint: string
      code: RecommendLeetCodeAssessmentErrorCode
      message: string
    }

export type UseLeetCodeAssessmentRecommendationResult = {
  state: AssessmentRecommendationState
  reset: () => void
}

export function useLeetCodeAssessmentRecommendation(
  options: UseLeetCodeAssessmentRecommendationOptions,
): UseLeetCodeAssessmentRecommendationResult
```

The `reset` function is called by `useOverlayReviewActions` when it dispatches `restart-local-session`. It aborts any in-flight request and resets state to `{ status: 'idle' }`.

### Internal refs

Following the established pattern in `use-leetcode-submission-automation.ts`:

| Ref | Purpose |
|---|---|
| `handledFingerprintsRef: Set<string>` | Fingerprints already requested (dedupe). Cleared on problem change. |
| `pendingFingerprintRef: string \| null` | Current in-flight fingerprint, used to ignore stale responses. |
| `abortControllerRef: AbortController \| null` | Aborts in-flight `sendMessage` on navigation/restart. |
| `dispatchRef`, `aiEnabledRef`, `contextRef`, etc. | Value refs to keep effect deps stable. |

## State machine

```
              ┌─────────┐
              │  idle   │ ◄────── navigation, restart, ai-disabled, no-result
              └────┬────┘
                   │ terminal result, !handledFingerprints.has(fp),
                   │ aiEnabled, context complete
                   │ → register fp, fire sendMessage with AbortController
                   ▼
              ┌─────────┐
   same fp ─► │ pending │ ◄── same fp arrives again → no-op
              │ (fp:X)  │
              └────┬────┘
                   │ sendMessage resolves AND fp still current AND slug unchanged
                   │
        ┌──────────┼──────────────────────┐
        │          │                      │
        ▼          ▼                      ▼
   ┌────────┐ ┌──────────────┐      ┌─────────┐
   │ ready  │ │ unavailable  │      │  error  │
   └────────┘ └──────────────┘      └─────────┘
        │
        │ if !lock && !userTouched && rec.rating !== selectedRating
        ▼
   dispatch({ type: 'ai-preselect-rating', rating })
```

### Stale-response guard

When `sendMessage` resolves, the hook checks BOTH conditions before applying the response:
1. `response.submissionFingerprint === pendingFingerprintRef.current`
2. `activeProblemSlug` unchanged since the request fired

If either fails, the response is silently dropped — no state update, no dispatch.

### Abort handling

`sendMessage` rejections fall into two cases:
- **AbortError** (caller-initiated, expected) → silent, state stays `idle` after the reset that triggered the abort.
- **Other rejections** (messaging error, schema parse failure, sender-policy failure) → state becomes `{ status: 'error', code: 'unknown', message: <the error message> }`.

### Reset triggers

Two paths:
1. `useEffect` watching `activeProblemSlug`: any change triggers `abortControllerRef.current?.abort()`, clears `handledFingerprintsRef`, sets `pendingFingerprintRef = null`, sets state to `idle`. Handles navigation and `page-changed` (which sets `activeProblemSlug = null`).
2. Explicit `reset()` returned to the parent: called by `useOverlayReviewActions` when it dispatches `restart-local-session`. Performs the same teardown.

## Integration

Inside `useLeetCodeOverlaySession`, after `useLeetCodeSubmissionAutomation`:

```ts
const aiEnabled = settings.aiAssessment.enabled  // or wherever the canonical source surfaces; will verify during implementation

const recommendation = useLeetCodeAssessmentRecommendation({
  activeProblemSlug: overlay.activeProblemSlug,
  problem: pageSync.context?.problem ?? null,
  submissionResult: pageSync.submission.result,
  submittedSession: overlay.submittedSession,
  overlayState: overlay,
  context: pageSync.context,
  timing: {
    elapsedSeconds,
    targetSeconds,
    timerUsed: timer.status !== 'idle',
  },
  aiEnabled,
  dispatch,
})

// thread recommendation.reset into useOverlayReviewActions so it can call
// reset() alongside dispatch('restart-local-session')
```

Add `aiRecommendation: AssessmentRecommendationState` to `LeetCodeOverlaySession` return type. The UI rendering ships in #8.

### Wire-request construction

The hook builds the wire request from a combination of:
- `request.problem` ← `pageSync.context.problem` (slug, title, difficulty, topics, statement)
- `request.submission` ← derived from `submissionResult` (accepted/failed/no-submission branches)
- `request.timing` ← from `options.timing`
- `request.deterministicDecision` ← derived inside the hook by calling a function from `features/assessment` (verified during implementation; if the existing function lives only inside review-actions, we extract a small helper)
- `request.sessionContext` ← `deriveOverlayAssessmentSessionContext({ context, overlay, submissionSource: 'leetcode-watcher', timerUsed })` from #2
- `request.problemSlug` ← `activeProblemSlug`
- `request.submissionFingerprint` ← `createSubmissionResultKey(submissionResult)`

The `createSubmissionResultKey` function currently lives privately in `use-leetcode-submission-automation.ts`. It should be extracted to a shared module so both hooks use the identical definition:

`features/overlay-session/hooks/submission-result-key.ts` (new) exports the function; both hooks import it.

### `ai-preselect-rating` dispatch — hook-level guard

Before dispatching, the hook checks:
```ts
if (recommendation.recommendedRating !== overlayState.selectedRating)
```

The reducer guards against `userTouchedRating` and `ratingLockReason` regardless, but the hook avoids the no-op dispatch when the AI rating happens to match the current selection.

## Files

### New

| Path | Purpose |
|---|---|
| `src/features/overlay-session/hooks/use-leetcode-assessment-recommendation.ts` | The hook. |
| `src/features/overlay-session/hooks/use-leetcode-assessment-recommendation.test.tsx` | 13 hook tests. |
| `src/features/overlay-session/hooks/submission-result-key.ts` | Extracted fingerprint helper, shared with `use-leetcode-submission-automation.ts`. |
| `src/features/overlay-session/hooks/submission-result-key.test.ts` | Coverage for the extracted helper. |

### Modified

| Path | Change |
|---|---|
| `src/features/overlay-session/domain/overlay-session-state.ts` | Add `userTouchedRating` field; modify `set-selected-rating`; add `ai-preselect-rating` action + case; reset `userTouchedRating` on session-reset actions. |
| `src/features/overlay-session/domain/overlay-session-state.test.ts` | Add R1–R7 reducer tests. |
| `src/features/overlay-session/hooks/use-leetcode-submission-automation.ts` | Replace inline `createSubmissionResultKey` with import from the new shared module. |
| `src/features/overlay-session/hooks/use-leetcode-overlay-session.ts` | Compose the new hook; thread `recommendation.reset` into `useOverlayReviewActions`. |
| `src/features/overlay-session/hooks/use-overlay-review-actions.ts` | Accept `onRestart?: () => void` option; call it when dispatching `restart-local-session`. |
| `src/features/overlay-session/index.ts` | Export the new hook + its result type. |

The hook and types are exported via the existing `features/overlay-session/index.ts` barrel. Cross-feature consumers (`features/genai`, etc.) are not added — this hook is consumed only by the overlay's parent composition.

## Error handling

| Source | Surface |
|---|---|
| `sendMessage` rejects with AbortError | Silent; the abort was caller-initiated (navigation/restart). State is already `idle`. |
| `sendMessage` rejects with anything else | `{ status: 'error', code: 'unknown', message }` after fingerprint+slug guards pass. |
| Late response (fingerprint or slug changed) | Dropped silently — no state update, no dispatch. |
| `response.status === 'unavailable'` | `{ status: 'unavailable', message }`. No dispatch. |
| `response.status === 'error'` | `{ status: 'error', code, message }`. No dispatch. |
| `response.status === 'ready'` with `ratingLockReason !== null` | State becomes `ready` (so UI can show the explanation). No dispatch (lock holds). |
| `response.status === 'ready'` with `userTouchedRating === true` | State becomes `ready`. No dispatch (user's choice wins). |
| `response.status === 'ready'`, no lock, no user touch, rating differs | State becomes `ready` AND dispatches `ai-preselect-rating`. |
| `response.status === 'ready'`, rating equals current selection | State becomes `ready`. No dispatch (would be a no-op). |

## Testing

### Hook tests (13 cases, Vitest + `renderHook`)

1. Accepted submission triggers `sendMessage` once with the correct fingerprint
2. Failed submission also triggers (lock-keeps-`again` is enforced server-side per #5)
3. AI disabled → no request
4. Duplicate terminal result → no duplicate request (fingerprint dedupe)
5. New submission with new fingerprint → previous request aborted, new request fired
6. `activeProblemSlug` change → AbortController.abort called, state resets to `idle`
7. `reset()` clears `ready` state, aborts in-flight
8. Late `ready` response after slug changed → silently dropped (no setState, no dispatch)
9. `ready` response with safe conditions → dispatches `ai-preselect-rating`
10. `ready` response with `userTouchedRating: true` → no dispatch
11. `ready` response with `ratingLockReason` → no dispatch (state still becomes `ready`)
12. `unavailable` response → state, no dispatch
13. `error` response → state with code+message, no dispatch

### Reducer tests (R1–R7, appended to existing test file)

1. `set-selected-rating` sets `userTouchedRating: true`
2. `ai-preselect-rating` no-op when `userTouchedRating` is `true`
3. `ai-preselect-rating` no-op when `ratingLockReason` is set
4. `ai-preselect-rating` applies when both flags are false and rating differs
5. `ai-preselect-rating` no-op when rating equals `state.selectedRating`
6. After AI preselect into a different rating, `reviewStatus` becomes `submitted-dirty` (when `submittedSession` is set)
7. `userTouchedRating` resets to `false` on `problem-loaded`, `page-changed`, `restart-local-session`, `problem-context-refreshed`

### Shared-helper test

`submission-result-key.test.ts` — minimal smoke test that two identical results produce the same key; two distinct results produce different keys.

### Acceptance criteria coverage

| Criterion (from issue #7) | Test(s) |
|---|---|
| AI does not block deterministic save | The two hooks are independent — no shared lock. Verified by sequencing in hook test #1 |
| AI never creates duplicate review attempts | Hook never imports save/practice functions (enforced by code review of the import list). Test #4 (no duplicate request) shows the hook never triggers a save path even on terminal-result repeat |
| AI recommendation can only affect saved history through existing `Update` | Reducer test R6 (`submitted-dirty` transition); the Update button is existing UI |
| Stale AI result is ignored after SPA navigation | Test #8 |
| User manual rating choice wins over late AI result | Test #10 + R2 |
| Accepted submission starts recommendation request | Test #1 |
| Failed submission keeps `Again` | Test #2 (request fired) + server-side normalizer test in #5 |
| Duplicate terminal result does not duplicate AI request | Test #4 |
| Submitted session becomes dirty when AI preselects different allowed rating | Test #9 + R6 |
| Navigation clears pending recommendation | Test #6 |
| Restart clears ready recommendation | Test #7 |

## Non-goals

- **UI rendering of `aiRecommendation`.** Ships in #8.
- **AI notes guardrails.** Ships in #9.
- **Manual "Ask AI" trigger for the no-submission path.** Not required by #7's acceptance criteria.
- **Retry on transient errors.** Out of scope; the user can re-submit to retry.
- **Persisting the recommendation across page reloads.** Session-only by design.
