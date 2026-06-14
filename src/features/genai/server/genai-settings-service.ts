import { getSettings } from '@/features/settings/server/settings-service'
import type { Db } from '@/platform/db'

import {
  readGenAiConnectionMetadata,
  resetProviderVerification,
  selectGenAiProvider as selectStoredGenAiProvider,
  updateGenAiProviderModel,
  updateProviderVerification,
} from '../data/genai-connection-metadata-store'
import {
  aiProviderSecretSchema,
  type AiProviderSecret,
  type AiProviderSecretPresence,
} from '../domain/genai-secrets-types'
import {
  genAiProviderLabels,
  type GenAiProviderAction,
  type GenAiProviderActionResult,
  type GenAiProviderStatus,
  type GenAiProviderVerification,
} from '../domain/genai-connection-types'
import type {
  GenAiProviderConfig,
  GenAiProviderId,
} from '../domain/genai-types'
import { genAiProviderIds } from '../domain/genai-types'
import {
  clearAiProviderSecretFromTrustedStorage,
  getAiProviderSecretPresenceFromTrustedStorage,
  loadAiProviderSecretFromTrustedStorage,
  saveAiProviderSecretToTrustedStorage,
} from './genai-secret-storage'
import {
  buildVerificationMetadata,
  verifyProviderConnection,
} from './genai-provider-verification'

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

  await resetProviderVerification(provider)
  await saveAiProviderSecretToTrustedStorage(provider, secret)
  return getAiProviderSecretPresenceFromTrustedStorage()
}

export async function clearAiProviderSecret(
  db: Db,
  provider: GenAiProviderId,
): Promise<AiProviderSecretPresence> {
  void db

  await resetProviderVerification(provider)
  await clearAiProviderSecretFromTrustedStorage(provider)
  return getAiProviderSecretPresenceFromTrustedStorage()
}

export async function getGenAiProviderStatus(
  db: Db,
): Promise<GenAiProviderStatus> {
  void db

  const [metadata, presence] = await Promise.all([
    readGenAiConnectionMetadata(),
    getAiProviderSecretPresenceFromTrustedStorage(),
  ])
  const selected = metadata.providers[metadata.selectedProvider]

  return {
    selectedProvider: metadata.selectedProvider,
    selectedReady:
      selected.model.trim() !== '' &&
      selected.verification.state === 'valid' &&
      selected.verification.checkedModel === selected.model &&
      presence[metadata.selectedProvider],
    providers: genAiProviderIds.map((provider) => {
      const connection = metadata.providers[provider]

      return {
        provider,
        label: genAiProviderLabels[provider],
        model: connection.model,
        secretConfigured: presence[provider],
        verificationState: connection.verification.state,
        verifiedAt: connection.verification.verifiedAt,
        lastErrorCode: connection.verification.errorCode,
        lastErrorMessage: connection.verification.message,
      }
    }),
  }
}

export async function saveGenAiProviderModel(
  db: Db,
  provider: GenAiProviderId,
  model: string,
): Promise<GenAiProviderActionResult> {
  await updateGenAiProviderModel(provider, model)

  return createActionResult(db, 'save-model', 'Provider model saved.')
}

export async function saveGenAiProviderSecret(
  db: Db,
  provider: GenAiProviderId,
  secret: AiProviderSecret,
): Promise<GenAiProviderActionResult> {
  await resetProviderVerification(provider)
  await saveAiProviderSecretToTrustedStorage(provider, secret)

  return createActionResult(db, 'save-secret', 'Provider key saved.')
}

export async function clearGenAiProviderSecret(
  db: Db,
  provider: GenAiProviderId,
): Promise<GenAiProviderActionResult> {
  await resetProviderVerification(provider)
  await clearAiProviderSecretFromTrustedStorage(provider)

  return createActionResult(db, 'clear-secret', 'Provider key cleared.')
}

export async function selectGenAiProvider(
  db: Db,
  provider: GenAiProviderId,
): Promise<GenAiProviderActionResult> {
  await selectStoredGenAiProvider(provider)

  return createActionResult(db, 'select-provider', 'Provider selected.')
}

export async function testGenAiProviderDraft(
  db: Db,
  provider: GenAiProviderId,
  model: string,
  secret: AiProviderSecret,
): Promise<GenAiProviderActionResult> {
  const parsedSecret = aiProviderSecretSchema.parse({
    ...secret,
    apiKey: secret.apiKey.trim(),
  })
  const result = await verifyProviderConnection({
    provider,
    model,
    apiKey: parsedSecret.apiKey,
  })

  return createActionResult(
    db,
    'test-draft',
    result.status === 'success'
      ? 'Draft provider verified.'
      : 'Draft provider verification failed.',
    result.status,
  )
}

export async function verifyGenAiProvider(
  db: Db,
  provider: GenAiProviderId,
): Promise<GenAiProviderActionResult> {
  const metadata = await readGenAiConnectionMetadata()
  const model = metadata.providers[provider].model
  const secret = await loadAiProviderSecretFromTrustedStorage(provider)

  if (model.trim() === '' || !secret) {
    return createActionResult(
      db,
      'verify-provider',
      'Provider verification requires a model and saved key.',
      'error',
    )
  }

  const result = await verifyProviderConnection({
    provider,
    model,
    apiKey: secret.apiKey,
  })
  await updateProviderVerification(
    provider,
    buildVerificationMetadata(model, result),
  )

  return createActionResult(
    db,
    'verify-provider',
    result.status === 'success'
      ? 'Provider verified.'
      : 'Provider verification failed.',
    result.status,
  )
}

export async function loadActiveProviderConfig(
  db: Db,
): Promise<GenAiProviderConfig | null> {
  const settings = await getSettings(db)

  if (settings.assessment.autoAssessmentEnabled !== true) return null
  if (settings.aiAssessment.enabled !== true) return null

  const metadata = await readGenAiConnectionMetadata()
  const provider = metadata.selectedProvider
  const connection = metadata.providers[provider]
  const model = connection.model
  const verification = connection.verification

  if (model.trim() === '') return null
  if (!isVerifiedForModel(verification, model)) return null

  const secret = await loadAiProviderSecretFromTrustedStorage(provider)
  if (!secret) return null

  return {
    provider,
    model,
    apiKey: secret.apiKey,
  }
}

export async function isAiAssessmentAvailable(db: Db): Promise<boolean> {
  return (await loadActiveProviderConfig(db)) !== null
}

async function createActionResult(
  db: Db,
  action: GenAiProviderAction,
  message: string,
  outcome: 'success' | 'error' = 'success',
): Promise<GenAiProviderActionResult> {
  return {
    action,
    outcome,
    message,
    status: await getGenAiProviderStatus(db),
    occurredAt: new Date().toISOString(),
  }
}

function isVerifiedForModel(
  verification: GenAiProviderVerification,
  model: string,
) {
  return (
    verification.state === 'valid' && verification.checkedModel === model
  )
}
