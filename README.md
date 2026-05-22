# CogniPace

CogniPace is a local-first Chrome MV3 extension for deliberate LeetCode review
and study pacing. It keeps two loops visible while a user studies:

- what to review now, using FSRS-backed spaced repetition
- what to study next, using the active curated track

This repository is the v2 rebuild of the original `../CogniPace` extension. The
product intent is the same: popup guidance, an in-page LeetCode overlay, a
dashboard, local-first data, no account system, and no backend service. The
difference is architectural: this codebase rebuilds the app around WXT,
feature-owned modules, typed runtime messaging, Drizzle-backed local
persistence, and enforceable boundaries.

CogniPace is intentionally a compact extension, not a SaaS app or a general
React platform. The app runs as WXT entrypoints for the popup, dashboard,
background service worker, and LeetCode content script.

## Product Surfaces

- Popup: immediate review-now and next-track guidance.
- LeetCode overlay: timing, notes, submission capture, and review logging while
  solving on LeetCode.
- Dashboard: broader inspection and configuration for tracks, library,
  analytics, settings, and future backup/reset workflows.
- Background service worker: local database access, runtime authorization,
  feature services, and cache invalidation.

## Stack

- WXT + Chrome MV3 for extension packaging
- React 19 + TypeScript for UI
- TanStack Query for runtime/server state in extension surfaces
- TanStack Router for the dashboard hash routes
- Zod for runtime message and payload validation
- SQLite WASM + Drizzle for local persistence
- Vitest + React Testing Library for tests
- Tailwind CSS tokens and small shared UI primitives for styling

## Getting Started

```sh
npm install
npm run dev
```

`npm run dev` starts WXT for local extension development. Load the generated
extension from `.output/chrome-mv3` when testing in Chrome.

For a production-style local build:

```sh
npm run check
npm run build
```

Then open `chrome://extensions`, enable Developer mode, choose **Load
unpacked**, and select `.output/chrome-mv3`.

## Scripts

```sh
npm run dev
npm run build
npm run check
npm run format
npm run db:generate
npm run db:check
```

- `npm run dev` starts WXT locally.
- `npm run build` builds the Chrome MV3 extension.
- `npm run check` runs Drizzle checks, WXT type generation, TypeScript, ESLint,
  and Vitest.
- `npm run format` checks Prettier formatting.
- `npm run db:generate` generates Drizzle migrations after schema changes.
- `npm run db:check` validates Drizzle schema/migration state.

## Source Structure

```txt
src/
  entrypoints/   # WXT boot files only
  app/           # providers, route shells, surface composition
  components/    # shared UI primitives only
  extension/     # typed messaging, runtime policy, background handlers
  features/      # product feature modules
  hooks/         # shared React hooks
  lib/           # CogniPace-owned integrations
  platform/      # Chrome, DB, query, and time adapters
  styles/        # global tokens and surface styles
  testing/       # test setup, architecture tests, helpers
  types/         # project-wide type declarations
  utils/         # shared utilities
```

Dependency direction is deliberately simple:

```txt
entrypoints -> app -> features -> platform/lib/components
```

Shared infrastructure must not import app or feature code. Feature modules own
their domain and may expose narrow public surfaces. Background runtime handlers
may call server/data surfaces; UI and content scripts communicate through typed
runtime messages.

## Feature Ownership

- `app-shell`: popup, dashboard, and overlay read models plus popup controller
  view mapping.
- `overlay-session`: LeetCode overlay state, timer, draft, reducer, review
  actions, and mode components.
- `practice`: FSRS review state, review attempts, scheduling, and practice-log
  writes.
- `problems`: LeetCode problem identity, normalization, catalog upserts, and
  problem context.
- `queue`: daily recommendation queue composition.
- `tracks`: active track, group progress, and next track problem.
- `settings`: persisted user settings and settings patch validation.
- `assessment`: solve-time and rating decision rules.
- `leetcode-capture`: LeetCode page/background metadata, content, and
  submission capture.

`src/lib/fsrs` and `src/lib/leetcode` are product-owned integration libraries,
not React feature modules. `src/platform/db` owns database construction,
migrations, local snapshot persistence, and seed data.

## Architecture Notes

- React logic should favor custom hooks and controller/shell splits.
- Presentational components should receive explicit `view` and `commands`
  props when the state shape is non-trivial.
- Use `useReducer` for real state machines, such as overlay review state.
- Avoid HOCs, render-prop abstractions, global stores, and compound component
  APIs unless repeated usage proves they reduce code.
- Runtime boundaries use Zod schemas. TypeScript types alone are not enough for
  extension messages or stored data.
- Multi-table review writes belong in `features/practice/data` transactions.
- This repo should borrow product behavior from the original app, not its older
  architecture or tooling.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full architecture and
agent-assisted development workflow.
