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

export function createSettingsRepository(db: Db) {
  return new SettingsRepository(db)
}

export class SettingsRepository {
  constructor(private readonly db: Db) {}

  async getSettings(): Promise<UserSettings> {
    const rows = await this.db
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

  async updateSettings(patch: UserSettingsPatch, now = new Date()) {
    const nextSettings = mergeUserSettings(await this.getSettings(), patch)

    await this.db
      .insert(settingsKv)
      .values({
        key: settingsKey,
        value: JSON.stringify(nextSettings),
        updatedAt: now.getTime(),
      })
      .onConflictDoUpdate({
        target: settingsKv.key,
        set: {
          value: JSON.stringify(nextSettings),
          updatedAt: now.getTime(),
        },
      })

    return nextSettings
  }
}
