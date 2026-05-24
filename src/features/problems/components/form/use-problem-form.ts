import { useState } from 'react'

import type { SerializedProblem } from '@/features/problems/api/problems-contracts'
import type { ProblemDifficulty } from '@/features/problems/domain'

export interface ProblemFormValues {
  companyLabels: string[]
  difficulty: ProblemDifficulty
  isPremium: boolean
  slugOrUrl: string
  title: string
  topicLabels: string[]
}

export function createProblemFormValues(
  problem?: SerializedProblem,
  labels: {
    companyLabels?: readonly string[]
    topicLabels?: readonly string[]
  } = {},
): ProblemFormValues {
  return {
    companyLabels: normalizeProblemLabelList(labels.companyLabels ?? []),
    difficulty: problem?.difficulty ?? 'unknown',
    isPremium: problem?.isPremium ?? false,
    slugOrUrl: problem?.slug ?? '',
    title: problem?.title ?? '',
    topicLabels: normalizeProblemLabelList(labels.topicLabels ?? []),
  }
}

export function useProblemForm(
  initialValues: ProblemFormValues | (() => ProblemFormValues),
) {
  const [values, setValues] = useState<ProblemFormValues>(initialValues)
  const setField = <TKey extends keyof ProblemFormValues>(
    key: TKey,
    value: ProblemFormValues[TKey],
  ) => {
    setValues((current) => ({ ...current, [key]: value }))
  }

  return {
    setField,
    values,
  }
}

export function normalizeProblemLabelList(labels: readonly string[]) {
  const seenLabels = new Set<string>()
  const normalizedLabels: string[] = []

  for (const label of labels) {
    const normalizedLabel = normalizeProblemLabel(label)
    const key = normalizedLabel.toLowerCase()

    if (!normalizedLabel || seenLabels.has(key)) {
      continue
    }

    seenLabels.add(key)
    normalizedLabels.push(normalizedLabel)
  }

  return normalizedLabels
}

export function normalizeProblemLabel(label: string) {
  return label.trim().replace(/\s+/g, ' ')
}
