import { z } from 'zod'

export const reviewOrderSchema = z.enum([
  'dueFirst',
  'weakestFirst',
  'mixByDifficulty',
])
export const studyModeSchema = z.enum(['studyPlan', 'freePractice'])

export const userSettingsSchema = z.object({
  dailyQuestionGoal: z.number().int().min(1).max(100),
  studyMode: studyModeSchema,
  notifications: z.object({
    enabled: z.boolean(),
    dailyTime: z.string(),
  }),
  memoryReview: z.object({
    targetRetention: z.number().min(0.7).max(0.97),
    reviewOrder: reviewOrderSchema,
  }),
  questionFilters: z.object({
    skipPremium: z.boolean(),
  }),
  timing: z.object({
    requireSolveTime: z.boolean(),
    hardMode: z.boolean(),
    easyMinutes: z.number().int().min(1),
    mediumMinutes: z.number().int().min(1),
    hardMinutes: z.number().int().min(1),
  }),
  experimental: z.object({
    autoDetectSolved: z.boolean().default(true),
  }),
})

export const userSettingsPatchSchema = z.object({
  dailyQuestionGoal: userSettingsSchema.shape.dailyQuestionGoal.optional(),
  studyMode: studyModeSchema.optional(),
  notifications: userSettingsSchema.shape.notifications.partial().optional(),
  memoryReview: userSettingsSchema.shape.memoryReview.partial().optional(),
  questionFilters: userSettingsSchema.shape.questionFilters
    .partial()
    .optional(),
  timing: userSettingsSchema.shape.timing.partial().optional(),
  experimental: userSettingsSchema.shape.experimental.partial().optional(),
})

export type UserSettings = z.infer<typeof userSettingsSchema>
export type UserSettingsPatch = z.infer<typeof userSettingsPatchSchema>
export type ReviewOrder = z.infer<typeof reviewOrderSchema>
export type StudyMode = z.infer<typeof studyModeSchema>

export const defaultUserSettings: UserSettings = {
  dailyQuestionGoal: 4,
  studyMode: 'studyPlan',
  notifications: {
    enabled: false,
    dailyTime: '09:00',
  },
  memoryReview: {
    targetRetention: 0.9,
    reviewOrder: 'dueFirst',
  },
  questionFilters: {
    skipPremium: false,
  },
  timing: {
    requireSolveTime: false,
    hardMode: false,
    easyMinutes: 20,
    mediumMinutes: 35,
    hardMinutes: 50,
  },
  experimental: {
    autoDetectSolved: true,
  },
}

export function parseStoredUserSettings(value: unknown): UserSettings {
  const parsed = userSettingsSchema.safeParse(value)

  if (parsed.success) {
    return parsed.data
  }

  const patch = userSettingsPatchSchema.safeParse(value)

  return patch.success
    ? mergeUserSettings(defaultUserSettings, patch.data)
    : defaultUserSettings
}

export function mergeUserSettings(
  current: UserSettings,
  patch: UserSettingsPatch,
): UserSettings {
  return userSettingsSchema.parse({
    ...current,
    ...patch,
    notifications: {
      ...current.notifications,
      ...patch.notifications,
    },
    memoryReview: {
      ...current.memoryReview,
      ...patch.memoryReview,
    },
    questionFilters: {
      ...current.questionFilters,
      ...patch.questionFilters,
    },
    timing: {
      ...current.timing,
      ...patch.timing,
    },
    experimental: {
      ...current.experimental,
      ...patch.experimental,
    },
  })
}
