import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { initialOverlaySessionState } from '../domain'
import type { LeetCodeOverlaySession } from '../hooks/use-leetcode-overlay-session'
import { OverlayShell } from './overlay-shell'

vi.mock('./modes/collapsed/collapsed-overlay', () => ({
  CollapsedOverlay: ({ themeMode }: { themeMode: string }) => (
    <div>Collapsed mode: {themeMode}</div>
  ),
}))

vi.mock('./modes/docked/docked-overlay', () => ({
  DockedOverlay: ({ themeMode }: { themeMode: string }) => (
    <div>Docked mode: {themeMode}</div>
  ),
}))

vi.mock('./modes/expanded/expanded-overlay', () => ({
  ExpandedOverlay: ({
    themeMode,
    view,
  }: {
    themeMode: string
    view: { problemTitle: string }
  }) => (
    <div>
      Expanded mode: {view.problemTitle}: {themeMode}
    </div>
  ),
}))

describe('OverlayShell', () => {
  it.each([
    ['collapsed', 'Collapsed mode: light'],
    ['expanded', 'Expanded mode: Two Sum: light'],
    ['docked', 'Docked mode: light'],
  ] as const)('routes to the %s mode', (visualMode, text) => {
    render(
      <OverlayShell
        {...createSession({
          context: {
            ...createSession().context!,
            appearance: {
              themeMode: 'light',
            },
          },
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
      saveLeetCodeSubmissionResult: vi.fn(),
      selectRating: vi.fn(),
      startTimer: vi.fn(),
      submitReview: vi.fn(),
      updateReview: vi.fn(),
    },
    context: {
      appearance: {
        themeMode: 'system',
      },
      automation: {
        autoDetectSolved: false,
      },
      nextStep: null,
      practice: null,
      problem: {
        difficulty: 'easy',
        isPremium: false,
        problemSlug: 'two-sum',
        title: 'Two Sum',
      },
      timing: {
        requireSolveTime: false,
        strictTiming: false,
        timeTargetsMinutes: {
          easy: 20,
          medium: 35,
          hard: 50,
        },
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
