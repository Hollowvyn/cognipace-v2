import { and, asc, eq, inArray, isNull } from 'drizzle-orm'

import { normalizeProblemDifficulty, type Problem } from '@/features/problems'
import { normalizeLeetCodeSlug, parseLeetCodeProblemInput } from '@/lib/leetcode'
import type { Db } from '@/platform/db'
import {
  problems,
  trackGroupProblems,
  trackGroups,
  trackProblemProgress,
  tracks,
  trackSession,
  type TrackGroupRow,
  type TrackRow,
} from '@/platform/db/schema'

import type {
  ActiveTrack,
  CreateTrackInput,
  Track,
  TrackCatalogItem,
  TrackCompletedRating,
  TrackCompletionInput,
  TrackGroup,
  TrackGroupInput,
  TrackProblemMembership,
  TrackProgress,
  TrackSessionState,
  UpdateTrackInput,
} from '../domain/track'

export function createTracksRepository(db: Db) {
  return new TracksRepository(db)
}

export class TracksRepository {
  constructor(private readonly db: Db) {}

  async getActiveTrack(): Promise<ActiveTrack | null> {
    const session = await this.getSession()

    if (!session.activeTrack) {
      return null
    }

    const preferredGroup =
      session.activeGroup ?? (await readFirstGroup(this.db, session.activeTrack.id))
    const next = await this.getNextProblemInTrack(
      session.activeTrack.id,
      preferredGroup,
    )
    const progressByTrack = await this.getProgressByTrack([
      session.activeTrack.id,
    ])

    return {
      track: session.activeTrack,
      activeGroup: next.group,
      progress:
        progressByTrack.get(session.activeTrack.id) ?? emptyProgress(),
      nextProblem: next.problem,
    }
  }

  async getTrackCatalog(): Promise<TrackCatalogItem[]> {
    const trackRows = await this.db
      .select()
      .from(tracks)
      .orderBy(asc(tracks.createdAt), asc(tracks.title))
    const session = await this.getSession()
    const progressByTrack = await this.getProgressByTrack(
      trackRows.map((track) => track.id),
    )

    return trackRows.map((trackRow) => ({
      track: mapTrack(trackRow),
      progress: progressByTrack.get(trackRow.id) ?? emptyProgress(),
      isActive: session.activeTrack?.id === trackRow.id,
      activeGroupId:
        session.activeTrack?.id === trackRow.id
          ? session.activeGroup?.id ?? null
          : null,
    }))
  }

  async getTrackById(trackId: string): Promise<Track | null> {
    return readTrackById(this.db, trackId)
  }

  async getSession(): Promise<TrackSessionState> {
    return readSessionState(this.db)
  }

  async getGroups(trackId: string): Promise<TrackGroup[]> {
    return readGroups(this.db, trackId)
  }

  async getMemberships(
    trackId: string,
  ): Promise<TrackProblemMembership[]> {
    return readMemberships(this.db, trackId)
  }

  async getProgressByTrack(
    trackIds: readonly string[],
  ): Promise<Map<string, TrackProgress>> {
    const requestedTrackIds = uniqueNonEmptyStrings(trackIds)
    const progressByTrack = new Map<string, TrackProgressAccumulator>()

    for (const trackId of requestedTrackIds) {
      progressByTrack.set(trackId, {
        completedCount: 0,
        totalCount: 0,
      })
    }

    if (requestedTrackIds.length === 0) {
      return new Map()
    }

    const rows = await this.db
      .select({
        trackId: trackGroups.trackId,
        completedProblemSlug: trackProblemProgress.problemSlug,
      })
      .from(trackGroups)
      .innerJoin(
        trackGroupProblems,
        eq(trackGroupProblems.trackGroupId, trackGroups.id),
      )
      .leftJoin(
        trackProblemProgress,
        and(
          eq(trackProblemProgress.trackGroupId, trackGroupProblems.trackGroupId),
          eq(trackProblemProgress.problemSlug, trackGroupProblems.problemSlug),
        ),
      )
      .where(inArray(trackGroups.trackId, requestedTrackIds))

    for (const row of rows) {
      const progress = progressByTrack.get(row.trackId)

      if (!progress) {
        continue
      }

      progress.totalCount += 1

      if (row.completedProblemSlug !== null) {
        progress.completedCount += 1
      }
    }

    return new Map(
      requestedTrackIds.map((trackId) => [
        trackId,
        toTrackProgress(progressByTrack.get(trackId) ?? emptyAccumulator()),
      ]),
    )
  }

