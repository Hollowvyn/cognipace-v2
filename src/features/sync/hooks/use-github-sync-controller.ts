import {
  connectGithubGistViaRuntime,
  createGithubGistViaRuntime,
  deleteGithubTokenViaRuntime,
  resolveSyncConflictViaRuntime,
  saveGithubTokenViaRuntime,
  syncNowViaRuntime,
  useSyncAction,
  useSyncStatus,
  validateGithubTokenViaRuntime,
} from '../api/sync-api'
import type { GitHubSyncPanelActions } from '../components/github-sync-panel'

export function useGithubSyncController() {
  const status = useSyncStatus()
  const validateToken = useSyncAction((token: string) =>
    validateGithubTokenViaRuntime(token),
  )
  const saveToken = useSyncAction((token: string) =>
    saveGithubTokenViaRuntime(token),
  )
  const createGist = useSyncAction(() => createGithubGistViaRuntime())
  const connectGist = useSyncAction(
    (gistId: string) => connectGithubGistViaRuntime(gistId),
    {
      invalidateData: true,
    },
  )
  const deleteToken = useSyncAction(() => deleteGithubTokenViaRuntime())
  const syncNow = useSyncAction(() => syncNowViaRuntime(), {
    invalidateData: true,
  })
  const resolveConflict = useSyncAction(
    (resolution: 'pull-remote' | 'push-local') =>
      resolveSyncConflictViaRuntime(resolution),
    {
      invalidateData: true,
    },
  )

  const actions = {
    onConnectGist: (gistId) => connectGist.mutateAsync(gistId),
    onCreateGist: () => createGist.mutateAsync(),
    onDeleteToken: () => deleteToken.mutateAsync(),
    onResolveConflict: (resolution) => resolveConflict.mutateAsync(resolution),
    onSaveToken: (token) => saveToken.mutateAsync(token),
    onSyncNow: () => syncNow.mutateAsync(),
    onValidateToken: (token) => validateToken.mutateAsync(token),
  } satisfies GitHubSyncPanelActions

  return {
    actions,
    isLoading: status.isPending,
    isPending:
      validateToken.isPending ||
      saveToken.isPending ||
      createGist.isPending ||
      connectGist.isPending ||
      deleteToken.isPending ||
      syncNow.isPending ||
      resolveConflict.isPending,
    status: status.data ?? null,
  }
}
