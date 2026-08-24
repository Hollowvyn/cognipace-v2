import { asc, eq } from 'drizzle-orm'
import { describe, expect, it, vi } from 'vitest'

import { saveReviewResult } from '@/features/practice/server/practice-service'
import {
  trackImportResultSchema,
  tracksImportTracksRequestSchema,
  type TrackImportRequest,
} from '@/features/tracks/api/tracks-contracts'
import { createSettingsRepository } from '@/features/settings/data/settings-repository'
import { createTracksRepository } from '@/features/tracks/data/tracks-repository'
import {
  problems,
  fsrsCards,
  problemPractice,
  reviewAttempts,
  settingsKv,
  trackGroupProblems,
  trackGroups,
  trackProblemProgress,
  trackSession,
  tracks,
} from '@/platform/db/schema'
import { createTestDb } from '@/platform/db/test-db'
import type { Db } from '@/platform/db'
import { setOnMutationHook } from '@/platform/db/proxy'

import {
  createTrack,
  deleteTrack,
  getActiveTrack,
  getTrackForEdit,
  getWorkspace,
  importTracks,
  recordActiveTrackProblemCompletion,
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
        id: 'bytebytego-coding-patterns-101',
      },
      nextProblem: {
        slug: 'two-sum-ii-input-array-is-sorted',
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

    expect(workspace.activeTrack?.track.id).toBe(
      'bytebytego-coding-patterns-101',
    )
    expect(workspace.tracks.map((row) => row.track.id)).toEqual([
      'bytebytego-coding-patterns-101',
      'grind-75',
      'leetcode-75',
    ])
  })

  it('assembles active workspace rows, groups, progress, due count, and next problem', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })
    const timestamp = new Date('2026-01-02T00:00:00.000Z').getTime()

    await makeLeetCodeActive(handle.db)
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
        trackId: 'leetcode-75',
        problemSlug: 'valid-parentheses',
        position: 1,
      },
      {
        trackGroupId: 'leetcode-75:review',
        trackId: 'leetcode-75',
        problemSlug: 'valid-sudoku',
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
      'bytebytego-coding-patterns-101',
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
        row.membership.completion,
      ]),
    ).toEqual([
      [
        'two-sum',
        'not-started',
        'leetcode-75:arrays-hashing',
        'Arrays and Hashing',
        1,
        1,
        { status: 'incomplete', reviewAttemptId: null },
      ],
      [
        'valid-parentheses',
        'due',
        'leetcode-75:stack',
        'Stack',
        2,
        1,
        { status: 'incomplete', reviewAttemptId: null },
      ],
      [
        'valid-sudoku',
        'not-started',
        'leetcode-75:review',
        'Review',
        3,
        1,
        { status: 'incomplete', reviewAttemptId: null },
      ],
    ])
  })

  it('scopes the workspace due count to active-track problem memberships', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })

    await makeLeetCodeActive(handle.db)
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

    await makeLeetCodeActive(handle.db)
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
      trackId: 'leetcode-75',
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
        row.membership.completion,
      ]),
    ).toEqual([
      [
        'two-sum',
        'due',
        {
          status: 'completed',
          completedAt: '2026-01-03T00:00:00.000Z',
          completedRating: 'good',
          reviewAttemptId: null,
        },
      ],
      [
        'valid-parentheses',
        'not-started',
        { status: 'incomplete', reviewAttemptId: null },
      ],
    ])
    expect(workspace.dueCount).toBe(0)
    expect(workspace.activeTrack?.nextProblem?.slug).toBe('valid-parentheses')
  })

  it('chooses next problem from incomplete active rows by due, non-suspended, then null', async () => {
    const dueHandle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })

    await makeLeetCodeActive(dueHandle.db)
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

    await makeLeetCodeActive(unscheduledHandle.db)
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

    await makeLeetCodeActive(completeHandle.db)
    await completeTrackProblem(completeHandle.db, {
      trackId: 'leetcode-75',
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

    await makeLeetCodeActive(handle.db)
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
    const problemSlugs = edit.problemRows.map((row) => row.problem.slug)
    expect(problemSlugs).toHaveLength(101)
    expect(problemSlugs).toContain('two-sum')
    expect(problemSlugs).toContain('valid-parentheses')
    expect(edit.problemRows[0]).toMatchObject({
      problem: {
        slug: 'ones-and-zeroes',
      },
    })
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
    const problemSlugs = edit.problemRows.map((row) => row.problem.slug)
    expect(problemSlugs).toHaveLength(101)
    expect(problemSlugs).toContain('two-sum')
    expect(problemSlugs).toContain('valid-parentheses')
    expect(edit.problemRows[0]).toMatchObject({
      problem: {
        slug: 'ones-and-zeroes',
      },
    })
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

    await makeLeetCodeActive(handle.db)
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
      trackId: 'leetcode-75',
      problemSlug: 'two-sum',
    })
    await completeTrackProblem(handle.db, {
      trackId: 'grind-75',
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
        asc(trackProblemProgress.trackId),
        asc(trackProblemProgress.problemSlug),
      )

    expect(progressRows).toMatchObject([
      {
        trackId: 'grind-75',
        problemSlug: 'valid-parentheses',
      },
    ])
  })

  it('keeps the legacy completion wrapper writing nullable review attempt ids', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })

    await makeLeetCodeActive(handle.db)

    await expect(
      recordActiveTrackProblemCompletion(handle.db, {
        problemSlug: 'two-sum',
        rating: 'good',
        completedAt: new Date('2026-01-03T00:00:00.000Z'),
      }),
    ).resolves.toBe(true)

    await expect(
      handle.db.select().from(trackProblemProgress),
    ).resolves.toMatchObject([
      {
        trackId: 'leetcode-75',
        problemSlug: 'two-sum',
        reviewAttemptId: null,
        completedAt: new Date('2026-01-03T00:00:00.000Z').getTime(),
        completedRating: 'good',
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

describe('track import orchestration', () => {
  it('imports multiple tracks in file order with ordered groups and members', async () => {
    const handle = await createTestDb({ seed: false })

    const result = await importTracks(
      handle.db,
      parseImportRequest({
        schemaVersion: 1,
        app: 'cognipace-track-import',
        problems: [
          {
            slug: 'Shared Problem',
            title: 'Shared Imported Problem',
            difficulty: 'medium',
            isPremium: false,
          },
          {
            slug: 'Explicit Problem',
            title: 'Explicit Imported Problem',
            difficulty: 'hard',
            isPremium: true,
          },
        ],
        tracks: [
          {
            title: 'First Import',
            description: 'Ordered first',
            dueAt: '2026-01-04T00:00:00.000Z',
            groups: [
              {
                title: 'First Group',
                problemSlugs: ['shared_problem', 'fallback_problem'],
              },
              {
                title: 'Second Group',
                problemSlugs: ['explicit-problem'],
              },
            ],
          },
          {
            title: 'Second Import',
            description: null,
            dueAt: null,
            groups: [
              {
                title: 'Only Group',
                problemSlugs: ['shared-problem', 'second-fallback'],
              },
            ],
          },
        ],
      }),
    )

    expect(trackImportResultSchema.parse(result)).toEqual({
      createdTrackIds: ['first-import', 'second-import'],
      createdTrackCount: 2,
      createdProblemCount: 4,
      reusedProblemCount: 0,
    })

    const repository = createTracksRepository(handle.db)
    await expect(
      repository.getTrackById('first-import'),
    ).resolves.toMatchObject({
      id: 'first-import',
      title: 'First Import',
      description: 'Ordered first',
      dueAt: new Date('2026-01-04T00:00:00.000Z'),
    })
    await expect(repository.getGroups('first-import')).resolves.toEqual([
      {
        id: 'first-import:first-group',
        trackId: 'first-import',
        title: 'First Group',
        position: 1,
      },
      {
        id: 'first-import:second-group',
        trackId: 'first-import',
        title: 'Second Group',
        position: 2,
      },
    ])
    await expect(
      repository.getMemberships('first-import'),
    ).resolves.toMatchObject([
      {
        groupId: 'first-import:first-group',
        problemSlug: 'shared-problem',
        problemPosition: 1,
      },
      {
        groupId: 'first-import:first-group',
        problemSlug: 'fallback-problem',
        problemPosition: 2,
      },
      {
        groupId: 'first-import:second-group',
        problemSlug: 'explicit-problem',
        problemPosition: 1,
      },
    ])
    await expect(
      repository.getMemberships('second-import'),
    ).resolves.toMatchObject([
      {
        groupId: 'second-import:only-group',
        problemSlug: 'shared-problem',
        problemPosition: 1,
      },
      {
        groupId: 'second-import:only-group',
        problemSlug: 'second-fallback',
        problemPosition: 2,
      },
    ])
  })

  it('reuses existing problems without changing metadata and creates explicit and fallback problems', async () => {
    const handle = await createTestDb({ seed: false })
    const originalExistingProblem = {
      slug: 'existing-problem',
      title: 'Original Metadata',
      difficulty: 'hard' as const,
      isPremium: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z').getTime(),
      updatedAt: new Date('2026-01-02T00:00:00.000Z').getTime(),
    }
    await handle.db.insert(problems).values(originalExistingProblem)

    const result = await importTracks(
      handle.db,
      parseImportRequest({
        schemaVersion: 1,
        app: 'cognipace-track-import',
        problems: [
          {
            slug: 'existing-problem',
            title: 'Incoming Metadata',
            difficulty: 'easy',
            isPremium: false,
          },
          {
            slug: 'explicit-problem',
            title: 'Explicit Metadata',
            difficulty: 'medium',
            isPremium: true,
          },
        ],
        tracks: [
          {
            title: 'Metadata Import',
            description: null,
            dueAt: null,
            groups: [
              {
                title: 'Main',
                problemSlugs: [
                  'existing-problem',
                  'explicit-problem',
                  'fallback-problem',
                ],
              },
            ],
          },
        ],
      }),
    )

    expect(result).toMatchObject({
      createdProblemCount: 2,
      reusedProblemCount: 1,
    })
    await expect(
      handle.db
        .select()
        .from(problems)
        .where(eq(problems.slug, 'existing-problem')),
    ).resolves.toEqual([originalExistingProblem])
    await expect(
      handle.db
        .select()
        .from(problems)
        .where(eq(problems.slug, 'explicit-problem')),
    ).resolves.toMatchObject([
      {
        slug: 'explicit-problem',
        title: 'Explicit Metadata',
        difficulty: 'medium',
        isPremium: true,
      },
    ])
    await expect(
      handle.db
        .select()
        .from(problems)
        .where(eq(problems.slug, 'fallback-problem')),
    ).resolves.toMatchObject([
      {
        slug: 'fallback-problem',
        title: 'Fallback Problem',
        difficulty: 'unknown',
        isPremium: false,
      },
    ])
  })

  it('leaves active state, practice history, settings, and unrelated tracks unchanged', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })
    await makeLeetCodeActive(handle.db)
    await saveReviewResult(handle.db, {
      problemSlug: 'two-sum',
      rating: 'good',
      reviewedAt: new Date('2026-01-02T12:00:00.000Z'),
      isCorrect: true,
      reviewAttemptId: 'preserved-review-attempt',
    })
    await completeTrackProblem(handle.db, {
      trackId: 'leetcode-75',
      problemSlug: 'two-sum',
    })
    const before = await readStableTrackState(handle.db)

    expect(before.practice).toHaveLength(1)
    expect(before.cards).toHaveLength(1)
    expect(before.reviewAttempts).toHaveLength(1)
    expect(before.trackProgress).toHaveLength(1)

    await importTracks(
      handle.db,
      parseImportRequest({
        schemaVersion: 1,
        app: 'cognipace-track-import',
        tracks: [
          {
            title: 'Isolated Import',
            description: null,
            dueAt: null,
            groups: [
              {
                title: 'Main',
                problemSlugs: ['isolated-problem'],
              },
            ],
          },
        ],
      }),
    )

    const after = await readStableTrackState(
      handle.db,
      new Set(before.tracks.map((track) => track.id)),
    )

    expect(after).toEqual(before)
  })

  it('does not activate imported tracks', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })
    const beforeSession = await handle.db.select().from(trackSession)

    await importTracks(
      handle.db,
      parseImportRequest({
        schemaVersion: 1,
        app: 'cognipace-track-import',
        tracks: [
          {
            title: 'Never Active Import',
            description: null,
            dueAt: null,
            groups: [
              {
                title: 'Main',
                problemSlugs: ['never-active-problem'],
              },
            ],
          },
        ],
      }),
    )

    await expect(handle.db.select().from(trackSession)).resolves.toEqual(
      beforeSession,
    )
  })

  it('rejects an existing track conflict before any import write', async () => {
    const handle = await createTestDb({ seed: false })
    const timestamp = new Date('2026-01-01T00:00:00.000Z').getTime()
    await handle.db.insert(tracks).values({
      id: 'conflicting-track',
      slug: 'conflicting-track',
      title: 'Conflicting Track',
      description: null,
      dueAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    })

    let mutationCount = 0
    setOnMutationHook(() => {
      mutationCount += 1
    })

    try {
      await expect(
        importTracks(
          handle.db,
          parseImportRequest({
            schemaVersion: 1,
            app: 'cognipace-track-import',
            tracks: [
              {
                title: 'Conflicting Track',
                description: null,
                dueAt: null,
                groups: [
                  {
                    title: 'Main',
                    problemSlugs: ['missing-after-conflict'],
                  },
                ],
              },
            ],
          }),
        ),
      ).rejects.toThrow(
        'Track "Conflicting Track" already exists. Rename or delete it explicitly before importing.',
      )
    } finally {
      setOnMutationHook(null)
    }

    expect(mutationCount).toBe(0)
    await expect(handle.db.select().from(problems)).resolves.toEqual([])
  })

  it('rejects normalized title conflicts across case and separators', async () => {
    const handle = await createTestDb({ seed: false })
    await handle.db.insert(tracks).values({
      id: 'legacy-title-record',
      slug: 'legacy-title-record',
      title: 'Case Variation Track',
      description: null,
      dueAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z').getTime(),
      updatedAt: new Date('2026-01-01T00:00:00.000Z').getTime(),
    })

    let mutationCount = 0
    setOnMutationHook(() => {
      mutationCount += 1
    })

    try {
      await expect(
        importTracks(
          handle.db,
          parseImportRequest({
            schemaVersion: 1,
            app: 'cognipace-track-import',
            tracks: [
              {
                title: 'case_variation-track',
                description: null,
                dueAt: null,
                groups: [
                  {
                    title: 'Main',
                    problemSlugs: ['case-variation-problem'],
                  },
                ],
              },
            ],
          }),
        ),
      ).rejects.toThrow(
        'Track "case_variation-track" already exists. Rename or delete it explicitly before importing.',
      )
    } finally {
      setOnMutationHook(null)
    }

    expect(mutationCount).toBe(0)
    await expect(handle.db.select().from(problems)).resolves.toEqual([])
  })

  it('rejects a slug-only conflict with a clear rename or delete message', async () => {
    const handle = await createTestDb({ seed: false })
    await handle.db.insert(tracks).values({
      id: 'legacy-slug-record',
      slug: 'slug-only-reservation',
      title: 'Different Existing Track',
      description: null,
      dueAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z').getTime(),
      updatedAt: new Date('2026-01-01T00:00:00.000Z').getTime(),
    })

    await expect(
      importTracks(
        handle.db,
        parseImportRequest({
          schemaVersion: 1,
          app: 'cognipace-track-import',
          tracks: [
            {
              title: 'Slug Only Reservation',
              description: null,
              dueAt: null,
              groups: [
                {
                  title: 'Main',
                  problemSlugs: ['slug-only-problem'],
                },
              ],
            },
          ],
        }),
      ),
    ).rejects.toThrow(
      'Track "Slug Only Reservation" conflicts with existing track slug "slug-only-reservation" used by "Different Existing Track". Rename or delete it explicitly before importing.',
    )

    await expect(handle.db.select().from(problems)).resolves.toEqual([])
  })

  it('preserves the generated-id conflict check when slug and title differ', async () => {
    const handle = await createTestDb({ seed: false })
    await handle.db.insert(tracks).values({
      id: 'generated-id-only',
      slug: 'different-existing-slug',
      title: 'Different Existing Track',
      description: null,
      dueAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z').getTime(),
      updatedAt: new Date('2026-01-01T00:00:00.000Z').getTime(),
    })

    await expect(
      importTracks(
        handle.db,
        parseImportRequest({
          schemaVersion: 1,
          app: 'cognipace-track-import',
          tracks: [
            {
              title: 'Generated ID Only',
              description: null,
              dueAt: null,
              groups: [
                {
                  title: 'Main',
                  problemSlugs: ['generated-id-problem'],
                },
              ],
            },
          ],
        }),
      ),
    ).rejects.toThrow(
      'Track "Generated ID Only" already exists. Rename or delete it explicitly before importing.',
    )

    await expect(handle.db.select().from(problems)).resolves.toEqual([])
  })

  it('rejects a later normalized title conflict even when the existing id is arbitrary', async () => {
    const handle = await createTestDb({ seed: false })
    const existingTrack = {
      id: 'legacy-track-record',
      slug: 'legacy-track-slug',
      title: 'Legacy Track',
      description: null,
      dueAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z').getTime(),
      updatedAt: new Date('2026-01-01T00:00:00.000Z').getTime(),
    }
    await handle.db.insert(tracks).values(existingTrack)

    let mutationCount = 0
    setOnMutationHook(() => {
      mutationCount += 1
    })

    try {
      await expect(
        importTracks(
          handle.db,
          parseImportRequest({
            schemaVersion: 1,
            app: 'cognipace-track-import',
            tracks: [
              {
                title: 'Fresh Import',
                description: null,
                dueAt: null,
                groups: [
                  {
                    title: 'Main',
                    problemSlugs: ['fresh-import-problem'],
                  },
                ],
              },
              {
                title: 'Legacy Track',
                description: null,
                dueAt: null,
                groups: [
                  {
                    title: 'Main',
                    problemSlugs: ['later-conflict-problem'],
                  },
                ],
              },
            ],
          }),
        ),
      ).rejects.toThrow(
        'Track "Legacy Track" already exists. Rename or delete it explicitly before importing.',
      )
    } finally {
      setOnMutationHook(null)
    }

    expect(mutationCount).toBe(0)
    await expect(handle.db.select().from(tracks)).resolves.toEqual([
      existingTrack,
    ])
    await expect(handle.db.select().from(problems)).resolves.toEqual([])
  })

  it('rejects a later-file slug conflict before any import writes', async () => {
    const handle = await createTestDb({ seed: false })
    const existingTrack = {
      id: 'legacy-later-slug-record',
      slug: 'later-slug-conflict',
      title: 'Different Existing Track',
      description: null,
      dueAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z').getTime(),
      updatedAt: new Date('2026-01-01T00:00:00.000Z').getTime(),
    }
    await handle.db.insert(tracks).values(existingTrack)

    let mutationCount = 0
    setOnMutationHook(() => {
      mutationCount += 1
    })

    try {
      await expect(
        importTracks(
          handle.db,
          parseImportRequest({
            schemaVersion: 1,
            app: 'cognipace-track-import',
            tracks: [
              {
                title: 'First Import Before Conflict',
                description: null,
                dueAt: null,
                groups: [
                  {
                    title: 'Main',
                    problemSlugs: ['first-before-slug-conflict'],
                  },
                ],
              },
              {
                title: 'Later Slug Conflict',
                description: null,
                dueAt: null,
                groups: [
                  {
                    title: 'Main',
                    problemSlugs: ['later-slug-conflict-problem'],
                  },
                ],
              },
            ],
          }),
        ),
      ).rejects.toThrow(
        'Track "Later Slug Conflict" conflicts with existing track slug "later-slug-conflict" used by "Different Existing Track". Rename or delete it explicitly before importing.',
      )
    } finally {
      setOnMutationHook(null)
    }

    expect(mutationCount).toBe(0)
    await expect(handle.db.select().from(problems)).resolves.toEqual([])
    await expect(handle.db.select().from(tracks)).resolves.toEqual([
      existingTrack,
    ])
  })

  it('rolls back problems, earlier tracks, and later track writes on insertion failure', async () => {
    const handle = await createTestDb({ seed: false })
    const beforeProgress = await handle.db.select().from(trackProblemProgress)
    const beforeSession = await handle.db.select().from(trackSession)
    let trackInsertCount = 0
    setOnMutationHook((sql) => {
      if (sql.toLowerCase().includes('insert into "tracks"')) {
        trackInsertCount += 1
      }

      if (trackInsertCount === 2) {
        throw new Error('forced track insertion failure')
      }
    })

    try {
      await expect(
        importTracks(
          handle.db,
          parseImportRequest({
            schemaVersion: 1,
            app: 'cognipace-track-import',
            problems: [{ slug: 'first-problem' }, { slug: 'second-problem' }],
            tracks: [
              {
                title: 'First Imported Track',
                description: null,
                dueAt: null,
                groups: [
                  {
                    title: 'Main',
                    problemSlugs: ['first-problem'],
                  },
                ],
              },
              {
                title: 'Fails During Later Insert',
                description: null,
                dueAt: null,
                groups: [
                  {
                    title: 'Main',
                    problemSlugs: ['second-problem'],
                  },
                ],
              },
            ],
          }),
        ),
      ).rejects.toThrow('insert into "tracks"')
    } finally {
      setOnMutationHook(null)
    }

    await expect(handle.db.select().from(problems)).resolves.toEqual([])
    await expect(handle.db.select().from(tracks)).resolves.toEqual([])
    await expect(handle.db.select().from(trackGroups)).resolves.toEqual([])
    await expect(handle.db.select().from(trackGroupProblems)).resolves.toEqual(
      [],
    )
    await expect(
      handle.db.select().from(trackProblemProgress),
    ).resolves.toEqual(beforeProgress)
    await expect(handle.db.select().from(trackSession)).resolves.toEqual(
      beforeSession,
    )
    expect(trackInsertCount).toBe(2)
  })

  it('rolls back writes when the import result fails validation inside the transaction', async () => {
    const handle = await createTestDb({ seed: false })
    const parseSpy = vi
      .spyOn(trackImportResultSchema, 'parse')
      .mockImplementation(() => {
        throw new Error('forced import result validation failure')
      })

    try {
      await expect(
        importTracks(
          handle.db,
          parseImportRequest({
            schemaVersion: 1,
            app: 'cognipace-track-import',
            tracks: [
              {
                title: 'Result Validation Import',
                description: null,
                dueAt: null,
                groups: [
                  {
                    title: 'Main',
                    problemSlugs: ['result-validation-problem'],
                  },
                ],
              },
            ],
          }),
        ),
      ).rejects.toThrow('forced import result validation failure')
      expect(parseSpy).toHaveBeenCalledOnce()
    } finally {
      parseSpy.mockRestore()
    }

    await expect(handle.db.select().from(problems)).resolves.toEqual([])
    await expect(handle.db.select().from(tracks)).resolves.toEqual([])
    await expect(handle.db.select().from(trackGroups)).resolves.toEqual([])
    await expect(handle.db.select().from(trackGroupProblems)).resolves.toEqual(
      [],
    )
  })

  it('validates requests at the service boundary and returns a schema-valid result', async () => {
    const handle = await createTestDb({ seed: false })

    await expect(
      importTracks(handle.db, {
        surface: 'dashboard',
        file: {
          schemaVersion: 1,
          app: 'cognipace-track-import',
          tracks: [],
        },
      } as never),
    ).rejects.toThrow()

    const result = await importTracks(
      handle.db,
      parseImportRequest({
        schemaVersion: 1,
        app: 'cognipace-track-import',
        tracks: [
          {
            title: 'Validated Import',
            description: null,
            dueAt: null,
            groups: [
              {
                title: 'Main',
                problemSlugs: ['validated-problem'],
              },
            ],
          },
        ],
      }),
    )

    expect(() => trackImportResultSchema.parse(result)).not.toThrow()
  })
})

