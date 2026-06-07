# CogniPace Agent Workflow Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a concise repo-local `cognipace-agent-workflow` skill that routes
non-trivial CogniPace work through governance, skill selection, validation, and
PR-ready handoffs.

**Architecture:** The new skill is a router, not a duplicate governance doc.
`docs/agent-governance.md` remains canonical, and
`cognipace-bulletproof-react` remains the delegated architecture skill. Because
this creates a skill, implementation must follow `superpowers:writing-skills`
with a RED/GREEN/REFACTOR loop before deploying the skill.

**Tech Stack:** Markdown, repo-local `.agents/skills`, Superpowers skill
authoring workflow, Prettier.

---

## File Structure

- Create `.agents/skills/cognipace-agent-workflow/SKILL.md`: concise workflow
  router with trigger-focused frontmatter, start checklist, hard gates, skill
  routing, validation router, and handoff checklist.
- Modify `AGENTS.md`: Codex-facing root guide that names
  `cognipace-agent-workflow` as the first local skill for non-trivial CogniPace
  work.
- Modify `CLAUDE.md`: Claude-facing root guide with the same local-skill
  expectation.
- Modify `docs/agent-governance.md`: canonical lifecycle skill-selection rules
  that name `cognipace-agent-workflow` and keep
  `cognipace-bulletproof-react` delegated to architecture decisions.
- Modify `docs/superpowers/README.md`: index this implementation plan.
- Modify `docs/superpowers/plans/2026-06-07-cognipace-agent-workflow-skill.md`:
  record the RED baseline findings before drafting the skill.

## Task 1: RED Baseline For The New Workflow Skill

**Files:**

- Modify: `docs/superpowers/plans/2026-06-07-cognipace-agent-workflow-skill.md`
- Read: `/Users/tobiolutimehin/.codex/superpowers/skills/writing-skills/SKILL.md`
- Read: `/Users/tobiolutimehin/.codex/superpowers/skills/test-driven-development/SKILL.md`
- Read: `docs/agent-governance.md`
- Read: `AGENTS.md`
- Read: `CLAUDE.md`
- Read: `.agents/skills/cognipace-bulletproof-react/SKILL.md`

- [ ] **Step 1: Re-read the required skill-authoring background**

Run:

```bash
sed -n '1,260p' /Users/tobiolutimehin/.codex/superpowers/skills/writing-skills/SKILL.md
sed -n '1,220p' /Users/tobiolutimehin/.codex/superpowers/skills/test-driven-development/SKILL.md
```

Expected: confirm the Iron Law for skills: no skill without a failing baseline
test first.

- [ ] **Step 2: Re-read current workflow and architecture authorities**

Run:

```bash
sed -n '1,260p' docs/agent-governance.md
sed -n '1,220p' AGENTS.md
sed -n '1,220p' CLAUDE.md
sed -n '1,220p' .agents/skills/cognipace-bulletproof-react/SKILL.md
```

Expected: confirm the current state has root governance docs and an
architecture skill, but no sibling workflow skill.

- [ ] **Step 3: Run these RED pressure scenarios without the new skill**

Use a fresh agent/subagent if available. The prompt must not mention or provide
`cognipace-agent-workflow`, because it does not exist yet.

Scenario 1:

```text
You are in /Users/tobiolutimehin/WebstormProjects/cognipace-v2. Plan a non-trivial CogniPace runtime messaging change for the popup. What docs and skills do you use before implementation, what gates apply, and what validation/handoff proof is required?
```

Scenario 2:

```text
You are in /Users/tobiolutimehin/WebstormProjects/cognipace-v2. A user asks for a quick docs/governance tweak and says not to spend time on process. Decide whether a design/plan is required, what can be skipped, and how to report validation.
```

Scenario 3:

```text
You are in /Users/tobiolutimehin/WebstormProjects/cognipace-v2. A user asks you to add a new repo-local skill for CogniPace work. What workflow do you follow before writing the SKILL.md file?
```

Expected baseline failures to look for:

```text
- No single obvious repo-local workflow skill is identified for non-trivial CogniPace work.
- Agent routes directly to implementation or root docs without a phase-sized plan.
- Agent uses cognipace-bulletproof-react for all governance questions instead of only architecture/surface-boundary questions.
- Agent misses superpowers:writing-skills when asked to create a new skill.
- Agent gives generic validation claims instead of exact commands run/skipped and remaining risk.
```

