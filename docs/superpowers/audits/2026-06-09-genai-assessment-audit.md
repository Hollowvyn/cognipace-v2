# GenAI Assessment End-to-End Audit

**Issue:** [#10](https://github.com/Hollowvyn/cognipace-v2/issues/10) — Run end-to-end test and architecture audit for GenAI assessment

**Date:** 2026-06-09

**Delivering PRs:**
- #1 (deterministic assessment policy) — merged
- #2 (review session context) — merged
- #3 (GenAI provider network layer) — merged
- #4 (AI settings and secret handling) — merged
- #5 (LeetCode review assistant prompt and schema) — merged
- #6 (Runtime endpoint) — merged
- #7 (Overlay recommendation hook) — PR [#74](https://github.com/Hollowvyn/cognipace-v2/pull/74)
- #8 (Recommendation component) — PR [#75](https://github.com/Hollowvyn/cognipace-v2/pull/75)
- #9 (Session-only AI notes guardrails) — PR [#77](https://github.com/Hollowvyn/cognipace-v2/pull/77)

## 1. Scope

This audit answers two questions:

1. **Coverage:** does every acceptance criterion from issue #10 have existing test coverage, or is there a real gap?
2. **Architecture:** does the implementation satisfy every item in the nine-point architecture-audit checklist?

The audit is evidence-backed: each finding cites the command (and its output) that produced it, so a future contributor can re-run the same checks and verify the audit has not regressed.

## 2. Coverage matrix

| Acceptance criterion (issue #10) | Covering test files | Status |
|---|---|---|
| `features/assessment` has pure domain tests | `src/features/assessment/domain/assessment.test.ts`, `derived.test.ts`, `rules/{hard-locks,warnings,base-rating,confidence,easy-gate}.test.ts` (7 files) | ✅ covered |
| `features/genai` has mocked provider tests | `src/features/genai/server/{genai-service,genai-settings-service,genai-secret-storage,json-schema}.test.ts`, `api/genai-settings-{hooks,contracts}.test.tsx`, `domain/genai-{types,secrets-types}.test.ts` (8 files) | ✅ covered |
| `features/leetcode-review-assistant` has prompt, schema, normalizer tests | `src/features/leetcode-review-assistant/server/{build-assessment-prompt,recommendation-normalizer,recommendation-service,runtime-handler-service}.test.ts`, `api/runtime-contracts.test.ts` (5 files) | ✅ covered |
| `features/overlay-session` has hook and component tests | `src/features/overlay-session/hooks/{use-leetcode-assessment-recommendation,use-leetcode-overlay-session,use-overlay-timer,submission-result-key}.test.*`, `domain/{overlay-session-state,session-context}.test.ts`, `components/{overlay-shell,modes/expanded/{expanded-overlay,overlay-assessment-recommendation}}.test.tsx` (9+ files) | ✅ covered |
| Runtime policy tests cover the new GenAI endpoint | `src/extension/background/runtime-policy.test.ts` — see Section 3, item Runtime Policy | ✅ covered (after this PR closes the gap) |
| App-shell tests prove AI secrets are redacted | `src/features/app-shell/server/app-shell-service.test.ts` lines 519–566 (three `not.toContain('apiKey')` assertions) | ✅ covered |
| Existing overlay automation tests still pass | Covered by `npm run check`; see Section 4 | ✅ covered |

## 3. Architecture audit

Each item below records the verification command, its output, and the conclusion. Re-running the command should reproduce the same result; a future change that introduces a violation will show as a non-empty grep where one was previously empty.

### Item 1 — No provider calls in React components

**Command:**
```
grep -rn "openai\.com\|anthropic\.com\|googleapis\.com\|generativelanguage\.googleapis" \
  src/app src/features/*/components src/features/*/hooks src/features/*/api \
  | grep -v ".test."
```

**Output:**
```
(no output)
```

**Conclusion:** ✅ holds — no provider URLs appear in React components, hooks, or API modules.

### Item 2 — No provider calls in content script outside runtime messaging

**Command:**
```
grep -rn "fetch(" src/app/overlay src/features/overlay-session src/lib/leetcode | grep -v ".test."
```

**Output:**
```
(no output)
```

**Acceptable matches:** Any `fetch()` here must be a non-AI fetch (e.g., LeetCode page reads). Cite each match individually and confirm it doesn't target a provider URL.

**Conclusion:** ✅ holds — no `fetch()` calls exist in the overlay or LeetCode lib paths; all network calls go through runtime messaging.

### Item 3 — No AI writes outside existing practice mutations

**Command:**
```
grep -rn "saveReviewResult\|overrideLastReviewResult\|updateCurrentPracticeLog" \
  src/features/genai src/features/leetcode-review-assistant | grep -v ".test."
```

**Output:**
```
(no output)
```

**Conclusion:** ✅ holds — GenAI and review-assistant code never calls the practice persistence mutations directly.

### Item 4 — No API keys in app-shell payloads

**Command:**
```
grep -n "apiKey" src/features/app-shell/server/app-shell-service.test.ts | head -10
```

**Output:**
```
519:    await setAiProviderSecret(handle.db, 'openai', { apiKey: 'sk-must-not-leak' })
524:  it('overlay payload never contains apiKey or the literal key string', async () => {
529:    await setAiProviderSecret(handle.db, 'openai', { apiKey: 'sk-must-not-leak' })
532:    expect(serialized).not.toContain('apiKey')
536:  it('popup payload exposes safe aiAssessment fields but no apiKey', async () => {
541:    await setAiProviderSecret(handle.db, 'anthropic', { apiKey: 'sk-ant-must-not-leak' })
549:    expect(serialized).not.toContain('apiKey')
553:  it('dashboard payload exposes safe aiAssessment fields but no apiKey', async () => {
558:    await setAiProviderSecret(handle.db, 'gemini', { apiKey: 'g-must-not-leak' })
566:    expect(serialized).not.toContain('apiKey')
```

**Conclusion:** The three `not.toContain('apiKey')` assertions (overlay/popup/dashboard payloads) pin down the redaction contract. ✅ holds.

### Item 5 — No AI output persisted unless future ticket

**Command:**
```
grep -rn "ai_text\|ai_notes\|ai_recommendation\|aiText\|aiNotes" src/platform/db
```

**Output:**
```
(no output)
```

**Supporting evidence:** The five integration tests added in PR #77 (`expectNoAiLeak` on save/update/draft payloads) pin down that no AI text reaches the runtime persistence calls.

**Conclusion:** ✅ holds — no AI-output column names exist in the db platform layer; AI content is session-only.

### Item 6 — No FSRS scheduling logic in GenAI code

**Command:**
```
grep -rn "fsrs\|stability\|interval\|nextDueDate\|scheduleReview" \
  src/features/genai src/features/leetcode-review-assistant | grep -v ".test."
```

**Output:**
```
(no output)
```

**Acceptable matches:** Imports of `ReviewRating` (a domain type) or string tokens for prompt content are not scheduling logic. Cite each match.

**Conclusion:** ✅ holds — no FSRS scheduling terms appear in GenAI or review-assistant production code.

### Item 7 — No LeetCode DOM reads in GenAI code

**Command:**
```
grep -rn "document\.\|querySelector\|getElementBy\|innerHTML\|outerHTML" \
  src/features/genai src/features/leetcode-review-assistant | grep -v ".test."
```

**Output:**
```
(no output)
```

**Conclusion:** ✅ holds — GenAI and review-assistant features contain no direct DOM access; page data is passed in as structured arguments.

### Item 8 — No provider-specific types leak into overlay or assessment

**Command:**
```
grep -rn "ChatCompletion\|MessagesCreate\|GenerateContent\|openai\.\|anthropic\." \
  src/features/overlay-session src/features/assessment | grep -v ".test."
```

**Output:**
```
(no output)
```

**Acceptable matches:** `GenAiProviderId` enum literals (e.g., `'openai'`, `'anthropic'`) are NOT provider-specific SDK types — they are configuration tokens. Cite each match and confirm it falls in this category.

**Conclusion:** ✅ holds — no provider SDK types, namespaced method calls, or response-shape imports appear in overlay-session or assessment code.

### Item 9 — No broad global state introduced for session-local recommendation state

**Command:**
```
grep -rn "createContext\|atom(" \
  src/features/genai src/features/leetcode-review-assistant src/features/overlay-session \
  | grep -v ".test."
```

**Output:**
```
(no output)
```

**Supporting evidence:** `aiRecommendation` lives only on the `LeetCodeOverlaySession` return value (PR #74) and is populated by `useState` inside `useLeetCodeAssessmentRecommendation` — no module-level singletons, no React context, no Zustand store.

**Conclusion:** ✅ holds — no React context creation or Zustand atoms exist in the three GenAI-adjacent feature directories.

### Runtime policy coverage (separate but related)

The previous coverage matrix flagged this as "verify". Verification:

**Command:**
```
grep -n "genai\." src/extension/background/runtime-policy.ts
grep -n "genai\." src/extension/background/runtime-policy.test.ts
```

**Output:**
```
13:  'genai.getAiProviderSecretPresence': ['popup', 'dashboard'],
14:  'genai.setAiProviderSecret': ['popup', 'dashboard'],
15:  'genai.clearAiProviderSecret': ['popup', 'dashboard'],
16:  'genai.recommendLeetCodeAssessment': ['content-script'],
---
283:        'genai.getAiProviderSecretPresence',
284:        'genai.setAiProviderSecret',
285:        'genai.clearAiProviderSecret',
294:        'genai.getAiProviderSecretPresence',
295:        'genai.setAiProviderSecret',
296:        'genai.clearAiProviderSecret',
```

**Finding:** `runtime-policy.ts:16` registers `'genai.recommendLeetCodeAssessment': ['content-script']`, but the test file enumerates only the three secret endpoints. This PR closes the gap in Section 6.

## 4. Verification artifact

*(populated in Task 4)*

## 5. Non-goals reconfirmed

*(populated in Task 5)*

## 6. Gaps closed in this PR

*(populated in Task 5)*
