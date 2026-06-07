# Agent Governance Phase C Validation And Smoke Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make CogniPace validation selection and smoke reporting easier to
apply from the canonical agent governance doc.

**Architecture:** Keep `docs/agent-governance.md` as the single validation
authority. Add one compact validation-selection section before the existing
matrix, then tighten smoke reporting language without duplicating concrete
manual smoke steps from `docs/testing.md`.

**Tech Stack:** Markdown documentation, Prettier, CogniPace agent governance
docs.

---

## File Structure

- Modify: `docs/agent-governance.md`
  - Add a `Validation Selection` section between `Handoff With PR-Ready
Context` and `Validation Matrix`.
  - Tighten `Smoke Expectations` so skipped smoke must name the skipped flow and
    the reason.
- Verify: `docs/superpowers/README.md`
  - Keep the existing plan index entry formatted.
- Do not modify: `AGENTS.md`, `CLAUDE.md`, `docs/testing.md`, package scripts,
  CI workflows, product docs, runtime code, database code, or UI code.

## Task 1: Add Validation Selection Decision Aid

**Files:**

- Modify: `docs/agent-governance.md`

- [ ] **Step 1: Confirm insertion point**

Run:

```sh
rtk rg -n "Handoff With PR-Ready Context|Validation Matrix" docs/agent-governance.md
```

Expected: output includes the `### 7. Handoff With PR-Ready Context` heading
before the `## Validation Matrix` heading.

- [ ] **Step 2: Insert the validation-selection section**

Add this section immediately before `## Validation Matrix`:

```markdown
## Validation Selection

Choose validation by risk area, not only by file extension.

1. Identify every touched risk area.
2. Select every matching validation category in the matrix below.
3. When categories overlap, use the strictest required command set.
4. Add focused tests for touched behavior when feasible.
5. Add affected smoke notes when extension surfaces or background workflows are
   touched.
6. In the handoff, list exact commands run, exact commands skipped, why each
   skipped command was skipped, and remaining validation risk.

| Changed area                                                                                       | Validation category                                    | Notes                                                                                                                                                            |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agent docs, governance docs, planning docs, Markdown-only contribution docs                        | Docs or governance only                                | Run Prettier on every touched Markdown file.                                                                                                                     |
| Feature domain, hooks, services, repositories, or utilities without extension-surface behavior     | Normal code change                                     | Run focused tests when feasible, then lint and check.                                                                                                            |
| Visible React UI without popup/dashboard/overlay workflow semantics                                | UI change                                              | Include focused component, hook, or route tests and visual proof or a skipped-visual reason.                                                                     |
| Popup, dashboard, or overlay behavior                                                              | Popup, dashboard, or overlay behavior                  | Include build and affected surface smoke notes when feasible.                                                                                                    |
| Runtime messaging, background handlers, sync, GenAI, secrets, notifications, or cache invalidation | Runtime messaging, background, sync, GenAI, or secrets | Include build, focused contract or service tests, and notes on authorization, Zod parsing, secret redaction, cache invalidation, and side effects where touched. |
| Database schema, migrations, repositories, backup, restore, or persisted shape                     | Database or schema change                              | Include DB checks, migration generation when schema changes, focused persistence tests, and backup/sync compatibility notes where relevant.                      |
| Release, CI, package scripts, build artifacts, extension zip, or workflow files                    | Release, CI, package, or extension build workflow      | Include build, zip when artifact behavior is touched, and whether workflow proof was local, dry-run PR, or static review.                                        |
```

- [ ] **Step 3: Run formatting check for the changed governance doc**

Run:

```sh
rtk proxy npx prettier --check docs/agent-governance.md
```

Expected before formatting: this may pass or report table wrapping changes
needed. If it reports formatting issues, continue to Step 4.

- [ ] **Step 4: Apply Prettier if needed**

Run only if Step 3 reports formatting issues:

```sh
rtk proxy npx prettier --write docs/agent-governance.md
```

Expected: Prettier rewrites only `docs/agent-governance.md`.

- [ ] **Step 5: Verify the section exists**

Run:

```sh
rtk rg -n "Validation Selection|Choose validation by risk area|strictest required command set" docs/agent-governance.md
```

Expected: output includes all three phrases.

- [ ] **Step 6: Commit Task 1**

Run:

```sh
rtk git add docs/agent-governance.md
rtk git commit -m "docs(agent-governance): add validation selection guide"
```

Expected: commit succeeds with only `docs/agent-governance.md` staged.

## Task 2: Tighten Smoke Reporting Language

**Files:**

- Modify: `docs/agent-governance.md`

- [ ] **Step 1: Inspect the current smoke section**

Run:

```sh
rtk sed -n '/## Smoke Expectations/,/## Commit And PR Rules/p' docs/agent-governance.md
```

