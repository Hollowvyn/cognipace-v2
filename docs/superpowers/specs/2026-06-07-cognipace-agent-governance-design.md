# CogniPace Agent Governance Design

## Context

CogniPace v2 now has a release-bearing repository model. The project already
has strong product, architecture, testing, design, release, and contribution
docs, plus a repo-specific `cognipace-bulletproof-react` skill for architecture
ownership decisions. The remaining gap is cross-agent consistency.

Codex currently reads `AGENTS.md`. Claude does not yet have a checked-in
`CLAUDE.md`. The repo has `.agents/skills`, but the current CogniPace-specific
skill focuses on Bulletproof React architecture and does not define the full
lifecycle for design, planning, implementation, validation, PR summaries, issue
links, release impact, and handoff proof.

This spec defines the desired operating model for AI-assisted CogniPace work
across Codex, Claude, and future agents. The intent is not to add ceremony for
its own sake. The intent is to keep release-bearing work consistent, auditable,
and mechanically enforceable where possible.

## Goals

- Make CogniPace-specific agent behavior consistent across tools.
- Ensure all non-trivial work starts from the correct docs and skills.
- Require design and planning before implementation for behavior, architecture,
  runtime, UI, release, CI, governance, and agent-workflow changes.
- Make validation impossible to hand-wave.
- Require PR-ready summaries, semantic titles, issue context, risk notes, and
  release impact when relevant.
- Connect agent workflow rules to future PR hygiene and CI enforcement.
- Keep the workflow strict enough for releases without making typo-level work
  unnecessarily heavy.

## Non-Goals

- Do not implement `CLAUDE.md`, `AGENTS.md`, skill, workflow, or template changes
  in this design pass.
- Do not replace Superpowers.
- Do not replace `cognipace-bulletproof-react`.
- Do not create a generic agent framework for other repositories.
- Do not let agent process rules approve product scope, Chrome permissions,
  hosted services, accounts, or broad architecture changes.
- Do not rely on agent promises where CI, branch protection, PR templates, or
  repository tests can enforce the rule.

## Authority

Agents must treat these files as current authority:

- `docs/product.md`: product behavior, scope, non-goals, and future candidates.
- `docs/architecture.md`: source layout, runtime boundaries, data flow, and
  change recipes.
- `docs/testing.md`: manual smoke flows and validation expectations.
- `design.md`: visual and interaction direction.
- `CONTRIBUTING.md`: contribution, review, validation, and release expectations.
- `AGENTS.md`: current Codex-facing operating contract.
- `.agents/skills/cognipace-bulletproof-react/SKILL.md`: CogniPace-specific
  architecture ownership lens.
- `docs/superpowers/README.md`: planning artifact index and historical context.

Planning artifacts under `docs/superpowers/*` are useful history. They do not
override current product, architecture, testing, design, or contribution docs
unless current docs explicitly say so.

## Required Agent Lifecycle

### 1. Orient

Before substantial work, agents read the current authority docs that match the
change:

- Always start with `README.md`, `docs/product.md`, `docs/architecture.md`,
  `docs/testing.md`, `design.md`, `CONTRIBUTING.md`, and `docs/superpowers/README.md`
  for broad work.
- For code ownership, runtime, database, routing, popup, dashboard, overlay,
  sync, GenAI, release, CI, or governance changes, read the directly relevant
  sections before proposing edits.
- For historical plans or previous decisions, use `docs/superpowers/*` as
  context only after checking current docs.

### 2. Select Skills

Agents must use explicit skills rather than improvising from memory.

Required skill rules:

- Use `superpowers:brainstorming` before creative work, behavior changes,
  feature changes, architecture changes, repo governance changes, CI changes,
  release changes, or agent workflow changes.
- Use `cognipace-bulletproof-react` when reviewing, planning, or implementing
  React architecture, feature ownership, runtime boundaries, import direction,
  popup responsibilities, dashboard responsibilities, overlay responsibilities,
  or Bulletproof React decisions in CogniPace.
- Use documentation lookup skills such as Context7 when answering current
  library, framework, SDK, API, CLI, or cloud-service questions.
- Use implementation-specific skills only when the task reaches that boundary:
  `vitest` for test design, `zod` for runtime validation, `drizzle-orm` or
  `drizzle-migrations` for database work, `tanstack-query` for query and
  invalidation work, and appropriate React composition skills for component API
  work.

Agents should not load unrelated skills just because they exist. Skill use
should match the affected ownership boundary.

### 3. Design Before Implementation

Agents must not jump from request to code for substantial work.

Design is required before implementation for:

- product behavior
- feature behavior
- runtime messaging
- database schema or persistence
- popup, dashboard, or overlay workflow
- sync, backup, restore, GenAI, or secret-handling behavior
- extension permissions
- CI, release, branch protection, PR hygiene, issue templates, or governance
- agent workflow or skill changes
- architecture ownership or dependency direction changes

