# Session-Only AI Notes Guardrails — Design

**Issue:** [#9](https://github.com/Hollowvyn/cognipace-v2/issues/9) — Keep AI recommendation notes session-only and out of persistence

**Depends on:** #7 (overlay recommendation hook) — merged via PR #74. #8 (recommendation component) — open as PR #75.

**Unblocks:** #10 (end-to-end test and architecture audit)

## Goal

Lock in the invariant that AI-authored text (summary, primary reason, evidence, improvement points, edge case notes) lives only in the overlay session's `aiRecommendation` state and never flows into any persistence payload or backup export.

This work doesn't change behavior. The architecture established by #7 and #8 already keeps AI state out of the persistence layer. This PR makes the invariant explicit through regression tests at the integration boundary so a future refactor of the overlay composition can't silently break it.

## Why the invariant already holds

Three persistence paths run from `useOverlayReviewActions`:
- `saveReviewResultViaRuntime` (called by `prepareQuickSubmit`, `submitReview`, `failReview`, `saveLeetCodeSubmissionResult`)
- `overrideLastReviewResultViaRuntime` (called by `updateReview`)
- `updateCurrentPracticeLogViaRuntime` (called by `persistDraftIfNeeded` on `collapse`/`dock`)

All three build their `log` argument from `toPracticeLogPatch(currentOverlay.draft)`. `toPracticeLogPatch` (in `src/features/overlay-session/domain/overlay-draft.ts`) emits exactly the five `OverlayDraftLog` fields: `interviewPattern`, `timeComplexity`, `spaceComplexity`, `languages`, `notes`. None of these are AI fields, and `currentOverlay.draft` is the user-typed draft — not the `aiRecommendation` view-model.

The `aiRecommendation` field is added to `LeetCodeOverlaySession` by #7 and read by `OverlayAssessmentRecommendation` in #8. Neither writes back into the draft, dispatches into the reducer's draft slice, or feeds the persistence calls.

This PR proves the architecture stays correct under realistic flows by driving the live `useLeetCodeOverlaySession` hook end-to-end with mocked runtime calls and asserting the captured payloads carry zero AI text.

## Architecture

No production code changes are planned. The deliverable is five integration tests in the existing `use-leetcode-overlay-session.test.tsx`. Each test:

1. Mocks `sendMessage('genai.recommendLeetCodeAssessment', …)` to return a `ready` response containing distinctive AI-probe strings.
2. Drives the relevant flow (submission, restart, navigation, save, update, draft persistence).
3. Asserts the captured payload carries none of the probe strings and that the `log` keys are a subset of `OverlayDraftLog` keys.

If any of tests 3–5 surfaces a real leak, the fix lands as a follow-up commit inside this PR. My read of the existing code is that no leak exists today — the architecture is correct — but tests 3–5 are designed to confirm that.

### Probe strings

Define module-scope constants at the top of the test file:

```ts
const AI_PROBE_PRIMARY_REASON = '__AI_PROBE_primary_reason__'
const AI_PROBE_EVIDENCE = '__AI_PROBE_evidence_item__'
const AI_PROBE_SUMMARY = '__AI_PROBE_summary__'
const AI_PROBE_IMPROVEMENT = '__AI_PROBE_improvement_point__'
const AI_PROBE_EDGE_CASE = '__AI_PROBE_edge_case_note__'
const AI_PROBES = [
  AI_PROBE_PRIMARY_REASON,
  AI_PROBE_EVIDENCE,
  AI_PROBE_SUMMARY,
  AI_PROBE_IMPROVEMENT,
  AI_PROBE_EDGE_CASE,
] as const
```

The leak assertion serializes the captured payload to JSON and confirms none of the probes appear:

```ts
function expectNoAiLeak(payload: unknown): void {
  const serialized = JSON.stringify(payload)
  for (const probe of AI_PROBES) {
    expect(serialized).not.toContain(probe)
  }
}
```

### Recommendation response builder

The hook's stale-response guard drops responses whose `submissionFingerprint` doesn't match the fingerprint of the in-flight request. The test helper builds a `ready` response keyed on whatever fingerprint the hook just emitted (read from the `sendMessage` mock's last call):

```ts
function buildReadyRecommendation(
  fingerprint: string,
): RecommendLeetCodeAssessmentResponse {
  return {
    status: 'ready',
    submissionFingerprint: fingerprint,
    recommendation: {
      recommendedRating: 'hard',
      confidence: 'medium',
      summary: AI_PROBE_SUMMARY,
      primaryReason: AI_PROBE_PRIMARY_REASON,
      evidence: [AI_PROBE_EVIDENCE],
      complexity: { time: 'O(n)', space: 'O(n)', confidence: 'medium' },
      improvementPoints: [AI_PROBE_IMPROVEMENT],
      edgeCaseNotes: [AI_PROBE_EDGE_CASE],
      shouldUpdateRating: true,
      promptVersion: 'leetcode-assessment-v1',
    },
    providerMetadata: { provider: 'openai', model: 'gpt-test', durationMs: 100 },
  }
}
```

### `pumpReadyRecommendation` helper

Most tests share the same setup: render the session hook, drive a terminal submission, wait for the AI request to be sent, resolve it with a `ready` response carrying probes, wait for `aiRecommendation.status === 'ready'`. Centralizing this as a helper keeps each test focused on its assertion:

```ts
async function pumpReadyRecommendation(
  result: RenderHookResult<LeetCodeOverlaySession, unknown>['result'],
  submissionResult: LeetCodeSubmissionResult,
): Promise<void> {
  // Push the terminal LeetCode submission via the mocked page watcher
  // (the existing harness already wires this — see leetcodeMockState).

  await waitFor(() => {
    expect(sendMessage).toHaveBeenCalledWith(
      'genai.recommendLeetCodeAssessment',
      expect.objectContaining({ surface: 'content-script' }),
    )
  })

  const lastCall = sendMessage.mock.calls.findLast(
    ([name]) => name === 'genai.recommendLeetCodeAssessment',
  )
  const fingerprint = lastCall![1].submissionFingerprint as string

  // Resolve the pending promise. The existing test file already uses a
  // deferred-promise pattern; reuse it here.
  await act(async () => {
    deferredRecommendation.resolve(buildReadyRecommendation(fingerprint))
  })

  await waitFor(() => {
    expect(result.current.aiRecommendation.status).toBe('ready')
  })
}
```

The exact harness wiring (deferred promise vs. `mockResolvedValue` per call) follows whatever pattern the existing `use-leetcode-overlay-session.test.tsx` already uses. If the file doesn't already mock `sendMessage`, add a `vi.mock('@/extension/messaging', () => ({ sendMessage: vi.fn() }))` block at the top following the pattern in `use-leetcode-assessment-recommendation.test.tsx`.

## The five tests

| # | Test | Drives | Asserts |
|---|---|---|---|
| 1 | `restart clears the AI recommendation` | Pump ready → call `actions.restartLocalSession()` | `result.current.aiRecommendation.status === 'idle'` |
| 2 | `SPA navigation clears the AI recommendation` | Pump ready → fire `page-changed` from the mocked LeetCode watcher | `result.current.aiRecommendation.status === 'idle'` |
| 3 | `save payload excludes AI text` | Push accepted submission → pump ready → wait for `saveReviewResultViaRuntime` | `expectNoAiLeak(saveReviewResultViaRuntime.mock.calls[0][0])`; `log` keys ⊆ `overlayDraftFields` |
| 4 | `update payload excludes AI text` | Submit a review → pump ready → change rating to dirty → call `actions.updateReview()` | `expectNoAiLeak(overrideLastReviewResultViaRuntime.mock.calls[0][0])`; same key-subset check |
| 5 | `draft persistence payload excludes AI text` | Type a draft field to dirty → pump ready → call `actions.collapse()` (triggers `persistDraftIfNeeded`) | `expectNoAiLeak(updateCurrentPracticeLogViaRuntime.mock.calls[0][0])`; same key-subset check |

Tests 1 and 2 already have hook-level equivalents in `use-leetcode-assessment-recommendation.test.tsx`. Lifting them to the integration boundary protects against a future refactor of the parent composition (e.g., someone removing the `onRestart` thread or the slug-change effect dependency) silently breaking the contract.

### Key-subset assertion

```ts
function expectLogKeysAreOverlayDraft(payload: { log?: unknown }): void {
  if (payload.log == null) return // Some payloads may omit log entirely
  const logKeys = Object.keys(payload.log as Record<string, unknown>).sort()
  for (const key of logKeys) {
    expect(overlayDraftFields).toContain(key as OverlayDraftField)
  }
}
```

This protects against the future scenario where someone widens `OverlayDraftLog` to include an `aiNotes` field. Without this check, the JSON-probe check would pass (the AI text wouldn't be there — yet) but the schema invariant would have silently changed.

## Files

### Modified

| Path | Change |
|---|---|
| `src/features/overlay-session/hooks/use-leetcode-overlay-session.test.tsx` | Add 5 tests, the `AI_PROBE` constants, the `buildReadyRecommendation` helper, the `pumpReadyRecommendation` helper, and the two assertion helpers (`expectNoAiLeak`, `expectLogKeysAreOverlayDraft`). Add `sendMessage` mocking if not already present. |

### New

None.

## Testing

The PR's deliverable is tests. To validate:

```
npm run check
```

Expected: full suite (1330 + 5 new = 1335) passes. Typecheck and lint clean.

If any of tests 3–5 fail, that indicates a real AI-text leak. The fix would be a targeted change in the failing flow:
- For save/update: the call passes `log: toPracticeLogPatch(currentOverlay.draft)` — verify `currentOverlay.draft` doesn't somehow include AI text.
- For draft persistence: same.

My current read of the code is that no such leak exists.

## Acceptance-criteria coverage

| Criterion (from issue #9) | How it's satisfied |
|---|---|
| AI notes are view-only | Tests 3, 4, 5 prove the persistence payloads carry no probes. |
| No AI field is added to `review_attempts` for MVP | No schema migration in this PR. |
| No AI notes are exported/imported because they are not persisted | Falls out of tests 3, 4, 5 — backup/export reads from the persistence layer the tests cover. |
| Save, update, draft persistence payloads do not include AI text | Tests 3, 4, 5 directly. |
| Deleting/restarting/navigating the overlay clears AI details | Tests 1, 2 directly. |

## Non-goals

- **Adding an AI field to the practice log.** Out of scope and explicitly forbidden by the issue.
- **Schema-level changes to `OverlayDraftLog`.** None needed.
- **Backup/restore tests.** Backup/restore reads from the same persistence layer that tests 3–5 cover; a redundant backup-level test would not add safety.
- **TypeScript-level locks on `OverlayDraftLog`.** A runtime key-subset test (the `expectLogKeysAreOverlayDraft` helper) is stronger than a comment and simpler than a type assertion.
- **Documentation in `docs/architecture.md` or `design.md`.** The invariant is enforced by tests, not by prose; adding prose without enforcement is hopeful documentation that drifts.
