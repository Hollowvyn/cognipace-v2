import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { settingsKv } from '@/platform/db/schema'
import { createTestDb } from '@/platform/db/test-db'

import { defaultUserSettings } from '../domain'
import { createSettingsRepository } from './settings-repository'

describe('SettingsRepository', () => {
  it('returns defaults when no settings row exists', async () => {
    const handle = await createTestDb({ seed: false })

    await expect(
      createSettingsRepository(handle.db).getSettings(),
    ).resolves.toEqual(defaultUserSettings)
  })

  it('falls back to defaults for unreadable stored settings', async () => {
    for (const value of ['{bad-json', JSON.stringify({ unknown: true })]) {
      const handle = await createTestDb({ seed: false })
      await handle.db.insert(settingsKv).values({
        key: 'user-settings',
        value,
        updatedAt: 1,
      })

      await expect(
        createSettingsRepository(handle.db).getSettings(),
      ).resolves.toEqual(defaultUserSettings)
    }
  })

  it('upserts a single settings row and preserves nested siblings', async () => {
    const handle = await createTestDb({ seed: false })
    const repository = createSettingsRepository(handle.db)
    const firstWriteAt = new Date('2026-01-01T00:00:00.000Z')
    const secondWriteAt = new Date('2026-01-02T00:00:00.000Z')

    await repository.updateSettings(
      {
        reminders: { daily: { enabled: true } },
        assessment: { requireSolveTime: true, strictTiming: true },
      },
      firstWriteAt,
    )
    const saved = await repository.updateSettings(
      {
        reminders: { daily: { time: '18:30' } },
        assessment: { timeTargetsMinutes: { medium: 42 } },
      },
      secondWriteAt,
    )
    const rows = await handle.db
      .select()
      .from(settingsKv)
      .where(eq(settingsKv.key, 'user-settings'))

    expect(rows).toHaveLength(1)
    expect(rows[0]?.updatedAt).toBe(secondWriteAt.getTime())
    expect(saved).toEqual({
      ...defaultUserSettings,
      reminders: {
        daily: {
          enabled: true,
          time: '18:30',
        },
      },
      assessment: {
        ...defaultUserSettings.assessment,
        requireSolveTime: true,
        strictTiming: true,
        timeTargetsMinutes: {
          ...defaultUserSettings.assessment.timeTargetsMinutes,
          medium: 42,
        },
      },
    })
    await expect(repository.getSettings()).resolves.toEqual(saved)
  })

  it('toggles study mode through the generic settings write path', async () => {
    const handle = await createTestDb({ seed: false })
    const repository = createSettingsRepository(handle.db)

    await repository.updateSettings({
      practice: { dailyGoal: 12 },
      reminders: { daily: { enabled: true } },
      assessment: { timeTargetsMinutes: { hard: 60 } },
    })

    await expect(repository.toggleStudyMode()).resolves.toEqual({
      ...defaultUserSettings,
      practice: {
        ...defaultUserSettings.practice,
        dailyGoal: 12,
        mode: 'freePractice',
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
          hard: 60,
        },
      },
    })
    await expect(repository.toggleStudyMode()).resolves.toMatchObject({
      practice: {
        dailyGoal: 12,
        mode: 'studyPlan',
      },
      reminders: {
        daily: {
          enabled: true,
        },
      },
      assessment: {
        timeTargetsMinutes: {
          hard: 60,
        },
      },
    })
  })

  it('cycles theme mode through the generic settings write path', async () => {
    const handle = await createTestDb({ seed: false })
    const repository = createSettingsRepository(handle.db)

    await repository.updateSettings({
      practice: { dailyGoal: 12 },
      appearance: { themeMode: 'system' },
    })

    await expect(repository.cycleThemeMode()).resolves.toEqual({
      ...defaultUserSettings,
      appearance: { themeMode: 'light' },
      practice: {
        ...defaultUserSettings.practice,
        dailyGoal: 12,
      },
    })
    await expect(repository.cycleThemeMode()).resolves.toMatchObject({
      appearance: { themeMode: 'dark' },
      practice: { dailyGoal: 12 },
    })
    await expect(repository.cycleThemeMode()).resolves.toMatchObject({
      appearance: { themeMode: 'system' },
      practice: { dailyGoal: 12 },
    })
  })
})
