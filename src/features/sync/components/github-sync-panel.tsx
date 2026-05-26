import {
  CheckCircle2,
  CloudDownload,
  CloudUpload,
  GitBranch,
  KeyRound,
  Loader2,
  Trash2,
  UploadCloud,
} from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { InlineStatus } from '@/components/ui/inline-status'
import { Surface } from '@/components/ui/surface'
import { formatDateTime } from '@/utils/date-format'

import type {
  SerializedSyncStatus,
  SyncActionResult,
} from '../api/sync-contracts'

type MaybePromise<T> = T | Promise<T>

type GitHubSyncActionResult = MaybePromise<SyncActionResult | null | void>

export interface GitHubSyncPanelActions {
  onConnectGist: (gistId: string) => GitHubSyncActionResult
  onCreateGist: () => GitHubSyncActionResult
  onDeleteToken: () => GitHubSyncActionResult
  onPullLatest: () => GitHubSyncActionResult
  onPushLocal: (input?: {
    confirmRemoteOverwrite?: boolean
  }) => GitHubSyncActionResult
  onSaveToken: (token: string) => GitHubSyncActionResult
  onValidateToken: (token: string) => GitHubSyncActionResult
}

type Feedback = {
  message: string
  tone: 'danger' | 'neutral' | 'success' | 'warning'
}

