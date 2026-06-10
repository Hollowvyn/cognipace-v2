# Session-Only AI Notes Guardrails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add five integration tests in `use-leetcode-overlay-session.test.tsx` that lock in the invariant: AI recommendation text never leaks into `saveReviewResult`, `overrideLastReviewResult`, or `updateCurrentPracticeLog` payloads, and the async `aiRecommendation` state is cleared on restart and SPA navigation.

**Architecture:** Tests-only PR. Each test mocks the AI runtime to return a `ready` response containing distinctive probe strings, drives the corresponding overlay flow, then asserts the captured persistence payload contains none of the probes and that its `log` keys are a subset of the documented `OverlayDraftLog` fields.

**Tech Stack:** Vitest + Testing Library + `renderHook` against the existing harness in `use-leetcode-overlay-session.test.tsx`.

**Spec:** `docs/superpowers/specs/2026-06-09-session-only-ai-notes-guardrails-design.md`

**Branch:** `issue-9` (already created off latest `main`; the design doc commit `9becbfd` is its first commit).

**Important architectural notes (verified against current main):**
- Two AI invocations fire on a terminal LeetCode submission:
  1. The async hook `useLeetCodeAssessmentRecommendation` (issue #7) calls `sendMessage('genai.recommendLeetCodeAssessment', …)` directly — its response populates `session.aiRecommendation`.
  2. The save-flow path in `useOverlayReviewActions.saveAcceptedReview → maybeApplyAiRecommendation` calls `recommendLeetCodeAssessmentViaRuntime` — its response can override the saved rating when `shouldUpdateRating: true`.
- The test file already mocks `recommendLeetCodeAssessmentViaRuntime` (covering invocation 2) but NOT `sendMessage` (so invocation 1 currently rejects silently — the hook gracefully degrades to `error` state).
- Task 1 adds a `sendMessage` mock so the async hook can be driven to `ready`. The default rejection-shaped response is preserved so existing tests are unaffected.

---

## File map

**Modified**

| Path | Change |
|---|---|
| `src/features/overlay-session/hooks/use-leetcode-overlay-session.test.tsx` | Add `sendMessage` mock with safe default; add `AI_PROBE_*` constants; add `buildReadyAssessmentResponse`, `setSendMessageRecommendationReady`, `expectNoAiLeak`, `expectLogKeysAreOverlayDraft` helpers; add 5 new tests inside the existing `describe('useLeetCodeOverlaySession', …)` block. |

**New:** none.
**No production code changes** unless one of the tests surfaces a real leak; see Task 7 for the fix-on-leak escape hatch.

---

## Task 1: Add test infrastructure

**Files:**
- Modify: `src/features/overlay-session/hooks/use-leetcode-overlay-session.test.tsx`

The test file needs:
1. A `sendMessage` mock so the async `useLeetCodeAssessmentRecommendation` hook can be driven to `ready` from this integration test (currently it silently rejects).
2. Probe constants and helpers shared by all five new tests.

This task does NOT add any new test cases. It adds the infrastructure and confirms the existing 1330-test suite remains green.

- [ ] **Step 1: Add the `sendMessage` mock with a safe default**

Open `src/features/overlay-session/hooks/use-leetcode-overlay-session.test.tsx`.

Just below the existing `vi.mock('wxt/browser', …)` block (search for `vi.mock('wxt/browser'`), insert a new mock block. Place it AHEAD of the other feature mocks so the messaging mock applies before any feature uses it:

```tsx
vi.mock('@/extension/messaging', () => ({
  sendMessage: vi.fn(),
}))
```

Then add an import for `sendMessage` at the top of the file, grouped with the existing feature imports (alphabetical order within the group; place it adjacent to other `@/extension` imports if any, otherwise above `@/features/app-shell`):

```tsx
import { sendMessage } from '@/extension/messaging'
```

- [ ] **Step 2: Add the AI probe constants at module scope**

Just above the `describe('useLeetCodeOverlaySession', …)` block (search for `describe('useLeetCodeOverlaySession'`), add:

```tsx
const AI_PROBE_SUMMARY = '__AI_PROBE_summary__'
const AI_PROBE_PRIMARY_REASON = '__AI_PROBE_primary_reason__'
const AI_PROBE_EVIDENCE = '__AI_PROBE_evidence_item__'
const AI_PROBE_IMPROVEMENT = '__AI_PROBE_improvement_point__'
const AI_PROBE_EDGE_CASE = '__AI_PROBE_edge_case_note__'
const AI_PROBES = [
  AI_PROBE_SUMMARY,
  AI_PROBE_PRIMARY_REASON,
  AI_PROBE_EVIDENCE,
  AI_PROBE_IMPROVEMENT,
  AI_PROBE_EDGE_CASE,
] as const
```

- [ ] **Step 3: Add the helper functions at the end of the file**

Append, after the last existing helper (`createDeferred` is the bottom helper per the file map), the following helpers:

```tsx
function buildReadyAssessmentResponse(fingerprint: string) {
  return {
    status: 'ready' as const,
    submissionFingerprint: fingerprint,
    recommendation: {
      recommendedRating: 'hard' as const,
      confidence: 'medium' as const,
      summary: AI_PROBE_SUMMARY,
      primaryReason: AI_PROBE_PRIMARY_REASON,
      evidence: [AI_PROBE_EVIDENCE] as const,
      complexity: {
        time: 'O(n)',
        space: 'O(n)',
        confidence: 'medium' as const,
      },
      improvementPoints: [AI_PROBE_IMPROVEMENT] as const,
      edgeCaseNotes: [AI_PROBE_EDGE_CASE] as const,
      shouldUpdateRating: true,
      promptVersion: 'leetcode-assessment-v1' as const,
    },
    providerMetadata: {
      provider: 'openai' as const,
      model: 'gpt-test',
      durationMs: 100,
    },
  }
}

function setSendMessageRecommendationReady(): void {
  vi.mocked(sendMessage).mockImplementation((name: string, request?: unknown) => {
    if (name === 'genai.recommendLeetCodeAssessment') {
      const fingerprint =
        (request as { submissionFingerprint?: string } | undefined)
          ?.submissionFingerprint ?? 'unknown'
      return Promise.resolve(buildReadyAssessmentResponse(fingerprint))
    }
    return Promise.reject(
      new Error(`Unexpected sendMessage call in test: ${name}`),
    )
  })
}

function expectNoAiLeak(payload: unknown): void {
  const serialized = JSON.stringify(payload)
  for (const probe of AI_PROBES) {
    expect(serialized).not.toContain(probe)
  }
}

function expectLogKeysAreOverlayDraft(payload: { log?: unknown }): void {
  if (payload.log == null) {
    return
  }
  const allowedKeys = [
    'interviewPattern',
    'timeComplexity',
    'spaceComplexity',
    'languages',
    'notes',
  ]
  const logKeys = Object.keys(payload.log as Record<string, unknown>)
  for (const key of logKeys) {
    expect(allowedKeys).toContain(key)
  }
}
```

`as const` annotations and the hard-coded `allowedKeys` list keep the helpers self-contained — no imports needed for `OverlayDraftLog` keys.

- [ ] **Step 4: Set the default `sendMessage` resolution in `beforeEach`**

Find the existing `beforeEach(() => { … })` block (search for `beforeEach(() => {`). At the bottom of the block (after the existing `vi.mocked(recommendLeetCodeAssessmentViaRuntime).mockResolvedValue(...)` line), add:

```tsx
    vi.mocked(sendMessage).mockResolvedValue({
      status: 'unavailable',
      message: 'AI assessment is not configured (test default).',
      submissionFingerprint: 'fallback',
    })
```

This ensures that any test that doesn't explicitly call `setSendMessageRecommendationReady()` sees a benign `unavailable` response (matching the existing default for the save-flow's `recommendLeetCodeAssessmentViaRuntime`). The async hook will go to `aiRecommendation: { status: 'unavailable', … }` rather than crashing.

