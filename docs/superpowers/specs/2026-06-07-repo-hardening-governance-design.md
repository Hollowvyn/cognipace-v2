# Repo Hardening Governance Design

## Context

CogniPace v2 is a local-first Chrome MV3 extension built with WXT, React,
TypeScript, SQLite WASM, Drizzle, Zod, TanStack Query, TanStack Router, and
Vitest. The repository already has a strong product and architecture baseline:

- `docs/product.md` owns current product behavior and scope.
- `docs/architecture.md` owns technical structure, runtime boundaries, and
  change recipes.
- `docs/testing.md` owns manual verification expectations.
- `design.md` owns visible UI direction.
- `CONTRIBUTING.md` documents contribution and release expectations.
- `AGENTS.md` constrains agents to the current architecture and safety rules.

The v2 source layout is already intentionally structured around:

```text
entrypoints -> app -> features -> platform/lib/components
```

Architecture-boundary tests and ESLint rules already protect meaningful parts of
that structure. Phase 0 and Phase 1 setup work should therefore be treated as
effectively complete. The remaining work is repo hardening: making quality,
review, release, and process rules enforced automatically instead of relying on
contributors to behave carefully.

## Current Baseline

Current local command baseline:

- `npm run check` runs `npm run db:check`, WXT type generation, TypeScript,
  ESLint, and Vitest.
- `npm run build` builds the Chrome MV3 extension.
- `npm run format` runs `prettier --check .`.
- `npm run db:check` validates Drizzle schema and migration state.

Current observed validation state on June 7, 2026:

- `npm run check` passed locally.
- `npm run build` passed locally.
- `npm run format` failed locally because the current Prettier scope includes
  `.claude` skill-validation artifacts and historical planning files that are
  not yet formatted or should be ignored.

Current GitHub automation:

- `.github/workflows/ci.yml` exists and runs `npm run check` on pull requests
  and pushes to `main`.
- `.github/workflows/pr-title.yml` exists and validates Conventional
  Commit-style pull request titles.
- `.github/workflows/release-please.yml` exists and uses Release Please on
  pushes to `main`.
- Release Please builds, checks, zips, and uploads the extension artifact after
  a release is created.

Current GitHub repository settings observed through GitHub CLI:

- Default branch is `main`.
- Repository is public and in the `Hollowvyn` organization.
- `main` has branch protection enabled.
- Pull requests require one approving review.
- Required status checks are not enabled.
- Admin enforcement is disabled.
- Conversation resolution is not required.
- Stale review dismissal is disabled.
- CODEOWNER review is disabled.
- Merge commits are disabled.
- Squash merge is enabled.
- Rebase merge is still enabled.
- Auto-delete merged branches is disabled.
- Force pushes and branch deletion are disabled for `main`.

Current missing governance files or automation:

- PR template.
- Issue templates.
- CODEOWNERS.
- SECURITY.md.
- Dependabot configuration.
- PR body hygiene automation.
- Required status checks in branch protection.
- Full CI enforcement for formatting and production build on pull requests.

## Goals

- Make low-discipline pull requests unable to merge.
- Enforce tests, linting, type validation, build validation, and formatting in
  CI.
- Use repo-native commands wherever possible, especially `npm run check`,
  `npm run build`, and `npm run format`.
- Keep the operating model simple enough for a small extension repository.
- Preserve semantic pull request title enforcement as the release signal.
- Preserve Release Please as the release engine.
- Make branch protection and required checks part of the final state.
- Add GitHub templates and governance that guide useful work without creating
  excessive ceremony.
- Keep optional third-party tooling deferred until native GitHub controls are
  working cleanly.

## Non-Goals

- Do not change product scope.
- Do not add account, auth, backend, hosted sync, team, or generic SaaS
  behavior.
- Do not expand Chrome permissions.
- Do not replace Release Please with Changesets, semantic-release, or a custom
  release system.
- Do not add Renovate while Dependabot is responsible for dependency updates.
- Do not add coverage gates until coverage is intentionally generated and
  reviewed.
- Do not require an issue for tiny low-risk maintenance changes unless that rule
  proves useful later.
- Do not implement all phases in one pull request.

## Recommended Approach

Use one master governance design, then execute the work phase by phase through
separate implementation plans.

The master design owns the end-state and phase order. Each implementation phase
should be small enough to review independently, with its own focused plan and
validation. The most important phases now are Phase 4 through Phase 7 because
the architecture, docs, scripts, and release foundation already exist.

Recommended execution order:

1. Fix the local validation contract so formatting can become a real gate.
2. Harden CI around stable required checks.
3. Turn on branch protection requirements that consume those checks.
4. Add PR and issue governance.
5. Tighten release governance without increasing release noise.
6. Add dependency and security automation only after native gates are stable.

## Operating Model

### Local Commands

Code-bearing changes should be validated with:

```sh
npm run check
npm run build
npm run format
```

Docs-only and governance-only changes may use targeted Prettier checks during
development, but once the formatting gate is corrected, `npm run format` should
also pass on the repository.

Database changes additionally require:

```sh
npm run db:generate
npm run db:check
```

`npm run check` remains the primary quality command because it already includes
Drizzle checks, WXT type generation, TypeScript, ESLint, and Vitest.

### CI Checks

Pull request CI should have stable, branch-protection-friendly check names.

Required jobs:

- `Check`: runs `npm run check`.
- `Format`: runs `npm run format`.
- `Build`: runs `npm run build`.
- `Dependency Review`: runs only on pull requests.
- `Required Checks`: aggregate gate that fails if any required job fails.

The aggregate job gives branch protection one stable check name while preserving
useful job-level detail for developers.

### Pull Request Governance

Pull requests must communicate enough context for review:

- why the change exists
- what changed
- what validation ran
- what risk areas were touched
- screenshots or recordings for visible popup, dashboard, or overlay changes
- linked issue for meaningful product, runtime, database, architecture, CI,
  release, or governance work

Issue links should not be required for tiny low-risk changes such as typo fixes,
format-only changes, release PRs, Dependabot updates, or maintainer-approved
maintenance. The escape hatch should be explicit through a maintainer-owned
label such as `no-issue-needed`.

### Branch Protection

The protected `main` branch should enforce:

- pull request required before merge
- one approving review minimum
- stale review dismissal after new commits
- conversation resolution before merge
- required status checks before merge
- required branch to be up to date before merge
- force pushes disabled
- branch deletion disabled
- admin enforcement enabled unless a documented emergency exception is needed

Required checks should include:

- `Required Checks`
- `Validate PR title`
- `PR Hygiene`

Squash merge should be the only normal merge strategy. Rebase merge should be
disabled so the release signal remains the pull request title used for squash
merge.

### Release Governance

CogniPace should continue to use semantic pull request titles and Release
Please.

Release flow:

1. Pull request title follows Conventional Commit format.
2. PR title validation blocks invalid titles.
3. PR merges by squash merge.
4. Release Please reads the squash commit on `main`.
5. Release Please opens or updates the release pull request.
6. The release pull request passes the same required checks as other PRs.
7. Merging the release pull request creates the tag and GitHub Release.
8. Release automation builds, checks, formats after the formatting gate is fixed,
   zips, and uploads the extension artifact.
9. The GitHub Release zip is the official Chrome Web Store handoff artifact.

Release tightening should stay low-noise. The current semantic title +
Release Please model should be retained instead of adding per-PR release files
or manual changelog work.

## Phased Plan

### Phase 0: Authority And Scope Baseline

Status: effectively complete.

Goals:

- Keep current product and architecture authority clear.
- Prevent hardening work from becoming product expansion.
- Preserve local-first extension boundaries.

Ordered steps:

1. Treat `docs/product.md`, `docs/architecture.md`, `docs/testing.md`,
   `design.md`, `CONTRIBUTING.md`, and `AGENTS.md` as current authority.
2. Keep the dependency direction
   `entrypoints -> app -> features -> platform/lib/components`.
3. Keep runtime payload validation at extension boundaries.
4. Keep database writes behind owning feature repositories or services.

Done when:

- The repository has clear product, architecture, testing, design, contribution,
  and agent authority docs.
- Hardening work does not add product scope.

### Phase 1: Local Validation Contract

Status: mostly complete, with formatting gate blocked.

Goals:

- Make the local quality contract explicit and runnable.
- Ensure every required command can be enforced by CI.

Ordered steps:

1. Keep `npm run check` as the primary validation command.
2. Keep `npm run build` as the production bundle validation command.
3. Fix the formatting scope so `npm run format` passes on the intended
   repository surface.
4. Decide whether `.claude` and historical Superpowers planning artifacts should
   be ignored by Prettier or normalized.
5. Update docs if the formatting policy changes.

Done when:

- `npm run check` passes.
- `npm run build` passes.
- `npm run format` passes.
- The formatting gate only checks files the repository intends to keep
  formatted.

### Phase 2: CI Required Checks Foundation

Status: partially complete.

Goals:

- Run all non-negotiable validation automatically on pull requests.
- Provide stable check names for branch protection.
- Avoid relying on contributors to run local commands.

Ordered steps:

