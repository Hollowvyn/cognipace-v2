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

*(populated in Task 2)*

## 4. Verification artifact

*(populated in Task 4)*

## 5. Non-goals reconfirmed

*(populated in Task 5)*

## 6. Gaps closed in this PR

*(populated in Task 5)*
