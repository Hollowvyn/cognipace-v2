# EditorConfig Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one editor-neutral file-property baseline while preserving Prettier, ESLint, and TypeScript as the repository's formatting, quality, and type authorities.

**Architecture:** A root `.editorconfig` defines only portable text-file properties. It does not duplicate language formatting, add editor-vendor settings, or change application and CI behavior. The configuration lands as its own commit on formatting-baseline PR #159, while the approved CI hardening rollout remains a later phase.

**Tech Stack:** EditorConfig, Prettier 3.8.3, ESLint 10, TypeScript 6, Node 24.20.0, npm 11.19.0

---

## File Map

- Create `.editorconfig`: cross-editor encoding, line-ending, indentation,
  final-newline, and trailing-whitespace contract.
- Keep `.prettierrc.json`: unchanged authority for language formatting.
- Keep `.prettierignore`: unchanged ownership boundary for generated and
  historical artifacts.
- Keep `eslint.config.js`: unchanged authority for code-quality and
  architecture rules.
- Keep `package.json` and `package-lock.json`: unchanged scripts and dependency
  graph.
- Use `docs/superpowers/specs/2026-09-13-editorconfig-baseline-design.md` as
  the approved scope authority.

### Task 1: Confirm The Existing Formatting-Baseline PR Branch

**Files:**

- Verify: `.prettierignore`
- Verify: `.prettierrc.json`
- Verify: `package.json`
- Verify: PR #159 branch `codex/formatting-baseline-design`

- [ ] **Step 1: Confirm the task branch is clean**

Run:

```sh
git status --short --branch
```

Expected: branch `codex/formatting-baseline-design` with no tracked or
untracked changes.

- [ ] **Step 2: Confirm formatting-baseline PR #159 is the target**

Run:

```sh
gh pr view 159 --json state,headRefName,baseRefName,url
```

Expected: `state` is `OPEN`, `headRefName` is
`codex/formatting-baseline-design`, `baseRefName` is `main`, and the URL is
`https://github.com/Hollowvyn/cognipace-v2/pull/159`.

- [ ] **Step 3: Refresh the PR branch against current `main`**

Run:

```sh
git fetch origin main
git merge-base --is-ancestor origin/main HEAD
```

Expected: the current `origin/main` commit is an ancestor of the PR branch. If
the check fails, rebase the PR branch onto `origin/main`, preserve every current
README index entry plus the formatting and EditorConfig entries, and rerun this
check before implementation.

- [ ] **Step 4: Verify the formatting-baseline ownership contract is present**

Run:

```sh
rg -n '^docs/superpowers/(plans|specs)$' .prettierignore
npm run format
```

Expected: both historical planning directories are explicitly ignored by the
global root scan, and `npm run format` exits successfully before `.editorconfig`
is added.

### Task 2: Add The Cross-Editor Contract

**Files:**

- Create: `.editorconfig`

- [ ] **Step 1: Run the RED existence check**

Run:

```sh
test -f .editorconfig
```

Expected: exit status `1` because the PR branch has no EditorConfig file. If
the file already exists, stop and compare it with the approved design before
continuing.

- [ ] **Step 2: Add the minimal configuration**