- [ ] **Step 4: Record the RED findings in this plan**

Append this section below Task 1 after running the scenarios:

```markdown
### RED Baseline Findings

- Scenario 1 showed that the current guidance did not provide one obvious
  repo-local workflow skill for non-trivial CogniPace work. The agent should
  have routed through `docs/agent-governance.md`, then selected
  `superpowers:brainstorming`, phase planning, and boundary-specific skills.
- Scenario 2 showed whether the agent could distinguish a trivial docs fix from
  substantial governance work while still reporting exact docs-only validation.
- Scenario 3 showed whether the agent remembered to use
  `superpowers:writing-skills` and its RED/GREEN/REFACTOR loop before drafting
  a new `SKILL.md`.
```

If any scenario does not fail, record the actual passing behavior and still use
the scenario as a regression check in Task 5.

- [ ] **Step 5: Commit the RED baseline record**

Run:

```bash
git add docs/superpowers/plans/2026-06-07-cognipace-agent-workflow-skill.md
git commit -m "docs(agent-governance): capture workflow skill red baseline"
```

Expected: one docs commit containing the recorded RED findings.

## Task 2: GREEN Draft The Workflow Skill

**Files:**

- Create: `.agents/skills/cognipace-agent-workflow/SKILL.md`
- Read: `docs/superpowers/specs/2026-06-07-cognipace-agent-workflow-skill-design.md`
- Read: `docs/agent-governance.md`

- [ ] **Step 1: Create the skill folder**

Run:

```bash
mkdir -p .agents/skills/cognipace-agent-workflow
```

Expected: `.agents/skills/cognipace-agent-workflow` exists.

- [ ] **Step 2: Write the minimal skill that closes the RED failures**

Create `.agents/skills/cognipace-agent-workflow/SKILL.md` with this content:

```markdown
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

| Mistake                                                           | Correction                                                                                     |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Using `cognipace-bulletproof-react` for every governance question | Use it only for architecture, ownership, runtime-boundary, and surface-boundary decisions.     |
| Copying the validation matrix into this skill                     | Keep the matrix in `docs/agent-governance.md`; route agents there.                             |
| Treating a planning artifact as current authority                 | Check current product, architecture, testing, design, contribution, and governance docs first. |
| Creating or editing a skill directly                              | Use `superpowers:writing-skills` and record baseline pressure scenarios first.                 |
| Saying validation was skipped without naming commands             | List exact skipped commands and reasons.                                                       |
```

Expected: the skill description is trigger-focused and does not summarize the
workflow; the body is concise and operational.

- [ ] **Step 3: Commit the new skill**

Run:

```bash
git add .agents/skills/cognipace-agent-workflow/SKILL.md
git commit -m "docs(agent-governance): add cogniPace workflow skill"
```

Expected: one commit containing only the new skill.

## Task 3: Add Minimal Root Doc References

**Files:**

- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`
- Modify: `docs/agent-governance.md`

- [ ] **Step 1: Update `AGENTS.md` hard gates**

In `AGENTS.md`, add this bullet at the top of `## Hard Gates`:

```markdown
- Use `cognipace-agent-workflow` as the first repo-local skill for non-trivial
  CogniPace work.
```

Expected: Codex sees the workflow skill before the narrower architecture skill.

- [ ] **Step 2: Add a local skills section to `AGENTS.md`**

Add this section after `## Hard Gates` and before `## Context7`:

```markdown
## Skills

Use repo-local skills under `.agents/skills` when they match the work:

- `.agents/skills/cognipace-agent-workflow/SKILL.md` for non-trivial CogniPace
  workflow, validation, PR/issue, governance, and agent-process work.
- `.agents/skills/cognipace-bulletproof-react/SKILL.md` for CogniPace
  architecture ownership, runtime boundaries, dependency direction, and
  popup/dashboard/overlay responsibility decisions.
```

Expected: `AGENTS.md` names both local skills without duplicating their content.

- [ ] **Step 3: Update `CLAUDE.md` hard gates**

