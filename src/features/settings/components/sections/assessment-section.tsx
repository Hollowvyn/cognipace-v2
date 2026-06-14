import { InlineStatus } from '@/components/ui/inline-status'

import type { UserSettings } from '../../domain'
import type { SettingsDraftActions } from '../../hooks/use-settings-draft'
import { SwitchControl } from '../settings-controls'
import { readSettingsRowLabelId, SettingsRow } from '../settings-row'
import { SettingsSection } from '../settings-section'

interface AssessmentSectionProps {
  actions: Pick<
    SettingsDraftActions,
    'setAiAssessmentEnabled' | 'setAutoAssessmentEnabled'
  >
  draft: UserSettings
  providerReady: boolean
}

export function AssessmentSection({
  actions,
  draft,
  providerReady,
}: AssessmentSectionProps) {
  const showProviderWarning = draft.aiAssessment.enabled && !providerReady

  return (
    <SettingsSection id="assessment-settings" title="Assessment">
      <SettingsRow
        controlClassName="w-full md:max-w-28"
        hint="Use CogniPace's deterministic assessment policy to preselect ratings."
        id="auto-assessment-row"
        label="Auto assessment"
        labelFor="auto-assessment"
      >
        <SwitchControl
          ariaLabelledBy={readSettingsRowLabelId('auto-assessment-row')}
          checked={draft.assessment.autoAssessmentEnabled}
          id="auto-assessment"
          onChange={actions.setAutoAssessmentEnabled}
        />
      </SettingsRow>

      <SettingsRow
        controlClassName="w-full md:max-w-28"
        hint="Use the selected AI provider to refine automatic assessment when available."
        id="ai-assessment-row"
        label="AI assessment"
        labelFor="ai-assessment"
      >
        <SwitchControl
          ariaLabelledBy={readSettingsRowLabelId('ai-assessment-row')}
          checked={draft.aiAssessment.enabled}
          id="ai-assessment"
          onChange={actions.setAiAssessmentEnabled}
        />
      </SettingsRow>

      {showProviderWarning ? (
        <SettingsRow
          controlClassName="w-full"
          id="ai-assessment-warning-row"
          label="AI provider"
        >
          <InlineStatus tone="warning">
            AI provider setup is not ready. Auto assessment will use the
            deterministic policy.
          </InlineStatus>
        </SettingsRow>
      ) : null}
    </SettingsSection>
  )
}
