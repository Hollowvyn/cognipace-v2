import { useState } from 'react'

import type { SerializedProblem } from '@/features/problems/api/problems-contracts'
import type { ProblemDifficulty } from '@/lib/problem-catalog'

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
    companyLabels: [...(labels.companyLabels ?? [])],
    difficulty: problem?.difficulty ?? 'unknown',
    isPremium: problem?.isPremium ?? false,
    slugOrUrl: problem?.slug ?? '',
    title: problem?.title ?? '',
    topicLabels: [...(labels.topicLabels ?? [])],
  }
}

export function useProblemForm(initialValues: ProblemFormValues) {
  const [values, setValues] = useState(initialValues)
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
