# Formatting Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Define CogniPace's maintained Prettier surface and apply one
behavior-neutral normalization pass so `npm run format` becomes a stable green
prerequisite for CI hardening.

**Architecture:** Keep the existing root-scanning package scripts and express
artifact ownership through narrow `.prettierignore` entries. First prove that
the ignore contract removes only generated, mirrored, agent-specific, and
historical paths; then run the repository's pinned Prettier once over the
remaining maintained surface and validate the result through the complete
toolchain.

**Tech Stack:** Prettier 3.8.3, Node.js 24.20.0, npm 11.19.0, TypeScript,
Vitest, ESLint, WXT, Git.

---

**Approved design:**
[`../specs/2026-09-12-formatting-baseline-design.md`](../specs/2026-09-12-formatting-baseline-design.md)

## Scope And Commit Boundaries

This phase has two implementation commits:

1. `build(format): define maintained prettier surface`
2. `style: normalize maintained prettier surface`

The approved design and this plan remain separate preceding documentation
commits. Do not squash the implementation units locally; CogniPace uses the pull
request title as the eventual squash-merge release signal.

The pull-request title is:

```text
style: establish the maintained formatting baseline
```

The phase changes only:

- `.prettierignore` for the ownership contract;
- the exact 63 maintained files listed in Task 3 through Prettier-only rewrites;
- this approved spec and implementation plan; and
- `docs/superpowers/README.md` to index the planning artifacts.

Do not change package scripts, dependencies, the lockfile, GitHub Actions,
branch protection, Release Please configuration, generated artifact contents,
application logic, tests, or documentation meaning.

## File Map

| File or surface                                                   | Responsibility                                                                                   |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `.prettierignore`                                                 | Define the narrow generated, mirrored, agent-specific, and historical exclusions.                |
| `docs/test-plans/notification-alarm-e2e.md`                       | Receive mechanical Markdown normalization.                                                       |
| `eslint.config.js`                                                | Receive mechanical JavaScript normalization.                                                     |
| `src/**/*.ts`, `src/**/*.tsx`                                     | Receive mechanical TypeScript/TSX normalization only for the exact files listed in Task 3.       |
| `src/entrypoints/popup/index.html`                                | Receive mechanical HTML normalization.                                                           |
| `docs/superpowers/specs/2026-09-12-formatting-baseline-design.md` | Record the approved formatting contract; validate separately because specs are globally ignored. |
| `docs/superpowers/plans/2026-09-12-formatting-baseline.md`        | Record this phase plan; validate separately because plans are globally ignored.                  |
| `docs/superpowers/README.md`                                      | Keep the planning-artifact index current and globally formatted.                                 |

## Task 1: Reproduce The Formatting Failure On A Clean Baseline

**Files:**

- Verify only; do not modify files

- [ ] **Step 1: Confirm the branch and worktree baseline**

Run:

```sh
git status --short --branch
git fetch origin main
git rebase origin/main
git merge-base --is-ancestor origin/main HEAD
git status --short --branch
```

Expected result: the worktree is clean, the rebase succeeds, and the ancestor
check exits zero. If the design commit already landed on `main`, start a fresh
`codex/formatting-baseline` branch from `origin/main` rather than duplicating it.
If unrelated user work appears, stop and ask how to preserve it.

- [ ] **Step 2: Activate the exact toolchain and install cleanly**

Run:

```sh
. "$NVM_DIR/nvm.sh"
nvm use 24.20.0
node --version
npm --version
npm ci
git status --short
```

Expected versions:

```text
v24.20.0
11.19.0
```

Expected result: `npm ci` exits zero and does not modify tracked files.

- [ ] **Step 3: Confirm the package-script contract is unchanged**

Run:

```sh
node -e "const p=require('./package.json'); console.log(p.scripts.format); console.log(p.scripts['format:write'])"
```

Expected output:

```text
prettier --check .
prettier --write .
```

