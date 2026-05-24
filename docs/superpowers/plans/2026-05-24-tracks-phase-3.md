# Tracks Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the Tracks MVP as the active curriculum workspace with track-scoped progress, ordered groups, ordered active-track rows, create/edit composition, and safe track management.

**Architecture:** `features/tracks` owns track contracts, read models, repositories, services, hooks, and UI. `features/problems` exposes reusable problem row primitives and a server helper for Library-shaped rows; Tracks reuses those public seams instead of deep-importing Library internals or becoming a second Library table. `track_session` is the only active-track source; track progress is stored in a dedicated ledger table and never inferred from global FSRS history.

**Tech Stack:** React 19, TypeScript, TanStack Router, TanStack Query v5, TanStack Table, Zod, Drizzle SQLite, Vitest, Testing Library, WXT extension runtime.

---

## Guidance Applied

- Bulletproof React: keep app route files thin, keep feature code inside feature folders, do not export `data` or `server` from root barrels.
- Hooks pattern: use React Query hooks and small local hooks such as `useTrackForm`; avoid class components and avoid effect-driven derived state.
- HOC and render-props guidance: do not introduce HOCs or render-prop layers for this feature; use hooks and children/slots where composition helps.
- Compound pattern and composition guidance: use compound-style state only if the group tabs or accordion need shared implicit state. Prefer simple local state for one-off controls.
- Presentational/container guidance: keep data fetching in hooks/screen orchestration and keep row/list/form components prop-driven where it improves testability.
- React data fetching and TanStack Query docs: one workspace query for the page read model, `useMutation` with `onSuccess` invalidation, and centralized query keys.
- Vercel React guidance: avoid request waterfalls by returning the workspace read model in one runtime call, derive values during render, avoid unnecessary memoization, and do not define components inside components.
- Drizzle guidance: use typed SQLite schemas, `primaryKey({ columns })`, foreign keys with cascade behavior, and transactions for multi-step writes and position normalization.
- Vitest guidance: write focused repository/service/contract/hook/component tests, use `vi` for module mocks, and run focused tests before the full check.
- Product boundary: do not add `source`, `curated`, `isCurated`, or `isUserCreated` track columns. Seeded, imported, and manually created tracks behave the same.

## Baseline

Current baseline from planning:

```bash
npm run check
```

Expected result at plan time:

```text
db:check passed
typecheck passed
lint passed
56 test files passed
361 tests passed
```

The only untracked planning artifact is `.superpowers/`; do not stage it.

## File Map

### Database

- Modify `src/platform/db/schema/tracks.ts`: remove `isActive` and the active index.
- Create `src/platform/db/schema/track-problem-progress.ts`: track-scoped current completion ledger.
- Modify `src/platform/db/schema/index.ts`: export the new progress schema.
- Modify `src/platform/db/seed.ts`: stop writing `tracks.isActive`; keep `track_session` seeded with the active track.
- Generate migration with `npx drizzle-kit generate --config drizzle.config.ts --name tracks_phase_3`.

### Tracks Feature

- Create `src/features/tracks/api/tracks-contracts.ts`: Zod contracts and serialized response/request types.
- Create `src/features/tracks/api/tracks-serializers.ts`: domain-to-runtime serializers.
- Modify `src/features/tracks/api/tracks-api.ts`: runtime senders and React Query hooks.
- Modify `src/features/tracks/domain/track.ts`: domain read/write models.
- Modify `src/features/tracks/data/tracks-repository.ts`: all Drizzle reads/writes for tracks, groups, memberships, session, and progress.
- Modify `src/features/tracks/server/tracks-service.ts`: orchestration, business rules, settings/practice/problems integration.
- Create `src/features/tracks/components/tracks-screen.tsx`: screen orchestration.
- Create `src/features/tracks/components/active-track-workspace.tsx`: active workspace surface.
- Create `src/features/tracks/components/other-tracks-accordion.tsx`: summary-only inactive tracks.
- Create `src/features/tracks/components/track-problem-table.tsx`: ordered active-group rows with Library row details/actions reuse.
- Create `src/features/tracks/components/track-form.tsx`: route modal form.
- Create `src/features/tracks/components/track-confirmation-dialog.tsx`: local delete/reset confirmation.
- Create `src/features/tracks/hooks/use-track-form.ts`: local form reducer/actions.
- Modify `src/features/tracks/index.ts`: export only public UI/API/domain contracts needed by app code.

### Problems Feature Reuse

- Create `src/features/problems/components/problem-row/problem-row-details.tsx`: reusable details component with action slot.
- Create `src/features/problems/components/problem-row/problem-row-actions.tsx`: reusable practice actions, delete action, and action bar.
- Modify `src/features/problems/components/library/problem-library-row-details.tsx`: wrap the public details/action components for Library.
- Modify `src/features/problems/components/library/problem-row-actions.tsx`: re-export or delegate to the public action components if existing tests import it.
- Modify `src/features/problems/components/library/problem-library-table.tsx`: use the split actions in the Library table.
- Modify `src/features/problems/components/library/problem-library-columns.tsx`: export safe row-link/status primitives if the track table needs them.
- Modify `src/features/problems/index.ts`: export safe public problem primitives.
- Modify `src/features/problems/data/problems-repository.ts`: expose a repository method for Library-shaped rows by slug.
- Modify `src/features/problems/server/problems-service.ts`: expose `getProblemLibraryRowsBySlug` from the allowed server-service seam.
- Modify `src/features/problems/api/problems-serializers.ts`: export row serialization helper if Tracks serializers reuse serialized row shape.

### Runtime, Cache, Routes

