import { asc } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { createSettingsRepository } from '@/features/settings/data/settings-repository'
import {
  fsrsCards,
  problemPractice,
  trackGroupProblems,
  trackGroups,
  trackProblemProgress,
  trackSession,
} from '@/platform/db/schema'
import { createTestDb } from '@/platform/db/test-db'
import type { Db } from '@/platform/db'

import {
  createTrack,
  deleteTrack,
  getActiveTrack,
  getTrackForEdit,
  getWorkspace,
  resetTrackProgress,
  updateTrack,
} from './tracks-service'

describe('tracks service', () => {
  it('returns the active track in study-plan mode', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })

    const activeTrack = await getActiveTrack(handle.db)

    expect(activeTrack).toMatchObject({
      track: {
        id: 'leetcode-75',
      },
      nextProblem: {
        slug: 'two-sum',
      },
    })
  })

  it('returns null in free-practice mode', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })

    await createSettingsRepository(handle.db).updateSettings({
      practice: {
        mode: 'freePractice',
      },
    })

    await expect(getActiveTrack(handle.db)).resolves.toBeNull()
  })

  it('reads the management workspace even in free-practice mode', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })

    await createSettingsRepository(handle.db).updateSettings({
      practice: {
        mode: 'freePractice',
      },
    })

    const workspace = await getWorkspace(handle.db, {
      surface: 'dashboard',
      at: '2026-01-10T12:00:00.000Z',
    })

    expect(workspace.activeTrack?.track.id).toBe('leetcode-75')
    expect(workspace.tracks.map((row) => row.track.id)).toEqual([
      'grind-75',
      'leetcode-75',
    ])
  })

  it('assembles active workspace rows, groups, progress, due count, and next problem', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })
    const timestamp = new Date('2026-01-02T00:00:00.000Z').getTime()

    await handle.db.insert(trackGroups).values([
      {
        id: 'leetcode-75:stack',
        trackId: 'leetcode-75',
        title: 'Stack',
        position: 2,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: 'leetcode-75:review',
        trackId: 'leetcode-75',
        title: 'Review',
        position: 3,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ])
    await handle.db.insert(trackGroupProblems).values([
      {
        trackGroupId: 'leetcode-75:stack',
        problemSlug: 'valid-parentheses',
        position: 1,
      },
      {
        trackGroupId: 'leetcode-75:review',
        problemSlug: 'two-sum',
        position: 1,
      },
    ])
    await makeProblemDue(handle.db, 'valid-parentheses', {
      now: new Date('2026-01-10T12:00:00.000Z'),
    })

    const workspace = await getWorkspace(handle.db, {
      surface: 'dashboard',
      at: '2026-01-10T12:00:00.000Z',
    })

    expect(workspace).toMatchObject({
      generatedAt: '2026-01-10T12:00:00.000Z',
      activeTrack: {
        track: {
          id: 'leetcode-75',
          title: 'LeetCode 75',
        },
        activeGroup: {
          id: 'leetcode-75:arrays-hashing',
        },
        progress: {
          completedCount: 0,
          totalCount: 3,
          percent: 0,
        },
        nextProblem: {
          slug: 'valid-parentheses',
        },
      },
      dueCount: 1,
    })
    expect(workspace.tracks.map((row) => row.track.id)).toEqual([
      'grind-75',
      'leetcode-75',
    ])
    expect(workspace.activeTrackGroups.map((group) => group.id)).toEqual([
      'leetcode-75:arrays-hashing',
      'leetcode-75:stack',
      'leetcode-75:review',
    ])
    expect(
      workspace.activeTrackRows.map((row) => [
        row.problem.slug,
        row.status,
        row.membership.groupId,
        row.membership.groupTitle,
        row.membership.groupPosition,
        row.membership.problemPosition,
        row.membership.completedAt,
        row.membership.completedRating,
      ]),
    ).toEqual([
      [
        'two-sum',
        'not-started',
        'leetcode-75:arrays-hashing',
        'Arrays and Hashing',
        1,
        1,
        null,
        null,
      ],
      [
        'valid-parentheses',
        'due',
        'leetcode-75:stack',
        'Stack',
        2,
        1,
        null,
        null,
      ],
      [
        'two-sum',
        'not-started',
        'leetcode-75:review',
        'Review',
        3,
        1,
        null,
        null,
      ],
    ])
  })

  it('scopes the workspace due count to active-track problem memberships', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })

    await makeProblemDue(handle.db, 'valid-parentheses', {
      now: new Date('2026-01-10T12:00:00.000Z'),
    })

    const workspace = await getWorkspace(handle.db, {
      surface: 'dashboard',
      at: '2026-01-10T12:00:00.000Z',
    })

    expect(workspace.activeTrackRows.map((row) => row.problem.slug)).toEqual([
      'two-sum',
    ])
    expect(workspace.dueCount).toBe(0)
  })

  it('excludes completed due memberships from due count and next problem', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })

    await addActiveTrackMembership(handle.db, {
      groupId: 'leetcode-75:stack',
      groupTitle: 'Stack',
      problemSlug: 'valid-parentheses',
      groupPosition: 2,
    })
    await makeProblemDue(handle.db, 'two-sum', {
      now: new Date('2026-01-10T12:00:00.000Z'),
    })
    await completeTrackProblem(handle.db, {
      groupId: 'leetcode-75:arrays-hashing',
      problemSlug: 'two-sum',
    })

    const workspace = await getWorkspace(handle.db, {
      surface: 'dashboard',
      at: '2026-01-10T12:00:00.000Z',
    })

    expect(
      workspace.activeTrackRows.map((row) => [
        row.problem.slug,
        row.status,
        row.membership.completedAt,
      ]),
    ).toEqual([
      ['two-sum', 'due', '2026-01-03T00:00:00.000Z'],
      ['valid-parentheses', 'not-started', null],
    ])
    expect(workspace.dueCount).toBe(0)
    expect(workspace.activeTrack?.nextProblem?.slug).toBe('valid-parentheses')
  })

  it('chooses next problem from incomplete active rows by due, non-suspended, then null', async () => {
    const dueHandle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })

    await addActiveTrackMembership(dueHandle.db, {
      groupId: 'leetcode-75:stack',
      groupTitle: 'Stack',
      problemSlug: 'valid-parentheses',
      groupPosition: 2,
    })
    await makeProblemDue(dueHandle.db, 'valid-parentheses', {
      now: new Date('2026-01-10T12:00:00.000Z'),
    })

    await expect(
      getWorkspace(dueHandle.db, {
        surface: 'dashboard',
        at: '2026-01-10T12:00:00.000Z',
      }),
    ).resolves.toMatchObject({
      activeTrack: {
        nextProblem: {
          slug: 'valid-parentheses',
        },
      },
    })

    const unscheduledHandle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })

    await addActiveTrackMembership(unscheduledHandle.db, {
      groupId: 'leetcode-75:stack',
      groupTitle: 'Stack',
      problemSlug: 'valid-parentheses',
      groupPosition: 2,
    })
    await suspendProblem(unscheduledHandle.db, 'two-sum')

    await expect(
      getWorkspace(unscheduledHandle.db, {
        surface: 'dashboard',
        at: '2026-01-10T12:00:00.000Z',
      }),
    ).resolves.toMatchObject({
      activeTrack: {
        nextProblem: {
          slug: 'valid-parentheses',
        },
      },
    })

    const completeHandle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })

    await completeTrackProblem(completeHandle.db, {
      groupId: 'leetcode-75:arrays-hashing',
      problemSlug: 'two-sum',
    })

    await expect(
      getWorkspace(completeHandle.db, {
        surface: 'dashboard',
        at: '2026-01-10T12:00:00.000Z',
      }),
    ).resolves.toMatchObject({
      activeTrack: {
        nextProblem: null,
      },
    })
  })

  it('uses the workspace next-problem algorithm for direct active-track reads', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })

    await addActiveTrackMembership(handle.db, {
      groupId: 'leetcode-75:stack',
      groupTitle: 'Stack',
      problemSlug: 'valid-parentheses',
      groupPosition: 2,
    })
    await makeProblemDue(handle.db, 'valid-parentheses', {
      now: new Date('2026-01-10T12:00:00.000Z'),
    })

    const activeTrack = await getActiveTrack(
      handle.db,
      new Date('2026-01-10T12:00:00.000Z'),
    )

    expect(activeTrack?.nextProblem?.slug).toBe('valid-parentheses')
  })

  it('returns create defaults and searchable Library problem rows for a new track', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })

    const edit = await getTrackForEdit(handle.db, {
      surface: 'dashboard',
    })

    expect(edit.track).toBeNull()
    expect(edit.groups).toEqual([
      {
        title: 'Main',
        position: 1,
        problemSlugs: [],
      },
    ])
    expect(edit.problemRows.map((row) => row.problem.slug)).toEqual([
      'two-sum',
      'valid-parentheses',
    ])
  })

  it('returns existing track metadata, ordered groups, memberships, and Library problem rows for edit', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })

    await addActiveTrackMembership(handle.db, {
      groupId: 'leetcode-75:stack',
      groupTitle: 'Stack',
      problemSlug: 'valid-parentheses',
      groupPosition: 2,
    })

    const edit = await getTrackForEdit(handle.db, {
      surface: 'dashboard',
      trackId: 'leetcode-75',
    })

    expect(edit.track).toMatchObject({
      id: 'leetcode-75',
      title: 'LeetCode 75',
    })
    expect(
      edit.groups.map((group) => [
        group.id,
        group.trackId,
        group.title,
        group.position,
        group.problemSlugs,
      ]),
    ).toEqual([
      [
        'leetcode-75:arrays-hashing',
        'leetcode-75',
        'Arrays and Hashing',
        1,
        ['two-sum'],
      ],
      ['leetcode-75:stack', 'leetcode-75', 'Stack', 2, ['valid-parentheses']],
    ])
    expect(edit.problemRows.map((row) => row.problem.slug)).toEqual([
      'two-sum',
      'valid-parentheses',
    ])
  })

  it('creates and activates a new track when requested', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })

    const edit = await createTrack(handle.db, {
      surface: 'dashboard',
      title: 'Dynamic Plan',
      description: null,
      dueAt: null,
      groups: [
        {
          title: 'Main',
          problemSlugs: ['valid-parentheses'],
        },
      ],
      setActive: true,
    })
    const sessionRows = await handle.db.select().from(trackSession)

    expect(edit.track).toMatchObject({
      id: 'dynamic-plan',
      title: 'Dynamic Plan',
    })
    expect(sessionRows).toMatchObject([
      {
        activeTrackId: 'dynamic-plan',
        activeGroupId: 'dynamic-plan:main',
      },
    ])
  })

  it('rejects updates that remove every group', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })

    await expect(
      updateTrack(handle.db, {
        surface: 'dashboard',
        trackId: 'leetcode-75',
        title: 'LeetCode 75',
        description: null,
        dueAt: null,
        groups: [],
      }),
    ).rejects.toThrow(/at least one group/i)
  })

  it('clears the active session when deleting the active track', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })

    await deleteTrack(handle.db, {
      surface: 'dashboard',
      trackId: 'leetcode-75',
    })

    const sessionRows = await handle.db.select().from(trackSession)

    expect(sessionRows).toMatchObject([
      {
        activeTrackId: null,
        activeGroupId: null,
      },
    ])
  })

  it('rejects deleting a missing track', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })

    await expect(
      deleteTrack(handle.db, {
        surface: 'dashboard',
        trackId: 'missing',
      }),
    ).rejects.toThrow('Track "missing" was not found.')
  })

  it('resets only the requested track ledger', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })

    await completeTrackProblem(handle.db, {
      groupId: 'leetcode-75:arrays-hashing',
      problemSlug: 'two-sum',
    })
    await completeTrackProblem(handle.db, {
      groupId: 'grind-75:stack',
      problemSlug: 'valid-parentheses',
    })

    await resetTrackProgress(handle.db, {
      surface: 'dashboard',
      trackId: 'leetcode-75',
    })

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

  it('rejects resetting progress for a missing track', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })

    await expect(
      resetTrackProgress(handle.db, {
        surface: 'dashboard',
        trackId: 'missing',
      }),
    ).rejects.toThrow('Track "missing" was not found.')
  })
})

