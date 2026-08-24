# Non-Destructive Track Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an atomic, non-destructive JSON importer to the Tracks dashboard
and ship an importable NeetCode 150/250 track file with durable authoring
instructions.

**Architecture:** The Tracks feature owns a strict versioned import contract,
modal workflow, runtime API, and orchestration service. The background runtime
authorizes and validates the dashboard-only mutation, while transaction-bound
Problems and Tracks repository operations reuse existing problems, create only
missing problems, and create all imported tracks atomically. The app layer only
adds the modal route and composes actions.

**Tech Stack:** React 19, TypeScript, TanStack Router, TanStack Query, Zod,
Drizzle SQLite, Vitest, React Testing Library, WXT Chrome MV3

---

## Baseline Evidence

The isolated worktree starts from `origin/main` at release tag `v1.2.0`.

- `npm run test`: passes 147 files and 1,537 tests.
- `npm run check`: currently stops before feature checks because the installed
  `drizzle-kit` rejects the repository's `drizzle-kit check` command.
- `npm run typecheck`: currently reports the pre-existing missing
  `drizzle-kit#defineConfig` export and an alarm scheduler Chrome type mismatch.
- `npm run lint`: currently reports the pre-existing unresolved
  `drizzle.config.ts` call.

Do not change those unrelated baseline failures in this feature. Focused tests,
build evidence, and exact final command outputs must remain explicit.

## File Map

### New files

- `src/features/tracks/components/track-import-form.tsx`: file parsing,
  validation preview, import mutation, errors, and success summary.
- `src/features/tracks/components/track-import-form.test.tsx`: component states
  and mutation behavior.
- `docs/track-import.md`: public JSON authoring and conflict guide.
- `track-imports/neetcode-150-and-250.json`: checked-in import artifact.

### Modified files

- `src/features/tracks/api/tracks-contracts.ts`: import file, request, response,
  and preview contracts.
- `src/features/tracks/api/tracks-contracts.test.ts`: contract RED/GREEN cases
  and checked-in artifact validation.
- `src/features/problems/data/problems-repository.ts`: insert-only missing
  problem operation.
- `src/features/problems/data/problems-repository.test.ts`: existing metadata
  preservation and fallback creation tests.
- `src/features/tracks/data/tracks-repository.ts`: transaction-bound track
  insertion helper used by normal create and bulk import.
- `src/features/tracks/data/tracks-repository.test.ts`: transaction-bound track
  insertion tests.
- `src/features/tracks/server/tracks-service.ts`: atomic import orchestration.
- `src/features/tracks/server/tracks-service.test.ts`: import integration and
  rollback tests.
- `src/features/tracks/api/tracks-api.ts`: runtime call and mutation hook.
- `src/features/tracks/api/tracks-api.test.tsx`: request and invalidation tests.
- `src/features/tracks/index.ts`: public Tracks exports.
- `src/extension/messaging.ts`: protocol request/response types and method name.
- `src/extension/background/runtime-policy.ts`: dashboard-only authorization.
- `src/extension/background/runtime-policy.test.ts`: access test.
- `src/extension/background/register-handlers.ts`: validated DB mutation and
  invalidation handler.
- `src/extension/background/register-handlers.test.ts`: handler test.
- `src/app/dashboard/navigation/route-manifest.ts`: `/tracks/import` modal
  metadata.
- `src/app/dashboard/navigation/routes.tsx`: import child route.
- `src/app/dashboard/screens/track-modal-pages.tsx`: modal composition.
- `src/app/dashboard/screens/tracks-page.tsx`: Import Tracks action beside New
  Track.
- `src/features/tracks/components/tracks-screen.tsx`: render a shared action
  group in empty and catalog states.
- `src/features/tracks/components/other-tracks-accordion.tsx`: receive the
  shared track action group instead of a single New Track action.
- `src/features/tracks/components/tracks-screen.test.tsx`: discoverability.
- `src/app/dashboard/routes.test.tsx`: route modal coverage.
- `src/features/backup/components/selective-import-panel.tsx`: remove Tracks
  from the future backup-import placeholder.
- `src/features/backup/components/data-management-screen.test.tsx`: update the
  planned-area expectation.
- `README.md`, `docs/product.md`, `docs/architecture.md`, `docs/testing.md`, and
  `design.md`: current behavior, format link, ownership, and smoke flow.

## Task 1: Define The Versioned Track Import Contract

**Files:**

- Modify: `src/features/tracks/api/tracks-contracts.test.ts`
- Modify: `src/features/tracks/api/tracks-contracts.ts`
- Modify: `src/features/tracks/index.ts`

- [ ] **Step 1: Write failing contract tests**

Add imports for the new schemas and tests equivalent to:

```ts
const validImport = {
  schemaVersion: 1,
  app: 'cognipace-track-import',
  problems: [
    {
      slug: 'two-sum',
      title: 'Two Sum',
      difficulty: 'easy',
      isPremium: false,
    },
  ],
  tracks: [
    {
      title: 'Interview Track',
      description: null,
      dueAt: null,
      groups: [
        { title: 'Arrays', problemSlugs: ['two-sum', 'valid-anagram'] },
      ],
    },
  ],
} as const

it('parses a strict versioned track import and applies problem defaults', () => {
  const parsed = trackImportFileSchema.parse({
    ...validImport,
    problems: [{ slug: 'valid-anagram' }],
  })

  expect(parsed.problems).toEqual([
    {
      slug: 'valid-anagram',
      difficulty: 'unknown',
      isPremium: false,
    },
  ])
})

it('rejects wrong envelopes and unknown fields', () => {
  expect(
    trackImportFileSchema.safeParse({ ...validImport, app: 'cognipace' })
      .success,
  ).toBe(false)
  expect(
    trackImportFileSchema.safeParse({ ...validImport, unexpected: true })
      .success,
  ).toBe(false)
})

it('rejects normalized duplicate track titles and problem memberships', () => {
  expect(
    trackImportFileSchema.safeParse({
      ...validImport,
      tracks: [
        validImport.tracks[0],
        { ...validImport.tracks[0], title: 'Interview   Track' },
      ],
    }).success,
  ).toBe(false)

  expect(
    trackImportFileSchema.safeParse({
      ...validImport,
      tracks: [
        {
          ...validImport.tracks[0],
          groups: [
            { title: 'Arrays', problemSlugs: ['two-sum'] },
            { title: 'Hashing', problemSlugs: ['Two Sum'] },
          ],
        },
      ],
    }).success,
  ).toBe(false)
})

it('summarizes unique referenced problems for the preview', () => {
  expect(createTrackImportPreview(trackImportFileSchema.parse(validImport))).toEqual({
    trackCount: 1,
    groupCount: 1,
    problemCount: 2,
  })
})
```

Also test limits: 20 tracks accepted and 21 rejected; 100 groups accepted and
101 rejected; 1,000 references accepted and 1,001 rejected; 5,000 problem
definitions accepted and 5,001 rejected. Verify duplicate top-level problem
definitions after slug normalization are rejected with a path.

- [ ] **Step 2: Run the contract tests and verify RED**

Run:

```sh
npx vitest run src/features/tracks/api/tracks-contracts.test.ts
```

Expected: FAIL because `trackImportFileSchema`,
`tracksImportTracksRequestSchema`, `trackImportResultSchema`, and
`createTrackImportPreview` do not exist.

- [ ] **Step 3: Implement the strict contract and duplicate checks**

Add the following contract shape in `tracks-contracts.ts`, reusing
`problemDifficultySchema`, `problemSlugSchema`, and `normalizeLeetCodeSlug`:

```ts
export const trackImportSchemaVersion = 1

const trackImportProblemSchema = z.strictObject({
  slug: problemSlugSchema,
  title: z.string().trim().min(1).optional(),
  difficulty: problemDifficultySchema.default('unknown'),
  isPremium: z.boolean().default(false),
})

const trackImportGroupSchema = z.strictObject({
  title: z.string().trim().min(1),
  problemSlugs: z.array(problemSlugSchema).min(1).max(1_000),
})

const trackImportTrackSchema = z.strictObject({
  title: z.string().trim().min(1),
  description: z.string().trim().nullable().default(null),
  dueAt: z.iso.datetime().nullable().default(null),
  groups: z.array(trackImportGroupSchema).min(1).max(100),
})

export const trackImportFileSchema = z
  .strictObject({
    schemaVersion: z.literal(trackImportSchemaVersion),
    app: z.literal('cognipace-track-import'),
    problems: z.array(trackImportProblemSchema).max(5_000).default(() => []),
    tracks: z.array(trackImportTrackSchema).min(1).max(20),
  })
  .superRefine(addTrackImportDuplicateIssues)

export const tracksImportTracksRequestSchema = z.strictObject({
  surface: trackDashboardSurfaceSchema,
  file: trackImportFileSchema,
})

export const trackImportResultSchema = z.strictObject({
  createdTrackIds: z.array(trackIdSchema),
  createdTrackCount: z.number().int().min(1),
  createdProblemCount: z.number().int().min(0),
  reusedProblemCount: z.number().int().min(0),
})

export type TrackImportFile = z.infer<typeof trackImportFileSchema>
export type TracksImportTracksRequest = z.infer<
  typeof tracksImportTracksRequestSchema
>
export type TrackImportResult = z.infer<typeof trackImportResultSchema>

export function createTrackImportPreview(file: TrackImportFile) {
  const slugs = new Set(
    file.tracks.flatMap((track) =>
      track.groups.flatMap((group) =>
        group.problemSlugs.map(normalizeLeetCodeSlug),
      ),
    ),
  )

  return {
    trackCount: file.tracks.length,
    groupCount: file.tracks.reduce(
      (count, track) => count + track.groups.length,
      0,
    ),
    problemCount: slugs.size,
  }
}
```

Implement `addTrackImportDuplicateIssues` with normalized track titles,
top-level problem slugs, and per-track membership slugs. Add issues on the
later duplicate's exact path and use messages that name the duplicate value.
Reject any slug/title whose normalization is empty. In the same refinement,
sum every group's `problemSlugs.length` for each track and reject totals above
1,000 so the reference limit is enforced per track rather than only per group.

Export schemas, helpers, and types through `src/features/tracks/index.ts`.