Small docs-only fixes may use a short stated design instead of a full spec, but
the agent still must keep docs honest and run the appropriate formatting check.

### 4. Plan Phase Work

Multi-step work must become a plan before implementation.

Rules:

- Use one master design when the end-state spans multiple systems.
- Use phase-sized implementation plans for execution.
- Do not execute broad repo-hardening, release, CI, feature, or agent-governance
  work in one uncontrolled pass.
- Prefer separate chats or threads for independent implementation phases so each
  phase has a clean context and review boundary.
- Keep each plan tied to exact files, validation commands, and done-when
  criteria.

### 5. Implement Within Ownership Boundaries

CogniPace code must preserve the existing dependency direction:

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
- Feature writes must broadcast correct invalidation tags after persistence.
- New Chrome permissions require explicit human approval.

Agents should prefer current feature patterns over new architecture layers.

## No Silent Validation

Agents must list every validation command they ran, every command they skipped,
and why. The following phrases are not acceptable as validation proof on their
own:

- "looks good"
- "tested locally"
- "checks pass"
- "validated"
- "should work"

Validation proof must name exact commands and, when relevant, exact affected
manual smoke flows. If a required command could not be run, the agent must state
that clearly in the handoff and PR summary with the reason.

## Validation Matrix

### Docs Or Governance Only

Required:

```sh
npx prettier --check <touched markdown files>
```

Use this for docs-only and governance-only changes until the repository-wide
formatting scope is fixed. After that Phase 1 hardening work lands,
`npm run format` should also be valid for repository-wide formatting proof.

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
- explicit note about sender authorization, Zod parsing, secret redaction, cache
  invalidation, and sync side effects when touched
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

### Formatting

Current required docs formatting proof:

```sh
npx prettier --check <touched markdown files>
```

Future required full formatting proof after formatting scope is fixed:

```sh
npm run format
```

Agents must not claim repository formatting passed while the current known
repository-wide formatting scope remains unresolved.

## PR And Commit Requirements

### Commit Messages And PR Titles

Use Conventional Commit format:

```text
<type>(optional-scope): short summary
```

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

Because CogniPace uses squash merge, the pull request title is the release
signal that Release Please reads.

### PR Summary

Agent-authored PR summaries must include:

- why the change exists
- what changed
- issue link or documented exception
- validation commands run
- validation commands skipped and why
- risk areas touched
- release impact
- rollback or recovery notes when relevant
- screenshots or recordings for visible UI changes, or why not applicable

Agent handoffs inside chat should use the same standard. A change is not ready
for PR if the agent cannot explain what was validated.

## Issue Creation Rules

Agents may create or propose issues only when the request needs tracked work.

Issue content should include:

- problem or request
- why it matters
- affected surface or ownership area
- done-when criteria
- relevant constraints
- suggested validation
- links to relevant docs, specs, plans, or PRs

Agents must not use issues to approve new product scope. Product behavior still
comes from explicit human approval and current product docs.

## Cross-Agent Parity

The final implementation should make Codex and Claude follow the same operating
model.

Expected files:

- `AGENTS.md`: Codex-facing entrypoint.
- `CLAUDE.md`: Claude-facing entrypoint.
- `.agents/skills/cognipace-bulletproof-react/SKILL.md`: CogniPace architecture
  ownership skill.
- A future CogniPace agent workflow skill or guide that composes Superpowers,
  `cognipace-bulletproof-react`, validation, PR metadata, issue rules, and
  release constraints.

`AGENTS.md` and `CLAUDE.md` should point to the same canonical rules. Tool
specific phrasing can differ, but the required process, validation, and PR
standards should not drift.

## Enforcement Model

Documentation is necessary but not sufficient. Anything important should move
toward mechanical enforcement.

Future enforcement targets:

- PR title validation for semantic titles.
- PR hygiene checks for summary sections, validation proof, issue links, and
  placeholders.
- Required CI checks for `lint`, `check`, `build`, formatting, and dependency
  review.
- Branch protection so failing checks block merge.
- Architecture-boundary tests for dependency direction, permissions, secret
  handling, and runtime ownership.
- CODEOWNERS or sensitive-path review gates where ownership is meaningful.

Agents should treat docs as the operating contract and CI as the merge gate.

## Implementation Phases

### Phase A: Agent Authority Docs

Status: implemented in `AGENTS.md`, `CLAUDE.md`, and
`docs/agent-governance.md`.

Goals:

- Align Codex and Claude around the same CogniPace operating model.
- Make agent expectations visible at the repo root.

Steps:

