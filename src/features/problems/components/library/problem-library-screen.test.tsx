import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Plus } from 'lucide-react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Button } from '@/components/ui/button'
import { sendMessage } from '@/extension/messaging'
import { type ProblemLibraryResponse } from '@/features/problems'
import {
  createProblemLibraryResponse,
  createSerializedProblem,
} from '@/testing/problem-fixtures'
import {
  createSerializedNormalizedPracticeState,
  createSerializedPracticeDetails,
} from '@/testing/practice-fixtures'
import { createQueryTestHarness } from '@/testing/query-test-harness'

import { ProblemLibraryScreen } from './problem-library-screen'

vi.mock('@/extension/messaging', () => ({
  sendMessage: vi.fn(),
}))

describe('ProblemLibraryScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('filters Library rows by search and facets', async () => {
    const user = userEvent.setup()
    vi.mocked(sendMessage).mockResolvedValueOnce(libraryResponse)
    renderProblemLibrary()

    expect(await findProblemRow('Two Sum')).toBeVisible()

    await user.type(screen.getByLabelText('Search problems'), 'matrix')
    expect(getProblemRow('01 Matrix')).toBeVisible()
    expect(queryProblemRow('Two Sum')).not.toBeInTheDocument()

    await user.clear(screen.getByLabelText('Search problems'))
    expect(getProblemRow('Two Sum')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Expand filters' }))
    await selectLibraryFacetOption(user, 'Difficulty', 'Medium')
    expect(getProblemRow('01 Matrix')).toBeVisible()
    expect(queryProblemRow('Binary Search')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear Filters' }))
    await selectLibraryFacetOption(user, 'Track', 'LeetCode 75')
    expect(getProblemRow('Two Sum')).toBeVisible()
    expect(queryProblemRow('Binary Search')).not.toBeInTheDocument()
  })

  it('deletes any library problem with confirmation', async () => {
    const user = userEvent.setup()
    vi.mocked(sendMessage).mockImplementation((method) => {
      if (method === 'problems.getLibrary') {
        return Promise.resolve(libraryResponse)
      }

      return Promise.resolve(undefined)
    })
    renderProblemLibrary()

    await user.click(
      await screen.findByRole('button', { name: 'Expand Two Sum' }),
    )
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    const deleteDialog = screen.getByRole('dialog', { name: 'Delete problem?' })
    await user.click(
      within(deleteDialog).getByRole('button', { name: 'Delete Problem' }),
    )
    expect(sendMessage).toHaveBeenCalledWith('problems.deleteProblem', {
      surface: 'dashboard',
      problemSlug: 'two-sum',
    })
  })

  it('runs selected bulk practice and problem mutations', async () => {
    const user = userEvent.setup()
    vi.mocked(sendMessage).mockImplementation((method) => {
      if (method === 'problems.getLibrary') {
        return Promise.resolve(libraryResponse)
      }

      if (method === 'problems.bulkDelete') {
        return Promise.resolve(undefined)
      }

      return Promise.resolve(createSerializedPracticeDetails())
    })
    renderProblemLibrary()

    await user.click(
      await screen.findByRole('checkbox', { name: 'Select Two Sum' }),
    )
    await user.click(
      screen.getByRole('checkbox', { name: 'Select Binary Search' }),
    )

    const bulkBar = screen.getByRole('region', { name: 'Bulk actions' })

    await user.click(within(bulkBar).getByRole('button', { name: 'Suspend' }))
    await user.click(within(bulkBar).getByRole('button', { name: 'Resume' }))
    await user.click(
      within(bulkBar).getByRole('button', { name: 'Reset Schedule' }),
    )
    await user.click(
      within(
        screen.getByRole('dialog', { name: 'Reset selected schedules?' }),
      ).getByRole('button', { name: 'Reset Schedule' }),
    )

    await user.click(screen.getByRole('checkbox', { name: 'Select Two Sum' }))
    await user.click(
      screen.getByRole('checkbox', { name: 'Select Binary Search' }),
    )
    await user.click(
      within(screen.getByRole('region', { name: 'Bulk actions' })).getByRole(
        'button',
        { name: 'Delete Problems' },
      ),
    )
    await user.click(
      within(
        screen.getByRole('dialog', { name: 'Delete selected problems?' }),
      ).getByRole('button', { name: 'Delete Problems' }),
    )

    expect(sendMessage).toHaveBeenCalledWith('practice.setSuspended', {
      surface: 'dashboard',
      problemSlug: 'two-sum',
      suspended: true,
    })
    expect(sendMessage).toHaveBeenCalledWith('practice.setSuspended', {
      surface: 'dashboard',
      problemSlug: 'binary-search',
      suspended: true,
    })
    expect(sendMessage).toHaveBeenCalledWith('practice.setSuspended', {
      surface: 'dashboard',
      problemSlug: 'two-sum',
      suspended: false,
    })
    expect(sendMessage).toHaveBeenCalledWith('practice.setSuspended', {
      surface: 'dashboard',
      problemSlug: 'binary-search',
      suspended: false,
    })
    expect(sendMessage).toHaveBeenCalledWith('practice.resetSchedule', {
      surface: 'dashboard',
      problemSlug: 'two-sum',
    })
    expect(sendMessage).toHaveBeenCalledWith('practice.resetSchedule', {
      surface: 'dashboard',
      problemSlug: 'binary-search',
    })
    expect(sendMessage).toHaveBeenCalledWith('problems.bulkDelete', {
      surface: 'dashboard',
      problemSlugs: ['two-sum', 'binary-search'],
    })
  })

  it('bulk-edits metadata with explicit enabled replacement fields', async () => {
    const user = userEvent.setup()
    vi.mocked(sendMessage).mockImplementation((method) => {
      if (method === 'problems.getLibrary') {
        return Promise.resolve(libraryResponse)
      }

      if (method === 'problems.bulkUpdateProblems') {
        return Promise.resolve(undefined)
      }
      return Promise.resolve(undefined)
    })
    renderProblemLibrary()

    await user.click(
      await screen.findByRole('checkbox', { name: 'Select Two Sum' }),
    )
    await user.click(
      screen.getByRole('checkbox', { name: 'Select Binary Search' }),
    )
    await user.click(
      within(screen.getByRole('region', { name: 'Bulk actions' })).getByRole(
        'button',
        { name: 'Edit Metadata' },
      ),
    )
    const dialog = screen.getByRole('dialog', {
      name: 'Edit selected metadata',
    })

    await user.click(
      within(dialog).getByRole('checkbox', { name: 'Set difficulty' }),
    )
    await user.selectOptions(
      within(dialog).getByLabelText('Difficulty'),
      'hard',
    )
    await user.click(
      within(dialog).getByRole('checkbox', { name: 'Set premium' }),
    )
    await user.selectOptions(within(dialog).getByLabelText('Premium'), 'true')
    await user.click(
      within(dialog).getByRole('checkbox', { name: 'Replace topics' }),
    )
    await addDialogLabel(user, dialog, 'Topics', 'array')
    await addDialogLabel(user, dialog, 'Topics', 'Graph')
    await user.click(
      within(dialog).getByRole('checkbox', { name: 'Replace companies' }),
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Update Problems' }),
    )

    expect(sendMessage).toHaveBeenCalledWith('problems.bulkUpdateProblems', {
      surface: 'dashboard',
      problemSlugs: ['two-sum', 'binary-search'],
      set: {
        difficulty: 'hard',
        isPremium: true,
        topicLabels: ['Array', 'Graph'],
        companyLabels: [],
      },
    })
  })
})

