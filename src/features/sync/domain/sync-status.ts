import type { SecretStatus } from '@/platform/secrets/secret-contracts'

export type SyncDirection = 'no-change' | 'pull' | 'push'

export type SyncErrorKind =
  | 'auth'
  | 'conflict'
  | 'gist-missing'
  | 'network'
  | 'rate-limit'
  | 'remote-invalid'
  | 'schema-unsupported'
  | 'unknown'

export interface SyncErrorSummary {
  kind: SyncErrorKind
  message: string
  occurredAt: string
  retryable: boolean
}

export interface SyncStatus {
  enabled: boolean
  configured: boolean
  tokenConfigured: boolean
  tokenStatus: SecretStatus
  gistId: string | null
  isSyncing: boolean
  lastSyncAt: string | null
  lastSyncDirection: SyncDirection | null
  lastError: SyncErrorSummary | null
  conflict: SyncConflictSummary | null
}

export interface SyncConflictSummary {
  detectedAt: string
  localDataUpdatedAt: string | null
  remoteUpdatedAt: string | null
  remoteVersion: string | null
}
