import { titleFromLeetCodeSlug } from '../domain/problem-url'
import type {
  LeetCodeMetadataResult,
  LeetCodePageSnapshot,
  LeetCodeProblemLocation,
  LeetCodeProblemMetadata,
} from '../domain/types'
import { readLeetCodePageSnapshot } from '../page/page-snapshot-reader'
import { fetchLeetCodeProblemMetadata } from './graphql-metadata-source'

export async function readLeetCodeProblemMetadata(
  location: LeetCodeProblemLocation,
  options: {
    root?: ParentNode | undefined
    document?: Document | undefined
    fetch?: typeof fetch | undefined
    now?: (() => number) | undefined
  } = {},
): Promise<LeetCodeMetadataResult> {
  const graphqlResult = await fetchLeetCodeProblemMetadata(location, {
    fetch: options.fetch,
    document: options.document,
    now: options.now,
  })

  if (graphqlResult.ok) {
    return graphqlResult
  }

  const snapshot = options.root
    ? readLeetCodePageSnapshot(options.root, { location, now: options.now })
    : null

  if (!snapshot) {
    return {
      ok: true,
      metadata: {
        location,
        title: titleFromLeetCodeSlug(location.slug),
        frontendId: null,
        difficulty: 'Unknown',
        isPremium: null,
        topics: [],
        source: 'fallback',
        confidence: 'low',
        capturedAt: options.now?.() ?? Date.now(),
      },
    }
  }

  return {
    ok: true,
    metadata: createLeetCodeMetadataFromSnapshot(snapshot),
  }
}

export function createLeetCodeMetadataFromSnapshot(
  snapshot: LeetCodePageSnapshot,
): LeetCodeProblemMetadata {
  const hasSpecificMetadata =
    snapshot.difficulty !== 'Unknown' || snapshot.topics.length > 0

  return {
    location: snapshot.location,
    title: snapshot.title ?? titleFromLeetCodeSlug(snapshot.location.slug),
    frontendId: snapshot.frontendId,
    difficulty: snapshot.difficulty,
    isPremium: snapshot.isPremium,
    topics: snapshot.topics,
    source: snapshot.isReady ? 'dom' : 'fallback',
    confidence: snapshot.title && hasSpecificMetadata ? 'medium' : 'low',
    capturedAt: snapshot.capturedAt,
  }
}
