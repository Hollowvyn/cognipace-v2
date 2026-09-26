# Topics Foundation And Library Filtering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver canonical topics, reliable typed relationships, and Library filtering without resetting existing local data.

**Architecture:** Problems owns taxonomy rules and persistence; platform database code owns staged snapshot upgrades. Background composition connects them before upgraded data becomes writable. Library filters validated direct/effective topic IDs supplied by Problems.

**Tech Stack:** TypeScript, SQLite WASM, Drizzle, Zod, React, TanStack Table/Query, Vitest, React Testing Library, WXT.

---

## Approved Design And Execution Boundary

Source: [Topics Foundation And Library Filtering](../specs/2026-09-26-topics-foundation-library-filtering-design.md), approved for planning on 2026-09-26.

This is the master execution map. Execute the linked phase plans in order. Each
phase ends with a passing check/build and a reviewable commit boundary; do not
release a schema-changing phase before the preserving-upgrade phase is present.
No application changes have been made by writing these plans.

| Order | Plan                                                                      | Independently verifiable outcome                                                                                  |
| ----- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1     | [Preserving upgrades](./2026-09-26-topics-phase-1-preserving-upgrades.md) | Existing snapshots open safely; unrecognized/corrupt data is retained; staged upgrades cannot publish on failure. |
| 2     | [Topic foundation](./2026-09-26-topics-phase-2-foundation.md)             | Typed graph, corrected aliases, complete inventory, backup v4, and Library read contracts.                        |
| 3     | [Library integration](./2026-09-26-topics-phase-3-library.md)             | Searchable topic picker, descendants, Any/All, accurate filtered actions, and complete smoke proof.               |

## Working Context

- Worktree: `/Users/tobiolutimehin/WebstormProjects/cognipace-v2/.worktrees/topics-foundation-spec`.
- Planning branch: `codex/topics-foundation-spec`, based on `origin/main` at `472a053`.
- The main checkout contains unrelated edits. Do not copy, stash, or revert them.
- Use Node 24.20.0 and npm 11.19.0 from the repository toolchain. The default shell
  can select Node 26; do not bypass `devEngines` when that happens.
- Prefix shell commands with `rtk`. In this environment Git's launcher fails on
  an Xcode license check; the installed executable
  `/Library/Developer/CommandLineTools/usr/bin/git` works. Use it without changing
  system license state.
- At implementation start, verify the worktree status and fetch origin. Rebase
  only this clean task branch if needed and revisit migration numbering if new
  database migrations have landed. Never overwrite a newer migration.
- Install dependencies in the implementation worktree with the pinned toolchain
  before tests. Do not rely on parent `node_modules`: the WASM test locator
  resolves relative to the worktree's own working directory.

```sh
rtk proxy env PATH=/Users/tobiolutimehin/.nvm/versions/node/v24.20.0/bin:/usr/bin:/bin:/opt/homebrew/bin npm ci
rtk proxy /Library/Developer/CommandLineTools/usr/bin/git status --short --branch
```

All later `rtk npm`/`rtk npx` commands assume the pinned toolchain is active.
If it is not, use the `rtk proxy env PATH=...` invocation above with the desired
command. Read `docs/agent-governance.md` before implementation. Load matching
implementation skills and Context7 documentation when reaching library/API
details; these plans rely on local source and define product behavior.

## Shared Interfaces Between Phases

```ts
type TopicRelationKind = 'broader' | 'applies-to'

interface TopicRelation {
  sourceTopicId: string
  targetTopicId: string
  kind: TopicRelationKind
}

interface TopicOption {
  id: string
  label: string
  aliases: string[]
}

interface TopicFilter {
  topicIds: string[]
  topicMatchMode: 'any' | 'all'
  includeSubtopics: boolean
}
```

Phase 2 adds required `effectiveTopicIds: string[]` to Library rows while keeping
`topics` as direct assignments. Its graph API is `buildTopicGraph(topics,
relations)` with `ancestorsOf(id)` and `effectiveTopicIds(directIds)`. Picker
search uses tolerant `normalizeTopicSearchKey`; topic creation uses validated
`normalizeTopicLookupKey`.

Phase 1 adds optional `getAppDb({ beforePublish })`. Its callback receives the
staged `DbHandle` and `{ kind: 'fresh' | 'upgrade', fromFingerprint: string | null }`.
Phase 2 supplies the callback from `src/extension/background/app-db.ts` and calls
Problems-owned reconciliation before snapshot publication. Platform must not
import Problems. Matching current snapshots do not rerun legacy reconciliation.

## Acceptance Traceability

| Design requirement                                                | Plan task                                 |
| ----------------------------------------------------------------- | ----------------------------------------- |
| Retain partial/corrupt storage; do not infer a fresh install      | Phase 1, tasks 1 and 4                    |
| Recognized old schema; preserve recovery; publish only on success | Phase 1, tasks 2–4                        |
| Retry, same-version reopen, and storage-failure behavior          | Phase 1, tasks 3–5                        |
| Unicode/slash normalization and stable IDs                        | Phase 2, normalization and identity tasks |
| Alias re-keying, collision validation, and lossy-history policy   | Phase 2, reconciliation tasks             |
| Complete inventory, multiple parents, applicability separation    | Phase 2, catalogue and graph tasks        |
| Backup v1–3 import and v4 round trip; existing Gist safety        | Phase 2, backup and integration tasks     |
| Direct/effective memberships and alias-bearing options            | Phase 2, read-model task                  |
| Picker alias search, canonical selection, safe partial queries    | Phase 3, task 2                           |
| Include descendants, Any/All, combined facets, clear/reset        | Phase 3, tasks 1 and 3                    |
| Unique rows, selected actions, pagination, keyboard UX            | Phase 3, tasks 3 and 4                    |
| Current docs, checks, human happy/edge smoke proof                | Every phase's final task                  |

## Execution Checklist

- [ ] Establish a clean implementation baseline with pinned dependencies.
- [ ] Complete Phase 1; retain passing failure-injection and real SQLite evidence.
- [ ] Complete Phase 2; verify populated pre-release snapshot and all supported backups.
- [ ] Complete Phase 3; verify filtering, actions, and accessible interactions.
- [ ] Run the final required checks once after integration, repeating only when changes or failures justify it.
- [ ] Have a human run the named happy-path and edge-case smoke flows and attach proof before PR review or merge.
- [ ] Fill the existing PR template with exact run/skipped commands, release impact, recovery limits, and proof links.

The only sync change is compatibility with the new backup shape. Queue ordering,
FSRS scheduling, analytics aggregation policy, and track progression stay under
their current owners. Do not implement topic-editor or prerequisite features.

## Validation And Handoff

Focused test commands are given in each phase. Schema generation belongs to
Phase 2, not the planning commit or Phase 1. Required final implementation checks:

```sh
rtk npm run db:check
rtk npm run lint
rtk npm run check
rtk npm run build
```

For these planning documents, run only Prettier with `--ignore-path /dev/null`
because historical planning files are excluded by the repository ignore file,
plus `git diff --check`. Record formatting failures and toolchain retries.
Runtime checks are deferred until implementation and must not be represented as
having passed. Human smoke and screenshot/recording proof remain release gates.
