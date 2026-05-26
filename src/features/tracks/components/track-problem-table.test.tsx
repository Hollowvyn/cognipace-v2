import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { Button } from '@/components/ui/button'
import type { SerializedProblem } from '@/features/problems'
import { createSerializedProblem } from '@/testing/problem-fixtures'
import { createQueryTestHarness } from '@/testing/query-test-harness'
import { createTrackProblemRow } from '@/testing/track-fixtures'

import { TrackProblemTable } from './track-problem-table'

describe('TrackProblemTable', () => {
  it('expands one practice-only row detail at a time', async () => {
    const user = userEvent.setup()
    const rows = [
      createTrackProblemRow({
        problem: createSerializedProblem({
          slug: 'binary-search',
          title: 'Binary Search',
        }),
        membership: {
          trackId: 'leetcode-75',
          groupId: 'leetcode-75:arrays-hashing',
          groupTitle: 'Arrays and Hashing',
          groupPosition: 1,
          problemPosition: 2,
          completedAt: null,
          completedRating: null,
        },
      }),
      createTrackProblemRow({
        problem: createSerializedProblem({ slug: 'two-sum', title: 'Two Sum' }),
        membership: {
          trackId: 'leetcode-75',
          groupId: 'leetcode-75:arrays-hashing',
          groupTitle: 'Arrays and Hashing',
          groupPosition: 1,
          problemPosition: 1,
          completedAt: null,
          completedRating: null,
        },
      }),
    ]

    renderTrackProblemTable(rows)

    const renderedRows = screen.getAllByRole('row')
    expect(renderedRows).toHaveLength(3)
    const twoSumRow = renderedRows[1]
    const binarySearchRow = renderedRows[2]

    if (!twoSumRow || !binarySearchRow) {
      throw new Error('Expected two rendered problem rows.')
    }

    expect(
      within(twoSumRow).getByRole('button', { name: 'Expand Two Sum' }),
    ).toBeVisible()
    expect(within(twoSumRow).getByText('1')).toBeVisible()
    expect(
      within(binarySearchRow).getByRole('button', {
        name: 'Expand Binary Search',
      }),
    ).toBeVisible()
    expect(within(binarySearchRow).getByText('2')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Expand Two Sum' }))

    expect(screen.getByRole('heading', { name: 'Details' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute(
      'href',
      '#/library/problems/two-sum/edit',
    )
    expect(screen.getByRole('button', { name: 'Suspend' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Reset Schedule' })).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Delete' }),
    ).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Expand Binary Search' }),
    )

    expect(
      screen.getByRole('button', { name: 'Collapse Binary Search' }),
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Collapse Two Sum' }),
    ).not.toBeInTheDocument()
  })
})

function renderTrackProblemTable(
  rows: Parameters<typeof TrackProblemTable>[0]['rows'],
) {
  const { wrapper } = createQueryTestHarness()

  return render(
    <TrackProblemTable
      renderEditProblemAction={(problem: SerializedProblem) => (
        <Button asChild size="sm" variant="ghost">
          <a href={`#/library/problems/${problem.slug}/edit`}>Edit</a>
        </Button>
      )}
      rows={rows}
    />,
    { wrapper },
  )
}
