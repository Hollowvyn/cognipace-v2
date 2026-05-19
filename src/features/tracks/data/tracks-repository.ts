import { and, asc, eq, isNull, ne, or } from 'drizzle-orm'

import { normalizeProblemDifficulty, type Problem } from '@/features/problems'
import type { Db } from '@/platform/db'
import {
  problemPractice,
  problems,
  trackGroupProblems,
  trackGroups,
  tracks,
  trackSession,
  type TrackGroupRow,
  type TrackRow,
} from '@/platform/db/schema'

import type { ActiveTrack, Track, TrackGroup } from '../domain'

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

    const group = session?.activeGroupId
      ? await this.getGroupById(session.activeGroupId)
      : await this.getFirstGroup(track.id)

    return {
      track,
      activeGroup: group,
      nextProblem: group ? await this.getNextProblem(group.id) : null,
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
      .limit(1)

    return rows[0] ? mapTrack(rows[0]) : null
  }

  private async getGroupById(id: string) {
    const rows = await this.db
      .select()
      .from(trackGroups)
      .where(eq(trackGroups.id, id))
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

  private async getNextProblem(groupId: string) {
    const rows = await this.db
      .select({
        problem: problems,
      })
      .from(trackGroupProblems)
      .innerJoin(problems, eq(problems.id, trackGroupProblems.problemId))
      .leftJoin(problemPractice, eq(problemPractice.problemId, problems.id))
      .where(
        and(
          eq(trackGroupProblems.trackGroupId, groupId),
          or(
            isNull(problemPractice.status),
            ne(problemPractice.status, 'mastered'),
          ),
        ),
      )
      .orderBy(asc(trackGroupProblems.position))
      .limit(1)

    if (rows[0]) {
      return mapProblem(rows[0].problem)
    }

    return null
  }
}

function mapTrack(row: TrackRow): Track {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
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
