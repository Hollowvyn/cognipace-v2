import { getSettings } from '@/features/settings/server/settings-service'
import type { Db } from '@/platform/db'

import type {
  AiProviderSecret,
  AiProviderSecretPresence,
} from '../domain/genai-secrets-types'
import { makeEmptyAiProviderSecretPresence } from '../domain/genai-secrets-types'
import type {
  GenAiProviderConfig,
  GenAiProviderId,
} from '../domain/genai-types'
import { genAiProviderIds } from '../domain/genai-types'
import { createGenAiSecretsStore } from './genai-secrets-store'

export async function getAiProviderSecretPresence(
  db: Db,
): Promise<AiProviderSecretPresence> {
  const secrets = await createGenAiSecretsStore(db).read()
  const presence = makeEmptyAiProviderSecretPresence()
  for (const id of genAiProviderIds) {
    presence[id] = secrets[id] !== undefined
  }
  return presence
}

export async function setAiProviderSecret(
  db: Db,
  provider: GenAiProviderId,
  secret: AiProviderSecret,
): Promise<AiProviderSecretPresence> {
  await createGenAiSecretsStore(db).setProvider(provider, secret)
  return getAiProviderSecretPresence(db)
}

export async function clearAiProviderSecret(
  db: Db,
  provider: GenAiProviderId,
): Promise<AiProviderSecretPresence> {
  await createGenAiSecretsStore(db).clearProvider(provider)
  return getAiProviderSecretPresence(db)
}

export async function loadActiveProviderConfig(
  db: Db,
): Promise<GenAiProviderConfig | null> {
  const settings = await getSettings(db)
  const ai = settings.aiAssessment

  if (!ai.enabled) return null
  if (ai.model.trim() === '') return null

  const secrets = await createGenAiSecretsStore(db).read()
  const secret = secrets[ai.provider]
  if (!secret) return null

  return {
    provider: ai.provider,
    model: ai.model,
    apiKey: secret.apiKey,
    ...(secret.baseUrl !== undefined ? { baseUrl: secret.baseUrl } : {}),
  }
}

export async function isAiAssessmentAvailable(db: Db): Promise<boolean> {
  return (await loadActiveProviderConfig(db)) !== null
}