function renderProblemLibrary(
  props: Partial<Parameters<typeof ProblemLibraryScreen>[0]> = {},
) {
  const { wrapper } = createQueryTestHarness()

  return render(
    <ProblemLibraryScreen
      newProblemAction={
        <Button asChild size="sm">
          <a href="#/library/problems/new">
            <Plus aria-hidden="true" />
            New Problem
          </a>
        </Button>
      }
      renderEditProblemAction={(problem) => (
        <Button asChild size="sm" variant="ghost">
          <a href={`#/library/problems/${problem.slug}/edit`}>Edit</a>
        </Button>
      )}
      {...props}
    />,
    { wrapper },
  )
}

function getProblemRow(title: string) {
  return screen.getByRole('row', { name: new RegExp(title, 'i') })
}

function queryProblemRow(title: string) {
  return screen.queryByRole('row', { name: new RegExp(title, 'i') })
}

function findProblemRow(title: string) {
  return screen.findByRole('row', { name: new RegExp(title, 'i') })
}

async function selectLibraryFacetOption(
  user: ReturnType<typeof userEvent.setup>,
  facetLabel: string,
  optionLabel: string,
) {
  await user.click(
    within(screen.getByRole('region', { name: 'Library filters' })).getByRole(
      'button',
      { name: new RegExp(facetLabel) },
    ),
  )
  await user.click(screen.getByRole('option', { name: optionLabel }))
}