- [ ] **Step 5: Run the existing test suite to confirm no regressions**

Run:

```
cd "/Users/ernest-opara/Development/AI Bombing/cognipace/cognipace-v2" && npx vitest run src/features/overlay-session/hooks/use-leetcode-overlay-session.test.tsx 2>&1 | tail -10
```

Expected: all existing tests in this file pass (the count depends on the current main, roughly 25–35 tests). The infrastructure added in steps 1–4 should not change observable behavior of existing tests.

If any test fails, the most likely cause is the global `sendMessage` mock interfering with a transitive call that wasn't previously mocked. Diagnose by running the single failing test in isolation:

```
npx vitest run src/features/overlay-session/hooks/use-leetcode-overlay-session.test.tsx -t "<failing test name>" --reporter=verbose
```

The fix is to broaden the default mock to handle whatever message name the failing test triggers (add another `if (name === '…')` branch in the `mockImplementation` OR widen the default `mockResolvedValue` to a generic ok shape). Stop and ask for guidance before making non-trivial changes.

- [ ] **Step 6: Commit**

```
git add src/features/overlay-session/hooks/use-leetcode-overlay-session.test.tsx
git commit -m "test: scaffold AI-leak probe infrastructure for overlay session (#9)"
```

---

## Task 2: Test 1 — Restart clears the AI recommendation

