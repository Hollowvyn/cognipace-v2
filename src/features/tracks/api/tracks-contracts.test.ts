import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, expectTypeOf, it } from 'vitest'

import type {
  TrackImportPreview as PublicTrackImportPreview,
  TrackImportRequest as PublicTrackImportRequest,
} from '@/features/tracks'
import {
  createSerializedActiveTrack,
  createTrackProblemRow,
} from '@/testing/track-fixtures'

import {
  createTrackImportPreview,
  serializedActiveTrackSchema,
  trackCompletedRatingSchema,
  trackImportFileSchema,
  trackImportResultSchema,
  trackImportSchemaVersion,
  trackProblemRowSchema,
  tracksClearActiveTrackRequestSchema,
  tracksCreateTrackRequestSchema,
  tracksDeleteTrackRequestSchema,
  tracksGetWorkspaceRequestSchema,
  tracksImportTracksRequestSchema,
  tracksResetTrackProgressRequestSchema,
  tracksSetActiveTrackRequestSchema,
  tracksUpdateTrackRequestSchema,
  type TrackImportFile,
  type TrackImportPreview,
  type TrackImportRequest,
  type TrackImportResult,
  type TracksImportTracksRequest,
} from './tracks-contracts'
import { legacyNeetCodeTracks } from './fixtures/legacy-neetcode-tracks'

function createImportTrack(
  title: string,
  problemSlugs: string[] = ['two-sum'],
) {
  return {
    title,
    groups: [{ title: 'Arrays', problemSlugs }],
  }
}

function createImportFile(
  tracks: ReturnType<typeof createImportTrack>[] = [
    createImportTrack('Interview Track'),
  ],
) {
  return {
    schemaVersion: 1,
    app: 'cognipace-track-import',
    tracks,
  }
}

