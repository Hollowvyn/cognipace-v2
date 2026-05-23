import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import { sendMessage } from '@/extension/messaging'
import {
  createProblemForEditResponse,
  createSerializedProblem,
} from '@/testing/problem-fixtures'
import { createQueryTestHarness } from '@/testing/query-test-harness'

import { ProblemForm } from './problem-form'

vi.mock('@/extension/messaging', () => ({
  sendMessage: vi.fn(),
}))

describe('ProblemForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('validates required create fields', async () => {
    const user = userEvent.setup()
    renderProblemForm(<ProblemForm mode="create" onCancel={vi.fn()} onSaved={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Save Problem' }))

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enter a LeetCode URL or slug.',
    )
    expect(screen.getByLabelText('LeetCode URL or slug')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    expect(sendMessage).not.toHaveBeenCalledWith(
      'problems.createProblem',
      expect.anything(),
    )
  })

  it('creates a problem with a normalized LeetCode slug', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    vi.mocked(sendMessage).mockResolvedValueOnce(
      createProblemForEditResponse({
        problem: createSerializedProblem({ slug: 'two-sum', title: 'Two Sum' }),
      }),
    )
    renderProblemForm(
      <ProblemForm mode="create" onCancel={vi.fn()} onSaved={onSaved} />,
    )

    await user.type(
      screen.getByLabelText('LeetCode URL or slug'),
      'https://leetcode.com/problems/Two_Sum/',
    )
    await user.type(screen.getByLabelText('Title'), 'Two Sum')
    await user.selectOptions(screen.getByLabelText('Difficulty'), 'medium')
    await user.click(screen.getByRole('switch', { name: 'LeetCode Premium' }))
    await user.click(screen.getByRole('button', { name: 'Save Problem' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(sendMessage).toHaveBeenCalledWith('problems.createProblem', {
      surface: 'dashboard',
      slugOrUrl: 'two-sum',
      title: 'Two Sum',
      difficulty: 'medium',
      isPremium: true,
      topicLabels: [],
      companyLabels: [],
    })
  })

  it('loads an edit problem and saves base metadata', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    vi.mocked(sendMessage).mockImplementation((method) => {
      if (method === 'problems.getProblemForEdit') {
        return Promise.resolve(
          createProblemForEditResponse({
            problem: createSerializedProblem({
              slug: 'two-sum',
              title: 'Two Sum',
              difficulty: 'easy',
              isPremium: false,
            }),
            topics: [{ id: 'array', label: 'Array' }],
            companies: [{ id: 'meta', label: 'Meta' }],
          }),
        )
      }

      return Promise.resolve(
        createProblemForEditResponse({
          problem: createSerializedProblem({
            slug: 'two-sum',
            title: '2Sum',
            difficulty: 'hard',
            isPremium: true,
          }),
        }),
      )
    })
    renderProblemForm(
      <ProblemForm
        mode="edit"
        onCancel={vi.fn()}
        onSaved={onSaved}
        problemSlug="two-sum"
      />,
    )

    expect(await screen.findByDisplayValue('two-sum')).toBeDisabled()
    await user.clear(screen.getByLabelText('Title'))
    await user.type(screen.getByLabelText('Title'), '2Sum')
    await user.selectOptions(screen.getByLabelText('Difficulty'), 'hard')
    await user.click(screen.getByRole('switch', { name: 'LeetCode Premium' }))
    await user.click(screen.getByRole('button', { name: 'Save Problem' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(sendMessage).toHaveBeenCalledWith('problems.updateProblem', {
      surface: 'dashboard',
      problemSlug: 'two-sum',
      title: '2Sum',
      difficulty: 'hard',
      isPremium: true,
      topicLabels: ['Array'],
      companyLabels: ['Meta'],
    })
  })

  it('cancels without mutating', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    renderProblemForm(<ProblemForm mode="create" onCancel={onCancel} onSaved={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(sendMessage).not.toHaveBeenCalled()
  })
})

function renderProblemForm(ui: React.ReactElement) {
  const { wrapper } = createQueryTestHarness()

  return render(ui, { wrapper })
}
