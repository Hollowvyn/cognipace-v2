# Repository Guidelines

## Project Structure & Module Organization

CogniPace is a local-first Chrome MV3 extension built with WXT, React, and TypeScript. Source lives in `src/`.

- `src/entrypoints`: WXT popup, dashboard, background, and content-script boot files.
- `src/app`: surface composition, providers, dashboard routes, popup, and overlay shells.
- `src/features`: product-owned modules such as `practice`, `tracks`, `settings`, `queue`, and `problems`.
- `src/platform`: browser, database, query, and time infrastructure.
- `src/lib`: product integrations such as FSRS, LeetCode readers, and problem catalog code.
- `src/components/ui`: shared UI primitives only.
- `src/testing`: shared fixtures, setup, helpers, and boundary tests.

Keep dependency direction simple: `entrypoints -> app -> features -> platform/lib/components`.

## Build, Test, and Development Commands

- `npm run dev`: start WXT for local Chrome extension development.
- `npm run build`: build the Chrome MV3 extension.
- `npm run typecheck`: prepare WXT types and run `tsc --noEmit`.
- `npm run lint`: run ESLint.
- `npm run test`: run Vitest once.
- `npm run check`: run Drizzle checks, typecheck, lint, and tests.
- `npm run format` / `npm run format:write`: check or apply Prettier.
- `npm run db:generate` and `npm run db:check`: manage Drizzle migrations.

## Coding Style & Naming Conventions

Use TypeScript modules with strict compiler settings and the `@/*` path alias. Follow existing file naming: kebab-case files such as `review-scheduler.ts`, React components in `.tsx`, and colocated tests as `*.test.ts` or `*.test.tsx`. Prefer feature-local folders only when needed. Avoid `any`; ESLint rejects unsafe TypeScript patterns. Let Prettier own formatting.

## Testing Guidelines

Tests use Vitest, jsdom, React Testing Library, and `src/testing/setup-tests.ts`. Keep tests behavior-focused. Unit test pure domain logic, serializers, parsers, and reducers. Integration test repositories, migrations, runtime handlers, and cross-feature workflows. Run `npm run check` before substantial handoffs.

## Commit & Pull Request Guidelines

Recent history uses concise conventional-style subjects such as `feat: build tracks workspace screen` and `chore: polish tracks integration`. Keep commits scoped and imperative. Pull requests should describe behavior changes, list validation commands, link related issues or specs, and include screenshots for visible popup, dashboard, or overlay UI changes.

## Agent-Specific Instructions

Read `README.md`, `CONTRIBUTING.md`, and `design.md` before large changes. Do not revert unrelated user work. Respect feature ownership, validate runtime payloads with Zod, keep database writes behind the owning feature repository, and avoid new architecture layers unless they remove proven complexity.
