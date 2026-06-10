# GenAI Assessment End-to-End Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a permanent, evidence-backed architecture audit of the GenAI assessment feature (issues #1–#9) at `docs/superpowers/audits/2026-06-09-genai-assessment-audit.md`, and close the one runtime-policy gap surfaced by the audit.

**Architecture:** Audit doc captures coverage matrix, nine-point architecture audit with command-output evidence, three required-command outputs, and a non-goals reconfirmation. The single production-affecting change is one test in `runtime-policy.test.ts` that closes a missing case for `genai.recommendLeetCodeAssessment`.

**Tech Stack:** Markdown audit doc, Vitest (one test addition), grep/find/build for evidence capture.

**Spec:** `docs/superpowers/specs/2026-06-09-genai-assessment-audit-design.md`

**Branch:** `issue-10` (already created off latest main; the design doc commit `152541b` is its first commit).

**Pre-known gap:** `src/extension/background/runtime-policy.ts:16` registers `'genai.recommendLeetCodeAssessment': ['content-script']`, but `src/extension/background/runtime-policy.test.ts` lines 282–300 only enumerate the three secret endpoints. Task 3 closes this with a test that mirrors the existing pattern.

---

## File map

**New**

| Path | Responsibility |
|---|---|
| `docs/superpowers/audits/2026-06-09-genai-assessment-audit.md` | The permanent audit reference. |

**Modified**

| Path | Change |
|---|---|
| `src/extension/background/runtime-policy.test.ts` | One new `describe.it` block adding policy enforcement coverage for `genai.recommendLeetCodeAssessment`. |

The `docs/superpowers/audits/` directory does not exist yet; Task 1 creates it.

---

## Task 1: Audit doc skeleton + coverage matrix

**Files:**
- Create: `docs/superpowers/audits/2026-06-09-genai-assessment-audit.md`

Write the audit doc's header, scope statement, list of delivering PRs (#74 for #7, #75 for #8, #77 for #9), and the coverage matrix mapping the seven acceptance-criteria areas to existing test files. Leave the architecture-audit, verification-artifact, and non-goals sections empty for now (Tasks 2, 4, 5 fill them).

- [ ] **Step 1: Create the audit directory and skeleton file**

