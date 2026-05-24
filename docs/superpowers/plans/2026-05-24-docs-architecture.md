# Docs Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a compact, useful documentation set for CogniPace v2 so friends and agents can understand, run, test, and safely contribute to the project.

**Architecture:** Root docs stay short and point to deeper references. `docs/product.md` owns current product behavior and feature status, `docs/architecture.md` owns technical structure and change recipes, and `docs/testing.md` owns manual smoke flows and validation guidance. Existing `design.md` remains the UI reference, and `docs/superpowers/README.md` makes planning artifacts clearly historical.

**Tech Stack:** Markdown docs for a WXT Chrome MV3 extension using React 19, TypeScript, TanStack Query, TanStack Router, Drizzle, SQLite WASM, Zod, Vitest, React Testing Library, and Tailwind CSS tokens.

---

## Spec Source

Implement the approved design in:

- `docs/superpowers/specs/2026-05-24-docs-architecture-design.md`

Do not create these files in this pass:

- `docs/decisions/*`
- `docs/features.md`
- `docs/change-recipes.md`
- `docs/product-testing.md`

Do not move `design.md` in this pass.

## File Map

- Modify `README.md`: keep it as the five-minute orientation and add a compact docs map.
- Create `docs/product.md`: canonical product, current surfaces, feature status, non-goals, future candidates, and success criteria.
- Create `docs/architecture.md`: v2 source structure, ownership, runtime messaging, database flow, query invalidation, UI state rules, and common change recipes.
- Create `docs/testing.md`: local setup, Chrome extension loading, smoke flows, reset guidance, troubleshooting, bug report guidance, and validation commands.
- Create `docs/superpowers/README.md`: index existing specs/plans and explain which files are product truth versus planning history.
- Modify `CONTRIBUTING.md`: keep contributor rules, link to the new docs, and add compact common-change checklists.
- Modify `AGENTS.md`: keep it short, directive, and linked to the new docs.

## Baseline Safety

- [ ] **Step 1: Check worktree before editing**

Run:

```bash
git status --short
```

Expected: note any pre-existing modified or untracked files. Do not stage or overwrite unrelated user work.

- [ ] **Step 2: Read current source docs**

Run:

```bash
sed -n '1,260p' README.md
sed -n '1,280p' CONTRIBUTING.md
sed -n '1,260p' AGENTS.md
sed -n '1,260p' design.md
sed -n '1,280p' docs/superpowers/specs/2026-05-24-docs-architecture-design.md
```

Expected: confirm current docs match the approved spec and that `design.md` remains the canonical UI reference.

## Task 1: README Docs Map And Orientation

**Files:**

- Modify: `README.md`

- [ ] **Step 1: Keep README focused on orientation**

Ensure the README keeps these current facts:

- CogniPace is a local-first Chrome MV3 extension for deliberate LeetCode review and study pacing.
- It shows two loops: review now and study next.
- The repo is the v2 rebuild of `../CogniPace`.
- The stack is WXT, React 19, TypeScript, TanStack Query, TanStack Router, Zod, SQLite WASM, Drizzle, Vitest, React Testing Library, and Tailwind CSS tokens.
- Local Chrome loading uses `.output/chrome-mv3`.

- [ ] **Step 2: Add a concise `Project Docs` section**

Add or replace the README docs section with this content:

```markdown
## Project Docs

- [Product](./docs/product.md): app purpose, current feature behavior, scope, non-goals, and future candidates.
- [Architecture](./docs/architecture.md): source layout, ownership boundaries, runtime messaging, local data flow, and common change recipes.
- [Testing](./docs/testing.md): local setup, Chrome loading, manual smoke flows, reset guidance, and validation commands.
- [Contributing](./CONTRIBUTING.md): workflow, coding rules, review checklist, and validation expectations.
- [Agent Guide](./AGENTS.md): required reading order and safety rules for AI agents.
- [Design](./design.md): compact extension UI direction, surface-specific UX rules, and visual tokens.
```

- [ ] **Step 3: Remove README duplication that belongs in deeper docs**

Keep short summaries in README, but move detailed product behavior, runtime recipes, and tester smoke flows to the new docs created in later tasks.

- [ ] **Step 4: Validate README formatting**

Run:

```bash
npx prettier --check README.md
```

