import {
  connectGithubGistViaRuntime,
  createGithubGistViaRuntime,
  deleteGithubTokenViaRuntime,
  saveGithubTokenViaRuntime,
  usePullLatest,
  usePushLocal,
  useSyncAction,
  useSyncStatus,
  validateGithubTokenViaRuntime,
} from '../api/sync-api'
import type { SyncActionResult } from '../api/sync-contracts'
import type { GitHubSyncPanelActions } from '../components/github-sync-panel'

function didPullSuccessfully(result: SyncActionResult) {
  return result.direction === 'pull' && result.outcome === 'success'
}

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
      shouldInvalidateData: didPullSuccessfully,
    },
  )
  const deleteToken = useSyncAction(() => deleteGithubTokenViaRuntime())
  const pullLatest = usePullLatest()
  const pushLocal = usePushLocal()

  const actions = {
    onConnectGist: (gistId) => connectGist.mutateAsync(gistId),
    onCreateGist: () => createGist.mutateAsync(),
    onDeleteToken: () => deleteToken.mutateAsync(),
    onPullLatest: () => pullLatest.mutateAsync(),
    onPushLocal: (input) => pushLocal.mutateAsync(input),
    onSaveToken: (token) => saveToken.mutateAsync(token),
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
      pullLatest.isPending ||
      pushLocal.isPending,
    status: status.data ?? null,
  }
}
