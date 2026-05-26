import { z } from 'zod'

import { secretStatusSchema } from '@/platform/secrets'

export const syncSurfaceSchema = z.enum([
  'popup',
  'dashboard',
  'content-script',
])

export const syncRequestSchema = z.strictObject({
  surface: syncSurfaceSchema,
})

export const syncGithubTokenRequestSchema = z.strictObject({
  surface: z.literal('dashboard'),
  token: z.string().trim().min(1),
})

export const syncGithubGistRequestSchema = z.strictObject({
  surface: z.literal('dashboard'),
  gistId: z.string().trim().min(1),
})

export const syncSetEnabledRequestSchema = z.strictObject({
  surface: z.literal('dashboard'),
  enabled: z.boolean(),
})

export const syncResolveConflictRequestSchema = z.strictObject({
  surface: z.literal('dashboard'),
  resolution: z.enum(['pull-remote', 'push-local']),
})

export const syncErrorSummarySchema = z.strictObject({
  kind: z.enum([
    'auth',
    'conflict',
    'gist-missing',
    'network',
    'rate-limit',
    'remote-invalid',
    'schema-unsupported',
    'unknown',
  ]),
  message: z.string(),
  occurredAt: z.iso.datetime(),
  retryable: z.boolean(),
})

export const syncConflictSummarySchema = z.strictObject({
  detectedAt: z.iso.datetime(),
  localDataUpdatedAt: z.iso.datetime().nullable(),
  remoteUpdatedAt: z.iso.datetime().nullable(),
  remoteVersion: z.string().nullable(),
})

export const syncStatusSchema = z.strictObject({
  enabled: z.boolean(),
  configured: z.boolean(),
  tokenConfigured: z.boolean(),
  tokenStatus: secretStatusSchema,
  gistId: z.string().nullable(),
  isSyncing: z.boolean(),
  lastSyncAt: z.iso.datetime().nullable(),
  lastSyncDirection: z.enum(['push', 'pull', 'no-change']).nullable(),
  lastError: syncErrorSummarySchema.nullable(),
  conflict: syncConflictSummarySchema.nullable(),
})

export const syncActionResultSchema = z.strictObject({
  status: syncStatusSchema,
  message: z.string(),
})

export type SyncRequest = z.infer<typeof syncRequestSchema>
export type SyncGithubTokenRequest = z.infer<
  typeof syncGithubTokenRequestSchema
>
export type SyncGithubGistRequest = z.infer<typeof syncGithubGistRequestSchema>
export type SyncSetEnabledRequest = z.infer<typeof syncSetEnabledRequestSchema>
export type SyncResolveConflictRequest = z.infer<
  typeof syncResolveConflictRequestSchema
>
export type SerializedSyncStatus = z.infer<typeof syncStatusSchema>
export type SyncActionResult = z.infer<typeof syncActionResultSchema>