Create `.editorconfig` with `apply_patch`:

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true
```

- [ ] **Step 3: Run the GREEN exact-contract check**

Run:

```sh
node --input-type=module -e "import fs from 'node:fs'; const expected = ['root = true', '', '[*]', 'charset = utf-8', 'end_of_line = lf', 'indent_style = space', 'indent_size = 2', 'insert_final_newline = true', 'trim_trailing_whitespace = true', ''].join('\\n'); const actual = fs.readFileSync('.editorconfig', 'utf8'); if (actual !== expected) { console.error('EditorConfig contract mismatch'); process.exit(1) }"
```

Expected: exit status `0` with no output.

- [ ] **Step 4: Verify formatting compatibility and diff hygiene**

Run:

```sh
npm run format
git diff --check
git diff -- .editorconfig
```

Expected: formatting and whitespace checks pass, and the diff contains only the
approved root EditorConfig content.

- [ ] **Step 5: Commit the implementation**

Run:

```sh
git add .editorconfig
git commit -m "build(format): add editorconfig baseline"
```

Expected: one implementation commit containing only `.editorconfig`.

### Task 3: Validate The Combined Formatting Baseline

**Files:**

- Verify: `.editorconfig`
- Verify: `.prettierrc.json`
- Verify: `.prettierignore`
- Verify: `eslint.config.js`
- Verify: `package.json`
- Verify: `package-lock.json`

- [ ] **Step 1: Install exactly the locked dependency graph**

Run:

```sh
npm ci
```

Expected: exit status `0`. Record audit and install-script warnings without
changing dependencies in this task.

- [ ] **Step 2: Run the full non-runtime validation set**

Run each command separately:

```sh
npm run format
npm run lint
npm run check
npm run format
```

Expected: every command exits successfully. The second formatting run proves
the baseline is stable.

- [ ] **Step 3: Validate the historical planning artifacts explicitly**

Run:

```sh
npx prettier --check docs/superpowers/specs/2026-09-13-editorconfig-baseline-design.md docs/superpowers/plans/2026-09-13-editorconfig-baseline.md docs/superpowers/README.md
```

Expected: all three Markdown files use Prettier formatting even though the
historical spec and plan directories are excluded from the global root scan.

- [ ] **Step 4: Audit the final branch scope**

Run:

```sh
git diff --check origin/main...HEAD
git diff --name-only HEAD^...HEAD
git diff --name-only origin/main...HEAD
git status --short --branch
```

Expected implementation-commit changed-file list:

```text
.editorconfig
```

Expected aggregate PR scope: the approved formatting-baseline files, the
EditorConfig design and plan records, the planning index entries, and
`.editorconfig`; no other files.

The implementation-commit audit from
`git diff-tree --no-commit-id --name-only -r 782f64b` must return exactly
`.editorconfig`. Separately, audit `git diff --name-only origin/main...HEAD`
against the approved formatting-baseline plus EditorConfig scope; the aggregate diff
intentionally includes the original Prettier baseline. Confirm only the
follow-up commit has no source, dependency, lockfile, Prettier, ESLint,
workflow, permission, or generated-artifact changes.

Expected worktree state: clean.

- [ ] **Step 5: Record skipped validation and residual risk**

Record these exact skips in the handoff:

```text
npm run build: skipped because EditorConfig changes editor text-file defaults only and does not affect compilation or extension artifacts.
npm run zip: skipped because no application, manifest, dependency, build, or packaging behavior changed.
Manual browser smoke testing: skipped because no runtime, UI, extension-surface, permission, or packaged-artifact behavior changed.
Screenshots: not produced because there is no visible product change.
```

Expected residual risk: a contributor's editor may not support EditorConfig or
may have local settings that override it; repository validation remains the
enforcement boundary.

### Task 4: Prepare The Pull-Request Handoff

**Files:**

- Read: `.github/PULL_REQUEST_TEMPLATE.md`
- Read: `docs/agent-governance.md`

- [ ] **Step 1: Prepare the conventional title**

Keep the existing PR #159 title:

```text
style: establish the maintained formatting baseline
```

Expected release impact: none. `style` is a maintenance title under the current
Release Please policy.

- [ ] **Step 2: Prepare the PR body from the current template**

Include:

```text
Details: add one root, editor-neutral file-property baseline alongside the maintained Prettier surface; keep Prettier, ESLint, TypeScript, dependencies, and workflows unchanged.
Issue: No issue - cross-editor consistency is part of the approved formatting baseline.
Testing: list the exact commands and results from Task 3, including skipped validation and reasons.
Screenshots: no visible product change; the configuration diff is the evidence.
Release impact: none.
Rollback: revert the EditorConfig implementation commit independently, or revert the full formatting baseline if needed.
```

Expected: PR Hygiene accepts every required section without claiming runtime or
visual testing occurred.

- [ ] **Step 3: Update PR #159 and request review without merging**

Push the updated `codex/formatting-baseline-design` branch and update PR #159
with the EditorConfig scope, validation results, skipped validation reasons,
and rollback commit. Confirm hosted checks start, report their results, and
leave merge approval to the human reviewer.
