# Backup Restore Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a safe, versioned, local-first Backup / Restore / Reset experience in Settings.

**Architecture:** Add `src/features/backup` as the feature owner. The dashboard UI calls backup API hooks, runtime handlers validate and authorize dashboard-only messages, and the background backup service performs trusted DB export, validation, full restore, and reset work. Restore and reset write through one DB transaction, flush the snapshot, and invalidate all affected query families.

**Tech Stack:** WXT Chrome MV3, React 19, TypeScript, TanStack Query, Zod, Drizzle SQLite proxy, Vitest, React Testing Library.

---

## Source Map

Create:

- `src/features/backup/api/backup-contracts.ts`: Zod backup file schemas, request/response schemas, summary helpers, and exported types.
- `src/features/backup/api/backup-contracts.test.ts`: backup contract and summary tests.
- `src/features/backup/api/backup-api.ts`: dashboard hooks and browser download helper.
- `src/features/backup/api/backup-api.test.tsx`: hook and download helper tests.
- `src/features/backup/components/data-management-screen.tsx`: feature-owned Settings section controller and composition.
- `src/features/backup/components/backup-restore-panel.tsx`: export/import/restore UI.
- `src/features/backup/components/selective-import-panel.tsx`: visible planned selective import section.
- `src/features/backup/components/reset-local-data-panel.tsx`: reset danger-zone UI and confirmation dialog.
- `src/features/backup/components/data-management-screen.test.tsx`: component behavior tests.
- `src/features/backup/data/backup-repository.ts`: table reads, table replacement writes, reset clears, date mapping.
- `src/features/backup/data/backup-repository.test.ts`: repository export, restore, and reset tests.
- `src/features/backup/server/backup-service.ts`: version support, cross-reference validation, export, validation summary, restore, reset.
- `src/features/backup/server/backup-service.test.ts`: service safety tests.
- `src/features/backup/index.ts`: public feature exports for app code.

Modify:

- `src/extension/messaging.ts`: add backup protocol contracts to `ProtocolMap`.
- `src/extension/background/runtime-policy.ts`: authorize backup methods dashboard-only.
- `src/extension/background/runtime-policy.test.ts`: assert dashboard-only access.
- `src/extension/background/register-handlers.ts`: register backup handlers.
- `src/extension/background/register-handlers.test.ts`: handler parse/authorize/flush/invalidate coverage.
- `src/features/settings/components/settings-screen.tsx`: render the data-management section after the settings form.
- `src/features/settings/components/settings-screen.test.tsx`: update Settings tests to expect the new section.
- `src/platform/query/cache-invalidation.ts`: no new tag expected; use existing broad tags.
- `docs/product.md`: move backup/reset from future work to current behavior after implementation.
- `docs/testing.md`: add manual backup, restore, and reset smoke flow after implementation.

Do not modify:

- Analytics files.
- Chrome manifest permissions.
- Existing track files unless a shared Settings/navigation issue requires it.

---

### Task 1: Backup Contracts

**Files:**

- Create: `src/features/backup/api/backup-contracts.test.ts`
- Create: `src/features/backup/api/backup-contracts.ts`
- Create: `src/features/backup/index.ts`

- [ ] **Step 1: Write failing contract tests**

Create `src/features/backup/api/backup-contracts.test.ts` with these tests:

```ts
import { describe, expect, it } from 'vitest'

import {
  backupFileSchema,
  backupSchemaVersion,
  createBackupSummary,
  parseBackupFileForCurrentApp,
} from './backup-contracts'

describe('backup contracts', () => {
  it('accepts a valid v1 CogniPace backup and creates counts', () => {
    const backup = createValidBackup()

    expect(backupFileSchema.parse(backup)).toEqual(backup)
    expect(createBackupSummary(backup)).toMatchObject({
      schemaVersion: backupSchemaVersion,
      exportedAt: '2026-05-25T12:00:00.000Z',
      counts: {
        problems: 1,
        topics: 1,
        companies: 1,
        problemTopics: 1,
        problemCompanies: 1,
        problemPractice: 1,
        fsrsCards: 1,
        reviewAttempts: 1,
        tracks: 1,
        trackGroups: 1,
        trackMemberships: 1,
        trackProgress: 1,
        trackSession: 1,
        settings: 1,
      },
    })
  })

  it('rejects mismatched app backups', () => {
    expect(() =>
      parseBackupFileForCurrentApp({
        ...createValidBackup(),
        app: 'other-app',
      }),
    ).toThrow(/not a CogniPace backup/i)
  })

  it('rejects unsupported older and future versions', () => {
    expect(() =>
      parseBackupFileForCurrentApp({
        ...createValidBackup(),
        schemaVersion: backupSchemaVersion - 2,
      }),
    ).toThrow(/unsupported backup version/i)

    expect(() =>
      parseBackupFileForCurrentApp({
        ...createValidBackup(),
        schemaVersion: backupSchemaVersion + 1,
      }),
    ).toThrow(/unsupported backup version/i)
  })

  it('rejects unknown fields in v1', () => {
    expect(() =>
      backupFileSchema.parse({
        ...createValidBackup(),
        unexpected: true,
      }),
    ).toThrow()
  })
})

function createValidBackup() {
  return {
    schemaVersion: backupSchemaVersion,
    app: 'cognipace',
    exportedAt: '2026-05-25T12:00:00.000Z',
    source: { appVersion: '0.0.0' },
    data: {
      problems: [
        {
          slug: 'two-sum',
          title: 'Two Sum',
          difficulty: 'easy',
          isPremium: false,
          createdAt: '2026-05-25T12:00:00.000Z',
          updatedAt: '2026-05-25T12:00:00.000Z',
        },
      ],
      topics: [{ id: 'array', label: 'Array' }],
      companies: [{ id: 'meta', label: 'Meta' }],
      problemTopics: [{ problemSlug: 'two-sum', topicId: 'array' }],
      problemCompanies: [{ problemSlug: 'two-sum', companyId: 'meta' }],
      practice: {
        problemPractice: [
          {
            problemSlug: 'two-sum',
            status: 'review',
            firstSeenAt: '2026-05-25T12:00:00.000Z',
            lastSeenAt: '2026-05-25T12:00:00.000Z',
            lastReviewedAt: '2026-05-25T12:00:00.000Z',
            lastRating: 'good',
            lastElapsedSeconds: 600,
            bestElapsedSeconds: 600,
            interviewPattern: 'hash-map',
            timeComplexity: 'O(n)',
            spaceComplexity: 'O(n)',
            languages: 'TypeScript',
            notes: 'review note',
            solvedCount: 1,
            attemptCount: 1,
            isSuspended: false,
            createdAt: '2026-05-25T12:00:00.000Z',
            updatedAt: '2026-05-25T12:00:00.000Z',
          },
        ],
        fsrsCards: [
          {
            id: 'card-1',
            problemSlug: 'two-sum',
            cardKind: 'default',
            dueAt: '2026-05-26T12:00:00.000Z',
            stability: 2.5,
            difficulty: 4.5,
            elapsedDays: 0,
            scheduledDays: 1,
            learningSteps: 0,
            reps: 1,
            lapses: 0,
            state: 'review',
            lastReviewAt: '2026-05-25T12:00:00.000Z',
            createdAt: '2026-05-25T12:00:00.000Z',
            updatedAt: '2026-05-25T12:00:00.000Z',
          },
        ],
        reviewAttempts: [
          {
            id: 'attempt-1',
            problemSlug: 'two-sum',
            cardId: 'card-1',
            rating: 'good',
            reviewMode: 'manual',
            reviewedAt: '2026-05-25T12:00:00.000Z',
            elapsedSeconds: 600,
            isCorrect: true,
            interviewPattern: 'hash-map',
            timeComplexity: 'O(n)',
            spaceComplexity: 'O(n)',
            languages: 'TypeScript',
            notes: 'review note',
            fsrsReviewLog: null,
            createdAt: '2026-05-25T12:00:00.000Z',
            updatedAt: '2026-05-25T12:00:00.000Z',
          },
        ],
      },
      tracks: {
        tracks: [
          {
            id: 'custom-track',
            slug: 'custom-track',
            title: 'Custom Track',
            description: 'A local track',
            dueAt: null,
            createdAt: '2026-05-25T12:00:00.000Z',
            updatedAt: '2026-05-25T12:00:00.000Z',
          },
        ],
        groups: [
          {
            id: 'custom-track:arrays',
            trackId: 'custom-track',
            title: 'Arrays',
            position: 1,
            createdAt: '2026-05-25T12:00:00.000Z',
            updatedAt: '2026-05-25T12:00:00.000Z',
          },
        ],
        memberships: [
          {
            trackGroupId: 'custom-track:arrays',
            problemSlug: 'two-sum',
            position: 1,
          },
        ],
        progress: [
          {
            trackGroupId: 'custom-track:arrays',
            problemSlug: 'two-sum',
            completedAt: '2026-05-25T12:00:00.000Z',
            completedRating: 'good',
            createdAt: '2026-05-25T12:00:00.000Z',
            updatedAt: '2026-05-25T12:00:00.000Z',
          },
        ],
        session: [
          {
            id: 'active',
            activeTrackId: 'custom-track',
            activeGroupId: 'custom-track:arrays',
            startedAt: '2026-05-25T12:00:00.000Z',
            updatedAt: '2026-05-25T12:00:00.000Z',
          },
        ],
      },
      settings: [
        {
          key: 'user-settings',
          value:
            '{"schemaVersion":1,"practice":{"dailyGoal":4,"mode":"studyPlan","problemFilters":{"skipPremium":false}},"review":{"targetRetention":0.9,"order":"dueFirst"},"assessment":{"requireSolveTime":false,"strictTiming":false,"timeTargetsMinutes":{"easy":20,"medium":35,"hard":50}},"overlay":{"autoDetectSolved":true},"reminders":{"daily":{"enabled":false,"time":"09:00"}}}',
          updatedAt: '2026-05-25T12:00:00.000Z',
        },
      ],
    },
  } as const
}
```

