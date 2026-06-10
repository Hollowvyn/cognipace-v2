# GenAI Assessment End-to-End Audit — Design

**Issue:** [#10](https://github.com/Hollowvyn/cognipace-v2/issues/10) — Run end-to-end test and architecture audit for GenAI assessment

**Depends on:** #1–#9 — all merged or open as PRs (#74, #75, #77).

**Unblocks:** Release readiness for the GenAI assessment batch.

## Goal

Produce a permanent, evidence-backed audit confirming that the GenAI assessment feature (issues #1–#9) preserves the project's Bulletproof React boundaries and the practice-persistence contract. The audit answers two questions:

1. **Coverage:** does every acceptance criterion from issue #10 have existing test coverage, or is there a real gap?
2. **Architecture:** does the implementation satisfy every item in the nine-point architecture-audit checklist?

This PR does not add features. The deliverable is an audit report. If the audit surfaces a real gap, the PR closes it with one targeted regression test — otherwise it is documentation-only.

## Deliverable

A single Markdown file at `docs/superpowers/audits/2026-06-09-genai-assessment-audit.md` (new `audits/` subdirectory). The file is permanent reference material that future contributors consult before changing GenAI code, not a transient PR comment.

### Structure of the audit file

1. **Header** — issue link, scope statement, list of PRs delivering #1–#9.
2. **Coverage matrix** — the seven acceptance-criteria areas mapped to the existing test files that cover them, with file paths.
3. **Architecture audit** — each of the nine checklist items, with:
   - The item statement (verbatim from issue #10).
   - The verification command (a `grep`, a `find`, or a test name).
   - The command's output, captured in a fenced block.
   - The conclusion (✅ holds / ⚠️ partial / ❌ violated) and a one-paragraph interpretation.
4. **Verification artifact** — the tail output of the three required commands (`npm run test -- <paths>`, `npm run check`, `npm run build`), pasted in fenced blocks.
5. **Gaps closed in this PR** — empty if no gap surfaced; otherwise lists each gap and its remediation commit.

## Coverage matrix (pre-audit read)

| Acceptance criterion (issue #10) | Covering test files | Status |
|---|---|---|
| `features/assessment` has pure domain tests | `derived.test.ts`, `assessment.test.ts`, `rules/{hard-locks,warnings,base-rating,confidence,easy-gate}.test.ts` (7 files) | ✅ covered |
| `features/genai` has mocked provider tests | `server/{genai-service,genai-settings-service,genai-secret-storage,json-schema}.test.ts`, `api/genai-settings-{hooks,contracts}.test.tsx`, `domain/genai-{types,secrets-types}.test.ts` (8 files) | ✅ covered |
| `features/leetcode-review-assistant` has prompt, schema, normalizer tests | `server/{build-assessment-prompt,recommendation-normalizer,recommendation-service,runtime-handler-service}.test.ts`, `api/runtime-contracts.test.ts` (5 files) | ✅ covered |
| `features/overlay-session` has hook and component tests | `hooks/{use-leetcode-assessment-recommendation,use-leetcode-overlay-session,use-overlay-timer,submission-result-key}.test.*`, `domain/{overlay-session-state,session-context}.test.ts`, `components/{overlay-shell,modes/expanded/{expanded-overlay,overlay-assessment-recommendation}}.test.tsx` (9+ files) | ✅ covered |
| Runtime policy tests cover the new GenAI endpoint | `src/extension/background/runtime-policy.test.ts` — to verify in audit step | ⚠️ verify |
| App-shell tests prove AI secrets are redacted | `src/features/app-shell/server/app-shell-service.test.ts` lines 519–566 (three `not.toContain('apiKey')` assertions) | ✅ covered |
| Existing overlay automation tests still pass | Covered by `npm run check` | ✅ covered |

The only entry that is not pre-confirmed is runtime-policy coverage of the GenAI endpoint. The audit confirms with a `grep` of the test file. If the case is missing, the PR adds one targeted test in `src/extension/background/runtime-policy.test.ts`.

## Architecture audit — methodology

The audit runs each of the nine checklist items as a deterministic command, captures its output, and interprets the result. The methodology is publishable and reproducible: a future contributor can re-run the same commands and verify the audit's findings have not regressed.

| # | Item | Verification command |
|---|---|---|
| 1 | No provider calls in React components | `grep -rn "OpenAI\|Anthropic\|googleapis\.com\|openai\.com\|anthropic\.com\|generativelanguage" src/app src/features/*/components src/features/*/hooks src/features/*/api` — expect zero hits to provider URLs or SDK class names. Type-only imports of `GenAiProviderId` (the enum) are acceptable. |
| 2 | No provider calls in content script outside runtime messaging | `grep -rn "fetch(" src/app/overlay src/features/overlay-session src/lib/leetcode` — any hit must be a non-AI fetch (e.g., LeetCode page reads). The audit cites each hit and confirms none target a provider. |
| 3 | No AI writes outside existing practice mutations | `grep -rn "saveReviewResult\|overrideLastReviewResult\|updateCurrentPracticeLog" src/features/genai src/features/leetcode-review-assistant` — expect zero hits in non-test code. Persistence call sites remain owned by `useOverlayReviewActions`. |
| 4 | No API keys in app-shell payloads | Cite `src/features/app-shell/server/app-shell-service.test.ts:524,536,553` and the `app-shell-contracts.ts` schema, confirming no `apiKey` field on any surface payload. |
| 5 | No AI output persisted unless future ticket | Cite the five tests added in #9 (`expectNoAiLeak` on save/update/draft payloads). Plus `grep -rn "ai" src/platform/db/schema*.ts` (case-insensitive on field names) — expect no AI-named columns. |
| 6 | No FSRS scheduling logic in GenAI code | `grep -rn "fsrs\|stability\|interval\|nextDueDate\|scheduleReview" src/features/genai src/features/leetcode-review-assistant` — expect zero scheduling math. Read-only imports of `ReviewRating` (a domain type) are acceptable; the audit explicitly lists them. |
| 7 | No LeetCode DOM reads in GenAI code | `grep -rn "document\.\|querySelector\|getElementBy\|innerHTML\|outerHTML" src/features/genai src/features/leetcode-review-assistant` — expect zero hits. |
| 8 | No provider-specific types leak into overlay or assessment | `grep -rn "ChatCompletion\|MessagesCreate\|GenerateContent" src/features/overlay-session src/features/assessment` — expect zero hits to provider-SDK response types. `GenAiProviderId` (the enum) and `AssessmentRecommendation` (the prompt-version-stable contract) are acceptable. |
| 9 | No broad global state introduced for session-local recommendation state | `grep -rn "createContext\|create<.*>(.*)\|atom(" src/features/genai src/features/leetcode-review-assistant src/features/overlay-session` filtered to AI-recommendation state. `aiRecommendation` must live only on `LeetCodeOverlaySession` return + the hook's local `useState`. |

For items where the grep would produce expected hits (e.g., the policy file referencing `'genai.recommendLeetCodeAssessment'`), the audit cites each hit and explains why it does not constitute a violation.

## Required commands

The audit runs and records the output of:

```
npm run test -- src/features/assessment src/features/genai src/features/leetcode-review-assistant src/features/overlay-session src/extension
npm run check
npm run build
```

All three must pass. Their tail outputs (test counts, build summary) are pasted into the audit doc as evidence. If `npm run build` surfaces a problem that did not exist before (it is not exercised by `npm run check`), the audit reports it explicitly and the PR does not merge until it is resolved.

## Gap-closing policy

If the audit surfaces a real gap, the PR closes it with the smallest possible change:

- A missing runtime-policy case → one new test case in `runtime-policy.test.ts`.
- A missing app-shell redaction case → one new assertion in `app-shell-service.test.ts`.
- A missing leak-guardrail case → one new test in `use-leetcode-overlay-session.test.tsx` (mirroring #9's pattern).

The PR does NOT add architectural refactors, schema changes, or speculative tests. Anything beyond a one-line fix is out of scope for this audit and gets a follow-up issue.

## Files

| Path | Change |
|---|---|
| `docs/superpowers/audits/2026-06-09-genai-assessment-audit.md` | New audit document. |
| `src/extension/background/runtime-policy.test.ts` | Modified only if the audit surfaces a missing GenAI policy case. |
| `src/features/app-shell/server/app-shell-service.test.ts` | Modified only if the audit surfaces a missing redaction case. |
| `src/features/overlay-session/hooks/use-leetcode-overlay-session.test.tsx` | Modified only if the audit surfaces a missing leak guardrail. |

`docs/superpowers/audits/` does not exist yet; this PR creates it. Future audits land in the same directory.

## Non-goals

- **Schema migrations.** Out of scope; audit reports any drift but does not modify the DB.
- **New architectural patterns.** The audit confirms the existing patterns hold; it does not propose new ones.
- **Performance audit.** Out of scope.
- **Provider-coverage expansion.** Out of scope; the audit notes the supported providers from the existing config but does not add new ones.
- **Release ticket.** The issue says this unblocks release readiness; the release ticket itself is separate work.

## Acceptance criteria coverage (this PR)

| Criterion (issue #10) | How this PR satisfies it |
|---|---|
| Coverage matrix complete | Audit doc Section 2. |
| Nine-point architecture audit complete | Audit doc Section 3, with command output for each item. |
| Required commands all pass | Audit doc Section 4, with tail output captured. |
| Non-goals reconfirmed | Audit doc footer cites issue #10's non-goal list and confirms each is upheld by the implementation. |
