import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { sendMessage } from '@/extension/messaging'
import type { ProblemDifficulty } from '@/features/problems'
import type {
  TrackForEditResponse,
  TracksCreateTrackRequest,
  TracksUpdateTrackRequest,
} from '@/features/tracks'
import { createSerializedProblem } from '@/testing/problem-fixtures'
import { createQueryTestHarness } from '@/testing/query-test-harness'
import {
  createSerializedTrack,
  createTrackForEditResponse,
  createTrackProblemRow,
} from '@/testing/track-fixtures'

import { TrackForm } from './track-form'

vi.mock('@/extension/messaging', () => ({
  sendMessage: vi.fn(),
}))

describe('TrackForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it('requires a title and starts create mode with a Main group', async () => {
    const user = userEvent.setup()
    mockTrackFormRuntime(createTrackDefaults())

    renderTrackForm(
      <TrackForm mode="create" onCancel={vi.fn()} onSaved={vi.fn()} />,
    )

    expect(await screen.findByLabelText('Title')).toHaveValue('')
    expect(screen.getByLabelText('Group title')).toHaveValue('Main')

    await user.click(screen.getByRole('button', { name: 'SAVE' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Title is required.',
    )
    expect(sendMessage).not.toHaveBeenCalledWith(
      'tracks.createTrack',
      expect.anything(),
    )
  })

  it('creates a track with ordered groups and selected-group problem membership', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 4, 25, 12, 0, 0))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    mockTrackFormRuntime(createTrackDefaults())

    renderTrackForm(
      <TrackForm mode="create" onCancel={vi.fn()} onSaved={vi.fn()} />,
    )

    await user.type(await screen.findByLabelText('Title'), 'Interview Track')
    await user.type(screen.getByLabelText('Description'), 'Focused prep')
    await user.type(screen.getByLabelText('Target date'), '2026-06-15')

    await user.click(screen.getByRole('button', { name: 'New Group' }))
    await user.clear(screen.getByLabelText('Group title'))
    await user.type(screen.getByLabelText('Group title'), 'Dynamic Programming')
    await user.click(
      screen.getByRole('button', { name: 'Select Dynamic Programming' }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Move Dynamic Programming up' }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Move Dynamic Programming down' }),
    )
    await user.click(screen.getByRole('button', { name: 'New Group' }))
    await user.click(screen.getByRole('button', { name: 'Remove Group 3' }))

    await user.click(screen.getByRole('button', { name: 'Select Main' }))
    await user.type(screen.getByLabelText('Search Library problems'), 'two')
    await user.click(screen.getByRole('button', { name: 'Add Two Sum' }))
    await user.clear(screen.getByLabelText('Search Library problems'))
    await user.type(screen.getByLabelText('Search Library problems'), 'binary')
    await user.click(screen.getByRole('button', { name: 'Add Binary Search' }))
    await user.click(
      screen.getByRole('button', { name: 'Move Binary Search up' }),
    )
    await user.click(screen.getByRole('button', { name: 'Remove Two Sum' }))
    await user.clear(screen.getByLabelText('Search Library problems'))
    await user.type(screen.getByLabelText('Search Library problems'), 'two')
    await user.click(screen.getByRole('button', { name: 'Add Two Sum' }))

    await user.click(screen.getByRole('button', { name: 'SAVE' }))

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith('tracks.createTrack', {
        surface: 'dashboard',
        title: 'Interview Track',
        description: 'Focused prep',
        dueAt: '2026-06-15T00:00:00.000Z',
        groups: [
          {
            title: 'Main',
            problemSlugs: ['binary-search', 'two-sum'],
          },
          {
            title: 'Dynamic Programming',
            problemSlugs: [],
          },
        ],
      } satisfies TracksCreateTrackRequest)
    })
  })

  it('seeds create mode from selected Library rows and shows compact Group by', async () => {
    const user = userEvent.setup()
    mockTrackFormRuntime(createTrackDefaultsWithSelectionRows())

    renderTrackForm(
      <TrackForm
        initialDraft={{
          id: 'draft-1',
          source: 'library-selection',
          selectedCount: 3,
          problemRows: createSelectedProblemRows(),
        }}
        mode="create"
        onCancel={vi.fn()}
        onSaved={vi.fn()}
      />,
    )

    expect(await screen.findByText('3 selected Library problems')).toBeVisible()
    expect(screen.getByLabelText('Group by')).toHaveValue('none')
    expect(screen.getByLabelText('Target date')).toBeVisible()
    expect(screen.getByLabelText('Group title')).toHaveValue('Main')
    expect(screen.getByRole('listitem', { name: '1. Two Sum' })).toBeVisible()
    expect(
      screen.getByRole('listitem', { name: '2. Group Anagrams' }),
    ).toBeVisible()
    expect(screen.getByRole('listitem', { name: '3. 01 Matrix' })).toBeVisible()

    await user.type(screen.getByLabelText('Title'), 'Netflix Prep')
    await user.click(screen.getByRole('button', { name: 'SAVE' }))

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith('tracks.createTrack', {
        surface: 'dashboard',
        title: 'Netflix Prep',
        description: null,
        dueAt: null,
        groups: [
          {
            title: 'Main',
            problemSlugs: ['two-sum', 'group-anagrams', '01-matrix'],
          },
        ],
      } satisfies TracksCreateTrackRequest)
    })
  })

  it.each([
    {
      name: 'blocks a past target date in create mode',
      mode: 'create' as const,
      source: createTrackDefaults(),
      inputDate: '2026-05-24',
      now: new Date(2026, 4, 25, 12, 0, 0),
      expectedMessage: 'Target date must be today or later.',
      expectedMethod: 'tracks.createTrack' as const,
      expectedDueAt: null,
    },
    {
      name: 'allows a same-day target date during local evening hours',
      mode: 'create' as const,
      source: createTrackDefaults(),
      inputDate: '2026-05-25',
      now: new Date(2026, 4, 25, 22, 0, 0),
      expectedMessage: null,
      expectedMethod: 'tracks.createTrack' as const,
      expectedDueAt: '2026-05-25T00:00:00.000Z',
    },
    {
      name: 'allows an unchanged saved past target date in edit mode',
      mode: 'edit' as const,
      source: createEditResponse({ dueAt: '2026-05-21T00:00:00.000Z' }),
      inputDate: '2026-05-21',
      now: new Date(2026, 4, 25, 12, 0, 0),
      expectedMessage: null,
      expectedMethod: 'tracks.updateTrack' as const,
      expectedDueAt: '2026-05-21T00:00:00.000Z',
    },
    {
      name: 'blocks a changed past target date in edit mode',
      mode: 'edit' as const,
      source: createEditResponse({ dueAt: '2026-05-21T00:00:00.000Z' }),
      inputDate: '2026-05-22',
      now: new Date(2026, 4, 25, 12, 0, 0),
      expectedMessage: 'Target date must be today or later.',
      expectedMethod: 'tracks.updateTrack' as const,
      expectedDueAt: null,
    },
    {
      name: 'clears a target date to null',
      mode: 'edit' as const,
      source: createEditResponse(),
      inputDate: null,
      now: new Date(2026, 4, 25, 12, 0, 0),
      expectedMessage: null,
      expectedMethod: 'tracks.updateTrack' as const,
      expectedDueAt: null,
    },
  ])(
    '$name',
    async ({
      mode,
      source,
      inputDate,
      now,
      expectedMessage,
      expectedMethod,
      expectedDueAt,
    }) => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(now)
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      mockTrackFormRuntime(source)

      renderTrackForm(
        mode === 'edit' ? (
          <TrackForm
            mode="edit"
            onCancel={vi.fn()}
            onLoaded={vi.fn()}
            onSaved={vi.fn()}
            trackId="leetcode-75"
          />
        ) : (
          <TrackForm mode="create" onCancel={vi.fn()} onSaved={vi.fn()} />
        ),
      )

      await user.clear(await screen.findByLabelText('Title'))
      await user.type(
        screen.getByLabelText('Title'),
        mode === 'edit' ? 'LeetCode 75 Updated' : 'Target Track',
      )

      const targetDate = screen.getByLabelText('Target date')

      if (inputDate === null) {
        await user.click(
          screen.getByRole('button', { name: 'Clear target date' }),
        )
      } else {
        await user.clear(targetDate)
        await user.type(targetDate, inputDate)
      }

      await user.click(screen.getByRole('button', { name: 'SAVE' }))

      if (expectedMessage) {
        expect(await screen.findByRole('alert')).toHaveTextContent(
          expectedMessage,
        )
        expect(targetDate).toBeInvalid()
        expect(sendMessage).not.toHaveBeenCalledWith(
          expectedMethod,
          expect.anything(),
        )

        return
      }

      await waitFor(() => {
        expect(sendMessage).toHaveBeenCalledWith(
          expectedMethod,
          expect.objectContaining(
            mode === 'edit'
              ? { trackId: 'leetcode-75', dueAt: expectedDueAt }
              : { dueAt: expectedDueAt },
          ),
        )
      })
    },
  )

  it('regroups and moves draft problems with compact group selectors', async () => {
    const user = userEvent.setup()
    mockTrackFormRuntime(createTrackDefaultsWithSelectionRows())

    renderTrackForm(
      <TrackForm
        initialDraft={{
          id: 'draft-1',
          source: 'library-selection',
          selectedCount: 3,
          problemRows: createSelectedProblemRows(),
        }}
        mode="create"
        onCancel={vi.fn()}
        onSaved={vi.fn()}
      />,
    )

    await user.selectOptions(await screen.findByLabelText('Group by'), 'topic')

    expect(screen.getByRole('button', { name: 'Select Arrays' })).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Select Hash Maps' }),
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Select No topic' }),
    ).toBeVisible()
    expect(screen.getByRole('listitem', { name: '1. Two Sum' })).toBeVisible()

    await user.selectOptions(
      screen.getByLabelText('Group for Two Sum'),
      'draft-group-2',
    )
    await user.click(screen.getByRole('button', { name: 'Select Hash Maps' }))

    expect(screen.getByRole('listitem', { name: '2. Two Sum' })).toBeVisible()

    await user.selectOptions(screen.getByLabelText('Group by'), 'company')

    expect(screen.getByRole('button', { name: 'Select Meta' })).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Select No company' }),
    ).toBeVisible()
  })

  it('shows save failures inside the form', async () => {
    const user = userEvent.setup()
    mockTrackFormRuntime(createTrackDefaults(), {
      createResponse: () => Promise.reject<null>(new Error('Create failed')),
    })

    renderTrackForm(
      <TrackForm mode="create" onCancel={vi.fn()} onSaved={vi.fn()} />,
    )

    await user.type(await screen.findByLabelText('Title'), 'Broken Track')
    await user.click(screen.getByRole('button', { name: 'SAVE' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Create failed')
  })

  it('loads existing metadata, groups, and memberships for edit submit replacement', async () => {
    const user = userEvent.setup()
    const onLoaded = vi.fn()
    const onSaved = vi.fn()
    mockTrackFormRuntime(createEditResponse())

    renderTrackForm(
      <TrackForm
        mode="edit"
        onCancel={vi.fn()}
        onLoaded={onLoaded}
        onSaved={onSaved}
        trackId="leetcode-75"
      />,
    )

    expect(await screen.findByLabelText('Title')).toHaveValue('LeetCode 75')
    expect(screen.getByLabelText('Description')).toHaveValue(
      'Core interview practice.',
    )
    expect(screen.getByLabelText('Target date')).toHaveValue('2026-06-15')
    expect(screen.getByLabelText('Group title')).toHaveValue(
      'Arrays and Hashing',
    )
    expect(
      screen.getByRole('button', { name: 'Select Dynamic Programming' }),
    ).toBeVisible()
    expect(
      within(screen.getByLabelText('Selected group problems')).getByText(
        'Two Sum',
      ),
    ).toBeVisible()
    expect(onLoaded).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'LeetCode 75' }),
    )

    await user.clear(screen.getByLabelText('Title'))
    await user.type(screen.getByLabelText('Title'), 'LeetCode 75 Updated')
    await user.click(screen.getByRole('button', { name: 'SAVE' }))

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith('tracks.updateTrack', {
        surface: 'dashboard',
        trackId: 'leetcode-75',
        title: 'LeetCode 75 Updated',
        description: 'Core interview practice.',
        dueAt: '2026-06-15T00:00:00.000Z',
        groups: [
          {
            id: 'leetcode-75:arrays-hashing',
            title: 'Arrays and Hashing',
            problemSlugs: ['two-sum', 'binary-search'],
          },
          {
            id: 'leetcode-75:dynamic-programming',
            title: 'Dynamic Programming',
            problemSlugs: ['maximum-subarray'],
          },
        ],
      } satisfies TracksUpdateTrackRequest)
    })
    expect(onSaved).toHaveBeenCalled()
  })
})

