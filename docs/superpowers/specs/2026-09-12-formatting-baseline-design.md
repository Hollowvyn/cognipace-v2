# Formatting Baseline Design

## Status

Approved in conversation on September 12, 2026. Implemented and independently
reviewed in formatting-baseline PR #159.

## Context

CogniPace's repository-wide formatting command is intentionally simple:

```sh
npm run format
```

It currently delegates to `prettier --check .`, but the command cannot become a
required CI gate yet. Prettier attempts to parse invalid evaluation output under
`.claude/skill-validation`, reports formatting drift in mirrored agent material
and historical Superpowers artifacts, and finds genuine drift in maintained
source and documentation.

The approved dependency and CI modernization design requires this work to land
as a separate pull request before CI is split into stable `Check`, `Build`, and
`Format` jobs. The formatting pull request must define a durable maintained
surface and normalize that surface without changing product behavior.

## Goals

- Make `npm run format` pass from a clean checkout with Node 24.20.0 and npm
  11.19.0.
- Keep the existing `format` and `format:write` package scripts unchanged.
- Make the global Prettier surface explicit and durable.
- Exclude generated, mirrored, evaluation, agent-specific, and historical
  artifacts that the repository does not intend Prettier to own.
- Perform one mechanical Prettier normalization pass over every maintained file.
- Keep the pull request behavior-neutral and independently revertible.

## Non-Goals

- Do not change application behavior, tests, dependencies, package scripts, or
  extension permissions.
- Do not repair or reinterpret captured evaluation output.
- Do not reformat mirrored skill collections or historical planning artifacts.
- Do not change GitHub Actions, branch protection, Release Please behavior, or
  dependency automation.
- Do not combine CI Rollout 1 with the formatting baseline.
- Do not manually edit files after the normalization pass merely to reduce
  Prettier's mechanical diff.

## Approaches Considered

### Maintained-Surface Contract And One-Time Normalization

Add explicit artifact exclusions to `.prettierignore`, keep the package scripts
unchanged, and run one mechanical formatting pass over everything still in
scope.

This is the selected approach. It keeps `npm run format` discoverable, includes
new maintained files by default, and avoids making non-product artifact churn a
CI concern.

### Normalize Every Tracked File

Repair the invalid evaluation snippets and reformat the mirrored skills,
agent-specific instructions, generated metadata, release output, and historical
planning archive.

This is rejected because it produces a large low-value diff, changes captured
artifacts, and makes future tool-generated output capable of breaking product
validation.

### Replace The Package Script With Explicit Globs

Change `npm run format` to enumerate approved directories and file patterns.

This is rejected because an allowlist can silently omit a newly added maintained
file. The existing root scan plus an explicit ignore contract is easier to
extend safely.

## Formatting Surface

### Excluded Artifacts

Add these exact entries to `.prettierignore`:

```gitignore
.claude/skill-validation
.claude/skills
.jules
CHANGELOG.md
docs/superpowers/audits
docs/superpowers/plans
docs/superpowers/specs
src/platform/db/migrations/meta
```

These exclusions have distinct ownership reasons:

- `.claude/skill-validation` contains captured evaluation results, including
  TypeScript-shaped snippets that are intentionally not complete parseable
  modules.
- `.claude/skills` is a mirrored agent-skill collection rather than shipped
  CogniPace source.
- `.jules` contains agent-specific instruction artifacts rather than product or
  repository-governance authority.
- `CHANGELOG.md` is generated and updated by Release Please.
- `docs/superpowers/audits`, `docs/superpowers/plans`, and
  `docs/superpowers/specs` are historical planning artifacts. New or edited
  artifacts in these directories still receive targeted Prettier validation as
  part of their authoring workflow.
- `src/platform/db/migrations/meta` contains Drizzle-generated metadata and
  snapshots. Authored migration SQL remains inside the global formatting
  surface.

Existing exclusions for dependencies, WXT/build output, lockfiles, generated
skill locks, and local-only artifacts remain unchanged.

### Maintained Files

Everything not ignored remains discoverable by the root scan, and every file
type supported by Prettier remains covered by `prettier --check .`, including:

- application source and tests under `src`, except generated Drizzle metadata;
- authored migration files for which Prettier has a parser; authored SQL remains
  unexcluded even though the current Prettier installation does not format it;
- GitHub configuration and workflows under `.github`;
- root configuration and scripts;
- primary repository documentation such as `README.md`, `CONTRIBUTING.md`,
  `AGENTS.md`, `CLAUDE.md`, `design.md`, and `docs/*.md`;
- `.claude/settings.json`; and
- `docs/superpowers/README.md`, which remains the maintained index for the
  historical planning archive.

The contract is exclusion-based: a newly created maintained file is checked by
default unless a future reviewed change gives it a specific artifact ownership
reason.

## One-Time Normalization

After the ignore contract is in place, activate the pinned toolchain and run:

```sh
. "$NVM_DIR/nvm.sh"
nvm use 24.20.0
npm ci
npm run format:write
```

The normalization commit may touch many maintained source, test, documentation,
configuration, and authored migration files. Every such change must be the
direct output of Prettier 3.8.3 resolved from the existing lockfile. No package
or lockfile changes belong in this pull request.

Keep the ignore-contract edit and the mechanical normalization in distinct
commits so reviewers can separate policy from churn:

1. `build(format): define maintained prettier surface`
2. `style: normalize maintained prettier surface`

The pull-request title should be:

```text
style: establish the maintained formatting baseline
```

This is maintenance-only and does not trigger an application release under the
current Release Please policy.

## Safety And Failure Handling

- Capture the failing `npm run format` result before editing as the RED baseline.
- After changing `.prettierignore`, list the remaining different files before
  normalization. That list defines the mechanical change set.
- Run `npm run format:write` once against the maintained surface.
- Review the final diff for non-formatting changes, deleted files, renamed files,
  dependency changes, lockfile changes, and generated-output changes.
- If Prettier reports a parse error in a maintained file, stop and investigate
  that file instead of excluding it automatically.
- If validation mutates tracked files after the normalization commit, identify
  the owning generator and revise the formatting contract before proceeding.
- If a future artifact needs exclusion, add a narrow path and document its
  ownership reason; do not weaken the gate with broad source exclusions.

Rollback is one pull-request revert. Because the policy and mechanical pass are
separate commits, reviewers can also revise the ignore contract before the
normalization lands.

## Validation

Use Node 24.20.0 and npm 11.19.0 throughout.

Required automated validation:

```sh
npm ci
npm run format
npm run lint
npm run check
npm run build
npm run zip
git diff --check origin/main...HEAD
```

Also verify:

- `npm run format` succeeds twice, with the second run proving stability;
- the second complete validation pass leaves the worktree clean;
- the changed-file list contains only `.prettierignore`, formatted maintained
  files, and the approved spec/plan artifacts for this phase;
- `package.json`, `package-lock.json`, Action references, workflows, Chrome
  permissions, and generated artifact contents are unchanged; and
- formatting-only source diffs preserve syntax and pass TypeScript, lint, tests,
  build, and zip validation.

No browser smoke test or screenshot is required because this phase makes no
runtime, UI, extension-surface, or packaged-artifact behavior change. The PR
must state that manual validation was not run for that reason rather than imply
that it passed.

## Rollout Boundary

This pull request lands before CI Hardening Rollout 1. After merge, a clean
checkout of `main` must pass `npm run format`. The CI rollout then rebases onto
that commit and re-runs its Task 1 gate before editing `.github/workflows/ci.yml`.

Do not begin CI Rollout 1 implementation on top of an unmerged formatting
branch. Hosted CI changes and branch-protection activation retain their own
rollout and review boundaries.

## Acceptance Criteria

- `.prettierignore` expresses every approved artifact exclusion and no broad
  product-source exclusion.
- The package scripts remain `prettier --check .` and `prettier --write .`.
- The maintained surface receives one Prettier-only normalization pass.
- `npm run format`, `npm run lint`, `npm run check`, `npm run build`, and
  `npm run zip` pass with the pinned toolchain.
- A second complete validation pass leaves the worktree clean.
- No dependencies, CI workflows, release settings, branch protection, product
  behavior, generated artifact contents, or extension permissions change.
- The formatting baseline can be reviewed, merged, and reverted independently
  from CI hardening.