- Modify `src/extension/messaging.ts`: import/re-export track schemas and add new protocol methods.
- Modify `src/extension/background/register-handlers.ts`: handlers, mutation wrapping, serialization, invalidation tags.
- Modify `src/extension/background/runtime-policy.ts`: dashboard-only track management methods.
- Modify `src/platform/query/query-keys.ts`: add workspace/edit track keys.
- Modify `src/platform/query/cache-invalidation.ts`: make `tracks` invalidation cover all track query keys and keep `app-shell` dependency.
- Modify `src/app/dashboard/screens/tracks-page.tsx`: mount `TracksScreen` and `<Outlet />`.
- Create `src/app/dashboard/screens/track-modal-pages.tsx`: route-backed create/edit modals.
- Modify `src/app/dashboard/navigation/routes.tsx`: point track routes at real modal pages.
- Modify `src/app/dashboard/navigation/route-manifest.ts`: mark track modals as real `modal`.

### Tests And Fixtures

- Create `src/features/tracks/api/tracks-contracts.test.ts`.
- Create or expand `src/features/tracks/api/tracks-api.test.tsx`.
- Expand `src/features/tracks/data/tracks-repository.test.ts`.
- Expand `src/features/tracks/server/tracks-service.test.ts`.
- Create `src/features/tracks/components/tracks-screen.test.tsx`.
- Create `src/features/tracks/components/track-form.test.tsx`.
- Create `src/testing/track-fixtures.ts`.
- Expand `src/extension/background/register-handlers.test.ts`.
- Expand `src/extension/background/runtime-policy.test.ts`.
- Expand `src/platform/query/cache-invalidation.test.ts`.
- Expand `src/app/dashboard/routes.test.tsx`.
- Expand `src/testing/architecture-boundaries.test.ts` only if a new architectural rule is required.

## Data Contracts To Use

Use these names consistently across tasks:

```ts
type TrackProgressStatus = 'not-started' | 'complete'

interface TrackProblemMembershipInput {
  problemSlug: string
}

interface TrackGroupInput {
  id?: string
  title: string
  problemSlugs: string[]
}

interface TrackMutationInput {
  title: string
  description: string | null
  dueAt: string | null
  groups: TrackGroupInput[]
}
```

`groups[index]` is the persisted group position. `problemSlugs[index]` is the persisted problem position. The service normalizes both to one-based positions.

## Checkpoint 1: Schema And Baseline Track State

**Files:**
- Create: `src/platform/db/schema/track-problem-progress.ts`
- Modify: `src/platform/db/schema/tracks.ts`
- Modify: `src/platform/db/schema/index.ts`
- Modify: `src/platform/db/seed.ts`
- Modify: `src/features/tracks/domain/track.ts`
- Modify: `src/features/tracks/data/tracks-repository.ts`
- Test: `src/features/tracks/data/tracks-repository.test.ts`
- Test: `src/testing/db-foundation.test.ts`

- [ ] Write failing repository tests for the ledger and active source of truth:
  - `getActiveTrack` returns the `track_session.activeTrackId` track.
  - `getActiveTrack` returns `null` when `track_session.activeTrackId` is `null`.
  - changing `tracks.isActive` is impossible because the schema/domain no longer exposes it.
  - inserting `track_problem_progress` increments completed count without consulting `problem_practice`.
  - deleting a membership cascades its progress row.

Focused command:

```bash
npm run test -- src/features/tracks/data/tracks-repository.test.ts src/testing/db-foundation.test.ts
```

Expected before implementation: fails on missing `trackProblemProgress`, removed `isActive` expectations, or progress still returning `0`.

- [ ] Add `trackProblemProgress` schema:

```ts
import { relations, sql } from 'drizzle-orm'
import {
  check,
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core'

import { trackGroupProblems } from './track-group-problems'

export const trackProblemProgress = sqliteTable(
  'track_problem_progress',
  {
    trackGroupId: text('track_group_id').notNull(),
    problemSlug: text('problem_slug').notNull(),
    completedAt: integer('completed_at').notNull(),
    completedRating: text('completed_rating').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.trackGroupId, table.problemSlug] }),
    foreignKey({
      name: 'track_problem_progress_membership_fk',
      columns: [table.trackGroupId, table.problemSlug],
      foreignColumns: [
        trackGroupProblems.trackGroupId,
        trackGroupProblems.problemSlug,
      ],
    }).onDelete('cascade'),
    check(
      'track_problem_progress_completed_rating_check',
      sql`${table.completedRating} in ('good', 'easy')`,
    ),
    index('track_problem_progress_problem_slug_idx').on(table.problemSlug),
  ],
)

export const trackProblemProgressRelations = relations(
  trackProblemProgress,
  ({ one }) => ({
    membership: one(trackGroupProblems, {
      fields: [
        trackProblemProgress.trackGroupId,
        trackProblemProgress.problemSlug,
      ],
      references: [
        trackGroupProblems.trackGroupId,
        trackGroupProblems.problemSlug,
      ],
    }),
  }),
)
```

If Drizzle SQLite does not emit the composite foreign key from the `foreignKey` builder, keep the schema builder in place and add the composite foreign key in the generated SQL migration manually:

```sql
FOREIGN KEY (`track_group_id`,`problem_slug`)
REFERENCES `track_group_problems`(`track_group_id`,`problem_slug`)
ON UPDATE no action ON DELETE cascade
```

- [ ] Remove `isActive` from `tracks.ts`, `Track`, `activeTrackSchema`, and seed writes. Remove `getFirstActiveTrack` fallback from `TracksRepository`.
- [ ] Generate migration:

```bash
npx drizzle-kit generate --config drizzle.config.ts --name tracks_phase_3
```

Expected generated files:

```text
src/platform/db/migrations/0004_tracks_phase_3.sql
src/platform/db/migrations/meta/0004_snapshot.json
src/platform/db/migrations/meta/_journal.json
```

- [ ] Inspect the migration. It must create `track_problem_progress`, remove `tracks.is_active`, preserve existing seeded track data, and keep `track_session` data. Add the composite foreign key manually if generation omits it.
- [ ] Update repository progress reads to count `track_problem_progress` rows joined through memberships for the target track.
- [ ] Run focused tests and db check:

```bash
npm run test -- src/features/tracks/data/tracks-repository.test.ts src/testing/db-foundation.test.ts
npm run db:check
```

