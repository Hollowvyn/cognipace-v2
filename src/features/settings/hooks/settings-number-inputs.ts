import {
  dailyGoalSchema,
  timeTargetsMinutesSchema,
  timingTargetMinutesSchema,
  type UserSettings,
} from '../domain'

export type SettingsNumberField =
  | 'dailyGoal'
  | 'easyTargetMinutes'
  | 'mediumTargetMinutes'
  | 'hardTargetMinutes'

export type SettingsNumberInputs = Record<SettingsNumberField, string>
export type SettingsFieldErrors = Record<SettingsNumberField, string | null>

const timingNumberFields = [
  'easyTargetMinutes',
  'mediumTargetMinutes',
  'hardTargetMinutes',
] as const

const timingTargetToInputKey = {
  easy: 'easyTargetMinutes',
  medium: 'mediumTargetMinutes',
  hard: 'hardTargetMinutes',
} as const

export function applyNumberInputs(
  draft: UserSettings,
  numberInputs: SettingsNumberInputs,
): UserSettings {
  return {
    ...draft,
    practice: {
      ...draft.practice,
      dailyGoal: Number(numberInputs.dailyGoal),
    },
    assessment: {
      ...draft.assessment,
      timeTargetsMinutes: {
        easy: Number(numberInputs.easyTargetMinutes),
        medium: Number(numberInputs.mediumTargetMinutes),
        hard: Number(numberInputs.hardTargetMinutes),
      },
    },
  }
}

export function createNumberInputs(
  settings: UserSettings,
): SettingsNumberInputs {
  return {
    dailyGoal: String(settings.practice.dailyGoal),
    easyTargetMinutes: String(settings.assessment.timeTargetsMinutes.easy),
    mediumTargetMinutes: String(settings.assessment.timeTargetsMinutes.medium),
    hardTargetMinutes: String(settings.assessment.timeTargetsMinutes.hard),
  }
}

export function createFieldErrors(
  numberInputs: SettingsNumberInputs,
): SettingsFieldErrors {
  const errors: SettingsFieldErrors = {
    dailyGoal: validateNumberInput(numberInputs.dailyGoal, dailyGoalSchema),
    easyTargetMinutes: validateNumberInput(
      numberInputs.easyTargetMinutes,
      timingTargetMinutesSchema,
    ),
    mediumTargetMinutes: validateNumberInput(
      numberInputs.mediumTargetMinutes,
      timingTargetMinutesSchema,
    ),
    hardTargetMinutes: validateNumberInput(
      numberInputs.hardTargetMinutes,
      timingTargetMinutesSchema,
    ),
  }

  const parsedTimingTargets = readParsedTimingTargets(numberInputs, errors)

  if (parsedTimingTargets) {
    const result = timeTargetsMinutesSchema.safeParse(parsedTimingTargets)

    if (!result.success) {
      for (const issue of result.error.issues) {
        const targetKey = issue.path[0]

        if (
          targetKey === 'easy' ||
          targetKey === 'medium' ||
          targetKey === 'hard'
        ) {
          const inputKey = timingTargetToInputKey[targetKey]
          errors[inputKey] ??= issue.message
        }
      }
    }
  }

  return errors
}

export function hasNumberInputTextChanges(
  draft: UserSettings | null,
  numberInputs: SettingsNumberInputs,
) {
  if (!draft) {
    return false
  }

  const draftInputs = createNumberInputs(draft)

  return (
    numberInputs.dailyGoal !== draftInputs.dailyGoal ||
    numberInputs.easyTargetMinutes !== draftInputs.easyTargetMinutes ||
    numberInputs.mediumTargetMinutes !== draftInputs.mediumTargetMinutes ||
    numberInputs.hardTargetMinutes !== draftInputs.hardTargetMinutes
  )
}

function readParsedTimingTargets(
  numberInputs: SettingsNumberInputs,
  fieldErrors: SettingsFieldErrors,
) {
  if (timingNumberFields.some((field) => fieldErrors[field])) {
    return null
  }

  return {
    easy: Number(numberInputs.easyTargetMinutes),
    medium: Number(numberInputs.mediumTargetMinutes),
    hard: Number(numberInputs.hardTargetMinutes),
  }
}

function validateNumberInput(value: string, schema: typeof dailyGoalSchema) {
  if (value.trim() === '') {
    return 'Required'
  }

  if (!/^\d+$/.test(value)) {
    return 'Use a whole number'
  }

  const parsed = Number(value)
  const result = schema.safeParse(parsed)

  return result.success
    ? null
    : (result.error.issues[0]?.message ?? 'Invalid value')
}
