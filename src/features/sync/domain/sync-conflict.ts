import type { SyncConflictSummary } from './sync-status'

export function createSyncConflict(input: {
  detectedAt: Date
  localDataUpdatedAt: string | null
  remoteUpdatedAt: string | null
  remoteVersion: string | null
}): SyncConflictSummary {
  return {
    detectedAt: input.detectedAt.toISOString(),
    localDataUpdatedAt: input.localDataUpdatedAt,
    remoteUpdatedAt: input.remoteUpdatedAt,
    remoteVersion: input.remoteVersion,
  }
}
