import { z } from 'zod'

import { userSettingsPatchSchema, type UserSettings } from '../domain'

export const settingsSurfaceSchema = z.enum(['popup', 'dashboard'])

export const settingsRequestSchema = z.object({
  surface: settingsSurfaceSchema,
})

export const settingsUpdateRequestSchema = settingsRequestSchema.extend({
  patch: userSettingsPatchSchema,
})

export const settingsToggleStudyModeRequestSchema = settingsRequestSchema

export type SettingsSurface = z.infer<typeof settingsSurfaceSchema>
export type SettingsRequest = z.infer<typeof settingsRequestSchema>
export type SettingsUpdateRequest = z.infer<typeof settingsUpdateRequestSchema>
export type SettingsToggleStudyModeRequest = z.infer<
  typeof settingsToggleStudyModeRequestSchema
>
export type SettingsResponse = UserSettings