Do not edit either script in this phase.

- [ ] **Step 4: Capture the failing RED formatting baseline**

Run:

```sh
npm run format
```

Expected RED result: exit code `2`, with `SyntaxError: Unexpected keyword or
identifier` for both of these captured evaluation outputs:

```text
.claude/skill-validation/iteration-1/drizzle-eval/with_skill/outputs/output.ts
.claude/skill-validation/iteration-1/drizzle-eval/without_skill/outputs/output.ts
```

Prettier will also report formatting drift in mirrored skills, agent artifacts,
historical planning files, generated outputs, and maintained files. Do not edit
anything while recording this result.

- [ ] **Step 5: Prove the RED run was non-mutating**

Run:

```sh
git status --short --branch
```

Expected result: the worktree remains clean.

## Task 2: Define The Maintained Prettier Surface

**Files:**

- Modify: `.prettierignore`

- [ ] **Step 1: Replace the ignore file with the approved exact contract**

Keep every existing exclusion and add only the approved paths. The complete
file must become:

```gitignore
.agents
.claude/skill-validation
.claude/skills
.jules
.output
.wxt
CHANGELOG.md
dist
dist-ssr
docs/superpowers/audits
docs/superpowers/plans
docs/superpowers/specs
node_modules
package-lock.json
new_prd.md
skills-lock.json
src/platform/db/migrations/meta
```

Do not ignore `.claude` wholesale, `src`, tests, `.github`, root configuration,
primary documentation, or `docs/superpowers/README.md`.

- [ ] **Step 2: Verify every approved exclusion and retained surface**

Run:

```sh
for expected_entry in \
  '.agents' \
  '.claude/skill-validation' \
  '.claude/skills' \
  '.jules' \
  '.output' \
  '.wxt' \
  'CHANGELOG.md' \
  'dist' \
  'dist-ssr' \
  'docs/superpowers/audits' \
  'docs/superpowers/plans' \
  'docs/superpowers/specs' \
  'node_modules' \
  'package-lock.json' \
  'new_prd.md' \
  'skills-lock.json' \
  'src/platform/db/migrations/meta'; do
  rg -Fqx "$expected_entry" .prettierignore
done

if rg -n '^src$|^\.github$|^docs$|^docs/superpowers/README\.md$|^\.claude$' \
  .prettierignore; then
  echo "A maintained surface was excluded too broadly." >&2
  exit 1
fi
```

Expected result: every exact approved entry is present and no broad maintained
surface is excluded.

- [ ] **Step 3: Prove the contract removes parse failures but not maintained drift**

Run:

```sh
npm run format
```

Expected intermediate RED result: exit code `1`, not `2`. Prettier reports only
formatting warnings for maintained files. It must not report either captured
evaluation snippet, mirrored `.claude/skills`, `.jules`, `CHANGELOG.md`,
historical Superpowers artifacts, or Drizzle migration metadata.

If any parse error remains, stop and investigate it. Do not add a new exclusion
without revising and re-approving the design.

- [ ] **Step 4: Record the exact remaining normalization set**

Run:

```sh
npx prettier --list-different .
```

Expected result: Prettier lists exactly the 63 paths in Task 3 and exits `1`.
If the set differs because `main` changed, inspect every added or removed path
and update the plan before normalization.

- [ ] **Step 5: Validate and commit only the ownership contract**

Run:

```sh
git diff --check
git diff -- .prettierignore
git status --short
git add .prettierignore
git commit -m "build(format): define maintained prettier surface"
```

Expected result: this commit changes only `.prettierignore`.

## Task 3: Normalize The Exact Maintained File Set

**Files:**

- Modify mechanically with Prettier:

```text
docs/test-plans/notification-alarm-e2e.md
eslint.config.js
src/components/ui/chart.tsx
src/components/ui/tooltip.tsx
src/entrypoints/popup/index.html
src/extension/background/due-notification.test.ts
src/extension/background/due-notification.ts
src/extension/background/register-handlers.test.ts
src/extension/background/runtime-policy.test.ts
src/features/analytics/components/charts/consistency-chart.tsx
src/features/analytics/components/charts/line-segments.test.tsx
src/features/analytics/components/charts/memory-strength-chart.tsx
src/features/analytics/components/charts/ratings-mix-chart.tsx
src/features/analytics/components/charts/recall-quality-chart.tsx
src/features/analytics/data/analytics-repository.ts
src/features/analytics/domain/analytics-readiness.ts
src/features/analytics/domain/chart-buckets.test.ts
src/features/analytics/domain/chart-buckets.ts
src/features/analytics/domain/summary.test.ts
src/features/analytics/server/analytics-service.ts
src/features/app-shell/server/app-shell-service.test.ts
src/features/assessment/domain/assessment.test.ts
src/features/assessment/domain/assessment.ts
src/features/assessment/domain/derived.ts
src/features/assessment/domain/rules/easy-gate.test.ts
src/features/assessment/domain/rules/easy-gate.ts
src/features/assessment/domain/rules/warnings.test.ts
src/features/genai/api/genai-settings-hooks.test.tsx
src/features/genai/server/json-schema.test.ts
src/features/genai/server/json-schema.ts
src/features/genai/server/providers/anthropic.test.ts
src/features/genai/server/providers/gemini.test.ts
src/features/genai/server/providers/shared.test.ts
src/features/leetcode-review-assistant/api/index.ts
src/features/leetcode-review-assistant/api/runtime-contracts.ts
src/features/leetcode-review-assistant/index.ts
src/features/leetcode-review-assistant/server/build-assessment-prompt.ts
src/features/leetcode-review-assistant/server/recommendation-normalizer.test.ts
src/features/leetcode-review-assistant/server/recommendation-service.test.ts
src/features/overlay-session/components/modes/expanded/overlay-assessment-recommendation.test.tsx
src/features/overlay-session/components/modes/expanded/overlay-assessment-recommendation.tsx
src/features/overlay-session/components/modes/expanded/overlay-context-strip.tsx
src/features/overlay-session/domain/session-context.test.ts
src/features/overlay-session/domain/session-context.ts
src/features/overlay-session/hooks/use-leetcode-assessment-recommendation.ts
src/features/overlay-session/hooks/use-leetcode-overlay-session.test.tsx
src/features/overlay-session/hooks/use-overlay-review-actions.ts
src/features/practice/api/practice-api.test.tsx
src/features/problems/api/problems-api.ts
src/features/problems/data/problems-repository.test.ts
src/features/queue/api/queue-api.test.ts
src/features/queue/domain/queue.test.ts
src/features/settings/components/sections/reminders-section.test.tsx
src/features/settings/components/sections/reminders-section.tsx
src/features/settings/components/settings-screen.test.tsx
src/features/settings/hooks/use-settings-draft.ts
src/features/tracks/domain/track-target-status.ts
src/features/tracks/hooks/track-form-initial-draft.ts
src/features/tracks/utils/library-selection-track-draft.test.ts
src/features/tracks/utils/library-selection-track-draft.ts
src/platform/db/schema/tracks.ts
src/platform/secrets/index.ts
src/testing/architecture-boundaries.test.ts
```

- [ ] **Step 1: Run the single approved mechanical normalization pass**

Run once:

```sh
npm run format:write
```

Expected result: Prettier completes without a parse error. Do not manually edit
the formatted files afterward.

- [ ] **Step 2: Confirm the changed file set is exact**

Run:

```sh
git diff --name-only
git diff --stat
git status --short
```

Expected result: exactly the 63 Task 3 paths are modified. `.prettierignore` is
already committed and must not appear as an unstaged change.

- [ ] **Step 3: Prove excluded artifacts and dependency/workflow inputs are untouched**