  async setActiveTrack(
    trackId: string,
    now = new Date(),
  ): Promise<TrackSessionState> {
    return this.db.transaction(async (transactionDb) => {
      const track = await readTrackById(transactionDb, trackId)

      if (!track) {
        throw new Error(`Cannot activate missing track "${trackId}".`)
      }

      const firstGroup = await readFirstGroup(transactionDb, track.id)
      const timestamp = now.getTime()

      await transactionDb
        .insert(trackSession)
        .values({
          id: activeTrackSessionId,
          activeTrackId: track.id,
          activeGroupId: firstGroup?.id ?? null,
          startedAt: timestamp,
          updatedAt: timestamp,
        })
        .onConflictDoUpdate({
          target: trackSession.id,
          set: {
            activeTrackId: track.id,
            activeGroupId: firstGroup?.id ?? null,
            startedAt: timestamp,
            updatedAt: timestamp,
          },
        })

      return {
        activeTrack: track,
        activeGroup: firstGroup,
        startedAt: new Date(timestamp),
        updatedAt: new Date(timestamp),
      }
    })
  }

  async setActiveGroup(
    groupId: string,
    now = new Date(),
  ): Promise<TrackSessionState> {
    return this.db.transaction(async (transactionDb) => {
      const sessionRows = await transactionDb
        .select()
        .from(trackSession)
        .where(eq(trackSession.id, activeTrackSessionId))
        .limit(1)
      const session = sessionRows[0]

      if (!session?.activeTrackId) {
        throw new Error('Cannot set an active group without an active track.')
      }

      const group = await readGroupByIdForTrack(
        transactionDb,
        groupId,
        session.activeTrackId,
      )

      if (!group) {
        throw new Error(
          'Cannot set an active group outside the current active track.',
        )
      }

      await transactionDb
        .update(trackSession)
        .set({
          activeGroupId: group.id,
          updatedAt: now.getTime(),
        })
        .where(eq(trackSession.id, activeTrackSessionId))

      return readSessionState(transactionDb)
    })
  }

  async createTrack(
    input: CreateTrackInput,
    now = new Date(),
  ): Promise<Track> {
    return this.db.transaction(async (transactionDb) => {
      const timestamp = now.getTime()
      const normalizedTrack = normalizeTrackMutationInput(input)
      const slug = normalizeLeetCodeSlug(normalizedTrack.title)

      if (!slug) {
        throw new Error('Cannot create a track without a slug.')
      }

      const trackId = createTrackId(slug)
      const existingTrack = await readTrackById(transactionDb, trackId)

      if (existingTrack) {
        throw new Error(`Track "${trackId}" already exists.`)
      }

      await transactionDb.insert(tracks).values({
        id: trackId,
        slug,
        title: normalizedTrack.title,
        description: normalizedTrack.description,
        dueAt: normalizedTrack.dueAt,
        createdAt: timestamp,
        updatedAt: timestamp,
      })

      const normalizedGroups = normalizeGroupInputs({
        trackId,
        groups: normalizedTrack.groups,
        existingGroupIds: new Set(),
        useDefaultMainGroup: true,
        requireExistingIds: false,
      })

      await writeNewGroups(transactionDb, trackId, normalizedGroups, timestamp)

      const createdTrack = await readTrackById(transactionDb, trackId)

      if (!createdTrack) {
        throw new Error(`Failed to read created track "${trackId}".`)
      }

      return createdTrack
    })
  }