- [ ] **Step 2: Run the failing contract tests**

Run:

```bash
npm run test -- src/features/backup/api/backup-contracts.test.ts
```

Expected: fail because `src/features/backup/api/backup-contracts.ts` does not exist.

- [ ] **Step 3: Implement backup contracts**

Create `src/features/backup/api/backup-contracts.ts` with:

```ts
import { z } from 'zod'

import { reviewRatings } from '@/lib/fsrs'
import { fsrsCardStates } from '@/lib/fsrs'
import {
  problemDifficultySchema,
  problemSlugSchema,
} from '@/features/problems/api/problems-contracts'
import { reviewModes } from '@/features/practice/domain'
import { userSettingsSchema } from '@/features/settings/domain'
import {
  trackCompletedRatingSchema,
  trackGroupIdSchema,
  trackIdSchema,
} from '@/features/tracks/api/tracks-contracts'

export const backupSchemaVersion = 1
export const minimumSupportedBackupSchemaVersion = 1

const nullableIsoDateTimeSchema = z.iso.datetime().nullable()
const isoDateTimeSchema = z.iso.datetime()

const backupSurfaceSchema = z.literal('dashboard')

const nullableTextSchema = z.string().nullable()
const positiveIntNullableSchema = z.number().int().positive().nullable()

export const problemBackupRowSchema = z
  .object({
    slug: problemSlugSchema,
    title: z.string(),
    difficulty: problemDifficultySchema,
    isPremium: z.boolean(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict()

export const topicBackupRowSchema = z
  .object({ id: z.string().min(1), label: z.string().min(1) })
  .strict()

export const companyBackupRowSchema = z
  .object({ id: z.string().min(1), label: z.string().min(1) })
  .strict()

export const problemTopicBackupRowSchema = z
  .object({
    problemSlug: problemSlugSchema,
    topicId: z.string().min(1),
  })
  .strict()

export const problemCompanyBackupRowSchema = z
  .object({
    problemSlug: problemSlugSchema,
    companyId: z.string().min(1),
  })
  .strict()

export const problemPracticeBackupRowSchema = z
  .object({
    problemSlug: problemSlugSchema,
    status: z.string().min(1),
    firstSeenAt: isoDateTimeSchema,
    lastSeenAt: nullableIsoDateTimeSchema,
    lastReviewedAt: nullableIsoDateTimeSchema,
    lastRating: z.enum(reviewRatings).nullable(),
    lastElapsedSeconds: positiveIntNullableSchema,
    bestElapsedSeconds: positiveIntNullableSchema,
    interviewPattern: nullableTextSchema,
    timeComplexity: nullableTextSchema,
    spaceComplexity: nullableTextSchema,
    languages: nullableTextSchema,
    notes: nullableTextSchema,
    solvedCount: z.number().int().min(0),
    attemptCount: z.number().int().min(0),
    isSuspended: z.boolean(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict()

export const fsrsCardBackupRowSchema = z
  .object({
    id: z.string().min(1),
    problemSlug: problemSlugSchema,
    cardKind: z.string().min(1),
    dueAt: isoDateTimeSchema,
    stability: z.number(),
    difficulty: z.number(),
    elapsedDays: z.number().int().min(0),
    scheduledDays: z.number().int().min(0),
    learningSteps: z.number().int().min(0),
    reps: z.number().int().min(0),
    lapses: z.number().int().min(0),
    state: z.enum(fsrsCardStates),
    lastReviewAt: nullableIsoDateTimeSchema,
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict()

export const reviewAttemptBackupRowSchema = z
  .object({
    id: z.string().min(1),
    problemSlug: problemSlugSchema,
    cardId: z.string().min(1),
    rating: z.enum(reviewRatings),
    reviewMode: z.enum(reviewModes),
    reviewedAt: isoDateTimeSchema,
    elapsedSeconds: positiveIntNullableSchema,
    isCorrect: z.boolean().nullable(),
    interviewPattern: nullableTextSchema,
    timeComplexity: nullableTextSchema,
    spaceComplexity: nullableTextSchema,
    languages: nullableTextSchema,
    notes: nullableTextSchema,
    fsrsReviewLog: nullableTextSchema,
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict()

export const trackBackupRowSchema = z
  .object({
    id: trackIdSchema,
    slug: z.string().min(1),
    title: z.string().min(1),
    description: nullableTextSchema,
    dueAt: nullableIsoDateTimeSchema,
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict()

export const trackGroupBackupRowSchema = z
  .object({
    id: trackGroupIdSchema,
    trackId: trackIdSchema,
    title: z.string().min(1),
    position: z.number().int().min(1),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict()

export const trackGroupProblemBackupRowSchema = z
  .object({
    trackGroupId: trackGroupIdSchema,
    problemSlug: problemSlugSchema,
    position: z.number().int().min(1),
  })
  .strict()

export const trackProblemProgressBackupRowSchema = z
  .object({
    trackGroupId: trackGroupIdSchema,
    problemSlug: problemSlugSchema,
    completedAt: isoDateTimeSchema,
    completedRating: trackCompletedRatingSchema,
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict()

export const trackSessionBackupRowSchema = z
  .object({
    id: z.string().min(1),
    activeTrackId: trackIdSchema.nullable(),
    activeGroupId: trackGroupIdSchema.nullable(),
    startedAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict()

export const settingsKvBackupRowSchema = z
  .object({
    key: z.string().min(1),
    value: z.string().superRefine((value, context) => {
      try {
        const parsed = JSON.parse(value)
        if (!userSettingsSchema.safeParse(parsed).success) {
          context.addIssue({
            code: 'custom',
            message: 'settings value must be current user settings JSON',
          })
        }
      } catch {
        context.addIssue({
          code: 'custom',
          message: 'settings value must be valid JSON',
        })
      }
    }),
    updatedAt: isoDateTimeSchema,
  })
  .strict()

export const backupDataSchema = z
  .object({
    problems: z.array(problemBackupRowSchema),
    topics: z.array(topicBackupRowSchema),
    companies: z.array(companyBackupRowSchema),
    problemTopics: z.array(problemTopicBackupRowSchema),
    problemCompanies: z.array(problemCompanyBackupRowSchema),
    practice: z
      .object({
        problemPractice: z.array(problemPracticeBackupRowSchema),
        fsrsCards: z.array(fsrsCardBackupRowSchema),
        reviewAttempts: z.array(reviewAttemptBackupRowSchema),
      })
      .strict(),
    tracks: z
      .object({
        tracks: z.array(trackBackupRowSchema),
        groups: z.array(trackGroupBackupRowSchema),
        memberships: z.array(trackGroupProblemBackupRowSchema),
        progress: z.array(trackProblemProgressBackupRowSchema),
        session: z.array(trackSessionBackupRowSchema),
      })
      .strict(),
    settings: z.array(settingsKvBackupRowSchema),
  })
  .strict()

export const backupFileSchema = z
  .object({
    schemaVersion: z.number().int().positive(),
    app: z.literal('cognipace'),
    exportedAt: isoDateTimeSchema,
    source: z
      .object({
        appVersion: z.string().optional(),
        extensionVersion: z.string().optional(),
      })
      .strict(),
    data: backupDataSchema,
  })
  .strict()

export const backupRequestSchema = z.object({ surface: backupSurfaceSchema })

export const backupPayloadRequestSchema = z.object({
  surface: backupSurfaceSchema,
  backup: z.unknown(),
})

export const backupSummarySchema = z
  .object({
    schemaVersion: z.number().int().positive(),
    exportedAt: isoDateTimeSchema,
    source: z
      .object({
        appVersion: z.string().optional(),
        extensionVersion: z.string().optional(),
      })
      .strict(),
    counts: z
      .object({
        problems: z.number().int().min(0),
        topics: z.number().int().min(0),
        companies: z.number().int().min(0),
        problemTopics: z.number().int().min(0),
        problemCompanies: z.number().int().min(0),
        problemPractice: z.number().int().min(0),
        fsrsCards: z.number().int().min(0),
        reviewAttempts: z.number().int().min(0),
        tracks: z.number().int().min(0),
        trackGroups: z.number().int().min(0),
        trackMemberships: z.number().int().min(0),
        trackProgress: z.number().int().min(0),
        trackSession: z.number().int().min(0),
        settings: z.number().int().min(0),
      })
      .strict(),
  })
  .strict()

export type BackupFile = z.infer<typeof backupFileSchema>
export type BackupData = z.infer<typeof backupDataSchema>
export type BackupRequest = z.infer<typeof backupRequestSchema>
export type BackupPayloadRequest = z.infer<typeof backupPayloadRequestSchema>
export type BackupSummary = z.infer<typeof backupSummarySchema>

export function parseBackupFileForCurrentApp(input: unknown): BackupFile {
  const parsed = backupFileSchema.parse(input)

  if (parsed.app !== 'cognipace') {
    throw new Error('Selected file is not a CogniPace backup.')
  }

  if (
    parsed.schemaVersion > backupSchemaVersion ||
    parsed.schemaVersion < minimumSupportedBackupSchemaVersion
  ) {
    throw new Error(
      `Unsupported backup version: ${parsed.schemaVersion}. Supported versions are ${minimumSupportedBackupSchemaVersion}-${backupSchemaVersion}.`,
    )
  }

  return parsed
}

export function createBackupSummary(backup: BackupFile): BackupSummary {
  return backupSummarySchema.parse({
    schemaVersion: backup.schemaVersion,
    exportedAt: backup.exportedAt,
    source: backup.source,
    counts: {
      problems: backup.data.problems.length,
      topics: backup.data.topics.length,
      companies: backup.data.companies.length,
      problemTopics: backup.data.problemTopics.length,
      problemCompanies: backup.data.problemCompanies.length,
      problemPractice: backup.data.practice.problemPractice.length,
      fsrsCards: backup.data.practice.fsrsCards.length,
      reviewAttempts: backup.data.practice.reviewAttempts.length,
      tracks: backup.data.tracks.tracks.length,
      trackGroups: backup.data.tracks.groups.length,
      trackMemberships: backup.data.tracks.memberships.length,
      trackProgress: backup.data.tracks.progress.length,
      trackSession: backup.data.tracks.session.length,
      settings: backup.data.settings.length,
    },
  })
}
```

