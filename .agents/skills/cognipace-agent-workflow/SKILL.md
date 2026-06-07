---
name: cognipace-agent-workflow
description: Use when doing non-trivial CogniPace work involving product behavior, feature changes, runtime, database, UI surfaces, sync, GenAI, CI, release, governance, PR or issue workflow, validation, or agent process changes.
---

# CogniPace Agent Workflow

Use this as the first repo-local skill for non-trivial CogniPace work.
`docs/agent-governance.md` is the canonical workflow authority; this skill is a
router and checklist.

## Start Here

1. Read `docs/agent-governance.md`.
2. Read the authority docs relevant to the change:
   - `README.md`
   - `docs/product.md`
   - `docs/architecture.md`
   - `docs/testing.md`
   - `design.md`
   - `CONTRIBUTING.md`
   - `docs/superpowers/README.md` for planning history
3. Classify the work as design, planning, implementation, review, or a trivial
   docs fix.
4. Load only the additional skills that match the affected boundary.

## Hard Gates

- Do not implement substantial work before an approved design and phase-sized
  plan when `docs/agent-governance.md` requires them.
- Do not hide skipped validation or failed validation.
- Do not expand account, auth, backend, hosted-service, generic SaaS, sync,
  Chrome permission, or secret-handling behavior without explicit approval.
- Do not treat historical `docs/superpowers/*` artifacts as current authority
  when current docs disagree.
- Do not duplicate or override the canonical validation matrix.

## Skill Routing

- Use `superpowers:brainstorming` before substantial design, behavior,
  architecture, governance, CI, release, or workflow work.
- Use `superpowers:writing-plans` after an approved design when implementation
  needs a phase-sized plan.
- Use `superpowers:writing-skills` when creating, editing, or verifying a skill.
  That workflow requires baseline pressure scenarios before drafting skill text.
- Use `cognipace-bulletproof-react` for ownership, runtime boundaries, React
  architecture, feature placement, import direction, popup responsibilities,
  dashboard responsibilities, or overlay responsibilities.
- Use Context7 for current library, framework, SDK, API, CLI, or cloud-service
  documentation questions.
- Use implementation-specific skills only when the work reaches that boundary:
  `vitest`, `zod`, `drizzle-orm`, `drizzle-migrations`, `tanstack-query`, or
  relevant React composition skills.

## Validation Router

Use the validation matrix in `docs/agent-governance.md`. Final handoffs must
name:

- exact validation commands run
- exact validation commands skipped
- why each skipped command was skipped
- remaining validation risk
- relevant manual smoke flow status when popup, dashboard, overlay, background,
  sync, GenAI, release, or extension packaging behavior is touched

## Handoff Checklist

Agent-authored handoffs and PR summaries must include:

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

## Common Mistakes

| Mistake | Correction |
| --- | --- |
| Using `cognipace-bulletproof-react` for every governance question | Use it only for architecture, ownership, runtime-boundary, and surface-boundary decisions. |
| Copying the validation matrix into this skill | Keep the matrix in `docs/agent-governance.md`; route agents there. |
| Treating a planning artifact as current authority | Check current product, architecture, testing, design, contribution, and governance docs first. |
| Creating or editing a skill directly | Use `superpowers:writing-skills` and record baseline pressure scenarios first. |
| Saying validation was skipped without naming commands | List exact skipped commands and reasons. |
