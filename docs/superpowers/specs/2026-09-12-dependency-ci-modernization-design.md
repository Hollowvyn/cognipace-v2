# Dependency And CI Modernization Design

## Status

Approved on September 12, 2026. This design covers npm dependencies and GitHub
Actions dependencies. Codex skills, plugin locks, product features, and unrelated
repository governance are outside this work.

## Context

CogniPace has a healthy product architecture and broad automated test coverage,
but its dependency and CI baseline is not currently reliable enough for safe
automated updates. The repository already has a historical repo-hardening design
that places stable validation ahead of dependency automation. This design narrows
that direction into an executable dependency-maintenance program.

The September 12, 2026 audit found:

- 43 direct npm dependencies: 19 production and 24 development dependencies.
- 33 direct dependencies with a newer registry version.
- 28 updates available within the current declared ranges.
- five latest-version major migrations: `@tanstack/react-table`,
  `@testing-library/jest-dom`, `@webext-core/messaging`, `typescript`, and
  `vitest`.
- zero production dependency vulnerabilities from `npm audit --omit=dev`.
- six moderate development-tree audit findings. Updating Vitest from `4.1.6`
  to `4.1.11` fixes the actionable Vitest advisory chain; the remaining
  advisory chain is in the current `drizzle-kit` toolchain, for which npm
  suggests an incompatible downgrade rather than a usable fix.
- a passing production build, passing ESLint, and 1,538 passing tests across
  155 test files.
- a failing local typecheck at
  `src/extension/background/scheduler/alarm-scheduler.ts` because an
  `AlarmInfo` value no longer satisfies the Chrome `AlarmCreateInfo` input.
- a failing repository-wide Prettier check caused by invalid generated or
  evaluation artifacts plus formatting drift in maintained files.
- failing GitHub CI on `main` because npm `11.19.0` rejects the current
  lockfile as incomplete, while the local npm `11.6.2` installation accepts it.
- a single CI `Check` job, no Dependabot configuration, no pull-request
  dependency review, and no required branch-protection checks.

The audit also found GitHub Action major-version drift. At audit time,
`actions/checkout`, `actions/setup-node`, `actions/labeler`, `actions/stale`,
and `googleapis/release-please-action` all had newer majors. Exact versions must
be refreshed from their official releases when the relevant phase starts.

Version numbers in this document are an audit snapshot, not a permanent target.
Every implementation phase must refresh the registry and official release data
before changing a dependency.

## Goals

- Restore a deterministic, green local and CI validation baseline.
- Update every direct npm and GitHub Actions dependency to the latest suitable
  stable release, or record a specific blocker and review path.
- Keep production dependency vulnerabilities at zero.
- Isolate high-risk upgrades so failures and rollbacks remain attributable.
- Add low-noise, GitHub-native dependency update automation.
- Make dependency pull requests pass the same meaningful gates as human-authored
  changes.
- Preserve CogniPace product behavior, Chrome permissions, local-first storage,
  release semantics, and architecture boundaries.

## Non-Goals

- Do not update Codex skills, plugin locks, or unrelated tool bundles.
- Do not add Renovate or another overlapping dependency bot.
- Do not auto-merge dependency pull requests.
- Do not use `npm audit fix --force` or accept incompatible downgrades to obtain
  a cosmetically clean audit report.
- Do not add product features, permissions, backend services, hosted behavior,
  or architecture layers.
- Do not combine all dependency updates into one pull request.
- Do not broaden this work into all remaining repository-hardening phases.

## Approaches Considered

### Baseline First, Then Staged Updates

Restore deterministic validation, update dependencies in risk-sized batches,
and add automation only after the repository is green. This makes regressions
attributable and each batch independently revertible.

This is the selected approach.

### One Modernization Pull Request

Update CI, all npm dependencies, and all Actions together. This reduces the
number of pull requests but creates a very large lockfile and workflow diff,
mixes unrelated failure modes, and makes rollback unsafe.

This approach is rejected.

### Automation First

Add Dependabot immediately and let generated pull requests drive the cleanup.
This minimizes the initial manual work, but the existing red CI baseline would
produce noisy, unactionable pull requests and obscure whether failures are new.

This approach is rejected.

## Design Principles

- A dependency bot is useful only when the repository starts from green.
- Update risk is determined by affected behavior, not only semantic-version
  labels.
- Runtime, build-tool, test-tool, and GitHub Actions updates use separate review
  boundaries.
- Major migrations are never grouped.
- A current dependency is one on the latest suitable stable line for CogniPace,
  not blindly whatever an ambiguous npm `latest` tag returns. For example,
  `@types/node` must stay aligned with the supported Node 24 runtime rather than
  downgrade to an older major dist-tag.
- Existing vulnerabilities are handled according to reachability, fix quality,
  and exposure. Forced incompatible changes are not a security strategy.
- Stable CI job names are an interface with branch protection and must not be
  renamed casually.

## Phase 1: Restore The Toolchain Baseline

### Runtime And Package Manager Contract

