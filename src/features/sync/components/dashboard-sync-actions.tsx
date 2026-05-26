import { CloudDownload, CloudUpload } from 'lucide-react'
import { useState } from 'react'

import { IconButton } from '@/components/ui/icon-button'
import { readErrorMessage } from '@/utils/errors'

import { usePullLatest, usePushLocal, useSyncStatus } from '../api/sync-api'
import type { SerializedSyncStatus, SyncActionResult } from '../api/sync-contracts'

type DashboardSyncActionResult =
  | Promise<SyncActionResult | null | undefined | void>
  | SyncActionResult
  | null
  | undefined
  | void

interface DashboardSyncActionsViewProps {
  isPending: boolean
  onPullLatest: () => DashboardSyncActionResult
  onPushLocal: (options: {
    confirmRemoteOverwrite: false
  }) => DashboardSyncActionResult
  status: SerializedSyncStatus | null | undefined
}

type Feedback = {
  message: string
  tone: 'alert' | 'status'
}

export function DashboardSyncActions() {
  const status = useSyncStatus('dashboard')
  const pullLatest = usePullLatest()
  const pushLocal = usePushLocal()

  return (
    <DashboardSyncActionsView
      isPending={pullLatest.isPending || pushLocal.isPending}
      onPullLatest={() => pullLatest.mutateAsync()}
      onPushLocal={(options) => pushLocal.mutateAsync(options)}
      status={status.data}
    />
  )
}

export function DashboardSyncActionsView({
  isPending,
  onPullLatest,
  onPushLocal,
  status,
}: DashboardSyncActionsViewProps) {
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  if (!status?.configured) {
    return null
  }

  const disabled = isPending || status.isSyncing

  async function handlePullLatest() {
    setFeedback(null)

    try {
      const result = await onPullLatest()
      setFeedback(readActionFeedback(result, 'Pulled latest from Gist.'))
    } catch (error) {
      setFeedback({
        message: readErrorMessage(error, 'Failed to pull latest from Gist.'),
        tone: 'alert',
      })
    }
  }

  async function handlePushLocal() {
    setFeedback(null)

    try {
      const result = await onPushLocal({ confirmRemoteOverwrite: false })
      setFeedback(readActionFeedback(result, 'Pushed local data to Gist.'))
    } catch (error) {
      setFeedback({
        message: readErrorMessage(error, 'Failed to push local data to Gist.'),
        tone: 'alert',
      })
    }
  }

  return (
    <>
      <IconButton
        disabled={disabled}
        label="Pull latest from Gist"
        onClick={() => {
          void handlePullLatest()
        }}
        tooltip="Pull latest from Gist"
        variant="ghost"
      >
        <CloudDownload aria-hidden="true" />
      </IconButton>
      <IconButton
        disabled={disabled}
        label="Push local to Gist"
        onClick={() => {
          void handlePushLocal()
        }}
        tooltip="Push local to Gist"
        variant="ghost"
      >
        <CloudUpload aria-hidden="true" />
      </IconButton>
      {feedback ? (
        <p
          className="sr-only"
          role={feedback.tone === 'alert' ? 'alert' : 'status'}
        >
          {feedback.message}
        </p>
      ) : null}
    </>
  )
}

function readActionFeedback(
  result: SyncActionResult | null | undefined | void,
  fallbackMessage: string,
): Feedback {
  if (result?.outcome === 'confirmation-required') {
    return {
      message: 'Remote changed. Open Settings to overwrite the Gist.',
      tone: 'alert',
    }
  }

  return {
    message: result?.message || fallbackMessage,
    tone: result?.outcome === 'error' ? 'alert' : 'status',
  }
}
