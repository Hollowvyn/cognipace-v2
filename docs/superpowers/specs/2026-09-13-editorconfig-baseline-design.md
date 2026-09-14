# EditorConfig Baseline Design

## Status

Approved in conversation on September 13, 2026. Written-spec review remains
required before implementation planning begins.

## Context

CogniPace already uses the standard TypeScript toolchain split: Prettier owns
mechanical formatting, ESLint owns code-quality rules, and TypeScript owns type
correctness. The repository does not yet define the basic file properties that
editors should apply before those tools run.

JetBrains IDE schemes and Google TypeScript style are useful references, but
neither is an appropriate cross-editor source of truth for this repository.
JetBrains settings are vendor-specific, while Google's guide explicitly
reflects constraints that may not apply to external projects. EditorConfig is
the portable layer understood by JetBrains IDEs and other common editors.

This change follows the formatting-baseline pull request as a separate,
behavior-neutral repository configuration change.

## Goals

- Give supported editors one repository-owned baseline for file encoding,
  line endings, indentation, final newlines, and trailing whitespace.
- Keep Prettier as the sole authority for JavaScript, TypeScript, JSX, TSX,
  JSON, CSS, HTML, Markdown, YAML, and other supported formatting decisions.
- Keep ESLint focused on correctness, maintainability, React, TypeScript, and
  architecture rules.
- Avoid editor-vendor lock-in and avoid duplicating Prettier options.
- Keep the change independent of product behavior, dependencies, CI workflow
  implementation, and the formatting-baseline pull request.

## Non-Goals

- Do not adopt the full Google TypeScript style guide.
- Do not commit JetBrains `.idea` code-style schemes or VS Code-only settings.
- Do not add naming, import-order, stylistic ESLint, or formatting rules.
- Do not add `eslint-config-prettier` while the active ESLint configuration has
  no formatting rules that conflict with Prettier.
- Do not change `.prettierrc.json`, `.prettierignore`, package scripts,
  dependencies, lockfiles, CI workflows, or application files.
- Do not reformat the repository again.

## Approaches Considered

### Repository-Owned EditorConfig

Add one root `.editorconfig` containing only portable file properties. Editors
apply the basics consistently, then the local Prettier installation applies the
repository's complete formatting policy.

This is the selected approach. It is small, editor-neutral, and consistent with
the existing division of responsibility.

### Commit IDE-Specific Settings

Commit JetBrains code-style schemes and VS Code settings that enable formatting
on save.

This is rejected as the baseline because it duplicates configuration and still
does not cover every contributor or automated agent. Contributors may enable
format-on-save locally, but CI must remain the universal enforcement point.

### Adopt Google TypeScript Style Wholesale

Translate Google's prescriptive language and naming guidance into additional
ESLint rules and formatting choices.

This is rejected because it expands a file-formatting improvement into a broad
language-style migration, introduces rules shaped by Google's internal
environment, and creates unrelated code churn.

## Configuration Contract

Add this root `.editorconfig`:

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

The contract deliberately omits quote style, semicolons, trailing commas,
wrapping, and language-specific layout. Those remain in Prettier. It also omits
language-semantic and architecture rules, which remain in ESLint and
TypeScript.

The settings apply uniformly to repository text files. CogniPace does not use
Markdown trailing spaces as a line-break convention; authors should use normal
Markdown structure rather than preserve invisible trailing whitespace.

## Integration And Ownership

- Editors that support EditorConfig discover the root file automatically.
- JetBrains/WebStorm contributors use the repository's local Prettier package,
  `.prettierrc.json`, and `.prettierignore` for formatting.
- Other editors should likewise use the local Prettier package rather than a
  global formatter version.
- `npm run format` remains the local and CI formatting gate.
- `npm run lint` remains the code-quality gate.
- The approved CI hardening rollout will keep `Format` and `Check` as separate
  jobs; this follow-up does not edit those workflows.

## Rollout Boundary

Do not amend formatting-baseline PR #159 with this change. Prepare and review
this work separately. Before implementation validation and publication, rebase
the follow-up onto `main` after PR #159 merges so the maintained Prettier
baseline is present.

## Validation

After the formatting baseline is available on the branch, run:

```sh
npm ci
npm run format
npm run lint
npm run check
git diff --check origin/main...HEAD
```

Also verify that:

- `.editorconfig` exactly matches the approved seven-property contract;
- the diff contains no `.idea`, `.vscode`, source, dependency, lockfile,
  Prettier, ESLint, or workflow changes;
- a second `npm run format` remains clean; and
- the worktree remains clean after validation.

Browser smoke testing and screenshots are not required because the change does
not alter runtime behavior, UI, extension surfaces, permissions, or packaged
artifacts.

## Acceptance Criteria

- The repository has one root, editor-neutral `.editorconfig`.
- Encoding, line endings, indentation, final newline, and trailing-whitespace
  behavior are consistent across compatible editors.
- Prettier, ESLint, and TypeScript responsibilities remain separate.
- No vendor-specific editor settings or broad external style guide is adopted.
- No application, dependency, CI, release, or formatting-baseline behavior
  changes.
- Required validation passes after the branch is based on the merged formatting
  baseline.