Use one explicit Node 24 patch and one explicit npm 11 patch for local lockfile
generation and CI. The implementation should:

- add a version-manager-readable Node version file;
- declare the expected Node and npm lines in `package.json`;
- declare the exact npm package-manager version;
- make CI provision or verify that npm version before `npm ci`;
- regenerate `package-lock.json` with that exact toolchain; and
- verify a clean install with the same versions used in GitHub Actions.

The implementation phase must refresh the exact versions first. The audit's
known CI pair is Node `24.20.0` with npm `11.19.0`.

### Existing Validation Failures

Repair the current failures without changing user-visible behavior:

- pass an `AlarmCreateInfo`-compatible value to Chrome alarms instead of
  reusing the broader alarm read shape;
- define the maintained Prettier surface and exclude generated, mirrored,
  evaluation, and historical artifacts that the repository does not intend to
  normalize; and
- perform one dedicated mechanical formatting pass over the maintained surface.

Toolchain/lockfile/type repair and formatting normalization must be separate
pull requests. Formatting churn must not obscure the behavioral or dependency
diffs.

Phase 1 is complete only when a clean checkout passes `npm ci`, `npm run check`,
`npm run build`, and `npm run format` with the declared toolchain.

## Phase 2: Harden CI And GitHub Actions

Replace the single opaque CI job with stable jobs:

- `Check`: run `npm run check`.
- `Build`: run `npm run build`.
- `Format`: run `npm run format`.
- `Dependency Review`: run only for pull requests and reject newly introduced
  moderate, high, or critical vulnerabilities in development, runtime, and
  unknown dependency scopes.
- `Required Checks`: aggregate the required job results into one stable branch
  protection interface while retaining job-level failure detail.

The workflow must:

- use `npm ci` with the declared Node/npm toolchain;
- retain least-privilege permissions;
- cancel superseded runs on the same pull request or branch;
- run validation for pull requests and pushes to `main`;
- treat the pull-request-only dependency review as a neutral skip when the
  aggregate runs for a push to `main`;
- avoid secrets in normal pull-request validation; and
- keep Release Please pull requests on the normal validation path.

Update GitHub Actions in this phase after reviewing each official major-version
change. At the audit snapshot, the candidates are:

| Action                                | Declared | Audit-time latest |
| ------------------------------------- | -------: | ----------------: |
| `actions/checkout`                    |       v4 |                v7 |
| `actions/setup-node`                  |       v4 |                v7 |
| `actions/labeler`                     |       v6 |                v7 |
| `actions/stale`                       |      v10 |               v11 |
| `googleapis/release-please-action`    |       v4 |                v5 |
| `amannn/action-semantic-pull-request` |       v6 |                v6 |

CI workflow changes and Actions updates may be separate pull requests if the
official migration notes reveal distinct behavior or permission changes.

After the jobs have appeared and passed on a dry-run pull request, require
`Required Checks`, `Validate PR title`, and `Validate PR body` on `main`. Keep
strict up-to-date branch checking. Do not change unrelated merge or
administrator policies in this phase.

## Phase 3: Update Non-Major npm Dependencies

Refresh `npm outdated` at phase start, then update in small dependency-family
batches. The expected order is:

1. Vitest `4.1.11` security patch and its matching internal packages.
2. Linting, formatting, and test-support dependencies.
3. WXT, Vite, Tailwind build integration, and other extension build tools.
4. React, TanStack Query/Router, Zod, date handling, and other runtime logic
   dependencies.
5. UI-only libraries and icons.
6. Explicit non-major updates that current ranges do not select automatically,
   such as the audit-time SQLite WASM build update.

Each batch must update both declared constraints and the lockfile deliberately.
Do not rely on unrelated lockfile churn to record an upgrade. Review the
resolved transitive diff, package lifecycle scripts, peer requirements, bundle
output, and audit delta before accepting the batch.

If a group fails, split it by package family or single dependency. Do not relax
tests, type safety, or audit policy to keep a batch together.

## Phase 4: Major Migrations

Each major is a separate design-aware implementation pull request. The initial
order is:

1. `@testing-library/jest-dom` 7.
2. Vitest 5.
3. TypeScript 7.
4. TanStack Table 9.
5. `@webext-core/messaging` 4.

The exact order may change only when peer requirements demonstrate a dependency
between migrations. Record that evidence in the phase plan.

### TanStack Table

CogniPace has two table ownership areas: Library and Tracks. TanStack Table 9
changes table construction, feature declarations, row-model setup, and state
access. Migrate both areas without using the legacy compatibility adapter as the
target architecture. Preserve filtering, sorting, pagination, selection,
expansion, row actions, and keyboard-accessible rendering.

### WebExt Messaging

Messaging is the highest-risk migration because the central protocol and
wrapper serve popup, dashboard, overlay, content script, and background code.
Update the shared messaging boundary first, preserve resolved return types in
the protocol map, and validate every sender/handler family. No extension
permission or sender-authorization expansion is allowed.

### TypeScript And Test Tooling