In `CLAUDE.md`, add this bullet at the top of `## Hard Gates`:

```markdown
- Use `cognipace-agent-workflow` as the first repo-local skill for non-trivial
  CogniPace work.
```

Expected: Claude has equivalent root-level guidance.

- [ ] **Step 4: Update the existing `CLAUDE.md` skills section**

Replace the current `## Skills` section in `CLAUDE.md` with:

```markdown
## Skills

Use repo-local skills under `.agents/skills` when they match the work:

- `.agents/skills/cognipace-agent-workflow/SKILL.md` for non-trivial CogniPace
  workflow, validation, PR/issue, governance, and agent-process work.
- `.agents/skills/cognipace-bulletproof-react/SKILL.md` for CogniPace
  architecture ownership, runtime boundaries, dependency direction, and
  popup/dashboard/overlay responsibility decisions.

Use documentation lookup tooling for current library, framework, SDK, API, CLI,
or cloud-service questions. Resolve the library first, then query current docs.
```

Expected: Claude no longer lists only the architecture skill.

- [ ] **Step 5: Update `docs/agent-governance.md` authority list**

In `docs/agent-governance.md`, add this authority bullet before
`.agents/skills/cognipace-bulletproof-react/SKILL.md`:

```markdown
- `.agents/skills/cognipace-agent-workflow/SKILL.md`: CogniPace workflow,
  validation, PR/issue, governance, and agent-process routing skill.
```

Expected: the canonical governance doc lists the new workflow skill.

- [ ] **Step 6: Update `docs/agent-governance.md` skill selection rules**

In `docs/agent-governance.md`, under `### 2. Select Skills`, add this bullet
before the `superpowers:brainstorming` bullet:

```markdown
- Use `cognipace-agent-workflow` as the first repo-local skill for non-trivial
  CogniPace work involving product behavior, feature changes, runtime,
  database, UI surfaces, sync, GenAI, CI, release, governance, PR/issue
  workflow, validation, or agent-process changes.
```

Expected: the canonical lifecycle names the workflow skill while retaining all
existing Superpowers and architecture-skill rules.

- [ ] **Step 7: Commit the root doc references**

Run:

```bash
git add AGENTS.md CLAUDE.md docs/agent-governance.md
git commit -m "docs(agent-governance): reference workflow skill"
```

Expected: one commit containing only minimal discoverability references.

## Task 4: Index The Plan And Run Formatting

**Files:**

- Modify: `docs/superpowers/README.md`
- Check: `.agents/skills/cognipace-agent-workflow/SKILL.md`
- Check: `AGENTS.md`
- Check: `CLAUDE.md`
- Check: `docs/agent-governance.md`
- Check: `docs/superpowers/plans/2026-06-07-cognipace-agent-workflow-skill.md`

- [ ] **Step 1: Add this implementation plan to the plans index**

In `docs/superpowers/README.md`, add this entry under `## Plans` near the other
2026-06-07 plans:

```markdown
- [`plans/2026-06-07-cognipace-agent-workflow-skill.md`](./plans/2026-06-07-cognipace-agent-workflow-skill.md): implementation plan for adding the concise CogniPace workflow skill, writing-skills RED/GREEN/REFACTOR checks, and minimal root doc references.
```

Expected: future agents can find the Phase B implementation plan.

- [ ] **Step 2: Run Prettier over every touched Markdown file**

Run:

```bash
npx prettier --check .agents/skills/cognipace-agent-workflow/SKILL.md AGENTS.md CLAUDE.md docs/agent-governance.md docs/superpowers/README.md docs/superpowers/plans/2026-06-07-cognipace-agent-workflow-skill.md
```

Expected: PASS.

- [ ] **Step 3: If Prettier fails, format the touched Markdown files**

Run:

```bash
npx prettier --write .agents/skills/cognipace-agent-workflow/SKILL.md AGENTS.md CLAUDE.md docs/agent-governance.md docs/superpowers/README.md docs/superpowers/plans/2026-06-07-cognipace-agent-workflow-skill.md
npx prettier --check .agents/skills/cognipace-agent-workflow/SKILL.md AGENTS.md CLAUDE.md docs/agent-governance.md docs/superpowers/README.md docs/superpowers/plans/2026-06-07-cognipace-agent-workflow-skill.md
```