- [ ] **Step 4: Run the contract tests and verify GREEN**

Run the focused command from Step 2. Expected: PASS.

- [ ] **Step 5: Commit Task 1**

```sh
git add src/features/tracks/api/tracks-contracts.ts \
  src/features/tracks/api/tracks-contracts.test.ts \
  src/features/tracks/index.ts
git commit -m "feat(tracks): define track import contract"
```

## Task 2: Add Insert-Only Problem Persistence And Transaction-Bound Track Creation

**Files:**

- Modify: `src/features/problems/data/problems-repository.test.ts`
- Modify: `src/features/problems/data/problems-repository.ts`
- Modify: `src/features/tracks/data/tracks-repository.test.ts`
- Modify: `src/features/tracks/data/tracks-repository.ts`

- [ ] **Step 1: Write failing Problems repository tests**

Add a test that seeds `two-sum`, calls the wished-for API, and verifies existing
metadata is not changed while a missing problem receives fallbacks:

```ts
it('creates only missing import problems without changing existing metadata', async () => {
  const handle = await createTestDb({
    now: new Date('2026-01-01T00:00:00.000Z'),
  })
  const repository = createProblemsRepository(handle.db)

  const result = await repository.createMissingProblems(
    [
      {
        slug: 'two-sum',
        title: 'Wrong Imported Title',
        difficulty: 'hard',
        isPremium: true,
      },
      {
        slug: 'brand-new-problem',
        title: undefined,
        difficulty: 'unknown',
        isPremium: false,
      },
    ],
    new Date('2026-01-02T00:00:00.000Z'),
  )

  expect(result).toEqual({
    createdSlugs: ['brand-new-problem'],
    reusedSlugs: ['two-sum'],
  })
  await expect(repository.getBySlug('two-sum')).resolves.toMatchObject({
    title: 'Two Sum',
    difficulty: 'easy',
    isPremium: false,
  })
  await expect(
    repository.getBySlug('brand-new-problem'),
  ).resolves.toMatchObject({
    title: 'Brand New Problem',
    difficulty: 'unknown',
    isPremium: false,
  })
})
```

- [ ] **Step 2: Run the Problems test and verify RED**

```sh
npx vitest run src/features/problems/data/problems-repository.test.ts
```

Expected: FAIL because `createMissingProblems` does not exist.

- [ ] **Step 3: Implement insert-only missing problem creation**

Add a public repository method with an explicit input type:

```ts
export interface MissingProblemInput {
  slug: string
  title?: string | undefined
  difficulty?: string | undefined
  isPremium?: boolean | undefined
}

async createMissingProblems(
  inputs: readonly MissingProblemInput[],
  now = new Date(),
) {
  const normalized = uniqueMissingProblemInputs(inputs)
  const existingRows =
    normalized.length === 0
      ? []
      : await this.db
          .select({ slug: problems.slug })
          .from(problems)
          .where(inArray(problems.slug, normalized.map((problem) => problem.slug)))
  const reused = new Set(existingRows.map((row) => row.slug))
  const missing = normalized.filter((problem) => !reused.has(problem.slug))
  const timestamp = now.getTime()

  if (missing.length > 0) {
    await this.db
      .insert(problems)
      .values(
        missing.map((problem) => ({
          slug: problem.slug,
          title: problem.title?.trim() || titleFromSlug(problem.slug),
          difficulty: normalizeProblemDifficulty(problem.difficulty),
          isPremium: problem.isPremium ?? false,
          createdAt: timestamp,
          updatedAt: timestamp,
        })),
      )
      .onConflictDoNothing()
  }

  return {
    createdSlugs: missing.map((problem) => problem.slug),
    reusedSlugs: normalized
      .filter((problem) => reused.has(problem.slug))
      .map((problem) => problem.slug),
  }
}
```

Normalize and de-duplicate inputs without updating existing rows. Empty
normalized slugs must throw before writes.

- [ ] **Step 4: Verify the Problems repository test passes**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Write a failing Tracks repository transaction-bound insertion test**

Add a test demonstrating that `insertTrack` writes ordered groups and
memberships when the caller already owns the transaction:

```ts
it('inserts a track through a caller-owned transaction', async () => {
  const handle = await createTestDb({
    now: new Date('2026-01-01T00:00:00.000Z'),
  })

  await handle.db.transaction(async (transactionDb) => {
    const repository = createTracksRepository(transactionDb as unknown as Db)
    await repository.insertTrack(
      {
        title: 'Imported Plan',
        description: null,
        dueAt: null,
        groups: [
          { title: 'Arrays', problemSlugs: ['two-sum'] },
          { title: 'Stack', problemSlugs: ['valid-parentheses'] },
        ],
      },
      new Date('2026-01-02T00:00:00.000Z'),
    )
  })

  const repository = createTracksRepository(handle.db)
  await expect(repository.getGroups('imported-plan')).resolves.toMatchObject([
    { title: 'Arrays', position: 1 },
    { title: 'Stack', position: 2 },
  ])
  await expect(repository.getMemberships('imported-plan')).resolves.toMatchObject([
    { problemSlug: 'two-sum', position: 1 },
    { problemSlug: 'valid-parentheses', position: 1 },
  ])
})
```