**Files:**
- Modify: `src/features/overlay-session/hooks/use-leetcode-overlay-session.test.tsx`

The async `useLeetCodeAssessmentRecommendation` hook's slug-change effect AND its `reset()` callback (wired via `onRestart` in `useLeetCodeOverlaySession`) should clear `aiRecommendation` back to `idle` when the user restarts the overlay. This test pumps it to `ready`, calls `actions.restartLocalSession()`, and asserts the state went back to `idle`.

- [ ] **Step 1: Write the test**

Append the test inside the existing `describe('useLeetCodeOverlaySession', …)` block, immediately after the last existing test (search for the last `it(…)` block, then add right before the closing `})` of `describe`):

```tsx
  it('clears the AI recommendation when the overlay restart action runs', async () => {
    setSendMessageRecommendationReady()
    const { result } = await renderReadySession({
      aiAssessmentAvailable: true,
      autoDetectSolved: true,
    })

    emitSubmissionResult()

    await waitFor(() => {
      expect(result.current.aiRecommendation.status).toBe('ready')
    })

    await runOverlayAction(async () => {
      result.current.actions.restartLocalSession()
    })

    expect(result.current.aiRecommendation.status).toBe('idle')
  })
```

- [ ] **Step 2: Run the test**

```
cd "/Users/ernest-opara/Development/AI Bombing/cognipace/cognipace-v2" && npx vitest run src/features/overlay-session/hooks/use-leetcode-overlay-session.test.tsx -t "clears the AI recommendation when the overlay restart action runs" 2>&1 | tail -15
```

Expected: PASS. The architecture already wires `recommendation.reset` into `useOverlayReviewActions.restartLocalSession` via `onRestart`, and `reset()` aborts in-flight and sets state to `idle`.

If the test FAILS, the architecture has regressed since #7 was implemented. Diagnose:
- Read `src/features/overlay-session/hooks/use-leetcode-overlay-session.ts` and confirm the `onRestart` thread is intact (search for `recommendationResetRef`).
- Read `src/features/overlay-session/hooks/use-overlay-review-actions.ts` and confirm `restartLocalSession` calls `onRestart?.()`.

If a regression is found, escalate — fixing it is outside this task's scope and likely needs its own follow-up.

- [ ] **Step 3: Commit**

```
git add src/features/overlay-session/hooks/use-leetcode-overlay-session.test.tsx
git commit -m "test: assert restart clears the AI recommendation (#9)"
```

---

## Task 3: Test 2 — SPA navigation clears the AI recommendation

**Files:**
- Modify: `src/features/overlay-session/hooks/use-leetcode-overlay-session.test.tsx`

When the user navigates to a different LeetCode problem (an SPA `page-changed` event), `activeProblemSlug` changes, and the async hook's slug-change effect resets `aiRecommendation` to `idle`. This test pumps to `ready`, fires `page-changed` via the mocked watcher, and asserts the reset.

- [ ] **Step 1: Write the test**

Append immediately after the Task 2 test:

```tsx
  it('clears the AI recommendation when the LeetCode page changes', async () => {
    setSendMessageRecommendationReady()
    const { result } = await renderReadySession({
      aiAssessmentAvailable: true,
      autoDetectSolved: true,
    })

    emitSubmissionResult()

    await waitFor(() => {
      expect(result.current.aiRecommendation.status).toBe('ready')
    })

    emitNextPage()

    await waitFor(() => {
      expect(result.current.aiRecommendation.status).toBe('idle')
    })
  })
```

