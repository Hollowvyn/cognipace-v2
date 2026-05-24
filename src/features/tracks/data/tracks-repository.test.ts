import { asc, eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import {
  problemPractice,
  trackGroupProblems,
  trackGroups,
  trackProblemProgress,
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

  it('returns null when the active session has no active track', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })

    await handle.db
      .update(trackSession)
      .set({
        activeTrackId: null,
        activeGroupId: null,
      })
      .where(eq(trackSession.id, 'active'))

    const activeTrack = await createTracksRepository(handle.db).getActiveTrack()

    expect(activeTrack).toBeNull()
  })

  it('does not expose legacy track active flags', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })

    const activeTrack = await createTracksRepository(handle.db).getActiveTrack()

    expect(activeTrack?.track).not.toHaveProperty('isActive')
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

  it('counts completed track progress from the track ledger only', async () => {
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
      problemSlug: 'valid-parentheses',
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
    await handle.db.insert(trackProblemProgress).values({
      trackGroupId: 'leetcode-75:arrays-hashing',
      problemSlug: 'two-sum',
      completedAt: timestamp,
      completedRating: 'good',
      createdAt: timestamp,
      updatedAt: timestamp,
    })

    const activeTrack = await createTracksRepository(handle.db).getActiveTrack()

    expect(activeTrack?.progress).toEqual({
      completedCount: 1,
      totalCount: 2,
      percent: 50,
    })
  })

  it('deletes progress when deleting a track problem membership', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })
    const timestamp = new Date('2026-01-01T08:00:00.000Z').getTime()

    await handle.db.insert(trackProblemProgress).values({
      trackGroupId: 'leetcode-75:arrays-hashing',
      problemSlug: 'two-sum',
      completedAt: timestamp,
      completedRating: 'easy',
      createdAt: timestamp,
      updatedAt: timestamp,
    })

    await handle.db
      .delete(trackGroupProblems)
      .where(
        eq(trackGroupProblems.trackGroupId, 'leetcode-75:arrays-hashing'),
      )

    const rows = await handle.db
      .select()
      .from(trackProblemProgress)
      .orderBy(
        asc(trackProblemProgress.trackGroupId),
        asc(trackProblemProgress.problemSlug),
      )

    expect(rows).toEqual([])
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

  it('reads catalog rows ordered by created date then title with active summary', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })
    const repository = createTracksRepository(handle.db)

    const catalog = await repository.getTrackCatalog()

    expect(catalog.map((item) => item.track.id)).toEqual([
      'grind-75',
      'leetcode-75',
    ])
    expect(catalog.map((item) => item.isActive)).toEqual([false, true])
    expect(catalog.find((item) => item.isActive)).toMatchObject({
      activeGroupId: 'leetcode-75:arrays-hashing',
      progress: {
        completedCount: 0,
        totalCount: 1,
        percent: 0,
      },
      track: {
        id: 'leetcode-75',
      },
    })
  })

  it('reads the selected active track and group from the session', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })

    const session = await createTracksRepository(handle.db).getSession()

    expect(session).toMatchObject({
      activeTrack: {
        id: 'leetcode-75',
        title: 'LeetCode 75',
      },
      activeGroup: {
        id: 'leetcode-75:arrays-hashing',
        title: 'Arrays and Hashing',
      },
    })
  })

  it('does not fall back to a track row when the session has no active track', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })

    await handle.db
      .update(trackSession)
      .set({
        activeTrackId: null,
        activeGroupId: null,
      })
      .where(eq(trackSession.id, 'active'))

    const repository = createTracksRepository(handle.db)

    await expect(repository.getSession()).resolves.toMatchObject({
      activeTrack: null,
      activeGroup: null,
    })
    await expect(repository.getActiveTrack()).resolves.toBeNull()
  })

  it('orders groups by their persisted position', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })
    const timestamp = new Date('2026-01-01T08:00:00.000Z').getTime()

    await handle.db.insert(trackGroups).values({
      id: 'leetcode-75:zero',
      trackId: 'leetcode-75',
      title: 'Zero',
      position: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    })

    const groups = await createTracksRepository(handle.db).getGroups(
      'leetcode-75',
    )

    expect(groups.map((group) => group.id)).toEqual([
      'leetcode-75:zero',
      'leetcode-75:arrays-hashing',
    ])
  })

  it('orders memberships by their persisted problem position', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })

    await handle.db.insert(trackGroupProblems).values({
      trackGroupId: 'leetcode-75:arrays-hashing',
      problemSlug: 'valid-parentheses',
      position: 0,
    })

    const memberships = await createTracksRepository(handle.db).getMemberships(
      'leetcode-75',
    )

    expect(memberships.map((membership) => membership.problemSlug)).toEqual([
      'valid-parentheses',
      'two-sum',
    ])
  })

  it('sets the active track to its first group and writes both session ids', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })
    const repository = createTracksRepository(handle.db)
    const timestamp = new Date('2026-01-01T08:00:00.000Z').getTime()

    await handle.db.insert(trackGroups).values({
      id: 'grind-75:arrays',
      trackId: 'grind-75',
      title: 'Arrays',
      position: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    })

    const session = await repository.setActiveTrack(
      'grind-75',
      new Date('2026-01-02T00:00:00.000Z'),
    )
    const rows = await handle.db.select().from(trackSession)

    expect(session).toMatchObject({
      activeTrack: {
        id: 'grind-75',
      },
      activeGroup: {
        id: 'grind-75:arrays',
      },
    })
    expect(rows).toMatchObject([
      {
        activeTrackId: 'grind-75',
        activeGroupId: 'grind-75:arrays',
      },
    ])
  })

  it('clears active track and group session ids', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })
    const repository = createTracksRepository(handle.db)

    await repository.setActiveTrack('leetcode-75')

    const session = await repository.clearActiveTrack(
      new Date('2026-01-02T00:00:00.000Z'),
    )
    const rows = await handle.db.select().from(trackSession)

    expect(session).toMatchObject({
      activeTrack: null,
      activeGroup: null,
    })
    expect(rows).toMatchObject([
      {
        activeTrackId: null,
        activeGroupId: null,
      },
    ])
  })

  it('rejects setting an active group outside the current active track', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })
    const repository = createTracksRepository(handle.db)

    await expect(repository.setActiveGroup('grind-75:stack')).rejects.toThrow(
      /active track/i,
    )

    await expect(repository.getSession()).resolves.toMatchObject({
      activeTrack: {
        id: 'leetcode-75',
      },
      activeGroup: {
        id: 'leetcode-75:arrays-hashing',
      },
    })
  })

  it('creates a Main group when creating a track with no groups', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })
    const repository = createTracksRepository(handle.db)

    const created = await repository.createTrack(
      {
        title: 'Dynamic Plan',
        description: null,
        dueAt: null,
        groups: [],
      },
      new Date('2026-01-02T00:00:00.000Z'),
    )
    const groups = await repository.getGroups(created.id)

    expect(created).toMatchObject({
      id: 'dynamic-plan',
      slug: 'dynamic-plan',
      title: 'Dynamic Plan',
      description: null,
      dueAt: null,
    })
    expect(groups).toEqual([
      {
        id: 'dynamic-plan:main',
        trackId: 'dynamic-plan',
        title: 'Main',
        position: 1,
      },
    ])
  })

  it('updates a track with normalized group and problem positions', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })
    const repository = createTracksRepository(handle.db)
    const timestamp = new Date('2026-01-01T08:00:00.000Z').getTime()

    await handle.db.insert(trackGroups).values({
      id: 'leetcode-75:stack',
      trackId: 'leetcode-75',
      title: 'Stack',
      position: 10,
      createdAt: timestamp,
      updatedAt: timestamp,
    })

    const updated = await repository.updateTrack(
      {
        trackId: 'leetcode-75',
        title: 'LeetCode 75 Updated',
        description: 'Updated description',
        dueAt: '2026-04-01T00:00:00.000Z',
        groups: [
          {
            id: 'leetcode-75:stack',
            title: 'Stack',
            problemSlugs: [],
          },
          {
            id: 'leetcode-75:arrays-hashing',
            title: 'Arrays',
            problemSlugs: ['Valid Parentheses', 'Two Sum'],
          },
        ],
      },
      new Date('2026-01-02T00:00:00.000Z'),
    )

    const groups = await repository.getGroups('leetcode-75')
    const memberships = await repository.getMemberships('leetcode-75')

    expect(updated).toMatchObject({
      id: 'leetcode-75',
      title: 'LeetCode 75 Updated',
      description: 'Updated description',
      dueAt: new Date('2026-04-01T00:00:00.000Z'),
    })
    expect(groups.map((group) => [group.id, group.position])).toEqual([
      ['leetcode-75:stack', 1],
      ['leetcode-75:arrays-hashing', 2],
    ])
    expect(
      memberships.map((membership) => [
        membership.groupId,
        membership.problemSlug,
        membership.problemPosition,
      ]),
    ).toEqual([
      ['leetcode-75:arrays-hashing', 'valid-parentheses', 1],
      ['leetcode-75:arrays-hashing', 'two-sum', 2],
    ])
  })

  it('rejects duplicate problem slugs across groups when saving a track', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })
    const repository = createTracksRepository(handle.db)

    await expect(
      repository.createTrack({
        title: 'Duplicate Plan',
        description: null,
        dueAt: null,
        groups: [
          {
            title: 'Arrays',
            problemSlugs: ['two-sum'],
          },
          {
            title: 'Hash Maps',
            problemSlugs: ['Two Sum'],
          },
        ],
      }),
    ).rejects.toThrow('Problem "two-sum" can only appear once in a track.')
    await expect(
      repository.updateTrack({
        trackId: 'leetcode-75',
        title: 'LeetCode 75',
        description: null,
        dueAt: null,
        groups: [
          {
            id: 'leetcode-75:arrays-hashing',
            title: 'Arrays and Hashing',
            problemSlugs: ['two-sum'],
          },
          {
            title: 'Hash Maps',
            problemSlugs: ['two-sum'],
          },
        ],
      }),
    ).rejects.toThrow('Problem "two-sum" can only appear once in a track.')
  })

  it('moves completed progress when moving a problem out of an omitted group', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })
    const timestamp = new Date('2026-01-01T08:00:00.000Z').getTime()
    const repository = createTracksRepository(handle.db)

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
    await handle.db.insert(trackProblemProgress).values({
      trackGroupId: 'leetcode-75:stack',
      problemSlug: 'valid-parentheses',
      completedAt: timestamp,
      completedRating: 'easy',
      createdAt: timestamp,
      updatedAt: timestamp,
    })

    await repository.updateTrack({
      trackId: 'leetcode-75',
      title: 'LeetCode 75',
      description: null,
      dueAt: null,
      groups: [
        {
          id: 'leetcode-75:arrays-hashing',
          title: 'Arrays and Hashing',
          problemSlugs: ['two-sum', 'valid-parentheses'],
        },
      ],
    })

    const memberships = await repository.getMemberships('leetcode-75')
    const progressRows = await handle.db
      .select()
      .from(trackProblemProgress)
      .orderBy(
        asc(trackProblemProgress.trackGroupId),
        asc(trackProblemProgress.problemSlug),
      )

    expect(memberships.map((membership) => membership.groupId)).toEqual([
      'leetcode-75:arrays-hashing',
      'leetcode-75:arrays-hashing',
    ])
    expect(progressRows).toMatchObject([
      {
        trackGroupId: 'leetcode-75:arrays-hashing',
        problemSlug: 'valid-parentheses',
        completedAt: timestamp,
        completedRating: 'easy',
      },
    ])
  })

  it('allows moving an incomplete problem out of an omitted group and normalizes positions', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })
    const timestamp = new Date('2026-01-01T08:00:00.000Z').getTime()
    const repository = createTracksRepository(handle.db)

    await handle.db.insert(trackGroups).values({
      id: 'leetcode-75:stack',
      trackId: 'leetcode-75',
      title: 'Stack',
      position: 10,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    await handle.db.insert(trackGroupProblems).values({
      trackGroupId: 'leetcode-75:stack',
      problemSlug: 'valid-parentheses',
      position: 8,
    })

    await repository.updateTrack({
      trackId: 'leetcode-75',
      title: 'LeetCode 75',
      description: null,
      dueAt: null,
      groups: [
        {
          id: 'leetcode-75:arrays-hashing',
          title: 'Arrays and Hashing',
          problemSlugs: ['valid-parentheses', 'two-sum'],
        },
      ],
    })

    const groups = await repository.getGroups('leetcode-75')
    const memberships = await repository.getMemberships('leetcode-75')
    const progressRows = await handle.db
      .select()
      .from(trackProblemProgress)
      .orderBy(
        asc(trackProblemProgress.trackGroupId),
        asc(trackProblemProgress.problemSlug),
      )

    expect(groups).toEqual([
      {
        id: 'leetcode-75:arrays-hashing',
        trackId: 'leetcode-75',
        title: 'Arrays and Hashing',
        position: 1,
      },
    ])
    expect(
      memberships.map((membership) => [
        membership.groupId,
        membership.problemSlug,
        membership.problemPosition,
      ]),
    ).toEqual([
      ['leetcode-75:arrays-hashing', 'valid-parentheses', 1],
      ['leetcode-75:arrays-hashing', 'two-sum', 2],
    ])
    expect(progressRows).toEqual([])
  })

  it('rejects omitting a non-empty group when its memberships are not moved', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })

    await expect(
      createTracksRepository(handle.db).updateTrack({
        trackId: 'leetcode-75',
        title: 'LeetCode 75',
        description: null,
        dueAt: null,
        groups: [
          {
            title: 'Replacement',
            problemSlugs: [],
          },
        ],
      }),
    ).rejects.toThrow(/non-empty group/i)
  })

  it('clears both session ids when deleting the active track', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })

    await createTracksRepository(handle.db).deleteTrack(
      'leetcode-75',
      new Date('2026-01-02T00:00:00.000Z'),
    )

    const sessionRows = await handle.db.select().from(trackSession)
    const trackRows = await handle.db.select().from(tracks)

    expect(sessionRows).toMatchObject([
      {
        activeTrackId: null,
        activeGroupId: null,
      },
    ])
    expect(trackRows.map((track) => track.id)).toEqual(['grind-75'])
  })

  it('resets only progress rows for the target track', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })
    const timestamp = new Date('2026-01-01T08:00:00.000Z').getTime()

    await handle.db.insert(trackProblemProgress).values([
      {
        trackGroupId: 'leetcode-75:arrays-hashing',
        problemSlug: 'two-sum',
        completedAt: timestamp,
        completedRating: 'good',
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        trackGroupId: 'grind-75:stack',
        problemSlug: 'valid-parentheses',
        completedAt: timestamp,
        completedRating: 'easy',
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ])

    await createTracksRepository(handle.db).resetTrackProgress('leetcode-75')

    const progressRows = await handle.db
      .select()
      .from(trackProblemProgress)
      .orderBy(
        asc(trackProblemProgress.trackGroupId),
        asc(trackProblemProgress.problemSlug),
      )

    expect(progressRows).toMatchObject([
      {
        trackGroupId: 'grind-75:stack',
        problemSlug: 'valid-parentheses',
      },
    ])
  })

  it('records active-track completion for only the first incomplete good or easy membership', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })
    const timestamp = new Date('2026-01-01T08:00:00.000Z').getTime()
    const repository = createTracksRepository(handle.db)

    await handle.db.insert(trackGroups).values({
      id: 'leetcode-75:duplicates',
      trackId: 'leetcode-75',
      title: 'Duplicates',
      position: 2,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    await handle.db.insert(trackGroupProblems).values({
      trackGroupId: 'leetcode-75:duplicates',
      problemSlug: 'two-sum',
      position: 1,
    })

    await expect(
      repository.recordActiveTrackProblemCompletion({
        problemSlug: 'two-sum',
        rating: 'hard',
        completedAt: new Date('2026-01-02T00:00:00.000Z'),
      }),
    ).resolves.toBe(false)
    await expect(
      repository.recordActiveTrackProblemCompletion({
        problemSlug: 'two-sum',
        rating: 'good',
        completedAt: new Date('2026-01-02T00:00:00.000Z'),
      }),
    ).resolves.toBe(true)
    await expect(
      repository.recordActiveTrackProblemCompletion({
        problemSlug: 'two-sum',
        rating: 'easy',
        completedAt: new Date('2026-01-03T00:00:00.000Z'),
      }),
    ).resolves.toBe(true)
    await expect(
      repository.recordActiveTrackProblemCompletion({
        problemSlug: 'two-sum',
        rating: 'good',
        completedAt: new Date('2026-01-04T00:00:00.000Z'),
      }),
    ).resolves.toBe(false)

    const progressRows = await handle.db
      .select()
      .from(trackProblemProgress)
      .orderBy(
        asc(trackProblemProgress.trackGroupId),
        asc(trackProblemProgress.problemSlug),
      )

    expect(progressRows).toMatchObject([
      {
        trackGroupId: 'leetcode-75:arrays-hashing',
        problemSlug: 'two-sum',
        completedRating: 'good',
      },
      {
        trackGroupId: 'leetcode-75:duplicates',
        problemSlug: 'two-sum',
        completedRating: 'easy',
      },
    ])
  })

  it('does not record completion for inactive tracks with the same problem', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })
    const repository = createTracksRepository(handle.db)

    await handle.db.insert(trackGroupProblems).values({
      trackGroupId: 'grind-75:stack',
      problemSlug: 'two-sum',
      position: 2,
    })

    await expect(
      repository.recordActiveTrackProblemCompletion({
        problemSlug: 'two-sum',
        rating: 'good',
        completedAt: new Date('2026-01-02T00:00:00.000Z'),
      }),
    ).resolves.toBe(true)

    const progressRows = await handle.db
      .select()
      .from(trackProblemProgress)
      .orderBy(
        asc(trackProblemProgress.trackGroupId),
        asc(trackProblemProgress.problemSlug),
      )

    expect(progressRows).toMatchObject([
      {
        trackGroupId: 'leetcode-75:arrays-hashing',
        problemSlug: 'two-sum',
      },
    ])
  })
})