  async updateTrack(
    input: UpdateTrackInput,
    now = new Date(),
  ): Promise<Track> {
    return this.db.transaction(async (transactionDb) => {
      const timestamp = now.getTime()
      const existingTrack = await readTrackById(transactionDb, input.trackId)

      if (!existingTrack) {
        throw new Error(`Cannot update missing track "${input.trackId}".`)
      }

      const normalizedTrack = normalizeTrackMutationInput(input)
      const existingGroups = await readGroups(transactionDb, existingTrack.id)
      const existingGroupIds = new Set(existingGroups.map((group) => group.id))
      const normalizedGroups = normalizeGroupInputs({
        trackId: existingTrack.id,
        groups: normalizedTrack.groups,
        existingGroupIds,
        useDefaultMainGroup: false,
        requireExistingIds: true,
      })
      const retainedGroupIds = new Set(
        normalizedGroups
          .filter((group) => existingGroupIds.has(group.id))
          .map((group) => group.id),
      )
      const omittedGroups = existingGroups.filter(
        (group) => !retainedGroupIds.has(group.id),
      )
      const replacement = await analyzeTrackMembershipReplacement(
        transactionDb,
        existingTrack.id,
        normalizedGroups,
        omittedGroups,
      )

      await transactionDb
        .update(tracks)
        .set({
          title: normalizedTrack.title,
          description: normalizedTrack.description,
          dueAt: normalizedTrack.dueAt,
          updatedAt: timestamp,
        })
        .where(eq(tracks.id, existingTrack.id))

      if (omittedGroups.length > 0) {
        await transactionDb
          .delete(trackGroups)
          .where(
            inArray(
              trackGroups.id,
              omittedGroups.map((group) => group.id),
            ),
          )
      }

      for (const group of normalizedGroups) {
        if (existingGroupIds.has(group.id)) {
          await transactionDb
            .update(trackGroups)
            .set({
              title: group.title,
              position: group.position,
              updatedAt: timestamp,
            })
            .where(eq(trackGroups.id, group.id))
        } else {
          await transactionDb.insert(trackGroups).values({
            id: group.id,
            trackId: existingTrack.id,
            title: group.title,
            position: group.position,
            createdAt: timestamp,
            updatedAt: timestamp,
          })
        }

        await syncGroupMemberships(transactionDb, group)
      }

      await writeMovedProgressRows(transactionDb, replacement.progressMoves)

      const updatedTrack = await readTrackById(transactionDb, existingTrack.id)

      if (!updatedTrack) {
        throw new Error(`Failed to read updated track "${existingTrack.id}".`)
      }

      return updatedTrack
    })
  }

  async deleteTrack(trackId: string, now = new Date()): Promise<void> {
    await this.db.transaction(async (transactionDb) => {
      const sessionRows = await transactionDb
        .select()
        .from(trackSession)
        .where(eq(trackSession.id, activeTrackSessionId))
        .limit(1)
      const session = sessionRows[0]

      if (session?.activeTrackId === trackId) {
        await transactionDb
          .update(trackSession)
          .set({
            activeTrackId: null,
            activeGroupId: null,
            updatedAt: now.getTime(),
          })
          .where(eq(trackSession.id, activeTrackSessionId))
      }

      await transactionDb.delete(tracks).where(eq(tracks.id, trackId))
    })
  }

  async resetTrackProgress(trackId: string): Promise<void> {
    await this.db.transaction(async (transactionDb) => {
      const groupRows = await transactionDb
        .select({ id: trackGroups.id })
        .from(trackGroups)
        .where(eq(trackGroups.trackId, trackId))

      if (groupRows.length === 0) {
        return
      }

      await transactionDb
        .delete(trackProblemProgress)
        .where(
          inArray(
            trackProblemProgress.trackGroupId,
            groupRows.map((group) => group.id),
          ),
        )
    })
  }