Run:

```sh
git diff --exit-code -- \
  .claude/skill-validation \
  .claude/skills \
  .jules \
  CHANGELOG.md \
  docs/superpowers/audits \
  docs/superpowers/plans \
  docs/superpowers/specs \
  src/platform/db/migrations/meta \
  package.json \
  package-lock.json \
  .github
```

Expected result: exit zero with no output. The current plan and spec are already
committed, so this command examines only the uncommitted normalization pass.

- [ ] **Step 4: Check formatting and whitespace before committing**

Run:

```sh
npm run format
git diff --check
git diff --numstat
```

Expected result: `npm run format` passes, whitespace validation passes, and all
changes are text-only.

- [ ] **Step 5: Review the mechanical diff for semantic edits**

Run:

```sh
git diff -- src docs/test-plans/notification-alarm-e2e.md eslint.config.js
```

Review every hunk. Expected changes are wrapping, indentation, quote style,
trailing commas, parentheses, and other Prettier-owned syntax only. Stop if an
identifier, string value, numeric value, control-flow branch, assertion meaning,
HTML attribute value, or configuration rule changes.

- [ ] **Step 6: Commit the exact normalization set**

Run:

```sh
git add docs/test-plans/notification-alarm-e2e.md eslint.config.js src
git diff --cached --check
git diff --cached --name-only
git commit -m "style: normalize maintained prettier surface"
```

Expected result: the commit contains exactly the 63 listed paths.

## Task 4: Audit The Completed Diff Against The Contract

**Files:**

- Verify: `.prettierignore`
- Verify: all 63 normalized files
- Verify: planning artifacts and untouched exclusions

- [ ] **Step 1: Confirm the two implementation commits and clean worktree**

Run:

```sh
git log --oneline origin/main..HEAD
git status --short --branch
```

Expected result: the branch contains the approved spec/plan commits followed by
the two implementation commits, and the worktree is clean.

- [ ] **Step 2: Confirm the normalization commit contains the exact file set**

Run:

```sh
git show --format= --name-only HEAD
git show --check --stat HEAD
```

Expected result: exactly the 63 Task 3 paths appear, with no whitespace errors.

- [ ] **Step 3: Confirm excluded existing artifacts did not change from `main`**

Run:

```sh
git diff --exit-code origin/main...HEAD -- \
  .claude/skill-validation \
  .claude/skills \
  .jules \
  CHANGELOG.md \
  docs/superpowers/audits \
  src/platform/db/migrations/meta
```

Expected result: exit zero with no output.

- [ ] **Step 4: Confirm no historical planning artifact changed accidentally**

Run:

```sh
unexpected_planning_files=$(git diff --name-only origin/main...HEAD -- \
  docs/superpowers/plans docs/superpowers/specs | \
  rg -v '^(docs/superpowers/plans/2026-09-12-formatting-baseline\.md|docs/superpowers/specs/2026-09-12-formatting-baseline-design\.md)$' || true)

if [ -n "$unexpected_planning_files" ]; then
  printf '%s\n' "$unexpected_planning_files" >&2
  exit 1
fi
```

Expected result: no unexpected path is printed.

- [ ] **Step 5: Confirm dependencies, workflows, permissions, and scripts are unchanged**

Run:

```sh
git diff --exit-code origin/main...HEAD -- \
  package.json \
  package-lock.json \
  .github \
  wxt.config.ts \
  public/manifest.json
```

Expected result: exit zero with no output. If `public/manifest.json` does not
exist, remove only that nonexistent path from the command; do not substitute a
different manifest source.

## Task 5: Run Complete Validation And Stability Proof

**Files:**

- Verify the complete branch

- [ ] **Step 1: Reinstall with the pinned toolchain**

Run:

```sh
. "$NVM_DIR/nvm.sh"
nvm use 24.20.0
node --version
npm --version
npm ci
git status --short
```

