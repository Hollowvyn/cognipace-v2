# Architecture

## System Shape

CogniPace v2 is a local-first WXT Chrome MV3 extension. It has four runtime
surfaces:

- Popup: compact command surface for review-now and study-next guidance.
- Dashboard: larger inspection and management surface for Library, Tracks,
  Settings, Overview, and Analytics routes.
- LeetCode content-script overlay: in-page practice session UI and LeetCode page
  capture bridge.
- Background service worker: trusted runtime boundary for database access,
  sender authorization, service calls, snapshot persistence, and cache
  invalidation.

The intended dependency direction is:

```text
entrypoints -> app -> features -> platform/lib/components
```

Entrypoints boot surfaces. The app layer composes screens, routing, providers,
and surface shells. Features own product behavior. Platform and lib modules own
shared infrastructure and product integrations. Shared UI components stay
generic.

## Source Layout

- `src/entrypoints`: WXT boot files for `background.ts`,
  `leetcode.content.tsx`, `popup`, and `dashboard`.
- `src/app`: surface composition, dashboard routing, popup shell, overlay app,
  providers, and app-level styles.
- `src/components`: shared UI primitives only, currently under
  `src/components/ui`.
- `src/extension`: extension runtime messaging plus background service-worker
  policy and handler registration.
- `src/features`: product-owned feature modules.
- `src/hooks`: shared React hooks that are not owned by one feature.
- `src/lib`: product integrations such as FSRS and LeetCode readers.
- `src/platform`: browser, database, query, and time infrastructure.
- `src/styles`: shared styling support.
- `src/testing`: shared fixtures, setup, helpers, and boundary tests.
- `src/types`: shared TypeScript types.
- `src/utils`: small generic utilities.

Keep new code inside the owning feature or infrastructure folder. Avoid adding a
new cross-cutting layer unless it removes proven duplication.

## Runtime Surfaces

### Entrypoints

Entrypoints in `src/entrypoints` are thin boot files:

- `src/entrypoints/background.ts` registers background handlers.
- `src/entrypoints/popup/main.tsx` mounts the popup React app.
- `src/entrypoints/dashboard/main.tsx` mounts the dashboard React app.
- `src/entrypoints/leetcode.content.tsx` mounts the LeetCode overlay content
  script.

Entrypoints should not own product logic. They connect WXT to the app layer.

### App Layer

The app layer owns surface composition:

- `src/app/providers`: Query Client, cache invalidation listener, and shared
  React providers.
- `src/app/popup`: popup app shell and popup-specific components.
- `src/app/dashboard`: TanStack Router routes, navigation, route modals, and
  dashboard pages.
- `src/app/overlay`: LeetCode overlay app composition.

App code may coordinate features, but domain rules and persistence belong in the
owning feature or platform module.

### Features

Features own product capabilities. A typical feature folder can contain:

- `api`: runtime contracts, serializers, and surface-facing API hooks.
- `components`: feature-owned React components.
- `data`: repositories and persistence adapters for that feature.
- `domain`: pure domain models, rules, reducers, and calculations.
- `hooks`: feature-owned React hooks.
- `server`: background-service-worker service functions.

Not every feature needs every folder. Add only the folder needed for the change.

## Feature Ownership

- `app-shell`: popup, dashboard, and overlay shell data composition.
- `overlay-session`: LeetCode overlay UI state, timer, draft fields, page sync,
  submission automation, and review action orchestration.
- `practice`: FSRS-backed practice state, review logs, scheduling details,
  suspension, resets, and current log updates.
- `problems`: problem identity, catalog rows, Library behavior, edit data,
  companies, topics, difficulty, premium status, and page upserts.
- `queue`: review recommendation composition for today.
- `tracks`: curriculum tracks, groups, ordered memberships, active track and
  group state, progress, and dashboard track management.
- `settings`: persisted preferences, defaults, validation, and settings form
  behavior.
- `assessment`: assessment domain rules.
- `leetcode-capture`: LeetCode metadata, content, and submission result reads
  through the content-script/background bridge.

When behavior crosses features, keep writes behind the owning feature's server
service or repository and return serialized data through the runtime boundary.

## Runtime Messaging

Runtime messaging is the extension boundary between UI surfaces and trusted
background work.

- Feature API contracts live in `src/features/*/api/*-contracts.ts`.
- Shared protocol types and message helpers live in `src/extension/messaging.ts`.
- Sender and method authorization lives in
  `src/extension/background/runtime-policy.ts`.
- Background handler registration lives in
  `src/extension/background/register-handlers.ts`.
