import type { QueryClient, QueryKey } from '@tanstack/react-query'

import { queryKeys } from './query-keys'

export const cacheInvalidationTags = [
  'analytics',
  'app-shell',
  'practice',
  'problems',
  'queue',
  'settings',
  'sync',
  'tracks',
] as const

export type CacheInvalidationTag = (typeof cacheInvalidationTags)[number]

const queryKeysByInvalidationTag = {
  analytics: [queryKeys.analytics.all],
  'app-shell': [queryKeys.appShell.all],
  practice: [
    queryKeys.practice.all,
    queryKeys.analytics.all,
  ],
  problems: [
    queryKeys.problems.all,
    queryKeys.appShell.all,
    queryKeys.practice.all,
    queryKeys.queue.all,
    queryKeys.tracks.all,
  ],
  queue: [queryKeys.queue.all],
  settings: [
    queryKeys.settings.all,
    queryKeys.appShell.all,
    queryKeys.analytics.all,
    queryKeys.practice.all,
    queryKeys.queue.all,
    queryKeys.tracks.all,
  ],
  sync: [queryKeys.sync.all],
  tracks: [queryKeys.tracks.all, queryKeys.appShell.all],
} satisfies Record<CacheInvalidationTag, readonly QueryKey[]>

export function readQueryKeysForInvalidation(
  tags: readonly CacheInvalidationTag[],
) {
  const seen = new Set<string>()
  const queryKeysToInvalidate: QueryKey[] = []

  for (const tag of tags) {
    for (const queryKey of queryKeysByInvalidationTag[tag]) {
      const key = JSON.stringify(queryKey)

      if (seen.has(key)) {
        continue
      }

      seen.add(key)
      queryKeysToInvalidate.push(queryKey)
    }
  }

  return queryKeysToInvalidate
}

export function invalidateTaggedQueries(
  queryClient: QueryClient,
  tags: readonly CacheInvalidationTag[],
) {
  for (const queryKey of readQueryKeysForInvalidation(tags)) {
    void queryClient.invalidateQueries({ queryKey })
  }
}
