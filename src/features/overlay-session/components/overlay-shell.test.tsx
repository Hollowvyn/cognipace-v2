import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { initialOverlaySessionState } from '../domain'
import type { LeetCodeOverlaySession } from '../hooks/use-leetcode-overlay-session'
import { OverlayShell } from './overlay-shell'

vi.mock('./modes/collapsed/collapsed-overlay', () => ({
  CollapsedOverlay: () => <div>Collapsed mode</div>,
}))

vi.mock('./modes/docked/docked-overlay', () => ({
  DockedOverlay: () => <div>Docked mode</div>,
}))

vi.mock('./modes/expanded/expanded-overlay', () => ({
  ExpandedOverlay: ({ view }: { view: { problemTitle: string } }) => (
    <div>Expanded mode: {view.problemTitle}</div>
  ),
}))

describe('OverlayShell', () => {
  it.each([
    ['collapsed', 'Collapsed mode'],
    ['expanded', 'Expanded mode: Two Sum'],
    ['docked', 'Docked mode'],
  ] as const)('routes to the %s mode', (visualMode, text) => {
    render(
      <OverlayShell
        {...createSession({
          overlay: {
            ...initialOverlaySessionState,
            visualMode,
          },
        })}
      />,
    )

    expect(screen.getByText(text)).toBeInTheDocument()
  })
})

function createSession(
  overrides: Partial<LeetCodeOverlaySession> = {},
): LeetCodeOverlaySession {
  return {
    actions: {
      collapse: vi.fn(),
      dock: vi.fn(),
      expand: vi.fn(),
      failReview: vi.fn(),
      openSettings: vi.fn(),
      pauseTimer: vi.fn(),
      prepareQuickSubmit: vi.fn(),
      resetTimer: vi.fn(),
      restartLocalSession: vi.fn(),
      restore: vi.fn(),
      selectRating: vi.fn(),
      startTimer: vi.fn(),
      submitReview: vi.fn(),
      updateReview: vi.fn(),
    },
    context: {
      nextStep: null,
      practice: null,
      problem: {
        difficulty: 'easy',
        id: 'leetcode:two-sum',
        isPremium: false,
        slug: 'two-sum',
        title: 'Two Sum',
        url: 'https://leetcode.com/problems/two-sum/',
      },
      timing: {
        easyMinutes: 20,
        hardMinutes: 50,
        hardMode: false,
        mediumMinutes: 35,
        requireSolveTime: false,
      },
    },
    draft: {
      clearField: vi.fn(),
      hasUnpersistedChanges: false,
      setField: vi.fn(),
    },
    feedback: null,
    location: null,
    metadata: null,
    overlay: initialOverlaySessionState,
    status: 'ready',
    timer: {
      elapsedSeconds: 0,
      isOverTarget: false,
      status: 'idle',
      targetSeconds: 20 * 60,
    },
    ...overrides,
  }
}
