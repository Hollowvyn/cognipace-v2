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

import {
  clearAndRestoreBackupData,
  createBackupRepository,
  resetLocalDataToFreshInstall,
} from './backup-repository'

const now = new Date('2026-05-25T12:00:00.000Z')
const timestamp = now.getTime()
const settingsValue = JSON.stringify({
  ...defaultUserSettings,
  practice: {
    ...defaultUserSettings.practice,
    dailyGoal: 5,
  },
})

describe('backup repository', () => {
  it('exports all durable local data categories after inserting custom state', async () => {
    const { db } = await createTestDb({ now })
    await insertCustomState(db)

    const backupData = await createBackupRepository(db).readBackupData()

    expect({
      problem: backupData.problems.some((row) => row.slug === 'custom-problem'),
      topic: backupData.topics.some((row) => row.id === 'custom-topic'),
      company: backupData.companies.some((row) => row.id === 'custom-company'),
      problemTopic: backupData.problemTopics.some(
        (row) => row.problemSlug === 'custom-problem',
      ),
      problemCompany: backupData.problemCompanies.some(
        (row) => row.problemSlug === 'custom-problem',
      ),
      practice: backupData.practice.problemPractice.length,
      card: backupData.practice.fsrsCards.length,
      attempt: backupData.practice.reviewAttempts.length,
      track: backupData.tracks.tracks.some((row) => row.id === 'custom-track'),
      group: backupData.tracks.groups.some((row) => row.id === 'custom-group'),
      membership: backupData.tracks.memberships.some(
        (row) => row.trackGroupId === 'custom-group',
      ),
      progress: backupData.tracks.progress.length,
      session: backupData.tracks.session.length,
      setting: backupData.settings.length,
    }).toMatchObject({
      problem: true,
      topic: true,
      company: true,
      problemTopic: true,
      problemCompany: true,
      practice: 1,
      card: 1,
      attempt: 1,
      track: true,
      group: true,
      membership: true,
      progress: 1,
      session: 1,
      setting: 1,
    })
    expect(backupData.problems).toContainEqual(
      expect.objectContaining({
        slug: 'custom-problem',
        createdAt: now.toISOString(),
      }),
    )
    expect(backupData.problemTopics).toContainEqual({
      problemSlug: 'custom-problem',
      topicId: 'custom-topic',
    })
    expect(backupData.practice.fsrsCards).toEqual([
      expect.objectContaining({
        id: 'card-custom',
        dueAt: new Date(timestamp + 86_400_000).toISOString(),
      }),
    ])
    expect(backupData.tracks.groups).toContainEqual(
      expect.objectContaining({ id: 'custom-group' }),
    )
    expect(backupData.tracks.memberships).toContainEqual({
      trackGroupId: 'custom-group',
      problemSlug: 'custom-problem',
      position: 1,
    })
    expect(backupData.tracks.session).toContainEqual(
      expect.objectContaining({ activeTrackId: 'custom-track' }),
    )
    expect(backupData.settings).toContainEqual(
      expect.objectContaining({ key: 'user-settings', value: settingsValue }),
    )
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

  it('resets to fresh install data, clears custom data, and clears settings', async () => {
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
    expect(await db.select().from(trackSession)).toEqual([
      expect.objectContaining({ id: 'active' }),
    ])
  })
})

type TestDb = Awaited<ReturnType<typeof createTestDb>>['db']

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