Create `src/features/backup/index.ts`:

```ts
export {
  backupFileSchema,
  backupPayloadRequestSchema,
  backupRequestSchema,
  backupSummarySchema,
  createBackupSummary,
  parseBackupFileForCurrentApp,
  type BackupFile,
  type BackupPayloadRequest,
  type BackupRequest,
  type BackupSummary,
} from './api/backup-contracts'
```

- [ ] **Step 4: Run contract tests**

Run:

```bash
npm run test -- src/features/backup/api/backup-contracts.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit contracts**

```bash
git add src/features/backup/api/backup-contracts.ts src/features/backup/api/backup-contracts.test.ts src/features/backup/index.ts
git commit -m "feat: add backup file contracts"
```

---

### Task 2: Backup Repository

**Files:**

- Create: `src/features/backup/data/backup-repository.test.ts`
- Create: `src/features/backup/data/backup-repository.ts`

- [ ] **Step 1: Write failing repository tests**

Create `src/features/backup/data/backup-repository.test.ts`:

```ts
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { createTestDb } from '@/platform/db/test-db'
import {
  companies,
  fsrsCards,
  problemCompanies,
  problemPractice,
  problems,
  problemTopics,
  reviewAttempts,
  settingsKv,
  topics,
  trackGroupProblems,
  trackGroups,
  trackProblemProgress,
  trackSession,
  tracks,
} from '@/platform/db/schema'

import {
  clearAndRestoreBackupData,
  createBackupRepository,
  resetLocalDataToFreshInstall,
} from './backup-repository'

const now = new Date('2026-05-25T12:00:00.000Z')

describe('backup repository', () => {
  it('exports all durable local data categories', async () => {
    const { db } = await createTestDb({ now })
    await insertCustomState(db)

    const backupData = await createBackupRepository(db).readBackupData()

    expect(
      backupData.problems.some((row) => row.slug === 'custom-problem'),
    ).toBe(true)
    expect(backupData.topics.some((row) => row.id === 'custom-topic')).toBe(
      true,
    )
    expect(
      backupData.companies.some((row) => row.id === 'custom-company'),
    ).toBe(true)
    expect(backupData.problemTopics).toContainEqual({
      problemSlug: 'custom-problem',
      topicId: 'custom-topic',
    })
    expect(backupData.problemCompanies).toContainEqual({
      problemSlug: 'custom-problem',
      companyId: 'custom-company',
    })
    expect(backupData.practice.problemPractice).toHaveLength(1)
    expect(backupData.practice.fsrsCards).toHaveLength(1)
    expect(backupData.practice.reviewAttempts).toHaveLength(1)
    expect(
      backupData.tracks.tracks.some((row) => row.id === 'custom-track'),
    ).toBe(true)
    expect(
      backupData.tracks.groups.some((row) => row.id === 'custom-group'),
    ).toBe(true)
    expect(backupData.tracks.memberships).toContainEqual({
      trackGroupId: 'custom-group',
      problemSlug: 'custom-problem',
      position: 1,
    })
    expect(backupData.tracks.progress).toHaveLength(1)
    expect(backupData.tracks.session.some((row) => row.id === 'active')).toBe(
      true,
    )
    expect(backupData.settings).toHaveLength(1)
  })

  it('replaces existing rows with backup rows and reseeds defaults', async () => {
    const { db } = await createTestDb({ now })
    await insertCustomState(db)
    const backupData = await createBackupRepository(db).readBackupData()

    await db.delete(reviewAttempts)
    await db.delete(fsrsCards)
    await db.delete(problemPractice)
    await db.delete(trackProblemProgress)
    await db.delete(trackGroupProblems)
    await db.delete(trackSession)
    await db.delete(trackGroups)
    await db.delete(tracks)
    await db.delete(problemTopics)
    await db.delete(problemCompanies)
    await db.delete(problems)
    await db.delete(topics)
    await db.delete(companies)
    await db.delete(settingsKv)

    await clearAndRestoreBackupData(db, backupData, now)

    expect(await db.select().from(reviewAttempts)).toHaveLength(1)
    expect(await db.select().from(settingsKv)).toHaveLength(1)
    expect(
      await db.select().from(problems).where(eq(problems.slug, 'two-sum')),
    ).toHaveLength(1)
    expect(
      await db
        .select()
        .from(problems)
        .where(eq(problems.slug, 'custom-problem')),
    ).toHaveLength(1)
  })

  it('resets to fresh install data and default settings', async () => {
    const { db } = await createTestDb({ now })
    await insertCustomState(db)

    await resetLocalDataToFreshInstall(db, now)

    expect(await db.select().from(settingsKv)).toHaveLength(0)
    expect(await db.select().from(reviewAttempts)).toHaveLength(0)
    expect(
      await db
        .select()
        .from(problems)
        .where(eq(problems.slug, 'custom-problem')),
    ).toHaveLength(0)
    expect(
      await db.select().from(problems).where(eq(problems.slug, 'two-sum')),
    ).toHaveLength(1)
  })
})

