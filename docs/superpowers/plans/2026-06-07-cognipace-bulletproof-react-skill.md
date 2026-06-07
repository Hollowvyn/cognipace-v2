# CogniPace Bulletproof React Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new project-local `cognipace-bulletproof-react` skill that applies Bulletproof React principles through CogniPace's actual extension architecture, enforced boundaries, and supporting references.

**Architecture:** Create a concise `SKILL.md` that encodes the repo's primary ownership and boundary rules, then push detailed material into focused `references/` files. Treat CogniPace docs, boundary tests, and lint rules as primary authority, with upstream Bulletproof React docs discoverable as secondary reference material.

**Tech Stack:** Markdown skills, local skill scaffolding helpers, repo architecture docs, Python validation script

---

### Task 1: Capture RED Baseline Against The Existing Generic Skill

**Files:**

- Modify: `docs/superpowers/plans/2026-06-07-cognipace-bulletproof-react-skill.md`
- Read: `.agents/skills/bulletproof-react-auditor/SKILL.md`
- Read: `docs/architecture.md`
- Read: `CONTRIBUTING.md`
- Read: `src/testing/architecture-boundaries.test.ts`

- [x] **Step 1: Re-read the current generic skill and repo authority files**

Run:

```bash
rtk sed -n '1,240p' .agents/skills/bulletproof-react-auditor/SKILL.md
rtk sed -n '1,260p' docs/architecture.md
rtk sed -n '1,240p' CONTRIBUTING.md
rtk sed -n '1,260p' src/testing/architecture-boundaries.test.ts
```

Expected: enough context to compare generic Bulletproof React guidance against
CogniPace's actual rules.

- [x] **Step 2: Use these three RED prompts as the failure baseline**

Prompts:

```text
Audit where a new runtime message for the overlay timer should live in CogniPace.
Review whether a popup component can write to the DB directly in this repo.
Plan where a new analytics mutation and invalidation flow belongs in CogniPace.
```

Expected baseline failures to confirm:

```text
- generic feature-folder advice without extension/runtime specifics
- no primary reliance on docs/architecture.md or CONTRIBUTING.md
- no mention of Zod parsing at runtime boundaries
- weak or missing guidance on owning repository/service and invalidation flow
- no use of architecture-boundaries.test.ts or eslint.config.js as evidence
```

RED findings:

- Prompt 1 (`overlay timer runtime message`): the generic skill only offers
  generic feature-folder guidance (`api`, `components`, `hooks`, `stores`,
  `types`) plus a broad "API Layer" category around a centralized client and
  server cache. It does not describe CogniPace's runtime-message path from
  `docs/architecture.md`: feature contract in
  `src/features/*/api/*-contracts.ts` -> `src/extension/messaging.ts` ->
  `src/extension/background/runtime-policy.ts` ->
  `src/extension/background/register-handlers.ts` -> feature `server` service,
  with Zod request/response parsing and sender authorization at the boundary.
  This confirmed missing runtime-boundary guidance.
- Prompt 2 (`popup DB write ownership`): the generic skill does not say that UI
  surfaces must not write to the DB directly. `CONTRIBUTING.md` states that UI
  and content scripts should not call the database directly, and
  `docs/architecture.md` says `src/app` composes surfaces while writes stay
  behind the owning feature's `server` service or repository. This confirmed
  missing write-ownership guidance for popup work.
- Prompt 3 (`analytics mutation and invalidation flow`): the generic skill
  mentions server cache and centralized API concerns, but it does not capture
  CogniPace's mutation path in `docs/architecture.md`: runtime command -> DB
  write -> dirty mark for local mutations -> snapshot flush -> invalidation
  broadcast -> safe automatic push scheduling -> query refetch. It also misses
  that `analytics` is described as local read models in the architecture docs,
  so a new mutation should live with the owning write feature rather than the
  dashboard read surface. This confirmed missing ownership and invalidation-flow
  guidance.
- Enforcement evidence missing from the generic skill: it does not reference
  `src/testing/architecture-boundaries.test.ts` or `eslint.config.js`, even
  though those files act as repo authority for import direction and write
  ownership. The architecture test enforces public feature-surface imports and
  keeps review scheduling writes behind
  `src/features/practice/data/practice-repository.ts`; `eslint.config.js`
  blocks shared code from importing `@/app/*`, `@/features/*`, or
  `@/entrypoints/*`, and blocks feature/extension code from depending on app
  composition. This confirmed missing architecture-test / eslint evidence.

- [x] **Step 3: Record the RED findings inline in this plan before writing the new skill**

Recorded above as the Task 1 failure baseline.

- [x] **Step 4: Commit the RED baseline notes if they changed this plan**

Run:

```bash
git add docs/superpowers/plans/2026-06-07-cognipace-bulletproof-react-skill.md
git commit -m "docs: capture red baseline for cognipace bulletproof skill"
```

Expected: either a small docs commit or no-op if nothing changed.

