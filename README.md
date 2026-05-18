# CogniPace

CogniPace is a local-first Chrome MV3 extension for deliberate LeetCode review
and study pacing.

This repository is set up as a WXT + React + TypeScript extension foundation.
The first implementation slice intentionally keeps product behavior light:
popup, dashboard, background, and LeetCode content-script surfaces render and
communicate through typed extension messaging.

## Scripts

```sh
npm run dev
npm run build
npm run check
npm run format
```

- `npm run dev` starts WXT for local extension development.
- `npm run build` builds the Chrome MV3 extension into `.output/chrome-mv3`.
- `npm run check` runs WXT type generation, TypeScript, ESLint, and Vitest.
- `npm run format` checks Prettier formatting.

## Source Structure

```txt
src/
  entrypoints/   # WXT boot files only
  app/           # providers, route shells, surface composition
  components/    # shared UI adapters
  extension/     # typed messaging and runtime handlers
  features/      # product feature modules
  hooks/         # shared React hooks
  lib/           # CogniPace-owned integrations
  platform/      # Chrome, DB, and time adapters
  testing/       # test setup and helpers
  types/         # project-wide type declarations
  utils/         # shared utilities
```

The current foundation keeps `lib/fsrs` and `lib/leetcode` ready for product
logic while deferring SQLite, Drizzle, FSRS scheduling, and final Stitch-driven
design work to later slices.
