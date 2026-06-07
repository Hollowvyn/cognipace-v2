# Agent Authority Docs Phase A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add root-level Codex and Claude authority docs backed by one shared
canonical CogniPace agent governance document.

**Architecture:** `docs/agent-governance.md` owns the full cross-agent
operating contract. `AGENTS.md` and `CLAUDE.md` stay compact but strict, inline
the hard gates, and point to the canonical doc. `CONTRIBUTING.md` only links
agent-authored changes to the canonical governance rules.

**Tech Stack:** Markdown, Prettier, existing CogniPace docs and Superpowers
planning artifacts.

---

## File Structure

- Create `docs/agent-governance.md`: canonical lifecycle, skill rules,
  validation matrix, no-silent-validation policy, PR/issue/commit/release rules,
  and smoke expectations.
- Modify `AGENTS.md`: Codex-facing root entrypoint with required reading, hard
  gates, Context7 rule, safety rules, validation principle, and pointer to
  `docs/agent-governance.md`.
- Create `CLAUDE.md`: Claude-facing root entrypoint with equivalent hard gates,
  required reading, safety rules, validation principle, and pointer to
  `docs/agent-governance.md`.
- Modify `CONTRIBUTING.md`: add a short agent-authored changes section that
  points to `docs/agent-governance.md` without duplicating the full validation
  matrix.

## Task 1: Canonical Governance Doc

**Files:**

- Create: `docs/agent-governance.md`
- Reference: `docs/superpowers/specs/2026-06-07-agent-authority-docs-phase-a-design.md`
- Reference: `docs/superpowers/specs/2026-06-07-cognipace-agent-governance-design.md`

- [ ] **Step 1: Create the canonical governance document**

Create `docs/agent-governance.md` with this content:

````markdown
# Agent Governance

This document is the canonical operating contract for AI-assisted CogniPace
work across Codex, Claude, and future agents. Root tool files such as
`AGENTS.md` and `CLAUDE.md` are entrypoints; this file owns the full lifecycle,
validation, PR, issue, commit, release, and smoke expectations.

## Authority

Current authority, in order of relevance:

- `docs/product.md`: product behavior, scope, non-goals, and future candidates.
- `docs/architecture.md`: source layout, runtime boundaries, data flow, and
  change recipes.
- `docs/testing.md`: manual smoke flows and validation expectations.
- `design.md`: visual and interaction direction.
- `CONTRIBUTING.md`: contribution, review, validation, and release expectations.
- `AGENTS.md`: Codex-facing root operating guide.
- `CLAUDE.md`: Claude-facing root operating guide.
- `.agents/skills/cognipace-bulletproof-react/SKILL.md`: CogniPace architecture
  ownership lens.
- `docs/superpowers/README.md`: planning artifact index and historical context.

Planning artifacts under `docs/superpowers/*` are useful history. They do not
override current product, architecture, testing, design, contribution, or root
agent docs unless a current doc explicitly says otherwise.

## Required Lifecycle

### 1. Orient

Before substantial work, read the current authority docs that match the change.
For broad work, start with:

- `README.md`
- `docs/product.md`
- `docs/architecture.md`
- `docs/testing.md`
- `design.md`
- `CONTRIBUTING.md`
- `docs/superpowers/README.md`

For code ownership, runtime, database, routing, popup, dashboard, overlay, sync,
GenAI, release, CI, governance, or agent-workflow changes, read the directly
relevant sections before proposing edits.

### 2. Select Skills

Use explicit skills that match the affected boundary.

- Use `superpowers:brainstorming` before substantial creative work, behavior
  changes, feature changes, architecture changes, repo governance changes, CI
  changes, release changes, or agent-workflow changes.
- Use `cognipace-bulletproof-react` when reviewing, planning, or implementing
  React architecture, feature ownership, runtime boundaries, import direction,
  popup responsibilities, dashboard responsibilities, overlay responsibilities,
  or Bulletproof React decisions in CogniPace.
- Use Context7 for current library, framework, SDK, API, CLI, or cloud-service
  documentation questions. Resolve the library ID first, then query the current
  docs.
- Use implementation-specific skills only when the task reaches that boundary:
  `vitest` for test design, `zod` for runtime validation, `drizzle-orm` or
  `drizzle-migrations` for database work, `tanstack-query` for query and
  invalidation work, and relevant React composition skills for component API
  work.

