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
  topicAliases,
  topicRelations,
  topics,
  trackGroupProblems,
  trackGroups,
  trackProblemProgress,
  trackSession,
  tracks,
} from '@/platform/db/schema'

import { backupDataSchema, type BackupData } from '../api/backup-contracts'

export function createBackupRepository(db: Db) {
  return new BackupRepository(db)
}

export class BackupRepository {
  constructor(private readonly db: Db) {}

  async readBackupData(): Promise<BackupData> {
    const [
      problemRows,
      topicRows,
      topicAliasRows,
      topicRelationRows,
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
      this.db.select().from(topicAliases),
      this.db.select().from(topicRelations),
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

    return backupDataSchema.parse({
      problems: problemRows.map((row) => ({
        ...row,
        createdAt: toIso(row.createdAt),
        updatedAt: toIso(row.updatedAt),
      })),
      topics: topicRows.map((row) => ({
        ...row,
        createdAt: toIso(row.createdAt),
        updatedAt: toIso(row.updatedAt),
      })),
      topicAliases: topicAliasRows.map((row) => ({
        ...row,
        createdAt: toIso(row.createdAt),
        updatedAt: toIso(row.updatedAt),
      })),
      topicRelations: topicRelationRows.map((row) => ({
        ...row,
        createdAt: toIso(row.createdAt),
        updatedAt: toIso(row.updatedAt),
      })),
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
        memberships: membershipRows.map((row) => ({
          trackGroupId: row.trackGroupId,
          problemSlug: row.problemSlug,
          position: row.position,
        })),
        progress: progressRows.map((row) => ({
          trackId: row.trackId,
          problemSlug: row.problemSlug,
          reviewAttemptId: row.reviewAttemptId,
          completedAt: toIsoOrNull(row.completedAt),
          completedRating: row.completedRating,
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
    })
  }
}

export async function clearAndRestoreBackupData(
  db: Db,
  data: BackupData,
  now = new Date(),
) {
  const backupData = backupDataSchema.parse(data)

  await db.transaction(async (transactionDb) => {
    const tx = transactionDb as unknown as Db

    await clearAllTables(tx)
    await insertBackupData(tx, backupData)
    await seedInitialCatalog(tx, now)
  })
}

export async function resetLocalDataToFreshInstall(db: Db, now = new Date()) {
  await db.transaction(async (transactionDb) => {
    const tx = transactionDb as unknown as Db

    await clearAllTables(tx)
    await seedInitialCatalog(tx, now)
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
  await db.delete(topicRelations)
  await db.delete(topicAliases)
  await db.delete(problemCompanies)
  await db.delete(problems)
  await db.delete(topics)
  await db.delete(companies)
  await db.delete(settingsKv)
}

async function insertBackupData(db: Db, data: BackupData) {
  if (data.topics.length > 0) {
    await db.insert(topics).values(
      data.topics.map((row) => ({
        ...row,
        createdAt: toMillis(row.createdAt),
        updatedAt: toMillis(row.updatedAt),
      })),
    )
  }

  if (data.topicAliases.length > 0) {
    await db.insert(topicAliases).values(
      data.topicAliases.map((row) => ({
        ...row,
        createdAt: toMillis(row.createdAt),
        updatedAt: toMillis(row.updatedAt),
      })),
    )
  }

  if (data.topicRelations.length > 0) {
    await db.insert(topicRelations).values(
      data.topicRelations.map((row) => ({
        ...row,
        createdAt: toMillis(row.createdAt),
        updatedAt: toMillis(row.updatedAt),
      })),
    )
  }

  if (data.companies.length > 0) {
    await db.insert(companies).values(data.companies)
  }

  if (data.problems.length > 0) {
    await db.insert(problems).values(
      data.problems.map((row) => ({
        ...row,
        createdAt: toMillis(row.createdAt),
        updatedAt: toMillis(row.updatedAt),
      })),
    )
  }

  if (data.problemTopics.length > 0) {
    await db.insert(problemTopics).values(data.problemTopics)
  }

  if (data.problemCompanies.length > 0) {
    await db.insert(problemCompanies).values(data.problemCompanies)
  }

  if (data.tracks.tracks.length > 0) {
    await db.insert(tracks).values(
      data.tracks.tracks.map((row) => ({
        ...row,
        dueAt: toMillisOrNull(row.dueAt),
        createdAt: toMillis(row.createdAt),
        updatedAt: toMillis(row.updatedAt),
      })),
    )
  }

  if (data.tracks.groups.length > 0) {
    await db.insert(trackGroups).values(
      data.tracks.groups.map((row) => ({
        ...row,
        createdAt: toMillis(row.createdAt),
        updatedAt: toMillis(row.updatedAt),
      })),
    )
  }

  if (data.tracks.memberships.length > 0) {
    const trackIdByGroupId = new Map(
      data.tracks.groups.map((group) => [group.id, group.trackId]),
    )

    await db.insert(trackGroupProblems).values(
      data.tracks.memberships.map((row) => ({
        ...row,
        trackId: requireGroupTrackId(trackIdByGroupId, row.trackGroupId),
      })),
    )
  }

  if (data.tracks.session.length > 0) {
    await db.insert(trackSession).values(
      data.tracks.session.map((row) => ({
        ...row,
        startedAt: toMillis(row.startedAt),
        updatedAt: toMillis(row.updatedAt),
      })),
    )
  }

  if (data.practice.problemPractice.length > 0) {
    await db.insert(problemPractice).values(
      data.practice.problemPractice.map((row) => ({
        ...row,
        firstSeenAt: toMillis(row.firstSeenAt),
        lastSeenAt: toMillisOrNull(row.lastSeenAt),
        lastReviewedAt: toMillisOrNull(row.lastReviewedAt),
        createdAt: toMillis(row.createdAt),
        updatedAt: toMillis(row.updatedAt),
      })),
    )
  }

  if (data.practice.fsrsCards.length > 0) {
    await db.insert(fsrsCards).values(
      data.practice.fsrsCards.map((row) => ({
        ...row,
        dueAt: toMillis(row.dueAt),
        lastReviewAt: toMillisOrNull(row.lastReviewAt),
        createdAt: toMillis(row.createdAt),
        updatedAt: toMillis(row.updatedAt),
      })),
    )
  }

  if (data.practice.reviewAttempts.length > 0) {
    await db.insert(reviewAttempts).values(
      data.practice.reviewAttempts.map((row) => ({
        ...row,
        reviewedAt: toMillis(row.reviewedAt),
        createdAt: toMillis(row.createdAt),
        updatedAt: toMillis(row.updatedAt),
      })),
    )
  }

  if (data.tracks.progress.length > 0) {
    await db.insert(trackProblemProgress).values(
      data.tracks.progress.map((row) => ({
        trackId: row.trackId,
        problemSlug: row.problemSlug,
        reviewAttemptId: row.reviewAttemptId,
        completedAt: toMillisOrNull(row.completedAt),
        completedRating: row.completedRating,
        createdAt: toMillis(row.createdAt),
        updatedAt: toMillis(row.updatedAt),
      })),
    )
  }

  if (data.settings.length > 0) {
    await db.insert(settingsKv).values(
      data.settings.map((row) => ({
        ...row,
        updatedAt: toMillis(row.updatedAt),
      })),
    )
  }
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

function requireGroupTrackId(
  trackIdByGroupId: ReadonlyMap<string, string>,
  trackGroupId: string,
) {
  const trackId = trackIdByGroupId.get(trackGroupId)

  if (trackId === undefined) {
    throw new Error(
      `Invalid backup: membership references missing group ${trackGroupId}.`,
    )
  }

  return trackId
}