- [ ] **Step 6: Run the Tracks repository test and verify RED**

```sh
npx vitest run src/features/tracks/data/tracks-repository.test.ts
```

Expected: FAIL because `insertTrack` does not exist.

- [ ] **Step 7: Refactor normal creation around a transaction-bound helper**

Keep existing `createTrack` semantics and move its current transaction body to
`insertTrack`:

```ts
async createTrack(input: CreateTrackInput, now = new Date()): Promise<Track> {
  return this.db.transaction((transactionDb) =>
    createTracksRepository(transactionDb as unknown as Db).insertTrack(
      input,
      now,
    ),
  )
}

async insertTrack(input: CreateTrackInput, now = new Date()): Promise<Track> {
  const timestamp = now.getTime()
  const normalizedTrack = normalizeTrackMutationInput(input)
  const slug = normalizeLeetCodeSlug(normalizedTrack.title)

  if (!slug) {
    throw new Error('Cannot create a track without a slug.')
  }

  const trackId = createTrackId(slug)
  const existingTrack = await readTrackById(this.db, trackId)

  if (existingTrack) {
    throw new Error(`Track "${trackId}" already exists.`)
  }

  await this.db.insert(tracks).values({
    id: trackId,
    slug,
    title: normalizedTrack.title,
    description: normalizedTrack.description,
    dueAt: normalizedTrack.dueAt,
    createdAt: timestamp,
    updatedAt: timestamp,
  })

  const normalizedGroups = normalizeGroupInputs({
    trackId,
    groups: normalizedTrack.groups,
    existingGroupIds: new Set(),
    useDefaultMainGroup: true,
  })
  await writeNewGroups(this.db, trackId, normalizedGroups, timestamp)

  const createdTrack = await readTrackById(this.db, trackId)
  if (!createdTrack) {
    throw new Error(`Failed to read created track "${trackId}".`)
  }
  return createdTrack
}
```

Run all existing create-track repository tests to prove no behavior regressed.

- [ ] **Step 8: Verify both repository suites pass**

```sh
npx vitest run \
  src/features/problems/data/problems-repository.test.ts \
  src/features/tracks/data/tracks-repository.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit Task 2**

```sh
git add src/features/problems/data/problems-repository.ts \
  src/features/problems/data/problems-repository.test.ts \
  src/features/tracks/data/tracks-repository.ts \
  src/features/tracks/data/tracks-repository.test.ts
git commit -m "feat(tracks): support atomic import persistence"
```

## Task 3: Implement Atomic Import Orchestration

**Files:**

- Modify: `src/features/tracks/server/tracks-service.test.ts`
- Modify: `src/features/tracks/server/tracks-service.ts`

- [ ] **Step 1: Write failing import integration tests**

Import `importTracks` and add tests that prove:

1. Existing `two-sum` metadata stays unchanged.
2. A missing slug is created with fallback metadata.
3. Two tracks preserve group and problem order.
4. The current active track/session stays unchanged.
5. Existing practice and review rows stay unchanged.
6. An existing track conflict writes neither earlier tracks nor missing
   problems.
7. A failure on the second imported track rolls back the first.

Use the contract parser to construct the request:

```ts
const request = tracksImportTracksRequestSchema.parse({
  surface: 'dashboard',
  file: {
    schemaVersion: 1,
    app: 'cognipace-track-import',
    problems: [{ slug: 'new-problem' }],
    tracks: [
      {
        title: 'Imported 150',
        groups: [
          {
            title: 'Arrays',
            problemSlugs: ['two-sum', 'new-problem'],
          },
        ],
      },
    ],
  },
})

await expect(importTracks(handle.db, request)).resolves.toEqual({
  createdTrackIds: ['imported-150'],
  createdTrackCount: 1,
  createdProblemCount: 1,
  reusedProblemCount: 1,
})
```

For rollback, include a conflicting built-in `leetcode-75` title after a new
track and reference a new missing slug. Assert both `getTrackById('first-new')`
and `getBySlug('rollback-problem')` return `null` after rejection.

- [ ] **Step 2: Run the service test and verify RED**

```sh
npx vitest run src/features/tracks/server/tracks-service.test.ts
```

Expected: FAIL because `importTracks` does not exist.

- [ ] **Step 3: Implement normalization, preflight, and one transaction**

Add the service with this structure:

```ts
export async function importTracks(
  db: Db,
  request: TracksImportTracksRequest,
): Promise<TrackImportResult> {
  const importedAt = new Date()

  return db.transaction(async (transactionDb) => {
    const tx = transactionDb as unknown as Db
    const tracksRepository = createTracksRepository(tx)
    const problemsRepository = createProblemsRepository(tx)
    const normalizedTracks = request.file.tracks.map(toCreateTrackInput)

    for (const track of normalizedTracks) {
      const trackId = normalizeLeetCodeSlug(track.title)
      if (await tracksRepository.getTrackById(trackId)) {
        throw new Error(
          `Track "${track.title}" already exists. Rename the import or delete the existing track first.`,
        )
      }
    }

    const definitions = new Map(
      request.file.problems.map((problem) => [
        normalizeLeetCodeSlug(problem.slug),
        problem,
      ]),
    )
    const referencedSlugs = uniqueReferencedSlugs(request.file)
    const problemResult = await problemsRepository.createMissingProblems(
      referencedSlugs.map((slug) => ({ slug, ...definitions.get(slug) })),
      importedAt,
    )
    const createdTracks = []

    for (const track of normalizedTracks) {
      createdTracks.push(await tracksRepository.insertTrack(track, importedAt))
    }

    return trackImportResultSchema.parse({
      createdTrackIds: createdTracks.map((track) => track.id),
      createdTrackCount: createdTracks.length,
      createdProblemCount: problemResult.createdSlugs.length,
      reusedProblemCount: problemResult.reusedSlugs.length,
    })
  })
}
```

`toCreateTrackInput` normalizes every problem slug and preserves group order.
Do not set the active track. Keep all writes inside the transaction and return
only result counts and created ids.

- [ ] **Step 4: Run the service tests and verify GREEN**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Run all focused persistence tests**

```sh
npx vitest run \
  src/features/problems/data/problems-repository.test.ts \
  src/features/tracks/data/tracks-repository.test.ts \
  src/features/tracks/server/tracks-service.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