async function insertCustomState(
  db: Awaited<ReturnType<typeof createTestDb>>['db'],
) {
  const timestamp = now.getTime()

  await db.insert(topics).values({ id: 'custom-topic', label: 'Custom Topic' })
  await db
    .insert(companies)
    .values({ id: 'custom-company', label: 'Custom Company' })
  await db.insert(problems).values({
    slug: 'custom-problem',
    title: 'Custom Problem',
    difficulty: 'medium',
    isPremium: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  await db.insert(problemTopics).values({
    problemSlug: 'custom-problem',
    topicId: 'custom-topic',
  })
  await db.insert(problemCompanies).values({
    problemSlug: 'custom-problem',
    companyId: 'custom-company',
  })
  await db.insert(problemPractice).values({
    problemSlug: 'custom-problem',
    status: 'review',
    firstSeenAt: timestamp,
    lastSeenAt: timestamp,
    lastReviewedAt: timestamp,
    lastRating: 'good',
    lastElapsedSeconds: 600,
    bestElapsedSeconds: 600,
    interviewPattern: 'hash-map',
    timeComplexity: 'O(n)',
    spaceComplexity: 'O(n)',
    languages: 'TypeScript',
    notes: 'review note',
    solvedCount: 1,
    attemptCount: 1,
    isSuspended: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  await db.insert(fsrsCards).values({
    id: 'card-custom',
    problemSlug: 'custom-problem',
    cardKind: 'default',
    dueAt: timestamp + 86_400_000,
    stability: 2.5,
    difficulty: 4.5,
    elapsedDays: 0,
    scheduledDays: 1,
    learningSteps: 0,
    reps: 1,
    lapses: 0,
    state: 'review',
    lastReviewAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  await db.insert(reviewAttempts).values({
    id: 'attempt-custom',
    problemSlug: 'custom-problem',
    cardId: 'card-custom',
    rating: 'good',
    reviewMode: 'manual',
    reviewedAt: timestamp,
    elapsedSeconds: 600,
    isCorrect: true,
    interviewPattern: 'hash-map',
    timeComplexity: 'O(n)',
    spaceComplexity: 'O(n)',
    languages: 'TypeScript',
    notes: 'review note',
    fsrsReviewLog: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  await db.insert(tracks).values({
    id: 'custom-track',
    slug: 'custom-track',
    title: 'Custom Track',
    description: 'Track description',
    dueAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  await db.insert(trackGroups).values({
    id: 'custom-group',
    trackId: 'custom-track',
    title: 'Custom Group',
    position: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  await db.insert(trackGroupProblems).values({
    trackGroupId: 'custom-group',
    problemSlug: 'custom-problem',
    position: 1,
  })
  await db.insert(trackProblemProgress).values({
    trackGroupId: 'custom-group',
    problemSlug: 'custom-problem',
    completedAt: timestamp,
    completedRating: 'good',
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  await db.update(trackSession).set({
    activeTrackId: 'custom-track',
    activeGroupId: 'custom-group',
    updatedAt: timestamp,
  })
  await db.insert(settingsKv).values({
    key: 'user-settings',
    value:
      '{"schemaVersion":1,"practice":{"dailyGoal":5,"mode":"studyPlan","problemFilters":{"skipPremium":false}},"review":{"targetRetention":0.9,"order":"dueFirst"},"assessment":{"requireSolveTime":false,"strictTiming":false,"timeTargetsMinutes":{"easy":20,"medium":35,"hard":50}},"overlay":{"autoDetectSolved":true},"reminders":{"daily":{"enabled":false,"time":"09:00"}}}',
    updatedAt: timestamp,
  })
}
```

- [ ] **Step 2: Run the failing repository tests**

Run:

```bash
npm run test -- src/features/backup/data/backup-repository.test.ts
```

Expected: fail because `backup-repository.ts` does not exist.

- [ ] **Step 3: Implement repository reads and writes**

Create `src/features/backup/data/backup-repository.ts` with:

```ts
import type { Db } from '@/platform/db'
import { seedInitialCatalog } from '@/platform/db/seed'
import {
  companies,
  fsrsCards,
  problemCompanies,
  problemPractice,
  problems,
  problemTopics,
  reviewAttempts,
  settingsKv,
  topics,
  trackGroupProblems,
  trackGroups,
  trackProblemProgress,
  trackSession,
  tracks,
} from '@/platform/db/schema'

import type { BackupData } from '../api/backup-contracts'

export function createBackupRepository(db: Db) {
  return new BackupRepository(db)
}

export class BackupRepository {
  constructor(private readonly db: Db) {}

  async readBackupData(): Promise<BackupData> {
    const [
      problemRows,
      topicRows,
      companyRows,
      problemTopicRows,
      problemCompanyRows,
      practiceRows,
      cardRows,
      attemptRows,
      trackRows,
      groupRows,
      membershipRows,
      progressRows,
      sessionRows,
      settingsRows,
    ] = await Promise.all([
      this.db.select().from(problems),
      this.db.select().from(topics),
      this.db.select().from(companies),
      this.db.select().from(problemTopics),
      this.db.select().from(problemCompanies),
      this.db.select().from(problemPractice),
      this.db.select().from(fsrsCards),
      this.db.select().from(reviewAttempts),
      this.db.select().from(tracks),
      this.db.select().from(trackGroups),
      this.db.select().from(trackGroupProblems),
      this.db.select().from(trackProblemProgress),
      this.db.select().from(trackSession),
      this.db.select().from(settingsKv),
    ])

    return {
      problems: problemRows.map((row) => ({
        ...row,
        createdAt: toIso(row.createdAt),
        updatedAt: toIso(row.updatedAt),
      })),
      topics: topicRows,
      companies: companyRows,
      problemTopics: problemTopicRows,
      problemCompanies: problemCompanyRows,
      practice: {
        problemPractice: practiceRows.map((row) => ({
          ...row,
          firstSeenAt: toIso(row.firstSeenAt),
          lastSeenAt: toIsoOrNull(row.lastSeenAt),
          lastReviewedAt: toIsoOrNull(row.lastReviewedAt),
          createdAt: toIso(row.createdAt),
          updatedAt: toIso(row.updatedAt),
        })),
        fsrsCards: cardRows.map((row) => ({
          ...row,
          dueAt: toIso(row.dueAt),
          lastReviewAt: toIsoOrNull(row.lastReviewAt),
          createdAt: toIso(row.createdAt),
          updatedAt: toIso(row.updatedAt),
        })),
        reviewAttempts: attemptRows.map((row) => ({
          ...row,
          reviewedAt: toIso(row.reviewedAt),
          createdAt: toIso(row.createdAt),
          updatedAt: toIso(row.updatedAt),
        })),
      },
      tracks: {
        tracks: trackRows.map((row) => ({
          ...row,
          dueAt: toIsoOrNull(row.dueAt),
          createdAt: toIso(row.createdAt),
          updatedAt: toIso(row.updatedAt),
        })),
        groups: groupRows.map((row) => ({
          ...row,
          createdAt: toIso(row.createdAt),
          updatedAt: toIso(row.updatedAt),
        })),
        memberships: membershipRows,
        progress: progressRows.map((row) => ({
          ...row,
          completedAt: toIso(row.completedAt),
          createdAt: toIso(row.createdAt),
          updatedAt: toIso(row.updatedAt),
        })),
        session: sessionRows.map((row) => ({
          ...row,
          startedAt: toIso(row.startedAt),
          updatedAt: toIso(row.updatedAt),
        })),
      },
      settings: settingsRows.map((row) => ({
        ...row,
        updatedAt: toIso(row.updatedAt),
      })),
    }
  }
}

export async function clearAndRestoreBackupData(
  db: Db,
  data: BackupData,
  now = new Date(),
) {
  await db.transaction(async (transactionDb) => {
    await clearAllTables(transactionDb as unknown as Db)
    await insertBackupData(transactionDb as unknown as Db, data)
    await seedInitialCatalog(transactionDb as unknown as Db, now)
  })
}

export async function resetLocalDataToFreshInstall(db: Db, now = new Date()) {
  await db.transaction(async (transactionDb) => {
    await clearAllTables(transactionDb as unknown as Db)
    await seedInitialCatalog(transactionDb as unknown as Db, now)
  })
}

async function clearAllTables(db: Db) {
  await db.delete(reviewAttempts)
  await db.delete(fsrsCards)
  await db.delete(problemPractice)
  await db.delete(trackProblemProgress)
  await db.delete(trackGroupProblems)
  await db.delete(trackSession)
  await db.delete(trackGroups)
  await db.delete(tracks)
  await db.delete(problemTopics)
  await db.delete(problemCompanies)
  await db.delete(problems)
  await db.delete(topics)
  await db.delete(companies)
  await db.delete(settingsKv)
}

async function insertBackupData(db: Db, data: BackupData) {
  await insertIfAny(db, topics, data.topics)
  await insertIfAny(db, companies, data.companies)
  await insertIfAny(
    db,
    problems,
    data.problems.map((row) => ({
      ...row,
      createdAt: toMillis(row.createdAt),
      updatedAt: toMillis(row.updatedAt),
    })),
  )
  await insertIfAny(db, problemTopics, data.problemTopics)
  await insertIfAny(db, problemCompanies, data.problemCompanies)
  await insertIfAny(
    db,
    tracks,
    data.tracks.tracks.map((row) => ({
      ...row,
      dueAt: toMillisOrNull(row.dueAt),
      createdAt: toMillis(row.createdAt),
      updatedAt: toMillis(row.updatedAt),
    })),
  )
  await insertIfAny(
    db,
    trackGroups,
    data.tracks.groups.map((row) => ({
      ...row,
      createdAt: toMillis(row.createdAt),
      updatedAt: toMillis(row.updatedAt),
    })),
  )
  await insertIfAny(db, trackGroupProblems, data.tracks.memberships)
  await insertIfAny(
    db,
    trackProblemProgress,
    data.tracks.progress.map((row) => ({
      ...row,
      completedAt: toMillis(row.completedAt),
      createdAt: toMillis(row.createdAt),
      updatedAt: toMillis(row.updatedAt),
    })),
  )
  await insertIfAny(
    db,
    trackSession,
    data.tracks.session.map((row) => ({
      ...row,
      startedAt: toMillis(row.startedAt),
      updatedAt: toMillis(row.updatedAt),
    })),
  )
  await insertIfAny(
    db,
    problemPractice,
    data.practice.problemPractice.map((row) => ({
      ...row,
      firstSeenAt: toMillis(row.firstSeenAt),
      lastSeenAt: toMillisOrNull(row.lastSeenAt),
      lastReviewedAt: toMillisOrNull(row.lastReviewedAt),
      createdAt: toMillis(row.createdAt),
      updatedAt: toMillis(row.updatedAt),
    })),
  )
  await insertIfAny(
    db,
    fsrsCards,
    data.practice.fsrsCards.map((row) => ({
      ...row,
      dueAt: toMillis(row.dueAt),
      lastReviewAt: toMillisOrNull(row.lastReviewAt),
      createdAt: toMillis(row.createdAt),
      updatedAt: toMillis(row.updatedAt),
    })),
  )
  await insertIfAny(
    db,
    reviewAttempts,
    data.practice.reviewAttempts.map((row) => ({
      ...row,
      reviewedAt: toMillis(row.reviewedAt),
      createdAt: toMillis(row.createdAt),
      updatedAt: toMillis(row.updatedAt),
    })),
  )
  await insertIfAny(
    db,
    settingsKv,
    data.settings.map((row) => ({
      ...row,
      updatedAt: toMillis(row.updatedAt),
    })),
  )
}

async function insertIfAny<TTable, TRow>(
  db: Db,
  table: TTable,
  rows: readonly TRow[],
) {
  if (rows.length === 0) {
    return
  }

  await db.insert(table as never).values(rows as never)
}

function toIso(value: number) {
  return new Date(value).toISOString()
}

function toIsoOrNull(value: number | null) {
  return value === null ? null : toIso(value)
}

function toMillis(value: string) {
  return new Date(value).getTime()
}

function toMillisOrNull(value: string | null) {
  return value === null ? null : toMillis(value)
}
```

- [ ] **Step 4: Run repository tests**

Run:

```bash
npm run test -- src/features/backup/data/backup-repository.test.ts
```

Expected: pass. If TypeScript rejects the generic `insertIfAny`, replace it with explicit `if (rows.length) await db.insert(tableName).values(rows)` calls for each table.

- [ ] **Step 5: Commit repository**

```bash
git add src/features/backup/data/backup-repository.ts src/features/backup/data/backup-repository.test.ts
git commit -m "feat: add backup repository"
```

---

### Task 3: Backup Service

**Files:**

- Create: `src/features/backup/server/backup-service.test.ts`
- Create: `src/features/backup/server/backup-service.ts`
- Modify: `src/features/backup/index.ts`

- [ ] **Step 1: Write failing service tests**

Create `src/features/backup/server/backup-service.test.ts`:

```ts
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { createTestDb } from '@/platform/db/test-db'
import { problems } from '@/platform/db/schema'

import {
  exportFullBackup,
  resetLocalData,
  restoreFullBackup,
  validateFullBackup,
} from './backup-service'

describe('backup service', () => {
  it('exports a versioned CogniPace backup', async () => {
    const { db } = await createTestDb({
      now: new Date('2026-05-25T12:00:00.000Z'),
    })

    const backup = await exportFullBackup(db, {
      exportedAt: new Date('2026-05-25T12:30:00.000Z'),
      appVersion: '0.0.0',
    })

    expect(backup).toMatchObject({
      app: 'cognipace',
      schemaVersion: 1,
      exportedAt: '2026-05-25T12:30:00.000Z',
      source: { appVersion: '0.0.0' },
    })
    expect(backup.data.problems.length).toBeGreaterThan(0)
    expect(backup.data.tracks.tracks.length).toBeGreaterThan(0)
  })

  it('validates a backup and returns counts without writing', async () => {
    const { db } = await createTestDb()
    const backup = await exportFullBackup(db)
    const beforeRows = await db.select().from(problems)

    const summary = validateFullBackup(backup)
    const afterRows = await db.select().from(problems)

    expect(summary.counts.problems).toBe(beforeRows.length)
    expect(afterRows).toEqual(beforeRows)
  })

  it('rejects broken references before restore writes', async () => {
    const { db } = await createTestDb()
    const backup = await exportFullBackup(db)
    const brokenBackup = {
      ...backup,
      data: {
        ...backup.data,
        problemTopics: [
          ...backup.data.problemTopics,
          { problemSlug: 'missing-problem', topicId: 'array' },
        ],
      },
    }
    const beforeRows = await db.select().from(problems)

    await expect(restoreFullBackup(db, brokenBackup)).rejects.toThrow(
      /missing problem/i,
    )
    await expect(db.select().from(problems)).resolves.toEqual(beforeRows)
  })

  it('restores a backup over existing data', async () => {
    const { db } = await createTestDb()
    const backup = await exportFullBackup(db)

    await db.delete(problems).where(eq(problems.slug, 'two-sum'))
    await restoreFullBackup(db, backup)

    expect(
      await db.select().from(problems).where(eq(problems.slug, 'two-sum')),
    ).toHaveLength(1)
  })

  it('resets local data to seeded defaults', async () => {
    const { db } = await createTestDb()
    await db.delete(problems).where(eq(problems.slug, 'two-sum'))

    await resetLocalData(db, new Date('2026-05-25T12:00:00.000Z'))

    expect(
      await db.select().from(problems).where(eq(problems.slug, 'two-sum')),
    ).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run the failing service tests**

Run:

```bash
npm run test -- src/features/backup/server/backup-service.test.ts
```

Expected: fail because `backup-service.ts` does not exist.

- [ ] **Step 3: Implement service validation and use cases**

Create `src/features/backup/server/backup-service.ts`:

```ts
import type { Db } from '@/platform/db'

import {
  backupFileSchema,
  backupSchemaVersion,
  createBackupSummary,
  parseBackupFileForCurrentApp,
  type BackupFile,
  type BackupSummary,
} from '../api/backup-contracts'
import {
  clearAndRestoreBackupData,
  createBackupRepository,
  resetLocalDataToFreshInstall,
} from '../data/backup-repository'

export interface ExportFullBackupOptions {
  exportedAt?: Date
  appVersion?: string
  extensionVersion?: string
}

export async function exportFullBackup(
  db: Db,
  options: ExportFullBackupOptions = {},
): Promise<BackupFile> {
  const repository = createBackupRepository(db)
  const data = await repository.readBackupData()
  const source = {
    ...(options.appVersion ? { appVersion: options.appVersion } : {}),
    ...(options.extensionVersion
      ? { extensionVersion: options.extensionVersion }
      : {}),
  }

  return backupFileSchema.parse({
    schemaVersion: backupSchemaVersion,
    app: 'cognipace',
    exportedAt: (options.exportedAt ?? new Date()).toISOString(),
    source,
    data,
  })
}

export function validateFullBackup(input: unknown): BackupSummary {
  const backup = normalizeBackupForRestore(input)
  return createBackupSummary(backup)
}

export async function restoreFullBackup(db: Db, input: unknown) {
  const backup = normalizeBackupForRestore(input)
  validateBackupReferences(backup)
  await clearAndRestoreBackupData(db, backup.data)
  return createBackupSummary(backup)
}

export async function resetLocalData(db: Db, now = new Date()) {
  await resetLocalDataToFreshInstall(db, now)
  return null
}

function normalizeBackupForRestore(input: unknown): BackupFile {
  const backup = parseBackupFileForCurrentApp(input)
  validateBackupReferences(backup)
  return backup
}

function validateBackupReferences(backup: BackupFile) {
  const problemSlugs = new Set(backup.data.problems.map((row) => row.slug))
  const topicIds = new Set(backup.data.topics.map((row) => row.id))
  const companyIds = new Set(backup.data.companies.map((row) => row.id))
  const trackIds = new Set(backup.data.tracks.tracks.map((row) => row.id))
  const groupIds = new Set(backup.data.tracks.groups.map((row) => row.id))
  const cardIds = new Set(backup.data.practice.fsrsCards.map((row) => row.id))
  const memberships = new Set(
    backup.data.tracks.memberships.map(
      (row) => `${row.trackGroupId}:${row.problemSlug}`,
    ),
  )

  assertUnique(
    'problem slug',
    backup.data.problems.map((row) => row.slug),
  )
  assertUnique(
    'topic id',
    backup.data.topics.map((row) => row.id),
  )
  assertUnique(
    'company id',
    backup.data.companies.map((row) => row.id),
  )
  assertUnique(
    'track id',
    backup.data.tracks.tracks.map((row) => row.id),
  )
  assertUnique(
    'track group id',
    backup.data.tracks.groups.map((row) => row.id),
  )
  assertUnique(
    'FSRS card id',
    backup.data.practice.fsrsCards.map((row) => row.id),
  )

  for (const row of backup.data.problemTopics) {
    assertSetHas(problemSlugs, row.problemSlug, 'problem topic missing problem')
    assertSetHas(topicIds, row.topicId, 'problem topic missing topic')
  }
  for (const row of backup.data.problemCompanies) {
    assertSetHas(
      problemSlugs,
      row.problemSlug,
      'problem company missing problem',
    )
    assertSetHas(companyIds, row.companyId, 'problem company missing company')
  }
  for (const row of backup.data.practice.problemPractice) {
    assertSetHas(problemSlugs, row.problemSlug, 'practice row missing problem')
  }
  for (const row of backup.data.practice.fsrsCards) {
    assertSetHas(problemSlugs, row.problemSlug, 'FSRS card missing problem')
  }
  for (const row of backup.data.practice.reviewAttempts) {
    assertSetHas(
      problemSlugs,
      row.problemSlug,
      'review attempt missing problem',
    )
    assertSetHas(cardIds, row.cardId, 'review attempt missing card')
  }
  for (const row of backup.data.tracks.groups) {
    assertSetHas(trackIds, row.trackId, 'track group missing track')
  }
  for (const row of backup.data.tracks.memberships) {
    assertSetHas(groupIds, row.trackGroupId, 'track membership missing group')
    assertSetHas(
      problemSlugs,
      row.problemSlug,
      'track membership missing problem',
    )
  }
  for (const row of backup.data.tracks.progress) {
    assertSetHas(
      memberships,
      `${row.trackGroupId}:${row.problemSlug}`,
      'track progress missing membership',
    )
  }
  for (const row of backup.data.tracks.session) {
    if (row.activeTrackId) {
      assertSetHas(
        trackIds,
        row.activeTrackId,
        'track session missing active track',
      )
    }
    if (row.activeGroupId) {
      assertSetHas(
        groupIds,
        row.activeGroupId,
        'track session missing active group',
      )
    }
  }
}

function assertUnique(label: string, values: readonly string[]) {
  const seen = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) {
      throw new Error(`Invalid backup: duplicate ${label} "${value}".`)
    }
    seen.add(value)
  }
}

function assertSetHas(
  set: ReadonlySet<string>,
  value: string,
  message: string,
) {
  if (!set.has(value)) {
    throw new Error(`Invalid backup: ${message} "${value}".`)
  }
}
```

Modify `src/features/backup/index.ts`:

```ts
export { DataManagementScreen } from './components/data-management-screen'
export {
  downloadBackupFile,
  useExportFullBackup,
  useResetLocalData,
  useRestoreFullBackup,
  useValidateFullBackup,
} from './api/backup-api'
export {
  backupFileSchema,
  backupPayloadRequestSchema,
  backupRequestSchema,
  backupSummarySchema,
  createBackupSummary,
  parseBackupFileForCurrentApp,
  type BackupFile,
  type BackupPayloadRequest,
  type BackupRequest,
  type BackupSummary,
} from './api/backup-contracts'
```

The `DataManagementScreen` and API exports will fail until later tasks. Keep this index change in the later API/UI task if you want each task to typecheck independently.

- [ ] **Step 4: Run service and repository tests**

Run:

```bash
npm run test -- src/features/backup/data/backup-repository.test.ts src/features/backup/server/backup-service.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit service**

```bash
git add src/features/backup/server/backup-service.ts src/features/backup/server/backup-service.test.ts src/features/backup/index.ts
git commit -m "feat: add backup service"
```

---

### Task 4: Runtime Wiring

**Files:**

- Modify: `src/extension/messaging.ts`
- Modify: `src/extension/background/runtime-policy.ts`
- Modify: `src/extension/background/runtime-policy.test.ts`
- Modify: `src/extension/background/register-handlers.ts`
- Modify: `src/extension/background/register-handlers.test.ts`

- [ ] **Step 1: Write failing runtime policy tests**

Add to `src/extension/background/runtime-policy.test.ts`:

```ts
it('keeps backup and local reset methods dashboard-only', () => {
  for (const method of [
    'backup.exportFullBackup',
    'backup.validateFullBackup',
    'backup.restoreFullBackup',
    'backup.resetLocalData',
  ]) {
    expect(canCallExtensionMethod(method, 'dashboard')).toBe(true)
    expect(canCallExtensionMethod(method, 'popup')).toBe(false)
    expect(canCallExtensionMethod(method, 'content-script')).toBe(false)
  }
})
```

Run:

```bash
npm run test -- src/extension/background/runtime-policy.test.ts
```

Expected: fail because backup methods are not in the runtime policy.

- [ ] **Step 2: Add protocol map entries**

Modify `src/extension/messaging.ts` imports:

```ts
import type {
  BackupFile,
  BackupPayloadRequest,
  BackupRequest,
  BackupSummary,
} from '@/features/backup/api/backup-contracts'
export {
  backupFileSchema,
  backupPayloadRequestSchema,
  backupRequestSchema,
  backupSummarySchema,
} from '@/features/backup/api/backup-contracts'
```

Add to `ProtocolMap`:

```ts
  'backup.exportFullBackup'(request: BackupRequest): BackupFile
  'backup.validateFullBackup'(request: BackupPayloadRequest): BackupSummary
  'backup.restoreFullBackup'(request: BackupPayloadRequest): BackupSummary
  'backup.resetLocalData'(request: BackupRequest): null
```

- [ ] **Step 3: Add runtime policy entries**

Modify `methodSurfaceAccess` in `src/extension/background/runtime-policy.ts`:

```ts
  'backup.exportFullBackup': ['dashboard'],
  'backup.validateFullBackup': ['dashboard'],
  'backup.restoreFullBackup': ['dashboard'],
  'backup.resetLocalData': ['dashboard'],
```

Run:

```bash
npm run test -- src/extension/background/runtime-policy.test.ts
```

Expected: pass.

- [ ] **Step 4: Write failing handler tests**

In `src/extension/background/register-handlers.test.ts`, add mocks to `backgroundMocks`:

```ts
    backupExportFullBackup: vi.fn(),
    backupValidateFullBackup: vi.fn(),
    backupRestoreFullBackup: vi.fn(),
    backupResetLocalData: vi.fn(),
```

Add a mock:

```ts
vi.mock('@/features/backup/server/backup-service', () => ({
  exportFullBackup: backgroundMocks.backupExportFullBackup,
  validateFullBackup: backgroundMocks.backupValidateFullBackup,
  restoreFullBackup: backgroundMocks.backupRestoreFullBackup,
  resetLocalData: backgroundMocks.backupResetLocalData,
}))
```

Add `beforeEach` defaults:

```ts
backgroundMocks.backupExportFullBackup.mockResolvedValue(validBackup)
backgroundMocks.backupValidateFullBackup.mockReturnValue(validBackupSummary)
backgroundMocks.backupRestoreFullBackup.mockResolvedValue(validBackupSummary)
backgroundMocks.backupResetLocalData.mockResolvedValue(null)
```

Add tests:

```ts
it('registers backup export handling with dashboard policy', async () => {
  const response = await sendRuntimeMessage('backup.exportFullBackup', {
    surface: 'dashboard',
  })

  expectRuntimePolicy('backup.exportFullBackup', 'dashboard')
  expect(backgroundMocks.backupExportFullBackup).toHaveBeenCalledWith(
    backgroundMocks.db,
  )
  expect(response).toMatchObject({ app: 'cognipace' })
})

it('registers backup validation without flushing the snapshot', async () => {
  const response = await sendRuntimeMessage('backup.validateFullBackup', {
    surface: 'dashboard',
    backup: validBackup,
  })

  expectRuntimePolicy('backup.validateFullBackup', 'dashboard')
  expect(backgroundMocks.backupValidateFullBackup).toHaveBeenCalledWith(
    validBackup,
  )
  expect(backgroundMocks.flushDbSnapshot).not.toHaveBeenCalled()
  expect(response.counts.problems).toBe(validBackupSummary.counts.problems)
})

it('registers restore handling with snapshot flush and broad invalidation', async () => {
  await sendRuntimeMessage('backup.restoreFullBackup', {
    surface: 'dashboard',
    backup: validBackup,
  })

  expectRuntimePolicy('backup.restoreFullBackup', 'dashboard')
  expect(backgroundMocks.backupRestoreFullBackup).toHaveBeenCalledWith(
    backgroundMocks.db,
    validBackup,
  )
  expect(backgroundMocks.flushDbSnapshot).toHaveBeenCalled()
  expect(backgroundMocks.broadcastCacheInvalidation).toHaveBeenCalledWith({
    reason: 'problem-catalog-updated',
    source: 'dashboard',
    tags: ['settings', 'problems', 'practice', 'queue', 'tracks', 'app-shell'],
  })
})

it('registers local reset handling with snapshot flush and broad invalidation', async () => {
  const response = await sendRuntimeMessage('backup.resetLocalData', {
    surface: 'dashboard',
  })

  expect(response).toBeNull()
  expectRuntimePolicy('backup.resetLocalData', 'dashboard')
  expect(backgroundMocks.backupResetLocalData).toHaveBeenCalledWith(
    backgroundMocks.db,
  )
  expect(backgroundMocks.flushDbSnapshot).toHaveBeenCalled()
})
```

Define `validBackup` and `validBackupSummary` near other fixtures by reusing the contract test fixture shape.

- [ ] **Step 5: Implement handler registration**

Modify `src/extension/background/register-handlers.ts` imports:

```ts
  backupFileSchema,
  backupPayloadRequestSchema,
  backupRequestSchema,
  backupSummarySchema,
```

Import services:

```ts
import {
  exportFullBackup,
  resetLocalData,
  restoreFullBackup,
  validateFullBackup,
} from '@/features/backup/server/backup-service'
```

Add handlers inside `registerBackgroundHandlers()`:

```ts
onMessage('backup.exportFullBackup', ({ data, sender }) => {
  const request = backupRequestSchema.parse(data)

  assertCanSenderCallExtensionMethod(
    'backup.exportFullBackup',
    request.surface,
    sender,
  )
  return getAppDb().then(async ({ db }) =>
    backupFileSchema.parse(await exportFullBackup(db)),
  )
})

onMessage('backup.validateFullBackup', ({ data, sender }) => {
  const request = backupPayloadRequestSchema.parse(data)

  assertCanSenderCallExtensionMethod(
    'backup.validateFullBackup',
    request.surface,
    sender,
  )
  return backupSummarySchema.parse(validateFullBackup(request.backup))
})

onMessage('backup.restoreFullBackup', ({ data, sender }) => {
  const request = backupPayloadRequestSchema.parse(data)

  assertCanSenderCallExtensionMethod(
    'backup.restoreFullBackup',
    request.surface,
    sender,
  )
  return runDbMutation(
    async (db) =>
      backupSummarySchema.parse(await restoreFullBackup(db, request.backup)),
    () => broadcastDataManagementInvalidation(request.surface),
  )
})

onMessage('backup.resetLocalData', ({ data, sender }) => {
  const request = backupRequestSchema.parse(data)

  assertCanSenderCallExtensionMethod(
    'backup.resetLocalData',
    request.surface,
    sender,
  )
  return runDbMutation(
    async (db) => {
      await resetLocalData(db)
      return null
    },
    () => broadcastDataManagementInvalidation(request.surface),
  )
})
```

Add helper near invalidation helpers:

```ts
function broadcastDataManagementInvalidation(source: 'dashboard') {
  return broadcastCacheInvalidation({
    reason: 'problem-catalog-updated',
    source,
    tags: ['settings', 'problems', 'practice', 'queue', 'tracks', 'app-shell'],
  })
}
```

- [ ] **Step 6: Run runtime tests**

Run:

```bash
npm run test -- src/extension/background/runtime-policy.test.ts src/extension/background/register-handlers.test.ts
```

Expected: pass.

- [ ] **Step 7: Commit runtime wiring**

```bash
git add src/extension/messaging.ts src/extension/background/runtime-policy.ts src/extension/background/runtime-policy.test.ts src/extension/background/register-handlers.ts src/extension/background/register-handlers.test.ts
git commit -m "feat: wire backup runtime methods"
```

---

### Task 5: Backup API Hooks

**Files:**

- Create: `src/features/backup/api/backup-api.test.tsx`
- Create: `src/features/backup/api/backup-api.ts`
- Modify: `src/features/backup/index.ts`

- [ ] **Step 1: Write failing API tests**

Create `src/features/backup/api/backup-api.test.tsx`:

```tsx
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import { sendMessage } from '@/extension/messaging'
import { queryKeys } from '@/platform/query/query-keys'
import { createQueryTestHarness } from '@/testing/query-test-harness'

import {
  downloadBackupFile,
  useExportFullBackup,
  useResetLocalData,
  useRestoreFullBackup,
  useValidateFullBackup,
} from './backup-api'

vi.mock('@/extension/messaging', () => ({ sendMessage: vi.fn() }))

describe('backup API hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exports through the dashboard runtime surface', async () => {
    vi.mocked(sendMessage).mockResolvedValue(validBackup)
    const { wrapper } = createQueryTestHarness()
    const { result } = renderHook(() => useExportFullBackup(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync()
    })

    expect(sendMessage).toHaveBeenCalledWith('backup.exportFullBackup', {
      surface: 'dashboard',
    })
  })

  it('validates and restores selected backup payloads', async () => {
    vi.mocked(sendMessage).mockResolvedValue(validSummary)
    const { queryClient, wrapper } = createQueryTestHarness()
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')
    const validate = renderHook(() => useValidateFullBackup(), { wrapper })
    const restore = renderHook(() => useRestoreFullBackup(), { wrapper })

    await act(async () => {
      await validate.result.current.mutateAsync(validBackup)
      await restore.result.current.mutateAsync(validBackup)
    })

    expect(sendMessage).toHaveBeenCalledWith('backup.validateFullBackup', {
      surface: 'dashboard',
      backup: validBackup,
    })
    expect(sendMessage).toHaveBeenCalledWith('backup.restoreFullBackup', {
      surface: 'dashboard',
      backup: validBackup,
    })
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.settings.all,
    })
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.problems.all,
    })
  })

  it('resets local data and invalidates DB-backed query families', async () => {
    vi.mocked(sendMessage).mockResolvedValue(null)
    const { queryClient, wrapper } = createQueryTestHarness()
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useResetLocalData(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync()
    })

    expect(sendMessage).toHaveBeenCalledWith('backup.resetLocalData', {
      surface: 'dashboard',
    })
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.appShell.all,
    })
  })

  it('downloads backup JSON through an anchor without downloads permission', () => {
    const revokeObjectUrl = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined)
    const createObjectUrl = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:backup')
    const click = vi.fn()
    const anchor = {
      click,
      download: '',
      href: '',
    } as unknown as HTMLAnchorElement
    const documentRef = {
      createElement: vi.fn(() => anchor),
    } as unknown as Document

    downloadBackupFile(validBackup, documentRef)

    expect(documentRef.createElement).toHaveBeenCalledWith('a')
    expect(anchor.download).toMatch(/^cognipace-backup-/)
    expect(anchor.href).toBe('blob:backup')
    expect(click).toHaveBeenCalled()
    expect(createObjectUrl).toHaveBeenCalled()
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:backup')
  })
})

const validSummary = {
  schemaVersion: 1,
  exportedAt: '2026-05-25T12:00:00.000Z',
  source: {},
  counts: {
    problems: 0,
    topics: 0,
    companies: 0,
    problemTopics: 0,
    problemCompanies: 0,
    problemPractice: 0,
    fsrsCards: 0,
    reviewAttempts: 0,
    tracks: 0,
    trackGroups: 0,
    trackMemberships: 0,
    trackProgress: 0,
    trackSession: 0,
    settings: 0,
  },
}

const validBackup = {
  schemaVersion: 1,
  app: 'cognipace',
  exportedAt: '2026-05-25T12:00:00.000Z',
  source: {},
  data: {
    problems: [],
    topics: [],
    companies: [],
    problemTopics: [],
    problemCompanies: [],
    practice: { problemPractice: [], fsrsCards: [], reviewAttempts: [] },
    tracks: {
      tracks: [],
      groups: [],
      memberships: [],
      progress: [],
      session: [],
    },
    settings: [],
  },
}
```

- [ ] **Step 2: Run the failing API tests**

Run:

```bash
npm run test -- src/features/backup/api/backup-api.test.tsx
```

Expected: fail because `backup-api.ts` does not exist.

- [ ] **Step 3: Implement hooks and download helper**

Create `src/features/backup/api/backup-api.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { sendMessage } from '@/extension/messaging'
import { invalidateTaggedQueries } from '@/platform/query/cache-invalidation'

import type { BackupFile } from './backup-contracts'

const broadBackupInvalidationTags = [
  'settings',
  'problems',
  'practice',
  'queue',
  'tracks',
  'app-shell',
] as const

export function useExportFullBackup() {
  return useMutation({
    mutationFn: () =>
      sendMessage('backup.exportFullBackup', { surface: 'dashboard' }),
  })
}

export function useValidateFullBackup() {
  return useMutation({
    mutationFn: (backup: unknown) =>
      sendMessage('backup.validateFullBackup', {
        surface: 'dashboard',
        backup,
      }),
  })
}

export function useRestoreFullBackup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (backup: unknown) =>
      sendMessage('backup.restoreFullBackup', {
        surface: 'dashboard',
        backup,
      }),
    onSuccess: () => {
      invalidateTaggedQueries(queryClient, broadBackupInvalidationTags)
    },
  })
}

export function useResetLocalData() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () =>
      sendMessage('backup.resetLocalData', { surface: 'dashboard' }),
    onSuccess: () => {
      invalidateTaggedQueries(queryClient, broadBackupInvalidationTags)
    },
  })
}

export function downloadBackupFile(
  backup: BackupFile,
  documentRef: Document = document,
) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const link = documentRef.createElement('a')
  const exportedAt = backup.exportedAt.slice(0, 10)

  link.href = url
  link.download = `cognipace-backup-${exportedAt}.json`
  link.click()
  URL.revokeObjectURL(url)
}
```

Modify `src/features/backup/index.ts` to export API functions as shown in Task 3.

- [ ] **Step 4: Run API tests**

Run:

```bash
npm run test -- src/features/backup/api/backup-api.test.tsx
```

Expected: pass.

- [ ] **Step 5: Commit API hooks**

```bash
git add src/features/backup/api/backup-api.ts src/features/backup/api/backup-api.test.tsx src/features/backup/index.ts
git commit -m "feat: add backup dashboard api"
```

---

### Task 6: Settings Data Management UI

**Files:**

- Create: `src/features/backup/components/backup-restore-panel.tsx`
- Create: `src/features/backup/components/selective-import-panel.tsx`
- Create: `src/features/backup/components/reset-local-data-panel.tsx`
- Create: `src/features/backup/components/data-management-screen.tsx`
- Create: `src/features/backup/components/data-management-screen.test.tsx`
- Modify: `src/features/backup/index.ts`
- Modify: `src/features/settings/components/settings-screen.tsx`
- Modify: `src/features/settings/components/settings-screen.test.tsx`

- [ ] **Step 1: Write failing UI tests**

Create `src/features/backup/components/data-management-screen.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createQueryTestHarness } from '@/testing/query-test-harness'
import { sendMessage } from '@/extension/messaging'

