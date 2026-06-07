import { z } from 'zod'

export const devSmokeRequestSchema = z.object({
  surface: z.literal('dashboard'),
  runLiveGenAi: z.boolean().optional(),
})

export type DevSmokeRequest = z.infer<typeof devSmokeRequestSchema>

export const devSmokeCheckStatusSchema = z.enum([
  'pass',
  'fail',
  'skip',
  'warn',
])

export const devSmokeCheckSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: devSmokeCheckStatusSchema,
  detail: z.string(),
  latencyMs: z.number().int().nonnegative().optional(),
})

export const devSmokeReportSchema = z.object({
  generatedAt: z.iso.datetime(),
  checks: z.array(devSmokeCheckSchema),
})

export type DevSmokeReport = z.infer<typeof devSmokeReportSchema>
