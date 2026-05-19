import type { LeetCodeProblemMetadata } from '../domain/types'

export function createLeetCodeProblemMetadataFingerprint(
  metadata: LeetCodeProblemMetadata,
) {
  return JSON.stringify({
    slug: metadata.location.slug,
    title: metadata.title,
    frontendId: metadata.frontendId,
    difficulty: metadata.difficulty,
    isPremium: metadata.isPremium,
    topics: metadata.topics
      .map((topic) => ({
        name: topic.name,
        slug: topic.slug,
      }))
      .sort((left, right) =>
        `${left.slug ?? ''}:${left.name}`.localeCompare(
          `${right.slug ?? ''}:${right.name}`,
        ),
      ),
  })
}