import { DataManagementScreen } from './data-management-screen'

vi.mock('@/extension/messaging', () => ({ sendMessage: vi.fn() }))

describe('DataManagementScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:backup')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
  })

  it('exports a backup from the dashboard action', async () => {
    const user = userEvent.setup()
    vi.mocked(sendMessage).mockResolvedValue(validBackup)
    const { wrapper } = createQueryTestHarness()

    render(<DataManagementScreen />, { wrapper })
    await user.click(screen.getByRole('button', { name: 'Export backup' }))

    expect(sendMessage).toHaveBeenCalledWith('backup.exportFullBackup', {
      surface: 'dashboard',
    })
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Backup exported.',
    )
  })

  it('validates an import file and shows a restore summary', async () => {
    const user = userEvent.setup()
    vi.mocked(sendMessage).mockResolvedValue(validSummary)
    const { wrapper } = createQueryTestHarness()
    const file = new File([JSON.stringify(validBackup)], 'backup.json', {
      type: 'application/json',
    })

    render(<DataManagementScreen />, { wrapper })
    await user.upload(screen.getByLabelText('Import full backup'), file)

    expect(sendMessage).toHaveBeenCalledWith('backup.validateFullBackup', {
      surface: 'dashboard',
      backup: validBackup,
    })
    expect(await screen.findByText('Backup ready to restore')).toBeVisible()
    expect(screen.getByText('Problems: 1')).toBeVisible()
  })

  it('shows invalid JSON import failure without a runtime call', async () => {
    const user = userEvent.setup()
    const { wrapper } = createQueryTestHarness()
    const file = new File(['{'], 'broken.json', {
      type: 'application/json',
    })

    render(<DataManagementScreen />, { wrapper })
    await user.upload(screen.getByLabelText('Import full backup'), file)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid JSON backup file.',
    )
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('requires restore confirmation after validation', async () => {
    const user = userEvent.setup()
    vi.mocked(sendMessage).mockImplementation((method) => {
      if (method === 'backup.validateFullBackup')
        return Promise.resolve(validSummary)
      if (method === 'backup.restoreFullBackup')
        return Promise.resolve(validSummary)
      if (method === 'backup.exportFullBackup')
        return Promise.resolve(validBackup)
      return Promise.reject(new Error(`Unexpected ${method}`))
    })
    const { wrapper } = createQueryTestHarness()
    const file = new File([JSON.stringify(validBackup)], 'backup.json')

    render(<DataManagementScreen />, { wrapper })
    await user.upload(screen.getByLabelText('Import full backup'), file)
    await screen.findByText('Backup ready to restore')
    await user.click(
      screen.getByRole('button', { name: 'Restore full backup' }),
    )
    expect(
      screen.getByRole('dialog', { name: 'Restore full backup?' }),
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Confirm restore' }))

    expect(sendMessage).toHaveBeenCalledWith('backup.restoreFullBackup', {
      surface: 'dashboard',
      backup: validBackup,
    })
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Backup restored.',
    )
  })

  it('confirms and cancels local reset', async () => {
    const user = userEvent.setup()
    vi.mocked(sendMessage).mockResolvedValue(null)
    const { wrapper } = createQueryTestHarness()

    render(<DataManagementScreen />, { wrapper })
    await user.click(screen.getByRole('button', { name: 'Reset local data' }))
    expect(
      screen.getByRole('dialog', { name: 'Reset local data?' }),
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(
      screen.queryByRole('dialog', { name: 'Reset local data?' }),
    ).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Reset local data' }))
    await user.click(screen.getByRole('button', { name: 'Confirm reset' }))

    expect(sendMessage).toHaveBeenCalledWith('backup.resetLocalData', {
      surface: 'dashboard',
    })
  })
})