### Task 2: Scaffold The New Skill Folder

**Files:**

- Create: `.agents/skills/cognipace-bulletproof-react/SKILL.md`
- Create: `.agents/skills/cognipace-bulletproof-react/agents/openai.yaml`
- Create: `.agents/skills/cognipace-bulletproof-react/references/`
- Read: `/Users/tobiolutimehin/.codex/skills/.system/skill-creator/scripts/init_skill.py`

- [ ] **Step 1: Initialize the new skill with the official scaffold script**

Run:

```bash
python /Users/tobiolutimehin/.codex/skills/.system/skill-creator/scripts/init_skill.py \
  cognipace-bulletproof-react \
  --path /Users/tobiolutimehin/WebstormProjects/cognipace-v2/.agents/skills \
  --resources references \
  --interface display_name="CogniPace Bulletproof React" \
  --interface short_description="CogniPace repo-specific React architecture guide" \
  --interface default_prompt='Use $cognipace-bulletproof-react to audit where this change belongs in CogniPace.'
```

Expected: a new folder at
`.agents/skills/cognipace-bulletproof-react` with a generated `SKILL.md`,
`agents/openai.yaml`, and `references/`.

- [ ] **Step 2: Inspect the generated files before editing**

Run:

```bash
find .agents/skills/cognipace-bulletproof-react -maxdepth 3 -type f | sort
sed -n '1,220p' .agents/skills/cognipace-bulletproof-react/SKILL.md
sed -n '1,220p' .agents/skills/cognipace-bulletproof-react/agents/openai.yaml
```

Expected: only the scaffolded files that will be edited in later tasks.

- [ ] **Step 3: Commit the scaffold if it was created cleanly**

Run:

```bash
git add .agents/skills/cognipace-bulletproof-react
git commit -m "chore: scaffold cognipace bulletproof react skill"
```

Expected: a clean scaffold commit before content edits.

### Task 3: Write The Main Skill

**Files:**

- Modify: `.agents/skills/cognipace-bulletproof-react/SKILL.md`
- Read: `docs/product.md`
- Read: `docs/architecture.md`
- Read: `docs/testing.md`
- Read: `CONTRIBUTING.md`

- [ ] **Step 1: Replace the generated frontmatter with trigger-focused frontmatter**

Write:

```markdown
---
name: cognipace-bulletproof-react
description: Use when reviewing, planning, or implementing React architecture changes in the CogniPace repository, especially when deciding feature ownership, runtime boundaries, import direction, popup/dashboard/overlay responsibilities, or how Bulletproof React principles apply to this Chrome MV3 extension.
---
```

- [ ] **Step 2: Write a concise repo-specific overview and primary rule set**

Write these sections into `SKILL.md`:

```markdown
# CogniPace Bulletproof React

Apply Bulletproof React principles through CogniPace's actual extension
architecture, not a generic SPA template.

Treat these as primary authority before making structural recommendations:

- `docs/architecture.md`
- `CONTRIBUTING.md`
- `src/testing/architecture-boundaries.test.ts`
- `eslint.config.js`

Core direction:
`entrypoints -> app -> features -> platform/lib/components`
```

- [ ] **Step 3: Add decision rules for ownership and boundaries**

Write concise guidance covering:

```markdown
- `src/app` composes surfaces and routes; it does not own domain rules or direct persistence.
- `src/features` owns product behavior; writes stay behind the owning repository or server service.
- `src/extension` is the trusted runtime boundary for background work, sender authorization, and handler registration.
- `src/platform` and `src/lib` own infrastructure and integrations.
- `src/components` stays generic; feature UI lives inside the owning feature.
- Runtime payloads are validated with Zod at the extension boundary.
- Compose features at the app layer instead of deep cross-feature imports.
```

- [ ] **Step 4: Add explicit cross-skill composition**

Write:

```markdown
Load other skills only when the task actually reaches those boundaries:

- `context7-mcp` for current library docs
- `zod` for runtime contracts and parsing details
- `tanstack-query` for query/invalidation design
- `drizzle-orm` or `drizzle-migrations` for DB/repository work
- `vitest` for test shape and Testing Library guidance
- `hooks-pattern` or `presentational-container-pattern` for component/controller extraction
```

- [ ] **Step 5: Add the reference navigation block**

Write:

```markdown
Read these references as needed:

- `references/cognipace-ownership-map.md`
- `references/cognipace-boundary-rules.md`
- `references/bulletproof-react-deltas.md`
- `references/bulletproof-react-upstream-map.md`
```

- [ ] **Step 6: Commit the main skill body**

Run:

```bash
git add .agents/skills/cognipace-bulletproof-react/SKILL.md
git commit -m "docs: write cognipace bulletproof react skill"
```

Expected: the skill now triggers correctly and stays concise.

### Task 4: Write The Reference Files

**Files:**

