import {
  useClearGenAiProviderSecretMutation,
  useGenAiProviderStatusQuery,
  useSaveGenAiProviderModelMutation,
  useSaveGenAiProviderSecretMutation,
  useSelectGenAiProviderMutation,
  useTestGenAiProviderDraftMutation,
  useVerifyGenAiProviderMutation,
} from '../api'
import type { GenAiProviderId } from '../domain'

export function useGenAiProviderController() {
  const status = useGenAiProviderStatusQuery()
  const saveModel = useSaveGenAiProviderModelMutation()
  const saveSecret = useSaveGenAiProviderSecretMutation()
  const testDraft = useTestGenAiProviderDraftMutation()
  const verifyProvider = useVerifyGenAiProviderMutation()
  const selectProvider = useSelectGenAiProviderMutation()
  const clearSecret = useClearGenAiProviderSecretMutation()

  return {
    actions: {
      onClearSecret: (provider: GenAiProviderId) =>
        clearSecret.mutateAsync({ provider }),
      onSaveModel: (provider: GenAiProviderId, model: string) =>
        saveModel.mutateAsync({ provider, model }),
      onSaveSecret: (provider: GenAiProviderId, key: string) =>
        saveSecret.mutateAsync({
          provider,
          secret: { apiKey: key },
        }),
      onSelectProvider: (provider: GenAiProviderId) =>
        selectProvider.mutateAsync({ provider }),
      onTestDraft: (provider: GenAiProviderId, model: string, key: string) =>
        testDraft.mutateAsync({
          provider,
          model,
          secret: { apiKey: key },
        }),
      onVerifyProvider: (provider: GenAiProviderId) =>
        verifyProvider.mutateAsync({ provider }),
    },
    isLoading: status.isPending,
    isPending:
      saveModel.isPending ||
      saveSecret.isPending ||
      testDraft.isPending ||
      verifyProvider.isPending ||
      selectProvider.isPending ||
      clearSecret.isPending,
    status: status.data ?? null,
  }
}