const validSummary = {
  schemaVersion: 1,
  exportedAt: '2026-05-25T12:00:00.000Z',
  source: {},
  counts: {
    problems: 1,
    topics: 1,
    companies: 1,
    problemTopics: 1,
    problemCompanies: 1,
    problemPractice: 1,
    fsrsCards: 1,
    reviewAttempts: 1,
    tracks: 1,
    trackGroups: 1,
    trackMemberships: 1,
    trackProgress: 1,
    trackSession: 1,
    settings: 1,
  },
}

const validBackup = {
  schemaVersion: 1,
  app: 'cognipace',
  exportedAt: '2026-05-25T12:00:00.000Z',
  source: {},
  data: {
    problems: [],
    topics: [],
    companies: [],
    problemTopics: [],
    problemCompanies: [],
    practice: { problemPractice: [], fsrsCards: [], reviewAttempts: [] },
    tracks: {
      tracks: [],
      groups: [],
      memberships: [],
      progress: [],
      session: [],
    },
    settings: [],
  },
}
```

- [ ] **Step 2: Run failing UI tests**

Run:

```bash
npm run test -- src/features/backup/components/data-management-screen.test.tsx
```

Expected: fail because UI files do not exist.

- [ ] **Step 3: Implement panel components**

Create `backup-restore-panel.tsx`, `selective-import-panel.tsx`, and `reset-local-data-panel.tsx` using existing primitives. Keep dialogs modeled after `src/features/tracks/components/track-confirmation-dialog.tsx` so focus behavior and visual language stay consistent.

Use these props:

```ts
// backup-restore-panel.tsx
export interface BackupRestorePanelProps {
  error: string | null
  fileName: string | null
  isExporting: boolean
  isRestoring: boolean
  isValidating: boolean
  onExport: () => void
  onFileSelected: (file: File | null) => void
  onOpenRestoreDialog: () => void
  summary: BackupSummary | null
}

