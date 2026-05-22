import { describe, expect, it } from 'vitest'

import {
  createUserSettingsPatch,
  defaultUserSettings,
  hasUserSettingsChanges,
  mergeUserSettings,
  parseStoredUserSettings,
  userSettingsSchema,
} from './settings'

describe('settings domain', () => {
  it('merges partial grouped stored settings with current defaults', () => {
    expect(
      parseStoredUserSettings({
        practice: {
          dailyGoal: 6,
          problemFilters: {
            skipPremium: true,
          },
        },
        overlay: {
          autoDetectSolved: false,
        },
      }),
    ).toMatchObject({
      practice: {
        dailyGoal: 6,
        mode: defaultUserSettings.practice.mode,
        problemFilters: {
          skipPremium: true,
        },
      },
      overlay: {
        autoDetectSolved: false,
      },
    })
  })

  it('falls back to defaults for invalid stored settings', () => {
    expect(
      parseStoredUserSettings({
        unknown: true,
      }),
    ).toEqual(defaultUserSettings)
    expect(
      parseStoredUserSettings({
        practice: {
          dailyGoal: 0,
        },
      }),
    ).toEqual(defaultUserSettings)
    expect(
      parseStoredUserSettings({
        assessment: {
          timeTargetsMinutes: {
            easy: 55,
          },
        },
      }),
    ).toEqual(defaultUserSettings)
  })

  it('validates settings bounds at the domain boundary', () => {
    expect(userSettingsSchema.parse(defaultUserSettings)).toEqual(
      defaultUserSettings,
    )
    expect(() =>
      userSettingsSchema.parse({
        ...defaultUserSettings,
        schemaVersion: 2,
      }),
    ).toThrow()
    expect(() =>
      userSettingsSchema.parse({
        ...defaultUserSettings,
        practice: {
          ...defaultUserSettings.practice,
          dailyGoal: 101,
        },
      }),
    ).toThrow()
    expect(() =>
      userSettingsSchema.parse({
        ...defaultUserSettings,
        review: {
          ...defaultUserSettings.review,
          targetRetention: 0.99,
        },
      }),
    ).toThrow()
    expect(() =>
      userSettingsSchema.parse({
        ...defaultUserSettings,
        assessment: {
          ...defaultUserSettings.assessment,
          timeTargetsMinutes: {
            ...defaultUserSettings.assessment.timeTargetsMinutes,
            easy: 9,
          },
        },
      }),
    ).toThrow()
    expect(() =>
      userSettingsSchema.parse({
        ...defaultUserSettings,
        assessment: {
          ...defaultUserSettings.assessment,
          timeTargetsMinutes: {
            ...defaultUserSettings.assessment.timeTargetsMinutes,
            hard: 61,
          },
        },
      }),
    ).toThrow()
    expect(() =>
      userSettingsSchema.parse({
        ...defaultUserSettings,
        assessment: {
          ...defaultUserSettings.assessment,
          timeTargetsMinutes: {
            easy: 35,
            medium: 35,
            hard: 50,
          },
        },
      }),
    ).toThrow()
    expect(() =>
      userSettingsSchema.parse({
        ...defaultUserSettings,
        assessment: {
          ...defaultUserSettings.assessment,
          strictTiming: true,
        },
      }),
    ).toThrow()
    expect(() =>
      userSettingsSchema.parse({
        ...defaultUserSettings,
        reminders: {
          daily: {
            enabled: true,
            time: '9:00',
          },
        },
      }),
    ).toThrow()
  })

  it('deep-merges nested settings patches without dropping siblings', () => {
    expect(
      mergeUserSettings(defaultUserSettings, {
        review: { order: 'weakestFirst' },
        assessment: { requireSolveTime: true, strictTiming: true },
      }),
    ).toEqual({
      ...defaultUserSettings,
      review: {
        ...defaultUserSettings.review,
        order: 'weakestFirst',
      },
      assessment: {
        ...defaultUserSettings.assessment,
        requireSolveTime: true,
        strictTiming: true,
      },
    })
  })

  it('creates minimal nested patches from saved settings and drafts', () => {
    const draft = {
      ...defaultUserSettings,
      practice: {
        ...defaultUserSettings.practice,
        dailyGoal: 8,
      },
      reminders: {
        daily: {
          ...defaultUserSettings.reminders.daily,
          enabled: true,
        },
      },
      assessment: {
        ...defaultUserSettings.assessment,
        timeTargetsMinutes: {
          ...defaultUserSettings.assessment.timeTargetsMinutes,
          medium: 40,
        },
      },
      overlay: {
        ...defaultUserSettings.overlay,
        autoDetectSolved: false,
      },
    }

    expect(createUserSettingsPatch(defaultUserSettings, draft)).toEqual({
      practice: { dailyGoal: 8 },
      reminders: { daily: { enabled: true } },
      assessment: { timeTargetsMinutes: { medium: 40 } },
      overlay: { autoDetectSolved: false },
    })
    expect(hasUserSettingsChanges(defaultUserSettings, draft)).toBe(true)
  })

  it('returns no patch when a draft matches saved settings', () => {
    expect(
      createUserSettingsPatch(defaultUserSettings, defaultUserSettings),
    ).toBeNull()
    expect(
      hasUserSettingsChanges(defaultUserSettings, defaultUserSettings),
    ).toBe(false)
  })
})
