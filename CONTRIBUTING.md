# Contributing

This guide is for teammates and agents working on CogniPace. Keep the app
small, local-first, and easy to reason about.

## Working Agreement

- Start from `README.md`, `CONTRIBUTING.md`, `design.md`, and the relevant
  skill files in `.agents/skills`.
- Prefer the current architecture over generic framework advice.
- Keep changes scoped to the feature or layer that owns the behavior.
- Avoid adding ceremony unless it removes real duplication or prevents a real
  class of bugs.
- If a change increases LOC or indirection, explain what complexity it removes.

## Architecture

CogniPace follows a small-app version of Bulletproof React:

```txt
entrypoints -> app -> features -> platform/lib/components
```

- `src/entrypoints` only boots WXT surfaces.
- `src/app` composes surfaces, providers, and dashboard routing.
- `src/features` owns product capabilities.
- `src/components` holds shared UI primitives only.
- `src/lib` holds product-owned integrations such as FSRS and LeetCode parsing.
- `src/platform` wraps browser, database, query, and time infrastructure.
- `src/extension` owns typed runtime messaging and background handlers.
- `src/testing` owns shared test helpers and architecture boundary tests.

Architecture boundaries are enforced in `src/testing/architecture-boundaries.test.ts`
and `eslint.config.js`. Treat those tests as documentation.

## Feature Folder Shape

Use only the folders a feature actually needs:

```txt
src/features/<feature>/
  api/          # runtime contracts, runtime hooks, serializers
  components/   # feature-specific UI
  data/         # Drizzle repositories and row mapping
  domain/       # pure rules, types, reducers, view models
  hooks/        # feature-specific React hooks
  server/       # background-safe use cases
```

Do not add folders preemptively.

## Ownership Map

| Area               | Owns                                                                    | Main files                    |
| ------------------ | ----------------------------------------------------------------------- | ----------------------------- |
| `app-shell`        | surface read models, popup controller/view mapping                      | `features/app-shell/*`        |
| `overlay-session`  | LeetCode overlay state, timer, draft, mode UI, review actions           | `features/overlay-session/*`  |
| `practice`         | FSRS review writes, attempts, cards, practice logs                      | `features/practice/*`         |
| `problems`         | problem identity, normalization, catalog upsert, problem context        | `features/problems/*`         |
| `queue`            | daily queue policy and recommendation composition                       | `features/queue/*`            |
| `tracks`           | active track, active group, track progress                              | `features/tracks/*`           |
| `settings`         | user settings schema, defaults, persistence                             | `features/settings/*`         |
| `assessment`       | solve-time and rating decisions                                         | `features/assessment/*`       |
| `leetcode-capture` | LeetCode page/background capture contracts and services                 | `features/leetcode-capture/*` |
| `platform/db`      | SQLite WASM, Drizzle setup, migrations, snapshot persistence, seed data | `platform/db/*`               |
| `extension`        | runtime protocol, sender authorization, handler registration            | `extension/*`                 |

`app-shell` and `queue` are composition/read surfaces. They should not become
write owners for practice scheduling, settings, or tracks.

## React Patterns

Use modern React patterns, but keep them proportional to the app.

- Prefer custom hooks for reusable stateful logic.
- Prefer controller hooks plus presentational shells for surfaces with real
  workflow state. Example: popup controller feeds popup shell.
- Prefer pure domain mappers for view models before adding container components.
- Prefer explicit `view` and `commands` props for complex feature components.
- Use local `useState` for one-off UI state.
- Use `useReducer` only for state machines with multiple transitions.
- Use TanStack Query for runtime/server state and cache invalidation.

Avoid by default:

- HOCs
- render-prop abstractions
- global client stores
- compound component APIs
- broad context providers
- Storybook or a separate design-system package
- Next.js, Remix, SSR, RSC, Redux, Zustand, tRPC, or GraphQL

Those tools can be added later only when the current app shape proves they are
cheaper than local code.

## Runtime Messaging

UI and content scripts should not call the database directly.

