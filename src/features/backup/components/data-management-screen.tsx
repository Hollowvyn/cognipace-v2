import { useState } from 'react'

import {
  downloadBackupFile,
  useExportFullBackup,
  useResetLocalData,
  useRestoreFullBackup,
  useValidateFullBackup,
} from '../api/backup-api'
import type { BackupSummary } from '../api/backup-contracts'

import {
  BackupConfirmationDialog,
  BackupRestorePanel,
} from './backup-restore-panel'
import { ResetLocalDataPanel } from './reset-local-data-panel'
import { SelectiveImportPanel } from './selective-import-panel'

export function DataManagementScreen() {
  const exportBackup = useExportFullBackup()
  const validateBackup = useValidateFullBackup()
  const restoreBackup = useRestoreFullBackup()
  const resetLocalData = useResetLocalData()
  const [selectedBackup, setSelectedBackup] = useState<unknown>(null)
  const [backupSummary, setBackupSummary] = useState<BackupSummary | null>(null)
  const [backupStatus, setBackupStatus] = useState<string | null>(null)
  const [backupError, setBackupError] = useState<string | null>(null)
  const [resetStatus, setResetStatus] = useState<string | null>(null)
  const [resetError, setResetError] = useState<string | null>(null)
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)

  async function handleExport(scope: 'backup' | 'reset') {
    clearStatus(scope)

    try {
      const backup = await exportBackup.mutateAsync()
      downloadBackupFile(backup)
      setStatus(scope, 'Backup exported.')
    } catch (error) {
      setError(scope, readErrorMessage(error, 'Failed to export backup.'))
    }
  }

  async function handleFileSelect(file: File) {
    setSelectedBackup(null)
    setBackupSummary(null)
    setBackupStatus(null)
    setBackupError(null)

    let parsedBackup: unknown

    try {
      parsedBackup = JSON.parse(await readFileText(file))
    } catch {
      setBackupError('Invalid JSON backup file.')
      return
    }

    try {
      const summary = await validateBackup.mutateAsync(parsedBackup)
      setSelectedBackup(parsedBackup)
      setBackupSummary(summary)
      setBackupStatus('Backup ready to restore')
    } catch (error) {
      setBackupError(readErrorMessage(error, 'Backup validation failed.'))
    }
  }

  async function handleRestoreConfirm() {
    if (!selectedBackup) {
      return
    }

    setBackupError(null)

    try {
      const summary = await restoreBackup.mutateAsync(selectedBackup)
      setBackupSummary(summary)
      setBackupStatus('Backup restored.')
      setRestoreDialogOpen(false)
    } catch (error) {
      setBackupError(readErrorMessage(error, 'Failed to restore backup.'))
    }
  }

  async function handleResetConfirm() {
    setResetError(null)
    setResetStatus(null)

    try {
      await resetLocalData.mutateAsync()
      setResetStatus('Local data reset.')
      setResetDialogOpen(false)
    } catch (error) {
      setResetError(readErrorMessage(error, 'Failed to reset local data.'))
    }
  }

  function clearStatus(scope: 'backup' | 'reset') {
    setStatus(scope, null)
    setError(scope, null)
  }

  function setStatus(scope: 'backup' | 'reset', value: string | null) {
    if (scope === 'backup') {
      setBackupStatus(value)
      return
    }

    setResetStatus(value)
  }

  function setError(scope: 'backup' | 'reset', value: string | null) {
    if (scope === 'backup') {
      setBackupError(value)
      return
    }

    setResetError(value)
  }

  return (
    <section
      aria-labelledby="data-management-title"
      className="grid min-w-0 w-full max-w-[64rem] gap-[var(--cp-surface-gap)]"
    >
      <header className="grid gap-1">
        <h1
          className="m-0 text-[length:var(--cp-title-font-size)] font-bold leading-tight"
          id="data-management-title"
        >
          Data Management
        </h1>
        <p className="m-0 text-[length:var(--cp-copy-font-size)] text-muted-foreground">
          Backup, restore, or clear local study data.
        </p>
      </header>

      <BackupRestorePanel
        backup={selectedBackup}
        error={backupError}
        isExporting={exportBackup.isPending}
        isRestoring={restoreBackup.isPending}
        isValidating={validateBackup.isPending}
        onExport={() => {
          void handleExport('backup')
        }}
        onFileSelect={(file) => {
          void handleFileSelect(file)
        }}
        onOpenRestoreDialog={() => {
          setRestoreDialogOpen(true)
        }}
        status={backupStatus}
        summary={backupSummary}
      />
      <SelectiveImportPanel />
      <ResetLocalDataPanel
        error={resetError}
        isExporting={exportBackup.isPending}
        isResetting={resetLocalData.isPending}
        onExport={() => {
          void handleExport('reset')
        }}
        onOpenResetDialog={() => {
          setResetDialogOpen(true)
        }}
        status={resetStatus}
      />

      {restoreDialogOpen ? (
        <BackupConfirmationDialog
          confirmLabel="Confirm restore"
          description="This replaces current local CogniPace data with the selected backup."
          error={backupError}
          isPending={restoreBackup.isPending}
          onCancel={() => {
            if (!restoreBackup.isPending) {
              setRestoreDialogOpen(false)
            }
          }}
          onConfirm={() => {
            void handleRestoreConfirm()
          }}
          title="Restore full backup?"
        />
      ) : null}

      {resetDialogOpen ? (
        <BackupConfirmationDialog
          confirmLabel="Confirm reset"
          description="This clears local CogniPace data from this extension install."
          error={resetError}
          isPending={resetLocalData.isPending}
          onCancel={() => {
            if (!resetLocalData.isPending) {
              setResetDialogOpen(false)
            }
          }}
          onConfirm={() => {
            void handleResetConfirm()
          }}
          title="Reset local data?"
        />
      ) : null}
    </section>
  )
}

async function readFileText(file: File) {
  if ('text' in file && typeof file.text === 'function') {
    return file.text()
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }

      reject(new Error('Failed to read backup file.'))
    })
    reader.addEventListener('error', () => {
      reject(reader.error ?? new Error('Failed to read backup file.'))
    })
    reader.readAsText(file)
  })
}

function readErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}