Expected: `All matched files use Prettier code style!`

- [ ] **Step 5: Review README diff**

Run:

```bash
git diff -- README.md
```

Expected: README still reads as a quick orientation, not a full reference manual.

## Task 2: Product Reference

**Files:**

- Create: `docs/product.md`

- [ ] **Step 1: Create the product doc with this structure**

Write `docs/product.md` using these sections and content. Keep the prose concise, but preserve the listed facts.

```markdown
# Product

## Product Summary

CogniPace is a local-first Chrome MV3 extension for deliberate LeetCode review and study pacing. It helps a user keep two loops visible while studying:

- what to review now, using FSRS-backed spaced repetition
- what to study next, using the active curated track

The app is intentionally a compact browser tool, not a SaaS app, hosted study platform, or general React dashboard.

## Target User

CogniPace is for someone preparing for coding interviews who already uses LeetCode, wants to remember previously solved problems, wants curated progression through study tracks, and wants guidance inside the browser without creating an account.

## Core Problem

Interview prep often splits into two weak workflows: random LeetCode grinding with poor retention, or curated lists that do not remind the user to review older material. CogniPace combines retention and progression by showing both a review target and the next track target.

## Product Principles

- Extension-first: optimize for popup, dashboard, overlay, and background service-worker realities.
- Local-first: persisted user data lives in the extension.
- No account system: no sign-in, authentication, or hosted identity in the current scope.
- No backend service: scheduling, queue composition, tracks, and settings run locally.
- Compact workflows: prefer direct actions, short copy, and low ceremony.
- Explicit scope: future ideas are not approved work until a human explicitly asks for them.

## Current Status

Implemented or meaningfully wired:

- Popup command surface
- LeetCode content-script overlay
- Dashboard shell and navigation
- Library/Problems management
- Tracks workspace and management
- Settings
- FSRS-backed practice scheduling
- Runtime messaging, cache invalidation, local database, migrations, and seed data

Currently incomplete or intentionally light:

- Overview is a dashboard route with a planned guided-practice home.
- Analytics is a dashboard route reserved for future scheduling and reporting work.
- Backup/reset workflows are future dashboard work.

## Product Surfaces

### Popup

The popup is the fast command surface. It should answer what to review now and what to study next without becoming a mini dashboard.

Current behavior:

- shows compact metric tiles
- shows a review recommendation
- allows recommendation shuffle when available
- shows study-mode or freestyle track guidance
- opens the current problem when a problem action is available
- links to Settings and Tracks where relevant
- keeps feedback scoped to the affected surface area

### LeetCode Overlay

The overlay runs on LeetCode problem pages and supports in-context practice logging.

Current behavior:

- collapsed, expanded, and docked visual modes
- timer start, pause, and reset
- target-time awareness
- quick submit preparation from the collapsed state
- expanded submit, fail, update, restart, and rating controls
- structured draft fields managed through the overlay session
- settings access from the overlay
- page metadata and problem context sync through content-script/runtime messages

### Dashboard

The dashboard is the control and inspection surface for product state.

Current behavior:

- Library manages problem rows, filters, details, create/edit modals, and problem practice actions.
- Tracks manages active track workspace, groups, ordered problems, progress, create/edit, activation, deletion, and reset progress.
- Settings manages persisted user preferences through a dirty-state form workflow.
- Overview and Analytics currently reserve route ownership and are not finished product surfaces.

### Background Service Worker

The background service worker owns trusted extension runtime work:

- local database access
- runtime sender authorization
- runtime handler registration
- feature service calls
- database snapshot persistence
- cache invalidation broadcasts

## Features

### Practice Scheduling

Practice state is local and FSRS-backed. The persisted database owns practice facts, and UI surfaces read them through feature services and runtime messages.

### Queue

The queue composes review recommendations from local practice state, settings, and problem data. Popup guidance should keep queue recommendation and track progression visibly separate.

### Problems And Library

Problems owns LeetCode problem identity, difficulty, premium status, topics, companies, catalog rows, and problem-level practice details. Library is the dashboard surface for inspecting and editing that problem data.

### Tracks

Tracks owns curriculum progression. Track completion is separate from global practice history, and active track/session state is local database state. Tracks can contain groups and ordered problem memberships.

### Settings

Settings owns persisted preferences, defaults, validation, and the dashboard settings form. Changes should flow through the settings feature API and invalidate affected query families.

### LeetCode Capture

LeetCode capture reads page metadata, page content, and submission result information from the content script and passes validated data through runtime messaging.

## Non-Goals

- account creation
- authentication
- cloud sync
- hosted backend services
- multi-user or team workflows
- generic SaaS dashboard expansion
- mobile app support
- broad browser support beyond the current Chrome MV3 target

## Future Candidates

These are possible future directions, not approved work by default:

- overview home polish
- richer analytics
- backup and reset workflows
- import/export workflows
- improved notification strategy
- sync across browsers or devices if local-only scope changes

## Success Criteria

The current product stage is successful when a user can:

- open the popup and identify a useful review target
- identify the next problem in the active track
- open a LeetCode problem page and log a review from the overlay
- inspect and maintain Library problems
- manage tracks and active progression
- adjust settings
- keep all persisted state local unless a future product decision changes that

## Canonicality

This document owns current product behavior and scope. Technical structure lives in `docs/architecture.md`. Manual verification lives in `docs/testing.md`. Visual and interaction guidance lives in `design.md`. Superpowers specs and plans are planning artifacts unless a current doc explicitly says otherwise.
```

