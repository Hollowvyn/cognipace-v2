import { describe, expect, it } from 'vitest'

import { settingsKv } from '@/platform/db/schema'
import { createTestDb } from '@/platform/db/test-db'

import {
  emptyAiProviderSecrets,
  type AiProviderSecret,
} from '../domain/genai-secrets-types'
import { createGenAiSecretsStore } from './genai-secrets-store'

const openaiSecret: AiProviderSecret = { apiKey: 'sk-openai-test' }
const anthropicSecret: AiProviderSecret = {
  apiKey: 'sk-ant-test',
  baseUrl: 'https://api.anthropic.com',
}

describe('GenAiSecretsStore', () => {
  it('returns empty when no row exists', async () => {
    const handle = await createTestDb({ seed: false })
    const store = createGenAiSecretsStore(handle.db)
    expect(await store.read()).toEqual(emptyAiProviderSecrets)
  })

  it('sets a provider secret and reads it back', async () => {
    const handle = await createTestDb({ seed: false })
    const store = createGenAiSecretsStore(handle.db)
    await store.setProvider('openai', openaiSecret)
    expect(await store.read()).toEqual({ openai: openaiSecret })
  })

  it('preserves both providers when set independently', async () => {
    const handle = await createTestDb({ seed: false })
    const store = createGenAiSecretsStore(handle.db)
    await store.setProvider('openai', openaiSecret)
    await store.setProvider('anthropic', anthropicSecret)
    expect(await store.read()).toEqual({
      openai: openaiSecret,
      anthropic: anthropicSecret,
    })
  })

  it('clearProvider removes only the named provider', async () => {
    const handle = await createTestDb({ seed: false })
    const store = createGenAiSecretsStore(handle.db)
    await store.setProvider('openai', openaiSecret)
    await store.setProvider('anthropic', anthropicSecret)
    await store.clearProvider('openai')
    expect(await store.read()).toEqual({ anthropic: anthropicSecret })
  })

  it('clearAll empties the row', async () => {
    const handle = await createTestDb({ seed: false })
    const store = createGenAiSecretsStore(handle.db)
    await store.setProvider('openai', openaiSecret)
    await store.setProvider('gemini', { apiKey: 'g-test' })
    await store.clearAll()
    expect(await store.read()).toEqual(emptyAiProviderSecrets)
  })

  it('returns empty when the stored value is corrupted JSON', async () => {
    const handle = await createTestDb({ seed: false })
    const store = createGenAiSecretsStore(handle.db)
    await handle.db.insert(settingsKv).values({
      key: 'genai-secrets',
      value: '{not valid json',
      updatedAt: Date.now(),
    })
    expect(await store.read()).toEqual(emptyAiProviderSecrets)
  })

  it('returns empty when the stored shape fails Zod validation', async () => {
    const handle = await createTestDb({ seed: false })
    const store = createGenAiSecretsStore(handle.db)
    await handle.db.insert(settingsKv).values({
      key: 'genai-secrets',
      value: JSON.stringify({ openai: 'not-an-object' }),
      updatedAt: Date.now(),
    })
    expect(await store.read()).toEqual(emptyAiProviderSecrets)
  })
})