```sh
git add src/features/tracks/server/tracks-service.ts \
  src/features/tracks/server/tracks-service.test.ts
git commit -m "feat(tracks): import tracks without replacing local data"
```

## Task 4: Wire The Runtime Boundary And Query Mutation

**Files:**

- Modify: `src/extension/messaging.ts`
- Modify: `src/extension/background/runtime-policy.ts`
- Modify: `src/extension/background/runtime-policy.test.ts`
- Modify: `src/extension/background/register-handlers.ts`
- Modify: `src/extension/background/register-handlers.test.ts`
- Modify: `src/features/tracks/api/tracks-api.ts`
- Modify: `src/features/tracks/api/tracks-api.test.tsx`
- Modify: `src/features/tracks/index.ts`

- [ ] **Step 1: Write failing runtime policy and handler tests**

Add `tracks.importTracks` to the policy test matrix and assert dashboard access
is allowed while popup/content-script access is denied.

In `register-handlers.test.ts`, add a mocked `importTracks`, then test:

```ts
it('imports tracks through the dashboard mutation boundary', async () => {
  const request = tracksImportTracksRequestSchema.parse({
    surface: 'dashboard',
    file: validTrackImportFile,
  })
  backgroundMocks.importTracks.mockResolvedValueOnce({
    createdTrackIds: ['imported-track'],
    createdTrackCount: 1,
    createdProblemCount: 1,
    reusedProblemCount: 1,
  })

  const response = await sendRuntimeMessage('tracks.importTracks', request)

  expectRuntimePolicy('tracks.importTracks', 'dashboard')
  expect(backgroundMocks.importTracks).toHaveBeenCalledWith(
    backgroundMocks.db,
    request,
  )
  expect(response).toEqual(trackImportResultSchema.parse(response))
  expectDbMutationInvalidation(['tracks', 'problems'])
})
```

Use the test suite's existing DB mutation helper names exactly after inspecting
the current helper signature.

- [ ] **Step 2: Run runtime tests and verify RED**

```sh
npx vitest run \
  src/extension/background/runtime-policy.test.ts \
  src/extension/background/register-handlers.test.ts
```

Expected: FAIL because the method is absent from the protocol, policy, and
handler.

- [ ] **Step 3: Add the protocol, policy, and handler**

Extend `ProtocolMap` and `protocolMethodNames`:

```ts
'tracks.importTracks'(
  request: TracksImportTracksRequest,
): TrackImportResult
```

Authorize it in `methodSurfaceAccess`:

```ts
'tracks.importTracks': ['dashboard'],
```

Register it beside `tracks.createTrack`:

```ts
onMessage('tracks.importTracks', ({ data, sender }) => {
  const request = tracksImportTracksRequestSchema.parse(data)

  assertCanSenderCallExtensionMethod(
    'tracks.importTracks',
    request.surface,
    sender,
  )
  return runDbMutation(
    async (db) =>
      trackImportResultSchema.parse(await importTracks(db, request)),
    () =>
      broadcastTracksInvalidation({
        source: request.surface,
        tags: ['tracks', 'problems'],
      }),
  )
})
```

The existing `runDbMutation` must flush the snapshot before invalidation.

- [ ] **Step 4: Verify runtime tests pass**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Write a failing API hook test**

Extend `tracks-api.test.tsx` using its `expectTrackMutation` helper:

```ts
await expectTrackMutation({
  method: 'tracks.importTracks',
  request: {
    surface: 'dashboard',
    file: validTrackImportFile,
  } satisfies TracksImportTracksRequest,
  response: {
    createdTrackIds: ['imported-track'],
    createdTrackCount: 1,
    createdProblemCount: 1,
    reusedProblemCount: 2,
  },
  useHook: useImportTracks,
  invalidatedQueryKeys,
})
```

- [ ] **Step 6: Run the API test and verify RED**

```sh
npx vitest run src/features/tracks/api/tracks-api.test.tsx
```

Expected: FAIL because the runtime function and hook do not exist.

- [ ] **Step 7: Implement the API function and mutation hook**

