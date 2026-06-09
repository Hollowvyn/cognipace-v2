import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { AssessmentRecommendation } from '@/features/leetcode-review-assistant'
import type { GenAiProviderMetadata } from '@/features/genai'
import type { ReviewRating } from '@/lib/fsrs'

import type { AssessmentRecommendationState } from '../../..'

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
})