describe('tracks runtime contracts', () => {
  it('accepts a valid active track response without legacy active flags', () => {
    const parsed = serializedActiveTrackSchema.parse(
      createSerializedActiveTrack(),
    )

    expect(parsed?.track).not.toHaveProperty('isActive')
  })

  it('rejects progress with an inconsistent percent', () => {
    const response = createSerializedActiveTrack({
      progress: {
        completedCount: 1,
        totalCount: 2,
        percent: 99,
      },
    })

    expect(serializedActiveTrackSchema.safeParse(response).success).toBe(false)
  })

  it('only accepts dashboard workspace requests', () => {
    expect(
      tracksGetWorkspaceRequestSchema.safeParse({
        surface: 'dashboard',
      }).success,
    ).toBe(true)
    expect(
      tracksGetWorkspaceRequestSchema.safeParse({
        surface: 'popup',
      }).success,
    ).toBe(false)
  })

  it('rejects create and update requests without groups', () => {
    expect(
      tracksCreateTrackRequestSchema.safeParse({
        surface: 'dashboard',
        title: 'Interview Track',
        description: null,
        dueAt: null,
        groups: [],
      }).success,
    ).toBe(false)
    expect(
      tracksUpdateTrackRequestSchema.safeParse({
        surface: 'dashboard',
        trackId: 'leetcode-75',
        title: 'Interview Track',
        description: null,
        dueAt: null,
        groups: [],
      }).success,
    ).toBe(false)
  })

  it('accepts setActive on create requests', () => {
    expect(
      tracksCreateTrackRequestSchema.safeParse({
        surface: 'dashboard',
        title: 'Interview Track',
        description: null,
        dueAt: null,
        groups: [{ title: 'Arrays', problemSlugs: ['two-sum'] }],
        setActive: true,
      }).success,
    ).toBe(true)
  })

  it('rejects duplicate problem slugs across groups for create and update requests', () => {
    expect(
      tracksCreateTrackRequestSchema.safeParse({
        surface: 'dashboard',
        title: 'Interview Track',
        description: null,
        dueAt: null,
        groups: [
          { title: 'Arrays', problemSlugs: ['two-sum'] },
          { title: 'Hash Maps', problemSlugs: ['Two Sum'] },
        ],
      }).success,
    ).toBe(false)
    expect(
      tracksUpdateTrackRequestSchema.safeParse({
        surface: 'dashboard',
        trackId: 'leetcode-75',
        title: 'Interview Track',
        description: null,
        dueAt: null,
        groups: [
          { title: 'Arrays', problemSlugs: ['two-sum'] },
          { title: 'Hash Maps', problemSlugs: ['two-sum'] },
        ],
      }).success,
    ).toBe(false)
  })

  it('only accepts completed ratings that can complete track progress', () => {
    expect(trackCompletedRatingSchema.safeParse('good').success).toBe(true)
    expect(trackCompletedRatingSchema.safeParse('easy').success).toBe(true)
    expect(trackCompletedRatingSchema.safeParse('again').success).toBe(false)
  })

  it('accepts serialized track problem completion states', () => {
    const incompleteRow = createTrackProblemRow({
      membership: {
        trackId: 'leetcode-75',
        groupId: 'leetcode-75:arrays-hashing',
        groupTitle: 'Arrays and Hashing',
        groupPosition: 1,
        problemPosition: 1,
        completion: { status: 'incomplete', reviewAttemptId: null },
      },
    })
    const completedRow = createTrackProblemRow({
      membership: {
        trackId: 'leetcode-75',
        groupId: 'leetcode-75:arrays-hashing',
        groupTitle: 'Arrays and Hashing',
        groupPosition: 1,
        problemPosition: 2,
        completion: {
          status: 'completed',
          completedAt: '2026-01-01T00:00:00.000Z',
          completedRating: 'good',
          reviewAttemptId: 'review-two-sum-1',
        },
      },
    })

    expect(
      trackProblemRowSchema.parse(incompleteRow).membership.completion,
    ).toEqual({
      status: 'incomplete',
      reviewAttemptId: null,
    })
    expect(
      trackProblemRowSchema.parse(completedRow).membership.completion,
    ).toEqual({
      status: 'completed',
      completedAt: '2026-01-01T00:00:00.000Z',
      completedRating: 'good',
      reviewAttemptId: 'review-two-sum-1',
    })
  })

  it('requires dashboard surface and a non-empty track id for active, delete, and reset requests', () => {
    for (const schema of [
      tracksSetActiveTrackRequestSchema,
      tracksDeleteTrackRequestSchema,
      tracksResetTrackProgressRequestSchema,
    ]) {
      expect(
        schema.safeParse({
          surface: 'dashboard',
          trackId: 'leetcode-75',
        }).success,
      ).toBe(true)
      expect(
        schema.safeParse({
          surface: 'popup',
          trackId: 'leetcode-75',
        }).success,
      ).toBe(false)
      expect(
        schema.safeParse({
          surface: 'dashboard',
          trackId: '',
        }).success,
      ).toBe(false)
    }
  })

  it('requires dashboard surface when clearing the active track', () => {
    expect(
      tracksClearActiveTrackRequestSchema.safeParse({
        surface: 'dashboard',
      }).success,
    ).toBe(true)
    expect(
      tracksClearActiveTrackRequestSchema.safeParse({
        surface: 'popup',
      }).success,
    ).toBe(false)
  })
})