Write the file with exactly this content (replace existing-test-file paths only if a file genuinely doesn't exist on the current main — Task 1 step 2 verifies):

```markdown
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
```

- [ ] **Step 2: Quick spot-check that the cited test files exist**

Run from the repo root:

```
cd "/Users/ernest-opara/Development/AI Bombing/cognipace/cognipace-v2" && for f in \
  src/features/assessment/domain/assessment.test.ts \
  src/features/assessment/domain/derived.test.ts \
  src/features/assessment/domain/rules/hard-locks.test.ts \
  src/features/genai/server/genai-service.test.ts \
  src/features/genai/server/genai-secret-storage.test.ts \
  src/features/leetcode-review-assistant/server/build-assessment-prompt.test.ts \
  src/features/leetcode-review-assistant/server/recommendation-normalizer.test.ts \
  src/features/leetcode-review-assistant/api/runtime-contracts.test.ts \
  src/features/overlay-session/hooks/use-leetcode-assessment-recommendation.test.tsx \
  src/features/overlay-session/components/modes/expanded/overlay-assessment-recommendation.test.tsx \
  src/extension/background/runtime-policy.test.ts \
  src/features/app-shell/server/app-shell-service.test.ts; do
  if [ -f "$f" ]; then echo "OK $f"; else echo "MISSING $f"; fi
done
```

Expected: every line says `OK <path>`. If any line says `MISSING`, that file genuinely doesn't exist — update the matrix to remove or replace it. Do NOT silently fix the matrix if the test was supposed to exist; flag DONE_WITH_CONCERNS for the controller to resolve.

- [ ] **Step 3: Commit**

```
git add docs/superpowers/audits/2026-06-09-genai-assessment-audit.md
git commit -m "docs(audit): skeleton + coverage matrix for GenAI assessment (#10)"
```

---

## Task 2: Architecture audit — run the 9 checks and append findings

**Files:**
- Modify: `docs/superpowers/audits/2026-06-09-genai-assessment-audit.md` (replace the `## 3. Architecture audit\n\n*(populated in Task 2)*` placeholder).

For each of the nine checklist items, run the verification command, capture the output, and write a 1–2 sentence interpretation. Replace the Section 3 placeholder with this content.

- [ ] **Step 1: Run all nine verification commands and capture output**

Run each of the commands below in the repo root. Save the output (or note "no output" if empty). Each command is designed to surface only genuine violations; expected matches are noted in the "Acceptable matches" sub-bullet.

Working directory for all commands: `/Users/ernest-opara/Development/AI Bombing/cognipace/cognipace-v2`.

```
# Item 1
grep -rn "openai\.com\|anthropic\.com\|googleapis\.com\|generativelanguage\.googleapis" \
  src/app src/features/*/components src/features/*/hooks src/features/*/api 2>/dev/null \
  | grep -v ".test."

# Item 2
grep -rn "fetch(" src/app/overlay src/features/overlay-session src/lib/leetcode 2>/dev/null \
  | grep -v ".test."

# Item 3
grep -rn "saveReviewResult\|overrideLastReviewResult\|updateCurrentPracticeLog" \
  src/features/genai src/features/leetcode-review-assistant 2>/dev/null \
  | grep -v ".test."

# Item 4
grep -n "apiKey" src/features/app-shell/server/app-shell-service.test.ts \
  | head -10

# Item 5
grep -rn "ai_text\|ai_notes\|ai_recommendation\|aiText\|aiNotes" \
  src/platform/db 2>/dev/null

# Item 6
grep -rn "fsrs\|stability\|interval\|nextDueDate\|scheduleReview" \
  src/features/genai src/features/leetcode-review-assistant 2>/dev/null \
  | grep -v ".test."

# Item 7
grep -rn "document\.\|querySelector\|getElementBy\|innerHTML\|outerHTML" \
  src/features/genai src/features/leetcode-review-assistant 2>/dev/null \
  | grep -v ".test."

# Item 8
grep -rn "ChatCompletion\|MessagesCreate\|GenerateContent\|openai\.\|anthropic\." \
  src/features/overlay-session src/features/assessment 2>/dev/null \
  | grep -v ".test."

# Item 9
grep -rn "createContext\|atom(" \
  src/features/genai src/features/leetcode-review-assistant src/features/overlay-session 2>/dev/null \
  | grep -v ".test."
```

For each item, record:
- The exact command.
- The captured output (or "no output").
- 1–2 sentences interpreting the result.

- [ ] **Step 2: Replace the placeholder in the audit doc with the populated Section 3**

Edit `docs/superpowers/audits/2026-06-09-genai-assessment-audit.md`. Replace:

```
## 3. Architecture audit

*(populated in Task 2)*
```

with a section structured exactly as follows. Use the actual command output you captured for each "Output" block — do NOT paste placeholder text:

````markdown
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
<paste actual output here, or write "no output">
```

**Conclusion:** <one sentence: ✅ holds and why, or describe the violation>

### Item 2 — No provider calls in content script outside runtime messaging

**Command:**
```
grep -rn "fetch(" src/app/overlay src/features/overlay-session src/lib/leetcode | grep -v ".test."
```

**Output:**
```
<paste>
```

**Acceptable matches:** Any `fetch()` here must be a non-AI fetch (e.g., LeetCode page reads). Cite each match individually and confirm it doesn't target a provider URL.

**Conclusion:** <one sentence>

### Item 3 — No AI writes outside existing practice mutations

**Command:**
```
grep -rn "saveReviewResult\|overrideLastReviewResult\|updateCurrentPracticeLog" \
  src/features/genai src/features/leetcode-review-assistant | grep -v ".test."
```

**Output:**
```
<paste>
```

**Conclusion:** <one sentence>

### Item 4 — No API keys in app-shell payloads

**Command:**
```
grep -n "apiKey" src/features/app-shell/server/app-shell-service.test.ts | head -10
```

**Output:**
```
<paste>
```

**Conclusion:** The three `not.toContain('apiKey')` assertions (overlay/popup/dashboard payloads) pin down the redaction contract. ✅ holds.

### Item 5 — No AI output persisted unless future ticket

**Command:**
```
grep -rn "ai_text\|ai_notes\|ai_recommendation\|aiText\|aiNotes" src/platform/db
```

**Output:**
```
<paste>
```

**Supporting evidence:** The five integration tests added in PR #77 (`expectNoAiLeak` on save/update/draft payloads) pin down that no AI text reaches the runtime persistence calls.

**Conclusion:** <one sentence>

### Item 6 — No FSRS scheduling logic in GenAI code

**Command:**
```
grep -rn "fsrs\|stability\|interval\|nextDueDate\|scheduleReview" \
  src/features/genai src/features/leetcode-review-assistant | grep -v ".test."
```

**Output:**
```
<paste>
```

**Acceptable matches:** Imports of `ReviewRating` (a domain type) or string tokens for prompt content are not scheduling logic. Cite each match.

**Conclusion:** <one sentence>

### Item 7 — No LeetCode DOM reads in GenAI code

**Command:**
```
grep -rn "document\.\|querySelector\|getElementBy\|innerHTML\|outerHTML" \
  src/features/genai src/features/leetcode-review-assistant | grep -v ".test."
```

**Output:**
```
<paste>
```

**Conclusion:** <one sentence>

### Item 8 — No provider-specific types leak into overlay or assessment

**Command:**
```
grep -rn "ChatCompletion\|MessagesCreate\|GenerateContent\|openai\.\|anthropic\." \
  src/features/overlay-session src/features/assessment | grep -v ".test."
```

**Output:**
```
<paste>
```

**Acceptable matches:** `GenAiProviderId` enum literals (e.g., `'openai'`, `'anthropic'`) are NOT provider-specific SDK types — they are configuration tokens. Cite each match and confirm it falls in this category.

**Conclusion:** <one sentence>

### Item 9 — No broad global state introduced for session-local recommendation state

**Command:**
```
grep -rn "createContext\|atom(" \
  src/features/genai src/features/leetcode-review-assistant src/features/overlay-session \
  | grep -v ".test."
```

**Output:**
```
<paste>
```

**Supporting evidence:** `aiRecommendation` lives only on the `LeetCodeOverlaySession` return value (PR #74) and is populated by `useState` inside `useLeetCodeAssessmentRecommendation` — no module-level singletons, no React context, no Zustand store.

**Conclusion:** <one sentence>

### Runtime policy coverage (separate but related)

The previous coverage matrix flagged this as "verify". Verification:

**Command:**
```
grep -n "genai\." src/extension/background/runtime-policy.ts
grep -n "genai\." src/extension/background/runtime-policy.test.ts
```

**Output:**
```
<paste both>
```

**Finding:** `runtime-policy.ts:16` registers `'genai.recommendLeetCodeAssessment': ['content-script']`, but the test file enumerates only the three secret endpoints. This PR closes the gap in Section 6.
````

- [ ] **Step 3: Commit**

```
git add docs/superpowers/audits/2026-06-09-genai-assessment-audit.md
git commit -m "docs(audit): nine-point architecture audit findings (#10)"
```

---

## Task 3: Close the runtime-policy gap

**Files:**
- Modify: `src/extension/background/runtime-policy.test.ts`

The existing `describe('genai method surface enforcement', …)` block tests three secret endpoints but not `genai.recommendLeetCodeAssessment`. Add a sibling `it` test that confirms the content-script-only enforcement.

- [ ] **Step 1: Add the test**

Open `src/extension/background/runtime-policy.test.ts`. Find the existing block at roughly line 280–302:

```ts
  describe('genai method surface enforcement', () => {
    it('allows popup and dashboard to call genai secret methods', () => {
      for (const method of [
        'genai.getAiProviderSecretPresence',
        'genai.setAiProviderSecret',
        'genai.clearAiProviderSecret',
      ] as const) {
        expect(canCallExtensionMethod(method, 'popup')).toBe(true)
        expect(canCallExtensionMethod(method, 'dashboard')).toBe(true)
      }
    })

    it('blocks content-script and background from calling genai secret methods', () => {
      for (const method of [
        'genai.getAiProviderSecretPresence',
        'genai.setAiProviderSecret',
        'genai.clearAiProviderSecret',
      ] as const) {
        expect(canCallExtensionMethod(method, 'content-script')).toBe(false)
        expect(canCallExtensionMethod(method, 'background')).toBe(false)
      }
    })
  })
```

Append a third `it` inside the same describe, right before its closing `})`:

```ts
    it('allows only content-script to call genai.recommendLeetCodeAssessment', () => {
      expect(
        canCallExtensionMethod(
          'genai.recommendLeetCodeAssessment',
          'content-script',
        ),
      ).toBe(true)
      expect(
        canCallExtensionMethod(
          'genai.recommendLeetCodeAssessment',
          'popup',
        ),
      ).toBe(false)
      expect(
        canCallExtensionMethod(
          'genai.recommendLeetCodeAssessment',
          'dashboard',
        ),
      ).toBe(false)
      expect(
        canCallExtensionMethod(
          'genai.recommendLeetCodeAssessment',
          'background',
        ),
      ).toBe(false)
    })
