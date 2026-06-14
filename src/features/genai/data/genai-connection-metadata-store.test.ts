import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  defaultGenAiConnectionMetadata,
  readGenAiConnectionMetadata,
  resetProviderVerification,
  selectGenAiProvider,
  updateGenAiProviderModel,
  writeGenAiConnectionMetadata,
} from './genai-connection-metadata-store'

const storage = new Map<string, unknown>()

beforeEach(async () => {
  storage.clear()
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get(keys: string[] | string) {
          const output: Record<string, unknown> = {}

          for (const key of Array.isArray(keys) ? keys : [keys]) {
            output[key] = storage.get(key)
          }

          return Promise.resolve(output)
        },
        set(values: Record<string, unknown>) {
          for (const [key, value] of Object.entries(values)) {
            storage.set(key, value)
          }

          return Promise.resolve()
        },
        clear() {
          storage.clear()

          return Promise.resolve()
        },
      },
    },
  })

  await chrome.storage.local.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('genai connection metadata store', () => {
  it('defaults to Gemini with provider model defaults and all providers unverified', async () => {
    await expect(readGenAiConnectionMetadata()).resolves.toEqual(
      defaultGenAiConnectionMetadata,
    )
  })

  it('falls back to defaults when stored metadata is invalid', async () => {
    await chrome.storage.local.set({
      cognipace_genai_connection_metadata_v1: { selectedProvider: 'bad' },
    })

    await expect(readGenAiConnectionMetadata()).resolves.toEqual(
      defaultGenAiConnectionMetadata,
    )
  })

  it('persists selected provider changes with updatedAt', async () => {
    const next = await selectGenAiProvider(
      'openai',
      new Date('2026-06-14T10:00:00.000Z'),
    )

    expect(next.selectedProvider).toBe('openai')
    expect(next.updatedAt).toBe('2026-06-14T10:00:00.000Z')
    await expect(readGenAiConnectionMetadata()).resolves.toMatchObject({
      selectedProvider: 'openai',
      updatedAt: '2026-06-14T10:00:00.000Z',
    })
  })

  it('saves a provider model and resets verification for that provider', async () => {
    await writeGenAiConnectionMetadata({
      ...defaultGenAiConnectionMetadata,
      providers: {
        ...defaultGenAiConnectionMetadata.providers,
        gemini: {
          ...defaultGenAiConnectionMetadata.providers.gemini,
          verification: {
            state: 'valid',
            verifiedAt: '2026-06-14T09:00:00.000Z',
            checkedModel: 'gemini-2.5-flash',
            errorCode: null,
            message: null,
          },
        },
      },
      updatedAt: '2026-06-14T09:00:00.000Z',
    })

    const next = await updateGenAiProviderModel(
      'gemini',
      'gemini-3.5-flash',
      new Date('2026-06-14T10:00:00.000Z'),
    )

    expect(next.providers.gemini.model).toBe('gemini-3.5-flash')
    expect(next.providers.gemini.verification).toEqual({
      state: 'unverified',
      verifiedAt: null,
      checkedModel: null,
      errorCode: null,
      message: null,
    })
    expect(next.updatedAt).toBe('2026-06-14T10:00:00.000Z')
  })

  it('resets provider verification after a secret change only for the target provider', async () => {
    await writeGenAiConnectionMetadata({
      ...defaultGenAiConnectionMetadata,
      providers: {
        ...defaultGenAiConnectionMetadata.providers,
        gemini: {
          ...defaultGenAiConnectionMetadata.providers.gemini,
          verification: {
            state: 'valid',
            verifiedAt: '2026-06-14T09:00:00.000Z',
            checkedModel: 'gemini-2.5-flash',
            errorCode: null,
            message: null,
          },
        },
        openai: {
          ...defaultGenAiConnectionMetadata.providers.openai,
          verification: {
            state: 'valid',
            verifiedAt: '2026-06-14T09:30:00.000Z',
            checkedModel: 'gpt-4o-mini',
            errorCode: null,
            message: null,
          },
        },
      },
      updatedAt: '2026-06-14T09:30:00.000Z',
    })

    const next = await resetProviderVerification(
      'openai',
      new Date('2026-06-14T10:00:00.000Z'),
    )

    expect(next.providers.openai.verification).toEqual({
      state: 'unverified',
      verifiedAt: null,
      checkedModel: null,
      errorCode: null,
      message: null,
    })
    expect(next.providers.gemini.verification.state).toBe('valid')
    expect(next.updatedAt).toBe('2026-06-14T10:00:00.000Z')
  })
})
