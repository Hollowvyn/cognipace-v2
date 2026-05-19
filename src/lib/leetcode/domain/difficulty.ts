import type { LeetCodeDifficulty } from './types'

export function parseLeetCodeDifficulty(
  difficultyText: string | null | undefined,
): LeetCodeDifficulty {
  const normalizedDifficultyText = difficultyText?.trim().toLowerCase() ?? ''

  if (normalizedDifficultyText.includes('easy')) {
    return 'Easy'
  }

  if (normalizedDifficultyText.includes('medium')) {
    return 'Medium'
  }

  if (normalizedDifficultyText.includes('hard')) {
    return 'Hard'
  }

  return 'Unknown'
}
