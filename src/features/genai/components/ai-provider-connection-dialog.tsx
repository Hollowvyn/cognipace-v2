import {
  CheckCircle2,
  KeyRound,
  Loader2,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'

import { Button } from '@/components/ui/button'
import { InlineStatus } from '@/components/ui/inline-status'
import { readErrorMessage } from '@/utils/errors'

import {
  genAiProviderDefaultModels,
  genAiProviderLabels,
  type GenAiProviderActionResult,
  type GenAiProviderId,
  type GenAiProviderStatus,
} from '../domain'
import type {
  AiProviderActionResult,
  AiProviderPanelActions,
} from './ai-provider-settings-section'

type ConnectionFeedback = {
  message: string
  role?: 'alert' | 'status'
  tone: 'danger' | 'neutral' | 'success' | 'warning'
}

const maskedStoredKey = '................'
const providerOrder = ['gemini', 'openai', 'anthropic'] as const

export function AiProviderConnectionDialog({
  actions,
  isPending,
  onClose,
  status,
}: {
  actions: AiProviderPanelActions
  isPending: boolean
  onClose: () => void
  status: GenAiProviderStatus
}) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const [feedback, setFeedback] = useState<ConnectionFeedback | null>(null)
  const [provider, setProvider] = useState<GenAiProviderId>(
    status.selectedProvider,
  )
  const providerStatus = useProviderStatus(status, provider)
  const [model, setModel] = useState(providerStatus.model)
  const [replacingKey, setReplacingKey] = useState(
    !providerStatus.secretConfigured,
  )
  const [key, setKey] = useState('')

  const hasSavedKey = providerStatus.secretConfigured && !replacingKey
  const keyInputValue = hasSavedKey ? maskedStoredKey : key
  const titleId = 'ai-provider-connection-title'
  const descriptionId = 'ai-provider-connection-description'

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null

    cancelButtonRef.current?.focus()

    return () => {
      previouslyFocused?.focus()
    }
  }, [])

  async function runAction(
    action: () => AiProviderActionResult,
    fallbackMessage: string,
    options: { afterSuccess?: () => void } = {},
  ) {
    try {
      const result = await Promise.resolve(action())

      if (!result || result.outcome === 'success') {
        options.afterSuccess?.()
      }

      setFeedback(readActionFeedback(result, fallbackMessage))
    } catch (error) {
      setFeedback({
        message: readErrorMessage(error, 'AI provider action failed.'),
        role: 'alert',
        tone: 'danger',
      })
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && !isPending) {
      event.preventDefault()
      onClose()
      return
    }

    if (event.key !== 'Tab') {
      return
    }

    const dialog = dialogRef.current
    const focusableElements = dialog ? getFocusableElements(dialog) : []

    if (focusableElements.length === 0) {
      event.preventDefault()
      dialog?.focus()
      return
    }

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    if (!firstElement || !lastElement) {
      return
    }

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault()
      lastElement.focus()
      return
    }

    if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault()
      firstElement.focus()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-background/75 p-4"
      onKeyDown={handleKeyDown}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          event.preventDefault()
          if (!isPending) {
            onClose()
          }
        }
      }}
    >
      <section
        aria-busy={isPending || undefined}
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="grid w-full max-w-2xl gap-5 rounded-[var(--cp-panel-radius)] border border-border bg-card p-[var(--cp-panel-padding)] text-card-foreground shadow-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="grid gap-2">
          <h2
            className="m-0 text-[length:var(--cp-title-font-size)] font-bold leading-tight"
            id={titleId}
          >
            Manage AI Provider
          </h2>
          <p
            className="m-0 text-[length:var(--cp-copy-font-size)] text-muted-foreground"
            id={descriptionId}
          >
            Configure one local BYOK provider for AI assessment.
          </p>
        </div>

        {feedback ? (
          <InlineStatus role={feedback.role} tone={feedback.tone}>
            {feedback.tone === 'success' ? (
              <CheckCircle2 aria-hidden="true" />
            ) : null}
            {feedback.message}
          </InlineStatus>
        ) : null}

        <div className="grid gap-3 rounded-[var(--cp-radius-md)] border border-border bg-background/60 p-3">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,12rem)_1fr]">
            <label
              className="text-[length:var(--cp-copy-font-size)] font-semibold"
              htmlFor="ai-provider-dialog-provider"
            >
              Provider
            </label>
            <select
              className="rounded-[var(--cp-control-radius)] border border-border bg-background px-3 py-2 text-[length:var(--cp-copy-font-size)]"
              id="ai-provider-dialog-provider"
              onChange={(event) => {
                const nextProvider = event.currentTarget.value as GenAiProviderId
                const nextProviderStatus = readProviderStatusValue(
                  status,
                  nextProvider,
                )
                setProvider(nextProvider)
                setModel(nextProviderStatus.model)
                setReplacingKey(!nextProviderStatus.secretConfigured)
                setKey('')
                setFeedback(null)
              }}
              value={provider}
            >
              {providerOrder.map((providerId) => (
                <option key={providerId} value={providerId}>
                  {genAiProviderLabels[providerId]}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2 sm:grid-cols-[minmax(0,12rem)_1fr]">
            <label
              className="text-[length:var(--cp-copy-font-size)] font-semibold"
              htmlFor="ai-provider-dialog-model"
            >
              Model
            </label>
            <input
              className="rounded-[var(--cp-control-radius)] border border-border bg-background px-3 py-2 text-[length:var(--cp-copy-font-size)]"
              id="ai-provider-dialog-model"
              onChange={(event) => {
                setModel(event.currentTarget.value)
              }}
              spellCheck={false}
              value={model}
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-[minmax(0,12rem)_1fr]">
            <label
              className="text-[length:var(--cp-copy-font-size)] font-semibold"
              htmlFor="ai-provider-dialog-key"
            >
              API key
            </label>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <input
                autoComplete="off"
                className="min-w-[16rem] flex-1 rounded-[var(--cp-control-radius)] border border-border bg-background px-3 py-2 text-[length:var(--cp-copy-font-size)]"
                id="ai-provider-dialog-key"
                onChange={(event) => {
                  setKey(event.currentTarget.value)
                }}
                readOnly={hasSavedKey}
                spellCheck={false}
                type="password"
                value={keyInputValue}
              />
              <Button
                disabled={isPending || hasSavedKey || !key.trim()}
                onClick={() => {
                  void runAction(
                    () => actions.onTestDraft(provider, model.trim(), key.trim()),
                    'Provider key validated.',
                  )
                }}
                size="sm"
                variant="outline"
              >
                Test key
              </Button>
              {hasSavedKey ? (
                <Button
                  disabled={isPending}
                  onClick={() => {
                    setReplacingKey(true)
                    setKey('')
                    setFeedback(null)
                  }}
                  size="sm"
                  variant="outline"
                >
                  <KeyRound aria-hidden="true" />
                  Replace key
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={isPending || !model.trim()}
              onClick={() => {
                void runAction(
                  async () => {
                    const modelResult = await actions.onSaveModel(
                      provider,
                      model.trim(),
                    )

                    if (!hasSavedKey && key.trim()) {
                      return actions.onSaveSecret(provider, key.trim())
                    }

                    return modelResult
                  },
                  'Provider saved.',
                  {
                    afterSuccess: () => {
                      if (!hasSavedKey && key.trim()) {
                        setKey('')
                        setReplacingKey(false)
                      }
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
              Save provider
            </Button>
            <Button
              disabled={isPending || !providerStatus.secretConfigured}
              onClick={() => {
                void runAction(
                  () => actions.onVerifyProvider(provider),
                  'Provider verified.',
                )
              }}
              size="sm"
              variant="outline"
            >
              <CheckCircle2 aria-hidden="true" />
              Verify selected
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {providerStatus.secretConfigured ? (
              <Button
                disabled={isPending}
                onClick={() => {
                  void runAction(
                    () => actions.onClearSecret(provider),
                    'Provider key removed.',
                    {
                      afterSuccess: () => {
                        setReplacingKey(true)
                        setKey('')
                      },
                    },
                  )
                }}
                size="sm"
                variant="ghost"
              >
                <Trash2 aria-hidden="true" />
                Remove key
              </Button>
            ) : null}
            <Button
              disabled={isPending}
              onClick={onClose}
              ref={cancelButtonRef}
              size="sm"
              variant="ghost"
            >
              Close
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}

function useProviderStatus(status: GenAiProviderStatus, provider: GenAiProviderId) {
  return useMemo(() => readProviderStatusValue(status, provider), [provider, status])
}

function readProviderStatusValue(
  status: GenAiProviderStatus,
  provider: GenAiProviderId,
) {
  return (
    status.providers.find((entry) => entry.provider === provider) ?? {
      provider,
      label: genAiProviderLabels[provider],
      model: genAiProviderDefaultModels[provider],
      secretConfigured: false,
      verificationState: 'unverified',
      verifiedAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
    }
  )
}

function readActionFeedback(
  result: GenAiProviderActionResult | null | undefined | void,
  fallbackMessage: string,
): ConnectionFeedback {
  if (!result) {
    return {
      message: fallbackMessage,
      tone: 'success',
    }
  }

  if (result.outcome === 'success') {
    return {
      message: result.message || fallbackMessage,
      tone: 'success',
    }
  }

  return {
    message: result.message || fallbackMessage,
    role: 'alert',
    tone: 'danger',
  }
}

function getFocusableElements(root: HTMLElement) {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      [
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        'a[href]',
        '[tabindex]:not([tabindex="-1"])',
      ].join(','),
    ),
  ).filter((element) => element.offsetParent !== null)
}