```ts
export function importTracksViaRuntime(request: TracksImportTracksRequest) {
  return sendMessage('tracks.importTracks', request)
}

export function useImportTracks() {
  return useTrackMutation(importTracksViaRuntime, ['tracks', 'problems'])
}
```

Export the API, contract, and result types through `features/tracks/index.ts`.

- [ ] **Step 8: Verify API and runtime tests pass**

```sh
npx vitest run \
  src/features/tracks/api/tracks-api.test.tsx \
  src/extension/background/runtime-policy.test.ts \
  src/extension/background/register-handlers.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit Task 4**

```sh
git add src/extension/messaging.ts \
  src/extension/background/runtime-policy.ts \
  src/extension/background/runtime-policy.test.ts \
  src/extension/background/register-handlers.ts \
  src/extension/background/register-handlers.test.ts \
  src/features/tracks/api/tracks-api.ts \
  src/features/tracks/api/tracks-api.test.tsx \
  src/features/tracks/index.ts
git commit -m "feat(tracks): expose track import runtime mutation"
```

## Task 5: Build The Tracks Import Modal Test-First

**Files:**

- Create: `src/features/tracks/components/track-import-form.test.tsx`
- Create: `src/features/tracks/components/track-import-form.tsx`
- Modify: `src/features/tracks/index.ts`
- Modify: `src/app/dashboard/navigation/route-manifest.ts`
- Modify: `src/app/dashboard/navigation/routes.tsx`
- Modify: `src/app/dashboard/screens/track-modal-pages.tsx`
- Modify: `src/app/dashboard/screens/tracks-page.tsx`
- Modify: `src/features/tracks/components/tracks-screen.tsx`
- Modify: `src/features/tracks/components/tracks-screen.test.tsx`
- Modify: `src/app/dashboard/routes.test.tsx`

- [ ] **Step 1: Write failing TrackImportForm component tests**

Mock `sendMessage` and cover these independent behaviors:

- Empty state explains reuse/create behavior and has a JSON file picker.
- Malformed JSON reports `Selected file is not valid JSON.` and disables
  import.
- Wrong envelope or contract error shows the first Zod issue with its path.
- Valid JSON previews tracks, groups, and unique problems.
- Clicking Import sends `{ surface: 'dashboard', file }`, disables duplicate
  submission while pending, and keeps the modal open.
- Success shows created/reused counts and a `Done` button.
- Runtime failure reports the error and allows retry.

Use a real `File` and `userEvent.upload`:

```tsx
const file = new File([JSON.stringify(validTrackImportFile)], 'tracks.json', {
  type: 'application/json',
})

await user.upload(screen.getByLabelText('Track import file'), file)

expect(await screen.findByText('1 track')).toBeVisible()
expect(screen.getByText('1 group')).toBeVisible()
expect(screen.getByText('2 unique problems')).toBeVisible()
```

- [ ] **Step 2: Run the component test and verify RED**

```sh
npx vitest run src/features/tracks/components/track-import-form.test.tsx
```

Expected: FAIL because `TrackImportForm` does not exist.

- [ ] **Step 3: Implement the form state machine**

Create `TrackImportForm` with props:

```ts
export interface TrackImportFormProps {
  onDone: () => void
}
```

Keep `selectedFileName`, parsed `TrackImportFile`, preview, error, and result in
local state. Parse text with `JSON.parse`, then
`trackImportFileSchema.safeParse`. Format the first issue as
`<path>: <message>` when a path exists. Special-case the wrong `app` envelope
and unsupported `schemaVersion` with the explicit messages from the design,
then fall back to the generic Zod issue formatter. Submit through
`useImportTracks`.

Render the existing `Button`, `InlineStatus`, and compact bordered summary
patterns. Include a `<details>` block with the recommended top-level
`problems` plus `tracks/groups/problemSlugs` JSON shape. Do not duplicate the
full docs page in the UI.

Use these action semantics:

- `Choose JSON file` opens the hidden input.
- `Import Tracks` is enabled only for a valid parsed file and while idle.
- `Done` calls `onDone` only after success.
- Selecting another file clears prior error/result state.

- [ ] **Step 4: Verify the component test passes**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Write failing Tracks action and route tests**

Update `TracksScreen` tests to require `Import Tracks` beside `New Track` in the
empty and all-tracks action regions. Update route tests to navigate to
`#/tracks/import`, assert a modal heading `Import Tracks`, then close back to
Tracks.

- [ ] **Step 6: Run screen and route tests and verify RED**

```sh
npx vitest run \
  src/features/tracks/components/tracks-screen.test.tsx \
  src/app/dashboard/routes.test.tsx
```

Expected: FAIL because the action and route do not exist.

- [ ] **Step 7: Add the route modal and action composition**

Add to `dashboardPaths`:

```ts
trackImport: '/tracks/import',
```

Add modal metadata:

```ts
trackImport: {
  closeTo: dashboardPaths.tracks,
  description: 'Create tracks from a non-destructive CogniPace JSON import.',
  relativePath: 'import',
  staticData: {
    presentation: 'modal',
    section: 'tracks',
    title: 'Import Tracks',
  },
},
```

Compose the modal:

```tsx
export function ImportTracksModalPage() {
  const closeToTracks = useCloseToTracks()

  return (
    <RouteModal
      closeTo={dashboardModalRouteMeta.trackImport.closeTo}
      title="Import Tracks"
      variant="form"
    >
      <TrackImportForm onDone={closeToTracks} />
    </RouteModal>
  )
}
```

Register it as a child of `tracksRoute`. In `TracksPage`, create one
`trackActions` fragment containing an outline Upload action followed by the
primary New Track action:

```tsx
const trackActions = (
  <>
    <Button asChild size="sm" variant="outline">
      <Link to={dashboardPaths.trackImport}>
        <Upload aria-hidden="true" />
        Import Tracks
      </Link>
    </Button>
    <Button asChild size="sm">
      <Link to={dashboardPaths.trackNew}>
        <Plus aria-hidden="true" />
        New Track
      </Link>
    </Button>
  </>
)
```

Rename `newTrackAction` to `trackActions` through `TracksScreen`, empty state,
and `OtherTracksAccordion`, so the prop truthfully represents both actions.
Wrap the fragment in existing flex action containers rather than nesting
invalid interactive elements.

- [ ] **Step 8: Verify all UI tests pass**

```sh
npx vitest run \
  src/features/tracks/components/track-import-form.test.tsx \
  src/features/tracks/components/tracks-screen.test.tsx \
  src/app/dashboard/routes.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit Task 5**

```sh
git add src/features/tracks/components/track-import-form.tsx \
  src/features/tracks/components/track-import-form.test.tsx \
  src/features/tracks/components/tracks-screen.tsx \
  src/features/tracks/components/tracks-screen.test.tsx \
  src/features/tracks/components/other-tracks-accordion.tsx \
  src/features/tracks/index.ts \
  src/app/dashboard/navigation/route-manifest.ts \
  src/app/dashboard/navigation/routes.tsx \
  src/app/dashboard/screens/track-modal-pages.tsx \
  src/app/dashboard/screens/tracks-page.tsx \
  src/app/dashboard/routes.test.tsx
git commit -m "feat(tracks): add track import modal"
```

## Task 6: Ship The NeetCode Artifact And Authoring Documentation

**Files:**

- Create: `docs/track-import.md`
- Create: `track-imports/neetcode-150-and-250.json`
- Modify: `src/features/tracks/api/tracks-contracts.test.ts`
- Modify: `src/features/backup/components/selective-import-panel.tsx`
- Modify: `src/features/backup/components/data-management-screen.test.tsx`
- Modify: `README.md`
- Modify: `docs/product.md`
- Modify: `docs/architecture.md`
- Modify: `docs/testing.md`
- Modify: `design.md`

- [ ] **Step 1: Create the NeetCode JSON artifact from the legacy source**

Mechanically transform the legacy arrays from:

```text
/Users/tobiolutimehin/WebstormProjects/CogniPace/src/features/problems/data/seed/curatedSets.ts
```

Create `track-imports/neetcode-150-and-250.json` with:

- `schemaVersion: 1`
- `app: "cognipace-track-import"`
- one shared top-level problem definition per unique slug
- `difficulty: "unknown"` and `isPremium: false` where the legacy source has
  no richer metadata
- both named tracks and all legacy groups in source order
- each slug retained at its first group position within a track
- later duplicate memberships omitted because v2 enforces unique
  track/problem identity

Do not add problems absent from the legacy source just to make the marketing
names equal literal counts.

- [ ] **Step 2: Add a failing artifact contract test**

In `tracks-contracts.test.ts`, read the checked-in file and assert:

```ts
it('keeps the NeetCode example compatible with the public import contract', () => {
  const input = JSON.parse(
    readFileSync('track-imports/neetcode-150-and-250.json', 'utf8'),
  )
  const parsed = trackImportFileSchema.parse(input)
  const preview = createTrackImportPreview(parsed)

  expect(parsed.tracks.map((track) => track.title)).toEqual([
    'NeetCode 150',
    'NeetCode 250',
  ])
  expect(preview).toEqual({
    trackCount: 2,
    groupCount: 35,
    problemCount: 240,
  })
})
```

Also assert per-track unique membership counts after generating the actual
file, recording the exact legacy-derived values in the test.

- [ ] **Step 3: Run the artifact contract test and verify it passes only with a valid file**

```sh
npx vitest run src/features/tracks/api/tracks-contracts.test.ts
```

Expected: PASS with the generated artifact. Temporarily corrupt the envelope,
confirm the test fails for the expected reason, then restore it and confirm
PASS to prove the artifact test is meaningful.

- [ ] **Step 4: Write the durable authoring guide**

Create `docs/track-import.md` with:

- purpose and non-destructive guarantee
- Tracks → Import Tracks instructions
- complete envelope example
- a field table for `problems`, `tracks`, `groups`, and `problemSlugs`
- canonical slug guidance
- default problem metadata behavior
- all limits and duplicate rules
- existing-problem and existing-track conflict behavior
- result-count meanings
- a link to `../track-imports/neetcode-150-and-250.json`

- [ ] **Step 5: Align product and UI authority**

Update current docs and the Settings placeholder:

- `README.md`: add Track Import to project docs.
- `docs/product.md`: list non-destructive Tracks import as current behavior;
  keep future selective backup import for topics/companies/problems only.
- `docs/architecture.md`: document the runtime/service/repository flow and
  no-schema-change behavior.
- `docs/testing.md`: add valid import, conflict, and preservation smoke steps.
- `design.md`: specify Import Tracks as an outline peer to primary New Track
  and keep import details in a route modal.
- `selective-import-panel.tsx`: change planned areas to `Topics`, `Companies`,
  and `Problems`.
- `data-management-screen.test.tsx`: assert those remaining planned areas and
  that Tracks is absent.

- [ ] **Step 6: Run docs, artifact, and Settings tests**

```sh
npx vitest run \
  src/features/tracks/api/tracks-contracts.test.ts \
  src/features/backup/components/data-management-screen.test.tsx