- [ ] **Step 2: Validate product doc formatting**

Run:

```bash
npx prettier --check docs/product.md
```

Expected: `All matched files use Prettier code style!`

- [ ] **Step 3: Check product doc for overclaims**

Run:

```bash
rg -n "account|backend|sync|Overview|Analytics|backup|future|not approved" docs/product.md
```

Expected:

- account/backend/sync are listed as non-goals or future only
- Overview and Analytics are marked incomplete
- backup/reset/import/export are marked future unless implementation exists at execution time

## Task 3: Architecture Reference And Change Recipes

**Files:**

- Create: `docs/architecture.md`

- [ ] **Step 1: Create the architecture doc with this structure**

Write `docs/architecture.md` using these sections and content. Use current v2 paths, not old `../CogniPace` paths.

````markdown
# Architecture

## System Shape

CogniPace v2 is a WXT Chrome MV3 extension with four runtime surfaces:

- popup
- dashboard
- LeetCode content-script overlay
- background service worker

The core dependency direction is:

```txt
entrypoints -> app -> features -> platform/lib/components
```

Shared infrastructure must not import app or feature code. Feature modules own their domain and expose narrow public surfaces.

## Source Layout

```txt
src/
  entrypoints/   # WXT boot files only
  app/           # providers, route shells, dashboard, popup, overlay composition
  components/    # shared UI primitives only
  extension/     # typed messaging, runtime policy, background handlers
  features/      # product feature modules
  hooks/         # shared React hooks
  lib/           # product-owned integrations
  platform/      # Chrome, DB, query, and time adapters
  styles/        # global tokens and surface styles
  testing/       # test setup, architecture tests, fixtures, helpers
  types/         # project-wide declarations
  utils/         # shared utilities
```

## Runtime Surfaces

### Entrypoints

`src/entrypoints` should stay thin. Entrypoints bootstrap WXT surfaces and render app shells. They should not own product logic.

Current entrypoints:

- `src/entrypoints/background.ts`
- `src/entrypoints/popup/main.tsx`
- `src/entrypoints/dashboard/main.tsx`
- `src/entrypoints/leetcode.content.tsx`

### App Layer

`src/app` composes feature UI into extension surfaces:

- popup shell in `src/app/popup`
- dashboard shell, route metadata, and screens in `src/app/dashboard`
- overlay app shell in `src/app/overlay`
- shared providers in `src/app/providers`

### Features

Use only the folders a feature needs:

```txt
src/features/<feature>/
  api/          # runtime contracts, runtime senders, React Query hooks
  components/   # feature-specific UI
  data/         # Drizzle repositories and row mapping
  domain/       # pure rules, types, reducers, view models
  hooks/        # feature-specific React hooks
  server/       # background-safe use cases
```

Feature ownership:

- `app-shell`: popup, dashboard, and overlay read models plus popup controller view mapping
- `overlay-session`: overlay state, timer, draft, reducer, review actions, and mode components
- `practice`: FSRS review state, attempts, cards, practice logs, scheduling writes
- `problems`: LeetCode problem identity, normalization, catalog upserts, problem context
- `queue`: daily recommendation queue composition
- `tracks`: active track, active group, track progress, track workspace
- `settings`: user settings schema, defaults, persistence
- `assessment`: solve-time and rating decisions
- `leetcode-capture`: LeetCode page/background capture contracts and services

## Runtime Messaging

UI and content scripts communicate with the background through typed runtime messages.

Change points:

- contracts and schemas live in feature `api/*-contracts.ts`
- protocol methods are declared in `src/extension/messaging.ts`
- sender authorization lives in `src/extension/background/runtime-policy.ts`
- handlers are registered in `src/extension/background/register-handlers.ts`
- business logic belongs in feature `server`
- database reads and writes belong behind feature `data` repositories

Runtime boundary rules:

- validate payloads with Zod at the boundary
- authorize senders before database access
- serialize `Date` values to strings at API boundaries
- broadcast cache invalidation after successful mutations

## State And Data Flow

SQLite is the persisted source of truth. TanStack Query is a cache over runtime-backed reads, not a global app store.

Standard mutation flow:

```txt
user action -> runtime command -> DB write -> snapshot flush -> invalidation broadcast -> query refetch -> render
```

Local React state is appropriate for transient UI state such as open menus, form drafts, dirty tracking, overlay timer state, and async feedback. Persisted product facts should come from the database-backed query path.

## Database And Persistence

Schema lives in `src/platform/db/schema`. Migrations live in `src/platform/db/migrations`. Seed data lives in `src/platform/db/seed.ts`.

Rules:

- edit schema files before generating migrations
- export new schema files from `src/platform/db/schema/index.ts`
- use feature repositories for business reads and writes
- keep multi-table writes transactional
- run `npm run db:generate` after schema changes
- run `npm run db:check` and `npm run check` before handoff for schema changes
- treat schema changes as local-data-resetting until a durable migration strategy says otherwise

## Query Invalidation

Query keys live in `src/platform/query/query-keys.ts`. Invalidation tag mapping lives in `src/platform/query/cache-invalidation.ts`.

After a write, invalidate the narrowest useful query families. Cross-surface writes often need app-shell invalidation so popup, dashboard, and overlay projections refresh together.

## UI Architecture

Dashboard screens should use existing dashboard layout primitives and feature screens. Popup stays compact and action-oriented. Overlay stays non-disruptive on LeetCode pages.

Rules:

- keep route files thin
- keep feature UI inside the owning feature
- prefer hooks and pure domain mappers before adding architecture layers
- do not introduce global stores for DB-owned state
- use `useReducer` for real state machines such as overlay session state
- keep shared primitives in `src/components/ui`

## Common Change Recipes

### Add A Runtime Method

1. Add request/response schemas in the owning feature `api/*-contracts.ts`.
2. Add a sender or hook in the owning feature API file.
3. Add the protocol method to `src/extension/messaging.ts`.
4. Add sender authorization in `src/extension/background/runtime-policy.ts`.
5. Register the handler in `src/extension/background/register-handlers.ts`.
6. Implement business logic in the owning feature `server`.
7. Add repository methods in the owning feature `data` if database access is needed.
8. Add or update cache invalidation tags.
9. Test contracts, runtime policy, handler registration, service behavior, and API hook behavior.

### Add A Database Table Or Column

1. Edit or create schema files under `src/platform/db/schema`.
2. Export the schema from `src/platform/db/schema/index.ts`.
3. Update seed data when needed.
4. Add repository tests first.
5. Run `npm run db:generate`.
6. Inspect the generated migration.
7. Run `npm run db:check`.
8. Run focused repository tests.
9. Run `npm run check` before handoff.

### Add Or Modify A Dashboard Route

1. Update `src/app/dashboard/navigation/route-manifest.ts`.
2. Update `src/app/dashboard/navigation/routes.tsx`.
3. Add or modify the screen under `src/app/dashboard/screens`.
4. Keep route screens thin and render feature-owned screens where possible.
5. Update `src/app/dashboard/routes.test.tsx`.

### Add A Feature Mutation

