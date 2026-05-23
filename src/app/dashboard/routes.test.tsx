import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryHistory } from '@tanstack/react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { sendMessage } from '@/extension/messaging'
import { defaultUserSettings } from '@/features/settings/domain'
import { createProblemLibraryResponse } from '@/testing/problem-fixtures'
import { createQueryTestHarness } from '@/testing/query-test-harness'

import {
  DashboardApp,
  createDashboardRouter,
  dashboardPaths,
} from './navigation/routes'

vi.mock('@/extension/messaging', () => ({
  sendMessage: vi.fn(),
}))

function renderDashboard(initialEntry = '/') {
  const router = createDashboardRouter({
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  })
  const { wrapper } = createQueryTestHarness()

  render(<DashboardApp router={router} />, { wrapper })

  return {
    router,
    user: userEvent.setup(),
  }
}

describe('dashboard routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(sendMessage).mockImplementation((method) => {
      if (method === 'problems.getLibrary') {
        return Promise.resolve(createProblemLibraryResponse())
      }

      return Promise.resolve(defaultUserSettings)
    })
  })

  it('renders all top-level navigation links', async () => {
    renderDashboard()

    expect(await screen.findByRole('link', { name: 'Overview' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Tracks' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Library' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Analytics' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Settings' })).toBeVisible()
  })

  it.each([
    ['/', 'Overview', 'what should I do now'],
    ['/tracks', 'Tracks', 'Track catalog'],
    ['/library', 'Library', 'Total'],
    ['/analytics', 'Analytics', 'Queue, FSRS, and Analytics'],
    ['/settings', 'Settings', 'Daily goal'],
  ])('renders the %s route', async (path, heading, expectedCopy) => {
    renderDashboard(path)

    expect(await screen.findByRole('heading', { name: heading })).toBeVisible()
    expect(await screen.findByText(new RegExp(expectedCopy, 'i'))).toBeVisible()
  })

  it.each([
    ['/tracks/new', 'Tracks', 'New Track'],
    ['/tracks/leetcode-75/edit', 'Tracks', 'Edit Track'],
    ['/library/problems/new', 'Library', 'New Problem'],
    ['/library/problems/two-sum/edit', 'Library', 'Edit Problem'],
  ])(
    'renders %s over the parent placeholder',
    async (path, parentHeading, modalHeading) => {
      renderDashboard(path)

      expect(
        await screen.findByRole('heading', { name: parentHeading }),
      ).toBeVisible()
      expect(screen.getByRole('dialog', { name: modalHeading })).toBeVisible()
    },
  )

  it.each([
    ['/tracks/new', '/tracks'],
    ['/tracks/leetcode-75/edit', '/tracks'],
    ['/library/problems/new', '/library'],
    ['/library/problems/two-sum/edit', '/library'],
  ])('closes %s to %s', async (path, closePath) => {
    const { router, user } = renderDashboard(path)

    await screen.findByRole('dialog')
    await user.click(screen.getByRole('link', { name: 'Close' }))

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(closePath)
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes modal placeholders with Escape', async () => {
    const { router, user } = renderDashboard('/tracks/new')

    await screen.findByRole('dialog', { name: 'New Track' })
    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/tracks')
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('keeps parent nav active for modal child routes', async () => {
    renderDashboard('/library/problems/two-sum/edit')

    expect(
      await screen.findByRole('link', { name: 'Library' }),
    ).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Overview' })).not.toHaveAttribute(
      'aria-current',
    )
  })

  it('does not define deferred destructive or data-management routes', () => {
    const router = createDashboardRouter({
      history: createMemoryHistory({ initialEntries: ['/'] }),
    })
    const routePaths = [
      ...Object.values(dashboardPaths),
      ...Object.keys(router.routesByPath),
    ]

    expect(routePaths).not.toEqual(
      expect.arrayContaining([
        expect.stringMatching(/delete|reset|backup|import|data-management/i),
      ]),
    )
  })
})
