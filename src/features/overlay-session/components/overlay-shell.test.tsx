import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { LeetCodeOverlaySession } from '../hooks/use-leetcode-overlay-session'
import { OverlayShell } from './overlay-shell'

const problemLocation = {
  slug: 'two-sum',
  url: 'https://leetcode.com/problems/two-sum/',
  host: 'leetcode.com',
}

const syncedSession = {
  location: problemLocation,
  metadata: {
    location: problemLocation,
    title: 'Two Sum',
    frontendId: '1',
    difficulty: 'Easy',
    isPremium: false,
    topics: [{ name: 'Array', slug: 'array' }],
    source: 'graphql',
    confidence: 'high',
    capturedAt: 100,
  },
  context: {
    problem: {
      id: 'leetcode:two-sum',
      source: 'leetcode',
      externalId: '1',
      slug: 'two-sum',
      title: 'Two Sum',
      difficulty: 'easy',
      url: 'https://leetcode.com/problems/two-sum/',
      isPremium: false,
      acceptanceRate: null,
      createdAt: '2026-05-20T00:00:00.000Z',
      updatedAt: '2026-05-20T00:00:00.000Z',
    },
    isTracked: true,
    practiceStatus: 'review',
    dueAt: null,
  },
  status: 'ready',
  feedback: null,
  elapsedSeconds: 95,
  saveReview: vi.fn().mockResolvedValue(undefined),
} satisfies LeetCodeOverlaySession

describe('OverlayShell', () => {
  it('renders the current problem as a plain review surface', () => {
    render(<OverlayShell {...syncedSession} />)

    expect(
      screen.getByRole('complementary', { name: 'CogniPace' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Two Sum' })).toBeInTheDocument()
    expect(screen.getAllByText('Easy')).toHaveLength(2)
    expect(screen.getByText('two-sum')).toBeInTheDocument()
    expect(screen.getByText('Ready to review')).toBeInTheDocument()
    expect(screen.getByLabelText('Elapsed solve time')).toHaveTextContent(
      '1:35',
    )
  })

  it('shows premium state without debug station details', () => {
    render(
      <OverlayShell
        {...syncedSession}
        metadata={{
          ...syncedSession.metadata,
          difficulty: 'Medium',
          isPremium: true,
          title: 'Binary Tree Upside Down',
        }}
      />,
    )

    expect(
      screen.getByRole('heading', { name: 'Binary Tree Upside Down' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Premium')).toBeInTheDocument()
    expect(screen.queryByText('Problem content')).not.toBeInTheDocument()
    expect(screen.queryByText('Submitted snapshot')).not.toBeInTheDocument()
    expect(screen.queryByText('Submission result')).not.toBeInTheDocument()
  })

  it('saves the selected review rating', async () => {
    const user = userEvent.setup()
    const saveReview = vi.fn().mockResolvedValue(undefined)

    render(<OverlayShell {...syncedSession} saveReview={saveReview} />)

    await user.click(screen.getByRole('button', { name: 'Good' }))

    expect(saveReview).toHaveBeenCalledWith('good')
  })

  it('keeps review actions disabled while the problem is still syncing', () => {
    render(
      <OverlayShell
        {...syncedSession}
        context={null}
        status="syncing-problem"
      />,
    )

    expect(screen.getByRole('button', { name: 'Again' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Hard' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Good' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Easy' })).toBeDisabled()
  })
})
