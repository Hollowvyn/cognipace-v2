import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryHistory } from '@tanstack/react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { sendMessage } from '@/extension/messaging'
import { defaultUserSettings } from '@/features/settings/domain'
import { createDashboardAppShellData } from '@/testing/app-shell-fixtures'
import {
  createProblemForEditResponse,
  createProblemLibraryResponse,
  createSerializedProblem,
} from '@/testing/problem-fixtures'
import { createQueryTestHarness } from '@/testing/query-test-harness'
import {
  createSerializedTrack,
  createTrackForEditResponse,
  createTrackProblemRow,
  createTrackWorkspaceResponse,
} from '@/testing/track-fixtures'

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
  afterEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
    window.history.replaceState(null, '', '/')
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(sendMessage).mockImplementation((method, request) => {
      if (method === 'app.getShellData') {
        return Promise.resolve(createDashboardAppShellData())
      }

      if (method === 'tracks.getWorkspace') {
        return Promise.resolve(createTrackWorkspaceResponse())
      }

      if (method === 'tracks.getTrackForEdit') {
        if (
          typeof request === 'object' &&
          request !== null &&
          'trackId' in request
        ) {
          return Promise.resolve(
            createTrackForEditResponse({
              track: createSerializedTrack({
                dueAt: '2026-06-15T00:00:00.000Z',
                id: 'leetcode-75',
                slug: 'leetcode-75',
                title: 'LeetCode 75',
              }),
              groups: [
                {
                  id: 'leetcode-75:arrays-hashing',
                  trackId: 'leetcode-75',
                  title: 'Arrays and Hashing',
                  position: 1,
                  problemSlugs: ['two-sum'],
                },
              ],
              problemRows: [
                createTrackProblemRow({
                  problem: createSerializedProblem({
                    slug: 'two-sum',
                    title: 'Two Sum',
                  }),
                }),
              ],
            }),
          )
        }

        return Promise.resolve(
          createTrackForEditResponse({
            track: null,
            groups: [],
            problemRows: [
              createTrackProblemRow({
                problem: createSerializedProblem({
                  slug: 'two-sum',
                  title: 'Two Sum',
                }),
              }),
            ],
          }),
        )
      }

      if (method === 'tracks.createTrack' || method === 'tracks.updateTrack') {
        return Promise.resolve(null)
      }

      if (method === 'problems.getLibrary') {
        return Promise.resolve(createProblemLibraryResponse())
      }

      if (method === 'problems.getProblemForEdit') {
        return Promise.resolve(
          createProblemForEditResponse({
            problem: createSerializedProblem({
              slug: 'two-sum',
              title: 'Two Sum',
            }),
          }),
        )
      }

      return Promise.resolve(defaultUserSettings)
    })
  })

  it('renders the real Overview route with recommendation and route navigation', async () => {
    renderDashboard('/')

    expect(
      await screen.findByRole('heading', { name: 'Overview' }),
    ).toBeVisible()
    expect(
      await screen.findByRole('heading', { name: 'Add Binary' }),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: 'Library' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Open Tracks' })).toBeVisible()
  })

  it.each([
    ['/tracks/new', 'Tracks', /New Track/i],
    ['/tracks/leetcode-75/edit', 'Tracks', /Edit/i],
    ['/tracks/problems/two-sum/edit', 'Tracks', /Edit/i],
    ['/library/tracks/new?draft=missing-draft', 'Library', /New Track/i],
    ['/library/problems/new', 'Library', /Add problem/i],
    ['/library/problems/two-sum/edit', 'Library', /Edit/i],
  ])(
    'renders %s over the parent route',
    async (path, parentHeading, modalHeading) => {
      renderDashboard(path)

      expect(
        await screen.findByRole('heading', { name: parentHeading }),
      ).toBeVisible()
      expect(screen.getByRole('dialog', { name: modalHeading })).toBeVisible()
    },
  )

  it('/library/tracks/new direct route handles a missing selection draft', async () => {
    const { router, user } = renderDashboard(
      '/library/tracks/new?draft=missing-draft',
    )

    expect(
      await screen.findByRole('heading', { name: 'Library' }),
    ).toBeVisible()
    const dialog = screen.getByRole('dialog', { name: 'New Track' })

    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'Track selection draft was not found.',
    )

    await user.click(
      within(dialog).getByRole('button', { name: 'Return to Library' }),
    )

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/library')
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('creates a track from selected Library rows', async () => {
    const { router, user } = renderDashboard('/library')

    expect(
      await screen.findByRole('heading', { name: 'Library' }),
    ).toBeVisible()

    await user.click(
      await screen.findByRole('checkbox', { name: 'Select Binary Search' }),
    )
    await user.click(screen.getByRole('button', { name: 'Make Track' }))

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/library/tracks/new')
    })

    const dialog = await screen.findByRole('dialog', { name: 'New Track' })

    expect(
      await within(dialog).findByText('1 selected Library problems'),
    ).toBeVisible()
    expect(
      within(dialog).getByRole('listitem', { name: '1. Binary Search' }),
    ).toBeVisible()
  })

  it('opens problem edit from Tracks without replacing the Tracks workspace', async () => {
    const { router, user } = renderDashboard('/tracks')

    expect(await screen.findByRole('heading', { name: 'Tracks' })).toBeVisible()

    await user.click(
      await screen.findByRole('button', { name: 'Expand Two Sum' }),
    )
    await user.click(screen.getByRole('link', { name: 'Edit' }))

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(
        '/tracks/problems/two-sum/edit',
      )
    })
    expect(screen.getByRole('heading', { name: 'Tracks' })).toBeVisible()
    expect(
      screen.queryByRole('heading', { name: 'Library' }),
    ).not.toBeInTheDocument()
    expect(
      await screen.findByRole('dialog', { name: 'Edit: Two Sum' }),
    ).toBeVisible()
  })

  it.each([
    ['/tracks/new', '/tracks'],
    ['/tracks/leetcode-75/edit', '/tracks'],
    ['/tracks/problems/two-sum/edit', '/tracks'],
    ['/library/tracks/new?draft=missing-draft', '/library'],
    ['/library/problems/new', '/library'],
    ['/library/problems/two-sum/edit', '/library'],
  ])('closes %s to %s', async (path, closePath) => {
    const { router, user } = renderDashboard(path)

    await screen.findByRole('dialog')
    const closeLink = screen.queryByRole('link', { name: 'Close' })

    if (closeLink) {
      await user.click(closeLink)
    } else {
      await user.click(await screen.findByRole('button', { name: 'CANCEL' }))
    }

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(closePath)
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes route modals with Escape', async () => {
    const { router, user } = renderDashboard('/tracks/new')

    await screen.findByRole('dialog', { name: 'New Track' })
    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/tracks')
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it.each([
    ['/tracks/new', '/tracks'],
    ['/library/problems/new', '/library'],
    ['/library/tracks/new?draft=missing-draft', '/library'],
  ])('rewrites %s to %s before browser reload', async (path, parentPath) => {
    window.history.replaceState(null, '', `/#${path}`)
    renderDashboard(path)

    await screen.findByRole('dialog')
    window.dispatchEvent(new Event('beforeunload'))

    expect(window.location.hash).toBe(`#${parentPath}`)
  })

  it.each([
    ['/library/problems/two-sum/edit', 'Library', 'Tracks'],
    ['/library/tracks/new?draft=missing-draft', 'Library', 'Tracks'],
    ['/tracks/problems/two-sum/edit', 'Tracks', 'Library'],
  ])(
    'keeps parent nav active for %s',
    async (path, activeNavLabel, inactiveNavLabel) => {
      renderDashboard(path)

      expect(
        await screen.findByRole('link', { name: activeNavLabel }),
      ).toHaveAttribute('aria-current', 'page')
      expect(
        screen.getByRole('link', { name: inactiveNavLabel }),
      ).not.toHaveAttribute('aria-current')
    },
  )

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