1. Add workflow concurrency so superseded PR runs cancel cleanly.
2. Keep `npm ci` for deterministic installs.
3. Keep Node 24 in GitHub Actions.
4. Split CI into `Check`, `Format`, `Build`, and pull-request-only
   `Dependency Review` jobs.
5. Add a final `Required Checks` aggregate job.
6. Ensure CI runs on pull requests and pushes to `main`.

Done when:

- Every PR runs `npm run check`, `npm run format`, and `npm run build`.
- Dependency review runs on PRs.
- The aggregate required check fails if any required validation fails.
- Check names are stable enough for branch protection.

### Phase 3: GitHub Templates And Repository Governance Files

Status: missing.

Goals:

- Make PR and issue quality structural.
- Reduce vague work requests and vague PRs.
- Keep templates low-friction because they become permanent process.

Ordered steps:

1. Add `.github/PULL_REQUEST_TEMPLATE.md`.
2. Require PR sections for summary, why, validation, risk, issue link, and UI
   evidence when relevant.
3. Add issue forms for bug reports, work requests, and maintenance/governance
   tasks.
4. Disable blank issues.
5. Add `SECURITY.md`.
6. Add labels for type, area, risk, dependencies, and review state.
7. Add CODEOWNERS only if the repository has meaningful owners to encode.

Done when:

- New PRs start with useful review structure.
- New issues capture enough context to triage.
- Security reports have a private reporting path.
- CODEOWNERS is either added with meaningful ownership or explicitly deferred.

### Phase 4: Branch Protection And Merge Restrictions

Status: started but insufficient.

Goals:

- Make `main` protected by enforced checks and review rules.
- Prevent direct or low-discipline merges.
- Keep release history compatible with Release Please.

Ordered steps:

1. Keep `main` as the default branch.
2. Require pull requests before merge.
3. Require at least one approving review.
4. Enable stale review dismissal.
5. Enable conversation resolution.
6. Enable required status checks.
7. Require `Required Checks`, `Validate PR title`, and `PR Hygiene`.
8. Require branches to be up to date before merge.
9. Disable rebase merge.
10. Keep squash merge enabled as the normal merge path.
11. Keep merge commits disabled.
12. Enable auto-delete merged branches.
13. Keep force pushes and branch deletion disabled.
14. Enable admin enforcement unless a documented emergency path is required.

Done when:

- A PR with failing CI cannot merge.
- A PR with an invalid title cannot merge.
- A PR with missing hygiene cannot merge.
- Stale approvals cannot carry changed code into `main`.
- Squash merge is the only normal merge strategy.

### Phase 5: PR Hygiene Automation

Status: missing.

Goals:

- Block vague PRs before they reach merge.
- Enforce issue linkage for meaningful work.
- Keep exceptions explicit and maintainer-controlled.

Ordered steps:

1. Add a `PR Hygiene` workflow.
2. Validate that required PR template sections are present.
3. Reject placeholder-only sections such as empty summaries or unedited template
   text.
4. Require an issue link for meaningful changes.
5. Allow issue-link exceptions for low-risk changes or the
   `no-issue-needed` label.
6. Validate that PRs list actual validation commands or explicitly state why a
   command was not applicable.
7. Optionally add a path labeler so risk areas are visible automatically.

Done when:

- A PR with a bad title, missing context, missing validation, or missing required
  issue link cannot merge.
- Low-risk maintenance remains possible without excessive ceremony.
- Reviewers see risk areas before reading every file.

### Phase 6: Release Process Tightening

Status: good base, tighten lightly.

Goals:

- Preserve the current simple Release Please model.
- Ensure release PRs pass the same protected checks.
- Ensure official artifacts are produced by automation.

Ordered steps:

1. Keep semantic PR title enforcement.
2. Keep Release Please as the only version and changelog engine.
3. Keep `RELEASE_PLEASE_TOKEN` so release PRs trigger normal checks.
4. Make release PRs subject to branch protection like any other PR.
5. Add `npm run format` to the release artifact path after formatting is fixed.
6. Keep `npm run check`, `npm run build`, and `npm run zip` in the release
   artifact path.
7. Keep Chrome Web Store upload manual, using the GitHub Release zip.

Done when:

- Release PRs cannot bypass required checks.
- A broken release build does not produce an official handoff artifact.
- The release process stays semantic, automated, and low-noise.

### Phase 7: Dependency, Security, And Optional Tooling

Status: missing.

Goals:

- Keep dependencies and security hygiene moving automatically.
- Prefer GitHub-native automation first.
- Avoid overlapping bot noise.

Ordered steps:

1. Add Dependabot for npm and GitHub Actions.
2. Group minor and patch dependency updates.
3. Keep major dependency updates separate for manual review.
4. Enable or confirm GitHub dependency graph, vulnerability alerts, and security
   fixes.
5. Add CodeQL or GitHub code scanning when enabled for the repository.
6. Consider Semgrep after native CI, branch protection, and dependency hygiene
   are stable.
7. Add coverage reporting only after coverage generation is intentionally added.
8. Do not add Renovate unless Dependabot is removed.
9. Do not add Mergify unless PR throughput makes merge coordination painful.

Done when:

- Dependency updates arrive on a predictable cadence.
- Security alerts have a clear handling path.
- Optional tools add signal instead of duplicating existing automation.

## Issue Requirement Policy

Meaningful PRs should link an issue. This includes product behavior, runtime
messaging, database, architecture, UI workflow, CI, release, and governance
changes.

Issue links should not be required for:

- Release Please release PRs.
- Dependabot PRs.
- typo-only documentation changes.
- formatting-only changes.
- narrowly scoped CI maintenance.
- maintainer-approved exceptions labeled `no-issue-needed`.

This policy is intentionally strict for work that can destabilize the system and
intentionally light for low-risk maintenance.

## CODEOWNERS Policy

CODEOWNERS should be added only when ownership is meaningful. A fake ownership
map creates noise without improving review quality.

Good candidates:

- `.github/**`
- `docs/**`
- `src/extension/**`
- `src/platform/db/**`
- `src/features/sync/**`
- `src/features/genai/**`
- `src/entrypoints/**`
- `wxt.config.ts`

If there is only one maintainer, CODEOWNERS may still be useful for forcing
explicit review on sensitive paths, but it should be documented as a risk-area
gate rather than a team ownership map.

## Error Handling And Failure Modes

- If formatting fails because Prettier scans unintended files, fix the
  formatting scope before making `Format` required.
- If dependency review fails because of an introduced vulnerable dependency, the
  PR should not merge until the dependency is removed, upgraded, or explicitly
  accepted by a maintainer.
- If PR title validation fails, edit the PR title instead of bypassing Release
  Please semantics.
- If PR hygiene fails on a legitimate exception, apply the documented exception
  label rather than weakening the workflow.
- If release artifact upload fails, do not upload a local zip to the Chrome Web
  Store for that version.
- If branch protection blocks an emergency fix, use a documented administrator
  emergency procedure and follow with a retrospective cleanup PR.

## Validation Plan

Before enabling branch protection requirements:

1. Run `npm run check`.
2. Run `npm run build`.
3. Run `npm run format`.
4. Open a test PR or use an existing PR to confirm the new CI check names appear.
5. Enable required checks only after the expected check names have appeared at
   least once.

After enabling branch protection:

1. Confirm a failing required check blocks merge.
2. Confirm an invalid PR title blocks merge.
3. Confirm a missing PR hygiene section blocks merge.
4. Confirm a valid low-risk exception can pass using the documented exception
   path.
5. Confirm release PRs still receive normal checks.

## Implementation Strategy

Do not implement this design as one large pull request.

Recommended implementation plans:

1. Local validation and formatting scope.
2. CI hardening and required check shape.
3. GitHub templates, issue forms, labels, and PR hygiene.
4. Branch protection and merge settings.
5. Release workflow tightening.
6. Dependabot and security automation.

Each phase should have its own implementation plan, focused validation, and
handoff summary. Separate chats or threads are recommended for implementation
phases so each phase has a clean context and review boundary.

## Open Decisions

These decisions should be made during phase implementation, not guessed in this
master spec:

- Whether to ignore or reformat historical Superpowers planning artifacts.
- Whether to ignore `.claude` entirely or only generated skill-validation
  outputs.
- Whether CODEOWNERS should represent real maintainers or only sensitive-path
  gates.
- Whether admin enforcement needs a documented emergency exception.
- Whether PR Hygiene should be implemented as a shell script, GitHub Action, or
  small Node script.

## Acceptance Criteria

The hardening program is complete when:

- `npm run check` passes locally and in CI.
- `npm run build` passes locally and in CI.
- `npm run format` passes locally and in CI.
- Pull requests with failing required checks cannot merge.
- Pull requests with invalid semantic titles cannot merge.
- Pull requests missing required governance context cannot merge.
- `main` is protected with required status checks.
- Squash merge is the only normal merge path.
- Release Please remains the release engine.
- Release PRs are checked like normal PRs.
- Official release zips are created by GitHub Actions.
- Dependency and security automation is present without overlapping bot noise.