- Create: `.agents/skills/cognipace-bulletproof-react/references/cognipace-ownership-map.md`
- Create: `.agents/skills/cognipace-bulletproof-react/references/cognipace-boundary-rules.md`
- Create: `.agents/skills/cognipace-bulletproof-react/references/bulletproof-react-deltas.md`
- Create: `.agents/skills/cognipace-bulletproof-react/references/bulletproof-react-upstream-map.md`

- [ ] **Step 1: Write `cognipace-ownership-map.md`**

Include:

```markdown
# CogniPace Ownership Map

- Popup, dashboard, overlay, and background are separate runtime surfaces.
- `src/app` owns composition.
- `src/features/app-shell` owns surface read models.
- `src/features/practice` owns review scheduling writes.
- `src/features/settings` owns persisted preferences and settings form behavior.
- `src/features/sync` owns GitHub Gist sync behavior.
- `src/features/analytics` owns read-only review-health models.
- `src/features/overlay-session` owns overlay workflow state.
```

- [ ] **Step 2: Write `cognipace-boundary-rules.md` from docs, lint, and architecture tests**

Include:

```markdown
# CogniPace Boundary Rules

- Shared code must not import `@/app/*`, `@/features/*`, or `@/entrypoints/*`.
- Feature code must not depend on `@/app/*` or `@/entrypoints/*`.
- App and cross-feature imports must use public feature surfaces, not deep private internals.
- Review scheduling writes stay behind `features/practice/data/practice-repository.ts`.
- The `apiKey` literal stays isolated to `features/genai`.
- Queue stays free of tracks imports.
- Settings UI must not call alarms or notifications APIs directly.
```

- [ ] **Step 3: Write `bulletproof-react-deltas.md`**

Include:

```markdown
# CogniPace vs Generic Bulletproof React

- Extension runtime messaging is first-class architecture here.
- The background worker is part of the app architecture, not an implementation detail.
- TanStack Query caches runtime-backed reads; SQLite plus background services remain the source of truth.
- Avoid default recommendations for Redux, Zustand, HOCs, render props, SSR, or RSC unless the repo shape changes.
```

- [ ] **Step 4: Write `bulletproof-react-upstream-map.md`**

Include:

```markdown
# Upstream Bulletproof React Map

Use upstream docs as secondary references:

- Project Structure: feature ownership and import direction
- API Layer: request declarations and typed data boundaries
- State Management: local vs app vs server-cache state
- Components And Styling: colocation, composition, shared UI extraction
- Testing: integration-first philosophy

If upstream guidance conflicts with CogniPace docs, prefer CogniPace docs and enforced repo boundaries.
```

- [ ] **Step 5: Commit the reference files**

Run:

```bash
git add .agents/skills/cognipace-bulletproof-react/references
git commit -m "docs: add cognipace bulletproof react references"
```

Expected: the detail is available without bloating `SKILL.md`.

### Task 5: Validate And Run GREEN Checks

**Files:**

- Modify: `.agents/skills/cognipace-bulletproof-react/SKILL.md`
- Modify: `.agents/skills/cognipace-bulletproof-react/references/*.md`
- Test: `/Users/tobiolutimehin/.codex/skills/.system/skill-creator/scripts/quick_validate.py`

- [ ] **Step 1: Validate the skill structure**

Run:

```bash
python /Users/tobiolutimehin/.codex/skills/.system/skill-creator/scripts/quick_validate.py \
  .agents/skills/cognipace-bulletproof-react
```

Expected: validation passes with correct frontmatter and skill naming.

- [ ] **Step 2: Run a formatting pass over the new Markdown files**

Run:

```bash
rtk npx prettier --write \
  .agents/skills/cognipace-bulletproof-react/SKILL.md \
  .agents/skills/cognipace-bulletproof-react/references/*.md
```

Expected: Markdown is formatted with no syntax regressions.

- [ ] **Step 3: Re-run the GREEN prompts against the new skill**

Use the same prompts from Task 1 and confirm the answers now:

```text
- identify the owning feature or layer
- cite runtime boundary and Zod parsing when relevant
- use docs/architecture.md, CONTRIBUTING.md, boundary tests, or eslint rules as evidence
- recommend supporting skills only when the task truly reaches those areas
```

- [ ] **Step 4: Tighten the skill if any GREEN answer is still generic**

If the skill misses a rule, patch `SKILL.md` or the appropriate reference with
the missing instruction before proceeding.

- [ ] **Step 5: Commit the validated result**

Run:

```bash
git add .agents/skills/cognipace-bulletproof-react
git commit -m "feat: add cognipace bulletproof react skill"
```

Expected: the final skill is validated, repo-specific, and ready to use.

## Self-Review

- Spec coverage: includes the new skill, repo-primary authority, upstream-docs
  discoverability, and RED/GREEN validation.
- Placeholder scan: no TODO or TBD markers remain.
- Type consistency: skill name, file paths, and reference names match the
  approved spec.

## Execution Handoff

Plan complete and saved to
`docs/superpowers/plans/2026-06-07-cognipace-bulletproof-react-skill.md`.

Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
