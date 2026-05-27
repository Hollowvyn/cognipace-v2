import { useGithubSyncController } from '../hooks/use-github-sync-controller'

import { GitHubSyncPanel } from './github-sync-panel'

export function GitHubSyncSettingsSection() {
  const sync = useGithubSyncController()

  if (!sync.status) {
    return null
  }

  return (
    <GitHubSyncPanel
      actions={sync.actions}
      isPending={sync.isPending || sync.isLoading}
      status={sync.status}
    />
  )
}
