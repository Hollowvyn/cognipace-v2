import {
  createUnverifiedProviderVerification,
  genAiConnectionMetadataSchema,
  genAiProviderDefaultModels,
  type GenAiConnectionMetadata,
  type GenAiProviderVerification,
} from '../domain/genai-connection-types'
import type { GenAiProviderId } from '../domain/genai-types'

const genAiConnectionMetadataKey = 'cognipace_genai_connection_metadata_v1'
const defaultTimestamp = '2026-06-14T00:00:00.000Z'

export const defaultGenAiConnectionMetadata: GenAiConnectionMetadata = {
  schemaVersion: 1,
  selectedProvider: 'gemini',
  providers: {
    gemini: {
      model: genAiProviderDefaultModels.gemini,
      verification: createUnverifiedProviderVerification(),
    },
    openai: {
      model: genAiProviderDefaultModels.openai,
      verification: createUnverifiedProviderVerification(),
    },
    anthropic: {
      model: genAiProviderDefaultModels.anthropic,
      verification: createUnverifiedProviderVerification(),
    },
  },
  updatedAt: defaultTimestamp,
}

export async function readGenAiConnectionMetadata(): Promise<GenAiConnectionMetadata> {
  const result = await readChromeLocalStorage().get(genAiConnectionMetadataKey)
  const parsed = genAiConnectionMetadataSchema.safeParse(
    result[genAiConnectionMetadataKey],
  )

  return parsed.success
    ? parsed.data
    : structuredClone(defaultGenAiConnectionMetadata)
}

export async function writeGenAiConnectionMetadata(
  metadata: GenAiConnectionMetadata,
): Promise<GenAiConnectionMetadata> {
  const next = genAiConnectionMetadataSchema.parse(metadata)
  await readChromeLocalStorage().set({ [genAiConnectionMetadataKey]: next })

  return next
}

export async function selectGenAiProvider(
  provider: GenAiProviderId,
  now = new Date(),
): Promise<GenAiConnectionMetadata> {
  const current = await readGenAiConnectionMetadata()

  return writeGenAiConnectionMetadata({
    ...current,
    selectedProvider: provider,
    updatedAt: now.toISOString(),
  })
}

export async function updateGenAiProviderModel(
  provider: GenAiProviderId,
  model: string,
  now = new Date(),
): Promise<GenAiConnectionMetadata> {
  const current = await readGenAiConnectionMetadata()

  return writeGenAiConnectionMetadata({
    ...current,
    providers: {
      ...current.providers,
      [provider]: {
        ...current.providers[provider],
        model,
        verification: createUnverifiedProviderVerification(),
      },
    },
    updatedAt: now.toISOString(),
  })
}

export async function resetProviderVerification(
  provider: GenAiProviderId,
  now = new Date(),
): Promise<GenAiConnectionMetadata> {
  const current = await readGenAiConnectionMetadata()

  return writeGenAiConnectionMetadata({
    ...current,
    providers: {
      ...current.providers,
      [provider]: {
        ...current.providers[provider],
        verification: createUnverifiedProviderVerification(),
      },
    },
    updatedAt: now.toISOString(),
  })
}

export async function updateProviderVerification(
  provider: GenAiProviderId,
  verification: GenAiProviderVerification,
  now = new Date(),
): Promise<GenAiConnectionMetadata> {
  const current = await readGenAiConnectionMetadata()

  return writeGenAiConnectionMetadata({
    ...current,
    providers: {
      ...current.providers,
      [provider]: {
        ...current.providers[provider],
        verification,
      },
    },
    updatedAt: now.toISOString(),
  })
}

function readChromeLocalStorage(): ChromeStorageLocal {
  if (
    typeof chrome === 'undefined' ||
    typeof chrome.storage === 'undefined' ||
    typeof chrome.storage.local === 'undefined'
  ) {
    throw new Error('chrome.storage.local is not available.')
  }

  return chrome.storage.local
}

type ChromeStorageLocal = {
  get(keys: string[] | string): Promise<Record<string, unknown>>
  set(values: Record<string, unknown>): Promise<void>
}
