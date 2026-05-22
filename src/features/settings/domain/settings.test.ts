import { describe, expect, it } from 'vitest'

import { defaultUserSettings, parseStoredUserSettings } from './settings'

describe('settings domain', () => {
  it('merges older partial stored settings with current defaults', () => {
    expect(
      parseStoredUserSettings({
        dailyQuestionGoal: 7,
        studyMode: 'freePractice',
        notifications: {
          enabled: true,
        },
        timing: {
          hardMode: true,
        },
      }),
    ).toMatchObject({
      dailyQuestionGoal: 7,
      studyMode: 'freePractice',
      notifications: {
        enabled: true,
        dailyTime: defaultUserSettings.notifications.dailyTime,
      },
      timing: {
        requireSolveTime: defaultUserSettings.timing.requireSolveTime,
        hardMode: true,
        easyMinutes: defaultUserSettings.timing.easyMinutes,
        mediumMinutes: defaultUserSettings.timing.mediumMinutes,
        hardMinutes: defaultUserSettings.timing.hardMinutes,
      },
      experimental: {
        autoDetectSolved: true,
      },
    })
  })

  it('falls back to defaults for invalid stored settings', () => {
    expect(
      parseStoredUserSettings({
        dailyQuestionGoal: 0,
      }),
    ).toEqual(defaultUserSettings)
  })
})
