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
  })

  it('requires a title and starts create mode with a Main group', async () => {
    const user = userEvent.setup()
    mockTrackFormRuntime(createTrackDefaults())

    renderTrackForm(
      <TrackForm mode="create" onCancel={vi.fn()} onSaved={vi.fn()} />,
    )

    expect(await screen.findByLabelText('Title')).toHaveValue('')
    expect(screen.getByLabelText('Group 1 title')).toHaveValue('Main')

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
    const user = userEvent.setup()
    mockTrackFormRuntime(createTrackDefaults())

    renderTrackForm(
      <TrackForm mode="create" onCancel={vi.fn()} onSaved={vi.fn()} />,
    )

    await user.type(await screen.findByLabelText('Title'), 'Interview Track')
    await user.type(screen.getByLabelText('Description'), 'Focused prep')
    await user.type(screen.getByLabelText('Target date'), '2026-06-15')

    await user.click(screen.getByRole('button', { name: 'Add group' }))
    await user.clear(screen.getByLabelText('Group 2 title'))
    await user.type(
      screen.getByLabelText('Group 2 title'),
      'Dynamic Programming',
    )
    await user.click(
      screen.getByRole('button', { name: 'Move Dynamic Programming up' }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Move Dynamic Programming down' }),
    )
    await user.click(screen.getByRole('button', { name: 'Add group' }))
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

  it('sends setActive only when the create checkbox is checked', async () => {
    const user = userEvent.setup()
    mockTrackFormRuntime(createTrackDefaults())

    renderTrackForm(
      <TrackForm mode="create" onCancel={vi.fn()} onSaved={vi.fn()} />,
    )

    await user.type(await screen.findByLabelText('Title'), 'Active Track')
    await user.click(
      screen.getByRole('checkbox', { name: 'Set as active track' }),
    )
    await user.click(screen.getByRole('button', { name: 'SAVE' }))

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith(
        'tracks.createTrack',
        expect.objectContaining({
          setActive: true,
        }),
      )
    })
  })

  it('keeps Cancel available while a create save is pending', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    mockTrackFormRuntime(createTrackDefaults(), {
      createResponse: () => new Promise<null>(() => undefined),
    })

    renderTrackForm(
      <TrackForm mode="create" onCancel={onCancel} onSaved={vi.fn()} />,
    )

    await user.type(await screen.findByLabelText('Title'), 'Pending Track')
    await user.click(screen.getByRole('button', { name: 'SAVE' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'SAVE' })).toBeDisabled()
    })
    const cancelButton = screen.getByRole('button', { name: 'CANCEL' })

    expect(cancelButton).toBeEnabled()

    await user.click(cancelButton)

    expect(onCancel).toHaveBeenCalled()
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
    expect(screen.getByLabelText('Group 1 title')).toHaveValue(
      'Arrays and Hashing',
    )
    expect(screen.getByLabelText('Group 2 title')).toHaveValue(
      'Dynamic Programming',
    )
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

function createEditResponse() {
  return createTrackForEditResponse({
    track: createSerializedTrack({
      description: 'Core interview practice.',
      dueAt: '2026-06-15T00:00:00.000Z',
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
