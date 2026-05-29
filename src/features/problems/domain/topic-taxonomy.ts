import { normalizeLeetCodeSlug } from '@/lib/leetcode'

export interface TopicSummary {
  id: string
  label: string
}

export function normalizeTopicLookupKey(value: string) {
  return normalizeLeetCodeSlug(value)
}

export function normalizeTopicLabelList(labels: readonly string[]) {
  const seen = new Set<string>()
  const normalizedLabels: string[] = []

  for (const label of labels) {
    const normalizedLabel = label.trim().replace(/\s+/g, ' ')
    const key = normalizeTopicLookupKey(normalizedLabel)

    if (!normalizedLabel || seen.has(key)) {
      continue
    }

    seen.add(key)
    normalizedLabels.push(normalizedLabel)
  }

  return normalizedLabels
}

export function createTopicId(label: string) {
  return normalizeTopicLookupKey(label)
}
