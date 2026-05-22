import type { ReviewOrder, UserSettings } from '../../domain'
import type {
  SettingsDraftActions,
  SettingsFieldErrors,
  SettingsNumberInputs,
} from '../../hooks/use-settings-draft'
import {
  NumberControl,
  RetentionSlider,
  SegmentedControl,
  SwitchControl,
} from '../settings-controls'
import { readSettingsRowLabelId, SettingsRow } from '../settings-row'
import { SettingsSection } from '../settings-section'

const reviewOrderOptions: ReadonlyArray<{
  label: string
  value: ReviewOrder
}> = [
  { label: 'Due first', value: 'dueFirst' },
  { label: 'Weakest first', value: 'weakestFirst' },
  { label: 'Mix by difficulty', value: 'mixByDifficulty' },
]

interface AdvancedReviewSectionProps {
  actions: Pick<
    SettingsDraftActions,
    | 'setNumberInput'
    | 'setReviewOrder'
    | 'setStrictTiming'
    | 'setTargetRetention'
  >
  draft: UserSettings
  fieldErrors: SettingsFieldErrors
  numberInputs: SettingsNumberInputs
}

export function AdvancedReviewSection({
  actions,
  draft,
  fieldErrors,
  numberInputs,
}: AdvancedReviewSectionProps) {
  const isStrictTimingDisabled = !draft.assessment.requireSolveTime
  const targetRetentionHint =
    'Cards become due when recall drops below this threshold.'
  const reviewOrderHint =
    'Due first prioritizes scheduled reviews; weakest first prioritizes lower retention.'
  const strictTimingHint =
    'Requires solve time; over-time accepted solutions are saved as Again.'
  const timingTargetsHint =
    'Set target minutes by difficulty; keep easy below medium below hard.'

  return (
    <SettingsSection id="advanced-review-settings" title="Review & Timing">
      <SettingsRow
        controlClassName="w-full md:max-w-[34rem]"
        hint={targetRetentionHint}
        id="target-retention-row"
        label="Target retention"
        labelFor="target-retention"
      >
        <RetentionSlider
          id="target-retention"
          onChange={actions.setTargetRetention}
          value={draft.review.targetRetention}
        />
      </SettingsRow>
      <SettingsRow
        controlClassName="w-full md:max-w-[34rem]"
        hint={reviewOrderHint}
        id="review-order-row"
        label="Review order"
      >
        <SegmentedControl
          ariaLabelledBy={readSettingsRowLabelId('review-order-row')}
          label="Review order"
          name="review-order"
          onChange={actions.setReviewOrder}
          options={reviewOrderOptions}
          value={draft.review.order}
        />
      </SettingsRow>
      <SettingsRow
        controlClassName="w-full md:max-w-28"
        hint={strictTimingHint}
        id="strict-timing-row"
        label="Strict timing"
        labelFor="strict-timing"
      >
        <SwitchControl
          ariaLabelledBy={readSettingsRowLabelId('strict-timing-row')}
          checked={draft.assessment.strictTiming}
          disabled={isStrictTimingDisabled}
          disabledReason="Enable Require solve time before using strict timing."
          id="strict-timing"
          onChange={actions.setStrictTiming}
        />
      </SettingsRow>
      <SettingsRow
        controlClassName="w-fit max-w-full"
        hint={timingTargetsHint}
        id="timing-targets-row"
        label="Timing targets"
      >
        <TimingTargetsControl
          actions={actions}
          fieldErrors={fieldErrors}
          numberInputs={numberInputs}
        />
      </SettingsRow>
    </SettingsSection>
  )
}

const timingTargetFields = [
  {
    errorKey: 'easyTargetMinutes',
    id: 'easy-target-minutes',
    label: 'Easy',
  },
  {
    errorKey: 'mediumTargetMinutes',
    id: 'medium-target-minutes',
    label: 'Medium',
  },
  {
    errorKey: 'hardTargetMinutes',
    id: 'hard-target-minutes',
    label: 'Hard',
  },
] as const

interface TimingTargetsControlProps {
  actions: Pick<SettingsDraftActions, 'setNumberInput'>
  fieldErrors: SettingsFieldErrors
  numberInputs: SettingsNumberInputs
}

function TimingTargetsControl({
  actions,
  fieldErrors,
  numberInputs,
}: TimingTargetsControlProps) {
  return (
    <div className="grid w-fit max-w-full grid-cols-3 gap-2 sm:gap-3">
      {timingTargetFields.map((field) => {
        const error = fieldErrors[field.errorKey]
        const errorId = `${field.id}-error`

        return (
          <NumberControl
            ariaLabel={`${field.label} timing target`}
            className="w-20 md:w-20"
            error={error}
            errorMessageId={errorId}
            id={field.id}
            key={field.id}
            max={60}
            min={10}
            onChange={(value) => {
              actions.setNumberInput(field.errorKey, value)
            }}
            placeholder={field.label}
            value={numberInputs[field.errorKey]}
          />
        )
      })}
    </div>
  )
}