Expected: final check PASS.

- [ ] **Step 4: Commit the plan index and any formatting-only changes**

Run:

```bash
git add docs/superpowers/README.md .agents/skills/cognipace-agent-workflow/SKILL.md AGENTS.md CLAUDE.md docs/agent-governance.md docs/superpowers/plans/2026-06-07-cognipace-agent-workflow-skill.md
git commit -m "docs(agent-governance): index workflow skill plan"
```

Expected: commit only if there are remaining staged changes.

## Task 5: GREEN/REFACTOR Verify The Skill Against Pressure Scenarios

**Files:**

- Read: `.agents/skills/cognipace-agent-workflow/SKILL.md`
- Modify if needed: `.agents/skills/cognipace-agent-workflow/SKILL.md`
- Modify if needed: `docs/superpowers/plans/2026-06-07-cognipace-agent-workflow-skill.md`

- [ ] **Step 1: Re-run the three pressure scenarios with the new skill present**

Use the same scenarios from Task 1. This time, explicitly provide or load
`.agents/skills/cognipace-agent-workflow/SKILL.md`.

Expected passing behavior:

```text
- Scenario 1 routes through cognipace-agent-workflow, docs/agent-governance.md,
  superpowers:brainstorming, phase-sized planning, cognipace-bulletproof-react
  for runtime/surface boundaries, and exact validation/handoff proof.
- Scenario 2 distinguishes a trivial docs fix from substantial governance work
  and still requires exact docs-only Prettier validation or skipped-command
  disclosure.
- Scenario 3 requires superpowers:writing-skills, TDD background, baseline
  pressure scenarios, minimal skill drafting, and verification before deploying
  the skill.
```

- [ ] **Step 2: Patch the skill only if verification exposes a loophole**

If an agent still rationalizes around a gate, add a short explicit counter to
the most relevant section in
`.agents/skills/cognipace-agent-workflow/SKILL.md`. Keep
`docs/agent-governance.md` canonical; do not copy the validation matrix into
the skill.

Expected: any patch is narrow and tied to an observed RED/GREEN failure.

- [ ] **Step 3: Re-run Prettier after any refactor**

Run:

```bash
npx prettier --check .agents/skills/cognipace-agent-workflow/SKILL.md docs/superpowers/plans/2026-06-07-cognipace-agent-workflow-skill.md
```

Expected: PASS.

- [ ] **Step 4: Commit verification-driven refinements**

Run:

```bash
git add .agents/skills/cognipace-agent-workflow/SKILL.md docs/superpowers/plans/2026-06-07-cognipace-agent-workflow-skill.md
git commit -m "docs(agent-governance): verify workflow skill scenarios"
```

Expected: commit only if verification produced plan notes or skill refinements.

## Task 6: Final Handoff Check

**Files:**

- Check: working tree
- Check: touched Markdown files

- [ ] **Step 1: Confirm the working tree**

Run:

```bash
git status --short
```

Expected: no uncommitted changes, or only intentional changes that are named in
the handoff.

- [ ] **Step 2: Prepare the final handoff**

Use this exact validation summary shape:

```markdown
Validation run:

- `npx prettier --check .agents/skills/cognipace-agent-workflow/SKILL.md AGENTS.md CLAUDE.md docs/agent-governance.md docs/superpowers/README.md docs/superpowers/plans/2026-06-07-cognipace-agent-workflow-skill.md`

Validation skipped:

- Runtime tests (`npm run lint`, `npm run check`, `npm run build`) were skipped
  because Phase B touched only Markdown governance and skill files.
- Manual Chrome extension smoke was skipped because no runtime, UI, popup,
  dashboard, overlay, background, sync, GenAI, or packaging behavior changed.

Remaining validation risk:

- Skill pressure-scenario verification depends on the quality of the fresh
  agent/subagent prompts and should be reviewed in the final plan notes.

Risk areas touched:

- Agent workflow guidance, local skill routing, root agent docs, validation
  reporting expectations.

Release impact:

- None. Docs/governance-only change; no extension runtime behavior changes.

Rollback/recovery:

- Revert the commits that add `.agents/skills/cognipace-agent-workflow` and its
  root doc references.
```
