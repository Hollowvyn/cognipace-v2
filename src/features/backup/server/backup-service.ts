import type { Db } from '@/platform/db'

import {
  backupFileSchema,
  backupSchemaVersion,
  createBackupSummary,
  parseBackupFileForCurrentApp,
  type BackupData,
  type BackupFile,
  type BackupSummary,
} from '../api/backup-contracts'
import {
  clearAndRestoreBackupData,
  createBackupRepository,
  resetLocalDataToFreshInstall,
} from '../data/backup-repository'

type ExportFullBackupOptions = {
  exportedAt?: Date
  appVersion?: string
  extensionVersion?: string
}

export async function exportFullBackup(
  db: Db,
  options: ExportFullBackupOptions = {},
): Promise<BackupFile> {
  const exportedAt = options.exportedAt ?? new Date()
  const appVersion = options.appVersion ?? '0.0.0'
  const source: BackupFile['source'] = { appVersion }

  if (options.extensionVersion !== undefined) {
    source.extensionVersion = options.extensionVersion
  }

  const data = await createBackupRepository(db).readBackupData()

  return backupFileSchema.parse({
    schemaVersion: backupSchemaVersion,
    app: 'cognipace',
    exportedAt: exportedAt.toISOString(),
    source,
    data,
  })
}

export function validateFullBackup(input: unknown): BackupSummary {
  const backup = parseBackupFileForCurrentApp(input)
  validateBackupReferences(backup.data)

  return createBackupSummary(backup)
}

export async function restoreFullBackup(
  db: Db,
  input: unknown,
): Promise<BackupSummary> {
  const backup = parseBackupFileForCurrentApp(input)
  validateBackupReferences(backup.data)
  const summary = createBackupSummary(backup)

  await clearAndRestoreBackupData(db, backup.data)

  return summary
}

export async function resetLocalData(db: Db, now = new Date()): Promise<null> {
  await resetLocalDataToFreshInstall(db, now)

  return null
}

