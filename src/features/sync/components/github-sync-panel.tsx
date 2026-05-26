import {
  CheckCircle2,
  GitBranch,
  KeyRound,
  Loader2,
  DownloadCloud,
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

type SyncConflictResolution = 'pull-remote' | 'push-local'
type MaybePromise<T> = T | Promise<T>

type GitHubSyncActionResult = MaybePromise<SyncActionResult | null | void>

export interface GitHubSyncPanelActions {
  onConnectGist: (gistId: string) => GitHubSyncActionResult
  onCreateGist: () => GitHubSyncActionResult
  onDeleteToken: () => GitHubSyncActionResult
  onPullLatest: () => GitHubSyncActionResult
  onPushLocal: (confirmRemoteOverwrite?: boolean) => GitHubSyncActionResult
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
  const [resolutionToConfirm, setResolutionToConfirm] =
    useState<SyncConflictResolution | null>(null)
  const hasTokenForActions = status.tokenConfigured || tokenSavedInSession
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

      {status.conflict ? (
        <ConflictActions
          isPending={isPending}
          onCancel={() => {
            setResolutionToConfirm(null)
          }}
          onConfirm={(resolution) => {
            void runPanelAction(
              () =>
                resolution === 'pull-remote'
                  ? actions.onPullLatest()
                  : actions.onPushLocal(true),
              resolution === 'pull-remote'
                ? 'Remote data pulled.'
                : 'Local data pushed.',
              {
                afterSuccess: () => {
                  setResolutionToConfirm(null)
                },
              },
            )
          }}
          onSelect={setResolutionToConfirm}
          resolutionToConfirm={resolutionToConfirm}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={isPending || !status.configured}
            onClick={() => {
              void runPanelAction(
                () => actions.onPullLatest(),
                'Latest Gist data pulled.',
              )
            }}
            size="sm"
            variant="outline"
          >
            <DownloadCloud aria-hidden="true" />
            Pull latest
          </Button>
          <Button
            disabled={isPending || !status.configured}
            onClick={() => {
              void runPanelAction(
                () => actions.onPushLocal(false),
                'Local data pushed to Gist.',
              )
            }}
            size="sm"
            variant="outline"
          >
            <UploadCloud aria-hidden="true" />
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
      )}
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

  return (
    <InlineStatus tone="success">
      <CheckCircle2 aria-hidden="true" />
      {status.lastSyncAt
        ? `Last ${status.lastSyncDirection ?? 'sync'}: ${formatDateTime(
            status.lastSyncAt,
          )}`
        : 'GitHub sync is ready.'}
    </InlineStatus>
  )
}

function ConflictActions({
  isPending,
  onCancel,
  onConfirm,
  onSelect,
  resolutionToConfirm,
}: {
  isPending: boolean
  onCancel: () => void
  onConfirm: (resolution: SyncConflictResolution) => void
  onSelect: (resolution: SyncConflictResolution) => void
  resolutionToConfirm: SyncConflictResolution | null
}) {
  if (resolutionToConfirm) {
    const isPull = resolutionToConfirm === 'pull-remote'

    return (
      <div className="grid gap-2">
        <InlineStatus tone="warning">
          {isPull
            ? 'Pulling remote data replaces local data with the Gist copy.'
            : 'Pushing local data replaces the Gist copy with this browser data.'}
        </InlineStatus>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={isPending}
            onClick={() => {
              onConfirm(resolutionToConfirm)
            }}
            size="sm"
            variant="destructive"
          >
            {isPull ? 'Confirm pull remote' : 'Confirm push local'}
          </Button>
          <Button
            disabled={isPending}
            onClick={onCancel}
            size="sm"
            variant="ghost"
          >
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        disabled={isPending}
        onClick={() => {
          onSelect('pull-remote')
        }}
        size="sm"
        variant="outline"
      >
        Pull remote
      </Button>
      <Button
        disabled={isPending}
        onClick={() => {
          onSelect('push-local')
        }}
        size="sm"
        variant="outline"
      >
        Push local
      </Button>
    </div>
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