function parseImportRequest(file: unknown): TrackImportRequest {
  return tracksImportTracksRequestSchema.parse({
    surface: 'dashboard',
    file,
  })
}

async function readStableTrackState(
  db: Db,
  preservedTrackIds?: ReadonlySet<string>,
) {
  const trackRows = await db.select().from(tracks).orderBy(asc(tracks.id))
  const trackIds =
    preservedTrackIds ?? new Set(trackRows.map((track) => track.id))

  return {
    tracks: trackRows.filter((track) => trackIds.has(track.id)),
    groups: (
      await db.select().from(trackGroups).orderBy(asc(trackGroups.id))
    ).filter((group) => trackIds.has(group.trackId)),
    memberships: (
      await db
        .select()
        .from(trackGroupProblems)
        .orderBy(
          asc(trackGroupProblems.trackId),
          asc(trackGroupProblems.trackGroupId),
          asc(trackGroupProblems.position),
        )
    ).filter((membership) => trackIds.has(membership.trackId)),
    session: await db.select().from(trackSession),
    practice: await db
      .select()
      .from(problemPractice)
      .orderBy(asc(problemPractice.problemSlug)),
    cards: await db.select().from(fsrsCards).orderBy(asc(fsrsCards.id)),
    reviewAttempts: await db
      .select()
      .from(reviewAttempts)
      .orderBy(asc(reviewAttempts.id)),
    trackProgress: await db
      .select()
      .from(trackProblemProgress)
      .orderBy(
        asc(trackProblemProgress.trackId),
        asc(trackProblemProgress.problemSlug),
      ),
    settings: await db.select().from(settingsKv).orderBy(asc(settingsKv.key)),
  }
}

async function makeLeetCodeActive(db: Db) {
  await db
    .update(trackSession)
    .set({
      activeTrackId: 'leetcode-75',
      activeGroupId: 'leetcode-75:arrays-hashing',
    })
    .where(eq(trackSession.id, 'active'))
}

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
    trackId: 'leetcode-75',
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
    trackId: string
    problemSlug: string
  },
) {
  const timestamp = new Date('2026-01-03T00:00:00.000Z').getTime()

  await db.insert(trackProblemProgress).values({
    trackId: input.trackId,
    problemSlug: input.problemSlug,
    completedAt: timestamp,
    completedRating: 'good',
    createdAt: timestamp,
    updatedAt: timestamp,
  })
}

const dayMs = 24 * 60 * 60 * 1000