- Feature service functions live in `src/features/*/server`.
- Feature repositories and persistence adapters live in `src/features/*/data`.

The normal request path is:

```text
UI hook or surface action
-> feature API method / sendMessage
-> src/extension/messaging.ts protocol method
-> registerBackgroundHandlers()
-> Zod request parse
-> sender authorization in runtime-policy.ts
-> feature server service
-> feature data repository if persistence is needed
-> Zod response parse or serializer
-> UI cache update through TanStack Query
```

### Runtime Boundary Rules

- Validate every request and response that crosses the extension boundary with
  Zod schemas from feature API contracts or `src/extension/messaging.ts`.
- Add every callable method to `src/extension/messaging.ts` and authorize its
  allowed surfaces in `src/extension/background/runtime-policy.ts`.
- Do not trust claimed `surface` values until
  `assertCanSenderCallExtensionMethod` has compared the request to the actual
  Chrome sender.
- Serialize `Date` values as ISO strings in runtime contracts. Convert them back
  to `Date` objects inside background services or domain code.
- After database writes, flush the database snapshot before broadcasting cache
  invalidation.
- Broadcast invalidation tags for every query family affected by a write.

## State And Data Flow

SQLite is the source of truth. TanStack Query is the UI server-state cache.
Local component state is for draft fields, filters, open dialogs, and transient
surface state.

The mutation flow is:

```text
user action
-> runtime command
-> DB write
-> snapshot flush
-> invalidation broadcast
-> query refetch
-> render
```

Background mutations are serialized through the mutation queue in
`src/extension/background/register-handlers.ts`. The app DB comes from
`src/platform/db/instance.ts`, which restores a matching stored snapshot or
creates a fresh migrated and seeded database.

## Database And Persistence

Database files live under `src/platform/db`:

- `src/platform/db/schema`: Drizzle schema modules.
- `src/platform/db/migrations`: generated SQL migrations and metadata.
- `src/platform/db/migration-sql.ts`: bundled migration SQL used at runtime.
- `src/platform/db/seed.ts`: initial local catalog seed.
- `src/platform/db/instance.ts`: app DB opening, migration, snapshot restore,
  snapshot scheduling, and snapshot flushing.
- `src/platform/db/snapshot.ts`: Chrome storage snapshot serialization.

Schema change rules:

- Update the owning schema module in `src/platform/db/schema`.
- Generate a migration with `npm run db:generate`.
- Check migrations with `npm run db:check`.
- Update repositories, serializers, feature contracts, and tests that touch the
  changed shape.
- Keep database writes behind the owning feature repository or service.

Local-data reset caveat: changing migrations changes the migration fingerprint.
When a stored snapshot does not match the current migration SQL, the app clears
the old snapshot and creates a fresh migrated database seeded from
`src/platform/db/seed.ts`. Testers may lose local extension data after schema
changes.

## Query Invalidation

Query keys live in `src/platform/query/query-keys.ts`. Invalidation tag mapping
lives in `src/platform/query/cache-invalidation.ts`.

Background writes broadcast events with tags such as `practice`, `problems`,
`queue`, `settings`, `tracks`, and `app-shell`. The listener in
`src/app/providers/cache-invalidation-listener.tsx` parses the event and
invalidates the mapped query keys.

When adding or changing data dependencies:

- Add or reuse a query key in `src/platform/query/query-keys.ts`.
- Add or update tag mapping in `src/platform/query/cache-invalidation.ts`.
- Broadcast the smallest correct set of tags from the background write path.
- Include cross-feature query families when a write changes derived views. For
  example, problem catalog writes can affect Library, practice details, queue,
  track workspace, and shell data.

## UI Architecture Rules

- Keep UI surfaces compact and direct. Popup is not a mini dashboard.
- Dashboard pages own layout and route-level composition; feature components own
  feature-specific interaction and display.
- Route definitions and modal nesting live in
  `src/app/dashboard/navigation/routes.tsx`; route labels and path metadata live
  in `src/app/dashboard/navigation/route-manifest.ts`.
- Feature components should call feature API hooks or receive already-loaded
  data. They should not reach into repositories or database modules.
- Keep draft form state local to the surface or feature hook until the user
  saves.
- Put shared primitives in `src/components/ui` only when they are product-agnostic
  and reusable by multiple surfaces.
- Use the tokens and interaction direction in `design.md` for visible UI work.
- Validate empty, loading, error, and disabled states for popup, dashboard, and
  overlay changes.

## Common Change Recipes