export function GitHubSyncPanel({
  actions,
  isPending = false,
  status,
}: {
  actions: GitHubSyncPanelActions
  isPending?: boolean | undefined
  status: SerializedSyncStatus
}) {
  const [token, setToken] = useState('')
  const [gistDraft, setGistDraft] = useState({
    sourceGistId: status.gistId,
    value: status.gistId ?? '',
  })
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [tokenSavedInSession, setTokenSavedInSession] = useState(false)
  const [pushOverwriteConfirmationGistId, setPushOverwriteConfirmationGistId] =
    useState<string | null>(null)

  const hasTokenForActions = status.tokenConfigured || tokenSavedInSession
  const pushOverwriteConfirmationVisible =
    status.configured &&
    status.gistId !== null &&
    pushOverwriteConfirmationGistId === status.gistId
  const gistId =
    gistDraft.sourceGistId === status.gistId
      ? gistDraft.value
      : (status.gistId ?? '')

  async function runPanelAction(
    action: () => GitHubSyncActionResult,
    fallbackMessage: string,
    options: { afterSuccess?: () => void } = {},
  ) {
    setFeedback(null)
    setPushOverwriteConfirmationGistId(null)

    try {
      const result = await action()
      const actionFeedback = readActionFeedback(result, fallbackMessage)

      if (actionFeedback.tone === 'success') {
        options.afterSuccess?.()
      }

      setFeedback(actionFeedback)
    } catch (error) {
      setFeedback({
        message: readErrorMessage(error, 'Sync action failed.'),
        tone: 'danger',
      })
    }
  }

  async function runPullLatestAction() {
    await runPanelAction(
      () => actions.onPullLatest(),
      'Latest Gist data pulled.',
    )
  }

  async function runPushLocalAction(confirmRemoteOverwrite: boolean) {
    setFeedback(null)
    if (!confirmRemoteOverwrite) {
      setPushOverwriteConfirmationGistId(null)
    }

    try {
      const result = await actions.onPushLocal({ confirmRemoteOverwrite })
      const actionFeedback = readActionFeedback(
        result,
        'Local data pushed to Gist.',
      )

      setPushOverwriteConfirmationGistId(
        isSyncActionResult(result) &&
          result.outcome === 'confirmation-required' &&
          status.gistId !== null
          ? status.gistId
          : null,
      )
      setFeedback(actionFeedback)
    } catch (error) {
      setFeedback({
        message: readErrorMessage(error, 'Sync action failed.'),
        tone: 'danger',
      })
    }
  }

  return (
    <Surface aria-labelledby="github-sync-title" className="grid gap-4">
      <header className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h2
            className="m-0 text-[length:var(--cp-title-font-size)] font-bold leading-tight"
            id="github-sync-title"
          >
            GitHub Sync
          </h2>
          <p className="m-0 text-[length:var(--cp-copy-font-size)] text-muted-foreground">
            Sync local CogniPace data through a private GitHub Gist.
          </p>
        </div>
        <Badge tone={readStatusTone(status)} variant="outline">
          {readStatusLabel(status)}
        </Badge>
      </header>

      <SyncStatusBlock status={status} />
      {feedback ? (
        <InlineStatus
          role={feedback.tone === 'danger' ? 'alert' : 'status'}
          tone={feedback.tone}
        >
          {feedback.message}
        </InlineStatus>
      ) : null}

      <div className="grid gap-2">
        <label
          className="text-[length:var(--cp-copy-font-size)] font-semibold"
          htmlFor="github-sync-token"
        >
          GitHub token
        </label>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <input
            autoComplete="off"
            className="min-w-[16rem] flex-1 rounded-[var(--cp-control-radius)] border border-border bg-background px-3 py-2 text-[length:var(--cp-copy-font-size)]"
            id="github-sync-token"
            onChange={(event) => {
              setToken(event.currentTarget.value)
            }}
            placeholder="ghp_..."
            spellCheck={false}
            type="password"
            value={token}
          />
          <Button
            disabled={isPending || !token.trim()}
            onClick={() => {
              void runPanelAction(
                () => actions.onSaveToken(token.trim()),
                'GitHub token saved.',
                {
                  afterSuccess: () => {
                    setToken('')
                    setTokenSavedInSession(true)
                  },
                },
              )
            }}
            size="sm"
          >
            {isPending ? (
              <Loader2
                aria-hidden="true"
                className="animate-spin motion-reduce:animate-none"
              />
            ) : (
              <KeyRound aria-hidden="true" />
            )}
            Save token
          </Button>
          <Button
            disabled={isPending || !token.trim()}
            onClick={() => {
              void runPanelAction(
                () => actions.onValidateToken(token.trim()),
                'GitHub token validated.',
              )
            }}
            size="sm"
            variant="outline"
          >
            Test token
          </Button>
        </div>
        {status.tokenStatus.configured ? (
          <p className="m-0 text-[length:var(--cp-badge-font-size)] text-muted-foreground">
            Stored locally in trusted extension storage. It is not included in
            backups or exports.
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <label
          className="text-[length:var(--cp-copy-font-size)] font-semibold"
          htmlFor="github-sync-gist"
        >
          Gist ID
        </label>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <input
            className="min-w-[16rem] flex-1 rounded-[var(--cp-control-radius)] border border-border bg-background px-3 py-2 text-[length:var(--cp-copy-font-size)]"
            id="github-sync-gist"
            onChange={(event) => {
              setGistDraft({
                sourceGistId: status.gistId,
                value: event.currentTarget.value,
              })
            }}
            placeholder="Existing Gist ID"
            spellCheck={false}
            value={gistId}
          />
          <Button
            disabled={isPending || !gistId.trim() || !hasTokenForActions}
            onClick={() => {
              void runPanelAction(
                () => actions.onConnectGist(gistId.trim()),
                'GitHub Gist connected.',
              )
            }}
            size="sm"
            variant="outline"
          >
            <GitBranch aria-hidden="true" />
            Connect Gist
          </Button>
          <Button
            disabled={isPending || !hasTokenForActions}
            onClick={() => {
              void runPanelAction(
                () => actions.onCreateGist(),
                'Private GitHub Gist created.',
              )
            }}
            size="sm"
            variant="outline"
          >
            <UploadCloud aria-hidden="true" />
            Create private Gist
          </Button>
        </div>
      </div>

      {pushOverwriteConfirmationVisible ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={isPending || !status.configured}
            onClick={() => {
              void runPushLocalAction(true)
            }}
            size="sm"
            variant="destructive"
          >
            Overwrite Gist
          </Button>
          <Button
            disabled={isPending}
            onClick={() => {
              setPushOverwriteConfirmationGistId(null)
            }}
            size="sm"
            variant="ghost"
          >
            Cancel
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={isPending || !status.configured}
          onClick={() => {
            void runPullLatestAction()
          }}
          size="sm"
          variant="outline"
        >
          <CloudDownload aria-hidden="true" />
          Pull latest
        </Button>
        <Button
          disabled={isPending || !status.configured}
          onClick={() => {
            void runPushLocalAction(false)
          }}
          size="sm"
          variant="outline"
        >
          <CloudUpload aria-hidden="true" />
          Push local
        </Button>
        <Button
          disabled={isPending || !status.tokenConfigured}
          onClick={() => {
            void runPanelAction(
              () => actions.onDeleteToken(),
              'GitHub token deleted.',
              {
                afterSuccess: () => {
                  setTokenSavedInSession(false)
                },
              },
            )
          }}
          size="sm"
          variant="ghost"
        >
          <Trash2 aria-hidden="true" />
          Delete token
        </Button>
      </div>
    </Surface>
  )
}

function SyncStatusBlock({ status }: { status: SerializedSyncStatus }) {
  if (status.conflict) {
    return (
      <InlineStatus role="alert" tone="warning">
        Sync conflict detected. Choose whether to pull remote data or push local
        data.
      </InlineStatus>
    )
  }

  if (status.lastError) {
    return (
      <InlineStatus role="alert" tone="danger">
        {status.lastError.message}
      </InlineStatus>
    )
  }

  if (!status.tokenConfigured) {
    return <InlineStatus>Add a GitHub token to enable Gist sync.</InlineStatus>
  }

  if (!status.gistId) {
    return (
      <InlineStatus>Create or connect a private CogniPace Gist.</InlineStatus>
    )
  }

  if (status.lastBlockingReason === 'local-dirty') {
    return (
      <InlineStatus tone="warning">
        Local changes need to be pushed before pulling latest Gist data.
      </InlineStatus>
    )
  }

  if (status.needsPush) {
    return (
      <InlineStatus tone="warning">
        Local changes are waiting to be pushed to Gist.
      </InlineStatus>
    )
  }

  const lastSyncStatus = readLastSyncStatus(status)

  return (
    <InlineStatus tone="success">
      <CheckCircle2 aria-hidden="true" />
      {lastSyncStatus ?? 'GitHub sync is ready.'}
    </InlineStatus>
  )
}

function readStatusLabel(status: SerializedSyncStatus) {
  if (status.conflict) {
    return 'Conflict'
  }

  if (status.lastError) {
    return status.lastError.retryable ? 'Retry needed' : 'Error'
  }

  if (status.configured) {
    return status.enabled ? 'Enabled' : 'Paused'
  }

  return 'Not configured'
}

function readStatusTone(status: SerializedSyncStatus) {
  if (status.conflict || status.lastError?.retryable) {
    return 'warning'
  }

  if (status.lastError) {
    return 'danger'
  }

  return status.configured ? 'success' : 'neutral'
}

function readLastSyncStatus(status: SerializedSyncStatus) {
  const latestDirectionalSync = readLatestDirectionalSync(status)

  if (latestDirectionalSync) {
    return `Last ${latestDirectionalSync.label}: ${formatDateTime(
      latestDirectionalSync.timestamp,
    )}`
  }

  if (status.lastSyncAt) {
    const label =
      status.lastSyncDirection === 'no-change'
        ? 'sync check'
        : (status.lastSyncDirection ?? 'sync')

    return `Last ${label}: ${formatDateTime(
      status.lastSyncAt,
    )}`
  }

  return null
}

function readLatestDirectionalSync(status: SerializedSyncStatus) {
  const candidates = [
    status.lastPushAt ? { label: 'push', timestamp: status.lastPushAt } : null,
    status.lastPullAt ? { label: 'pull', timestamp: status.lastPullAt } : null,
  ].filter((candidate): candidate is { label: string; timestamp: string } =>
    Boolean(candidate),
  )

  return candidates.toSorted(
    (left, right) =>
      Date.parse(right.timestamp) - Date.parse(left.timestamp),
  )[0]
}

function readActionFeedback(result: unknown, fallback: string): Feedback {
  const message = readActionMessage(result, fallback)

  if (!isSyncActionResult(result)) {
    return { message, tone: 'success' }
  }

  if (result.outcome === 'error') {
    return { message, tone: 'danger' }
  }

  if (
    result.outcome === 'blocked' ||
    result.outcome === 'confirmation-required'
  ) {
    return { message, tone: 'warning' }
  }

  return { message, tone: 'success' }
}

function isSyncActionResult(result: unknown): result is SyncActionResult {
  return (
    result !== null &&
    typeof result === 'object' &&
    'outcome' in result &&
    (result.outcome === 'success' ||
      result.outcome === 'no-change' ||
      result.outcome === 'blocked' ||
      result.outcome === 'confirmation-required' ||
      result.outcome === 'error')
  )
}

function readActionMessage(result: unknown, fallback: string) {
  if (
    result &&
    typeof result === 'object' &&
    'message' in result &&
    typeof result.message === 'string'
  ) {
    return result.message
  }

  return fallback
}

function readErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}