function renderTrackForm(ui: ReactElement) {
  const { wrapper } = createQueryTestHarness()

  return render(ui, { wrapper })
}

function mockTrackFormRuntime(
  response: TrackForEditResponse,
  options: {
    createResponse?: () => Promise<null>
    updateResponse?: () => Promise<null>
  } = {},
) {
  vi.mocked(sendMessage).mockImplementation((method) => {
    if (method === 'tracks.getTrackForEdit') {
      return Promise.resolve(response)
    }

    if (method === 'tracks.createTrack') {
      return options.createResponse?.() ?? Promise.resolve(null)
    }

    if (method === 'tracks.updateTrack') {
      return options.updateResponse?.() ?? Promise.resolve(null)
    }

    return Promise.resolve(null)
  })
}

function createTrackDefaults() {
  return createTrackForEditResponse({
    track: null,
    groups: [],
    problemRows: [problemRow('two-sum', 'Two Sum'), problemRow()],
  })
}

function createTrackDefaultsWithSelectionRows() {
  return createTrackForEditResponse({
    track: null,
    groups: [],
    problemRows: createSelectedProblemRows(),
  })
}

function createSelectedProblemRows() {
  return [
    problemRowWithMetadata('two-sum', 'Two Sum', {
      topics: [{ id: 'arrays', label: 'Arrays' }],
      companies: [{ id: 'meta', label: 'Meta' }],
    }),
    problemRowWithMetadata('group-anagrams', 'Group Anagrams', {
      difficulty: 'medium',
      topics: [{ id: 'hash-maps', label: 'Hash Maps' }],
      companies: [{ id: 'meta', label: 'Meta' }],
    }),
    problemRowWithMetadata('01-matrix', '01 Matrix', {
      difficulty: 'medium',
      topics: [],
      companies: [],
    }),
  ]
}