Expected result: Node is `v24.20.0`, npm is `11.19.0`, installation passes, and
the worktree remains clean.

- [ ] **Step 2: Run the first complete validation pass**

Run each command separately and record its exact result:

```sh
npm run format
npm run lint
npm run check
npm run build
npm run zip
npx prettier --check \
  docs/superpowers/specs/2026-09-12-formatting-baseline-design.md \
  docs/superpowers/plans/2026-09-12-formatting-baseline.md \
  docs/superpowers/README.md
git diff --check origin/main...HEAD
```

Expected result: every command exits zero. The targeted Prettier command is
required because the global contract intentionally ignores spec and plan
archives.

- [ ] **Step 3: Run the formatting stability proof**

Run:

```sh
npm run format
npx prettier --check \
  docs/superpowers/specs/2026-09-12-formatting-baseline-design.md \
  docs/superpowers/plans/2026-09-12-formatting-baseline.md \
  docs/superpowers/README.md
git status --short --branch
```

Expected result: both formatting commands pass a second time and the worktree
is clean. This proves validation and WXT generation did not introduce tracked
formatting drift.

- [ ] **Step 4: Record manual-validation and release impact honestly**

Record:

```text
Manual smoke tested: Not run — this pull request contains only a Prettier scope contract and mechanical formatting; it does not change runtime behavior, UI, extension surfaces, permissions, or artifact contents.
Screenshots: N/A — there is no visible change.
Release impact: None — the style pull-request title is maintenance-only under the current Release Please policy.
```

Do not claim browser or hosted validation that was not performed.

## Task 6: Prepare Hosted Review And The CI-Rollout Handoff

**Files:**

- Verify hosted state only after explicit user authorization to push/open a PR

- [ ] **Step 1: Prepare the PR-ready summary**

Use the exact pull-request title:

```text
style: establish the maintained formatting baseline
```

The body must include:

- the approved artifact-ownership exclusions;
- the exact 63-file mechanical normalization count;
- exact local validation commands and results;
- the manual-smoke, screenshot, and release-impact statements from Task 5;
- confirmation that dependencies, workflows, branch protection, Release
  Please, permissions, product behavior, and generated artifacts are unchanged;
- rollback: revert the two implementation commits together; and
- no-issue maintenance rationale unless a tracking issue is created.

- [ ] **Step 2: Push and open the pull request only with user authorization**

Follow the repository finishing workflow. Preserve the worktree for review and
do not merge automatically.

- [ ] **Step 3: Verify the existing hosted checks**

Require the pull request's existing checks, including `Check`, `Validate PR
title`, and `Validate PR body`, to pass. The stable `Format` job does not exist
until the later CI rollout, so do not claim hosted repository-wide formatting
proof; the exact local `npm run format` evidence is required here.

- [ ] **Step 4: Re-establish the prerequisite on merged `main`**

After a maintainer-authorized merge, fetch `main` and run the CI Rollout 1 Task
1 gate from a clean checkout. Do not begin CI workflow edits until the latest
`origin/main` passes `npm run format` with Node 24.20.0 and npm 11.19.0.

## Done When

- `.prettierignore` contains the exact approved exclusions without excluding a
  broad maintained surface.
- Package scripts remain unchanged.
- Prettier removes parse failures from the maintained contract and mechanically
  normalizes exactly the expected 63 files.
- Excluded generated, mirrored, agent-specific, release-generated, and
  historical artifacts remain byte-for-byte unchanged.
- Dependencies, the lockfile, GitHub Actions, branch protection, Release Please,
  extension permissions, and product behavior remain unchanged.
- `npm ci`, both `npm run format` stability runs, `npm run lint`, `npm run check`,
  `npm run build`, `npm run zip`, targeted planning-artifact Prettier, and
  whitespace validation all pass.
- The worktree is clean after complete validation.
- The formatting baseline lands and passes on `main` before CI Rollout 1 starts.
