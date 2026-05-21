import { z } from 'zod'

import {
  practiceDetailsSchema,
  practiceSummarySchema,
} from '@/features/practice'
import { problemDifficulties } from '@/features/problems'
import { userSettingsSchema } from '@/features/settings'

export const appShellRequestSchema = z.discriminatedUnion('surface', [
  z.object({ surface: z.literal('popup') }),
  z.object({ surface: z.literal('dashboard') }),
  z.object({
    surface: z.literal('overlay'),
    problemSlug: z.string().optional(),
  }),
])

export type AppShellRequest = z.infer<typeof appShellRequestSchema>

const appShellMetricSchema = z.object({
  label: z.string(),
  value: z.string(),
})

const appShellProblemSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  difficulty: z.enum(problemDifficulties),
  url: z.string(),
  isPremium: z.boolean(),
})

const appShellQueueItemSchema = z.object({
  category: z.enum(['due', 'new', 'reinforcement']),
  problem: appShellProblemSummarySchema,
  dueAt: z.string().nullable(),
  activeTrackPosition: z.number().nullable(),
  summary: practiceSummarySchema,
})

const appShellRecommendationSchema = z.object({
  title: z.string(),
  detail: z.string(),
  category: z.enum(['due', 'new', 'reinforcement']).nullable(),
  problem: appShellProblemSummarySchema.nullable(),
  dueAt: z.string().nullable(),
})

const appShellActiveTrackSchema = z.object({
  title: z.string(),
  detail: z.string(),
  nextProblem: appShellProblemSummarySchema.nullable(),
})

const overlayNextStepSchema = z.object({
  kind: z.enum(['track', 'recommendation', 'empty']),
  title: z.string(),
  detail: z.string(),
  problem: appShellProblemSummarySchema.nullable(),
  category: z.enum(['due', 'new', 'reinforcement']).nullable(),
  dueAt: z.string().nullable(),
})

const appShellTimingSettingsSchema = userSettingsSchema.shape.timing

const appShellSettingsSummarySchema = z.object({
  timing: appShellTimingSettingsSchema,
  memoryReview: userSettingsSchema.shape.memoryReview,
  questionFilters: userSettingsSchema.shape.questionFilters,
})

const appShellBaseDataSchema = z.object({
  generatedAt: z.iso.datetime(),
  status: z.object({
    label: z.string(),
    detail: z.string(),
  }),
  metrics: z.array(appShellMetricSchema),
  recommendation: appShellRecommendationSchema,
  activeTrack: appShellActiveTrackSchema,
  queue: z.object({
    dailyGoal: z.number().int().min(0),
    dueCount: z.number().int().min(0),
    newCount: z.number().int().min(0),
    reinforcementCount: z.number().int().min(0),
    items: z.array(appShellQueueItemSchema),
  }),
  settings: appShellSettingsSummarySchema,
})

export const popupAppShellDataSchema = appShellBaseDataSchema.extend({
  surface: z.literal('popup'),
  popup: z.object({
    queuePreview: z.array(appShellQueueItemSchema),
  }),
})

export const dashboardAppShellDataSchema = appShellBaseDataSchema.extend({
  surface: z.literal('dashboard'),
  dashboard: z.object({
    queuePreview: z.array(appShellQueueItemSchema),
  }),
})

export const overlayAppShellDataSchema = z.object({
  generatedAt: z.iso.datetime(),
  surface: z.literal('overlay'),
  overlay: z.object({
    problem: appShellProblemSummarySchema.nullable(),
    practice: practiceDetailsSchema.nullable(),
    timing: appShellTimingSettingsSchema,
    nextStep: overlayNextStepSchema.nullable(),
  }),
})

export const appShellDataSchema = z.discriminatedUnion('surface', [
  popupAppShellDataSchema,
  dashboardAppShellDataSchema,
  overlayAppShellDataSchema,
])

export type AppShellData = z.infer<typeof appShellDataSchema>
export type PopupAppShellData = z.infer<typeof popupAppShellDataSchema>
export type DashboardAppShellData = z.infer<typeof dashboardAppShellDataSchema>
export type OverlayAppShellData = z.infer<typeof overlayAppShellDataSchema>
export type AppShellQueueItem = z.infer<typeof appShellQueueItemSchema>
export type AppShellProblemSummary = z.infer<typeof appShellProblemSummarySchema>
export type OverlayNextStep = z.infer<typeof overlayNextStepSchema>