Do not load unrelated skills just because they exist. Skill use should match
the affected ownership boundary.

### 3. Design Before Implementation

Do not jump from request to code for substantial work.

Design is required before implementation for:

- product behavior
- feature behavior
- runtime messaging
- database schema or persistence
- popup, dashboard, or overlay workflows
- sync, backup, restore, GenAI, or secret-handling behavior
- extension permissions
- CI, release, branch protection, PR hygiene, issue templates, or governance
- agent workflow or skill changes
- architecture ownership or dependency direction changes

Small docs-only fixes may use a short stated design instead of a full spec, but
the agent still must keep docs honest and run the appropriate formatting check.

### 4. Plan Phase Work

Multi-step work must become a plan before implementation.

- Use one master design when the end state spans multiple systems.
- Use phase-sized implementation plans for execution.
- Do not execute broad repo-hardening, release, CI, feature, or
  agent-governance work in one uncontrolled pass.
- Prefer separate chats or threads for independent implementation phases so
  each phase has a clean context and review boundary.
- Keep each plan tied to exact files, validation commands, and done-when
  criteria.

### 5. Implement Within Ownership Boundaries

Preserve the existing dependency direction:

```text
entrypoints -> app -> features -> platform/lib/components
```

Implementation rules:

- `src/entrypoints` boots WXT surfaces only.
- `src/app` composes surfaces, providers, and routes.
- `src/features` owns product behavior.
- `src/extension` owns trusted runtime messaging, sender authorization, and
  background handler registration.
- `src/platform` and `src/lib` own infrastructure and integrations.
- `src/components` stays generic.
- Runtime payloads are validated with Zod at the extension boundary.
- Database writes stay behind the owning feature repository or server service.
- UI code does not call the database directly.
- Feature writes broadcast correct invalidation tags after persistence.
- New Chrome permissions require explicit human approval.

Prefer current feature patterns over new architecture layers.

### 6. Validate With Proof

Validation proof must name exact commands and, when relevant, exact affected
manual smoke flows. If a required command could not be run, state that clearly
in the handoff and PR summary with the reason.

These phrases are not sufficient on their own:

- "looks good"
- "tested locally"
- "checks pass"
- "validated"
- "should work"

### 7. Handoff With PR-Ready Context

Handoffs and agent-authored PR summaries must include:

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

## Validation Matrix

### Docs Or Governance Only

Required:

```sh
npx prettier --check <touched markdown files>
```

Use this for docs-only and governance-only changes.

### Normal Code Change

Required:

```sh
npm run lint
npm run check
```

Also required:

- focused tests for the touched behavior before the full check when feasible
- exact test paths or test names in the handoff

### UI Change

Required:

```sh
npm run lint
npm run check
```

Also required:

- focused component, hook, or route tests for the affected behavior
- screenshot, recording, or explicit reason visual proof was not possible
- manual smoke notes for the affected popup, dashboard, or overlay surface when
  feasible

### Popup, Dashboard, Or Overlay Behavior

Required:

```sh
npm run lint
npm run check
npm run build
```

Also required:

- focused tests for the affected controller, route, component, hook, or feature
  service
- load or smoke the affected extension surface when feasible
- state if Chrome extension loading was not performed

### Runtime Messaging, Background, Sync, GenAI, Or Secrets

Required:

```sh
npm run lint
npm run check
npm run build
```

Also required:

- focused contract, runtime-policy, handler, service, repository, or API tests
- explicit note about sender authorization, Zod parsing, secret redaction,
  cache invalidation, and sync side effects when touched
- release impact and rollback or recovery notes when shipped behavior changes

### Database Or Schema Change

Required when schema changes:

```sh
npm run db:generate
npm run db:check
npm run lint
npm run check
```

Required when database behavior changes without schema changes:

```sh
npm run db:check
npm run lint
npm run check
```

Also required:

- focused repository, service, migration, backup, restore, or integration tests
- note whether local extension data may reset because migration SQL changed
- note backup, restore, and sync compatibility when persisted shape changes

### Release, CI, Package, Or Extension Build Workflow

Required:

```sh
npm run lint
npm run check
npm run build
```

Required when artifact behavior is touched:

```sh
npm run zip
```

Also required:

- explain impact on Release Please, PR title semantics, release artifacts,
  branch protection, or Chrome Web Store handoff
