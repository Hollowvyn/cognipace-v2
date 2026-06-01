import { describe, expect, it } from 'vitest'

import {
  createUserSettingsPatch,
  defaultUserSettings,
  deriveNextThemeMode,
  hasUserSettingsChanges,
  mergeUserSettings,
  parseStoredUserSettings,
  userSettingsPatchSchema,
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

  it('defaults missing appearance settings to system without dropping valid stored values', () => {
    expect(
      parseStoredUserSettings({
        practice: {
          dailyGoal: 6,
          problemFilters: {
            skipPremium: true,
          },
        },
      }),
    ).toMatchObject({
      appearance: {
        themeMode: 'system',
      },
      practice: {
        dailyGoal: 6,
        mode: defaultUserSettings.practice.mode,
        problemFilters: {
          skipPremium: true,
        },
      },
    })
  })

  it('validates appearance mode at the domain boundary', () => {
    expect(userSettingsSchema.parse(defaultUserSettings).appearance).toEqual({
      themeMode: 'system',
    })
    expect(() =>
      userSettingsSchema.parse({
        ...defaultUserSettings,
        appearance: {
          themeMode: 'sepia',
        },
      }),
    ).toThrow()
  })

  it('uses default appearance for invalid stored appearance while preserving valid stored branches', () => {
    expect(
      parseStoredUserSettings({
        appearance: {
          themeMode: 'sepia',
        },
        practice: {
          dailyGoal: 6,
          problemFilters: {
            skipPremium: true,
          },
        },
      }),
    ).toMatchObject({
      appearance: {
        themeMode: 'system',
      },
      practice: {
        dailyGoal: 6,
        problemFilters: {
          skipPremium: true,
        },
      },
    })
  })

  it('patches appearance mode without dropping unrelated settings', () => {
    const draft = {
      ...defaultUserSettings,
      appearance: {
        themeMode: 'dark' as const,
      },
    }

    expect(createUserSettingsPatch(defaultUserSettings, draft)).toEqual({
      appearance: { themeMode: 'dark' },
    })
    expect(
      mergeUserSettings(defaultUserSettings, {
        appearance: { themeMode: 'light' },
      }),
    ).toEqual({
      ...defaultUserSettings,
      appearance: { themeMode: 'light' },
    })
  })

  it('keeps an empty appearance patch as a no-op', () => {
    const patch = userSettingsPatchSchema.parse({ appearance: {} })

    expect(
      mergeUserSettings(
        {
          ...defaultUserSettings,
          appearance: { themeMode: 'dark' },
        },
        patch,
      ).appearance,
    ).toEqual({ themeMode: 'dark' })
  })

  it('derives the next theme mode in repository-owned cycle order', () => {
    expect(deriveNextThemeMode('system')).toBe('light')
    expect(deriveNextThemeMode('light')).toBe('dark')
    expect(deriveNextThemeMode('dark')).toBe('system')
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

describe('aiAssessment settings', () => {
  it('parses old rows missing the aiAssessment block by filling defaults', () => {
    const oldRow = {
      schemaVersion: 1,
      appearance: { themeMode: 'system' },
      practice: {
        dailyGoal: 4,
        mode: 'studyPlan',
        problemFilters: { skipPremium: false },
      },
      review: { targetRetention: 0.9, order: 'dueFirst' },
      assessment: {
        requireSolveTime: false,
        strictTiming: false,
        timeTargetsMinutes: { easy: 20, medium: 35, hard: 50 },
      },
      overlay: { autoDetectSolved: true },
      reminders: { daily: { enabled: false, time: '09:00' } },
    }
    const parsed = parseStoredUserSettings(oldRow)
    expect(parsed.aiAssessment).toEqual({
      enabled: false,
      provider: 'openai',
      model: '',
    })
  })

  it('defaultUserSettings.aiAssessment matches documented defaults', () => {
    expect(defaultUserSettings.aiAssessment).toEqual({
      enabled: false,
      provider: 'openai',
      model: '',
    })
  })

  it('merges an aiAssessment patch into existing settings', () => {
    const next = mergeUserSettings(defaultUserSettings, {
      aiAssessment: { enabled: true, model: 'gpt-test' },
    })
    expect(next.aiAssessment).toEqual({
      enabled: true,
      provider: 'openai',
      model: 'gpt-test',
    })
  })

  it('createUserSettingsPatch produces a diff containing changed aiAssessment fields only', () => {
    const draft = {
      ...defaultUserSettings,
      aiAssessment: {
        ...defaultUserSettings.aiAssessment,
        enabled: true,
        provider: 'anthropic' as const,
      },
    }
    const patch = createUserSettingsPatch(defaultUserSettings, draft)
    expect(patch).toEqual({
      aiAssessment: { enabled: true, provider: 'anthropic' },
    })
  })

  it('rejects an invalid provider value', () => {
    expect(() =>
      mergeUserSettings(defaultUserSettings, {
        // @ts-expect-error — invalid provider id, deliberately ill-typed
        aiAssessment: { provider: 'mistral' },
      }),
    ).toThrow()
  })
})
