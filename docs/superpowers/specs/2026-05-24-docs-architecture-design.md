# CogniPace v2 Docs Architecture Design

## Context

CogniPace v2 is a local-first Chrome MV3 extension built with WXT, React,
TypeScript, TanStack Query, Drizzle, SQLite WASM, and feature-owned modules. The
current root docs already explain the high-level product, stack, source layout,
contributor rules, and UI direction. The original `../CogniPace` repository has
useful product and contributor docs, but its technical details are tied to the
old implementation and should not be copied directly.

The new docs should help friends understand, run, test, and contribute to the
app without creating a large documentation system that goes stale.

## Goals

- Give new collaborators a fast path from "what is this?" to running the
  extension locally.
- Explain the product in one canonical place, including all current surfaces and
  features.
- Explain the v2 architecture clearly enough for safe code changes.
- Give testers practical smoke flows and reset/troubleshooting guidance.
- Give contributors and agents compact recipes for common changes without
  splitting those recipes into too many files.
- Keep root docs short and make deeper docs easy to find.

## Non-Goals

- Do not create `docs/decisions/*` ADR files for this pass.
- Do not split product behavior into a separate `docs/features.md`; product
  behavior belongs in `docs/product.md`.
- Do not port old technical architecture docs verbatim.
- Do not document future features as approved implementation work.
- Do not introduce a documentation generator or site.

## Documentation Architecture

### `README.md`

The README remains the five-minute orientation:

- what CogniPace is
- the two-loop model: review now and study next
- primary surfaces: popup, LeetCode overlay, dashboard, background service
  worker
- stack summary
- install, dev, check, and build commands
- how to load the WXT-generated Chrome extension from `.output/chrome-mv3`
- a short docs map linking to product, architecture, testing, contributing,
  agents, and design guidance

The README should avoid duplicating full product and architecture details.

### `docs/product.md`

This is the canonical product reference. It should include:

- product summary and target user
- core problem and value proposition
- product principles: extension-first, local-first, no account system, no
  backend service, compact workflows, explicit scope
- current product status and known incomplete surfaces
- all current app surfaces and features:
  - popup recommendation flow
  - active tracks and track progression
  - LeetCode overlay session, timer, notes, submission capture, and review
    logging
  - Library/Problems
  - Settings
  - queue and FSRS practice scheduling
  - dashboard overview and analytics status
  - background service worker
- explicit non-goals and future candidates
- success criteria for the current project stage

Because the user asked for product docs to contain all features, this file owns
feature behavior instead of delegating that to `docs/features.md`.

### `docs/architecture.md`

This is the v2 technical map. It should include:

- source tree and ownership boundaries
- dependency direction: `entrypoints -> app -> features -> platform/lib/components`
- WXT entrypoints and runtime surfaces
- feature folder shape: `api`, `components`, `data`, `domain`, `hooks`, `server`
- runtime messaging flow through `src/extension/messaging.ts`,
  `runtime-policy.ts`, and `register-handlers.ts`
- Zod validation at extension boundaries
- local-first persistence with SQLite WASM, Drizzle schemas, migrations, seed
  data, and snapshot persistence
- TanStack Query as server-cache state, with invalidation after writes
- UI state guidance for dashboard, popup, and overlay
- "where to change things" recipes for common work:
  - add a runtime method
  - add a database table or migration
  - add or modify a dashboard route/modal
  - add a feature mutation
  - change popup behavior
  - change overlay behavior

The recipes live here instead of `docs/change-recipes.md` to keep the docs set
smaller.

### `docs/testing.md`

This is the practical friend-facing testing guide. It should include:

- local setup commands
- how to load and reload `.output/chrome-mv3` in Chrome
- smoke test flows:
  - open popup and verify review/track guidance
  - open dashboard and inspect Library, Tracks, and Settings
  - create/edit a problem
  - create/edit/set active track and active group
  - open a LeetCode problem page and use the overlay to log a review
  - verify popup/dashboard update after a saved review