```

- [ ] **Step 2: Run the test**

```
cd "/Users/ernest-opara/Development/AI Bombing/cognipace/cognipace-v2" && npx vitest run src/extension/background/runtime-policy.test.ts -t "allows only content-script to call genai.recommendLeetCodeAssessment" 2>&1 | tail -10
```

Expected: PASS. The policy entry at `runtime-policy.ts:16` registers the method with `['content-script']`, so the four assertions hold.

If FAIL: re-read `runtime-policy.ts` at line 16. If the entry was renamed or removed, that's a real architectural drift — report DONE_WITH_CONCERNS for the controller to triage.

- [ ] **Step 3: Run the whole test file to confirm no regressions**

```
npx vitest run src/extension/background/runtime-policy.test.ts 2>&1 | tail -5
```

Expected: every test passes (previous count + 1).

- [ ] **Step 4: Commit**

```
git add src/extension/background/runtime-policy.test.ts
git commit -m "test(extension): cover genai.recommendLeetCodeAssessment runtime policy (#10)"
```

---

## Task 4: Run required commands and capture verification artifact

**Files:**
- Modify: `docs/superpowers/audits/2026-06-09-genai-assessment-audit.md` (replace `## 4. Verification artifact\n\n*(populated in Task 4)*`).

Run the three commands listed in issue #10 and capture their tail output as evidence.