// reset-local-data-panel.tsx
export interface ResetLocalDataPanelProps {
  error: string | null
  isExporting: boolean
  isResetting: boolean
  onExport: () => void
  onReset: () => void
}
```

In `selective-import-panel.tsx`, render visible planned copy:

```tsx
const plannedSections = ['Topics', 'Companies', 'Tracks', 'Problems'] as const
```

Use text labels exactly:

- `Export backup`
- `Import full backup`
- `Restore full backup`
- `Selective import`
- `Reset local data`
- `Export current backup`
- `Confirm restore`
- `Confirm reset`

- [ ] **Step 4: Implement `DataManagementScreen` controller**

Create `src/features/backup/components/data-management-screen.tsx`:

```tsx
import { useRef, useState } from 'react'

import { InlineStatus } from '@/components/ui/inline-status'
import { Surface } from '@/components/ui/surface'

import {
  downloadBackupFile,
  useExportFullBackup,
  useResetLocalData,
  useRestoreFullBackup,
  useValidateFullBackup,
} from '../api/backup-api'
import type { BackupSummary } from '../api/backup-contracts'
import { BackupRestorePanel } from './backup-restore-panel'
import { ResetLocalDataPanel } from './reset-local-data-panel'
import { SelectiveImportPanel } from './selective-import-panel'