1. Define the user intent as a feature-owned command.
2. Validate input with Zod at the runtime boundary.
3. Authorize the sender.
4. Write through the owning repository or service.
5. Flush snapshot through existing mutation handling.
6. Broadcast invalidation tags.
7. Test the repository, service, handler, invalidation, and UI behavior touched by the mutation.

### Change Popup Behavior

1. Start from `src/features/app-shell` read models and popup controller behavior.
2. Update popup components in `src/app/popup` only when the surface presentation changes.
3. Keep the popup compact and avoid dashboard-style flows.
4. Test controller behavior and popup rendering.

### Change Overlay Behavior

1. Start from `src/features/overlay-session`.
2. Keep domain reducers and state transitions pure.
3. Keep content-script capture concerns in `src/features/leetcode-capture` or `src/lib/leetcode`.
4. Keep overlay UI recoverable in collapsed, expanded, and docked modes.
5. Test reducers, hooks, and visible overlay behavior.

## Validation By Change Type

- Docs only: `npx prettier --check <changed-docs>`
- Contracts only: focused contract tests plus `npm run typecheck`
- Runtime handler changes: handler tests, runtime-policy tests, API tests, and `npm run typecheck`
- Database changes: repository tests, `npm run db:check`, and `npm run check`
- UI changes: focused component tests, route tests if routes changed, and screenshots/manual smoke testing when visible behavior changed
- Broad changes: `npm run check` and `npm run format`
````

- [ ] **Step 2: Validate architecture doc formatting**

Run:

```bash
npx prettier --check docs/architecture.md
```

Expected: `All matched files use Prettier code style!`

- [ ] **Step 3: Check for old-repo path drift**

Run:

```bash
rg -n "src/libs|swApi|design-system|MUI|Emotion|esbuild|dist|docs/features|docs/decisions|change-recipes|product-testing" docs/architecture.md
```

Expected: no matches. If a match appears, either remove it or confirm it is explicitly described as old-repo content that should not be used.

## Task 4: Friend-Facing Testing Guide

**Files:**

- Create: `docs/testing.md`

- [ ] **Step 1: Create the testing doc with this structure**

Write `docs/testing.md` using these sections and content.

````markdown
# Testing

## Purpose

This guide is for friends and contributors testing CogniPace locally. It covers loading the extension, trying the main workflows, resetting local data, reporting useful bugs, and choosing validation commands.

## Local Setup

Install dependencies:

```sh
npm install
```

Start WXT for local development:

```sh
npm run dev
```

Build a Chrome MV3 extension:

```sh
npm run build
```

## Load The Extension In Chrome

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Choose Load unpacked.
4. Select `.output/chrome-mv3`.
5. After rebuilding, click the reload button for the extension in `chrome://extensions`.

## Smoke Flows

### Popup

1. Click the CogniPace extension icon.
2. Confirm the popup shows the brand header, metric tiles, a recommendation area, and study-mode or track guidance.
3. Use the shuffle action when available.
4. Open Settings from the popup.
5. Open Tracks from the track card when available.

Expected: the popup stays compact, does not jump around during feedback, and keeps recommendation guidance separate from track guidance.

### Dashboard Settings

1. Open the dashboard.
2. Navigate to Settings.
3. Change a setting.
4. Confirm the save bar appears.
5. Save the change.
6. Reload the dashboard and confirm the setting persisted.

Expected: settings changes save through the extension runtime and persist locally.

### Library

1. Open the dashboard.
2. Navigate to Library.
3. Inspect problem rows.
4. Create or edit a problem.
5. Open problem details or practice actions when available.

Expected: Library reflects persisted problem metadata and does not require a backend or account.

### Tracks

1. Open the dashboard.
2. Navigate to Tracks.
3. Inspect the active track workspace.
4. Create or edit a track.
5. Set a track active.
6. Change the active group when more than one group exists.
7. Reset track progress only when intentionally testing reset behavior.

Expected: active track state, group state, problem order, and track progress are local and update the dashboard without touching global practice history unless a review is saved.

### LeetCode Overlay

1. Open a LeetCode problem page in Chrome.
2. Confirm the CogniPace overlay appears after page context is read.
3. Start, pause, and reset the timer.
4. Expand the overlay.
5. Select a rating or use fail.
6. Submit or update a review.
7. Dock and restore the overlay.

