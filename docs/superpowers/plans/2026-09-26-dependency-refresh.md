# Dependency Refresh Implementation Plan

> Execute using superpowers:subagent-driven-development with disjoint table migration ownership and parent-owned dependency/tooling integration.

**Goal:** Update all compatible stable npm dependencies and audit GitHub Actions in one draft PR.

**Approved scope:** On September 26, 2026, the user approved one combined dependency PR, including migration fixes, retaining supported TypeScript 6 and Node 24 types. This explicitly supersedes the earlier design’s separate-PR requirement for this update. Preserve product behavior, permissions, persistence formats, and feature ownership.

**Architecture:** Migrate Library and Tracks directly to TanStack Table 9 feature declarations, row models, state, and rendering APIs. Preserve the shared extension messaging protocol and authorized sender boundary when updating WebExt Messaging. Update tooling without suppressing diagnostics or forcing incompatible peer dependencies.

**Tech stack:** React 19, TanStack Table 9, WebExt Messaging 4, WXT, Vite, Vitest 5, TypeScript 6, Node 24, npm 11.

## Dependency and tooling phase

- [x] Refresh all 43 direct npm dependencies against registry metadata; retain TypeScript 6.0.3 because typescript-eslint 8.70.1 requires TypeScript below 6.1. Retain Node 24 types aligned with the pinned runtime.
- [x] Update package.json and package-lock.json using the pinned Node 24.20.0/npm 11.19.0 toolchain. Do not use force or legacy-peer-deps.
- [x] Audit pinned Actions against official releases and update only where a newer compatible stable release exists.
- [x] Adapt vitest.config.ts or src/testing/setup-tests.ts only if new tooling requires it. Use existing representative component and runtime tests to expose incompatibilities.

## Table migration phase

- [x] Update src/features/problems/components/library/use-problem-library-table.ts, problem-library-columns.tsx, problem-library-filtering.ts, problem-library-table.tsx, and src/features/tracks/components/track-problem-table.tsx to Table 9 APIs. Add feature-local declarations if shared typing requires them.
- [x] Preserve filtering, sorting, pagination, selection, single-row expansion, track order, row actions, and keyboard semantics.
- [x] Run npm run test -- src/features/problems src/features/tracks and fix migration regressions without weakening assertions.

## Messaging migration phase

- [x] Inspect Messaging 4 declarations and migration docs; adapt src/extension/messaging.ts only as required while retaining resolved ProtocolMap return types and existing authorization/Zod parsing.
- [x] Run npm run test -- src/extension to verify runtime-policy, handlers, contracts, and cache effects.

## Integration and handoff phase

- [x] Run npm ci, npm audit --omit=dev, npm audit, npm run lint, npm run check, npm run build, npm run zip, npm run store:check, and npm run format. Record exact failures and skipped checks.
- [x] Review the complete diff and dependency tree. Fix supported compatibility issues and document upstream blockers rather than bypassing peers or tests.
- [ ] Commit with a deps Conventional Commit title, push the task branch, and create a draft PR using the repository template.
- [x] Include pending human smoke flows: popup recommendation/navigation; Library filtering/sorting/paging/selection; Tracks order/expansion; Settings and Analytics; overlay save/update/recovery; background messaging and cross-surface refresh; production package reload. Human screenshots/recordings are required before review or merge.

**Human review gate:** Real-browser happy-path and edge-case smoke testing and screenshot/recording proof remain pending. Draft status must remain until that proof is supplied.

**Done when:** Compatible dependency versions are updated, required automated checks are reported honestly, exceptions are explicit, and the draft PR is linked. Human smoke proof remains a review gate.

## Registry and audit decisions

The September 26 registry audit updated 37 of 43 direct package constraints.
The other six packages were already current. Final `npm outdated --json`
reports only the deliberate compatibility exceptions:

- TypeScript 6.0.3 instead of 7.0.2: typescript-eslint 8.70.1 declares
  `>=4.8.4 <6.1.0`. Recheck when typescript-eslint supports TypeScript 7.
- @types/node 24.19.0 instead of 26.6.3: match the pinned Node 24 runtime.
  Recheck with the next runtime-major migration.

All seven GitHub Actions already match their official latest stable releases:
actions/checkout v7.0.1, actions/setup-node v7.0.0,
actions/dependency-review-action v5.0.0, actions/labeler v7.0.0,
actions/stale v11.0.0, googleapis/release-please-action v5.0.0, and
amannn/action-semantic-pull-request v6.1.1. Their pinned SHAs are unchanged.

Production audit: zero vulnerabilities. Full audit: four existing moderate
findings in the development-only drizzle-kit → @esbuild-kit/esm-loader →
@esbuild-kit/core-utils → esbuild chain (GHSA-67mh-4wv8-2f99).
The advisory affects esbuild’s development server; this repository uses
Drizzle Kit for migration generation/checking, not that development server.
The latest stable Drizzle Kit 0.31.11 still carries the chain. npm suggests an
incompatible downgrade to 0.18.1, which was not applied. Recheck on October 26,
2026, or the next Drizzle Kit release, whichever comes first.

The Prettier upgrade requires formatting-only union layout changes in 15
existing source files. No permissions, persistence schema, release workflows,
GitHub secrets, or required check names change. The `deps` PR title requests
a patch release under existing Release Please policy. Roll back by reverting
the dependency PR and rebuilding the extension; no data reset is required.
