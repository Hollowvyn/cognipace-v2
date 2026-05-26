import { z } from 'zod'

import { parseBackupFileForCurrentApp, type BackupFile } from '@/features/backup'
import { backupFileSchema } from '@/features/backup/api/backup-contracts'

export const syncEnvelopeVersion = 1

export const syncEnvelopeSchema = z.strictObject({
  syncEnvelopeVersion: z.literal(syncEnvelopeVersion),
  app: z.literal('cognipace'),
  exportedAt: z.iso.datetime(),
  dataUpdatedAt: z.iso.datetime(),
  backup: backupFileSchema,
})

export type SyncEnvelope = z.infer<typeof syncEnvelopeSchema>

const envelopePreflightSchema = z.object({
  syncEnvelopeVersion: z.number().int(),
  app: z.string(),
})

export function buildSyncEnvelope(input: {
  backup: BackupFile
  exportedAt?: Date | undefined
  dataUpdatedAt: string
}): SyncEnvelope {
  const exportedAt = input.exportedAt ?? new Date()

  return syncEnvelopeSchema.parse({
    syncEnvelopeVersion,
    app: 'cognipace',
    exportedAt: exportedAt.toISOString(),
    dataUpdatedAt: input.dataUpdatedAt,
    backup: input.backup,
  })
}

export function parseSyncEnvelopeForCurrentApp(input: unknown): SyncEnvelope {
  const envelope = envelopePreflightSchema.parse(input)

  if (envelope.app !== 'cognipace') {
    throw new Error('Selected Gist file is not a CogniPace sync file.')
  }

  if (envelope.syncEnvelopeVersion !== syncEnvelopeVersion) {
    throw new Error(
      `Unsupported sync envelope version ${envelope.syncEnvelopeVersion}.`,
    )
  }

  const parsed = syncEnvelopeSchema.parse(input)
  parseBackupFileForCurrentApp(parsed.backup)

  return parsed
}
