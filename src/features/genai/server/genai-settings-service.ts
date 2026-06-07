import { getSettings } from '@/features/settings/server/settings-service'
import type { Db } from '@/platform/db'

import type {
  AiProviderSecret,
  AiProviderSecretPresence,
} from '../domain/genai-secrets-types'
import type {
  GenAiProviderConfig,
  GenAiProviderId,
} from '../domain/genai-types'
import {
  clearAiProviderSecretFromTrustedStorage,
  getAiProviderSecretPresenceFromTrustedStorage,
  loadAiProviderSecretFromTrustedStorage,
  saveAiProviderSecretToTrustedStorage,
} from './genai-secret-storage'

export async function getAiProviderSecretPresence(
  db: Db,
): Promise<AiProviderSecretPresence> {
  void db

  return getAiProviderSecretPresenceFromTrustedStorage()
}

export async function setAiProviderSecret(
  db: Db,
  provider: GenAiProviderId,
  secret: AiProviderSecret,
): Promise<AiProviderSecretPresence> {
  void db

  await saveAiProviderSecretToTrustedStorage(provider, secret)
  return getAiProviderSecretPresenceFromTrustedStorage()
}

export async function clearAiProviderSecret(
  db: Db,
  provider: GenAiProviderId,
): Promise<AiProviderSecretPresence> {
  void db

  await clearAiProviderSecretFromTrustedStorage(provider)
  return getAiProviderSecretPresenceFromTrustedStorage()
}

export async function loadActiveProviderConfig(
  db: Db,
): Promise<GenAiProviderConfig | null> {
  const settings = await getSettings(db)
  const ai = settings.aiAssessment

  if (!ai.enabled) return null
  if (ai.model.trim() === '') return null

  const secret = await loadAiProviderSecretFromTrustedStorage(ai.provider)
  if (!secret) return null

  return {
    provider: ai.provider,
    model: ai.model,
    apiKey: secret.apiKey,
  }
}

export async function isAiAssessmentAvailable(db: Db): Promise<boolean> {
  return (await loadActiveProviderConfig(db)) !== null
}