async function addDialogLabel(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  groupLabel: 'Companies' | 'Topics',
  value: string,
) {
  const input = within(dialog).getByLabelText(groupLabel)

  await user.clear(input)
  await user.type(input, `${value}{Enter}`)
}

const topicArray = { id: 'array', label: 'Array' }
const topicSearch = { id: 'binary-search', label: 'Binary Search' }
const companyMeta = { id: 'meta', label: 'Meta' }
const companyNetflix = { id: 'netflix', label: 'Netflix' }
const trackMembership = {
  trackId: 'leetcode-75',
  trackSlug: 'leetcode-75',
  trackTitle: 'LeetCode 75',
  groupId: 'leetcode-75:arrays-hashing',
  groupTitle: 'Arrays and Hashing',
  groupPosition: 1,
  problemPosition: 1,
}

const libraryResponse: ProblemLibraryResponse = createProblemLibraryResponse({
  summary: {
    totalCount: 3,
    filteredCount: 3,
    dueCount: 1,
    suspendedCount: 1,
  },
  options: {
    topics: [topicArray, topicSearch],
    companies: [companyMeta, companyNetflix],
  },
  rows: [
    {
      problem: createSerializedProblem({
        slug: 'two-sum',
        title: 'Two Sum',
        difficulty: 'easy',
      }),
      status: 'due',
      state: createSerializedNormalizedPracticeState({
        phase: 'review',
        isDue: true,
        isStarted: true,
        lastReviewedAt: '2026-01-01T10:00:00.000Z',
        dueAt: '2026-01-01T10:00:00.000Z',
        retrievability: 83,
        reviewCount: 3,
        stability: 2.5,
      }),
      nextReviewAt: '2026-01-01T10:00:00.000Z',
      lastReviewedAt: '2026-01-01T10:00:00.000Z',
      lastSolvedAt: '2026-01-01T10:00:00.000Z',
      topics: [topicArray],
      companies: [companyMeta],
      trackMemberships: [trackMembership],
    },
    {
      problem: createSerializedProblem({
        slug: 'binary-search',
        title: 'Binary Search',
        difficulty: 'easy',
      }),
      status: 'scheduled',
      state: createSerializedNormalizedPracticeState({
        phase: 'review',
        isStarted: true,
        dueAt: '2026-01-04T10:00:00.000Z',
      }),
      nextReviewAt: '2026-01-04T10:00:00.000Z',
      lastReviewedAt: null,
      lastSolvedAt: null,
      topics: [topicSearch],
      companies: [companyNetflix],
      trackMemberships: [],
    },
    {
      problem: createSerializedProblem({
        slug: '01-matrix',
        title: '01 Matrix',
        difficulty: 'medium',
        isPremium: true,
      }),
      status: 'suspended',
      state: createSerializedNormalizedPracticeState({
        isSuspended: true,
      }),
      nextReviewAt: null,
      lastReviewedAt: null,
      lastSolvedAt: null,
      topics: [],
      companies: [],
      trackMemberships: [],
    },
  ],
})