- [ ] **Step 2: Run the test**

```
cd "/Users/ernest-opara/Development/AI Bombing/cognipace/cognipace-v2" && npx vitest run src/features/overlay-session/hooks/use-leetcode-overlay-session.test.tsx -t "clears the AI recommendation when the LeetCode page changes" 2>&1 | tail -15
```

Expected: PASS. The hook's `useEffect`-based slug-change reset (and the `useState` prev-slug pattern in #7) drives this.

If FAIL, same diagnostic flow as Task 2 step 2.

- [ ] **Step 3: Commit**

```
git add src/features/overlay-session/hooks/use-leetcode-overlay-session.test.tsx
git commit -m "test: assert SPA navigation clears the AI recommendation (#9)"
```

---

## Task 4: Test 3 — Save payload excludes AI text

**Files:**
- Modify: `src/features/overlay-session/hooks/use-leetcode-overlay-session.test.tsx`

When the user triggers a save (manually via `submitReview` or via the auto-save path on a terminal LeetCode submission), the payload passed to `saveReviewResultViaRuntime` must not contain any AI-authored text, and its `log` field must contain only the documented `OverlayDraftLog` keys.

This test enables AI, pumps the recommendation to `ready` carrying probe strings, drives the auto-save path, and asserts the captured save payload is probe-free.

- [ ] **Step 1: Write the test**

Append immediately after the Task 3 test:

```tsx
  it('excludes AI-authored text from the save review payload', async () => {
    setSendMessageRecommendationReady()
    const { result } = await renderReadySession({
      aiAssessmentAvailable: true,
      autoDetectSolved: true,
    })

    emitSubmissionResult()

    await waitFor(() => {
      expect(result.current.aiRecommendation.status).toBe('ready')
    })

    await waitFor(() => {
      expect(saveReviewResultViaRuntime).toHaveBeenCalled()
    })

    const payload = latestSavedReviewRequest()
    expectNoAiLeak(payload)
    expectLogKeysAreOverlayDraft(payload)
  })
```

- [ ] **Step 2: Run the test**

```
cd "/Users/ernest-opara/Development/AI Bombing/cognipace/cognipace-v2" && npx vitest run src/features/overlay-session/hooks/use-leetcode-overlay-session.test.tsx -t "excludes AI-authored text from the save review payload" 2>&1 | tail -15
```

Expected: PASS. `saveAcceptedReview` builds `log: toPracticeLogPatch(currentOverlay.draft)`, and `toPracticeLogPatch` emits exactly the five `OverlayDraftLog` fields from the user-typed draft.

If FAIL: a real AI-text leak exists. Stop and report — the fix likely lives in `saveAcceptedReview` (`src/features/overlay-session/hooks/use-overlay-review-actions.ts`) or `toPracticeLogPatch` (`src/features/overlay-session/domain/overlay-draft.ts`). Trace which probe appears in the payload (`expectNoAiLeak` will fail on the matching probe) to localize the leak source.

- [ ] **Step 3: Commit**

```
git add src/features/overlay-session/hooks/use-leetcode-overlay-session.test.tsx
git commit -m "test: assert save payload excludes AI text (#9)"
```

---

## Task 5: Test 4 — Update payload excludes AI text

**Files:**
- Modify: `src/features/overlay-session/hooks/use-leetcode-overlay-session.test.tsx`

The `updateReview` path (`overrideLastReviewResultViaRuntime`) fires when a user updates an already-submitted review. This test exercises the same submit-then-update flow used by the existing `'updates the latest submitted review instead of appending another attempt'` test, but with AI enabled and probes flowing through.

- [ ] **Step 1: Write the test**

Append immediately after the Task 4 test:

```tsx
  it('excludes AI-authored text from the update review payload', async () => {
    setSendMessageRecommendationReady()
    const { result } = await renderReadySession({
      aiAssessmentAvailable: true,
    })

    await runOverlayAction(result.current.actions.submitReview)
    act(() => {
      result.current.actions.selectRating('hard')
    })
    act(() => {
      result.current.draft.setField('notes', 'User-typed note.')
    })
    await runOverlayAction(result.current.actions.updateReview)

    expect(overrideLastReviewResultViaRuntime).toHaveBeenCalled()
    const payload = vi.mocked(overrideLastReviewResultViaRuntime).mock.calls.at(
      -1,
    )?.[0]
    if (!payload) {
      throw new Error('Expected an override review request.')
    }
    expectNoAiLeak(payload)
    expectLogKeysAreOverlayDraft(payload)
  })
```

