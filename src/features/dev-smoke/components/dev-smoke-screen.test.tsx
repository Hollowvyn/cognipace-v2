import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
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

  it('redacts secret-like strings from rendered smoke details', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce(
      createDevSmokeReport({
        checks: [
          {
            id: 'genai.config',
            label: 'GenAI config',
            status: 'warn',
            detail:
              'Provider rejected apiKey=sk-test-secret-value and Bearer AIzaVerySecretValue.',
          },
        ],
      }),
    )

    renderDevSmokeScreen()

    const genAi = await screen.findByRole('listitem', {
      name: /GenAI config/i,
    })

    expect(within(genAi).getByText(/apiKey=\[redacted\]/)).toBeVisible()
    expect(within(genAi).getByText(/Bearer \[redacted\]/)).toBeVisible()
    expect(screen.queryByText(/sk-test-secret-value/)).not.toBeInTheDocument()
    expect(screen.queryByText(/AIzaVerySecretValue/)).not.toBeInTheDocument()
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

  it('runs fresh smoke checks when remounted with a fresh cached report', async () => {
    vi.mocked(sendMessage)
      .mockResolvedValueOnce(
        createDevSmokeReport({
          generatedAt: '2026-06-07T12:00:00.000Z',
        }),
      )
      .mockResolvedValueOnce(
        createDevSmokeReport({
          generatedAt: '2026-06-07T12:00:30.000Z',
          checks: [
            {
              id: 'health',
              label: 'Background runtime',
              status: 'pass',
              detail: 'Fresh smoke result after remount.',
            },
          ],
        }),
      )

    const harness = createFreshCacheHarness()
    const firstRender = render(<DevSmokeScreen />, { wrapper: harness.wrapper })

    expect(
      await screen.findByText('Generated 2026-06-07T12:00:00.000Z'),
    ).toBeVisible()
    firstRender.unmount()

    render(<DevSmokeScreen />, { wrapper: harness.wrapper })

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledTimes(2)
    })
    expect(
      await screen.findByText('Fresh smoke result after remount.'),
    ).toBeVisible()
    expect(
      await screen.findByText('Generated 2026-06-07T12:00:30.000Z'),
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

function createFreshCacheHarness() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false, staleTime: 30_000 },
    },
  })

  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  }
}