Expected: the overlay remains recoverable, does not dominate the LeetCode page, and saved review results update CogniPace state.

### Cross-Surface Refresh

1. Save a review from the overlay.
2. Open the popup.
3. Open the dashboard.

Expected: due counts, recommendation state, practice details, and track progress refresh through query invalidation.

## Current Incomplete Surfaces

- Overview is a reserved dashboard route for a future guided-practice home.
- Analytics is a reserved dashboard route for future scheduling and reporting work.
- Backup/reset workflows are future work.

Do not report these as broken unless they stop rendering or navigation fails.

## Reset Local Data

Use this when testing from a clean local state:

1. Open `chrome://extensions`.
2. Find CogniPace.
3. Open Details.
4. Use extension site data controls or remove and reload the unpacked extension.
5. Reload `.output/chrome-mv3`.

Schema and migration changes may reset local extension data during development. Treat local test data as disposable.

## Troubleshooting

### Extension Does Not Load

- Run `npm run build`.
- Confirm `.output/chrome-mv3` exists.
- Reload the unpacked extension in `chrome://extensions`.
- Inspect the extension service worker console from `chrome://extensions`.

### Popup Or Dashboard Shows Stale Data

- Reload the extension.
- Reload the dashboard tab.
- Check the service worker console for runtime or database errors.

### Overlay Does Not Appear On LeetCode

- Confirm the tab is a LeetCode problem page.
- Reload the LeetCode tab after reloading the extension.
- Check the page console and extension service worker console.

### Database Or Migration Errors

- Run `npm run db:check`.
- Reset local extension data.
- Rebuild and reload the extension.

## Useful Bug Reports

Include:

- surface: popup, dashboard, overlay, or background
- exact steps
- expected behavior
- actual behavior
- screenshots or screen recording when visual behavior matters
- browser console errors
- extension service worker errors
- whether local data was reset before the test

## Validation Commands

Docs-only changes:

```sh
npx prettier --check README.md CONTRIBUTING.md AGENTS.md design.md docs/**/*.md
```

Focused tests:

```sh
npm run test -- <path-to-test-file>
```

Full verification:

```sh
npm run check
npm run format
```
````

- [ ] **Step 2: Validate testing doc formatting**

Run:

```bash
npx prettier --check docs/testing.md
```

Expected: `All matched files use Prettier code style!`

- [ ] **Step 3: Check testing doc for unsupported claims**

Run:

```bash
rg -n "account|backend|cloud|sync|mobile|Overview|Analytics|Backup|reset|\\.output/chrome-mv3" docs/testing.md
```

Expected:

- no account/backend/cloud/sync instructions
- Overview and Analytics are listed as incomplete
- `.output/chrome-mv3` is the load path

## Task 5: Superpowers Docs Index

**Files:**

- Create: `docs/superpowers/README.md`

- [ ] **Step 1: Create the Superpowers index**

Write `docs/superpowers/README.md` with this content:

```markdown
# Superpowers Planning Artifacts

This folder contains planning artifacts created through Superpowers workflows. These files are useful history, but they are not the first source of truth for current product behavior or architecture.

## Current Authority

- Current product behavior and scope: [`docs/product.md`](../product.md)
- Current architecture and change recipes: [`docs/architecture.md`](../architecture.md)
- Manual testing and validation: [`docs/testing.md`](../testing.md)
- UI and interaction direction: [`design.md`](../../design.md)
- Agent operating rules: [`AGENTS.md`](../../AGENTS.md)

## Specs

- [`specs/2026-05-24-docs-architecture-design.md`](./specs/2026-05-24-docs-architecture-design.md): approved design for the compact docs architecture. Current for this docs pass.
- [`specs/2026-05-24-tracks-phase-3-design.md`](./specs/2026-05-24-tracks-phase-3-design.md): Tracks phase 3 design artifact. Use as implementation history; verify current behavior against `docs/product.md` and source code.

## Plans

- [`plans/2026-05-24-docs-architecture.md`](./plans/2026-05-24-docs-architecture.md): implementation plan for this docs pass. Current while the docs pass is in progress.
- [`plans/2026-05-24-tracks-phase-3.md`](./plans/2026-05-24-tracks-phase-3.md): Tracks phase 3 implementation plan. Historical once the feature has landed.
- [`plans/2026-05-23-problems-mvp.md`](./plans/2026-05-23-problems-mvp.md): Problems MVP implementation plan. Historical once the feature has landed.

## Reading Guidance

Use these files to understand why work was shaped a certain way. Before changing product behavior, architecture, or tests, check the current docs and source code first.
```