Expected after implementation: focused tests pass and Drizzle check passes.

- [ ] Commit:

```bash
git add src/platform/db/schema src/platform/db/migrations src/platform/db/seed.ts src/features/tracks/domain/track.ts src/features/tracks/data/tracks-repository.ts src/features/tracks/data/tracks-repository.test.ts src/testing/db-foundation.test.ts
git commit -m "feat: add track progress ledger"
```

## Checkpoint 2: Track Contracts, Serializers, And Query Keys

**Files:**
- Create: `src/features/tracks/api/tracks-contracts.ts`
- Create: `src/features/tracks/api/tracks-serializers.ts`
- Modify: `src/features/tracks/api/tracks-api.ts`
- Modify: `src/features/tracks/index.ts`
- Modify: `src/extension/messaging.ts`
- Modify: `src/platform/query/query-keys.ts`
- Create: `src/testing/track-fixtures.ts`
- Test: `src/features/tracks/api/tracks-contracts.test.ts`
- Test: `src/features/tracks/api/tracks-api.test.tsx`

- [ ] Write failing contract tests for:
  - valid active track response without `isActive`
  - invalid progress percent rejected
  - workspace request only accepts dashboard
  - create/update reject zero groups
  - completed rating only accepts `good` and `easy`
  - reset/delete/set-active require dashboard surface and non-empty track id

Focused command:

```bash
npm run test -- src/features/tracks/api/tracks-contracts.test.ts
```

Expected before implementation: fails because contracts do not exist.

- [ ] Create `tracks-contracts.ts` with these exported names:

```ts
export const trackDashboardSurfaceSchema = z.literal('dashboard')
export const activeTrackSurfaceSchema = z.enum(['popup', 'dashboard'])
export const trackIdSchema = z.string().trim().min(1)
export const trackGroupIdSchema = z.string().trim().min(1)
export const trackCompletedRatingSchema = z.enum(['good', 'easy'])
export const serializedTrackProgressSchema = z
  .object({
    completedCount: z.number().int().min(0),
    totalCount: z.number().int().min(0),
    percent: z.number().int().min(0).max(100),
  })
  .superRefine((progress, context) => {
    const expectedPercent =
      progress.totalCount === 0
        ? 0
        : Math.round((progress.completedCount / progress.totalCount) * 100)

    if (progress.completedCount > progress.totalCount) {
      context.addIssue({
        code: 'custom',
        message: 'completedCount cannot exceed totalCount',
        path: ['completedCount'],
      })
    }

    if (progress.percent !== expectedPercent) {
      context.addIssue({
        code: 'custom',
        message: 'percent must match completedCount and totalCount',
        path: ['percent'],
      })
    }
  })
export const serializedTrackSchema = z.object({
  id: trackIdSchema,
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  dueAt: z.iso.datetime().nullable(),
})
export const serializedTrackGroupSchema = z.object({
  id: trackGroupIdSchema,
  trackId: trackIdSchema,
  title: z.string(),
  position: z.number().int().min(1),
})
export const serializedActiveTrackSchema = z
  .object({
    track: serializedTrackSchema,
    activeGroup: serializedTrackGroupSchema.nullable(),
    progress: serializedTrackProgressSchema,
    nextProblem: serializedProblemSchema.nullable(),
  })
  .nullable()
export const tracksGetWorkspaceRequestSchema = z.object({
  surface: trackDashboardSurfaceSchema,
  at: z.iso.datetime().optional(),
})
export const tracksGetTrackForEditRequestSchema = z.object({
  surface: trackDashboardSurfaceSchema,
  trackId: trackIdSchema.optional(),
})
export const tracksCreateTrackRequestSchema = trackMutationInputSchema.extend({
  surface: trackDashboardSurfaceSchema,
  setActive: z.boolean().default(false),
})
export const tracksUpdateTrackRequestSchema = trackMutationInputSchema.extend({
  surface: trackDashboardSurfaceSchema,
  trackId: trackIdSchema,
})
export const tracksSetActiveTrackRequestSchema = z.object({
  surface: trackDashboardSurfaceSchema,
  trackId: trackIdSchema,
})
export const tracksSetActiveGroupRequestSchema = z.object({
  surface: trackDashboardSurfaceSchema,
  groupId: trackGroupIdSchema,
})
export const tracksDeleteTrackRequestSchema = z.object({
  surface: trackDashboardSurfaceSchema,
  trackId: trackIdSchema,
})
export const tracksResetTrackProgressRequestSchema =
  tracksDeleteTrackRequestSchema
```

- [ ] Shape `trackWorkspaceResponseSchema.activeTrackRows` as an array of Library-shaped rows plus membership:

```ts
export const trackProblemRowSchema = problemLibraryRowSchema.extend({
  membership: z.object({
    trackId: trackIdSchema,
    groupId: trackGroupIdSchema,
    groupTitle: z.string(),
    groupPosition: z.number().int().min(1),
    problemPosition: z.number().int().min(1),
    completedAt: z.iso.datetime().nullable(),
    completedRating: trackCompletedRatingSchema.nullable(),
  }),
})
```

- [ ] Move `activeTrackSchema` ownership from `src/extension/messaging.ts` into `tracks-contracts.ts`; re-export from messaging to avoid breaking runtime handler tests.
- [ ] Add query keys:

```ts
tracks: {
  all: ['tracks'] as const,
  active: (surface?: string | null) =>
    [...queryKeys.tracks.all, 'active', surface ?? null] as const,
  workspace: (at?: string | null) =>
    [...queryKeys.tracks.all, 'workspace', at ?? 'now'] as const,
  edit: (trackId?: string | null) =>
    [...queryKeys.tracks.all, 'edit', trackId ?? 'new'] as const,
}
```

- [ ] Add API hook tests for `useTrackWorkspace`, `useTrackForEdit`, and mutation invalidation. Use `createQueryTestHarness` and `vi.mock('@/extension/messaging')`, mirroring `problems-api.test.tsx`.
- [ ] Implement runtime sender/hook names:

```ts
export function getTrackWorkspaceViaRuntime(request: TracksGetWorkspaceRequest) {
  return sendMessage('tracks.getWorkspace', request)
}
export function getTrackForEditViaRuntime(request: TracksGetTrackForEditRequest) {
  return sendMessage('tracks.getTrackForEdit', request)
}
export function useTrackWorkspace(request: TracksGetWorkspaceRequest) {
  return useQuery({
    queryKey: tracksQueryKeys.workspace(request.at),
    queryFn: () => getTrackWorkspaceViaRuntime(request),
  })
}
export function useTrackForEdit(request: TracksGetTrackForEditRequest) {
  return useQuery({
    queryKey: tracksQueryKeys.edit(request.trackId),
    queryFn: () => getTrackForEditViaRuntime(request),
  })
}
```

Mutation invalidation:

- session-only mutations invalidate `['tracks']`
- create/update/delete/reset invalidate `['tracks', 'problems']` through `invalidateTaggedQueries`

- [ ] Run focused API tests:

```bash
npm run test -- src/features/tracks/api/tracks-contracts.test.ts src/features/tracks/api/tracks-api.test.tsx
```

- [ ] Commit:

```bash
git add src/features/tracks/api src/features/tracks/index.ts src/extension/messaging.ts src/platform/query/query-keys.ts src/testing/track-fixtures.ts
git commit -m "feat: add track runtime contracts"
```

## Checkpoint 3: Promote Problem Row Reuse

**Files:**
- Create: `src/features/problems/components/problem-row/problem-row-details.tsx`
- Create: `src/features/problems/components/problem-row/problem-row-actions.tsx`
- Modify: `src/features/problems/components/library/problem-library-row-details.tsx`
- Modify: `src/features/problems/components/library/problem-row-actions.tsx`
- Modify: `src/features/problems/components/library/problem-library-table.tsx`
- Modify: `src/features/problems/components/library/problem-library-screen.test.tsx`
- Modify: `src/features/problems/index.ts`

- [ ] Write failing tests that prove Library still renders Edit, Suspend/Resume, Reset Schedule, and Delete in expanded rows after the split.
- [ ] Add a small test-only render in `problem-library-screen.test.tsx` or a new focused test to render the reusable details with only practice actions and assert Delete is absent.
- [ ] Split actions into composable pieces:

```tsx
export function ProblemRowPracticeActions({
  renderEditProblemAction,
  row,
}: {
  renderEditProblemAction: RenderProblemEditAction
  row: ProblemLibraryRow
}) {
  // Move the current edit, suspend/resume, and reset-schedule controls here.
  // Keep the existing request payloads and confirmation copy unchanged.
}

export function ProblemRowDeleteAction({ row }: { row: ProblemLibraryRow }) {
  // Move only the current delete confirmation control here.
  // Library renders this component; Tracks does not.
}

export function ProblemRowActionsBar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap justify-end gap-2">{children}</div>
}
```

- [ ] Change details to accept an action slot instead of owning all actions:

```tsx
export function ProblemRowDetails({
  actions,
  row,
}: {
  actions: ReactNode
  row: ProblemLibraryRow
}) {
  // Render the existing Details and Analytics sections, then the supplied action slot.
}
```

- [ ] Keep a Library wrapper for existing imports:

```tsx
export function ProblemLibraryRowDetails({
  renderEditProblemAction,
  row,
}: {
  renderEditProblemAction: RenderProblemEditAction
  row: ProblemLibraryRow
}) {
  return (
    <ProblemRowDetails
      actions={
        <ProblemRowActionsBar>
          <ProblemRowPracticeActions
            renderEditProblemAction={renderEditProblemAction}
            row={row}
          />
          <ProblemRowDeleteAction row={row} />
        </ProblemRowActionsBar>
      }
      row={row}
    />
  )
}
```

- [ ] Export only safe public primitives from `src/features/problems/index.ts`:

```ts
export {
  ProblemRowActionsBar,
  ProblemRowPracticeActions,
  type RenderProblemEditAction,
} from './components/problem-row/problem-row-actions'
export { ProblemRowDetails } from './components/problem-row/problem-row-details'
export { ProblemStatusBadge } from './components/library/problem-status-badge'
```

Use the new `components/problem-row` paths for `ProblemRowDetails`, `ProblemRowActionsBar`, and `ProblemRowPracticeActions`; keep `ProblemLibraryRowDetails` as the Library-specific wrapper.

- [ ] Run focused Library tests and architecture boundary test:

```bash
npm run test -- src/features/problems/components/library/problem-library-screen.test.tsx src/testing/architecture-boundaries.test.ts
```

- [ ] Commit:

```bash
git add src/features/problems/components src/features/problems/index.ts src/testing/architecture-boundaries.test.ts
git commit -m "refactor: expose reusable problem row actions"
```

## Checkpoint 4: Problem Library Rows By Slug

**Files:**
- Modify: `src/features/problems/data/problems-repository.ts`
- Modify: `src/features/problems/server/problems-service.ts`
- Modify: `src/features/problems/api/problems-serializers.ts`
- Test: `src/features/problems/data/problems-repository.test.ts`

- [ ] Write failing repository tests for `getLibraryRowsBySlug`:
  - returns only requested slugs
  - preserves input order when service maps them back by slug
  - includes topics, companies, status, summary, next review, last reviewed, and last solved
  - deduplicates duplicate input slugs before querying

Focused command:

```bash
npm run test -- src/features/problems/data/problems-repository.test.ts
```

- [ ] Refactor the existing private `readLibraryRows` into a reusable private method that accepts an optional slug set:

```ts
async getLibraryRowsBySlug(
  problemSlugs: readonly string[],
  options: ProblemLibraryReadOptions = {},
) {
  const requestedSlugs = normalizeProblemSlugList(problemSlugs)

  if (requestedSlugs.length === 0) {
    return []
  }

  return this.readLibraryRows({
    now: options.now ?? new Date(),
    targetRetention: options.targetRetention,
    problemSlugs: requestedSlugs,
  })
}
```

- [ ] Add a public server-service helper through the allowed server seam:

```ts
export async function getProblemLibraryRowsBySlug(
  db: Db,
  problemSlugs: readonly string[],
  options: ProblemLibraryReadOptions = {},
) {
  const settings = await getSettings(db)

  return createProblemsRepository(db).getLibraryRowsBySlug(problemSlugs, {
    targetRetention: settings.review.targetRetention,
    ...options,
  })
}
```

- [ ] Export a row serializer if Tracks needs serialized rows:

```ts
export function serializeProblemLibraryRow(row: ProblemLibraryRow) {
  return {
    ...row,
    problem: serializeProblem(row.problem),
    summary: serializePracticeSummary(row.summary),
    nextReviewAt: row.nextReviewAt?.toISOString() ?? null,
    lastReviewedAt: row.lastReviewedAt?.toISOString() ?? null,
    lastSolvedAt: row.lastSolvedAt?.toISOString() ?? null,
  }
}
```

- [ ] Run focused Problems repository tests:

```bash
npm run test -- src/features/problems/data/problems-repository.test.ts
```

- [ ] Commit:

```bash
git add src/features/problems/data/problems-repository.ts src/features/problems/server/problems-service.ts src/features/problems/api/problems-serializers.ts src/features/problems/data/problems-repository.test.ts
git commit -m "feat: expose problem rows by slug"
```

## Checkpoint 5: Tracks Repository Read And Write Core

**Files:**
- Modify: `src/features/tracks/domain/track.ts`
- Modify: `src/features/tracks/data/tracks-repository.ts`
- Test: `src/features/tracks/data/tracks-repository.test.ts`

- [ ] Write failing tests for repository-only behavior:
  - catalog ordering by created/title and active summary
  - active session reads selected active track and group
  - no fallback to `tracks.isActive`
  - group ordering by `track_groups.position`
  - membership ordering by `track_group_problems.position`
  - set active chooses first group and writes both session ids
  - set active group rejects groups outside current active track
  - create track with no groups creates `Main`
  - update normalizes group and problem positions
  - removing a non-empty group without moving/removing memberships is rejected
  - delete active track clears both session ids
  - reset track progress deletes only ledger rows
  - record active-track completion marks only the first incomplete active membership for `good` and `easy`
  - record active-track completion does not mark inactive tracks with the same problem

Focused command:

```bash
npm run test -- src/features/tracks/data/tracks-repository.test.ts
```

- [ ] Implement repository methods with these signatures:

```ts
async getTrackCatalog(): Promise<TrackCatalogItem[]>
async getTrackById(trackId: string): Promise<Track | null>
async getSession(): Promise<TrackSessionState>
async getGroups(trackId: string): Promise<TrackGroup[]>
async getMemberships(trackId: string): Promise<TrackProblemMembership[]>
async getProgressByTrack(trackIds: readonly string[]): Promise<Map<string, TrackProgress>>
async setActiveTrack(trackId: string, now?: Date): Promise<TrackSessionState>
async setActiveGroup(groupId: string, now?: Date): Promise<TrackSessionState>
async createTrack(input: CreateTrackInput, now?: Date): Promise<Track>
async updateTrack(input: UpdateTrackInput, now?: Date): Promise<Track>
async deleteTrack(trackId: string, now?: Date): Promise<void>
async resetTrackProgress(trackId: string): Promise<void>
async recordActiveTrackProblemCompletion(input: TrackCompletionInput): Promise<boolean>
```

- [ ] Keep all multi-step writes inside `this.db.transaction` callbacks and normalize positions with one-based values.
- [ ] Generate stable ids:

```ts
function createTrackId(slug: string) {
  return slug
}

function createTrackGroupId(trackId: string, title: string, existingIds: Set<string>) {
  const base = `${trackId}:${normalizeLeetCodeSlug(title) || 'group'}`
  let id = base
  let suffix = 2

  while (existingIds.has(id)) {
    id = `${base}-${suffix}`
    suffix += 1
  }

  existingIds.add(id)
  return id
}
```

- [ ] Use `parseLeetCodeProblemInput` or `normalizeLeetCodeSlug` for problem slugs consistently; never accept blank problem slugs.
- [ ] Run focused tests:

```bash
npm run test -- src/features/tracks/data/tracks-repository.test.ts
```

- [ ] Commit:

```bash
git add src/features/tracks/domain/track.ts src/features/tracks/data/tracks-repository.ts src/features/tracks/data/tracks-repository.test.ts
git commit -m "feat: add track repository workspace writes"
```

## Checkpoint 6: Tracks Service Workspace And Business Rules

**Files:**
- Modify: `src/features/tracks/server/tracks-service.ts`
- Modify: `src/features/tracks/api/tracks-serializers.ts`
- Test: `src/features/tracks/server/tracks-service.test.ts`

- [ ] Write failing service tests for:
  - `getWorkspace` works in free-practice mode because `/tracks` is a management workspace
  - `getActiveTrack` still returns `null` in free-practice mode for popup/app-shell behavior
  - workspace contains active track, summary-only other tracks, groups, active rows, progress, due count, and next problem
  - due count is scoped to active-track problem slugs
  - next problem picks the first incomplete due problem, then first incomplete unscheduled problem, then null
  - `getTrackForEdit` returns create defaults when no track id is provided
  - `getTrackForEdit` returns ordered groups/memberships and searchable existing Library problem options
  - create with `setActive: true` creates and activates atomically
  - update rejects zero groups
  - delete active clears session
  - reset clears only track ledger

Focused command:

```bash
npm run test -- src/features/tracks/server/tracks-service.test.ts
```

- [ ] Implement service functions:

```ts
export async function getWorkspace(
  db: Db,
  request: TracksGetWorkspaceRequest,
): Promise<TrackWorkspaceResponse>
export async function getTrackForEdit(
  db: Db,
  request: TracksGetTrackForEditRequest,
): Promise<TrackForEditResponse>
export async function setActiveTrack(
  db: Db,
  request: TracksSetActiveTrackRequest,
): Promise<void>
export async function setActiveGroup(
  db: Db,
  request: TracksSetActiveGroupRequest,
): Promise<void>
export async function createTrack(
  db: Db,
  request: TracksCreateTrackRequest,
): Promise<TrackForEditResponse>
export async function updateTrack(
  db: Db,
  request: TracksUpdateTrackRequest,
): Promise<TrackForEditResponse>
export async function deleteTrack(
  db: Db,
  request: TracksDeleteTrackRequest,
): Promise<void>
export async function resetTrackProgress(
  db: Db,
  request: TracksResetTrackProgressRequest,
): Promise<void>
export async function recordActiveTrackProblemCompletion(
  db: Db,
  input: TrackCompletionInput,
): Promise<boolean>
```

- [ ] Keep `getActiveTrack(db)` study-mode behavior unchanged for popup/app-shell.
- [ ] Assemble active rows by:
  1. reading ordered memberships for active track
  2. asking Problems for Library-shaped rows by slug
  3. mapping rows by slug
  4. duplicating a Library row for duplicate memberships in different groups
  5. attaching membership progress metadata
- [ ] Compute `nextProblem` from active memberships and Library row status:

```ts
const incompleteRows = activeRows.filter((row) => !row.membership.completedAt)
const nextRow =
  incompleteRows.find((row) => row.status === 'due') ??
  incompleteRows.find((row) => row.status !== 'suspended') ??
  null
```

- [ ] Serialize dates only in `tracks-serializers.ts`; do not serialize dates in UI components.
- [ ] Run service tests:

```bash
npm run test -- src/features/tracks/server/tracks-service.test.ts
```

- [ ] Commit:

```bash
git add src/features/tracks/server/tracks-service.ts src/features/tracks/api/tracks-serializers.ts src/features/tracks/server/tracks-service.test.ts
git commit -m "feat: build tracks workspace service"
```

## Checkpoint 7: Runtime Handlers, Policy, Cache, And Practice Progress Hook

**Files:**
- Modify: `src/extension/messaging.ts`
- Modify: `src/extension/background/register-handlers.ts`
- Modify: `src/extension/background/runtime-policy.ts`
- Modify: `src/platform/query/cache-invalidation.ts`
- Test: `src/extension/background/register-handlers.test.ts`
- Test: `src/extension/background/runtime-policy.test.ts`
- Test: `src/platform/query/cache-invalidation.test.ts`
- Test: `src/features/practice/api/practice-api.test.tsx`

- [ ] Write failing runtime tests for:
  - `tracks.getWorkspace` parses and serializes response
  - `tracks.getTrackForEdit` parses create and edit requests
  - every track write uses `runDbMutation`
  - snapshot flush happens before `tracks-updated` broadcast
  - set-active/set-group broadcast `tracks-updated` with `tracks`
  - create/update/delete/reset broadcast `tracks-updated` with `tracks` and `problems`
  - dashboard can call management methods
  - popup/content-script cannot call management methods
  - `practice.saveReviewResult` calls track completion on `good`/`easy` and broadcasts `tracks` only when completion was recorded

Focused command:

```bash
npm run test -- src/extension/background/register-handlers.test.ts src/extension/background/runtime-policy.test.ts src/platform/query/cache-invalidation.test.ts src/features/practice/api/practice-api.test.tsx
```

- [ ] Add protocol methods:

```ts
'tracks.getWorkspace'(request: TracksGetWorkspaceRequest): TrackWorkspaceResponse
'tracks.getTrackForEdit'(request: TracksGetTrackForEditRequest): TrackForEditResponse
'tracks.setActiveTrack'(request: TracksSetActiveTrackRequest): null
'tracks.setActiveGroup'(request: TracksSetActiveGroupRequest): null
'tracks.createTrack'(request: TracksCreateTrackRequest): TrackForEditResponse
'tracks.updateTrack'(request: TracksUpdateTrackRequest): TrackForEditResponse
'tracks.deleteTrack'(request: TracksDeleteTrackRequest): null
'tracks.resetTrackProgress'(request: TracksResetTrackProgressRequest): null
```

- [ ] Runtime policy:

```ts
'tracks.getWorkspace': ['dashboard'],
'tracks.getTrackForEdit': ['dashboard'],
'tracks.setActiveTrack': ['dashboard'],
'tracks.setActiveGroup': ['dashboard'],
'tracks.createTrack': ['dashboard'],
'tracks.updateTrack': ['dashboard'],
'tracks.deleteTrack': ['dashboard'],
'tracks.resetTrackProgress': ['dashboard'],
```

- [ ] Add a helper in `register-handlers.ts`:

```ts
function broadcastTracksInvalidation(input: {
  source: UiSurface
  tags?: Parameters<typeof broadcastCacheInvalidation>[0]['tags']
}) {
  return broadcastCacheInvalidation({
    reason: 'tracks-updated',
    source: input.source,
    tags: input.tags ?? ['tracks'],
  })
}
```

- [ ] In `practice.saveReviewResult`, after `saveReviewResult`, call `recordActiveTrackProblemCompletion` only when `request.rating` is `good` or `easy`; include `tracks` in invalidation tags only when the service returns `true`.
- [ ] Update practice reset/suspend hook invalidation to include Tracks because row details reused in Tracks must refresh:

```ts
invalidateTaggedQueries(queryClient, ['practice', 'problems', 'tracks'])
```

- [ ] Run focused runtime/cache/API tests.
- [ ] Commit:

```bash
git add src/extension/messaging.ts src/extension/background/register-handlers.ts src/extension/background/runtime-policy.ts src/platform/query/cache-invalidation.ts src/features/practice/api/practice-api.ts src/extension/background/register-handlers.test.ts src/extension/background/runtime-policy.test.ts src/platform/query/cache-invalidation.test.ts src/features/practice/api/practice-api.test.tsx
git commit -m "feat: wire track runtime methods"
```

## Checkpoint 8: Tracks Screen And Active Workspace UI

**Files:**
- Create: `src/features/tracks/components/tracks-screen.tsx`
- Create: `src/features/tracks/components/active-track-workspace.tsx`
- Create: `src/features/tracks/components/other-tracks-accordion.tsx`
- Create: `src/features/tracks/components/track-problem-table.tsx`
- Create: `src/features/tracks/components/track-confirmation-dialog.tsx`
- Modify: `src/features/tracks/index.ts`
- Modify: `src/app/dashboard/screens/tracks-page.tsx`
- Test: `src/features/tracks/components/tracks-screen.test.tsx`

- [ ] Write failing UI tests for:
  - loading state
  - error state with Retry
  - no tracks empty state
  - no active track selected state with other tracks available
  - active workspace renders title, description, progress, due count, next problem link, groups, and rows
  - single-group track hides noisy tabs
  - group tab click calls `tracks.setActiveGroup`
  - next problem metric links to LeetCode and there is no separate "Open Next" button
  - other tracks accordion is collapsed by default and summary-only when expanded
  - Set Active calls mutation and does not show inactive track tables
  - Delete and Reset Progress use local confirmation dialogs
  - expanded problem row reuses Problem row details/actions without global Delete

Focused command:

```bash
npm run test -- src/features/tracks/components/tracks-screen.test.tsx
```

- [ ] Implement `TracksScreen` with React Query state only:

```tsx
export function TracksScreen({
  newTrackAction,
  renderEditTrackAction,
  renderEditProblemAction,
}: TracksScreenProps) {
  const workspaceQuery = useTrackWorkspace({ surface: 'dashboard' })
  const workspace = workspaceQuery.data

  if (workspaceQuery.isPending) {
    return <TracksLoadingState />
  }

  if (workspaceQuery.isError || !workspace) {
    return <TracksErrorState onRetry={() => void workspaceQuery.refetch()} />
  }

  return (
    <TracksWorkspaceView
      newTrackAction={newTrackAction}
      renderEditProblemAction={renderEditProblemAction}
      renderEditTrackAction={renderEditTrackAction}
      workspace={workspace}
    />
  )
}
```

- [ ] Keep the page shell consistent with Library and Settings:

```tsx
<DashboardPage className="mx-auto w-full max-w-[64rem]">
  <DashboardPageHeader title="Tracks">
    Manage the active curriculum, groups, and ordered practice path.
  </DashboardPageHeader>
  <DashboardPageBody>
    <TracksScreen
      newTrackAction={newTrackAction}
      renderEditProblemAction={renderEditProblemAction}
      renderEditTrackAction={renderEditTrackAction}
    />
  </DashboardPageBody>
  <Outlet />
</DashboardPage>
```

- [ ] Implement the active workspace as one `Surface` with compact header metrics and no nested cards.
- [ ] Implement active group rows with a track-specific TanStack table:
  - no selection column
  - no filters
  - no pagination
  - columns: order, problem, difficulty, status, last review, next review
  - row title opens LeetCode
  - chevron/row click expands details
  - expanded details render `ProblemRowDetails` with `ProblemRowPracticeActions` only
- [ ] Implement `OtherTracksAccordion` with local `useState`; use a compound component only if it removes repeated prop threading between header, body, and rows.
- [ ] Use lucide icons for add, edit, delete, reset, chevron, and refresh controls.
- [ ] Run focused UI tests:

```bash
npm run test -- src/features/tracks/components/tracks-screen.test.tsx
```

- [ ] Commit:

```bash
git add src/features/tracks/components src/features/tracks/index.ts src/app/dashboard/screens/tracks-page.tsx src/features/tracks/components/tracks-screen.test.tsx
git commit -m "feat: build tracks workspace screen"
```

## Checkpoint 9: Track Form Modal And Composition

**Files:**
- Create: `src/features/tracks/components/track-form.tsx`
- Create: `src/features/tracks/hooks/use-track-form.ts`
- Create: `src/app/dashboard/screens/track-modal-pages.tsx`
- Modify: `src/app/dashboard/screens/modal-placeholders.tsx`
- Modify: `src/app/dashboard/navigation/routes.tsx`
- Modify: `src/app/dashboard/navigation/route-manifest.ts`
- Test: `src/features/tracks/components/track-form.test.tsx`
- Test: `src/app/dashboard/routes.test.tsx`

- [ ] Write failing tests for:
  - `/tracks/new` renders modal over Tracks
  - create direct route loads form options
  - title is required
  - default group is `Main`
  - create can add, rename, remove empty, and move groups up/down
  - create can search existing Library problems and add/remove/move them in the selected group
  - create submit sends ordered groups/problem slugs
  - unchecked `Set as active track` is omitted or false by default
  - checked `Set as active track` sends `setActive: true`
  - `/tracks/$trackId/edit` direct route loads existing metadata/groups/memberships
  - edit submit sends full replacement groups/memberships
  - modal cancel/close returns to `/tracks`

Focused command:

```bash
npm run test -- src/features/tracks/components/track-form.test.tsx src/app/dashboard/routes.test.tsx
```

- [ ] Implement `useTrackForm` with `useReducer` because group and membership ordering are multi-field local state:

```ts
type TrackFormAction =
  | { type: 'set-title'; title: string }
  | { type: 'set-description'; description: string }
  | { type: 'set-due-at'; dueAt: string }
  | { type: 'set-active-after-create'; checked: boolean }
  | { type: 'add-group' }
  | { type: 'rename-group'; groupKey: string; title: string }
  | { type: 'remove-group'; groupKey: string }
  | { type: 'move-group'; groupKey: string; direction: 'up' | 'down' }
  | { type: 'select-group'; groupKey: string }
  | { type: 'add-problem'; groupKey: string; problemSlug: string }
  | { type: 'remove-problem'; groupKey: string; problemSlug: string }
  | { type: 'move-problem'; groupKey: string; problemSlug: string; direction: 'up' | 'down' }
```

