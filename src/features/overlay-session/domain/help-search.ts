export type OverlayHelpSearchInput = {
  metadataTitle: string | null | undefined
  problemTitle: string | null | undefined
  problemSlug: string | null | undefined
}

export function selectOverlayHelpSearchQuery(
  input: OverlayHelpSearchInput,
): string | null {
  for (const candidate of [
    input.metadataTitle,
    input.problemTitle,
    input.problemSlug,
  ]) {
    const trimmedCandidate = candidate?.trim()

    if (trimmedCandidate) {
      return trimmedCandidate
    }
  }

  return null
}

export function createYouTubeSearchUrl(searchQuery: string): string | null {
  const trimmedQuery = searchQuery.trim()

  if (!trimmedQuery) {
    return null
  }

  const params = new URLSearchParams({ search_query: trimmedQuery })
  return `https://www.youtube.com/results?${params.toString()}`
}