- [ ] **Step 2: Run the test**

```
cd "/Users/ernest-opara/Development/AI Bombing/cognipace/cognipace-v2" && npx vitest run src/features/overlay-session/hooks/use-leetcode-overlay-session.test.tsx -t "excludes AI-authored text from the update review payload" 2>&1 | tail -15
```

Expected: PASS. `updateReview` uses the same `toPracticeLogPatch(currentOverlay.draft)` pattern.

If FAIL: trace the failing probe; the leak source is the same neighborhood as Task 4.

- [ ] **Step 3: Commit**

```
git add src/features/overlay-session/hooks/use-leetcode-overlay-session.test.tsx
git commit -m "test: assert update payload excludes AI text (#9)"
```

---

## Task 6: Test 5 — Draft persistence payload excludes AI text

**Files:**
- Modify: `src/features/overlay-session/hooks/use-leetcode-overlay-session.test.tsx`

`persistDraftIfNeeded` fires on `collapse` and `dock` when the draft has unpersisted changes; it calls `updateCurrentPracticeLogViaRuntime` with `log: toPracticeLogPatch(currentOverlay.draft)`. This test enables AI, marks the draft dirty, pumps the recommendation to `ready`, then collapses the overlay to trigger the draft persistence.

- [ ] **Step 1: Write the test**

Append immediately after the Task 5 test:

```tsx
  it('excludes AI-authored text from the draft persistence payload', async () => {
    setSendMessageRecommendationReady()
    const { result } = await renderReadySession({
      aiAssessmentAvailable: true,
      autoDetectSolved: true,
    })

    emitSubmissionResult()

    await waitFor(() => {
      expect(result.current.aiRecommendation.status).toBe('ready')
    })

    // Restart the session so we're back in draft mode (auto-save already
    // submitted the result; persistDraftIfNeeded only fires when there's no
    // submittedSession AND the draft has unpersisted changes).
    act(() => {
      result.current.actions.restartLocalSession()
    })

    act(() => {
      result.current.draft.setField('notes', 'Carry this draft.')
    })
    act(() => {
      result.current.actions.collapse()
    })

    await waitFor(() => {
      expect(updateCurrentPracticeLogViaRuntime).toHaveBeenCalled()
    })

    const payload = latestPracticeLogUpdateRequest()
    expectNoAiLeak(payload)
    expectLogKeysAreOverlayDraft(payload)
  })
```

- [ ] **Step 2: Run the test**

```
cd "/Users/ernest-opara/Development/AI Bombing/cognipace/cognipace-v2" && npx vitest run src/features/overlay-session/hooks/use-leetcode-overlay-session.test.tsx -t "excludes AI-authored text from the draft persistence payload" 2>&1 | tail -15
```

Expected: PASS. `persistDraftIfNeeded` also uses `toPracticeLogPatch(currentOverlay.draft)`.

Possible flake watch: the restart between auto-save and the second submission needs `updateCurrentPracticeLogViaRuntime` to be reset between calls. The `vi.clearAllMocks()` in `beforeEach` only runs once per test, not within a single test's lifecycle. The captured payload via `latestPracticeLogUpdateRequest()` returns the LATEST call — which is the draft persistence call after the restart, exactly what we want.

If FAIL: same diagnostic flow.

- [ ] **Step 3: Commit**

```
git add src/features/overlay-session/hooks/use-leetcode-overlay-session.test.tsx
git commit -m "test: assert draft persistence payload excludes AI text (#9)"
```

---

## Task 7: Final verification, push, and PR

**Files:** none.

- [ ] **Step 1: Run the full check**

```
cd "/Users/ernest-opara/Development/AI Bombing/cognipace/cognipace-v2" && npm run check 2>&1 | tail -15
```

Expected: all stages PASS. Test count should be 1330 + 5 = 1335.

