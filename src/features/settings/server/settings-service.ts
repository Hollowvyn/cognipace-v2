import type { Db } from '@/platform/db'

import { createSettingsRepository } from '../data/settings-repository'
import type { UserSettingsPatch } from '../domain'

export function getSettings(db: Db) {
  return createSettingsRepository(db).getSettings()
}

export function updateSettings(db: Db, patch: UserSettingsPatch) {
  return createSettingsRepository(db).updateSettings(patch)
}
