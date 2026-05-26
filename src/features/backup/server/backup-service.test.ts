import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { defaultUserSettings } from '@/features/settings/domain'
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
import { createTestDb } from '@/platform/db/test-db'

import { backupSchemaVersion, type BackupFile } from '../api/backup-contracts'
import {
  exportFullBackup,
  resetLocalData,
  restoreFullBackup,
  validateFullBackup,
} from './backup-service'

const now = new Date('2026-05-25T12:00:00.000Z')
const timestamp = now.getTime()
const settingsValue = JSON.stringify({
  ...defaultUserSettings,
  practice: {
    ...defaultUserSettings.practice,
    dailyGoal: 5,
  },
})

describe('backup service', () => {
  it('exports a versioned CogniPace backup including problems and tracks', async () => {
    const { db } = await createTestDb({ now })
    await insertCustomState(db)

    const backup = await exportFullBackup(db, {
      appVersion: '1.0.0',
      exportedAt: now,
      extensionVersion: '2.0.0',
    })

    expect(backup).toMatchObject({
      schemaVersion: backupSchemaVersion,
      app: 'cognipace',
      exportedAt: now.toISOString(),
      source: { appVersion: '1.0.0', extensionVersion: '2.0.0' },
    })
    expect(backup.data.problems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slug: 'custom-problem' }),
      ]),
    )
    expect(backup.data.tracks.tracks).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'custom-track' })]),
    )
  })

  it('validates a backup and returns counts without writing', async () => {
    const { db } = await createTestDb({ now })
    await insertCustomState(db)
    const backup = await exportFullBackup(db, { exportedAt: now })

    const summary = validateFullBackup(backup)

    expect(summary).toMatchObject({
      schemaVersion: backup.schemaVersion,
      exportedAt: backup.exportedAt,
      source: backup.source,
      counts: {
        problems: backup.data.problems.length,
        tracks: backup.data.tracks.tracks.length,
        settings: 1,
      },
    })
    expect(await rowsForProblem(db, 'custom-problem')).toHaveLength(1)
  })

  it('rejects mismatched app and unsupported backup versions', async () => {
    const { db } = await createTestDb({ now })
    const backup = await exportFullBackup(db, { exportedAt: now })

    expect(() => validateFullBackup({ ...backup, app: 'other-app' })).toThrow(
      /not a CogniPace backup/i,
    )
    expect(() =>
      validateFullBackup({ ...backup, schemaVersion: backupSchemaVersion + 1 }),
    ).toThrow(/unsupported backup version/i)
  })

  it('rejects broken references before restore writes and preserves existing rows', async () => {
    const { db } = await createTestDb({ now })
    await insertCustomState(db)
    const backup = await exportFullBackup(db, { exportedAt: now })
    const malformedBackup = {
      ...backup,
      data: {
        ...backup.data,
        problemTopics: [
          ...backup.data.problemTopics,
          { problemSlug: 'custom-problem', topicId: 'missing-topic' },
        ],
      },
    } satisfies BackupFile

    await expect(restoreFullBackup(db, malformedBackup)).rejects.toThrow(
      /missing topic/i,
    )

    expect(await rowsForProblem(db, 'custom-problem')).toHaveLength(1)
    expect(await db.select().from(settingsKv)).toEqual([
      {
        key: 'user-settings',
        value: settingsValue,
        updatedAt: timestamp,
      },
    ])
  })

  it('rejects review attempts that reference a card from another problem without writing', async () => {
    const { db } = await createTestDb({ now })
    await insertCustomState(db)
    const backup = await exportFullBackup(db, { exportedAt: now })
    const malformedBackup = {
      ...backup,
      data: {
        ...backup.data,
        practice: {
          ...backup.data.practice,
          fsrsCards: backup.data.practice.fsrsCards.map((card) =>
            card.id === 'card-custom'
              ? { ...card, problemSlug: 'two-sum' }
              : card,
          ),
        },
      },
    } satisfies BackupFile

    await expect(restoreFullBackup(db, malformedBackup)).rejects.toThrow(
      /card card-custom belongs to problem two-sum, not custom-problem/i,
    )

    expect(await rowsForProblem(db, 'custom-problem')).toHaveLength(1)
    expect(await db.select().from(reviewAttempts)).toEqual([
      expect.objectContaining({
        id: 'attempt-custom',
        problemSlug: 'custom-problem',
        cardId: 'card-custom',
      }),
    ])
  })

  it.each([
    {
      name: 'topic labels',
      makeBackup: (backup: BackupFile) =>
        ({
          ...backup,
          data: {
            ...backup.data,
            topics: [
              ...backup.data.topics,
              { id: 'custom-topic-copy', label: 'Custom Topic' },
            ],
          },
        }) satisfies BackupFile,
      message: /duplicate topic label Custom Topic/i,
    },
    {
      name: 'company labels',
      makeBackup: (backup: BackupFile) =>
        ({
          ...backup,
          data: {
            ...backup.data,
            companies: [
              ...backup.data.companies,
              { id: 'custom-company-copy', label: 'Custom Company' },
            ],
          },
        }) satisfies BackupFile,
      message: /duplicate company label Custom Company/i,
    },
    {
      name: 'FSRS card problem/kind identities',
      makeBackup: (backup: BackupFile) =>
        ({
          ...backup,
          data: {
            ...backup.data,
            practice: {
              ...backup.data.practice,
              fsrsCards: [
                ...backup.data.practice.fsrsCards,
                {
                  ...backup.data.practice.fsrsCards.find(
                    (card) => card.id === 'card-custom',
                  )!,
                  id: 'card-custom-copy',
                },
              ],
            },
          },
        }) satisfies BackupFile,
      message: /duplicate FSRS card problem\/kind custom-problem:default/i,
    },
  ] as const)(
    'rejects duplicate DB identity for $name without writing',
    async ({ makeBackup, message }) => {
      const { db } = await createTestDb({ now })
      await insertCustomState(db)
      const backup = await exportFullBackup(db, { exportedAt: now })

      expect(() => validateFullBackup(makeBackup(backup))).toThrow(message)
      expect(await rowsForProblem(db, 'custom-problem')).toHaveLength(1)
    },
  )

  it('restores a backup over existing data', async () => {
    const source = await createTestDb({ now })
    await insertCustomState(source.db)
    const backup = await exportFullBackup(source.db, { exportedAt: now })

    const target = await createTestDb({ now })
    await insertOtherState(target.db)

    const summary = await restoreFullBackup(target.db, backup)

    expect(summary).toMatchObject({
      counts: {
        problems: backup.data.problems.length,
        tracks: backup.data.tracks.tracks.length,
      },
    })
    expect(await rowsForProblem(target.db, 'other-problem')).toHaveLength(0)
    expect(await rowsForProblem(target.db, 'custom-problem')).toHaveLength(1)
    expect(
      await target.db
        .select()
        .from(tracks)
        .where(eq(tracks.id, 'custom-track')),
    ).toHaveLength(1)
  })

  it('resets local data to seeded defaults', async () => {
    const { db } = await createTestDb({ now })
    await insertCustomState(db)

    await expect(resetLocalData(db, now)).resolves.toBeNull()

    expect(await rowsForProblem(db, 'custom-problem')).toHaveLength(0)
    expect(
      await db.select().from(problems).where(eq(problems.slug, 'two-sum')),
    ).toHaveLength(1)
    expect(await db.select().from(settingsKv)).toHaveLength(0)
    expect(await db.select().from(trackSession)).toEqual([
      expect.objectContaining({ id: 'active' }),
    ])
  })
})

type TestDb = Awaited<ReturnType<typeof createTestDb>>['db']

async function rowsForProblem(db: TestDb, slug: string) {
  return db.select().from(problems).where(eq(problems.slug, slug))
}

async function insertCustomState(db: TestDb) {
  await db.insert(topics).values({ id: 'custom-topic', label: 'Custom Topic' })
  await db.insert(companies).values({
    id: 'custom-company',
    label: 'Custom Company',
  })
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
  await db
    .update(trackSession)
    .set({
      activeTrackId: 'custom-track',
      activeGroupId: 'custom-group',
      updatedAt: timestamp,
    })
    .where(eq(trackSession.id, 'active'))
  await db.insert(settingsKv).values({
    key: 'user-settings',
    value: settingsValue,
    updatedAt: timestamp,
  })
}

async function insertOtherState(db: TestDb) {
  await db.insert(problems).values({
    slug: 'other-problem',
    title: 'Other Problem',
    difficulty: 'easy',
    isPremium: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
}
