import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import {
  problemPractice,
  trackGroupProblems,
  trackGroups,
  trackSession,
  tracks,
} from '@/platform/db/schema'
import { createTestDb } from '@/platform/db/test-db'

import { createTracksRepository } from './tracks-repository'

describe('TracksRepository', () => {
  it('reads active track context with nullable due date', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })
    const repository = createTracksRepository(handle.db)

    const activeTrack = await repository.getActiveTrack()

    expect(activeTrack).toMatchObject({
      track: {
        id: 'leetcode-75',
        title: 'LeetCode 75',
        dueAt: null,
      },
      activeGroup: {
        title: 'Arrays and Hashing',
      },
      progress: {
        completedCount: 0,
        totalCount: 1,
        percent: 0,
      },
      nextProblem: {
        slug: 'two-sum',
      },
    })
  })

  it('maps track due date from storage', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })
    const dueAt = new Date('2026-03-01T00:00:00.000Z')

    await handle.db
      .update(tracks)
      .set({ dueAt: dueAt.getTime() })
      .where(eq(tracks.id, 'leetcode-75'))

    const activeTrack = await createTracksRepository(handle.db).getActiveTrack()

    expect(activeTrack?.track.dueAt).toEqual(dueAt)
  })

  it('summarizes catalog progress without reading practice state', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })
    const timestamp = new Date('2026-01-01T08:00:00.000Z').getTime()

    await handle.db.insert(trackGroups).values({
      id: 'leetcode-75:stack',
      trackId: 'leetcode-75',
      title: 'Stack',
      position: 2,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    await handle.db.insert(trackGroupProblems).values({
      trackGroupId: 'leetcode-75:stack',
      problemSlug: 'valid-parentheses',
      position: 1,
    })
    await handle.db.insert(problemPractice).values({
      problemSlug: 'two-sum',
      status: 'mastered',
      firstSeenAt: timestamp,
      lastSeenAt: timestamp,
      lastReviewedAt: timestamp,
      lastRating: 'easy',
      solvedCount: 1,
      attemptCount: 1,
      isSuspended: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    })

    const activeTrack = await createTracksRepository(handle.db).getActiveTrack()

    expect(activeTrack?.progress).toEqual({
      completedCount: 0,
      totalCount: 2,
      percent: 0,
    })
    expect(activeTrack?.activeGroup).toMatchObject({
      id: 'leetcode-75:arrays-hashing',
      title: 'Arrays and Hashing',
    })
    expect(activeTrack?.nextProblem).toMatchObject({
      slug: 'two-sum',
    })
  })

  it('restores the persisted active track and active group', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })

    await handle.db
      .update(trackSession)
      .set({
        activeTrackId: 'grind-75',
        activeGroupId: 'grind-75:stack',
      })
      .where(eq(trackSession.id, 'active'))

    const activeTrack = await createTracksRepository(handle.db).getActiveTrack()

    expect(activeTrack).toMatchObject({
      track: {
        id: 'grind-75',
        title: 'Grind 75',
      },
      activeGroup: {
        id: 'grind-75:stack',
        title: 'Stack',
      },
      nextProblem: {
        slug: 'valid-parentheses',
      },
    })
  })

  it('does not let suspended practice state remove a catalog track problem', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })
    const timestamp = new Date('2026-01-01T08:00:00.000Z').getTime()

    await handle.db.insert(problemPractice).values({
      problemSlug: 'two-sum',
      status: 'suspended',
      firstSeenAt: timestamp,
      lastSeenAt: timestamp,
      lastReviewedAt: null,
      lastRating: null,
      solvedCount: 0,
      attemptCount: 0,
      isSuspended: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    })

    const activeTrack = await createTracksRepository(handle.db).getActiveTrack()

    expect(activeTrack?.nextProblem).toMatchObject({
      slug: 'two-sum',
    })
    expect(activeTrack?.progress).toEqual({
      completedCount: 0,
      totalCount: 1,
      percent: 0,
    })
  })
})
