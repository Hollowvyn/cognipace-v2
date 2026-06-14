import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { InlineStatus } from '@/components/ui/inline-status'
import {
  genAiProviderIds,
  useClearAiProviderSecretMutation,
  useGenAiSecretPresenceQuery,
  useSetAiProviderSecretMutation,
  type GenAiProviderId,
} from '@/features/genai'

import type { UserSettings } from '../../domain'
import type { SettingsDraftActions } from '../../hooks/use-settings-draft'
import { SegmentedControl, SwitchControl } from '../settings-controls'
import { readSettingsRowLabelId, SettingsRow } from '../settings-row'
import { SettingsSection } from '../settings-section'

interface AiAssessmentSectionProps {
  actions: Pick<
    SettingsDraftActions,
    'setAiEnabled' | 'setAiModel' | 'setAiProvider'
  >
  draft: UserSettings
}

const providerOptions: ReadonlyArray<{
  label: string
  value: GenAiProviderId
}> = [
  { label: 'OpenAI', value: 'openai' },
  { label: 'Anthropic', value: 'anthropic' },
  { label: 'Gemini', value: 'gemini' },
]

const providerLabels: Record<GenAiProviderId, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Gemini',
}

const providerModelPlaceholders: Record<GenAiProviderId, string> = {
  openai: 'gpt-5.4-mini',
  anthropic: 'claude-haiku-4-5',
  gemini: 'gemini-2.5-flash',
}

export function AiAssessmentSection({
  actions,
  draft,
}: AiAssessmentSectionProps) {
  const presenceQuery = useGenAiSecretPresenceQuery()
  const setSecret = useSetAiProviderSecretMutation()
  const clearSecret = useClearAiProviderSecretMutation()
  const [keyInput, setKeyInput] = useState('')

  const { provider, enabled, model } = draft.aiAssessment
  const presence = presenceQuery.data
  const activeProviderHasKey = presence?.[provider] ?? false
  const enableDisabled = model.trim() === '' || !activeProviderHasKey
  const enableDisabledReason = !activeProviderHasKey
    ? `Save a ${providerLabels[provider]} key first.`
    : 'Enter a model id first.'

  const handleSaveKey = async () => {
    if (keyInput === '') return
    try {
      await setSecret.mutateAsync({ provider, key: keyInput })
      setKeyInput('')
    } catch {
      // setSecret.isError will be true; error message rendered below
    }
  }

  const handleClearKey = async () => {
    try {
      await clearSecret.mutateAsync({ provider })
      setKeyInput('')
    } catch {
      // clearSecret.isError will be true; error message rendered below
    }
  }

  return (
    <SettingsSection id="ai-assessment-settings" title="AI assessment">
      <SettingsRow
        controlClassName="w-full md:max-w-28"
        hint="When on, CogniPace asks an AI provider to refine the deterministic rating."
        id="ai-enabled-row"
        label="Enabled"
        labelFor="ai-enabled"
      >
        <SwitchControl
          ariaLabelledBy={readSettingsRowLabelId('ai-enabled-row')}
          checked={enabled}
          disabled={enableDisabled}
          disabledReason={enableDisabledReason}
          id="ai-enabled"
          onChange={actions.setAiEnabled}
        />
      </SettingsRow>

      <SettingsRow
        controlClassName="w-full md:max-w-[34rem]"
        id="ai-provider-row"
        label="Provider"
      >
        <SegmentedControl
          ariaLabelledBy={readSettingsRowLabelId('ai-provider-row')}
          label="Provider"
          name="ai-provider"
          onChange={actions.setAiProvider}
          options={providerOptions}
          value={provider}
        />
      </SettingsRow>

      <SettingsRow
        controlClassName="flex flex-wrap gap-2"
        id="ai-provider-presence-row"
        label="Saved keys"
      >
        {genAiProviderIds.map((id) =>
          presence?.[id] ? (
            <Badge key={id}>{providerLabels[id]}: Key set</Badge>
          ) : null,
        )}
      </SettingsRow>

      <SettingsRow
        controlClassName="w-full md:max-w-[34rem]"
        id="ai-model-row"
        label="Model"
        labelFor="ai-model"
      >
        <input
          className="w-full rounded-[var(--cp-control-radius)] border border-border bg-background px-3 py-2 text-[length:var(--cp-copy-font-size)]"
          id="ai-model"
          maxLength={120}
          onChange={(event) => actions.setAiModel(event.currentTarget.value)}
          placeholder={providerModelPlaceholders[provider]}
          spellCheck={false}
          type="text"
          value={model}
        />
      </SettingsRow>

      <SettingsRow
        controlClassName="flex min-w-0 flex-wrap items-center gap-2"
        hint="Stored locally. Not synced. Never sent to anyone but the provider."
        id="ai-key-row"
        label={`${providerLabels[provider]} API key`}
        labelFor="ai-key"
      >
        <input
          autoComplete="off"
          className="min-w-[16rem] flex-1 rounded-[var(--cp-control-radius)] border border-border bg-background px-3 py-2 text-[length:var(--cp-copy-font-size)]"
          id="ai-key"
          onChange={(event) => setKeyInput(event.currentTarget.value)}
          placeholder={
            activeProviderHasKey
              ? '••••••••  (set; enter a new value to replace)'
              : 'Enter key'
          }
          spellCheck={false}
          type="password"
          value={keyInput}
        />
        <Button
          disabled={keyInput === '' || setSecret.isPending}
          onClick={() => {
            void handleSaveKey()
          }}
          size="sm"
        >
          Save key
        </Button>
        {activeProviderHasKey ? (
          <Button
            disabled={clearSecret.isPending}
            onClick={() => {
              void handleClearKey()
            }}
            size="sm"
            variant="outline"
          >
            Remove key
          </Button>
        ) : null}
        {setSecret.isError ? (
          <InlineStatus tone="danger">
            Save failed. Please try again.
          </InlineStatus>
        ) : null}
        {clearSecret.isError ? (
          <InlineStatus tone="danger">
            Remove failed. Please try again.
          </InlineStatus>
        ) : null}
      </SettingsRow>
    </SettingsSection>
  )
}