- [ ] Derive `canSubmit`, `fieldErrors`, and request payload during render; do not mirror derived values in state.
- [ ] Keep the form modal simple:
  - left section: title, description, target date, set-active checkbox for create
  - middle section: group list with rename/move/remove
  - right section: selected group problem membership search/list
  - no drag/drop
  - no inline global problem creation
- [ ] Route pages:

```tsx
export function NewTrackModalPage() {
  return (
    <RouteModal closeTo={dashboardPaths.tracks} showCloseButton={false} title="New Track" variant="form">
      <TrackForm mode="create" onCancel={closeToTracks} onSaved={closeToTracks} />
    </RouteModal>
  )
}
```

- [ ] Replace track modal placeholders in `routes.tsx`; leave problem modals unchanged.
- [ ] Run focused form/route tests:

```bash
npm run test -- src/features/tracks/components/track-form.test.tsx src/app/dashboard/routes.test.tsx
```

- [ ] Commit:

```bash
git add src/features/tracks/components/track-form.tsx src/features/tracks/hooks/use-track-form.ts src/app/dashboard/screens/track-modal-pages.tsx src/app/dashboard/screens/modal-placeholders.tsx src/app/dashboard/navigation/routes.tsx src/app/dashboard/navigation/route-manifest.ts src/features/tracks/components/track-form.test.tsx src/app/dashboard/routes.test.tsx
git commit -m "feat: add track create and edit modals"
```

## Checkpoint 10: Architecture, Styling, And Surface Integration

**Files:**
- Modify as needed: `src/features/app-shell/server/app-shell-service.ts`
- Modify as needed: `src/features/app-shell/server/app-shell-service.test.ts`
- Modify as needed: `src/app/popup/popup-shell.test.tsx`
- Modify: `src/testing/architecture-boundaries.test.ts`
- Modify: touched Tracks/Problems UI files only for polish discovered in verification.

- [ ] Write or update app-shell tests proving:
  - popup active-track card uses ledger progress
  - app-shell active track still hides in free-practice mode through `getActiveTrack`
  - overlay post-submission next step prioritizes active-track next problem
  - overlay falls back to queue when there is no active-track next problem

Focused command:

```bash
npm run test -- src/features/app-shell/server/app-shell-service.test.ts src/app/popup/popup-shell.test.tsx
```

- [ ] Run architecture boundary tests:

```bash
npm run test -- src/testing/architecture-boundaries.test.ts
```

Expected: app imports Tracks from public feature surface only; Tracks does not deep-import Problems internals; root barrels do not export `data` or `server`.

- [ ] Do a UI audit against the current design system:
  - page max width matches Library/Settings unless the table genuinely needs wider scrolling
  - no nested cards
  - no hero section
  - no orange-heavy legacy styling
  - focus rings visible
  - buttons use icons where useful
  - long track/problem titles truncate without overlapping actions
  - mobile layout stacks without text escaping controls

- [ ] Run focused UI tests again:

```bash
npm run test -- src/features/tracks/components/tracks-screen.test.tsx src/features/tracks/components/track-form.test.tsx
```

- [ ] Commit:

```bash
git add src/features/app-shell src/app/popup src/testing/architecture-boundaries.test.ts src/features/tracks src/features/problems
git commit -m "chore: polish tracks integration"
```

## Checkpoint 11: Full Verification And Browser Smoke

**Files:**
- Modify only files needed to fix verification failures.

- [ ] Run full verification:

```bash
npm run check
```

Expected: db check, typecheck, lint, and Vitest pass.

- [ ] If Vitest prints existing `Window's scrollTo() method` jsdom notices, treat them as non-blocking only when the command exits `0`.
- [ ] Start the dev server if it is not already running:

```bash
npm run dev
```

- [ ] Browser smoke in the dashboard:
  - open `/dashboard.html#/tracks`
  - confirm active track first
  - expand other tracks
  - set another track active
  - switch group tabs
  - expand a problem row
  - open new track modal
  - create a simple track with one group
  - edit the created track
  - reset track progress with confirmation
  - delete the created track with confirmation

- [ ] Run final `git status --short` and ensure `.superpowers/` remains untracked unless explicitly requested.
- [ ] If Checkpoint 11 changes files, run `git status --short`, stage each changed implementation/test file shown there, and commit with `git commit -m "fix: stabilize tracks phase 3"`. Skip this commit when Checkpoint 11 makes no file changes.

## Acceptance Criteria

- `/tracks` is a real active-first workspace with other tracks in a summary accordion.
- Tracks can be created, edited, activated, deleted, and reset with local confirmations for destructive actions.
- Tracks always contain at least one group; single-group tracks do not show noisy tab navigation.
- Group and problem membership ordering is simple move up/down, persisted transactionally, and normalized to one-based positions.
- Track progress is stored in `track_problem_progress`, updated only for the active track on `good` or `easy`, and does not leak across tracks sharing a problem.
- Reset track progress clears only the track ledger.
- Global FSRS/practice state remains lifelong and continues to power the queue.
- Tracks rows reuse public Problem row details/actions and omit global problem delete.
- Runtime policy allows dashboard track management and rejects popup/content-script management calls.
- Track writes flush snapshots before broadcasting invalidation.
- Cache invalidation refreshes Tracks, app shell, and Problems where memberships changed.
- Settings free-practice hiding of active track remains unchanged outside `/tracks`.
- `npm run check` passes.

## Deferred Work

- Create Track from Library filtered/selected results with grouping choices.
- Richer seeded/imported track catalog from old source lists.
- Popup/overview visual polish beyond the data correctness covered here.
- Drag/drop ordering.
- Advanced import/export.
