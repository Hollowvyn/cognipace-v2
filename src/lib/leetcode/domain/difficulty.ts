import type { LeetCodeDifficulty } from './types'

export function parseLeetCodeDifficulty(
  value: string | null | undefined,
): LeetCodeDifficulty {
  const normalized = value?.trim().toLowerCase() ?? ''

  if (normalized.includes('easy')) {
    return 'Easy'
  }

  if (normalized.includes('medium')) {
    return 'Medium'
  }

  if (normalized.includes('hard')) {
    return 'Hard'
  }

  return 'Unknown'
}