If lint or typecheck flags anything in the new helpers (e.g., `@typescript-eslint/no-unsafe-argument` on the `request as { submissionFingerprint?: string }` cast in `setSendMessageRecommendationReady`), fix it and re-run.

- [ ] **Step 2: Push the branch and open the PR**

```
git push -u origin issue-9
```

Then open a PR using the repo's PR template (the one enforced on PRs #74 and #75 — `## Details`, `## Issue`, `## Testing`, `## Screenshots`). Use this body:

```
## Details

Lock in the invariant that AI recommendation text never leaks into the persistence layer. The architecture established by #7 and #8 already keeps AI state out of the database (saves/updates/draft persistence all build their `log` argument from `toPracticeLogPatch(currentOverlay.draft)`, which emits only the five `OverlayDraftLog` fields). This PR adds five integration tests in `use-leetcode-overlay-session.test.tsx` that drive the live hook with mocked runtime calls, pump the async `useLeetCodeAssessmentRecommendation` to `ready` with distinctive probe strings, then assert the captured persistence payloads carry zero AI text.

- Test 1 (`restart clears the AI recommendation`) and Test 2 (`SPA navigation clears the AI recommendation`) lift the existing hook-level reset coverage to the session boundary.
- Tests 3–5 assert that `saveReviewResultViaRuntime`, `overrideLastReviewResultViaRuntime`, and `updateCurrentPracticeLogViaRuntime` payloads contain neither the AI probe strings nor any keys outside `OverlayDraftLog` (`interviewPattern`, `timeComplexity`, `spaceComplexity`, `languages`, `notes`).
- No production code changes. The architecture was correct; this PR makes the contract testable against future refactors.

The test scaffolding also adds a `sendMessage` mock to the file so the async recommendation hook can be driven to `ready` from the integration test. The mock defaults to an `unavailable` response so existing tests are unaffected.

## Issue

Closes #9

## Testing

- [x] `npm run check` passed
  - db check
  - typecheck
  - lint
  - tests (1335 / 1335 — 5 new)
- [x] `npm run build` passed, or N/A: Not run locally; build is exercised by CI on every PR.
- [x] `npm run zip` passed, or N/A: N/A — zip only repackages build output; no packaging-relevant change.
- [x] Added/updated needed tests: integration (5 new tests in `use-leetcode-overlay-session.test.tsx`).
- [x] Manual smoke tested: N/A — this PR adds tests around an invariant that is already correct. There is no observable behavior change to smoke. The tests themselves are the verification surface.
- [x] Skipped validation: None

## Screenshots

N/A — no UI change.
```

---

## Self-review

**1. Spec coverage:**

| Spec requirement | Task |
|---|---|
| Probe constants + `expectNoAiLeak` + `expectLogKeysAreOverlayDraft` helpers | Task 1 |
| `buildReadyAssessmentResponse` + sendMessage mock infrastructure | Task 1 |
| Test 1 (restart clears) | Task 2 |
| Test 2 (navigation clears) | Task 3 |
| Test 3 (save payload exclusion) | Task 4 |
| Test 4 (update payload exclusion) | Task 5 |
| Test 5 (draft persistence exclusion) | Task 6 |
| `npm run check` + push + PR | Task 7 |

**2. Placeholder scan:** None — every step is either a literal code block, an exact shell command, or a concrete edit instruction. The fix-on-leak escape hatches in Tasks 4–6 reference specific files to inspect (not vague "investigate").

**3. Type consistency:** `AI_PROBES`, `AI_PROBE_*`, `buildReadyAssessmentResponse`, `setSendMessageRecommendationReady`, `expectNoAiLeak`, `expectLogKeysAreOverlayDraft` are spelled identically across Tasks 1–6. The `OverlayDraftLog` key set used in `expectLogKeysAreOverlayDraft` (`interviewPattern`, `timeComplexity`, `spaceComplexity`, `languages`, `notes`) matches the actual field list in `src/features/overlay-session/domain/overlay-draft.ts`.

**4. Spec gap:** The acceptance criterion "No AI notes are exported/imported because they are not persisted" is indirect — backup/export reads from the same persistence layer that Tests 3–5 cover, so it falls out by transitivity. No separate task needed (this matches the spec's explicit non-goal).
