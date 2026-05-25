import { useMutation, useQueryClient } from '@tanstack/react-query'

import { sendMessage } from '@/extension/messaging'
import {
  invalidateTaggedQueries,
  type CacheInvalidationTag,
} from '@/platform/query/cache-invalidation'

import type { BackupFile, BackupPayloadRequest } from './backup-contracts'

const broadBackupInvalidationTags = [
  'settings',
  'problems',
  'practice',
  'queue',
  'tracks',
  'app-shell',
] as const satisfies readonly CacheInvalidationTag[]

export function useExportFullBackup() {
  return useMutation({
    mutationFn: () =>
      sendMessage('backup.exportFullBackup', { surface: 'dashboard' }),
  })
}

export function useValidateFullBackup() {
  return useMutation({
    mutationFn: validateFullBackupViaRuntime,
  })
}

export function useRestoreFullBackup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: restoreFullBackupViaRuntime,
    onSuccess: () => {
      invalidateTaggedQueries(queryClient, broadBackupInvalidationTags)
    },
  })
}

export function useResetLocalData() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () =>
      sendMessage('backup.resetLocalData', { surface: 'dashboard' }),
    onSuccess: () => {
      invalidateTaggedQueries(queryClient, broadBackupInvalidationTags)
    },
  })
}

export function validateFullBackupViaRuntime(backup: unknown) {
  const request = {
    surface: 'dashboard',
    backup,
  } satisfies { surface: 'dashboard'; backup: unknown }

  return sendMessage(
    'backup.validateFullBackup',
    request as BackupPayloadRequest,
  )
}

export function restoreFullBackupViaRuntime(backup: unknown) {
  const request = {
    surface: 'dashboard',
    backup,
  } satisfies { surface: 'dashboard'; backup: unknown }

  return sendMessage(
    'backup.restoreFullBackup',
    request as BackupPayloadRequest,
  )
}

export function downloadBackupFile(
  backup: BackupFile,
  documentRef: Document = document,
) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json',
  })
  const objectUrl = URL.createObjectURL(blob)
  const link = documentRef.createElement('a')

  link.href = objectUrl
  link.download = `cognipace-backup-${backup.exportedAt.slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(objectUrl)
}
