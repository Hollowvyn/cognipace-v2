# Agent Governance Drift Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Phase F drift-audit guidance to the canonical CogniPace agent
governance doc using exact source-of-truth file paths and no new scheduled
automation.

**Architecture:** `docs/agent-governance.md` remains the canonical operating
contract. Historical Superpowers design artifacts record that Phase F is no
longer missing once the checklist is implemented, but they do not become current
authority.

**Tech Stack:** Markdown, Prettier, Git.

---

## File Structure

- Modify `docs/agent-governance.md`: add the concise canonical `Drift Audit`
  checklist after the current issue rules.
- Modify `docs/superpowers/specs/2026-06-07-cognipace-agent-governance-design.md`:
  update Phase F from `Status: missing` to implemented/covered by the canonical
  checklist.

## Task 1: Add The Canonical Drift Audit Checklist

**Files:**

- Modify: `docs/agent-governance.md`

- [ ] **Step 1: Open the current insertion point**

Run:

```sh
sed -n '300,460p' docs/agent-governance.md
```

Expected: the file ends around `## Issue Rules`, making the new `## Drift Audit`
section the next canonical governance section.

- [ ] **Step 2: Add the checklist**

Append this exact section after the current issue rules:

```md
## Drift Audit

Use this checklist to keep agent governance, local skills, GitHub templates, CI,
and repository settings aligned as CogniPace changes. The first audit should
happen after the first release cycle using the hardened governance model. After
that, review this checklist on a recurring release-cycle cadence and whenever
governance, CI, templates, release behavior, or local agent skills change.

Audit these source-of-truth files and settings:

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

Confirm:

- Root agent guides still delegate to `docs/agent-governance.md`.
- Codex and Claude root instructions remain equivalent in requirements.
- Local skills route agents to this canonical governance doc instead of
  duplicating changing rules.
- PR and issue template expectations still match PR hygiene automation.
- Workflow names and required checks match branch protection.
- Labeler paths still cover sensitive areas accurately.
- Release, package, and validation rules still match actual npm scripts and CI.
- Noisy rules are simplified or removed before new rules are added.
- New mechanical checks are proposed only after repeated human-review misses.

Branch protection is configured in GitHub, not in repository files. Repository
docs and workflows should document the expected checks; GitHub settings must
block failed required checks on `main`.
```

- [ ] **Step 3: Run focused formatting validation**

Run:

```sh
npx prettier --check docs/agent-governance.md
```

Expected: Prettier reports the file is formatted correctly.

- [ ] **Step 4: Review the diff**

Run:

```sh
git diff -- docs/agent-governance.md
```

Expected: only the new `## Drift Audit` section is added.

- [ ] **Step 5: Commit the canonical checklist**

Run:

```sh
git add docs/agent-governance.md
git commit -m "docs(governance): add drift audit checklist"
```

Expected: a commit containing only `docs/agent-governance.md`.

## Task 2: Update Historical Phase F Status

**Files:**

- Modify:
  `docs/superpowers/specs/2026-06-07-cognipace-agent-governance-design.md`

- [ ] **Step 1: Open Phase F**

Run:

```sh
sed -n '500,620p' docs/superpowers/specs/2026-06-07-cognipace-agent-governance-design.md
```

Expected: Phase F still says `Status: missing`.

- [ ] **Step 2: Update the status line**

Replace:

```md
Status: missing.
```

with:

```md
Status: implemented in `docs/agent-governance.md`.
```

- [ ] **Step 3: Preserve acceptance criteria**

Do not remove the acceptance criterion:

```md
- Branch protection blocks failed required checks.
```

This remains a GitHub settings responsibility. The repository documents the
expectation, but the human repository owner configures branch protection in
GitHub.

- [ ] **Step 4: Run focused formatting validation**

Run:

```sh
npx prettier --check docs/superpowers/specs/2026-06-07-cognipace-agent-governance-design.md
```

Expected: Prettier reports the file is formatted correctly.

- [ ] **Step 5: Review the diff**

Run:

```sh
git diff -- docs/superpowers/specs/2026-06-07-cognipace-agent-governance-design.md
```

Expected: only the Phase F status line changes.

- [ ] **Step 6: Commit the Phase F status update**

Run:

```sh
git add docs/superpowers/specs/2026-06-07-cognipace-agent-governance-design.md
git commit -m "docs(governance): mark phase f drift audit implemented"
```

Expected: a commit containing only the historical design status update.

## Task 3: Validate The Branch And Prepare PR Context

**Files:**

- No file changes.

- [ ] **Step 1: Run complete docs validation for the branch**

Run:

```sh
npx prettier --check docs/agent-governance.md docs/superpowers/specs/2026-06-07-cognipace-agent-governance-design.md docs/superpowers/specs/2026-06-08-agent-governance-drift-audit-design.md docs/superpowers/plans/2026-06-08-agent-governance-drift-audit.md docs/superpowers/README.md
```

Expected: Prettier reports all files are formatted correctly.

- [ ] **Step 2: Run whitespace validation**

Run:

```sh
git diff --check
```

Expected: no whitespace errors.

- [ ] **Step 3: Review branch commits and status**

Run:

```sh
git status --short --branch
git log --oneline --decorate -5
```

Expected: the branch is clean after the final commit, and recent commits are
scoped to Phase F design, plan, and implementation.

- [ ] **Step 4: Prepare PR summary**

Use `.github/PULL_REQUEST_TEMPLATE.md` as the source of truth. The expected
validation section for this docs/governance branch is:

```md
- [x] `npm run check` passed, or N/A: docs/governance-only change
  - db check
  - typecheck
  - lint
  - tests
- [x] `npm run build` passed, or N/A: docs/governance-only change
- [x] `npm run zip` passed, or N/A: docs/governance-only change
- [x] Added/updated needed tests: N/A, docs/governance-only change
- [x] Manual smoke tested: N/A, docs/governance-only change
- [x] Skipped validation: `npm run check` skipped because this branch only changes Markdown governance docs; Prettier and whitespace validation were run instead.
```
