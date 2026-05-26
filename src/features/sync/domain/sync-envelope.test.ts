import { describe, expect, it } from 'vitest'

import { type BackupFile } from '@/features/backup'
import { backupSchemaVersion } from '@/features/backup/api/backup-contracts'

import {
  buildSyncEnvelope,
  parseSyncEnvelopeForCurrentApp,
  syncEnvelopeVersion,
} from './sync-envelope'

const backup: BackupFile = {
  schemaVersion: backupSchemaVersion,
  app: 'cognipace',
  exportedAt: '2026-05-26T12:00:00.000Z',
  source: { appVersion: '0.0.0' },
  data: {
    problems: [],
    topics: [],
    companies: [],
    problemTopics: [],
    problemCompanies: [],
    practice: {
      problemPractice: [],
      fsrsCards: [],
      reviewAttempts: [],
    },
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

describe('sync envelope', () => {
  it('wraps a CogniPace backup with sync metadata', () => {
    expect(
      buildSyncEnvelope({
        backup,
        exportedAt: new Date('2026-05-26T12:00:01.000Z'),
        dataUpdatedAt: '2026-05-26T12:00:00.000Z',
      }),
    ).toMatchObject({
      syncEnvelopeVersion,
      app: 'cognipace',
      exportedAt: '2026-05-26T12:00:01.000Z',
      dataUpdatedAt: '2026-05-26T12:00:00.000Z',
      backup,
    })
  })

  it('rejects future sync envelope versions before restore', () => {
    expect(() =>
      parseSyncEnvelopeForCurrentApp({
        syncEnvelopeVersion: syncEnvelopeVersion + 1,
        app: 'cognipace',
        exportedAt: '2026-05-26T12:00:00.000Z',
        dataUpdatedAt: '2026-05-26T12:00:00.000Z',
        backup,
      }),
    ).toThrow('Unsupported sync envelope version')
  })
})