### Add Runtime Method

1. Add request and response schemas in the owning feature's
   `src/features/<feature>/api/*-contracts.ts`.
2. Add serializers in `src/features/<feature>/api` if the response contains
   dates, domain objects, or database rows.
3. Add the method to `ProtocolMap` in `src/extension/messaging.ts`.
4. Add allowed surfaces to `methodSurfaceAccess` in
   `src/extension/background/runtime-policy.ts`.
5. Register the handler in `src/extension/background/register-handlers.ts`.
6. Parse the request with Zod, authorize the sender, call the owning feature
   service, and parse or serialize the response.
7. If the method writes data, run it through the DB mutation flow, flush the
   snapshot, and broadcast invalidation tags.
8. Add focused tests for contracts, authorization, handler behavior, and the
   calling API hook as appropriate.

### Add Database Table Or Column

1. Update the relevant Drizzle schema module in `src/platform/db/schema`.
2. Export it through `src/platform/db/schema/index.ts` if needed.
3. Run `npm run db:generate` and review the generated migration under
   `src/platform/db/migrations`.
4. Run `npm run db:check`.
5. Update feature repositories in `src/features/<feature>/data`.
6. Update feature domain models, API contracts, serializers, and services.
7. Update seed data in `src/platform/db/seed.ts` if fresh installs need default
   rows.
8. Add or update repository and integration tests.
9. Tell testers whether local extension data may reset because of the migration
   fingerprint change.

### Add Or Modify Dashboard Route

1. Add or update the page in `src/app/dashboard/screens`.
2. Update route metadata in `src/app/dashboard/navigation/route-manifest.ts`.
3. Update route definitions and modal nesting in
   `src/app/dashboard/navigation/routes.tsx`.
4. Put route-level layout in `src/app/dashboard/layout` when it is dashboard
   structure, not feature behavior.
5. Put reusable feature UI in `src/features/<feature>/components`.
6. Read and mutate data through feature API hooks.
7. Add route tests in `src/app/dashboard/routes.test.tsx` and feature component
   tests for meaningful behavior.

### Add Feature Mutation

1. Define the user-facing behavior in the owning feature.
2. Add or update the feature API contract and client API hook.
3. Implement domain validation or state transitions in
   `src/features/<feature>/domain`.
4. Implement persistence in `src/features/<feature>/data` if the mutation writes
   local data.
5. Implement the background service in `src/features/<feature>/server`.
6. Register the runtime method and allowed surfaces.
7. Serialize dates and response objects at the runtime boundary.
8. Broadcast invalidation tags for every affected query family.
9. Test the domain rule, repository or service write, runtime handler, and UI
   caller.

### Change Popup Behavior

1. Start in `src/app/popup/popup-app.tsx`,
   `src/app/popup/popup-shell.tsx`, and popup components under
   `src/app/popup/components`.
2. If the change alters shell data, update `src/features/app-shell`.
3. If the change alters queue recommendations, update `src/features/queue`.
4. If the change alters study-mode or track guidance, update
   `src/features/settings` or `src/features/tracks`.
5. Keep popup state compact and avoid moving dashboard workflows into popup.
6. Update popup tests and any affected feature tests.

### Change Overlay Behavior

1. Start in `src/app/overlay/overlay-app.tsx` for composition changes.
2. Use `src/features/overlay-session` for overlay UI state, timer, drafts, page
   sync, submission automation, and review actions.
3. Use `src/features/leetcode-capture` for page metadata, content, and
   submission result reads.
4. Use `src/features/practice` for saved review results and practice details.
5. Use `src/features/problems` for problem upserts from page data.
6. Preserve content-script-only access for LeetCode read methods in
   `runtime-policy.ts`.
7. Test collapsed, expanded, docked, timer, draft, save, and page-sync behavior
   when the change touches those flows.

## Validation By Change Type

- Docs-only change: run `npx prettier --check <changed-docs>`.
- Runtime messaging change: run focused contract, runtime policy, handler, and
  feature API tests.
- Database change: run `npm run db:generate` when creating migrations,
  `npm run db:check`, focused repository tests, and affected feature tests.
- Domain change: run focused domain tests and any service tests that exercise
  the domain rule.
- Dashboard UI change: run affected component/route tests and manually inspect
  the dashboard route.
- Popup change: run popup tests and manually inspect the popup in the extension.
- Overlay change: run overlay-session and LeetCode capture tests, then manually
  inspect a LeetCode problem page.
- Broad feature change: run targeted tests first, then `npm run check` before
  handoff.
