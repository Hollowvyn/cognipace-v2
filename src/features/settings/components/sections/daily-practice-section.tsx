import type { StudyMode, UserSettings } from '../../domain'
import type {
  SettingsDraftActions,
  SettingsFieldErrors,
  SettingsNumberInputs,
} from '../../hooks/use-settings-draft'
import {
  NumberControl,
  SegmentedControl,
  SwitchControl,
} from '../settings-controls'
import {
  readSettingsRowErrorId,
  readSettingsRowLabelId,
  SettingsRow,
} from '../settings-row'
import { SettingsSection } from '../settings-section'

const studyModeOptions: ReadonlyArray<{ label: string; value: StudyMode }> = [
  { label: 'Study plan', value: 'studyPlan' },
  { label: 'Free practice', value: 'freePractice' },
]

interface DailyPracticeSectionProps {
  actions: Pick<
    SettingsDraftActions,
    'setNumberInput' | 'setSkipPremium' | 'setStudyMode'
  >
  draft: UserSettings
  fieldErrors: SettingsFieldErrors
  numberInputs: SettingsNumberInputs
}

export function DailyPracticeSection({
  actions,
  draft,
  fieldErrors,
  numberInputs,
}: DailyPracticeSectionProps) {
  const studyModeHint =
    'Study plan follows the active track; free practice uses queue priority.'
  const dailyGoalHint = 'How many problems CogniPace queues each day.'
  const skipPremiumHint =
    'Excludes premium-only problems from generated practice.'

  return (
    <SettingsSection id="daily-practice-settings" title="Practice Defaults">
      <SettingsRow
        controlClassName="w-full md:max-w-sm"
        hint={studyModeHint}
        id="study-mode"
        label="Study mode"
      >
        <SegmentedControl
          ariaLabelledBy={readSettingsRowLabelId('study-mode')}
          label="Study mode"
          name="study-mode"
          onChange={actions.setStudyMode}
          options={studyModeOptions}
          value={draft.practice.mode}
        />
      </SettingsRow>
      <SettingsRow
        controlClassName="w-fit max-w-full"
        hint={dailyGoalHint}
        id="daily-goal-row"
        label="Daily goal"
        labelFor="daily-goal"
      >
        <NumberControl
          error={fieldErrors.dailyGoal}
          errorMessageId={readSettingsRowErrorId('daily-goal-row')}
          id="daily-goal"
          max={100}
          min={1}
          onChange={(value) => {
            actions.setNumberInput('dailyGoal', value)
          }}
          value={numberInputs.dailyGoal}
        />
      </SettingsRow>
      <SettingsRow
        controlClassName="w-full md:max-w-28"
        hint={skipPremiumHint}
        id="skip-premium-row"
        label="Skip premium problems"
        labelFor="skip-premium"
      >
        <SwitchControl
          ariaLabelledBy={readSettingsRowLabelId('skip-premium-row')}
          checked={draft.practice.problemFilters.skipPremium}
          id="skip-premium"
          onChange={actions.setSkipPremium}
        />
      </SettingsRow>
    </SettingsSection>
  )
}
