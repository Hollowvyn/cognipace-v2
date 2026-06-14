import { CheckCircle2, KeyRound, Settings2 } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { InlineStatus } from '@/components/ui/inline-status'
import { Surface } from '@/components/ui/surface'
import { formatDateTime } from '@/utils/date-format'

import { useGenAiProviderController } from '../hooks/use-genai-provider-controller'
import type {
  GenAiProviderActionResult,
  GenAiProviderId,
  GenAiProviderStatus,
} from '../domain'
import { genAiProviderLabels } from '../domain'
import { AiProviderConnectionDialog } from './ai-provider-connection-dialog'

type MaybePromise<T> = T | Promise<T>

export type AiProviderActionResult =
  MaybePromise<GenAiProviderActionResult | null | void>

export interface AiProviderPanelActions {
  onClearSecret: (provider: GenAiProviderId) => AiProviderActionResult
  onSaveModel: (
    provider: GenAiProviderId,
    model: string,
  ) => AiProviderActionResult
  onSaveSecret: (provider: GenAiProviderId, key: string) => AiProviderActionResult
  onSelectProvider: (provider: GenAiProviderId) => AiProviderActionResult
  onTestDraft: (
    provider: GenAiProviderId,
    model: string,
    key: string,
  ) => AiProviderActionResult
  onVerifyProvider: (provider: GenAiProviderId) => AiProviderActionResult
}

const providerOrder = ['gemini', 'openai', 'anthropic'] as const

export function AiProviderSettingsSection() {
  const provider = useGenAiProviderController()

  if (!provider.status) {
    return null
  }

  return (
    <AiProviderPanel
      actions={provider.actions}
      isPending={provider.isPending || provider.isLoading}
      status={provider.status}
    />
  )
}

export function AiProviderPanel({
  actions,
  isPending = false,
  status,
}: {
  actions: AiProviderPanelActions
  isPending?: boolean | undefined
  status: GenAiProviderStatus
}) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const selectedProvider = readProviderStatus(status, status.selectedProvider)
  const readyProviders = new Set(
    status.providers
      .filter(
        (provider) =>
          provider.secretConfigured && provider.verificationState === 'valid',
      )
      .map((provider) => provider.provider),
  )

  return (
    <Surface aria-labelledby="ai-provider-title" className="grid gap-4">
      <header className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h2
            className="m-0 text-[length:var(--cp-title-font-size)] font-bold leading-tight"
            id="ai-provider-title"
          >
            AI Provider
          </h2>
          <p className="m-0 text-[length:var(--cp-copy-font-size)] text-muted-foreground">
            Configure the local BYOK provider used for AI assessment.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral" variant="outline">
            {selectedProvider.label}
          </Badge>
          <Badge tone={readConnectionTone(selectedProvider)} variant="outline">
            {readConnectionLabel(selectedProvider)}
          </Badge>
        </div>
      </header>

      {!status.selectedReady ? (
        <InlineStatus tone="warning">
          Add and verify a provider key before AI assessment can use a selected
          provider.
        </InlineStatus>
      ) : (
        <InlineStatus tone="success">
          <CheckCircle2 aria-hidden="true" />
          Selected AI provider is ready.
        </InlineStatus>
      )}

      <div className="grid gap-3 rounded-[var(--cp-radius-md)] border border-border bg-background/60 p-3">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <h3 className="m-0 text-[length:var(--cp-copy-font-size)] font-semibold">
              {selectedProvider.label}
            </h3>
            <p className="m-0 text-[length:var(--cp-badge-font-size)] text-muted-foreground">
              Model{' '}
              <span className="font-mono text-foreground">
                {selectedProvider.model}
              </span>
              .
            </p>
            {selectedProvider.verifiedAt ? (
              <p className="m-0 text-[length:var(--cp-badge-font-size)] text-muted-foreground">
                Last verified {formatDateTime(selectedProvider.verifiedAt)}.
              </p>
            ) : null}
          </div>

          <label className="grid gap-1 text-[length:var(--cp-badge-font-size)] font-semibold text-muted-foreground">
            Selected AI provider
            <select
              aria-label="Selected AI provider"
              className="min-w-[10rem] rounded-[var(--cp-control-radius)] border border-border bg-background px-3 py-2 text-[length:var(--cp-copy-font-size)] font-normal text-foreground"
              disabled={isPending}
              onChange={(event) => {
                void actions.onSelectProvider(
                  event.currentTarget.value as GenAiProviderId,
                )
              }}
              value={status.selectedProvider}
            >
              {providerOrder.map((providerId) => (
                <option
                  disabled={!readyProviders.has(providerId)}
                  key={providerId}
                  value={providerId}
                >
                  {genAiProviderLabels[providerId]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={isPending}
            onClick={() => {
              setDialogOpen(true)
            }}
            size="sm"
            variant="outline"
          >
            <Settings2 aria-hidden="true" />
            Manage provider
          </Button>
          {selectedProvider.secretConfigured ? (
            <Button
              disabled={isPending}
              onClick={() => {
                void actions.onVerifyProvider(status.selectedProvider)
              }}
              size="sm"
              variant="outline"
            >
              <KeyRound aria-hidden="true" />
              Test selected
            </Button>
          ) : null}
        </div>
      </div>

      {dialogOpen ? (
        <AiProviderConnectionDialog
          actions={actions}
          isPending={isPending}
          onClose={() => {
            setDialogOpen(false)
          }}
          status={status}
        />
      ) : null}
    </Surface>
  )
}

function readProviderStatus(
  status: GenAiProviderStatus,
  provider: GenAiProviderId,
) {
  return (
    status.providers.find((entry) => entry.provider === provider) ?? {
      provider,
      label: genAiProviderLabels[provider],
      model: '',
      secretConfigured: false,
      verificationState: 'unverified',
      verifiedAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
    }
  )
}

function readConnectionLabel(
  provider: GenAiProviderStatus['providers'][number],
) {
  if (!provider.secretConfigured) {
    return 'Not configured'
  }

  if (provider.verificationState === 'valid') {
    return 'Ready'
  }

  if (provider.verificationState === 'invalid') {
    return 'Error'
  }

  return 'Needs verification'
}

function readConnectionTone(provider: GenAiProviderStatus['providers'][number]) {
  if (!provider.secretConfigured) {
    return 'neutral'
  }

  if (provider.verificationState === 'valid') {
    return 'success'
  }

  if (provider.verificationState === 'invalid') {
    return 'danger'
  }

  return 'warning'
}
