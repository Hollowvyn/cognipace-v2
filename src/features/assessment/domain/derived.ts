import type { ProblemDifficulty } from '@/features/problems'

import type {
  AssessmentTimingSettings,
  LeetCodeAssessmentInput,
} from './assessment-types'

export type AssessmentDerivedSignals = {
  targetSeconds: number
  elapsedSeconds: number | null
  isUntimed: boolean
  isOverTarget: boolean
  ratioOfTarget: number | null
  isRecallReview: boolean | null
  beatsPreviousBest: boolean | null
}

const SECONDS_PER_MINUTE = 60

const timingGoalKeyByDifficulty = {
  easy: 'easy',
  medium: 'medium',
  hard: 'hard',
  unknown: 'hard',
} as const satisfies Record<ProblemDifficulty, 'easy' | 'medium' | 'hard'>

// Sole implementation. assessment.ts re-exports this via the domain barrel.
export function getLeetCodeSolveTimeTargetSeconds(
  difficulty: ProblemDifficulty,
  timing: AssessmentTimingSettings,
): number {
  const minutes =
    timing.timeTargetsMinutes[timingGoalKeyByDifficulty[difficulty]]

  return normalizePositiveInteger(minutes) * SECONDS_PER_MINUTE
}

export function deriveAssessmentSignals(
  input: LeetCodeAssessmentInput,
): AssessmentDerivedSignals {
  const targetSeconds = getLeetCodeSolveTimeTargetSeconds(
    input.difficulty,
    input.timing,
  )
  const elapsedSeconds = normalizeElapsedSeconds(input.elapsedSeconds)
  const isUntimed = input.timerUsed === false || elapsedSeconds === null
  const isOverTarget =
    elapsedSeconds !== null && elapsedSeconds > targetSeconds
  const ratioOfTarget =
    elapsedSeconds !== null && targetSeconds > 0
      ? elapsedSeconds / targetSeconds
      : null

  const practiceContext = input.practiceContext
  const isRecallReview =
    practiceContext == null ? null : !practiceContext.isFirstSolve
  const beatsPreviousBest = computeBeatsPreviousBest(
    elapsedSeconds,
    isUntimed,
    practiceContext?.previousBestSeconds ?? null,
  )

  return {
    targetSeconds,
    elapsedSeconds,
    isUntimed,
    isOverTarget,
    ratioOfTarget,
    isRecallReview,
    beatsPreviousBest,
  }
}

function computeBeatsPreviousBest(
  elapsedSeconds: number | null,
  isUntimed: boolean,
  previousBestSeconds: number | null,
): boolean | null {
  if (previousBestSeconds === null) {
    return null
  }
  if (isUntimed || elapsedSeconds === null) {
    return false
  }
  return elapsedSeconds < previousBestSeconds
}

function normalizeElapsedSeconds(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }
  const elapsedSeconds = Math.floor(value)
  return elapsedSeconds > 0 ? elapsedSeconds : null
}

function normalizePositiveInteger(value: number) {
  if (!Number.isFinite(value) || value < 1) {
    return 1
  }
  return Math.floor(value)
}
