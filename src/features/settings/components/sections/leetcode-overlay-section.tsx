import type { UserSettings } from '../../domain'
import type { SettingsDraftActions } from '../../hooks/use-settings-draft'
import { SwitchControl } from '../settings-controls'
import { readSettingsRowLabelId, SettingsRow } from '../settings-row'
import { SettingsSection } from '../settings-section'

interface LeetCodeOverlaySectionProps {
  actions: Pick<
    SettingsDraftActions,
    'setAutoDetectSolved' | 'setRequireSolveTime'
  >
  draft: UserSettings
}

export function LeetCodeOverlaySection({
  actions,
  draft,
}: LeetCodeOverlaySectionProps) {
  const autoDetectHint = 'Detect accepted LeetCode submissions when possible.'
  const requireSolveTimeDescription =
    'Overlay submissions require a recorded timer value.'

  return (
    <SettingsSection id="leetcode-overlay-settings" title="Solving Overlay">
      <SettingsRow
        controlClassName="w-full md:max-w-28"
        hint={autoDetectHint}
        id="auto-detect-solved-row"
        label="Auto-detect solved submissions"
        labelFor="auto-detect-solved"
      >
        <SwitchControl
          ariaLabelledBy={readSettingsRowLabelId('auto-detect-solved-row')}
          checked={draft.overlay.autoDetectSolved}
          id="auto-detect-solved"
          onChange={actions.setAutoDetectSolved}
        />
      </SettingsRow>
      <SettingsRow
        controlClassName="w-full md:max-w-28"
        hint={requireSolveTimeDescription}
        id="require-solve-time-row"
        label="Require solve time"
        labelFor="require-solve-time"
      >
        <SwitchControl
          ariaLabelledBy={readSettingsRowLabelId('require-solve-time-row')}
          checked={draft.assessment.requireSolveTime}
          id="require-solve-time"
          onChange={actions.setRequireSolveTime}
        />
      </SettingsRow>
    </SettingsSection>
  )
}