Treat new compiler or test failures as migration work. Do not suppress new
diagnostics broadly. Any narrow compatibility suppression must state the owning
upstream issue and removal condition.

## Phase 5: Dependency Automation

Add `.github/dependabot.yml` only after the baseline and staged upgrades are
green.

Configure weekly update checks for:

- npm production dependencies;
- npm development dependencies; and
- GitHub Actions.

Group minor and patch version updates by those three ownership categories.
Keep major updates as individual pull requests. Security updates must remain
prompt and must not wait for a large routine group. Limit concurrent open
version-update pull requests so automation does not crowd out product work.
Enable Dependabot security updates separately so security fixes are not tied to
the weekly version-update cadence.

Use release-compatible commit and pull-request prefixes:

- `deps(...)` for npm dependency updates;
- `ci(deps)` for GitHub Actions and dependency-automation updates.

Do not enable auto-merge. Every generated pull request must pass required checks
and receive the repository's normal review.

## Security And Audit Policy

- Keep `npm audit --omit=dev` at zero vulnerabilities.
- Use GitHub dependency review to block newly introduced vulnerable versions on
  pull requests.
- Keep GitHub dependency graph and vulnerability alerts enabled.
- Do not make a full-tree `npm audit` a required gate while the current
  `drizzle-kit` transitive advisory has no compatible fix.
- Record the `drizzle-kit` advisory, its development-only exposure, the rejected
  downgrade, and a review date in the implementation pull request or linked
  tracking issue.
- Recheck the exception whenever Drizzle Kit changes or a patched compatible
  release appears.
- Never expose secrets or grant broader workflow permissions to dependency
  tooling.

## Validation Strategy

Every dependency pull request starts with a clean install using the declared
toolchain and records the exact commands run and skipped.

Minimum automated validation for npm dependency changes:

```sh
npm ci
npm audit --omit=dev
npm run lint
npm run check
npm run build
npm run zip
npm run format
```

Focused validation is required before the full commands when an update has a
clear ownership area. Examples:

- table migrations: Library and Tracks table tests;
- messaging migration: protocol, runtime-policy, handler, cache invalidation,
  and feature API tests;
- database tooling: `npm run db:check` and migration-state review;
- WXT/Vite/React changes: affected surface tests and production bundle review;
- test-tool updates: run representative focused tests before the full suite.

Human-run happy-path and edge-case smoke proof is required for runtime-affecting
dependency changes:

- popup recommendation and navigation flow;
- dashboard Library, Tracks, Settings, and Analytics loading;
- LeetCode overlay load, save/update, Help, and recovery behavior;
- background runtime messaging, cache invalidation, and build reload; and
- any narrower flow owned by the updated dependency.

Dev-tool-only changes with no shipped behavior may document manual UI smoke as
not applicable, but CI or release workflow changes must state whether they were
validated locally, by static review, or by a dry-run pull request.

## Release And Rollback

Npm dependency pull requests use `deps(...)`, which intentionally triggers a
patch Release Please update under the current release policy. GitHub Actions and
automation-only changes use `ci(deps)` and do not trigger an app release unless
they also change the shipped artifact.

Every dependency batch and major migration must remain independently revertible.
Do not combine unrelated formatting, architecture refactors, or product changes
with an upgrade. If a released runtime dependency causes a regression, revert
that dependency pull request and ship the resulting patch rather than editing
the release artifact manually.

## Implementation Pull Request Boundaries

The expected pull request sequence is:

1. toolchain, lockfile, and existing typecheck repair;
2. formatting contract and one-time normalization;
3. CI job shape and required-check aggregate;
4. GitHub Actions upgrades and dependency review;
5. branch-protection activation after a dry run;
6. Vitest security patch;
7. non-major development dependency batches;
8. non-major runtime dependency batches;
9. one pull request for each major migration;
10. Dependabot configuration and dependency-policy handoff.

Adjacent low-risk steps may share a pull request only when they have the same
validation surface and rollback boundary. Major migrations never share a pull
request.

## Acceptance Criteria

- A clean checkout uses the declared Node/npm toolchain and passes `npm ci`.
- `npm run check`, `npm run build`, and `npm run format` pass locally and in CI.
- CI exposes stable Check, Build, Format, Dependency Review, and Required Checks
  results.
- Branch protection consumes the stable required checks only after a successful
  dry run.
- All direct npm and GitHub Actions dependencies are current on a suitable
  stable line or have a documented blocker and recheck path.
- Production dependency audit results remain at zero.
- The actionable Vitest advisory is fixed without forcing an incompatible
  Drizzle Kit downgrade.
- Major migrations preserve the affected behavior and have focused regression
  coverage.
- Weekly Dependabot updates are grouped by production npm, development npm, and
  GitHub Actions ownership, while majors remain separate.
- No dependency updates auto-merge.
- Runtime-affecting changes include human-run happy-path and edge-case smoke
  evidence before review or merge.
- Release Please, semantic pull-request titles, Chrome permissions, local data,
  and official extension artifact handling remain unchanged except for the
  validated dependency and CI updates described here.
