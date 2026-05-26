import { syncActionResultSchema, syncStatusSchema } from './sync-contracts'
import type { SyncActionResult, SerializedSyncStatus } from './sync-contracts'

export function serializeSyncStatus(status: SerializedSyncStatus) {
  return syncStatusSchema.parse(status)
}

export function serializeSyncActionResult(result: SyncActionResult) {
  return syncActionResultSchema.parse(result)
}