- data reset guidance for local extension storage and migration resets
- troubleshooting for common WXT, service worker, SQLite WASM, Chrome
  extension, and LeetCode capture issues
- what useful bug reports should include
- validation command guidance: focused tests, `npm run check`, and
  `npm run format`

This file replaces the proposed `docs/product-testing.md`; the shorter name
keeps the docs map cleaner.

### `CONTRIBUTING.md`

The contributing guide remains the contributor workflow reference. It should:

- link to README, product, architecture, testing, design, and AGENTS docs
- keep the ownership map and coding rules
- keep database, runtime messaging, React, and testing guardrails
- include a compact "common change checklist" section that points to the deeper
  architecture recipes
- explain validation expectations by change type

### `AGENTS.md`

The agent guide should stay short and directive. It should:

- establish reading order
- state product and architecture authority
- repeat non-negotiable safety rules:
  - do not revert unrelated work
  - do not add account/backend/sync behavior without explicit approval
  - validate runtime payloads with Zod
  - keep DB writes behind owning repositories
  - keep feature boundaries intact
- point agents to `docs/architecture.md` for recipes and `docs/testing.md` for
  validation/smoke flows
- mention `docs/superpowers/README.md` as historical planning context

### `design.md`

Keep the current design guide in place for now. It already captures compact
extension UI direction and popup rules. Later it can move to `docs/ui.md`, but
that move is not required for this docs pass.

### `docs/superpowers/README.md`

Add an index for existing Superpowers plans and specs. It should clarify:

- these files are planning/history artifacts, not always current product truth
- current product truth lives in `docs/product.md`
- current architecture truth lives in `docs/architecture.md`
- which existing Superpowers docs are active, completed, or archival

## Reader Flows

### Friend Testing The Product

1. Read `README.md`.
2. Read `docs/product.md` for expected behavior.
3. Follow `docs/testing.md` smoke flows.
4. Report bugs with surface, steps, expected behavior, actual behavior,
   screenshots if useful, console/service-worker errors, and whether local data
   was reset.

### Friend Contributing Code

1. Read `README.md`.
2. Read `docs/product.md` for behavior.
3. Read `docs/architecture.md` for ownership and where to change code.
4. Read `CONTRIBUTING.md` for workflow and validation.
5. Use `docs/testing.md` for manual smoke coverage.

### Agent Changing The Repo

1. Read `AGENTS.md`.
2. Read the relevant product and architecture sections.
3. Use the architecture recipes to identify the owning feature/layer.
4. Keep edits scoped to the owning modules.
5. Run targeted validation first, then broader checks when the change is
   substantive.

## Drift And Error Handling

The docs should make authority explicit so stale planning files do not mislead
contributors:

- `docs/product.md` owns current product behavior and scope.
- `docs/architecture.md` owns current code structure and technical flow.
- `design.md` owns current visual and interaction direction.
- `docs/superpowers/*` files are historical or planning context unless a current
  file explicitly says otherwise.

When code behavior changes, update docs in the same change if the change affects
product behavior, architecture, setup, testing, or contributor workflow.

## Validation

This docs pass should be validated with:

- markdown formatting via the repository formatter
- link/path sanity review for new docs
- no runtime test claims unless runtime checks are actually run

Because the first implementation step is documentation-only, it does not need to
run the full extension test suite unless code or config files change.

## Implementation Order

1. Add or update `README.md` with the compact docs map.
2. Create `docs/product.md`.
3. Create `docs/architecture.md`.
4. Create `docs/testing.md`.
5. Add `docs/superpowers/README.md`.
6. Update `CONTRIBUTING.md` to point to the new docs and include compact change
   checklists.
7. Update `AGENTS.md` to link to the final docs set and remove duplicated detail
   where possible.
8. Run docs formatting and review links.

## Resolved Scope Decisions

- Do not add separate ADR files in this pass.
- Do not add `docs/features.md`; feature behavior belongs in `docs/product.md`.
- Do not move `design.md` unless the user asks for that cleanup later.
