import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import {
  classifyRetentionStatus,
  RetentionHealthPreview,
  RetentionHealthTooltip,
} from './retention-health-tooltip'

const point = {
  slug: 'graphs-dijkstra',
  title: 'Dijkstra',
  retrievability: 0.74,
  targetRetention: 0.9,
  daysSinceReview: 8,
  stabilityDays: 3,
  difficulty: 7.4,
  lapseCount: 1,
  overdueDays: 2,
}

describe('retention health tooltip', () => {
  it('classifies memory health with the same thresholds used by the chart', () => {
    expect(classifyRetentionStatus(0.9, 0.9)).toBe('aboveTarget')
    expect(classifyRetentionStatus(0.81, 0.9)).toBe('approaching')
    expect(classifyRetentionStatus(0.79, 0.9)).toBe('belowTarget')
  })

  it('links pinned details to the canonical LeetCode problem', () => {
    render(<RetentionHealthTooltip onClose={() => {}} point={point} />)

    expect(
      screen.getByRole('dialog', { name: 'Dijkstra memory details' }),
    ).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Open Dijkstra on LeetCode' }),
    ).toHaveAttribute('href', 'https://leetcode.com/problems/graphs-dijkstra/')
  })

  it('keeps passive previews descriptive without an action', () => {
    render(<RetentionHealthPreview point={point} />)

    expect(
      screen.getByRole('status', { name: 'Dijkstra memory preview' }),
    ).toHaveTextContent('Dijkstra retention: 74% predicted recall')
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
