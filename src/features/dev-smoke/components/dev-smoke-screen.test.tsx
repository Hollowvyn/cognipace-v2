import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { sendMessage } from '@/extension/messaging'
import type { DevSmokeReport } from '@/features/dev-smoke'
import { createQueryTestHarness } from '@/testing/query-test-harness'

import { DevSmokeScreen } from './dev-smoke-screen'

vi.mock('@/extension/messaging', () => ({
  sendMessage: vi.fn(),
}))

describe('DevSmokeScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading state without an error alert while the report is pending', () => {
    vi.mocked(sendMessage).mockReturnValueOnce(new Promise(() => {}))

    renderDevSmokeScreen()

    expect(screen.getByText('Loading dashboard smoke report...')).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('renders check statuses and details from the smoke report', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce(
      createDevSmokeReport({
        checks: [
          {
            id: 'health',
            label: 'Background runtime',
            status: 'pass',
            detail: 'Background smoke service is reachable.',
            latencyMs: 8,
          },
          {
            id: 'genai-live',
            label: 'Live GenAI provider',
            status: 'skip',
            detail: 'Live provider smoke is disabled.',
          },
        ],
      }),
    )

    renderDevSmokeScreen()

    const health = await screen.findByRole('listitem', {
      name: /Background runtime/i,
    })
    expect(within(health).getByText('Pass')).toBeVisible()
    expect(
      within(health).getByText('Background smoke service is reachable.'),
    ).toBeVisible()
    expect(within(health).getByText('8 ms')).toBeVisible()

    const genAi = screen.getByRole('listitem', {
      name: /Live GenAI provider/i,
    })
    expect(within(genAi).getByText('Skip')).toBeVisible()
    expect(
      within(genAi).getByText('Live provider smoke is disabled.'),
    ).toBeVisible()
  })

  it('reruns smoke with live GenAI enabled when the checkbox is toggled', async () => {
    const user = userEvent.setup()
    vi.mocked(sendMessage)
      .mockResolvedValueOnce(createDevSmokeReport())
      .mockResolvedValueOnce(
        createDevSmokeReport({
          checks: [
            {
              id: 'genai-live',
              label: 'Live GenAI provider',
              status: 'warn',
              detail: 'Provider smoke returned a non-secret warning.',
            },
          ],
        }),
      )

    renderDevSmokeScreen()

    await screen.findByText('Background smoke service is reachable.')
    await user.click(
      screen.getByRole('checkbox', {
        name: 'Run live GenAI provider smoke',
      }),
    )

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith('devSmoke.run', {
        surface: 'dashboard',
        runLiveGenAi: true,
      })
    })
    expect(
      await screen.findByText('Provider smoke returned a non-secret warning.'),
    ).toBeVisible()
  })
})

function renderDevSmokeScreen() {
  const harness = createQueryTestHarness()
  render(<DevSmokeScreen />, { wrapper: harness.wrapper })
  return harness
}

function createDevSmokeReport(
  overrides: Partial<DevSmokeReport> = {},
): DevSmokeReport {
  return {
    generatedAt: '2026-06-07T12:00:00.000Z',
    checks: [
      {
        id: 'health',
        label: 'Background runtime',
        status: 'pass',
        detail: 'Background smoke service is reachable.',
      },
    ],
    ...overrides,
  }
}