1. Update `AGENTS.md` with the required lifecycle and validation matrix.
2. Add `CLAUDE.md` with equivalent rules for Claude.
3. Link both files to current authority docs and relevant skills.
4. Update `CONTRIBUTING.md` if needed so human and agent expectations align.

Done when:

- Codex and Claude have equivalent root-level instructions.
- Neither tool can plausibly miss the validation, PR, release, or skill rules.

### Phase B: CogniPace Agent Workflow Skill

Status: implemented in `.agents/skills/cognipace-agent-workflow/SKILL.md`.

Goals:

- Compose Superpowers process discipline with CogniPace-specific architecture
  and release rules.
- Give agents one obvious local skill to use for CogniPace work.

Steps:

1. Decide whether to extend `cognipace-bulletproof-react` or add a sibling
   `cognipace-agent-workflow` skill.
2. Include the required lifecycle, skill selection rules, validation matrix, PR
   summary rules, and issue rules.
3. Keep architecture ownership details in `cognipace-bulletproof-react` unless a
   new wrapper skill explicitly delegates to it.
4. Add references for validation by change type and PR summary examples.

Done when:

- Agents have a single CogniPace workflow skill for non-trivial work.
- Architecture-specific guidance remains precise and not diluted.

### Phase C: Validation And Smoke Documentation

Status: implemented in `docs/agent-governance.md`.

Goals:

- Make exact validation expectations easy to follow.
- Close the gap where agents skip running or loading affected surfaces.

Steps:

1. Add a validation-by-change-type table to `AGENTS.md`, `CLAUDE.md`, or a
   shared referenced doc.
2. Clarify when `npm run lint`, `npm run check`, `npm run build`, `npm run zip`,
   `npm run db:check`, and `npm run db:generate` apply.
3. Clarify manual smoke expectations for popup, dashboard, overlay, background,
   sync, GenAI, release, and extension packaging changes.
4. Require agents to state when app loading or smoke validation was not
   performed.

Done when:

- Agents can map changed files and risk areas to required validation commands.
- PR summaries no longer hide skipped validation.

### Phase D: PR And Issue Governance Integration

Status: implemented in `.github/PULL_REQUEST_TEMPLATE.md` and
`.github/ISSUE_TEMPLATE/*`.

Goals:

- Make agent output match the future PR and issue templates.
- Reduce missing summaries, missing issue context, and missing validation proof.

Steps:

1. Ensure PR template fields match the agent PR summary requirements.
2. Ensure issue templates match the issue creation rules.
3. Add examples of acceptable validation summaries.
4. Add examples of unacceptable validation summaries.

Done when:

- Agent handoffs can be copied into PR summaries with minimal rewriting.
- PRs created by agents contain reviewable context by default.

### Phase E: Mechanical Enforcement

Status: implemented for repository-owned checks in `.github/workflows/*` and
`.github/labeler.yml`; branch protection remains a GitHub settings
responsibility.

Goals:

- Enforce the most important agent rules automatically.
- Keep enforcement simple and auditable.

Steps:

1. Add PR hygiene automation for required PR sections.
2. Reject placeholder or empty validation sections.
3. Require issue links except documented exceptions.
4. Detect sensitive paths and require risk notes.
5. Require semantic PR titles.
6. Use branch protection to block failed checks.

Done when:

- Agents cannot merge PRs that omit required context or validation proof.
- Critical rules are enforced by GitHub rather than memory.

### Phase F: Drift Audit

Status: implemented in `docs/agent-governance.md`.

Goals:

- Keep agent docs, skills, and CI aligned as the repository evolves.

Steps:

1. Add a periodic audit checklist for `AGENTS.md`, `CLAUDE.md`, local skills,
   PR templates, issue templates, CI workflows, and branch protection.
2. Review after the first release cycle using the hardened model.
3. Remove or simplify rules that create noise without improving release safety.
4. Add new mechanical checks only after repeated human-review misses.

Done when:

- Agent governance stays current with the repo.
- Process remains strict but not bloated.

## Acceptance Criteria

The agent governance program is complete when:

- Codex and Claude have equivalent root-level instructions.
- CogniPace has a local agent workflow skill or guide that composes
  Superpowers, `cognipace-bulletproof-react`, validation, PR, issue, and release
  rules.
- Agents must explicitly report `npm run lint`, `npm run check`, `npm run build`,
  formatting checks, focused tests, DB checks, or `npm run zip` according to the
  validation matrix.
- Agents must state skipped validation and why.
- Agent PR summaries include why, changes, issue link, validation, skipped
  validation, risk, release impact, rollback notes when relevant, and visual
  proof when applicable.
- PR hygiene automation enforces mechanically checkable summary and validation
  requirements.
- Branch protection blocks failed required checks.
- Agent docs and local skills are reviewed after the first release cycle and on
  a recurring cadence.
