async getTracksByProblemSlug(problemSlug: string): Promise<Track[]> {
  const rows = await this.db
    .select({ track: tracks })
    .from(tracks)
    .innerJoin(trackGroups, eq(trackGroups.trackId, tracks.id))
    .innerJoin(
      trackGroupProblems,
      eq(trackGroupProblems.trackGroupId, trackGroups.id),
    )
    .where(eq(trackGroupProblems.problemSlug, problemSlug))
    .orderBy(asc(tracks.title))

  const seen = new Set<string>()
  const result: Track[] = []

  for (const row of rows) {
    if (!seen.has(row.track.id)) {
      seen.add(row.track.id)
      result.push(mapTrack(row.track))
    }
  }

  return result
}
