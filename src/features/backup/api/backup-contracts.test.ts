import { describe, expect, it } from 'vitest'

import { defaultUserSettings } from '@/features/settings/domain'

import {
  backupFileSchema,
  backupPayloadRequestSchema,
  backupSchemaVersion,
  createBackupSummary,
  parseBackupFileForCurrentApp,
} from './backup-contracts'

const timestamp = '2026-05-25T12:00:00.000Z'

function createValidBackupFixture() {
  return {
    schemaVersion: backupSchemaVersion,
    app: 'cognipace',
    exportedAt: timestamp,
    source: {
      appVersion: '0.0.0',
    },
    data: {
      problems: [
        {
          slug: 'two-sum',
          title: 'Two Sum',
          difficulty: 'easy',
          isPremium: false,
          createdAt: timestamp,
          updatedAt: timestamp,
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
          },
        ],
        fsrsCards: [
          {
            id: 'card-1',
            problemSlug: 'two-sum',
            cardKind: 'default',
            dueAt: timestamp,
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
          },
        ],
        reviewAttempts: [
          {
            id: 'attempt-1',
            problemSlug: 'two-sum',
            cardId: 'card-1',
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
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        ],
        groups: [
          {
            id: 'custom-track:arrays',
            trackId: 'custom-track',
            title: 'Arrays',
            position: 1,
            createdAt: timestamp,
            updatedAt: timestamp,
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
            completedAt: timestamp,
            completedRating: 'good',
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        ],
        session: [
          {
            id: 'active',
            activeTrackId: 'custom-track',
            activeGroupId: 'custom-track:arrays',
            startedAt: timestamp,
            updatedAt: timestamp,
          },
        ],
      },
      settings: [
        {
          key: 'user-settings',
          value: JSON.stringify(defaultUserSettings),
          updatedAt: timestamp,
        },
      ],
    },
  }
}

describe('backup contracts', () => {
  it('parses a valid v1 CogniPace backup and creates summary counts', () => {
    const backup = parseBackupFileForCurrentApp(createValidBackupFixture())

    expect(backup).toEqual(createValidBackupFixture())
    expect(createBackupSummary(backup)).toEqual({
      schemaVersion: backupSchemaVersion,
      exportedAt: timestamp,
      source: { appVersion: '0.0.0' },
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

  it('keeps runtime backup payloads loose for service-owned validation', () => {
    const unsupportedBackup = {
      ...createValidBackupFixture(),
      schemaVersion: backupSchemaVersion + 1,
      app: 'other-app',
    }

    expect(
      backupPayloadRequestSchema.parse({
        surface: 'dashboard',
        backup: unsupportedBackup,
      }).backup,
    ).toEqual(unsupportedBackup)
  })

  it('accepts optional app and extension source versions', () => {
    expect(
      backupFileSchema.parse({
        ...createValidBackupFixture(),
        source: { extensionVersion: '1.2.3' },
      }).source,
    ).toEqual({ extensionVersion: '1.2.3' })

    expect(
      backupFileSchema.parse({
        ...createValidBackupFixture(),
        source: {},
      }).source,
    ).toEqual({})
  })

  it('rejects a backup for another app with a friendly error', () => {
    expect(() =>
      parseBackupFileForCurrentApp({
        ...createValidBackupFixture(),
        app: 'other-app',
      }),
    ).toThrow(/not a CogniPace backup/i)
  })

  it('rejects unsupported older and future backup versions', () => {
    expect(() =>
      parseBackupFileForCurrentApp({
        ...createValidBackupFixture(),
        schemaVersion: 0,
      }),
    ).toThrow(/unsupported backup version/i)

    expect(() =>
      parseBackupFileForCurrentApp({
        ...createValidBackupFixture(),
        schemaVersion: backupSchemaVersion + 1,
      }),
    ).toThrow(/unsupported backup version/i)
  })

  it('rejects unknown fields in v1 backups', () => {
    expect(() =>
      backupFileSchema.parse({
        ...createValidBackupFixture(),
        data: {
          ...createValidBackupFixture().data,
          problems: [
            {
              ...createValidBackupFixture().data.problems[0],
              unknownField: true,
            },
          ],
        },
      }),
    ).toThrow()
  })

  it.each([
    [
      'topic id',
      (backup: ReturnType<typeof createValidBackupFixture>) => {
        backup.data.topics[0]!.id = ' '
      },
    ],
    [
      'company id',
      (backup: ReturnType<typeof createValidBackupFixture>) => {
        backup.data.companies[0]!.id = ' '
      },
    ],
    [
      'problem topic id',
      (backup: ReturnType<typeof createValidBackupFixture>) => {
        backup.data.problemTopics[0]!.topicId = ' '
      },
    ],
    [
      'problem company id',
      (backup: ReturnType<typeof createValidBackupFixture>) => {
        backup.data.problemCompanies[0]!.companyId = ' '
      },
    ],
    [
      'FSRS card id',
      (backup: ReturnType<typeof createValidBackupFixture>) => {
        backup.data.practice.fsrsCards[0]!.id = ' '
      },
    ],
    [
      'FSRS card kind',
      (backup: ReturnType<typeof createValidBackupFixture>) => {
        backup.data.practice.fsrsCards[0]!.cardKind = ' '
      },
    ],
    [
      'review attempt id',
      (backup: ReturnType<typeof createValidBackupFixture>) => {
        backup.data.practice.reviewAttempts[0]!.id = ' '
      },
    ],
    [
      'review attempt card id',
      (backup: ReturnType<typeof createValidBackupFixture>) => {
        backup.data.practice.reviewAttempts[0]!.cardId = ' '
      },
    ],
    [
      'track session id',
      (backup: ReturnType<typeof createValidBackupFixture>) => {
        backup.data.tracks.session[0]!.id = ' '
      },
    ],
  ])('rejects empty durable ID for %s', (_field, mutateBackup) => {
    const backup = createValidBackupFixture()

    mutateBackup(backup)

    expect(() => backupFileSchema.parse(backup)).toThrow()
  })

  it.each(['elapsedDays', 'scheduledDays', 'learningSteps'] as const)(
    'rejects negative FSRS %s',
    (field) => {
      const backup = createValidBackupFixture()

      backup.data.practice.fsrsCards[0]![field] = -1

      expect(() => backupFileSchema.parse(backup)).toThrow()
    },
  )
})
