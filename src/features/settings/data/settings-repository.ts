import { eq } from 'drizzle-orm'

import type { Db } from '@/platform/db'
import { settingsKv } from '@/platform/db/schema'

import {
  defaultUserSettings,
  mergeUserSettings,
  parseStoredUserSettings,
  type UserSettings,
  type UserSettingsPatch,
} from '../domain'

const settingsKey = 'user-settings'
type UserSettingsPatchInput =
  | UserSettingsPatch
  | ((currentSettings: UserSettings) => UserSettingsPatch)

export function createSettingsRepository(db: Db) {
  return new SettingsRepository(db)
}

export class SettingsRepository {
  constructor(private readonly db: Db) {}

  async getSettings(): Promise<UserSettings> {
    return this.readSettings(this.db)
  }

  async updateSettings(patchInput: UserSettingsPatchInput, now = new Date()) {
    return this.db.transaction(async (transactionDb) => {
      const currentSettings = await this.readSettings(transactionDb)
      const patch =
        typeof patchInput === 'function'
          ? patchInput(currentSettings)
          : patchInput
      const nextSettings = mergeUserSettings(currentSettings, patch)
      const timestamp = now.getTime()

      await transactionDb
        .insert(settingsKv)
        .values({
          key: settingsKey,
          value: JSON.stringify(nextSettings),
          updatedAt: timestamp,
        })
        .onConflictDoUpdate({
          target: settingsKv.key,
          set: {
            value: JSON.stringify(nextSettings),
            updatedAt: timestamp,
          },
        })

      return nextSettings
    })
  }

  async toggleStudyMode(now = new Date()) {
    return this.updateSettings(
      (currentSettings) => ({
        practice: {
          mode:
            currentSettings.practice.mode === 'studyPlan'
              ? 'freePractice'
              : 'studyPlan',
        },
      }),
      now,
    )
  }

  private async readSettings(db: SettingsReadDb): Promise<UserSettings> {
    const rows = await db
      .select()
      .from(settingsKv)
      .where(eq(settingsKv.key, settingsKey))
      .limit(1)

    if (!rows[0]) {
      return defaultUserSettings
    }

    try {
      return parseStoredUserSettings(JSON.parse(rows[0].value))
    } catch {
      return defaultUserSettings
    }
  }
}

type SettingsReadDb = Pick<Db, 'select'>