async function addActiveTrackMembership(
  db: Db,
  input: {
    groupId: string
    groupTitle: string
    problemSlug: string
    groupPosition: number
  },
) {
  const timestamp = new Date('2026-01-02T00:00:00.000Z').getTime()

  await db.insert(trackGroups).values({
    id: input.groupId,
    trackId: 'leetcode-75',
    title: input.groupTitle,
    position: input.groupPosition,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  await db.insert(trackGroupProblems).values({
    trackGroupId: input.groupId,
    problemSlug: input.problemSlug,
    position: 1,
  })
}

async function makeProblemDue(
  db: Db,
  problemSlug: string,
  input: { now: Date },
) {
  const lastReviewedAt = input.now.getTime() - 10 * dayMs
  const timestamp = input.now.getTime()

  await db
    .insert(problemPractice)
    .values({
      problemSlug,
      status: 'review',
      firstSeenAt: lastReviewedAt,
      lastSeenAt: lastReviewedAt,
      lastReviewedAt,
      lastRating: 'good',
      solvedCount: 1,
      attemptCount: 1,
      isSuspended: false,
      createdAt: lastReviewedAt,
      updatedAt: timestamp,
    })
    .onConflictDoUpdate({
      target: problemPractice.problemSlug,
      set: {
        status: 'review',
        lastSeenAt: lastReviewedAt,
        lastReviewedAt,
        lastRating: 'good',
        solvedCount: 1,
        attemptCount: 1,
        isSuspended: false,
        updatedAt: timestamp,
      },
    })
  await db
    .insert(fsrsCards)
    .values({
      id: `${problemSlug}:default`,
      problemSlug,
      cardKind: 'default',
      dueAt: input.now.getTime() - dayMs,
      stability: 1,
      difficulty: 5,
      elapsedDays: 10,
      scheduledDays: 1,
      learningSteps: 0,
      reps: 1,
      lapses: 0,
      state: 'review',
      lastReviewAt: lastReviewedAt,
      createdAt: lastReviewedAt,
      updatedAt: timestamp,
    })
    .onConflictDoUpdate({
      target: fsrsCards.id,
      set: {
        dueAt: input.now.getTime() - dayMs,
        stability: 1,
        difficulty: 5,
        elapsedDays: 10,
        scheduledDays: 1,
        learningSteps: 0,
        reps: 1,
        lapses: 0,
        state: 'review',
        lastReviewAt: lastReviewedAt,
        updatedAt: timestamp,
      },
    })
}

async function suspendProblem(db: Db, problemSlug: string) {
  const timestamp = new Date('2026-01-02T00:00:00.000Z').getTime()

  await db.insert(problemPractice).values({
    problemSlug,
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
}

async function completeTrackProblem(
  db: Db,
  input: {
    groupId: string
    problemSlug: string
  },
) {
  const timestamp = new Date('2026-01-03T00:00:00.000Z').getTime()

  await db.insert(trackProblemProgress).values({
    trackGroupId: input.groupId,
    problemSlug: input.problemSlug,
    completedAt: timestamp,
    completedRating: 'good',
    createdAt: timestamp,
    updatedAt: timestamp,
  })
}

const dayMs = 24 * 60 * 60 * 1000