Expected: output shows the current smoke bullets and the final sentence,
`If a smoke flow is relevant but not performed, state the reason.`

- [ ] **Step 2: Replace the smoke section**

Replace the entire `## Smoke Expectations` section with:

```markdown
## Smoke Expectations

Use `docs/testing.md` for exact manual smoke flows.

- Popup changes should report whether the extension popup smoke flow was
  performed.
- Dashboard route or dashboard workflow changes should report the affected
  dashboard smoke flow.
- Overlay changes should report whether a LeetCode problem page was smoked.
- Background, sync, GenAI, notification, secret, or runtime changes should
  report the relevant hidden `/dev/smoke` route, service-worker check, or
  focused manual flow when feasible.
- Release, CI, package, or extension build changes should state whether the
  workflow was validated locally, through a dry-run PR, or by static review
  only.

If a relevant smoke flow is skipped, name the skipped flow and explain why.
Acceptable reasons include no browser access in the current environment,
docs-only change, static-only CI workflow review, missing external credentials
for an optional live provider, or a pre-existing local build failure that blocks
loading the extension. Vague claims such as "not tested" or "should work" are
not sufficient.
```

- [ ] **Step 3: Run formatting check for the changed governance doc**

Run:

```sh
rtk proxy npx prettier --check docs/agent-governance.md
```

Expected before formatting: this may pass or report wrapping changes needed. If
it reports formatting issues, continue to Step 4.

- [ ] **Step 4: Apply Prettier if needed**

Run only if Step 3 reports formatting issues:

```sh
rtk proxy npx prettier --write docs/agent-governance.md
```

Expected: Prettier rewrites only `docs/agent-governance.md`.

- [ ] **Step 5: Verify smoke skipped-reporting wording**

Run:

```sh
rtk rg -n "name the skipped flow|Acceptable reasons|not sufficient" docs/agent-governance.md
```

Expected: output includes all three phrases inside `docs/agent-governance.md`.

- [ ] **Step 6: Commit Task 2**

Run:

```sh
rtk git add docs/agent-governance.md
rtk git commit -m "docs(agent-governance): clarify smoke reporting"
```

Expected: commit succeeds with only `docs/agent-governance.md` staged.

## Task 3: Final Docs Validation And Handoff

**Files:**

- Verify: `docs/agent-governance.md`
- Verify: `docs/superpowers/specs/2026-06-07-agent-governance-phase-c-validation-smoke-design.md`
- Verify: `docs/superpowers/plans/2026-06-07-agent-governance-phase-c-validation-smoke.md`
- Verify: `docs/superpowers/README.md`

- [ ] **Step 1: Run final docs formatting validation**

Run:

```sh
rtk proxy npx prettier --check docs/agent-governance.md docs/superpowers/specs/2026-06-07-agent-governance-phase-c-validation-smoke-design.md docs/superpowers/plans/2026-06-07-agent-governance-phase-c-validation-smoke.md docs/superpowers/README.md
```

Expected: `All matched files use Prettier code style!`

- [ ] **Step 2: Confirm no root guide drift**

Run:

```sh
rtk git diff -- AGENTS.md CLAUDE.md docs/testing.md
```

Expected: no diff output. Phase C should not modify those files unless a
specific implementation finding justifies it.

- [ ] **Step 3: Confirm the implementation diff is docs-only**

Run:

```sh
rtk git status --short
```

Expected after Task 1 and Task 2 commits: clean working tree, or only the plan
file and plan index if this plan has not yet been committed.

- [ ] **Step 4: Prepare final handoff**

Use this handoff shape:

```markdown
Implemented Phase C validation and smoke documentation.

Why:

- Agents needed a faster way to map changed risk areas to exact validation and
  smoke reporting expectations.

What changed:

- Added `Validation Selection` to `docs/agent-governance.md`.
- Clarified smoke reporting and skipped-smoke requirements in
  `docs/agent-governance.md`.

Validation run:

- `rtk proxy npx prettier --check docs/agent-governance.md docs/superpowers/specs/2026-06-07-agent-governance-phase-c-validation-smoke-design.md docs/superpowers/plans/2026-06-07-agent-governance-phase-c-validation-smoke.md docs/superpowers/README.md`

Validation skipped:

- Runtime tests, build, DB checks, extension loading, and manual smoke were
  skipped because Phase C is docs/governance-only and touched no runtime code.

Remaining validation risk:

- Low; documentation wording changed, and no runtime behavior changed.

Risk areas touched:

- Agent governance documentation.

Release impact:

- None; docs-only governance clarification.

Rollback:

- Revert the Phase C documentation commits.
```

Expected: final handoff includes exact validation run, exact skipped validation
with reasons, remaining validation risk, risk areas touched, release impact,
and rollback notes.