describe('track import contracts', () => {
  it('accepts a valid strict file and applies optional field defaults', () => {
    const parsed = trackImportFileSchema.parse({
      schemaVersion: trackImportSchemaVersion,
      app: 'cognipace-track-import',
      problems: [
        { slug: 'two-sum' },
        {
          slug: 'valid-parentheses',
          title: 'Valid Parentheses',
          difficulty: 'easy',
          isPremium: true,
        },
      ],
      tracks: [
        {
          title: 'Interview Track',
          groups: [
            {
              title: 'Arrays',
              problemSlugs: ['two-sum', 'valid-parentheses'],
            },
          ],
        },
      ],
    })

    expect(trackImportSchemaVersion).toBe(1)
    expect(parsed.problems).toEqual([
      {
        slug: 'two-sum',
        difficulty: 'unknown',
        isPremium: false,
      },
      {
        slug: 'valid-parentheses',
        title: 'Valid Parentheses',
        difficulty: 'easy',
        isPremium: true,
      },
    ])
    expect(parsed.tracks[0]).toMatchObject({
      description: null,
      dueAt: null,
    })
    expectTypeOf(parsed).toMatchTypeOf<TrackImportFile>()
  })

  it('defaults an omitted top-level problems array', () => {
    expect(trackImportFileSchema.parse(createImportFile()).problems).toEqual([])
  })

  it('rejects the wrong app envelope and unknown top-level fields', () => {
    expect(
      trackImportFileSchema.safeParse({
        ...createImportFile(),
        app: 'cognipace-backup',
      }).success,
    ).toBe(false)
    expect(
      trackImportFileSchema.safeParse({
        ...createImportFile(),
        unsupported: true,
      }).success,
    ).toBe(false)
  })

  it('rejects unsupported schema versions', () => {
    expect(
      trackImportFileSchema.safeParse({
        ...createImportFile(),
        schemaVersion: 2,
      }).success,
    ).toBe(false)
  })

  it('rejects unknown fields throughout nested import objects', () => {
    expect(
      trackImportFileSchema.safeParse({
        ...createImportFile(),
        problems: [{ slug: 'two-sum', unsupported: true }],
      }).success,
    ).toBe(false)
    expect(
      trackImportFileSchema.safeParse({
        ...createImportFile(),
        tracks: [
          {
            ...createImportTrack('Interview Track'),
            unsupported: true,
          },
        ],
      }).success,
    ).toBe(false)
    expect(
      trackImportFileSchema.safeParse({
        ...createImportFile(),
        tracks: [
          {
            title: 'Interview Track',
            groups: [
              {
                title: 'Arrays',
                problemSlugs: ['two-sum'],
                unsupported: true,
              },
            ],
          },
        ],
      }).success,
    ).toBe(false)
  })

  it('rejects normalized duplicate track titles', () => {
    expect(
      trackImportFileSchema.safeParse(
        createImportFile([
          createImportTrack('NeetCode 150'),
          createImportTrack('neetcode_150'),
        ]),
      ).success,
    ).toBe(false)
  })

  it('rejects normalized duplicate memberships across groups in one track', () => {
    expect(
      trackImportFileSchema.safeParse({
        ...createImportFile(),
        tracks: [
          {
            title: 'Interview Track',
            groups: [
              { title: 'Arrays', problemSlugs: ['Two Sum'] },
              { title: 'Hash Maps', problemSlugs: ['two_sum'] },
            ],
          },
        ],
      }).success,
    ).toBe(false)
  })

  it('rejects duplicate top-level problem definitions after normalization', () => {
    expect(
      trackImportFileSchema.safeParse({
        ...createImportFile(),
        problems: [{ slug: 'Two Sum' }, { slug: 'two_sum' }],
      }).success,
    ).toBe(false)
  })

  it('allows the same normalized problem slug in different tracks', () => {
    expect(
      trackImportFileSchema.safeParse(
        createImportFile([
          createImportTrack('First Track', ['Two Sum']),
          createImportTrack('Second Track', ['two_sum']),
        ]),
      ).success,
    ).toBe(true)
  })

  it('creates a preview with unique normalized referenced problem counts', () => {
    const file = trackImportFileSchema.parse({
      ...createImportFile(),
      tracks: [
        {
          title: 'First Track',
          groups: [
            { title: 'Arrays', problemSlugs: ['Two Sum'] },
            {
              title: 'Stacks',
              problemSlugs: ['valid_parentheses'],
            },
          ],
        },
        createImportTrack('Second Track', ['two-sum']),
      ],
    })

    const preview = createTrackImportPreview(file)

    expect(preview).toEqual({
      trackCount: 2,
      groupCount: 3,
      problemCount: 2,
      uniqueProblemCount: 2,
    })
    expectTypeOf(preview).toEqualTypeOf<TrackImportPreview>()
    expectTypeOf<PublicTrackImportPreview>().toEqualTypeOf<TrackImportPreview>()
  })

  it('accepts 200-character slugs and rejects 201-character slugs', () => {
    const maxSlug = 'a'.repeat(200)
    const tooLongSlug = 'a'.repeat(201)

    expect(
      trackImportFileSchema.safeParse({
        ...createImportFile(),
        problems: [{ slug: maxSlug }],
        tracks: [createImportTrack('Interview Track', [maxSlug])],
      }).success,
    ).toBe(true)
    expect(
      trackImportFileSchema.safeParse({
        ...createImportFile(),
        problems: [{ slug: tooLongSlug }],
      }).success,
    ).toBe(false)
    expect(
      trackImportFileSchema.safeParse({
        ...createImportFile(),
        tracks: [createImportTrack('Interview Track', [tooLongSlug])],
      }).success,
    ).toBe(false)
  })

  it('accepts 200-character titles and rejects 201-character titles', () => {
    const maxTitle = 'a'.repeat(200)
    const tooLongTitle = 'a'.repeat(201)

    expect(
      trackImportFileSchema.safeParse({
        ...createImportFile(),
        problems: [{ slug: 'two-sum', title: maxTitle }],
        tracks: [
          {
            title: maxTitle,
            groups: [{ title: maxTitle, problemSlugs: ['two-sum'] }],
          },
        ],
      }).success,
    ).toBe(true)
    expect(
      trackImportFileSchema.safeParse({
        ...createImportFile(),
        problems: [{ slug: 'two-sum', title: tooLongTitle }],
      }).success,
    ).toBe(false)
    expect(
      trackImportFileSchema.safeParse({
        ...createImportFile(),
        tracks: [createImportTrack(tooLongTitle)],
      }).success,
    ).toBe(false)
    expect(
      trackImportFileSchema.safeParse({
        ...createImportFile(),
        tracks: [
          {
            title: 'Interview Track',
            groups: [{ title: tooLongTitle, problemSlugs: ['two-sum'] }],
          },
        ],
      }).success,
    ).toBe(false)
  })

  it('accepts 1,000-character descriptions and rejects 1,001 characters', () => {
    expect(
      trackImportFileSchema.safeParse({
        ...createImportFile(),
        tracks: [
          {
            ...createImportTrack('Interview Track'),
            description: 'a'.repeat(1_000),
          },
        ],
      }).success,
    ).toBe(true)
    expect(
      trackImportFileSchema.safeParse({
        ...createImportFile(),
        tracks: [
          {
            ...createImportTrack('Interview Track'),
            description: 'a'.repeat(1_001),
          },
        ],
      }).success,
    ).toBe(false)
  })

  it('accepts 20 tracks and rejects 21 tracks', () => {
    const createTracks = (count: number) =>
      Array.from({ length: count }, (_, index) =>
        createImportTrack(`Track ${index + 1}`),
      )

    expect(
      trackImportFileSchema.safeParse(createImportFile(createTracks(20)))
        .success,
    ).toBe(true)
    expect(
      trackImportFileSchema.safeParse(createImportFile(createTracks(21)))
        .success,
    ).toBe(false)
  })

  it('accepts 100 groups and rejects 101 groups per track', () => {
    const createGroups = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        title: `Group ${index + 1}`,
        problemSlugs: [`problem-${index + 1}`],
      }))
    const createFileWithGroups = (count: number) => ({
      ...createImportFile(),
      tracks: [
        {
          title: 'Interview Track',
          groups: createGroups(count),
        },
      ],
    })

    expect(
      trackImportFileSchema.safeParse(createFileWithGroups(100)).success,
    ).toBe(true)
    expect(
      trackImportFileSchema.safeParse(createFileWithGroups(101)).success,
    ).toBe(false)
  })

  it('accepts 1,000 memberships and rejects 1,001 memberships per track', () => {
    const createMemberships = (count: number) =>
      Array.from({ length: count }, (_, index) => `problem-${index + 1}`)

    expect(
      trackImportFileSchema.safeParse(
        createImportFile([
          {
            title: 'Interview Track',
            groups: [
              { title: 'First', problemSlugs: createMemberships(500) },
              {
                title: 'Second',
                problemSlugs: createMemberships(500).map(
                  (slug) => `second-${slug}`,
                ),
              },
            ],
          },
        ]),
      ).success,
    ).toBe(true)
    expect(
      trackImportFileSchema.safeParse(
        createImportFile([
          {
            title: 'Interview Track',
            groups: [
              { title: 'First', problemSlugs: createMemberships(500) },
              {
                title: 'Second',
                problemSlugs: createMemberships(501).map(
                  (slug) => `second-${slug}`,
                ),
              },
            ],
          },
        ]),
      ).success,
    ).toBe(false)
  })

  it('accepts 1,000 memberships and reports 1,001 as a per-group limit violation', () => {
    const createMemberships = (count: number) =>
      Array.from({ length: count }, (_, index) => `problem-${index + 1}`)

    expect(
      trackImportFileSchema.safeParse(
        createImportFile([
          createImportTrack('Interview Track', createMemberships(1_000)),
        ]),
      ).success,
    ).toBe(true)

    const result = trackImportFileSchema.safeParse(
      createImportFile([
        createImportTrack('Interview Track', createMemberships(1_001)),
      ]),
    )

    expect(result.success).toBe(false)
    if (result.success) {
      return
    }

    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        code: 'too_big',
        path: ['tracks', 0, 'groups', 0, 'problemSlugs'],
      }),
    )
  })

  it('accepts 5,000 problem definitions and rejects 5,001 definitions', () => {
    const createProblems = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        slug: `problem-${index + 1}`,
      }))

    expect(
      trackImportFileSchema.safeParse({
        ...createImportFile(),
        problems: createProblems(5_000),
      }).success,
    ).toBe(true)
    expect(
      trackImportFileSchema.safeParse({
        ...createImportFile(),
        problems: createProblems(5_001),
      }).success,
    ).toBe(false)
  })

  it('points duplicate issues to each later duplicate and names it', () => {
    const result = trackImportFileSchema.safeParse({
      ...createImportFile(),
      problems: [{ slug: 'Two Sum' }, { slug: 'two_sum' }],
      tracks: [
        createImportTrack('Arrays', ['valid-parentheses']),
        {
          title: 'arrays',
          groups: [
            { title: 'First', problemSlugs: ['Two Sum'] },
            { title: 'Second', problemSlugs: ['two_sum'] },
          ],
        },
      ],
    })

    expect(result.success).toBe(false)
    if (result.success) {
      return
    }

    const findIssue = (path: PropertyKey[]) =>
      result.error.issues.find(
        (issue) => JSON.stringify(issue.path) === JSON.stringify(path),
      )
    const duplicateTrackIssue = findIssue(['tracks', 1, 'title'])
    const duplicateMembershipIssue = findIssue([
      'tracks',
      1,
      'groups',
      1,
      'problemSlugs',
      0,
    ])
    const duplicateProblemIssue = findIssue(['problems', 1, 'slug'])

    expect(duplicateTrackIssue?.path).toEqual(['tracks', 1, 'title'])
    expect(duplicateTrackIssue?.message).toContain('"arrays"')
    expect(duplicateMembershipIssue?.path).toEqual([
      'tracks',
      1,
      'groups',
      1,
      'problemSlugs',
      0,
    ])
    expect(duplicateMembershipIssue?.message).toContain('"two-sum"')
    expect(duplicateProblemIssue?.path).toEqual(['problems', 1, 'slug'])
    expect(duplicateProblemIssue?.message).toContain('"two-sum"')
  })

  it('rejects slugs and titles that normalize to empty strings', () => {
    expect(
      trackImportFileSchema.safeParse({
        ...createImportFile(),
        tracks: [createImportTrack('!!!')],
      }).success,
    ).toBe(false)
    expect(
      trackImportFileSchema.safeParse({
        ...createImportFile(),
        tracks: [createImportTrack('Interview Track', ['!!!'])],
      }).success,
    ).toBe(false)
    expect(
      trackImportFileSchema.safeParse({
        ...createImportFile(),
        problems: [{ slug: 'two-sum', title: '!!!' }],
      }).success,
    ).toBe(false)
    expect(
      trackImportFileSchema.safeParse({
        ...createImportFile(),
        tracks: [
          {
            title: 'Interview Track',
            groups: [{ title: '!!!', problemSlugs: ['two-sum'] }],
          },
        ],
      }).success,
    ).toBe(false)
  })

  it('requires ISO due dates when a track due date is supplied', () => {
    expect(
      trackImportFileSchema.safeParse({
        ...createImportFile(),
        tracks: [
          {
            ...createImportTrack('Interview Track'),
            dueAt: '2026-12-31T23:59:59.000Z',
          },
        ],
      }).success,
    ).toBe(true)
    expect(
      trackImportFileSchema.safeParse({
        ...createImportFile(),
        tracks: [
          {
            ...createImportTrack('Interview Track'),
            dueAt: '2026-12-31',
          },
        ],
      }).success,
    ).toBe(false)
  })

  it('validates strict dashboard import requests', () => {
    const parsed = tracksImportTracksRequestSchema.parse({
      surface: 'dashboard',
      file: createImportFile(),
    })

    expect(parsed.file.problems).toEqual([])
    expectTypeOf(parsed).toEqualTypeOf<TrackImportRequest>()
    expectTypeOf(parsed).toMatchTypeOf<TracksImportTracksRequest>()
    expectTypeOf<PublicTrackImportRequest>().toEqualTypeOf<TrackImportRequest>()
    expect(
      tracksImportTracksRequestSchema.safeParse({
        surface: 'popup',
        file: createImportFile(),
      }).success,
    ).toBe(false)
    expect(
      tracksImportTracksRequestSchema.safeParse({
        surface: 'dashboard',
        file: createImportFile(),
        unsupported: true,
      }).success,
    ).toBe(false)
  })

  it('validates strict import results and count bounds', () => {
    const result = {
      createdTrackIds: ['track-1'],
      createdTrackCount: 1,
      createdProblemCount: 0,
      reusedProblemCount: 1,
    }
    const parsed = trackImportResultSchema.parse(result)

    expect(parsed).toEqual(result)
    expectTypeOf(parsed).toMatchTypeOf<TrackImportResult>()
    expect(
      trackImportResultSchema.safeParse({
        ...result,
        createdTrackCount: 0,
      }).success,
    ).toBe(false)
    expect(
      trackImportResultSchema.safeParse({
        ...result,
        createdProblemCount: -1,
      }).success,
    ).toBe(false)
    expect(
      trackImportResultSchema.safeParse({
        ...result,
        reusedProblemCount: -1,
      }).success,
    ).toBe(false)
    expect(
      trackImportResultSchema.safeParse({
        ...result,
        unsupported: true,
      }).success,
    ).toBe(false)
  })

  it('accepts an empty created track id list when the created count is nonzero', () => {
    expect(
      trackImportResultSchema.parse({
        createdTrackIds: [],
        createdTrackCount: 1,
        createdProblemCount: 0,
        reusedProblemCount: 0,
      }),
    ).toEqual({
      createdTrackIds: [],
      createdTrackCount: 1,
      createdProblemCount: 0,
      reusedProblemCount: 0,
    })
  })

  it('rejects blank created track ids when present', () => {
    expect(
      trackImportResultSchema.safeParse({
        createdTrackIds: ['   '],
        createdTrackCount: 1,
        createdProblemCount: 0,
        reusedProblemCount: 0,
      }).success,
    ).toBe(false)
  })

  it('keeps the NeetCode example compatible with the source-derived import contract', () => {
    const input = JSON.parse(
      readFileSync(
        resolve(process.cwd(), 'track-imports/neetcode-150-and-250.json'),
        'utf8',
      ),
    ) as unknown
    const parsed = trackImportFileSchema.parse(input)
    const preview = createTrackImportPreview(parsed)
    const referencedProblemSlugs = new Set(
      parsed.tracks.flatMap((track) =>
        track.groups.flatMap((group) => group.problemSlugs),
      ),
    )
    const definedProblemSlugs = new Set(
      parsed.problems.map((problem) => problem.slug),
    )
    const legacyTracks = legacyNeetCodeTracks

    expect(parsed.tracks.map((track) => track.title)).toEqual([
      'NeetCode 150',
      'NeetCode 250',
    ])
    expect(preview).toEqual({
      trackCount: 2,
      groupCount: 35,
      problemCount: 240,
      uniqueProblemCount: 240,
    })
    expect(parsed.problems).toHaveLength(240)
    expect(new Set(parsed.problems.map((problem) => problem.slug)).size).toBe(
      240,
    )
    expect(
      parsed.tracks.map((track) =>
        track.groups.reduce(
          (count, group) => count + new Set(group.problemSlugs).size,
          0,
        ),
      ),
    ).toEqual([144, 232])
    expect([...definedProblemSlugs].sort()).toEqual(
      [...referencedProblemSlugs].sort(),
    )
    expect(
      parsed.tracks.map((track) => ({
        title: track.title,
        groups: track.groups.map((group) => ({
          title: group.title,
          problemSlugs: group.problemSlugs,
        })),
      })),
    ).toEqual(legacyTracks)
  })
})
