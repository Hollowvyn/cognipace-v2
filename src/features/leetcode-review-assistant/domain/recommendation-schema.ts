import { z } from 'zod'

import {
  PROMPT_VERSION,
  assessmentRecommendationConfidenceLevels,
  assessmentRecommendationRatings,
  type AssessmentRecommendation,
} from './recommendation-types'

const EVIDENCE_MAX_ITEMS = 5
const IMPROVEMENT_POINTS_MAX_ITEMS = 5
const EDGE_CASE_NOTES_MAX_ITEMS = 5
const SHORT_TEXT_MAX_CHARS = 200
const COMPLEXITY_MAX_CHARS = 80

const shortText = z.string().min(1).max(SHORT_TEXT_MAX_CHARS)
const evidenceItemSchema = z.string().min(1).max(SHORT_TEXT_MAX_CHARS)
const improvementItemSchema = z.string().min(1).max(SHORT_TEXT_MAX_CHARS)
const edgeCaseItemSchema = z.string().min(1).max(SHORT_TEXT_MAX_CHARS)

export const assessmentRecommendationSchema = z
  .object({
    recommendedRating: z.enum(assessmentRecommendationRatings),
    confidence: z.enum(assessmentRecommendationConfidenceLevels),
    summary: shortText,
    primaryReason: shortText,
    evidence: z.array(evidenceItemSchema).max(EVIDENCE_MAX_ITEMS),
    complexity: z
      .object({
        time: z.string().min(1).max(COMPLEXITY_MAX_CHARS),
        space: z.string().min(1).max(COMPLEXITY_MAX_CHARS),
        confidence: z.enum(assessmentRecommendationConfidenceLevels),
      })
      .strict(),
    improvementPoints: z
      .array(improvementItemSchema)
      .max(IMPROVEMENT_POINTS_MAX_ITEMS),
    edgeCaseNotes: z.array(edgeCaseItemSchema).max(EDGE_CASE_NOTES_MAX_ITEMS),
    shouldUpdateRating: z.boolean(),
    promptVersion: z.literal(PROMPT_VERSION),
  })
  .strict() satisfies z.ZodType<AssessmentRecommendation>

export const assessmentRecommendationSchemaLimits = {
  evidenceMaxItems: EVIDENCE_MAX_ITEMS,
  improvementPointsMaxItems: IMPROVEMENT_POINTS_MAX_ITEMS,
  edgeCaseNotesMaxItems: EDGE_CASE_NOTES_MAX_ITEMS,
  shortTextMaxChars: SHORT_TEXT_MAX_CHARS,
  complexityMaxChars: COMPLEXITY_MAX_CHARS,
} as const
