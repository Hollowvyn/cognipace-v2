# CogniPace

CogniPace is a local-first Chrome MV3 extension for deliberate LeetCode review
and study pacing. It keeps two loops visible while a user studies:

- what to review now, using FSRS-backed spaced repetition
- what to study next, using the active curated track

CogniPace v2 is a rebuild of the original CogniPace extension. In this local
workspace, the old implementation lives at `../CogniPace` for historical
comparison, but this repository is self-contained for development.

CogniPace is intentionally a browser extension, not a SaaS app or a general
React dashboard. The main surfaces are the popup, the LeetCode overlay, the
dashboard, and the background service worker.

## Stack

- WXT + Chrome MV3
- React 19 + TypeScript
- TanStack Query + TanStack Router
- Zod
- SQLite WASM + Drizzle
- Vitest + React Testing Library
- Tailwind CSS tokens

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

## Source Orientation

Source lives in `src/`. WXT entrypoints boot the popup, dashboard, background
service worker, and LeetCode content script. App composition lives under
`src/app`, product-owned modules live under `src/features`, browser and data
infrastructure live under `src/platform`, and product integrations live under
`src/lib`.

Dependency direction is deliberately simple:

```txt
entrypoints -> app -> features -> platform/lib/components
```

## Project Docs

- [Product](./docs/product.md): app purpose, current feature behavior, scope, non-goals, and future candidates.
- [Architecture](./docs/architecture.md): source layout, ownership boundaries, runtime messaging, local data flow, and common change recipes.
- [Testing](./docs/testing.md): local setup, Chrome loading, manual smoke flows, reset guidance, and validation commands.
- [Contributing](./CONTRIBUTING.md): workflow, coding rules, review checklist, and validation expectations.
- [Agent Guide](./AGENTS.md): required reading order and safety rules for AI agents.
- [Design](./design.md): compact extension UI direction, surface-specific UX rules, and visual tokens.
