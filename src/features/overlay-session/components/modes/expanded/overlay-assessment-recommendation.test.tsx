import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { AssessmentRecommendation } from '@/features/leetcode-review-assistant'
import type { GenAiProviderMetadata } from '@/features/genai'

import { OverlayAssessmentRecommendation } from './overlay-assessment-recommendation'

type Props = Parameters<typeof OverlayAssessmentRecommendation>[0]

function renderRecommendation(overrides: Partial<Props> = {}) {
  const props: Props = {
    state: { status: 'idle' },
    selectedRating: 'good',
    isRatingLocked: false,
    isMutating: false,
    onUseRecommendation: vi.fn(),
    ...overrides,
  }
  return {
    ...render(<OverlayAssessmentRecommendation {...props} />),
    props,
  }
}

function makeRecommendation(
  overrides: Partial<AssessmentRecommendation> = {},
): AssessmentRecommendation {
  return {
    recommendedRating: 'hard',
    confidence: 'medium',
    summary: 'Solved within target.',
    primaryReason: 'Solved within target time using a hash-map.',
    evidence: ['Status: accepted', 'Elapsed 600s vs 2100s target'],
    complexity: { time: 'O(n)', space: 'O(n)', confidence: 'medium' },
    improvementPoints: ['Consider edge case for empty array.'],
    edgeCaseNotes: ['Negative numbers handled correctly.'],
    shouldUpdateRating: true,
    promptVersion: 'leetcode-assessment-v1',
    ...overrides,
  }
}

function makeProviderMetadata(): GenAiProviderMetadata {
  return { provider: 'openai', model: 'gpt-test', durationMs: 1234 }
}

describe('OverlayAssessmentRecommendation', () => {
  it('renders nothing when status is idle', () => {
    const { container } = renderRecommendation()
    expect(container.firstChild).toBeNull()
  })

  it('renders a busy labeled region in the pending state', () => {
    renderRecommendation({ state: { status: 'pending', fingerprint: 'fp-1' } })

    const region = screen.getByRole('region', { name: 'AI recommendation' })
    expect(region).toHaveAttribute('aria-busy', 'true')
    expect(region).toHaveAttribute('aria-live', 'polite')
  })

  it('renders rating, confidence, and primary reason in the ready state', () => {
    renderRecommendation({
      state: {
        status: 'ready',
        fingerprint: 'fp-1',
        recommendation: makeRecommendation({
          recommendedRating: 'hard',
          confidence: 'medium',
          primaryReason: 'Solved within target time using a hash-map.',
        }),
        providerMetadata: makeProviderMetadata(),
      },
    })

    expect(screen.getByText('Hard')).toBeInTheDocument()
    expect(screen.getByText(/Medium/)).toBeInTheDocument()
    expect(
      screen.getByText('Solved within target time using a hash-map.'),
    ).toBeInTheDocument()
  })

  it('shows Use recommendation when the AI rating differs from the selected rating', async () => {
    const onUseRecommendation = vi.fn()
    renderRecommendation({
      state: {
        status: 'ready',
        fingerprint: 'fp-1',
        recommendation: makeRecommendation({ recommendedRating: 'hard' }),
        providerMetadata: makeProviderMetadata(),
      },
      selectedRating: 'good',
      onUseRecommendation,
    })

    const button = screen.getByRole('button', { name: 'Use recommendation' })
    await userEvent.click(button)

    expect(onUseRecommendation).toHaveBeenCalledWith('hard')
  })

  it('hides Use recommendation when the AI rating equals the selected rating', () => {
    renderRecommendation({
      state: {
        status: 'ready',
        fingerprint: 'fp-1',
        recommendation: makeRecommendation({ recommendedRating: 'hard' }),
        providerMetadata: makeProviderMetadata(),
      },
      selectedRating: 'hard',
    })

    expect(
      screen.queryByRole('button', { name: 'Use recommendation' }),
    ).not.toBeInTheDocument()
  })

  it('hides Use recommendation when the rating is locked', () => {
    renderRecommendation({
      state: {
        status: 'ready',
        fingerprint: 'fp-1',
        recommendation: makeRecommendation({ recommendedRating: 'good' }),
        providerMetadata: makeProviderMetadata(),
      },
      selectedRating: 'again',
      isRatingLocked: true,
    })

    expect(
      screen.queryByRole('button', { name: 'Use recommendation' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(/Solved within target time using a hash-map\./),
    ).toBeInTheDocument()
  })

  it('hides Use recommendation while a mutation is in flight', () => {
    renderRecommendation({
      state: {
        status: 'ready',
        fingerprint: 'fp-1',
        recommendation: makeRecommendation({ recommendedRating: 'hard' }),
        providerMetadata: makeProviderMetadata(),
      },
      selectedRating: 'good',
      isMutating: true,
    })

    expect(
      screen.queryByRole('button', { name: 'Use recommendation' }),
    ).not.toBeInTheDocument()
  })

  it('expands and collapses the details disclosure', async () => {
    const user = userEvent.setup()
    renderRecommendation({
      state: {
        status: 'ready',
        fingerprint: 'fp-1',
        recommendation: makeRecommendation({
          evidence: ['Status: accepted', 'Elapsed 600s vs 2100s target'],
          improvementPoints: ['Consider edge case for empty array.'],
        }),
        providerMetadata: makeProviderMetadata(),
      },
    })

    const toggle = screen.getByRole('button', { name: /Show details/i })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Elapsed 600s vs 2100s target')).toBeNull()

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(
      screen.getByText('Elapsed 600s vs 2100s target'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Consider edge case for empty array.'),
    ).toBeInTheDocument()

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Elapsed 600s vs 2100s target')).toBeNull()
  })
})
