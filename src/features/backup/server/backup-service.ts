import type { Db } from '@/platform/db'

import { normalizeTopicLookupKey } from '@/features/problems/domain/topic-taxonomy'

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

  return restoreValidatedBackupData(db, backup)
}

export async function restoreValidatedBackupData(
  db: Db,
  backup: BackupFile,
): Promise<BackupSummary> {
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
  const topicIdsByLookupKey = createTopicLookupMap(data.topics)
  uniqueValues(data.topicAliases, (row) => row.aliasKey, 'topic alias key')
  uniqueValues(
    data.topicRelations,
    (row) => `${row.parentTopicId}:${row.childTopicId}`,
    'topic relation',
  )
  const companyIds = uniqueValues(data.companies, (row) => row.id, 'company id')
  uniqueValues(data.companies, (row) => row.label, 'company label')
  const fsrsCardsById = new Map(
    data.practice.fsrsCards.map((card) => [card.id, card]),
  )
  const reviewAttemptsById = new Map(
    data.practice.reviewAttempts.map((attempt) => [attempt.id, attempt]),
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
  const reviewAttemptIds = uniqueValues(
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
    data.tracks.memberships,
    (row) => {
      const group = trackGroupsById.get(row.trackGroupId)

      return `${group?.trackId ?? 'missing'}\u0000${row.problemSlug}`
    },
    'track problem identity',
  )
  uniqueValues(
    data.tracks.progress,
    (row) => `${row.trackId}\u0000${row.problemSlug}`,
    'track progress identity',
  )
  uniqueValues(data.tracks.session, (row) => row.id, 'track session identity')

  const memberships = new Set(
    data.tracks.memberships.map((row) => {
      const group = trackGroupsById.get(row.trackGroupId)

      return `${group?.trackId ?? 'missing'}\u0000${row.problemSlug}`
    }),
  )

  for (const row of data.topicAliases) {
    requireReference(topicIds, row.topicId, 'topicAlias', 'topic')

    const collidingTopicId = topicIdsByLookupKey.get(row.aliasKey)

    if (collidingTopicId !== undefined && collidingTopicId !== row.topicId) {
      throw new Error(
        `Invalid backup: topic alias key ${row.aliasKey} collides with topic ${collidingTopicId}.`,
      )
    }
  }

  for (const row of data.topicRelations) {
    requireReference(
      topicIds,
      row.parentTopicId,
      'topicRelation',
      'parent topic',
    )
    requireReference(topicIds, row.childTopicId, 'topicRelation', 'child topic')

    if (row.parentTopicId === row.childTopicId) {
      throw new Error(
        `Invalid backup: topic ${row.parentTopicId} cannot be its own parent.`,
      )
    }
  }

  assertAcyclicTopicRelations(data.topicRelations)

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
    requireReference(trackIds, row.trackId, 'progress', 'track')
    requireReference(problemSlugs, row.problemSlug, 'progress', 'problem')
    requireReference(
      memberships,
      `${row.trackId}\u0000${row.problemSlug}`,
      'progress',
      'membership',
    )

    if (row.reviewAttemptId !== null) {
      requireReference(
        reviewAttemptIds,
        row.reviewAttemptId,
        'progress',
        'review attempt',
      )

      const attempt = reviewAttemptsById.get(row.reviewAttemptId)

      if (attempt !== undefined && attempt.problemSlug !== row.problemSlug) {
        throw new Error(
          `Invalid backup: progress ${row.problemSlug} references review attempt ${row.reviewAttemptId} for problem ${attempt.problemSlug}.`,
        )
      }
    }
  }

  if (data.tracks.session.length > 1) {
    throw new Error(
      'Invalid backup: expected at most one active track session.',
    )
  }

  for (const row of data.tracks.session) {
    if (row.id !== 'active') {
      throw new Error(`Invalid backup: unsupported track session id ${row.id}.`)
    }

    if (row.activeTrackId !== null) {
      requireReference(trackIds, row.activeTrackId, 'session', 'active track')
    }

    if (row.activeTrackId === null && row.activeGroupId !== null) {
      throw new Error(
        `Invalid backup: session ${row.id} cannot have an active group without an active track.`,
      )
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

function createTopicLookupMap(
  rows: readonly { id: string; label: string }[],
): Map<string, string> {
  const topicIdsByLookupKey = new Map<string, string>()

  for (const row of rows) {
    for (const key of [row.id, normalizeTopicLookupKey(row.label)]) {
      if (!topicIdsByLookupKey.has(key)) {
        topicIdsByLookupKey.set(key, row.id)
      }
    }
  }

  return topicIdsByLookupKey
}

function assertAcyclicTopicRelations(
  relations: readonly { parentTopicId: string; childTopicId: string }[],
) {
  const parentsByChild = new Map<string, string[]>()

  for (const relation of relations) {
    const parents = parentsByChild.get(relation.childTopicId) ?? []

    parents.push(relation.parentTopicId)
    parentsByChild.set(relation.childTopicId, parents)
  }

  const visiting = new Set<string>()
  const visited = new Set<string>()

  function visit(topicId: string) {
    if (visited.has(topicId)) {
      return
    }

    if (visiting.has(topicId)) {
      throw new Error(
        `Invalid backup: cyclic topic relation involving ${topicId}.`,
      )
    }

    visiting.add(topicId)

    for (const parentId of parentsByChild.get(topicId) ?? []) {
      visit(parentId)
    }

    visiting.delete(topicId)
    visited.add(topicId)
  }

  for (const topicId of parentsByChild.keys()) {
    visit(topicId)
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
