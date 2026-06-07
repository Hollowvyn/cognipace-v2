# Agent Authority Docs Phase A Design

## Context

`docs/superpowers/specs/2026-06-07-cognipace-agent-governance-design.md`
defines the full cross-agent governance program for CogniPace. Phase A covers
only the root-level authority docs needed to make Codex and Claude follow the
same operating model.

The current repository has `AGENTS.md`, but it is compact and does not carry the
full required lifecycle, validation matrix, skipped-validation policy, PR
standards, or release-impact expectations. The repository does not currently
have `CLAUDE.md`. Duplicating the full rules in both root files would make drift
likely, while making the root files too thin would weaken the chance that agents
actually see the hard gates.

## Goals

- Give Codex and Claude equivalent root-level instructions.
- Keep the full operating contract in one canonical document.
- Make non-negotiable gates visible in both root entrypoints.
- Align agent-authored change expectations with `CONTRIBUTING.md`.
- Keep Phase A docs-only and avoid Phase B skill work or later CI/PR automation.

## Non-Goals

- Do not edit `.agents/skills` in Phase A.
- Do not add a new CogniPace agent workflow skill in Phase A.
- Do not add PR templates, issue templates, CI checks, branch protection, or
  automation.
- Do not change product behavior, extension permissions, runtime code, database
  code, or UI.
- Do not duplicate the full validation matrix in both root entrypoints.

## Design

### Shared Canonical Governance Doc

Add `docs/agent-governance.md` as the canonical cross-agent operating contract.
It should define the complete workflow:

1. Orient from current authority docs before substantial work.
2. Select explicit skills that match the affected ownership boundary.
3. Design before implementation for substantial work.
4. Plan phase-sized execution before multi-step implementation.
5. Implement within CogniPace ownership boundaries.
6. Validate with exact proof.
7. Handoff with PR-ready context.

The document should state that current product, architecture, testing, design,
contribution, and root agent docs outrank historical planning artifacts under
`docs/superpowers/*` unless current docs explicitly say otherwise.

### Root Entrypoints

Update `AGENTS.md` as the Codex-facing entrypoint. It should remain compact but
strict:

- list required reading
- point to `docs/agent-governance.md`
- inline the hard gates
- keep the Context7 rule for current library, framework, SDK, API, CLI, and
  cloud-service docs
- keep Codex-specific tool notes only where they are useful

Add `CLAUDE.md` as the Claude-facing entrypoint. It should mirror the same hard
gates and authority rules without Codex-specific wording. It should point Claude
to repo-local `.agents/skills` guidance where available and require the same
canonical governance doc.

Both root files should inline only the non-negotiables:

- use `superpowers:brainstorming` before substantial design, behavior,
  architecture, governance, CI, release, or workflow work
- use `cognipace-bulletproof-react` for ownership, runtime, React architecture,
  feature placement, popup, dashboard, or overlay boundary decisions
- do not implement before approved design and plan when required
- do not hide skipped validation
- list exact validation commands run
- use Conventional Commit titles and PR-ready summaries

### Canonical Lifecycle And Skill Rules

`docs/agent-governance.md` should require:

- `superpowers:brainstorming` before substantial creative, behavior,
  architecture, governance, CI, release, or workflow changes
- `cognipace-bulletproof-react` when work touches ownership, runtime boundaries,
  React architecture, feature placement, popup responsibilities, dashboard
  responsibilities, or overlay responsibilities
- Context7 for current library, framework, SDK, API, CLI, or cloud-service
  documentation questions
- implementation-specific skills only when the work reaches that boundary, such
  as `vitest`, `zod`, `drizzle-orm`, `drizzle-migrations`, `tanstack-query`, or
  relevant React composition skills

The design gate should apply to product behavior, feature behavior, runtime
messaging, database or persistence changes, popup/dashboard/overlay workflows,
sync, backup, restore, GenAI, secret handling, extension permissions, CI,
release, branch protection, PR hygiene, issue templates, governance, agent
workflow, and architecture ownership changes.