function problemRowWithMetadata(
  slug: string,
  title: string,
  overrides: {
    companies?: ReturnType<typeof createTrackProblemRow>['companies']
    difficulty?: ProblemDifficulty
    topics?: ReturnType<typeof createTrackProblemRow>['topics']
  } = {},
) {
  return createTrackProblemRow({
    problem: createSerializedProblem({
      difficulty: overrides.difficulty ?? 'easy',
      slug,
      title,
    }),
    companies: overrides.companies ?? [],
    topics: overrides.topics ?? [],
  })
}

function createEditResponse(
  overrides: {
    dueAt?: string | null
  } = {},
) {
  return createTrackForEditResponse({
    track: createSerializedTrack({
      description: 'Core interview practice.',
      dueAt: overrides.dueAt ?? '2026-06-15T00:00:00.000Z',
      id: 'leetcode-75',
      slug: 'leetcode-75',
      title: 'LeetCode 75',
    }),
    groups: [
      {
        id: 'leetcode-75:arrays-hashing',
        trackId: 'leetcode-75',
        title: 'Arrays and Hashing',
        position: 1,
        problemSlugs: ['two-sum', 'binary-search'],
      },
      {
        id: 'leetcode-75:dynamic-programming',
        trackId: 'leetcode-75',
        title: 'Dynamic Programming',
        position: 2,
        problemSlugs: ['maximum-subarray'],
      },
    ],
    problemRows: [
      problemRow('two-sum', 'Two Sum'),
      problemRow(),
      problemRow('maximum-subarray', 'Maximum Subarray', 'medium'),
    ],
  })
}

function problemRow(
  slug = 'binary-search',
  title = 'Binary Search',
  difficulty: ProblemDifficulty = 'easy',
) {
  return createTrackProblemRow({
    problem: createSerializedProblem({ difficulty, slug, title }),
  })
}
