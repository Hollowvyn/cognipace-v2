import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SyncOpenCheck } from './sync-open-check'

const requestOpenCheck = vi.fn<(surface: 'popup') => Promise<null>>()

vi.mock('@/features/sync', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/sync')>()

  return {
    ...actual,
    requestOpenCheckViaRuntime: (surface: 'popup') => requestOpenCheck(surface),
  }
})

describe('SyncOpenCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requests one background open check for the mounted surface', async () => {
    requestOpenCheck.mockResolvedValue(null)

    renderWithQueryClient(<SyncOpenCheck surface="popup" />)

    await waitFor(() => {
      expect(requestOpenCheck).toHaveBeenCalledTimes(1)
    })
    expect(requestOpenCheck).toHaveBeenCalledWith('popup')
  })

  it('does not duplicate the open-check request during StrictMode effect probing', async () => {
    requestOpenCheck.mockResolvedValue(null)

    renderWithQueryClient(
      <StrictMode>
        <SyncOpenCheck surface="popup" />
      </StrictMode>,
    )

    await waitFor(() => {
      expect(requestOpenCheck).toHaveBeenCalledTimes(1)
    })
  })

  it('swallows open-check request errors', async () => {
    requestOpenCheck.mockRejectedValue(new Error('Scheduler unavailable.'))

    renderWithQueryClient(<SyncOpenCheck surface="popup" />)

    await waitFor(() => {
      expect(requestOpenCheck).toHaveBeenCalledWith('popup')
    })
  })
})

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  )
}