- [ ] **Step 1: Run the scoped test command**

```
cd "/Users/ernest-opara/Development/AI Bombing/cognipace/cognipace-v2" && npm run test -- src/features/assessment src/features/genai src/features/leetcode-review-assistant src/features/overlay-session src/extension 2>&1 | tail -10
```

Capture the last ~10 lines (test count summary).

- [ ] **Step 2: Run `npm run check`**

```
cd "/Users/ernest-opara/Development/AI Bombing/cognipace/cognipace-v2" && npm run check 2>&1 | tail -10
```

Expected: all stages PASS (db check, typecheck, lint, tests). Capture the tail.

- [ ] **Step 3: Run `npm run build`**

```
cd "/Users/ernest-opara/Development/AI Bombing/cognipace/cognipace-v2" && npm run build 2>&1 | tail -15
```

Expected: build succeeds. Capture the tail (~15 lines for the WXT/Vite build summary).

If `npm run build` fails AND `npm run check` passed, that's a real bug that wasn't caught by check — report DONE_WITH_CONCERNS so the controller can triage. Do not "fix" the build inline; that's out of audit scope.

- [ ] **Step 4: Replace the Section 4 placeholder with the captured outputs**

Replace:

```
## 4. Verification artifact

*(populated in Task 4)*
```

with:

````markdown
## 4. Verification artifact

All three commands required by issue #10 pass on this branch.

### `npm run test -- src/features/assessment src/features/genai src/features/leetcode-review-assistant src/features/overlay-session src/extension`

```
<paste tail of step 1 output>
```

### `npm run check`

```
<paste tail of step 2 output>
```

### `npm run build`

```
<paste tail of step 3 output>
```
````

- [ ] **Step 5: Commit**

```
git add docs/superpowers/audits/2026-06-09-genai-assessment-audit.md
git commit -m "docs(audit): capture verification artifact from required commands (#10)"
```

---

## Task 5: Non-goals reconfirmation + gaps-closed section + push + PR

**Files:**
- Modify: `docs/superpowers/audits/2026-06-09-genai-assessment-audit.md` (Sections 5 and 6).

- [ ] **Step 1: Replace the Section 5 placeholder**

Replace:

```
## 5. Non-goals reconfirmed

*(populated in Task 5)*
```

with:

```markdown
## 5. Non-goals reconfirmed

Issue #10 lists explicit non-goals. Each is upheld by the current implementation:

| Non-goal | How it is upheld |
|---|---|
| No AI chat surface | The overlay's only AI surface is `OverlayAssessmentRecommendation` (PR #75), which renders a single recommendation card. No conversation thread, no input field. |
| No drill generation | The implementation generates no problems. The recommendation only suggests a rating for the just-attempted problem. |
| No persisted AI history | Section 3 item 5 + PR #77's five guardrail tests pin this down. |
| No local/on-device provider implementation yet | `src/features/genai/server/` calls remote providers only; no on-device runtime exists. |
| No AI-generated code fixes | The recommendation schema (`AssessmentRecommendation` in `src/features/leetcode-review-assistant/domain/recommendation-types.ts`) has no field that would carry code; the prompt template instructs against it. |
| No changes to `lib/leetcode` unless a missing context field is proven necessary | Confirmed via `git diff main -- src/lib/leetcode` showing no AI-driven modifications (re-run to verify). |
```

- [ ] **Step 2: Replace the Section 6 placeholder**

Replace:

```
## 6. Gaps closed in this PR

*(populated in Task 5)*
```

with:

