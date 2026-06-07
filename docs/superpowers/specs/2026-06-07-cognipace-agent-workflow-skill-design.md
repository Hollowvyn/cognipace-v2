# CogniPace Agent Workflow Skill Design

## Context

`docs/superpowers/specs/2026-06-07-cognipace-agent-governance-design.md`
defines the full cross-agent governance program for CogniPace. Phase A has
landed the root authority docs and the canonical `docs/agent-governance.md`.
Phase B adds a repo-local workflow skill so agents have one obvious starting
point for non-trivial CogniPace work.

The existing `.agents/skills/cognipace-bulletproof-react/SKILL.md` is correctly
narrow. It explains CogniPace architecture ownership, runtime boundaries, import
direction, and surface responsibilities. Phase B should not dilute that skill
with lifecycle, PR, validation, and issue rules.

## Goals

- Add a sibling `cognipace-agent-workflow` skill for non-trivial CogniPace work.
- Keep `docs/agent-governance.md` as the canonical workflow authority.
- Route agents to the right docs and skills before implementation.
- Preserve `cognipace-bulletproof-react` as the dedicated architecture skill.
- Require `superpowers:writing-skills` for the skill creation workflow.
- Make validation and handoff proof hard to skip.
- Keep Phase B limited to skill and minimal root doc references.

## Non-Goals

- Do not implement CI, PR templates, issue templates, or branch protection.
- Do not rewrite `cognipace-bulletproof-react`.
- Do not duplicate the full validation matrix inside the new skill.
- Do not change product behavior, runtime code, database code, UI, extension
  permissions, sync behavior, or release automation.
- Do not create broad reference files unless a later phase proves they are
  needed.

## Recommended Approach

Create a concise sibling skill:

```txt
.agents/skills/cognipace-agent-workflow/
  SKILL.md
```

The skill should be a router and checklist. It should tell agents what to read,
which gates apply, which specialized skill to load, how to map the task to the
canonical validation matrix, and what the final handoff must contain.

This is preferred over a self-contained guide because copying the full lifecycle
and validation matrix into the skill would create drift against
`docs/agent-governance.md`.

Because Phase B creates a new skill, the implementation must use
`superpowers:writing-skills`. That skill requires understanding
`superpowers:test-driven-development` and applying a RED/GREEN/REFACTOR loop to
the skill itself: define pressure scenarios, observe baseline behavior without
the new skill, write the minimal skill that closes those failures, then verify
the scenarios pass with the skill present.

## Skill Trigger Intent

The frontmatter should make the skill activate for substantial CogniPace work,
including:

- product or feature behavior
- runtime messaging or background work
- database, persistence, backup, restore, sync, GenAI, or secret handling
- popup, dashboard, overlay, or extension-surface workflows
- architecture, ownership, dependency direction, or React boundary decisions
- CI, release, PR hygiene, issue templates, governance, validation, or agent
  workflow

Small typo-level docs fixes do not need the full workflow, but the skill should
still allow a short stated design and docs-only formatting proof when the
canonical governance doc permits it.

## Skill Structure

### Frontmatter

Use:

```yaml
---
name: cognipace-agent-workflow
description: Use for non-trivial CogniPace work before implementation, including product behavior, feature changes, runtime, database, UI surfaces, sync, GenAI, CI, release, governance, PR/issue workflow, validation, and agent process changes.
---
```

The description should describe when to use the skill. It should not try to
summarize all governance rules.

### Start Here

The skill should begin with an operational checklist:

1. Read `docs/agent-governance.md` for the full lifecycle.
2. Read authority docs relevant to the change:
   - `README.md`
   - `docs/product.md`
   - `docs/architecture.md`
   - `docs/testing.md`
   - `design.md`
   - `CONTRIBUTING.md`
   - `docs/superpowers/README.md` for planning history
3. Decide whether the task is design, planning, implementation, review, or a
   trivial docs fix.
4. Select only the specialized skills that match the affected boundary.

### Hard Gates

The skill should make these gates visible:

- Do not implement substantial work before an approved design and phase-sized
  plan when `docs/agent-governance.md` requires them.
- Do not hide skipped validation or failed validation.
- Do not expand account, auth, backend, hosted-service, generic SaaS, sync,
  Chrome permission, or secret-handling behavior without explicit approval.