Small docs-only fixes may use a short stated design instead of a full spec, but
agents must still keep docs honest and run the appropriate formatting check.

### Validation Matrix

`docs/agent-governance.md` should carry the full validation matrix:

- Docs or governance only: `npx prettier --check <touched markdown files>`.
- Normal code: focused tests when feasible, then `npm run lint` and
  `npm run check`.
- UI changes: focused component, hook, or route tests; `npm run lint`;
  `npm run check`; screenshot, recording, or explicit reason visual proof was
  not possible.
- Popup, dashboard, or overlay behavior: focused tests, `npm run lint`,
  `npm run check`, `npm run build`, and affected extension smoke when feasible.
- Runtime, background, sync, GenAI, or secrets: focused contract, policy,
  handler, service, repository, or API tests; `npm run lint`; `npm run check`;
  `npm run build`; and notes about authorization, Zod parsing, secret
  redaction, cache invalidation, and sync side effects when touched.
- Database or schema: `npm run db:generate` when migrations change,
  `npm run db:check`, focused repository or service tests, `npm run lint`,
  `npm run check`, and notes on backup, restore, sync compatibility, and local
  data reset risk.
- Release, CI, package, or extension build workflow: `npm run lint`,
  `npm run check`, `npm run build`, `npm run zip` when artifact behavior is
  touched, plus notes on Release Please, check names, secrets, permissions, and
  whether testing was local, dry-run PR, or static review only.

Both root entrypoints should refer readers to this canonical matrix instead of
duplicating it.

### No Silent Validation

The canonical doc should forbid hand-wavy validation claims. Agent handoffs and
PR summaries must list:

- exact commands run
- exact commands skipped and why
- focused tests or smoke flows performed
- affected extension surfaces not loaded and why
- remaining validation risk

Phrases such as "tested locally", "checks pass", "validated", or "should work"
are not sufficient without command names and relevant context.

### PR, Issue, Commit, And Release Rules

`docs/agent-governance.md` should require Conventional Commit format for commits
and PR titles because CogniPace uses squash merge and Release Please reads the
PR title as the release signal.

Agent handoffs and PR summaries should include:

- why the change exists
- what changed
- issue link or documented exception
- validation commands run
- validation commands skipped and why
- risk areas touched
- release impact
- rollback or recovery notes when relevant
- screenshots or recordings for visible UI changes, or why visual proof is not
  applicable

Issue guidance should cover problem/request, why it matters, affected surface or
ownership area, done-when criteria, constraints, suggested validation, and links
to relevant docs, specs, plans, or PRs. Issues must not be used to approve new
product scope.

### CONTRIBUTING Alignment

Update `CONTRIBUTING.md` lightly. It should not duplicate the full validation
matrix. It should add or adjust a short agent-authored changes section that
points to `docs/agent-governance.md` and makes clear that PR summaries,
validation proof, skipped checks, release impact, and Conventional Commit titles
are expected for agent work.

## Files

- Add `docs/agent-governance.md`.
- Update `AGENTS.md`.
- Add `CLAUDE.md`.
- Update `CONTRIBUTING.md` only as needed for alignment.

## Validation

Phase A is docs-only. Required validation:

```sh
npx prettier --check AGENTS.md CLAUDE.md CONTRIBUTING.md docs/agent-governance.md
```

Runtime tests, build, database checks, and extension smoke are not required for
Phase A unless the scope changes beyond Markdown governance docs.

## Acceptance Criteria

- Codex and Claude have equivalent root-level instructions.
- Both root entrypoints point to `docs/agent-governance.md`.
- The full lifecycle, validation matrix, no-silent-validation policy, PR/issue
  rules, commit rules, release-impact expectations, and smoke expectations live
  in the canonical governance doc.
- Root files inline the hard gates without duplicating the full matrix.
- `CONTRIBUTING.md` points agent-authored work to the canonical governance doc.
- Phase A does not edit skills, CI, PR templates, issue templates, or runtime
  code.