- Add or update protocol types in `src/extension/messaging.ts`.
- Validate message payloads with Zod schemas.
- Authorize senders in `src/extension/background/runtime-policy.ts`.
- Register handlers in `src/extension/background/register-handlers.ts`.
- Call feature `server` services from handlers.
- Serialize `Date` values to ISO strings at API boundaries.
- Broadcast cache invalidation after successful mutations.

Background handlers must parse and authorize before database access.

## Database And Drizzle

Schema lives in `src/platform/db/schema/*` and is exported from
`src/platform/db/schema/index.ts`. `src/platform/db` owns database setup,
migrations, snapshot persistence, and seed data. Feature repositories own
business reads/writes.

Table ownership:

- `problems` and taxonomy joins: `features/problems`
- `problem_practice`, `fsrs_cards`, `review_attempts`: `features/practice`
- `settings_kv`: `features/settings`
- `tracks`, `track_groups`, `track_group_problems`, `track_session`:
  `features/tracks`

Migration workflow:

```sh
npm run db:generate
npm run db:check
npm run check
```

Current persistence is snapshot-based. Migration SQL is fingerprinted; if the
fingerprint changes, the stored extension snapshot can be cleared and rebuilt
from migrations plus seed data. Treat schema changes as local-data-resetting
until a durable migration strategy is introduced.

Write rules:

- Keep multi-table writes transactional.
- Keep review scheduling writes behind `features/practice/data`.
- Use Drizzle through the app `Db` proxy so mutation hooks can persist snapshots.
- Keep raw SQLite calls inside platform setup, tests, or migration plumbing.

## Testing

Use Vitest and React Testing Library. Keep tests behavior-focused and local to
the code they protect.

- Unit test pure domain logic, reducers, serializers, parsing, scheduling, and
  validation.
- Component test visible behavior and accessibility semantics with Testing
  Library queries.
- Hook test returned state, actions, async transitions, and runtime calls.
- Integration test DB migrations, repositories, runtime handlers, and workflows
  crossing feature boundaries.
- Use `satisfies` for fixtures when validating app contracts.
- Avoid snapshots and CSS assertions unless they protect a meaningful contract.
- Prefer one high-signal integration test over duplicated low-signal unit tests.

Run before handing work off:

```sh
npm run check
npm run format
```

If an existing branch is already failing, state the exact failing command and
test instead of hiding it.

## Skill-Driven Agent Workflow

Agents should work from explicit skills and specs, not vibes.

Use these skills as lenses:

- `bulletproof-react-auditor`: structure, ownership, boundaries
- `react-2026`: stack fit and modern React defaults
- `react-composition-2026`: component API shape and prop complexity
- `hooks-pattern`: reusable stateful logic
- `presentational-container-pattern`: view/workflow separation
- `hoc-pattern` and `render-props-pattern`: mostly to avoid them unless needed
- `typescript-core`: strict typing, runtime validation, `satisfies`
- `drizzle-orm`: schema, repository, transaction, query safety
- `vitest`: test scope, mocks, async behavior, Testing Library usage

Recommended agent flow:

1. State the spec or product behavior being changed.
2. Ask one or more agents to inspect separate ownership areas.
3. Give each agent a read-only or disjoint write scope.
4. Merge findings into a small implementation plan.
5. Edit the minimum files needed.
6. Run `npm run check` and `npm run format`.
7. Summarize what changed, what owns it, and any remaining risk.

Agent safety rules:

- Do not let two agents edit the same file set.
- Do not revert changes you did not make.
- Do not add architecture layers only because a skill mentions them.
- Prefer deleting stale ceremony over adding new wrappers.
- Keep generated docs honest about current behavior and failing checks.

## Review Checklist

- Does the change respect feature ownership?
- Are runtime payloads validated at the boundary?
- Are database writes owned by the right repository?
- Are multi-table writes transactional?
- Is UI state local unless it truly crosses components or surfaces?
- Did tests cover behavior rather than implementation details?
- Did the change avoid new ceremony for a small app?
- Did `npm run check` and `npm run format` pass, or are failures documented?
