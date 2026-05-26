import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useGithubSyncController } from '../hooks/use-github-sync-controller'

import { GitHubSyncSettingsSection } from './github-sync-settings-section'

vi.mock('../hooks/use-github-sync-controller', () => ({
  useGithubSyncController: vi.fn(),
}))

describe('GitHubSyncSettingsSection', () => {
  it('renders the sync panel from the sync-owned controller hook', () => {
    vi.mocked(useGithubSyncController).mockReturnValue({
      actions: {
        onConnectGist: vi.fn(),
        onCreateGist: vi.fn(),
        onDeleteToken: vi.fn(),
        onResolveConflict: vi.fn(),
        onSaveToken: vi.fn(),
        onSyncNow: vi.fn(),
        onValidateToken: vi.fn(),
      },
      isLoading: false,
      isPending: false,
      status: {
        enabled: false,
        configured: false,
        tokenConfigured: false,
        tokenStatus: {
          provider: 'github:gist',
          configured: false,
          updatedAt: null,
          fingerprint: null,
        },
        gistId: null,
        isSyncing: false,
        lastSyncAt: null,
        lastSyncDirection: null,
        lastPullAt: null,
        lastPushAt: null,
        needsPush: false,
        lastBlockingReason: null,
        lastError: null,
        conflict: null,
      },
    })

    render(<GitHubSyncSettingsSection />)

    expect(
      screen.getByRole('heading', { name: /GitHub Sync/i }),
    ).toBeInTheDocument()
  })
})