- [ ] **Step 2: Validate Superpowers index links**

Run:

```bash
rg -n "\\]\\(" docs/superpowers/README.md
test -f docs/product.md
test -f docs/architecture.md
test -f docs/testing.md
test -f docs/superpowers/specs/2026-05-24-docs-architecture-design.md
test -f docs/superpowers/specs/2026-05-24-tracks-phase-3-design.md
test -f docs/superpowers/plans/2026-05-24-docs-architecture.md
test -f docs/superpowers/plans/2026-05-24-tracks-phase-3.md
test -f docs/superpowers/plans/2026-05-23-problems-mvp.md
```

Expected: `rg` prints the markdown links, and every `test -f` command exits successfully.

- [ ] **Step 3: Validate formatting**

Run:

```bash
npx prettier --check docs/superpowers/README.md
```

Expected: `All matched files use Prettier code style!`

## Task 6: Contributing Guide Update

**Files:**

- Modify: `CONTRIBUTING.md`

- [ ] **Step 1: Update the opening reading list**

Ensure the opening guidance points contributors to:

```markdown
- Start from `README.md`.
- Read `docs/product.md` before product or behavior changes.
- Read `docs/architecture.md` before runtime, database, routing, feature-boundary, or state-flow changes.
- Read `docs/testing.md` before manual validation or friend-facing QA.
- Read `design.md` before visible UI changes.
- Agents must also follow `AGENTS.md`.
```

- [ ] **Step 2: Keep existing architecture and ownership rules**

Preserve these existing contributor rules:

- dependency direction
- feature folder shape
- ownership map
- runtime messaging rules
- database and Drizzle rules
- testing guidance
- review checklist

- [ ] **Step 3: Add compact common-change checklist section**

Add this section near workflow or architecture guidance:

```markdown
## Common Change Checklists

Use `docs/architecture.md` for the full recipes. The short version:

- Runtime method: feature contract, feature API sender/hook, protocol map, runtime policy, handler registration, feature service, repository if needed, invalidation tags, focused tests.
- Database change: schema file, schema export, migration generation, seed update if needed, repository tests, `npm run db:check`.
- Dashboard route or modal: route manifest, route tree, screen file, route tests, feature screen when behavior is feature-owned.
- Feature mutation: Zod input, authorized runtime command, service rule, repository write, snapshot-safe mutation path, invalidation tags, service/handler/UI tests.
- Popup change: app-shell read model or popup controller first, popup components only for presentation, compact surface behavior preserved.
- Overlay change: overlay-session state and hooks first, leetcode-capture or lib/leetcode for page reads, collapsed/expanded/docked recovery preserved.
```

- [ ] **Step 4: Update validation wording**

Keep `npm run check` as the substantial-change default. Add docs-only guidance:

```markdown
For docs-only changes, run Prettier on the changed markdown files. Do not claim runtime validation unless `npm run check` or focused runtime tests were actually run.
```

- [ ] **Step 5: Validate contributing guide formatting**

Run:

```bash
npx prettier --check CONTRIBUTING.md
```

Expected: `All matched files use Prettier code style!`

## Task 7: Agent Guide Update

**Files:**

- Modify: `AGENTS.md`

- [ ] **Step 1: Rewrite AGENTS as a short directive guide**

Keep it concise. Use this structure:

