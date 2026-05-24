import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryHistory } from '@tanstack/react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { sendMessage } from '@/extension/messaging'
import { defaultUserSettings } from '@/features/settings/domain'
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
import { dashboardModalRouteMeta } from './navigation/route-manifest'

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
    vi.restoreAllMocks()
    window.history.replaceState(null, '', '/')
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(sendMessage).mockImplementation((method, request) => {
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
    ['/tracks', 'Tracks', 'Core interview practice'],
    ['/library', 'Library', 'Total'],
    ['/analytics', 'Analytics', 'Queue, FSRS, and Analytics'],
    ['/settings', 'Settings', 'Daily goal'],
  ])('renders the %s route', async (path, heading, expectedCopy) => {
    renderDashboard(path)

    expect(await screen.findByRole('heading', { name: heading })).toBeVisible()
    expect(await screen.findByText(new RegExp(expectedCopy, 'i'))).toBeVisible()
  })

  it.each([
    ['/tracks/new', 'Tracks', /New Track/i, null],
    ['/tracks/leetcode-75/edit', 'Tracks', /Edit/i, null],
    ['/tracks/problems/two-sum/edit', 'Tracks', /Edit/i, null],
    ['/library/problems/new', 'Library', /Add problem/i, null],
    ['/library/problems/two-sum/edit', 'Library', /Edit/i, null],
  ])(
    'renders %s over the parent route',
    async (path, parentHeading, modalHeading, eyebrow) => {
      renderDashboard(path)

      expect(
        await screen.findByRole('heading', { name: parentHeading }),
      ).toBeVisible()
      expect(screen.getByRole('dialog', { name: modalHeading })).toBeVisible()

      if (eyebrow) {
        expect(screen.getByText(eyebrow)).toBeVisible()
      }
    },
  )

  it('/tracks/new renders the track form over Tracks and loads options', async () => {
    renderDashboard('/tracks/new')

    expect(await screen.findByRole('heading', { name: 'Tracks' })).toBeVisible()
    const dialog = screen.getByRole('dialog', { name: 'New Track' })
    expect(dialog).toBeVisible()
    expect(await within(dialog).findByLabelText('Title')).toBeVisible()
    expect(within(dialog).getByLabelText('Group 1 title')).toHaveValue('Main')
    expect(
      within(dialog).getByLabelText('Search Library problems'),
    ).toBeVisible()
    expect(within(dialog).getByText('Two Sum')).toBeVisible()
    expect(within(dialog).queryByText('Placeholder')).not.toBeInTheDocument()
    expect(sendMessage).toHaveBeenCalledWith('tracks.getTrackForEdit', {
      surface: 'dashboard',
    })
  })

  it('renders track form modals with a scroll-contained form body', async () => {
    renderDashboard('/tracks/new')

    const dialog = await screen.findByRole('dialog', { name: 'New Track' })
    const modalBody = within(dialog).getByLabelText('Modal content')

    expect(dialog).toHaveClass('max-h-[calc(100vh-2rem)]', 'overflow-hidden')
    expect(modalBody).toHaveClass('min-h-0', 'overflow-y-auto')
  })

  it('/tracks/$trackId/edit direct route loads existing track composition', async () => {
    renderDashboard('/tracks/leetcode-75/edit')

    expect(
      await screen.findByRole('dialog', { name: 'Edit: LeetCode 75' }),
    ).toBeVisible()
    const dialog = screen.getByRole('dialog', { name: 'Edit: LeetCode 75' })
    expect(within(dialog).getByLabelText('Title')).toHaveValue('LeetCode 75')
    expect(within(dialog).getByLabelText('Target date')).toHaveValue(
      '2026-06-15',
    )
    expect(within(dialog).getByLabelText('Group 1 title')).toHaveValue(
      'Arrays and Hashing',
    )
    expect(within(dialog).getByText('Two Sum')).toBeVisible()
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

  it('shows a Close link while track modal form data is loading', async () => {
    vi.mocked(sendMessage).mockImplementation((method) => {
      if (method === 'tracks.getWorkspace') {
        return Promise.resolve(createTrackWorkspaceResponse())
      }

      if (method === 'tracks.getTrackForEdit') {
        return new Promise(() => undefined)
      }

      return Promise.resolve(defaultUserSettings)
    })

    renderDashboard('/tracks/new')

    const dialog = await screen.findByRole('dialog', { name: 'New Track' })

    expect(within(dialog).getByText('Loading track form…')).toBeVisible()
    expect(within(dialog).getByRole('link', { name: 'Close' })).toHaveAttribute(
      'href',
      '/tracks',
    )
  })

  it('shows a Close link when track modal form data fails to load', async () => {
    vi.mocked(sendMessage).mockImplementation((method) => {
      if (method === 'tracks.getWorkspace') {
        return Promise.resolve(createTrackWorkspaceResponse())
      }

      if (method === 'tracks.getTrackForEdit') {
        return Promise.reject(new Error('load failed'))
      }

      return Promise.resolve(defaultUserSettings)
    })

    renderDashboard('/tracks/new')

    const dialog = await screen.findByRole('dialog', { name: 'New Track' })

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Failed to load track form.',
    )
    expect(within(dialog).getByRole('link', { name: 'Close' })).toHaveAttribute(
      'href',
      '/tracks',
    )
  })

  it.each([
    ['/tracks/new', '/tracks'],
    ['/tracks/leetcode-75/edit', '/tracks'],
    ['/tracks/problems/two-sum/edit', '/tracks'],
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

  it('does not mark implemented problem modals as placeholders', () => {
    expect(dashboardModalRouteMeta.trackNew.staticData.presentation).toBe(
      'modal',
    )
    expect(dashboardModalRouteMeta.trackEdit.staticData.presentation).toBe(
      'modal',
    )
    expect(
      dashboardModalRouteMeta.trackProblemEdit.staticData.presentation,
    ).toBe('modal')
    expect(dashboardModalRouteMeta.problemNew.staticData.presentation).toBe(
      'modal',
    )
    expect(dashboardModalRouteMeta.problemEdit.staticData.presentation).toBe(
      'modal',
    )
    expect(dashboardModalRouteMeta.problemNew.description).not.toMatch(
      /later phase/i,
    )
    expect(dashboardModalRouteMeta.problemEdit.description).not.toMatch(
      /later phase/i,
    )
    expect(dashboardModalRouteMeta.trackProblemEdit.description).not.toMatch(
      /later phase/i,
    )
    expect(dashboardModalRouteMeta.trackNew.description).not.toMatch(
      /later phase/i,
    )
    expect(dashboardModalRouteMeta.trackEdit.description).not.toMatch(
      /later phase/i,
    )
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

  it('closes route modals when the backdrop is clicked', async () => {
    const { router, user } = renderDashboard('/library/problems/new')

    const dialog = await screen.findByRole('dialog', { name: 'Add problem' })
    const backdrop = dialog.parentElement

    expect(backdrop).not.toBeNull()
    await user.click(backdrop as HTMLElement)

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/library')
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('rewrites modal routes to the parent route before browser reload', async () => {
    window.history.replaceState(null, '', '/#/library/problems/new')
    renderDashboard('/library/problems/new')

    await screen.findByRole('dialog', { name: 'Add problem' })
    window.dispatchEvent(new Event('beforeunload'))

    expect(window.location.hash).toBe('#/library')
  })

  it.each([
    ['/library/problems/two-sum/edit', 'Library', 'Tracks'],
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

  it('skips to dashboard content without changing the hash route', async () => {
    const { router, user } = renderDashboard('/library')

    expect(
      await screen.findByRole('heading', { name: 'Library' }),
    ).toBeVisible()

    await user.tab()
    expect(
      screen.getByRole('button', { name: 'Skip to content' }),
    ).toHaveFocus()

    await user.keyboard('{Enter}')

    expect(screen.getByRole('main')).toHaveFocus()
    expect(router.state.location.pathname).toBe('/library')
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
