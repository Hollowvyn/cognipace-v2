# Agent Governance Drift Audit Design

## Context

CogniPace now has root agent guides, a canonical governance document, a local
agent workflow skill, lightweight GitHub PR and issue templates, PR hygiene
checks, PR title validation, stale PR handling, and path-based PR labels. Phase F
keeps those pieces aligned as the repository changes.

The goal is not to add more automation immediately. The first version should be
a lightweight checklist in the canonical governance doc so agents and engineers
know exactly what to review after the first hardened release cycle and on a
recurring cadence.

## Goals

- Keep `AGENTS.md`, `CLAUDE.md`, local skills, GitHub templates, workflows, and
  branch protection aligned with the current repository.
- Use exact file paths so the audit has one clear source of truth.
- Review the hardened model after the first release cycle.
- Remove or simplify rules that create noise without improving release safety.
- Add new mechanical checks only after repeated human-review misses.

## Non-Goals

- Do not add a scheduled GitHub Action for drift audits in this phase.
- Do not create a separate drift-audit runbook unless the canonical section
  becomes too large.
- Do not duplicate PR or issue template wording into agent docs.
- Do not automate branch protection settings from the repository.
- Do not add new PR hygiene rules before the first hardened release-cycle
  review identifies a repeated miss.

## Proposed Approach

Add a concise `Drift Audit` section to `docs/agent-governance.md`. That section
becomes the operating checklist for Phase F and references the exact files that
must remain aligned:

- `AGENTS.md`
- `CLAUDE.md`
- `.agents/skills/cognipace-agent-workflow/SKILL.md`
- `.agents/skills/cognipace-bulletproof-react/SKILL.md`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `.github/ISSUE_TEMPLATE/bug.yml`
- `.github/ISSUE_TEMPLATE/task.yml`
- `.github/ISSUE_TEMPLATE/config.yml`
- `.github/workflows/ci.yml`
- `.github/workflows/pr-title.yml`
- `.github/workflows/pr-hygiene.yml`
- `.github/workflows/labeler.yml`
- `.github/workflows/stale-prs.yml`
- `.github/workflows/release-please.yml`
- `.github/labeler.yml`
- GitHub branch protection settings for `main`

The checklist should ask reviewers to confirm:

- Root agent guides still delegate to `docs/agent-governance.md`.
- Codex and Claude root instructions remain equivalent in requirements.
- Local skills route agents to the canonical governance doc instead of
  duplicating changing rules.
- PR and issue template expectations still match PR hygiene automation.
- Workflow names and required checks match branch protection.
- Labeler paths still cover sensitive areas accurately.
- Release, package, and validation rules still match actual npm scripts and CI.
- Any noisy rule is simplified or removed before new rules are added.
- New mechanical checks are proposed only after repeated review misses.

## Cadence

The first audit should happen after the first release cycle using the hardened
model. After that, the checklist should be reviewed on a recurring release-cycle
cadence and whenever governance, CI, templates, release behavior, or local agent
skills change.

## Status Updates

After implementation, update the Phase F section in
`docs/superpowers/specs/2026-06-07-cognipace-agent-governance-design.md` from
`Status: missing` to a status that reflects the checklist being implemented.

The acceptance criteria in that same design should remain accurate: branch
protection is still a GitHub settings responsibility, and repository files
should only document the required checks and audit expectation.

## Validation

This is docs and governance work. Required validation:

```sh
npx prettier --check docs/superpowers/specs/2026-06-08-agent-governance-drift-audit-design.md docs/superpowers/README.md
```

Implementation of Phase F should also run Prettier against any touched
governance Markdown files.