  async recordActiveTrackProblemCompletion(
    input: TrackCompletionInput,
  ): Promise<boolean> {
    const rating = parseTrackCompletedRating(input.rating)

    if (!rating) {
      return false
    }

    const problemSlug = normalizeProblemInput(input.problemSlug)
    const completedAt = input.completedAt ?? new Date()

    return this.db.transaction(async (transactionDb) => {
      const sessionRows = await transactionDb
        .select()
        .from(trackSession)
        .where(eq(trackSession.id, activeTrackSessionId))
        .limit(1)
      const session = sessionRows[0]

      if (!session?.activeTrackId) {
        return false
      }

      const membershipRows = await transactionDb
        .select({
          trackGroupId: trackGroupProblems.trackGroupId,
          problemSlug: trackGroupProblems.problemSlug,
        })
        .from(trackGroupProblems)
        .innerJoin(
          trackGroups,
          eq(trackGroups.id, trackGroupProblems.trackGroupId),
        )
        .leftJoin(
          trackProblemProgress,
          and(
            eq(
              trackProblemProgress.trackGroupId,
              trackGroupProblems.trackGroupId,
            ),
            eq(trackProblemProgress.problemSlug, trackGroupProblems.problemSlug),
          ),
        )
        .where(
          and(
            eq(trackGroups.trackId, session.activeTrackId),
            eq(trackGroupProblems.problemSlug, problemSlug),
            isNull(trackProblemProgress.problemSlug),
          ),
        )
        .orderBy(asc(trackGroups.position), asc(trackGroupProblems.position))
        .limit(1)
      const membership = membershipRows[0]

      if (!membership) {
        return false
      }

      const timestamp = completedAt.getTime()

      const insertedRows = await transactionDb
        .insert(trackProblemProgress)
        .values({
          trackGroupId: membership.trackGroupId,
          problemSlug: membership.problemSlug,
          completedAt: timestamp,
          completedRating: rating,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
        .onConflictDoNothing()
        .returning({
          trackGroupId: trackProblemProgress.trackGroupId,
        })

      return insertedRows.length > 0
    })
  }

  private async getNextProblemInTrack(
    trackId: string,
    preferredGroup: TrackGroup | null,
  ): Promise<{
    group: TrackGroup | null
    problem: Problem | null
  }> {
    const groups = await readGroups(this.db, trackId)

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
      .innerJoin(problems, eq(problems.slug, trackGroupProblems.problemSlug))
      .leftJoin(
        trackProblemProgress,
        and(
          eq(trackProblemProgress.trackGroupId, trackGroupProblems.trackGroupId),
          eq(trackProblemProgress.problemSlug, trackGroupProblems.problemSlug),
        ),
      )
      .where(
        and(
          eq(trackGroupProblems.trackGroupId, groupId),
          isNull(trackProblemProgress.problemSlug),
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

async function readTrackById(
  db: TracksReadDb,
  trackId: string,
): Promise<Track | null> {
  const rows = await db
    .select()
    .from(tracks)
    .where(eq(tracks.id, trackId.trim()))
    .limit(1)

  return rows[0] ? mapTrack(rows[0]) : null
}

async function readSessionState(db: TracksReadDb): Promise<TrackSessionState> {
  const sessionRows = await db
    .select()
    .from(trackSession)
    .where(eq(trackSession.id, activeTrackSessionId))
    .limit(1)
  const session = sessionRows[0]

  if (!session) {
    return {
      activeTrack: null,
      activeGroup: null,
      startedAt: new Date(0),
      updatedAt: new Date(0),
    }
  }

  const activeTrack = session.activeTrackId
    ? await readTrackById(db, session.activeTrackId)
    : null
  const activeGroup =
    activeTrack && session.activeGroupId
      ? await readGroupByIdForTrack(db, session.activeGroupId, activeTrack.id)
      : null

  return {
    activeTrack,
    activeGroup,
    startedAt: new Date(session.startedAt),
    updatedAt: new Date(session.updatedAt),
  }
}

async function readGroupByIdForTrack(
  db: TracksReadDb,
  groupId: string,
  trackId: string,
): Promise<TrackGroup | null> {
  const rows = await db
    .select()
    .from(trackGroups)
    .where(
      and(
        eq(trackGroups.id, groupId.trim()),
        eq(trackGroups.trackId, trackId),
      ),
    )
    .limit(1)

  return rows[0] ? mapTrackGroup(rows[0]) : null
}

async function readFirstGroup(
  db: TracksReadDb,
  trackId: string,
): Promise<TrackGroup | null> {
  const rows = await db
    .select()
    .from(trackGroups)
    .where(eq(trackGroups.trackId, trackId))
    .orderBy(asc(trackGroups.position))
    .limit(1)

  return rows[0] ? mapTrackGroup(rows[0]) : null
}

async function readGroups(
  db: TracksReadDb,
  trackId: string,
): Promise<TrackGroup[]> {
  const rows = await db
    .select()
    .from(trackGroups)
    .where(eq(trackGroups.trackId, trackId.trim()))
    .orderBy(asc(trackGroups.position))

  return rows.map(mapTrackGroup)
}

async function readMemberships(
  db: TracksReadDb,
  trackId: string,
): Promise<TrackProblemMembership[]> {
  const rows = await db
    .select({
      group: trackGroups,
      problemSlug: trackGroupProblems.problemSlug,
      problemPosition: trackGroupProblems.position,
      completedAt: trackProblemProgress.completedAt,
      completedRating: trackProblemProgress.completedRating,
    })
    .from(trackGroupProblems)
    .innerJoin(trackGroups, eq(trackGroups.id, trackGroupProblems.trackGroupId))
    .leftJoin(
      trackProblemProgress,
      and(
        eq(trackProblemProgress.trackGroupId, trackGroupProblems.trackGroupId),
        eq(trackProblemProgress.problemSlug, trackGroupProblems.problemSlug),
      ),
    )
    .where(eq(trackGroups.trackId, trackId.trim()))
    .orderBy(asc(trackGroups.position), asc(trackGroupProblems.position))

  return rows.map((row) => ({
    trackId: row.group.trackId,
    groupId: row.group.id,
    groupTitle: row.group.title,
    groupPosition: row.group.position,
    problemSlug: row.problemSlug,
    problemPosition: row.problemPosition,
    completedAt: row.completedAt === null ? null : new Date(row.completedAt),
    completedRating: parseTrackCompletedRating(row.completedRating),
  }))
}

async function writeNewGroups(
  db: TracksWriteDb,
  trackId: string,
  groups: readonly NormalizedTrackGroupInput[],
  timestamp: number,
) {
  if (groups.length === 0) {
    return
  }

  await db.insert(trackGroups).values(
    groups.map((group) => ({
      id: group.id,
      trackId,
      title: group.title,
      position: group.position,
      createdAt: timestamp,
      updatedAt: timestamp,
    })),
  )

  for (const group of groups) {
    await syncGroupMemberships(db, group)
  }
}

async function syncGroupMemberships(
  db: TracksWriteDb,
  group: NormalizedTrackGroupInput,
) {
  const existingRows = await db
    .select({
      problemSlug: trackGroupProblems.problemSlug,
    })
    .from(trackGroupProblems)
    .where(eq(trackGroupProblems.trackGroupId, group.id))
  const existingSlugs = new Set(existingRows.map((row) => row.problemSlug))
  const desiredSlugs = new Set(
    group.problemSlugs.map((membership) => membership.problemSlug),
  )

  for (const existingSlug of existingSlugs) {
    if (desiredSlugs.has(existingSlug)) {
      continue
    }

    await db
      .delete(trackGroupProblems)
      .where(
        and(
          eq(trackGroupProblems.trackGroupId, group.id),
          eq(trackGroupProblems.problemSlug, existingSlug),
        ),
      )
  }

  for (const membership of group.problemSlugs) {
    if (existingSlugs.has(membership.problemSlug)) {
      await db
        .update(trackGroupProblems)
        .set({
          position: membership.position,
        })
        .where(
          and(
            eq(trackGroupProblems.trackGroupId, group.id),
            eq(trackGroupProblems.problemSlug, membership.problemSlug),
          ),
        )
    } else {
      await db.insert(trackGroupProblems).values({
        trackGroupId: group.id,
        problemSlug: membership.problemSlug,
        position: membership.position,
      })
    }
  }
}

async function analyzeTrackMembershipReplacement(
  db: TracksReadDb,
  trackId: string,
  desiredGroups: readonly NormalizedTrackGroupInput[],
  omittedGroups: readonly TrackGroup[],
): Promise<TrackMembershipReplacement> {
  const desiredMemberships = flattenDesiredMemberships(desiredGroups)
  const desiredMembershipsByProblem =
    groupDesiredMembershipsByProblem(desiredMemberships)
  const desiredMembershipKeys = new Set(
    desiredMemberships.map((membership) =>
      createMembershipKey(membership.groupId, membership.problemSlug),
    ),
  )

  const omittedGroupIds = new Set(omittedGroups.map((group) => group.id))
  const omittedGroupTitles = new Map(
    omittedGroups.map((group) => [group.id, group.title]),
  )
  const existingMemberships = await db
    .select({
      groupId: trackGroups.id,
      groupPosition: trackGroups.position,
      problemSlug: trackGroupProblems.problemSlug,
      problemPosition: trackGroupProblems.position,
      completedAt: trackProblemProgress.completedAt,
      completedRating: trackProblemProgress.completedRating,
      createdAt: trackProblemProgress.createdAt,
      updatedAt: trackProblemProgress.updatedAt,
    })
    .from(trackGroupProblems)
    .innerJoin(trackGroups, eq(trackGroups.id, trackGroupProblems.trackGroupId))
    .leftJoin(
      trackProblemProgress,
      and(
        eq(trackProblemProgress.trackGroupId, trackGroupProblems.trackGroupId),
        eq(trackProblemProgress.problemSlug, trackGroupProblems.problemSlug),
      ),
    )
    .where(eq(trackGroups.trackId, trackId))
    .orderBy(asc(trackGroups.position), asc(trackGroupProblems.position))
  const progressMoveSourcesByProblem = new Map<
    string,
    TrackProgressMoveSource[]
  >()
  const usedDesiredMembershipKeys = new Set<string>()

  for (const membership of existingMemberships) {
    const desiredMembershipsForProblem =
      desiredMembershipsByProblem.get(membership.problemSlug) ?? []
    const membershipKey = createMembershipKey(
      membership.groupId,
      membership.problemSlug,
    )
    const membershipStillExists = desiredMembershipKeys.has(membershipKey)
    const completedRating = parseTrackCompletedRating(
      membership.completedRating,
    )

    if (
      omittedGroupIds.has(membership.groupId) &&
      desiredMembershipsForProblem.length === 0
    ) {
      throw new Error(
        `Cannot remove non-empty group "${omittedGroupTitles.get(
          membership.groupId,
        )}" without first moving its memberships.`,
      )
    }

    if (membershipStillExists) {
      usedDesiredMembershipKeys.add(membershipKey)
      continue
    }

    if (
      membership.completedAt === null ||
      !completedRating ||
      membership.createdAt === null ||
      membership.updatedAt === null
    ) {
      continue
    }

    if (desiredMembershipsForProblem.length === 0) {
      continue
    }

    const moveSources =
      progressMoveSourcesByProblem.get(membership.problemSlug) ?? []

    moveSources.push({
      fromGroupId: membership.groupId,
      problemSlug: membership.problemSlug,
      completedAt: membership.completedAt,
      completedRating,
      createdAt: membership.createdAt,
      updatedAt: membership.updatedAt,
    })
    progressMoveSourcesByProblem.set(membership.problemSlug, moveSources)
  }

  return {
    progressMoves: assignProgressMovesToDesiredMemberships({
      desiredMembershipsByProblem,
      progressMoveSourcesByProblem,
      usedDesiredMembershipKeys,
    }),
  }
}

function assignProgressMovesToDesiredMemberships(options: {
  desiredMembershipsByProblem: Map<string, DesiredTrackMembership[]>
  progressMoveSourcesByProblem: Map<string, TrackProgressMoveSource[]>
  usedDesiredMembershipKeys: Set<string>
}): TrackProgressMove[] {
  const progressMoves: TrackProgressMove[] = []

  for (const [problemSlug, moveSources] of options.progressMoveSourcesByProblem) {
    const desiredMemberships =
      options.desiredMembershipsByProblem.get(problemSlug) ?? []

    for (const moveSource of moveSources) {
      const target = takeNextProgressMoveTarget({
        desiredMemberships,
        moveSource,
        usedDesiredMembershipKeys: options.usedDesiredMembershipKeys,
      })

      progressMoves.push({
        toGroupId: target.groupId,
        problemSlug: moveSource.problemSlug,
        completedAt: moveSource.completedAt,
        completedRating: moveSource.completedRating,
        createdAt: moveSource.createdAt,
        updatedAt: moveSource.updatedAt,
      })
    }
  }

  return progressMoves
}

function takeNextProgressMoveTarget(options: {
  desiredMemberships: readonly DesiredTrackMembership[]
  moveSource: TrackProgressMoveSource
  usedDesiredMembershipKeys: Set<string>
}) {
  const sourceKey = createMembershipKey(
    options.moveSource.fromGroupId,
    options.moveSource.problemSlug,
  )

  for (const desiredMembership of options.desiredMemberships) {
    const desiredKey = createMembershipKey(
      desiredMembership.groupId,
      desiredMembership.problemSlug,
    )

    if (
      desiredKey === sourceKey ||
      options.usedDesiredMembershipKeys.has(desiredKey)
    ) {
      continue
    }

    options.usedDesiredMembershipKeys.add(desiredKey)
    return desiredMembership
  }

  throw new Error(
    `Cannot move completed progress for duplicate problem "${options.moveSource.problemSlug}" without an unambiguous target membership.`,
  )
}

async function writeMovedProgressRows(
  db: TracksWriteDb,
  progressMoves: readonly TrackProgressMove[],
) {
  if (progressMoves.length === 0) {
    return
  }

  await db
    .insert(trackProblemProgress)
    .values(
      progressMoves.map((move) => ({
        trackGroupId: move.toGroupId,
        problemSlug: move.problemSlug,
        completedAt: move.completedAt,
        completedRating: move.completedRating,
        createdAt: move.createdAt,
        updatedAt: move.updatedAt,
      })),
    )
    .onConflictDoNothing()
}

function flattenDesiredMemberships(
  groups: readonly NormalizedTrackGroupInput[],
): DesiredTrackMembership[] {
  return groups
    .flatMap((group) =>
      group.problemSlugs.map((problem) => ({
        groupId: group.id,
        groupPosition: group.position,
        problemSlug: problem.problemSlug,
        problemPosition: problem.position,
      })),
    )
    .sort(
      (left, right) =>
        left.groupPosition - right.groupPosition ||
        left.problemPosition - right.problemPosition,
    )
}

function groupDesiredMembershipsByProblem(
  desiredMemberships: readonly DesiredTrackMembership[],
) {
  const membershipsByProblem = new Map<string, DesiredTrackMembership[]>()

  for (const membership of desiredMemberships) {
    const memberships = membershipsByProblem.get(membership.problemSlug) ?? []

    memberships.push(membership)
    membershipsByProblem.set(membership.problemSlug, memberships)
  }

  return membershipsByProblem
}

function createMembershipKey(groupId: string, problemSlug: string) {
  return `${groupId}\0${problemSlug}`
}

function normalizeTrackMutationInput(
  input: CreateTrackInput | UpdateTrackInput,
): NormalizedTrackMutationInput {
  return {
    title: normalizeRequiredLabel(input.title, 'track title'),
    description: normalizeDescription(input.description),
    dueAt: normalizeDueAt(input.dueAt),
    groups: input.groups,
  }
}

function normalizeGroupInputs(options: {
  trackId: string
  groups: readonly TrackGroupInput[]
  existingGroupIds: Set<string>
  useDefaultMainGroup: boolean
  requireExistingIds: boolean
}): NormalizedTrackGroupInput[] {
  const sourceGroups =
    options.groups.length > 0 || !options.useDefaultMainGroup
      ? options.groups
      : [{ title: 'Main', problemSlugs: [] }]
  const unavailableGroupIds = new Set(options.existingGroupIds)
  const usedProblemSlugs = new Set<string>()
  const usedGroupIds = new Set<string>()

  return sourceGroups.map((group, groupIndex) => {
    const title = normalizeRequiredLabel(group.title, 'track group title')
    const explicitGroupId = group.id?.trim()
    const id = explicitGroupId
      ? explicitGroupId
      : createTrackGroupId(options.trackId, title, unavailableGroupIds)

    if (!id) {
      throw new Error('Cannot create a track group without an id.')
    }

    if (usedGroupIds.has(id)) {
      throw new Error(`Duplicate track group id "${id}".`)
    }

    if (options.requireExistingIds && explicitGroupId) {
      if (!options.existingGroupIds.has(explicitGroupId)) {
        throw new Error(`Cannot update unknown track group "${explicitGroupId}".`)
      }
    }

    usedGroupIds.add(id)

    return {
      id,
      title,
      position: groupIndex + 1,
      problemSlugs: normalizeProblemInputs(
        group.problemSlugs,
        usedProblemSlugs,
      ),
    }
  })
}

function normalizeProblemInputs(
  problemInputs: readonly string[],
  usedProblemSlugs: Set<string>,
): NormalizedTrackProblemInput[] {
  const problemSlugs: NormalizedTrackProblemInput[] = []

  for (const problemInput of problemInputs) {
    const problemSlug = normalizeProblemInput(problemInput)

    if (usedProblemSlugs.has(problemSlug)) {
      throw new Error(
        `Problem "${problemSlug}" can only appear once in a track.`,
      )
    }

    usedProblemSlugs.add(problemSlug)
    problemSlugs.push({
      problemSlug,
      position: problemSlugs.length + 1,
    })
  }

  return problemSlugs
}

function normalizeProblemInput(problemInput: string) {
  const parsedInput = parseLeetCodeProblemInput(problemInput)

  if (!parsedInput) {
    throw new Error('Cannot use a blank problem slug in a track group.')
  }

  return parsedInput.slug
}

function normalizeRequiredLabel(label: string, fieldName: string) {
  const normalizedLabel = label.trim().replace(/\s+/g, ' ')

  if (!normalizedLabel) {
    throw new Error(`Cannot save a track without a ${fieldName}.`)
  }

  return normalizedLabel
}

function normalizeDescription(description: string | null) {
  const normalizedDescription = description?.trim()

  return normalizedDescription ? normalizedDescription : null
}

function normalizeDueAt(dueAt: Date | string | null) {
  if (dueAt === null) {
    return null
  }

  const date = dueAt instanceof Date ? dueAt : new Date(dueAt)
  const timestamp = date.getTime()

  if (Number.isNaN(timestamp)) {
    throw new Error('Cannot save a track with an invalid due date.')
  }

  return timestamp
}

function parseTrackCompletedRating(
  rating: string | null,
): TrackCompletedRating | null {
  if (rating === 'good' || rating === 'easy') {
    return rating
  }

  return null
}

function createTrackId(slug: string) {
  return slug
}

function createTrackGroupId(
  trackId: string,
  title: string,
  existingIds: Set<string>,
) {
  const base = `${trackId}:${normalizeLeetCodeSlug(title) || 'group'}`
  let id = base
  let suffix = 2

  while (existingIds.has(id)) {
    id = `${base}-${suffix}`
    suffix += 1
  }

  existingIds.add(id)
  return id
}

function uniqueNonEmptyStrings(values: readonly string[]) {
  const seen = new Set<string>()
  const uniqueValues: string[] = []

  for (const value of values) {
    const normalizedValue = value.trim()

    if (!normalizedValue || seen.has(normalizedValue)) {
      continue
    }

    seen.add(normalizedValue)
    uniqueValues.push(normalizedValue)
  }

  return uniqueValues
}

function toTrackProgress(accumulator: TrackProgressAccumulator): TrackProgress {
  if (accumulator.totalCount === 0) {
    return emptyProgress()
  }

  return {
    completedCount: accumulator.completedCount,
    totalCount: accumulator.totalCount,
    percent: Math.round(
      (accumulator.completedCount / accumulator.totalCount) * 100,
    ),
  }
}

function emptyAccumulator(): TrackProgressAccumulator {
  return {
    completedCount: 0,
    totalCount: 0,
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
    slug: row.slug,
    title: row.title,
    difficulty: normalizeProblemDifficulty(row.difficulty),
    isPremium: row.isPremium,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  }
}

const activeTrackSessionId = 'active'

type TracksReadDb = Pick<Db, 'select'>
type TracksWriteDb = Pick<Db, 'delete' | 'insert' | 'select' | 'update'>

interface NormalizedTrackMutationInput {
  title: string
  description: string | null
  dueAt: number | null
  groups: readonly TrackGroupInput[]
}

interface NormalizedTrackGroupInput {
  id: string
  title: string
  position: number
  problemSlugs: NormalizedTrackProblemInput[]
}

interface NormalizedTrackProblemInput {
  problemSlug: string
  position: number
}

interface DesiredTrackMembership {
  groupId: string
  groupPosition: number
  problemSlug: string
  problemPosition: number
}

interface TrackMembershipReplacement {
  progressMoves: TrackProgressMove[]
}

interface TrackProgressMoveSource {
  fromGroupId: string
  problemSlug: string
  completedAt: number
  completedRating: TrackCompletedRating
  createdAt: number
  updatedAt: number
}

interface TrackProgressMove {
  toGroupId: string
  problemSlug: string
  completedAt: number
  completedRating: TrackCompletedRating
  createdAt: number
  updatedAt: number
}

interface TrackProgressAccumulator {
  completedCount: number
  totalCount: number
}