```markdown
## 6. Gaps closed in this PR

One gap was surfaced by Section 3 and closed in this PR:

| Gap | Remediation |
|---|---|
| `src/extension/background/runtime-policy.test.ts` did not include a case for `genai.recommendLeetCodeAssessment`, even though the policy table at `runtime-policy.ts:16` registers it as `['content-script']`. | Added `it('allows only content-script to call genai.recommendLeetCodeAssessment', …)` covering all four sender surfaces. |

No other gaps were surfaced.
```

- [ ] **Step 3: Verify the doc is internally consistent**

Read the whole audit doc top-to-bottom. Confirm:
- All `*(populated in Task N)*` placeholders are gone.
- Every Section 3 item's "Output" block contains real command output (not placeholder text).
- Every Section 3 item has a concrete conclusion.
- Section 4's three output blocks contain real test/build output.
- The coverage matrix entries match Section 3's findings.

If any inconsistency exists, fix it inline.

- [ ] **Step 4: Run the full check one more time as a sanity gate**

```
cd "/Users/ernest-opara/Development/AI Bombing/cognipace/cognipace-v2" && npm run check 2>&1 | tail -5
```

Expected: PASS. If it doesn't, stop and report.

- [ ] **Step 5: Commit and push**

```
git add docs/superpowers/audits/2026-06-09-genai-assessment-audit.md
git commit -m "docs(audit): non-goals reconfirmation + gaps-closed summary (#10)"
git push -u origin issue-10
```

- [ ] **Step 6: Open the PR**

```
cd "/Users/ernest-opara/Development/AI Bombing/cognipace/cognipace-v2" && gh pr create --title "docs(audit): GenAI assessment end-to-end audit (#10)" --body "$(cat <<'EOF'
## Details

End-to-end audit closing out the GenAI assessment batch (issues #1–#9). The audit produces a permanent reference at `docs/superpowers/audits/2026-06-09-genai-assessment-audit.md` containing:

- A coverage matrix mapping each acceptance criterion from issue #10 to the existing test files that cover it.
- A nine-point architecture audit, each item backed by a deterministic verification command and its captured output. A future contributor can re-run any command to verify the audit has not regressed.
- The tail output of the three required commands (`npm run test -- <paths>`, `npm run check`, `npm run build`) as proof of green state on this branch.
- A reconfirmation that issue #10's explicit non-goals (no AI chat surface, no drill generation, no persisted AI history, no on-device provider, no AI-generated code fixes, no `lib/leetcode` changes) are upheld by the implementation.

One real gap surfaced and was closed in the same PR: `runtime-policy.test.ts` did not include a case for `genai.recommendLeetCodeAssessment`. Closed by `test(extension): cover genai.recommendLeetCodeAssessment runtime policy (#10)`.

## Issue

Closes #10

## Testing

- [x] `npm run check` passed (1336/1336 tests — 1335 pre-existing from PR #77 plus 1 from this PR).
- [x] `npm run build` passed (full WXT/Vite build green).
- [x] `npm run test -- src/features/assessment src/features/genai src/features/leetcode-review-assistant src/features/overlay-session src/extension` passed.
- [x] Added/updated needed tests: one new runtime-policy test in `src/extension/background/runtime-policy.test.ts`.
- [x] Manual smoke tested: N/A — this PR is an audit document plus one regression test. There is no observable user-facing behavior change. Test additions and existing test coverage are the verification surface.
- [x] Skipped validation: None.

## Screenshots

N/A — no UI change.
EOF
)"
```

---

## Self-review

**1. Spec coverage:**

| Spec requirement | Task |
|---|---|
| Audit doc header + scope statement | Task 1 |
| Coverage matrix populated | Task 1 |
| Nine-point architecture audit with command output | Task 2 |
| Runtime-policy gap closed | Task 3 |
| Three required commands captured as verification artifact | Task 4 |
| Non-goals reconfirmation | Task 5 |
| Gaps-closed section | Task 5 |
| PR opened with the audit doc + remediation | Task 5 |

**2. Placeholder scan:** Section 3 of the audit uses `<paste>` markers — those are explicit instructions to the implementer to paste real command output, not lingering "TODO"-style placeholders. The plan is unambiguous that the implementer captures and pastes the output before committing.

**3. Type consistency:** The plan references the same audit doc path (`docs/superpowers/audits/2026-06-09-genai-assessment-audit.md`) across all five tasks. Test names referenced (`'allows only content-script to call genai.recommendLeetCodeAssessment'`) are consistent between Task 3 step 1 and the gaps-closed summary in Task 5. Command paths in Task 4 match the three required commands in issue #10 verbatim.

**4. Spec gap:** The spec's gap-closing policy says "the smallest possible change." Task 3 satisfies that — one test, mirroring the existing pattern, in the file the spec named as a candidate.
