import { Badge, type BadgeProps } from '@/components/ui/badge'
import type { Tone } from '@/components/ui/types'

export interface ProblemDifficultyBadgeProps extends Omit<
  BadgeProps,
  'children' | 'tone'
> {
  difficulty?: string | null | undefined
}

export function ProblemDifficultyBadge({
  difficulty,
  ...props
}: ProblemDifficultyBadgeProps) {
  return (
    <Badge tone={getProblemDifficultyTone(difficulty)} {...props}>
      {formatProblemDifficulty(difficulty)}
    </Badge>
  )
}

export function formatProblemDifficulty(difficulty: string | null | undefined) {
  if (!difficulty) {
    return 'Unknown'
  }

  return difficulty[0]?.toUpperCase() + difficulty.slice(1)
}

export function getProblemDifficultyTone(
  difficulty: string | null | undefined,
): Tone {
  switch (difficulty) {
    case 'easy':
      return 'leetcode-easy'
    case 'medium':
      return 'leetcode-medium'
    case 'hard':
      return 'leetcode-hard'
    default:
      return 'neutral'
  }
}