function validateBackupReferences(data: BackupData) {
  const problemSlugs = uniqueValues(
    data.problems,
    (row) => row.slug,
    'problem slug',
  )
  const topicIds = uniqueValues(data.topics, (row) => row.id, 'topic id')
  uniqueValues(data.topics, (row) => row.label, 'topic label')
  const companyIds = uniqueValues(data.companies, (row) => row.id, 'company id')
  uniqueValues(data.companies, (row) => row.label, 'company label')
  const fsrsCardsById = new Map(
    data.practice.fsrsCards.map((card) => [card.id, card]),
  )
  const fsrsCardIds = uniqueValues(
    data.practice.fsrsCards,
    (row) => row.id,
    'FSRS card id',
  )
  uniqueValues(
    data.practice.fsrsCards,
    (row) => `${row.problemSlug}:${row.cardKind}`,
    'FSRS card problem/kind',
  )
  uniqueValues(
    data.practice.reviewAttempts,
    (row) => row.id,
    'review attempt id',
  )
  const trackIds = uniqueValues(data.tracks.tracks, (row) => row.id, 'track id')
  uniqueValues(data.tracks.tracks, (row) => row.slug, 'track slug')
  const trackGroupsById = new Map(
    data.tracks.groups.map((group) => [group.id, group]),
  )
  const trackGroupIds = uniqueValues(
    data.tracks.groups,
    (row) => row.id,
    'track group id',
  )
  uniqueValues(data.settings, (row) => row.key, 'settings key')

  uniqueValues(
    data.problemTopics,
    (row) => `${row.problemSlug}\u0000${row.topicId}`,
    'problem-topic identity',
  )
  uniqueValues(
    data.problemCompanies,
    (row) => `${row.problemSlug}\u0000${row.companyId}`,
    'problem-company identity',
  )
  uniqueValues(
    data.practice.problemPractice,
    (row) => row.problemSlug,
    'problem practice identity',
  )
  uniqueValues(
    data.tracks.memberships,
    (row) => `${row.trackGroupId}\u0000${row.problemSlug}`,
    'track membership identity',
  )
  uniqueValues(
    data.tracks.progress,
    (row) => `${row.trackGroupId}\u0000${row.problemSlug}`,
    'track progress identity',
  )
  uniqueValues(data.tracks.session, (row) => row.id, 'track session identity')

  const memberships = new Set(
    data.tracks.memberships.map(
      (row) => `${row.trackGroupId}\u0000${row.problemSlug}`,
    ),
  )

  for (const row of data.problemTopics) {
    requireReference(problemSlugs, row.problemSlug, 'problemTopic', 'problem')
    requireReference(topicIds, row.topicId, 'problemTopic', 'topic')
  }

  for (const row of data.problemCompanies) {
    requireReference(problemSlugs, row.problemSlug, 'problemCompany', 'problem')
    requireReference(companyIds, row.companyId, 'problemCompany', 'company')
  }

  for (const row of data.practice.problemPractice) {
    requireReference(
      problemSlugs,
      row.problemSlug,
      'problemPractice',
      'problem',
    )
  }

  for (const row of data.practice.fsrsCards) {
    requireReference(problemSlugs, row.problemSlug, 'fsrsCard', 'problem')
  }

  for (const row of data.practice.reviewAttempts) {
    requireReference(problemSlugs, row.problemSlug, 'reviewAttempt', 'problem')
    requireReference(fsrsCardIds, row.cardId, 'reviewAttempt', 'card')

    const card = fsrsCardsById.get(row.cardId)

    if (card !== undefined && card.problemSlug !== row.problemSlug) {
      throw new Error(
        `Invalid backup: reviewAttempt ${row.id} references card ${row.cardId} belongs to problem ${card.problemSlug}, not ${row.problemSlug}.`,
      )
    }
  }

  for (const row of data.tracks.groups) {
    requireReference(trackIds, row.trackId, 'trackGroup', 'track')
  }

  for (const row of data.tracks.memberships) {
    requireReference(trackGroupIds, row.trackGroupId, 'membership', 'group')
    requireReference(problemSlugs, row.problemSlug, 'membership', 'problem')
  }

  for (const row of data.tracks.progress) {
    requireReference(trackGroupIds, row.trackGroupId, 'progress', 'group')
    requireReference(problemSlugs, row.problemSlug, 'progress', 'problem')
    requireReference(
      memberships,
      `${row.trackGroupId}\u0000${row.problemSlug}`,
      'progress',
      'membership',
    )
  }

  for (const row of data.tracks.session) {
    if (row.activeTrackId !== null) {
      requireReference(trackIds, row.activeTrackId, 'session', 'active track')
    }

    if (row.activeGroupId !== null) {
      requireReference(
        trackGroupIds,
        row.activeGroupId,
        'session',
        'active group',
      )
    }

    if (row.activeTrackId !== null && row.activeGroupId !== null) {
      const activeGroup = trackGroupsById.get(row.activeGroupId)

      if (activeGroup?.trackId !== row.activeTrackId) {
        throw new Error(
          `Invalid backup: session ${row.id} active group ${row.activeGroupId} does not belong to active track ${row.activeTrackId}.`,
        )
      }
    }
  }
}

function uniqueValues<Row>(
  rows: readonly Row[],
  getValue: (row: Row) => string,
  label: string,
) {
  const values = new Set<string>()

  for (const row of rows) {
    const value = getValue(row)

    if (values.has(value)) {
      throw new Error(`Invalid backup: duplicate ${label} ${value}.`)
    }

    values.add(value)
  }

  return values
}

function requireReference(
  values: ReadonlySet<string>,
  value: string,
  rowLabel: string,
  referenceLabel: string,
) {
  if (!values.has(value)) {
    throw new Error(
      `Invalid backup: ${rowLabel} references missing ${referenceLabel} ${value}.`,
    )
  }
}
