import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { OverlayPanel } from './overlay-panel'
import type { LeetCodeOverlaySession } from './use-leetcode-overlay-session'

const premiumSession = {
  location: {
    slug: 'binary-tree-upside-down',
    url: 'https://leetcode.com/problems/binary-tree-upside-down/',
    host: 'leetcode.com',
  },
  metadata: {
    location: {
      slug: 'binary-tree-upside-down',
      url: 'https://leetcode.com/problems/binary-tree-upside-down/',
      host: 'leetcode.com',
    },
    title: 'Binary Tree Upside Down',
    frontendId: '156',
    difficulty: 'Medium',
    isPremium: true,
    topics: [{ name: 'Tree', slug: 'tree' }],
    source: 'graphql',
    confidence: 'high',
    capturedAt: 100,
  },
  context: null,
  codeSnapshot: null,
  lastSubmissionClick: null,
  status: 'ready',
  feedback: null,
  elapsedSeconds: 239,
  saveReview: vi.fn(),
} satisfies LeetCodeOverlaySession

describe('OverlayPanel', () => {
  it('shows when a LeetCode problem is premium locked', () => {
    render(<OverlayPanel {...premiumSession} />)

    expect(screen.getByText('Premium')).toBeInTheDocument()
    expect(screen.getByText('Premium locked on LeetCode')).toBeInTheDocument()
  })
})