npx prettier --check \
  README.md \
  docs/product.md \
  docs/architecture.md \
  docs/testing.md \
  design.md \
  docs/track-import.md \
  track-imports/neetcode-150-and-250.json
```

Expected: PASS.

- [ ] **Step 7: Commit Task 6**

```sh
git add README.md docs/product.md docs/architecture.md docs/testing.md \
  design.md docs/track-import.md \
  track-imports/neetcode-150-and-250.json \
  src/features/tracks/api/tracks-contracts.test.ts \
  src/features/backup/components/selective-import-panel.tsx \
  src/features/backup/components/data-management-screen.test.tsx
git commit -m "docs(tracks): publish track import format and NeetCode tracks"
```

## Task 7: Full Verification And Handoff Evidence

**Files:**

- Verify all files touched in Tasks 1-6.
- Do not create unrelated fixes for baseline tooling drift.

- [ ] **Step 1: Run the complete focused feature suite**

```sh
npx vitest run \
  src/features/tracks/api/tracks-contracts.test.ts \
  src/features/problems/data/problems-repository.test.ts \
  src/features/tracks/data/tracks-repository.test.ts \
  src/features/tracks/server/tracks-service.test.ts \
  src/features/tracks/api/tracks-api.test.tsx \
  src/features/tracks/components/track-import-form.test.tsx \
  src/features/tracks/components/tracks-screen.test.tsx \
  src/features/backup/components/data-management-screen.test.tsx \
  src/extension/background/runtime-policy.test.ts \
  src/extension/background/register-handlers.test.ts \
  src/app/dashboard/routes.test.tsx
```

Expected: PASS with zero failed files or tests.

- [ ] **Step 2: Run the full test suite**

```sh
npm run test
```

Expected: PASS. Record exact file/test counts and warnings.

- [ ] **Step 3: Run required lint/check/build commands independently**

```sh
npm run lint
npm run check
npm run build
```

Read every output and record exact results. Compare any lint/check failures to
the baseline evidence. Do not claim they are feature regressions or successes
without that comparison. Build must be attempted even if check remains blocked.

- [ ] **Step 4: Run formatting and repository hygiene checks**

```sh
npx prettier --check \
  README.md \
  docs/product.md \
  docs/architecture.md \
  docs/testing.md \
  design.md \
  docs/track-import.md \
  docs/superpowers/specs/2026-08-23-nondestructive-track-import-design.md \
  docs/superpowers/plans/2026-08-23-nondestructive-track-import.md \
  track-imports/neetcode-150-and-250.json
git diff --check
git status --short --branch
```

Expected: Prettier and diff checks pass; status contains only intended feature
work or is clean after commits.

- [ ] **Step 5: Prepare the required human smoke checklist**

Handoff these exact manual steps for the human engineer:

1. Build/load the extension and open Dashboard → Tracks.
2. Open Import Tracks and select the NeetCode JSON.
3. Capture the ready preview showing 2 tracks, 35 groups, and 240 unique
   referenced problems.
4. Import and capture the success summary.
5. Activate each imported track and verify group/problem order.
6. Re-import the same file, capture the named conflict, and verify no partial
   writes.
7. Confirm an existing problem's metadata, an existing practice history row,
   settings, active track, and an unrelated track stayed unchanged.

Screenshot or screen recording proof is required before PR review or merge.

- [ ] **Step 6: Review the implementation against every spec requirement**

Open
`docs/superpowers/specs/2026-08-23-nondestructive-track-import-design.md` and
verify each approved behavior, non-goal, conflict rule, runtime boundary,
documentation item, and recovery note has implementation or explicit handoff
evidence.

- [ ] **Step 7: Commit any final test/docs-only corrections**

If verification required corrections, commit only those corrections:

```sh
git add <exact corrected files>
git commit -m "test(tracks): verify non-destructive track imports"
```

If no corrections were needed, do not create an empty commit.

## Completion Criteria

- Track JSON import is discoverable from the Tracks screen.
- Existing problem metadata and all unrelated persisted state remain unchanged.
- Missing problems and every imported track are committed atomically.
- Duplicate track and membership conflicts fail before durable writes.
- The public JSON guide and checked-in NeetCode file parse through the same
  production contract used by the runtime.
- Focused and full validation evidence is reported exactly, including existing
  baseline command failures and required human visual/manual proof.
