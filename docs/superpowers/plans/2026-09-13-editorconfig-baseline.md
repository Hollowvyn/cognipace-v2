# EditorConfig Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one editor-neutral file-property baseline while preserving Prettier, ESLint, and TypeScript as the repository's formatting, quality, and type authorities.

**Architecture:** A root `.editorconfig` defines only portable text-file properties. It does not duplicate language formatting, add editor-vendor settings, or change application and CI behavior. Implementation is gated on formatting-baseline PR #159 merging so validation runs against the maintained Prettier surface.

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
- Use
  `docs/superpowers/specs/2026-09-13-editorconfig-baseline-design.md` as the
  approved scope authority.

### Task 1: Rebase Onto The Merged Formatting Baseline

**Files:**

- Verify: `.prettierignore`
- Verify: `.prettierrc.json`
- Verify: `package.json`

- [ ] **Step 1: Confirm the task branch is clean**

Run:

```sh
git status --short --branch
```

Expected: branch `codex/editorconfig-baseline` with no tracked or untracked
changes.

- [ ] **Step 2: Confirm formatting-baseline PR #159 is merged**

Run:

```sh
gh pr view 159 --json state,mergedAt,mergeCommit,url
```

Expected: `state` is `MERGED`, `mergedAt` is non-null, and `mergeCommit.oid` is
present. If the pull request is still open, stop without rebasing or
implementing.

- [ ] **Step 3: Rebase the planning commits onto current `main`**

Run:

```sh
git fetch origin main
git rebase origin/main
```

Expected: the design and plan commits replay on top of the merged formatting
baseline. If `docs/superpowers/README.md` conflicts, preserve every current
`main` index entry and the EditorConfig spec and plan entries.

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

Expected: exit status `1` because the repository has no EditorConfig file. If
the file already exists after rebasing, stop and compare it with the approved
design before continuing.

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

### Task 3: Validate The Repository-Owned Baseline

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
git diff --name-only origin/main...HEAD
git status --short --branch
```

Expected changed-file list:

```text
.editorconfig
docs/superpowers/README.md
docs/superpowers/plans/2026-09-13-editorconfig-baseline.md
docs/superpowers/specs/2026-09-13-editorconfig-baseline-design.md
```

Expected worktree state: clean. Confirm there are no `.idea`, `.vscode`, source,
dependency, lockfile, Prettier, ESLint, workflow, permission, or generated
artifact changes.

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

- Read: `.github/pull_request_template.md`
- Read: `docs/agent-governance.md`

- [ ] **Step 1: Prepare the conventional title**

Use:

```text
build(format): add editorconfig baseline
```

Expected release impact: none. `build` is a maintenance title under the current
Release Please policy.

- [ ] **Step 2: Prepare the PR body from the current template**

Include:

```text
Details: add one root, editor-neutral file-property baseline; keep Prettier, ESLint, TypeScript, dependencies, and workflows unchanged.
Issue: No issue - cross-editor formatting consistency follow-up.
Testing: list the exact commands and results from Task 3, including skipped validation and reasons.
Screenshots: no visible product change; the configuration diff is the evidence.
Release impact: none.
Rollback: revert the build(format) implementation commit.
```

Expected: PR Hygiene accepts every required section without claiming runtime or
visual testing occurred.

- [ ] **Step 3: Request review without merging**

After publication is authorized, push the branch and open the pull request.
Confirm hosted checks start, report their results, and leave merge approval to
the human reviewer.