- identify any GitHub secrets, permissions, or check names affected
- state whether the workflow was tested locally, by dry-run PR, or only by
  static review

## Smoke Expectations

Use `docs/testing.md` for exact manual smoke flows.

- Popup changes should smoke the extension popup when feasible.
- Dashboard changes should smoke the affected route when feasible.
- Overlay changes should smoke a LeetCode problem page when feasible.
- Background, sync, GenAI, notification, or runtime changes should include the
  relevant hidden smoke route or service-worker checks when feasible.
- Release, CI, package, or extension build changes should state whether the
  workflow was validated locally, through a dry-run PR, or by static review
  only.

If a smoke flow is relevant but not performed, state the reason.

## Commit And PR Rules

Use Conventional Commit format for commit messages and PR titles:

```text
<type>(optional-scope): short summary
```

CogniPace uses squash merge. The PR title is the release signal that Release
Please reads.

Release-triggering title types:

- `feat`
- `fix`
- `deps`
- any allowed type with `!`

Allowed maintenance types:

- `chore`
- `test`
- `ci`
- `build`
- `style`
- `docs`
- `perf`
- `refactor`

## Issue Rules

Create or propose issues only when the request needs tracked work.

Issue content should include:

- problem or request
- why it matters
- affected surface or ownership area
- done-when criteria
- relevant constraints
- suggested validation
- links to relevant docs, specs, plans, or PRs

Issues do not approve new product scope. Product behavior still comes from
explicit human approval and current product docs.
````

- [ ] **Step 2: Run Prettier against the new document**

Run:

```bash
npx prettier --check docs/agent-governance.md
```

Expected: PASS with `All matched files use Prettier code style!`.

- [ ] **Step 3: Commit the canonical governance document**

Run:

```bash
git add docs/agent-governance.md
git commit -m "docs(agent-governance): add canonical agent workflow"
```

Expected: commit succeeds and includes only `docs/agent-governance.md`.

## Task 2: Codex And Claude Root Entrypoints

**Files:**

- Modify: `AGENTS.md`
- Create: `CLAUDE.md`
- Reference: `docs/agent-governance.md`

- [ ] **Step 1: Replace `AGENTS.md` with the Codex entrypoint**

Replace `AGENTS.md` with:

```markdown
# Agent Operating Guide

This is the Codex-facing root guide for CogniPace. Follow
`docs/agent-governance.md` for the full lifecycle, skill rules, validation
matrix, PR/issue rules, release expectations, and skipped-validation policy.

## Required Reading

Before substantial work, read:

- `README.md`
- `docs/product.md`
- `docs/architecture.md`
- `docs/testing.md`
- `design.md`
- `CONTRIBUTING.md`
- `docs/agent-governance.md`
- `docs/superpowers/README.md` for historical planning context

For focused work, read the directly relevant sections of the authority docs
before proposing edits.

## Hard Gates

- Use `superpowers:brainstorming` before substantial design, behavior,
  architecture, governance, CI, release, or workflow work.
- Use `cognipace-bulletproof-react` for ownership, runtime, React architecture,
  feature placement, popup, dashboard, or overlay boundary decisions.
- Do not implement before an approved design and phase-sized plan when
  `docs/agent-governance.md` requires them.
- Do not hide skipped validation or failed validation.
- List exact validation commands run and exact commands skipped with reasons.
- Use Conventional Commit titles and PR-ready summaries for agent-authored
  changes.

## Context7

For library, framework, SDK, API, CLI, or cloud-service documentation requests,
use Context7 MCP. Resolve the library ID first, then query the current docs.
Use this even for familiar tools because current syntax and migration guidance
may have changed.

Do not use Context7 for refactoring, scripts from scratch, business-logic
debugging, code review, or general programming concepts.

## Authority

- `docs/product.md` owns current product behavior and scope.
- `docs/architecture.md` owns current technical structure and change recipes.
- `docs/testing.md` owns manual smoke flows and validation expectations.
- `design.md` owns current visual and interaction direction.
- `CONTRIBUTING.md` owns contribution and release expectations.
- `docs/agent-governance.md` owns cross-agent workflow, validation, PR, issue,
  and release-impact rules.
- `docs/superpowers/*` files are planning artifacts unless current docs say
  otherwise.

## Safety Rules

- Do not revert unrelated user work.
- Do not add account, auth, backend, team, hosted service, or generic SaaS
  behavior without explicit approval.
- Do not add or expand sync behavior without explicit approval.
- Do not expand Chrome permissions without explicit approval.
- Validate runtime payloads with Zod.
- Keep database writes behind the owning feature repository or service.
- Keep dependency direction: `entrypoints -> app -> features -> platform/lib/components`.
- Prefer existing feature patterns over new architecture layers.
- Keep docs honest about current behavior and validation actually run.

## Change Guidance

- For runtime, database, route, feature mutation, popup, dashboard, overlay,
  sync, GenAI, secret, release, CI, or governance changes, follow
  `docs/agent-governance.md` and `docs/architecture.md`.
- For product behavior and testing expectations, follow `docs/product.md` and
  `docs/testing.md`.
- For visible UI changes, follow `design.md` and existing component patterns.

## Validation

Use the validation matrix in `docs/agent-governance.md`.

For docs-only changes, run Prettier on the touched Markdown files. For
substantial code, run focused tests first and then the required full commands
for the change type. For database changes, run the relevant Drizzle/database
checks. Always report skipped validation with reasons.
```

- [ ] **Step 2: Create `CLAUDE.md` with the Claude entrypoint**

Create `CLAUDE.md` with:

```markdown
# Claude Operating Guide

This is the Claude-facing root guide for CogniPace. Follow
`docs/agent-governance.md` for the full lifecycle, skill rules, validation
matrix, PR/issue rules, release expectations, and skipped-validation policy.

## Required Reading

Before substantial work, read:

- `README.md`
- `docs/product.md`
- `docs/architecture.md`
- `docs/testing.md`
- `design.md`
- `CONTRIBUTING.md`
- `docs/agent-governance.md`
- `docs/superpowers/README.md` for historical planning context

For focused work, read the directly relevant sections of the authority docs
before proposing edits.

## Hard Gates

- Use `superpowers:brainstorming` before substantial design, behavior,
  architecture, governance, CI, release, or workflow work.
- Use `cognipace-bulletproof-react` for ownership, runtime, React architecture,
  feature placement, popup, dashboard, or overlay boundary decisions.
- Do not implement before an approved design and phase-sized plan when
  `docs/agent-governance.md` requires them.
- Do not hide skipped validation or failed validation.
- List exact validation commands run and exact commands skipped with reasons.
- Use Conventional Commit titles and PR-ready summaries for agent-authored
  changes.

## Skills

Use repo-local skills under `.agents/skills` when they match the work. The
CogniPace-specific architecture skill is:

- `.agents/skills/cognipace-bulletproof-react/SKILL.md`

Use documentation lookup tooling for current library, framework, SDK, API, CLI,
or cloud-service questions. Resolve the library first, then query current docs.

## Authority

- `docs/product.md` owns current product behavior and scope.
- `docs/architecture.md` owns current technical structure and change recipes.
- `docs/testing.md` owns manual smoke flows and validation expectations.
- `design.md` owns current visual and interaction direction.
- `CONTRIBUTING.md` owns contribution and release expectations.
- `docs/agent-governance.md` owns cross-agent workflow, validation, PR, issue,
  and release-impact rules.
- `docs/superpowers/*` files are planning artifacts unless current docs say
  otherwise.

## Safety Rules

- Do not revert unrelated user work.
- Do not add account, auth, backend, team, hosted service, or generic SaaS
  behavior without explicit approval.
- Do not add or expand sync behavior without explicit approval.
- Do not expand Chrome permissions without explicit approval.
- Validate runtime payloads with Zod.
- Keep database writes behind the owning feature repository or service.
- Keep dependency direction: `entrypoints -> app -> features -> platform/lib/components`.
- Prefer existing feature patterns over new architecture layers.
- Keep docs honest about current behavior and validation actually run.

## Change Guidance

- For runtime, database, route, feature mutation, popup, dashboard, overlay,
  sync, GenAI, secret, release, CI, or governance changes, follow
  `docs/agent-governance.md` and `docs/architecture.md`.
- For product behavior and testing expectations, follow `docs/product.md` and
  `docs/testing.md`.
- For visible UI changes, follow `design.md` and existing component patterns.

## Validation

Use the validation matrix in `docs/agent-governance.md`.

For docs-only changes, run Prettier on the touched Markdown files. For
substantial code, run focused tests first and then the required full commands
for the change type. For database changes, run the relevant Drizzle/database
checks. Always report skipped validation with reasons.
```

- [ ] **Step 3: Run Prettier against root entrypoints**

Run:

```bash
npx prettier --check AGENTS.md CLAUDE.md
```

Expected: PASS with `All matched files use Prettier code style!`.

- [ ] **Step 4: Commit root entrypoints**

Run:

```bash
git add AGENTS.md CLAUDE.md
git commit -m "docs(agent-governance): align root agent guides"
```

Expected: commit succeeds and includes only `AGENTS.md` and `CLAUDE.md`.

## Task 3: CONTRIBUTING Alignment

**Files:**

- Modify: `CONTRIBUTING.md`
- Reference: `docs/agent-governance.md`

- [ ] **Step 1: Add the agent-authored changes section**

In `CONTRIBUTING.md`, add this section after `## Working Agreement` and before
`## Pull Requests And Releases`:

```markdown
## Agent-Authored Changes

Agent-authored changes must follow [`docs/agent-governance.md`](./docs/agent-governance.md).
That document owns the full agent lifecycle, skill rules, validation matrix,
skipped-validation policy, PR and issue expectations, release-impact notes, and
smoke expectations.

For agent work, handoffs and PR summaries must include exact validation commands
run, commands skipped with reasons, risk areas, release impact, issue context or
a documented exception, and rollback or recovery notes when relevant.

Do not duplicate the full validation matrix here. Keep detailed validation rules
in `docs/agent-governance.md` so Codex, Claude, future agents, and human
reviewers use one canonical source.
```

- [ ] **Step 2: Run Prettier against `CONTRIBUTING.md`**

Run:

```bash
npx prettier --check CONTRIBUTING.md
```

Expected: PASS with `All matched files use Prettier code style!`.

- [ ] **Step 3: Commit contributing alignment**

Run:

```bash
git add CONTRIBUTING.md
git commit -m "docs(agent-governance): link contributor agent rules"
```

Expected: commit succeeds and includes only `CONTRIBUTING.md`.

## Task 4: Final Docs Validation And Review

**Files:**

- Verify: `docs/agent-governance.md`
- Verify: `AGENTS.md`
- Verify: `CLAUDE.md`
- Verify: `CONTRIBUTING.md`

- [ ] **Step 1: Run the required Phase A validation command**

Run:

```bash
npx prettier --check AGENTS.md CLAUDE.md CONTRIBUTING.md docs/agent-governance.md
```

Expected: PASS with `All matched files use Prettier code style!`.

- [ ] **Step 2: Confirm the docs-only scope**

Run:

```bash
git diff --stat HEAD~3..HEAD
```

Expected: output lists only these files:

```text
AGENTS.md
CLAUDE.md
CONTRIBUTING.md
docs/agent-governance.md
```

- [ ] **Step 3: Confirm no implementation files changed**

Run:

```bash
git diff --name-only HEAD~3..HEAD
```

Expected: output contains no paths under:

```text
src/
.github/
.agents/skills/
```

- [ ] **Step 4: Prepare the handoff**

Use this handoff shape:

```markdown
Implemented Phase A agent authority docs.

Changed:

- Added `docs/agent-governance.md` as the canonical cross-agent workflow,
  validation, PR, issue, commit, release, and smoke contract.
- Updated `AGENTS.md` as the Codex root entrypoint.
- Added `CLAUDE.md` as the Claude root entrypoint.
- Linked agent-authored contribution expectations from `CONTRIBUTING.md`.

Validation:

- `npx prettier --check AGENTS.md CLAUDE.md CONTRIBUTING.md docs/agent-governance.md`

Skipped:

- Runtime tests, build, database checks, and extension smoke were not run
  because Phase A changed only Markdown governance docs.

Risk:

- Low runtime risk. Main review risk is policy clarity or accidental drift
  between the root entrypoints and `docs/agent-governance.md`.

Release impact:

- Documentation/governance only. No product behavior, extension permissions,
  runtime code, package output, or release workflow changed.
```

- [ ] **Step 5: Commit final validation note only if files changed**

Run:

```bash
git status --short
```

Expected: no output. If formatting changed files during validation, commit those
formatting changes with:

```bash
git add AGENTS.md CLAUDE.md CONTRIBUTING.md docs/agent-governance.md
git commit -m "style(agent-governance): format phase a docs"
```

If `git status --short` has no output, skip the formatting commit.
