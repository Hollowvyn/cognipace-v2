# Agent Governance Phase C Validation And Smoke Design

## Context

`docs/superpowers/specs/2026-06-07-cognipace-agent-governance-design.md`
defines Phase C as validation and smoke documentation. Phase A has landed the
root agent authority docs. Phase B has landed the local
`cognipace-agent-workflow` skill. The current canonical governance doc already
contains a validation matrix, and `docs/testing.md` already owns concrete manual
smoke flows.

The remaining Phase C gap is usability. Agents can find the matrix, but they
still need a faster way to map changed files and risk areas to exact validation
commands, smoke expectations, and skipped-validation reporting.

## Goals

- Make validation selection easier without changing the canonical authority
  model.
- Keep `docs/agent-governance.md` as the single validation matrix source.
- Give agents a compact decision aid for changed area, risk area, required
  commands, focused tests, and manual smoke checklist needs.
- Clarify that overlapping categories use the stricter validation set.
- Require a relevant manual testing checklist in PR descriptions for feature
  changes that affect manual flows, plus popup, dashboard, overlay, background,
  sync, GenAI, release, and extension packaging changes.
- Keep concrete manual smoke steps in `docs/testing.md`.

## Non-Goals

- Do not duplicate the full validation matrix in `AGENTS.md` or `CLAUDE.md`.
- Do not add PR templates, issue templates, hygiene checks, branch protection,
  or CI enforcement. Those belong to later phases.
- Do not add a separate validation authority document unless the matrix later
  outgrows `docs/agent-governance.md`.
- Do not change product behavior, runtime code, database code, UI, extension
  permissions, sync behavior, release automation, or package scripts.
- Do not make agents responsible for manual browser smoke by default. Agents
  should identify the relevant manual smoke checklist for the engineer to run
  before squash and merge.

## Recommended Approach

Update `docs/agent-governance.md` with a compact validation decision aid before
or near the existing validation matrix. The decision aid should map changed
areas to the relevant validation category and make the escalation rule explicit:
when a change matches more than one category, the agent must use the strictest
required command set and include all relevant focused-test and manual smoke
checklist notes.

This is preferred over adding a new `docs/validation.md` because the repository
already treats `docs/agent-governance.md` as the canonical source for agent
validation, skipped-validation policy, PR expectations, and smoke expectations.
It is also preferred over duplicating tables in `AGENTS.md` and `CLAUDE.md`
because Phase A intentionally made those files lightweight entrypoints.

## Governance Doc Changes

Add a short section such as `Validation Selection` that explains the flow:

1. Identify every touched risk area, not just the file extension.
2. Select every matching validation category.
3. Use the strictest required command set when categories overlap.
4. Add focused tests for touched behavior when feasible.
5. Add the affected manual smoke checklist when feature work, extension
   surfaces, or background workflows touch a manual flow.
6. In the handoff, list exact commands run, exact commands skipped, why each
   skipped command was skipped, and remaining validation risk.

The decision aid should cover these categories:

| Changed area                                                                                       | Validation category                               | Notes                                                                                                                                                      |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agent docs, governance docs, planning docs, Markdown-only contribution docs                        | Docs or governance only                           | Run Prettier on every touched Markdown file.                                                                                                               |
| Feature domain, hooks, services, repositories, or utilities without extension-surface behavior     | Normal code change                                | Run focused tests when feasible; include a checklist if it affects a manual flow.                                                                          |
| Visible React UI without popup/dashboard/overlay workflow semantics                                | UI change                                         | Include focused component, hook, or route tests and visual proof or a skipped-visual reason.                                                               |
| Popup, dashboard, or overlay behavior                                                              | Popup, dashboard, or overlay behavior             | Include build and the affected manual smoke checklist.                                                                                                     |
| Runtime messaging, background handlers, sync, GenAI, secrets, notifications, or cache invalidation | Runtime/background/sync/GenAI/secrets             | Include build, focused contract or service tests, and notes on authorization, Zod parsing, secret redaction, invalidation, and side effects where touched. |
| Database schema, migrations, repositories, backup, restore, or persisted shape                     | Database or schema change                         | Include DB checks, migration generation when schema changes, focused persistence tests, and backup/sync compatibility notes where relevant.                |
| Release, CI, package scripts, build artifacts, extension zip, or workflow files                    | Release, CI, package, or extension build workflow | Include build, zip when artifact behavior is touched, and whether workflow proof was local, dry-run PR, or static review.                                  |

The table should stay compact. The existing validation matrix remains the
detailed command authority.

## Manual Smoke Checklist

`docs/agent-governance.md` should make manual smoke expectations concrete:

- If feature behavior affects a manual flow, include the relevant manual
  checklist in the PR description.
- If a popup change is made, include the popup smoke checklist from
  `docs/testing.md` in the PR description.
- If a dashboard route or dashboard workflow changes, include the affected
  dashboard smoke checklist in the PR description.
- If the overlay changes, include the LeetCode problem-page smoke checklist in
  the PR description.
- If background, runtime, notification, sync, GenAI, or secret behavior changes,
  include the hidden `/dev/smoke`, service-worker, or focused manual flow
  checklist in the PR description.
- If release, CI, package, or artifact behavior changes, include any relevant
  release or artifact manual checks and state whether automated workflow proof
  was local, dry-run PR, or static review.

The checklist belongs in the PR description so the engineer can run it before
squash and merge. Agents should not claim manual smoke was completed unless the
user or engineer explicitly reports the result. When a relevant manual smoke
checklist is not included, the handoff must explain why. Acceptable reasons
include docs-only changes, static-only CI workflow review with no runtime
surface, or no affected user-facing/manual flow.

## Root Guide Behavior

`AGENTS.md` and `CLAUDE.md` should continue to delegate validation to
`docs/agent-governance.md`. Phase C should not copy the decision aid into both
root files unless implementation reveals that the root guides no longer point
clearly to the canonical validation source.

## Testing Docs Behavior

`docs/testing.md` remains the source for step-by-step manual smoke flows. Phase C
may add a small pointer back to `docs/agent-governance.md` if needed, but it
should not duplicate the governance validation matrix.

## Validation For Phase C

Phase C is docs/governance-only unless implementation unexpectedly changes code.
Required validation:

```sh
npx prettier --check docs/agent-governance.md docs/superpowers/specs/2026-06-07-agent-governance-phase-c-validation-smoke-design.md docs/superpowers/README.md
```

If implementation touches additional Markdown files, include them in the
Prettier command. Runtime tests, build, database checks, extension loading, and
manual smoke are not required for the Phase C docs pass unless code or runtime
behavior is touched.

## Acceptance Criteria

- `docs/agent-governance.md` includes a compact validation selection decision
  aid.
- The existing validation matrix remains the detailed canonical command source.
- Overlapping validation categories are explicitly handled by the strictest
  applicable command set.
- Smoke expectations require agents to include the relevant manual testing
  checklist in the PR description, or explain why no manual checklist applies.
- `AGENTS.md` and `CLAUDE.md` remain lightweight entrypoints unless a clear
  discoverability issue is found during implementation.
- `docs/testing.md` remains the source for concrete manual smoke steps.
- Phase C implementation is validated with Prettier over every touched Markdown
  file.
