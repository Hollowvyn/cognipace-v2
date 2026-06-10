---
name: cognipace-agent-workflow
description: Use when CogniPace work touches product behavior, architecture/runtime/data/UI/sync/GenAI, CI/release/governance, validation, PR/issue workflow, or local agent skills.
---

# CogniPace Agent Workflow

Use this as the first repo-local skill for non-trivial CogniPace work.
`docs/agent-governance.md` is the canonical workflow authority; this skill is a
router and checklist.

## Start Here

1. Read the relevant sections of `docs/agent-governance.md`.
2. Before brainstorming or writing specs/plans, follow the governance
   branch/worktree guard.
3. For broad work, read the authority docs listed in governance. For focused
   work, read only matching authority sections.
4. Classify the request: audit, design, planning, implementation, review, or
   trivial docs fix.
5. Load only skills that match the affected boundary.

## Hard Gates

- Do not implement substantial work before an approved design and phase-sized
  plan when `docs/agent-governance.md` requires them.
- Do not hide skipped validation or failed validation.
- Do not expand account, auth, backend, hosted-service, generic SaaS, sync,
  Chrome permission, or secret-handling behavior without explicit approval.
- Do not treat historical `docs/superpowers/*` artifacts as current authority
  when current docs disagree.
- Do not duplicate or override the canonical validation matrix.
- Do not mark manual smoke testing or visual proof as N/A for behavior-changing
  code. Agents must prepare the checklist, and the human engineer must run
  happy-path and edge-case realtime smoke tests with screenshot or screen
  recording proof before PR review or merge.

## Skill Routing

- Use `superpowers:brainstorming` before substantial design, behavior,
  architecture, governance, CI, release, or workflow work.
- Use `superpowers:writing-plans` after an approved design when implementation
  needs a phase-sized plan.
- Use `superpowers:writing-skills` when creating, editing, or formally
  verifying skill behavior. For read-only audits, apply its skill-quality
  principles without pressure scenarios unless requested.
- Use `cognipace-bulletproof-react` for ownership, runtime boundaries, React
  architecture, feature placement, import direction, popup responsibilities,
  dashboard responsibilities, or overlay responsibilities.
- Use Context7 for current library, framework, SDK, API, CLI, or cloud-service
  documentation questions.
- Use implementation-specific skills only when the work reaches that boundary:
  `vitest`, `zod`, `drizzle-orm`, `drizzle-migrations`, `tanstack-query`, or
  relevant React composition skills.

## Validation Router

Use `docs/agent-governance.md#validation-selection`. Handoffs for edits must
list exact commands run, exact commands skipped, skipped-command reasons, and
remaining validation risk.

## Handoff Checklist

Use the current PR and issue templates as source of truth. Do not duplicate
template text here. For agent-authored changes, fill the template with
validation, risk, release impact, rollback notes, and visual/manual proof when
relevant. For behavior-changing code, visual/manual proof is required; N/A is
only acceptable for docs/governance-only work that does not touch app behavior.

## Common Mistakes

| Mistake | Correction |
| --- | --- |
| Using `cognipace-bulletproof-react` for every governance question | Use it only for architecture, ownership, runtime-boundary, and surface-boundary decisions. |
| Copying the validation matrix into this skill | Keep the matrix in `docs/agent-governance.md`; route agents there. |
| Treating a planning artifact as current authority | Check current product, architecture, testing, design, contribution, and governance docs first. |
| Creating or editing a skill directly | Use `superpowers:writing-skills` and record baseline pressure scenarios first. |
| Saying validation was skipped without naming commands | List exact skipped commands and reasons. |
