export type ProblemSlug = string

export const problemDifficulties = [
  'easy',
  'medium',
  'hard',
  'unknown',
] as const

export type ProblemDifficulty = (typeof problemDifficulties)[number]
