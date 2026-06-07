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
- `.agents/skills/cognipace-agent-workflow/SKILL.md`: CogniPace workflow,
  validation, PR/issue, governance, and agent-process routing skill.
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

- Use `cognipace-agent-workflow` as the first repo-local skill for non-trivial
  CogniPace work involving product behavior, feature changes, runtime,
  database, UI surfaces, sync, GenAI, CI, release, governance, PR/issue
  workflow, validation, or agent-process changes.
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
- remaining validation risk
- risk areas touched
- manual testing checklist for affected smoke flows when relevant
- release impact
- rollback or recovery notes when relevant
- screenshots or recordings for visible UI changes, or why visual proof is not
  applicable

## Validation Selection

Choose validation by risk area, not only by file extension.

1. Identify every touched risk area.
2. Select every matching validation category in the matrix below.
3. When categories overlap, use the strictest required command set.
4. Add focused tests for touched behavior when feasible.
5. Add the affected manual smoke checklist when extension surfaces or background
   workflows are touched.
6. In the handoff, list exact commands run, exact commands skipped, why each
   skipped command was skipped, and remaining validation risk.

Visible popup/dashboard/overlay changes use both the UI and surface rows.

| Changed area                          | Validation category                                    | Notes                                              |
| ------------------------------------- | ------------------------------------------------------ | -------------------------------------------------- |
| Docs/governance/planning Markdown     | Docs or governance only                                | Run Prettier on touched Markdown.                  |
| Feature code without surface effects  | Normal code change                                     | Run focused tests when feasible, then lint/check.  |
| Visible React UI                      | UI change                                              | Add focused tests and visual proof/skipped reason. |
| Popup/dashboard/overlay behavior      | Popup, dashboard, or overlay behavior                  | Add build and manual smoke checklist.              |
| Runtime/background/sync/GenAI/secrets | Runtime messaging, background, sync, GenAI, or secrets | Include notifications and cache effects.           |
| Database/schema/persisted shape       | Database or schema change                              | Add DB checks, migrations, and persistence tests.  |
| Release/CI/package/extension build    | Release, CI, package, or extension build workflow      | Add build/zip proof or static-review reason.       |

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
- manual testing checklist for the affected popup, dashboard, or overlay smoke
  flow when relevant

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
- manual testing checklist for the affected extension surface smoke flow
- state if the manual smoke checklist is not relevant, such as for docs-only
  changes

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

## Manual Smoke Checklist

Use `docs/testing.md` for exact manual smoke flows. Agents do not own manual
browser smoke testing by default. For feature, surface, runtime, sync, GenAI,
release, package, or extension-build changes, agents should add the relevant
manual testing checklist to the PR description so the engineer can complete it
before squash and merge.

- Popup changes should include the extension popup smoke checklist.
- Dashboard route or dashboard workflow changes should include the affected
  dashboard smoke checklist.
- Overlay changes should include the LeetCode problem-page smoke checklist.
- Background, sync, GenAI, notification, secret, or runtime changes should
  include the relevant hidden `/dev/smoke`, service-worker, or focused manual
  flow checklist.
- Release, CI, package, or extension build changes should include any relevant
  release or artifact manual checks, plus whether automated workflow validation
  was local, dry-run PR, or static review only.

If a relevant manual smoke checklist is not included, explain why. Acceptable
reasons include docs-only changes, static-only CI workflow review with no
runtime surface, or no affected user-facing/manual flow. Vague claims such as
"not tested" or "should work" are not sufficient.

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
