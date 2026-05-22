import { and, asc, eq } from 'drizzle-orm'

import { normalizeProblemDifficulty, type Problem } from '@/features/problems'
import type { Db } from '@/platform/db'
import {
  problems,
  trackGroupProblems,
  trackGroups,
  tracks,
  trackSession,
  type TrackGroupRow,
  type TrackRow,
} from '@/platform/db/schema'

import type { ActiveTrack, Track, TrackGroup, TrackProgress } from '../domain'

export function createTracksRepository(db: Db) {
  return new TracksRepository(db)
}

export class TracksRepository {
  constructor(private readonly db: Db) {}

  async getActiveTrack(): Promise<ActiveTrack | null> {
    const sessionRows = await this.db
      .select()
      .from(trackSession)
      .where(eq(trackSession.id, 'active'))
      .limit(1)
    const session = sessionRows[0]
    const track = session?.activeTrackId
      ? await this.getTrackById(session.activeTrackId)
      : await this.getFirstActiveTrack()

    if (!track) {
      return null
    }

    const preferredGroup = session?.activeGroupId
      ? await this.getGroupByIdForTrack(session.activeGroupId, track.id)
      : await this.getFirstGroup(track.id)
    const next = await this.getNextProblemInTrack(track.id, preferredGroup)

    return {
      track,
      activeGroup: next.group,
      progress: await this.getTrackProgress(track.id),
      nextProblem: next.problem,
    }
  }

  private async getTrackById(id: string) {
    const rows = await this.db
      .select()
      .from(tracks)
      .where(eq(tracks.id, id))
      .limit(1)

    return rows[0] ? mapTrack(rows[0]) : null
  }

  private async getFirstActiveTrack() {
    const rows = await this.db
      .select()
      .from(tracks)
      .where(eq(tracks.isActive, true))
      .orderBy(asc(tracks.createdAt))
      .limit(1)

    return rows[0] ? mapTrack(rows[0]) : null
  }

  private async getGroupByIdForTrack(id: string, trackId: string) {
    const rows = await this.db
      .select()
      .from(trackGroups)
      .where(and(eq(trackGroups.id, id), eq(trackGroups.trackId, trackId)))
      .limit(1)

    return rows[0] ? mapTrackGroup(rows[0]) : null
  }

  private async getFirstGroup(trackId: string) {
    const rows = await this.db
      .select()
      .from(trackGroups)
      .where(eq(trackGroups.trackId, trackId))
      .orderBy(asc(trackGroups.position))
      .limit(1)

    return rows[0] ? mapTrackGroup(rows[0]) : null
  }

  private async getTrackGroups(trackId: string) {
    const rows = await this.db
      .select()
      .from(trackGroups)
      .where(eq(trackGroups.trackId, trackId))
      .orderBy(asc(trackGroups.position))

    return rows.map(mapTrackGroup)
  }

  private async getNextProblemInTrack(
    trackId: string,
    preferredGroup: TrackGroup | null,
  ): Promise<{
    group: TrackGroup | null
    problem: Problem | null
  }> {
    const groups = await this.getTrackGroups(trackId)

    if (groups.length === 0) {
      return { group: null, problem: null }
    }

    const preferredIndex = preferredGroup
      ? groups.findIndex((group) => group.id === preferredGroup.id)
      : -1
    const startIndex = preferredIndex >= 0 ? preferredIndex : 0
    const candidateGroups = groups.slice(startIndex)

    for (const group of candidateGroups) {
      const problem = await this.getNextProblem(group.id)

      if (problem) {
        return { group, problem }
      }
    }

    return {
      group: preferredGroup ?? groups[0] ?? null,
      problem: null,
    }
  }

  private async getNextProblem(groupId: string) {
    const rows = await this.db
      .select({
        problem: problems,
      })
      .from(trackGroupProblems)
      .innerJoin(problems, eq(problems.id, trackGroupProblems.problemId))
      .where(eq(trackGroupProblems.trackGroupId, groupId))
      .orderBy(asc(trackGroupProblems.position))
      .limit(1)

    if (rows[0]) {
      return mapProblem(rows[0].problem)
    }

    return null
  }

  private async getTrackProgress(trackId: string): Promise<TrackProgress> {
    const rows = await this.db
      .select({
        problemId: trackGroupProblems.problemId,
      })
      .from(trackGroupProblems)
      .innerJoin(
        trackGroups,
        eq(trackGroups.id, trackGroupProblems.trackGroupId),
      )
      .where(eq(trackGroups.trackId, trackId))

    const totalCount = rows.length

    if (totalCount === 0) {
      return emptyProgress()
    }

    return {
      completedCount: 0,
      totalCount,
      percent: 0,
    }
  }
}

function emptyProgress(): TrackProgress {
  return {
    completedCount: 0,
    totalCount: 0,
    percent: 0,
  }
}

function mapTrack(row: TrackRow): Track {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    dueAt: row.dueAt === null ? null : new Date(row.dueAt),
    isActive: row.isActive,
  }
}

function mapTrackGroup(row: TrackGroupRow): TrackGroup {
  return {
    id: row.id,
    trackId: row.trackId,
    title: row.title,
    position: row.position,
  }
}

function mapProblem(row: typeof problems.$inferSelect): Problem {
  return {
    id: row.id,
    source: 'leetcode',
    externalId: row.externalId,
    slug: row.slug,
    title: row.title,
    difficulty: normalizeProblemDifficulty(row.difficulty),
    url: row.url,
    isPremium: row.isPremium,
    acceptanceRate: row.acceptanceRate,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  }
}