type Feedback = { tone: 'success' | 'danger'; message: string } | null

export function DataManagementScreen() {
  const [selectedBackup, setSelectedBackup] = useState<unknown>(null)
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null)
  const [summary, setSummary] = useState<BackupSummary | null>(null)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const exportMutation = useExportFullBackup()
  const validateMutation = useValidateFullBackup()
  const restoreMutation = useRestoreFullBackup()
  const resetMutation = useResetLocalData()

  async function exportBackup() {
    setFeedback(null)
    try {
      const backup = await exportMutation.mutateAsync()
      downloadBackupFile(backup)
      setFeedback({ tone: 'success', message: 'Backup exported.' })
    } catch (error) {
      setFeedback({
        tone: 'danger',
        message: readErrorMessage(error, 'Failed to export backup.'),
      })
    }
  }

  async function validateFile(file: File | null) {
    setSelectedFileName(file?.name ?? null)
    setSelectedBackup(null)
    setSummary(null)
    setFeedback(null)

    if (!file) return

    let parsed: unknown
    try {
      parsed = JSON.parse(await file.text())
    } catch {
      setFeedback({ tone: 'danger', message: 'Invalid JSON backup file.' })
      return
    }

    try {
      const nextSummary = await validateMutation.mutateAsync(parsed)
      setSelectedBackup(parsed)
      setSummary(nextSummary)
    } catch (error) {
      setFeedback({
        tone: 'danger',
        message: readErrorMessage(error, 'Backup validation failed.'),
      })
    }
  }

  async function restoreBackup() {
    if (!selectedBackup) return
    setFeedback(null)
    try {
      await restoreMutation.mutateAsync(selectedBackup)
      setSummary(null)
      setSelectedBackup(null)
      setSelectedFileName(null)
      setFeedback({ tone: 'success', message: 'Backup restored.' })
    } catch (error) {
      setFeedback({
        tone: 'danger',
        message: readErrorMessage(error, 'Failed to restore backup.'),
      })
    }
  }

  async function resetLocalData() {
    setFeedback(null)
    try {
      await resetMutation.mutateAsync()
      setSummary(null)
      setSelectedBackup(null)
      setSelectedFileName(null)
      setFeedback({ tone: 'success', message: 'Local data reset.' })
    } catch (error) {
      setFeedback({
        tone: 'danger',
        message: readErrorMessage(error, 'Failed to reset local data.'),
      })
    }
  }

  return (
    <section
      className="grid gap-[var(--cp-surface-gap)]"
      aria-labelledby="data-management-title"
    >
      <div>
        <h3
          id="data-management-title"
          className="m-0 text-[length:var(--cp-title-font-size)] font-bold"
        >
          Data Management
        </h3>
      </div>
      {feedback ? (
        <InlineStatus
          role={feedback.tone === 'danger' ? 'alert' : 'status'}
          tone={feedback.tone}
        >
          {feedback.message}
        </InlineStatus>
      ) : null}
      <BackupRestorePanel
        error={
          validateMutation.error
            ? readErrorMessage(
                validateMutation.error,
                'Backup validation failed.',
              )
            : null
        }
        fileName={selectedFileName}
        isExporting={exportMutation.isPending}
        isRestoring={restoreMutation.isPending}
        isValidating={validateMutation.isPending}
        onExport={() => void exportBackup()}
        onFileSelected={(file) => void validateFile(file)}
        onOpenRestoreDialog={() => void restoreBackup()}
        summary={summary}
      />
      <SelectiveImportPanel />
      <ResetLocalDataPanel
        error={
          resetMutation.error
            ? readErrorMessage(
                resetMutation.error,
                'Failed to reset local data.',
              )
            : null
        }
        isExporting={exportMutation.isPending}
        isResetting={resetMutation.isPending}
        onExport={() => void exportBackup()}
        onReset={() => void resetLocalData()}
      />
    </section>
  )
}

function readErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}
```

Adjust this controller if dialog open state lives inside the panel components. The external behavior must match the tests.

- [ ] **Step 5: Integrate with Settings**

Modify `src/features/settings/components/settings-screen.tsx`:

```tsx
import { DataManagementScreen } from '@/features/backup'
```

Return a grid that contains the existing form and then data management:

```tsx
return (
  <div className="grid min-w-0 w-full max-w-[64rem] gap-[var(--cp-surface-gap)]">
    <form
      aria-label="Settings preferences"
      className="grid min-w-0 w-full gap-[var(--cp-surface-gap)]"
      onSubmit={handleSubmit}
    >
      {/* existing settings form contents */}
    </form>
    <DataManagementScreen />
  </div>
)
```

Update `src/features/settings/components/settings-screen.test.tsx`: replace the assertion that backup/import/global reset text is absent with:

```ts
expect(screen.getByRole('heading', { name: 'Data Management' })).toBeVisible()
expect(screen.getByRole('button', { name: 'Export backup' })).toBeVisible()
expect(screen.getByText('Selective import')).toBeVisible()
expect(screen.getByRole('button', { name: 'Reset local data' })).toBeVisible()
```

- [ ] **Step 6: Run UI tests**

Run:

```bash
npm run test -- src/features/backup/components/data-management-screen.test.tsx src/features/settings/components/settings-screen.test.tsx
```

Expected: pass.

- [ ] **Step 7: Commit UI**

```bash
git add src/features/backup/components src/features/backup/index.ts src/features/settings/components/settings-screen.tsx src/features/settings/components/settings-screen.test.tsx
git commit -m "feat: add settings data management ui"
```

---

### Task 7: Product And Testing Docs

**Files:**

- Modify: `docs/product.md`
- Modify: `docs/testing.md`

- [ ] **Step 1: Update product docs**

In `docs/product.md`, move backup/reset out of incomplete future work.

Change Current Status:

```md
- Settings
- Backup, restore, and reset local data from Settings
```

Change Dashboard behavior:

```md
- Settings manages persisted user preferences through a dirty-state form workflow.
- Data Management in Settings exports full local backups, validates and restores full backups, shows planned selective import sections, and performs explicit full local reset.
```

Change Future Candidates so it no longer lists backup/reset workflows as future. Keep selective imports as future:

```md
- selective import conflict policies for topics, companies, tracks, and problems
```

- [ ] **Step 2: Update testing docs**

In `docs/testing.md`, replace the current Backup/reset future bullet with a smoke flow:

```md
### Settings Data Management

1. Open the dashboard.
2. Navigate to Settings.
3. Use Export backup.
4. Confirm a JSON file downloads.
5. Choose Import full backup and select that exported file.
6. Confirm the validation summary appears.
7. Cancel before restore unless intentionally testing destructive restore.
8. Open Reset local data.
9. Cancel once, then reopen if intentionally testing reset.

Expected: backup validation happens before restore, restore and reset require confirmation, and reset offers backup first.
```

Update Reset Local Data guidance:

```md
Use Settings > Data Management > Reset local data for an in-app fresh-install reset. Removing and reloading the extension remains useful when testing extension installation behavior.
```

- [ ] **Step 3: Run docs formatting**

Run:

```bash
npx prettier --check docs/product.md docs/testing.md
```

Expected: pass.

- [ ] **Step 4: Commit docs**

```bash
git add docs/product.md docs/testing.md
git commit -m "docs: document backup restore reset flows"
```

---

### Task 8: Full Verification

**Files:**

- No new source files.

- [ ] **Step 1: Run focused backup tests**

Run:

```bash
npm run test -- src/features/backup/api/backup-contracts.test.ts src/features/backup/data/backup-repository.test.ts src/features/backup/server/backup-service.test.ts src/features/backup/api/backup-api.test.tsx src/features/backup/components/data-management-screen.test.tsx
```

Expected: pass.

- [ ] **Step 2: Run focused runtime and settings tests**

Run:

```bash
npm run test -- src/extension/background/runtime-policy.test.ts src/extension/background/register-handlers.test.ts src/features/settings/components/settings-screen.test.tsx
```

Expected: pass.

- [ ] **Step 3: Run full project check**

Run:

```bash
npm run check
```

Expected: pass.

- [ ] **Step 4: Run format check**

Run:

```bash
npm run format
```

Expected: pass.

- [ ] **Step 5: Confirm no DB migration is needed**

Run:

```bash
git status --short src/platform/db/schema src/platform/db/migrations
```

Expected: no output. If there is output, inspect why; this plan should not change DB schema.

- [ ] **Step 6: Final commit if verification fixes were needed**

If formatting or small verification fixes changed files:

```bash
git add <changed-files>
git commit -m "chore: finish backup restore reset verification"
```

If no files changed, do not create an empty commit.

---

## Self-Review Checklist

- Spec coverage: Tasks cover versioned JSON export, validation-before-write, full restore replacement, fresh-install reset, planned selective import, dashboard-only runtime authorization, cache invalidation, UI states, docs, and focused/full validation.
- Scope: No DB schema changes, no analytics work, no Chrome permission changes, no backend/sync/account behavior.
- Type consistency: Runtime methods use `backup.exportFullBackup`, `backup.validateFullBackup`, `backup.restoreFullBackup`, and `backup.resetLocalData` throughout the plan.
- Safety: Full restore rejects invalid data and broken references; reset and restore are transaction-backed and flush snapshots before invalidation.