```markdown
# Agent Operating Guide

## Required Reading

Before large changes, read:

1. `README.md`
2. `docs/product.md`
3. `docs/architecture.md`
4. `docs/testing.md`
5. `design.md`
6. `CONTRIBUTING.md`

For historical planning context, check `docs/superpowers/README.md`.

## Authority

- `docs/product.md` owns current product behavior and scope.
- `docs/architecture.md` owns current technical structure and change recipes.
- `design.md` owns current visual and interaction direction.
- `docs/superpowers/*` files are planning artifacts unless a current doc says otherwise.

## Safety Rules

- Do not revert unrelated user work.
- Do not add account, auth, backend, sync, team, or generic SaaS behavior without explicit approval.
- Do not expand Chrome permissions without explicit approval.
- Validate runtime payloads with Zod.
- Keep database writes behind the owning feature repository/service.
- Keep dependency direction: `entrypoints -> app -> features -> platform/lib/components`.
- Prefer existing feature patterns over new architecture layers.
- Keep docs honest about current behavior and validation actually run.

## Change Guidance

- For runtime, database, route, feature mutation, popup, or overlay changes, follow `docs/architecture.md`.
- For product behavior, expected tester flows, and known incomplete surfaces, follow `docs/product.md` and `docs/testing.md`.
- For visible UI, follow `design.md` and existing component patterns.

## Validation

- Docs-only: run Prettier on changed markdown files.
- Feature or runtime code: run focused tests first, then `npm run check` for substantial handoffs.
- Database changes: run repository tests, `npm run db:check`, and `npm run check`.
```

- [ ] **Step 2: Preserve project-specific context7 instruction if present**

If the existing `AGENTS.md` includes the Context7 instruction block from repository guidelines, keep it above or within the guide so library/framework documentation requests still use Context7.

- [ ] **Step 3: Validate agent guide formatting**

Run:

```bash
npx prettier --check AGENTS.md
```

Expected: `All matched files use Prettier code style!`

## Task 8: Cross-Doc Link And Scope Review

**Files:**

- Review: `README.md`
- Review: `docs/product.md`
- Review: `docs/architecture.md`
- Review: `docs/testing.md`
- Review: `docs/superpowers/README.md`
- Review: `CONTRIBUTING.md`
- Review: `AGENTS.md`
- Review: `design.md`

- [ ] **Step 1: Run formatting on all changed docs**

Run:

```bash
npx prettier --check README.md CONTRIBUTING.md AGENTS.md docs/product.md docs/architecture.md docs/testing.md docs/superpowers/README.md docs/superpowers/plans/2026-05-24-docs-architecture.md docs/superpowers/specs/2026-05-24-docs-architecture-design.md
```

Expected: `All matched files use Prettier code style!`

- [ ] **Step 2: Confirm intentionally absent files were not created**

Run:

```bash
test ! -e docs/features.md
test ! -e docs/change-recipes.md
test ! -e docs/product-testing.md
find docs -path 'docs/decisions/*' -print
```

Expected:

- first three commands exit successfully
- `find` prints nothing

- [ ] **Step 3: Check for old implementation drift**

Run:

```bash
rg -n "MUI|Emotion|esbuild|build\\.cjs|src/libs|swApi|design-system|dist folder|docs/features|docs/decisions|docs/change-recipes|docs/product-testing" README.md CONTRIBUTING.md AGENTS.md docs/product.md docs/architecture.md docs/testing.md docs/superpowers/README.md
```

Expected: no matches, unless a line explicitly says the old repo used that term and v2 should not.

- [ ] **Step 4: Check local-first and scope consistency**

Run:

```bash
rg -n "account|auth|backend|sync|cloud|mobile|Overview|Analytics|future|not approved|incomplete" docs/product.md docs/architecture.md docs/testing.md AGENTS.md
```

Expected:

- account/auth/backend/sync/cloud/mobile are non-goals, blocked work, or future candidates only
- Overview and Analytics are marked incomplete where product/testing docs mention them

- [ ] **Step 5: Review final diff**

Run:

```bash
git diff -- README.md CONTRIBUTING.md AGENTS.md docs/product.md docs/architecture.md docs/testing.md docs/superpowers/README.md docs/superpowers/plans/2026-05-24-docs-architecture.md
```

Expected: docs are comprehensive but compact, product behavior is not split into `docs/features.md`, and contributor recipes live inside `docs/architecture.md` plus `CONTRIBUTING.md`.

- [ ] **Step 6: Commit docs implementation**

Only stage docs touched by this plan. Do not stage unrelated code or user work.

Run:

```bash
git status --short
git add README.md CONTRIBUTING.md AGENTS.md docs/product.md docs/architecture.md docs/testing.md docs/superpowers/README.md docs/superpowers/plans/2026-05-24-docs-architecture.md
git commit -m "docs: add project documentation guide"
```

Expected: commit succeeds with only docs files from this plan.