- Do not treat historical `docs/superpowers/*` artifacts as current authority
  when current docs disagree.
- Do not duplicate or override the canonical validation matrix.

### Skill Routing

The skill should delegate instead of becoming a monolith:

- Use `superpowers:brainstorming` before substantial design, behavior,
  architecture, governance, CI, release, or workflow work.
- Use `superpowers:writing-plans` after the approved design when implementation
  requires a phase-sized plan.
- Use `superpowers:writing-skills` when creating, editing, or verifying the
  `cognipace-agent-workflow` skill. The implementation plan should include
  baseline pressure scenarios before the skill is drafted.
- Use `cognipace-bulletproof-react` for ownership, runtime boundaries, React
  architecture, feature placement, import direction, popup responsibilities,
  dashboard responsibilities, or overlay responsibilities.
- Use Context7 for current library, framework, SDK, API, CLI, or cloud-service
  documentation questions.
- Use implementation-specific skills only when the task reaches that boundary,
  such as `vitest`, `zod`, `drizzle-orm`, `drizzle-migrations`,
  `tanstack-query`, or relevant React composition skills.

### Validation Router

The skill should point to the validation matrix in `docs/agent-governance.md`
and require agents to report:

- exact validation commands run
- exact validation commands skipped
- reason each skipped command was skipped
- remaining validation risk
- relevant manual smoke flow status when a popup, dashboard, overlay,
  background, sync, GenAI, release, or extension packaging surface is touched

For Phase B implementation itself, validation should be docs/governance-only:

```sh
npx prettier --check .agents/skills/cognipace-agent-workflow/SKILL.md AGENTS.md CLAUDE.md docs/agent-governance.md
```

If the implementation also touches `docs/superpowers/README.md` or a plan file,
include those Markdown files in the Prettier command.

### Handoff Checklist

The skill should require final handoffs and agent-authored PR summaries to
include:

- why the change exists
- what changed
- issue link or documented exception
- validation commands run
- validation commands skipped and why
- remaining validation risk
- risk areas touched
- release impact
- rollback or recovery notes when relevant
- screenshots or recordings for visible UI changes, or why visual proof is not
  applicable

## Minimal Root Doc References

Phase B implementation should update only the root references needed for
discoverability:

- `AGENTS.md`: list `cognipace-agent-workflow` as the first local skill for
  non-trivial CogniPace work and keep `docs/agent-governance.md` canonical.
- `CLAUDE.md`: mirror the same expectation with Claude-facing phrasing.
- `docs/agent-governance.md`: update skill selection so the canonical lifecycle
  names `cognipace-agent-workflow` and keeps `cognipace-bulletproof-react` as
  the delegated architecture skill.

The implementation should not repeat the full skill text in those files.

## Drift Control

The skill should resolve disagreements by authority:

- `docs/agent-governance.md` owns workflow, validation, PR, issue, and release
  expectations.
- `docs/product.md` owns product behavior and scope.
- `docs/architecture.md` owns technical structure and change recipes.
- `docs/testing.md` owns smoke flows and validation expectations.
- `design.md` owns visual and interaction direction.
- `CONTRIBUTING.md` owns contribution and release expectations.
- `cognipace-bulletproof-react` owns architecture skill guidance when the
  workflow skill delegates to it.

When workflow rules evolve, update `docs/agent-governance.md` first. Update the
workflow skill only when routing behavior, gates, or handoff expectations
change.

## Acceptance Criteria

- `.agents/skills/cognipace-agent-workflow/SKILL.md` exists.
- Phase B implementation used `superpowers:writing-skills`, including baseline
  pressure scenarios before drafting the new skill.
- The skill is concise and operational rather than a duplicate governance doc.
- `AGENTS.md`, `CLAUDE.md`, and `docs/agent-governance.md` point agents toward
  the new workflow skill for non-trivial CogniPace work.
- `cognipace-bulletproof-react` remains the architecture-specific delegated
  skill.
- Phase B implementation is validated with a Prettier check over every touched
  Markdown file.
- The handoff lists exact commands run, skipped commands with reasons,
  remaining validation risk, risk areas, release impact, and rollback notes
  where relevant.
