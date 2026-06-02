import { describe, expect, it } from 'vitest'

import { createTestDb } from '@/platform/db/test-db'
import { updateSettings } from '@/features/settings/server/settings-service'

import {
  clearAiProviderSecret,
  getAiProviderSecretPresence,
  isAiAssessmentAvailable,
  loadActiveProviderConfig,
  setAiProviderSecret,
} from './genai-settings-service'

describe('getAiProviderSecretPresence', () => {
  it('returns all-false on empty store', async () => {
    const handle = await createTestDb({ seed: false })
    expect(await getAiProviderSecretPresence(handle.db)).toEqual({
      openai: false,
      anthropic: false,
      gemini: false,
    })
  })

  it('reflects which providers have keys', async () => {
    const handle = await createTestDb({ seed: false })
    await setAiProviderSecret(handle.db, 'anthropic', { apiKey: 'sk-ant' })
    expect(await getAiProviderSecretPresence(handle.db)).toEqual({
      openai: false,
      anthropic: true,
      gemini: false,
    })
  })
})

describe('setAiProviderSecret / clearAiProviderSecret', () => {
  it('set returns updated presence', async () => {
    const handle = await createTestDb({ seed: false })
    const presence = await setAiProviderSecret(handle.db, 'openai', {
      apiKey: 'sk-o',
    })
    expect(presence.openai).toBe(true)
  })

  it('clear removes only the named provider', async () => {
    const handle = await createTestDb({ seed: false })
    await setAiProviderSecret(handle.db, 'openai', { apiKey: 'sk-o' })
    await setAiProviderSecret(handle.db, 'gemini', { apiKey: 'g-x' })
    const presence = await clearAiProviderSecret(handle.db, 'openai')
    expect(presence).toEqual({ openai: false, anthropic: false, gemini: true })
  })
})

describe('loadActiveProviderConfig', () => {
  it('returns null when aiAssessment.enabled is false', async () => {
    const handle = await createTestDb({ seed: false })
    await updateSettings(handle.db, {
      aiAssessment: { enabled: false, provider: 'openai', model: 'gpt-test' },
    })
    await setAiProviderSecret(handle.db, 'openai', { apiKey: 'sk-test' })
    expect(await loadActiveProviderConfig(handle.db)).toBeNull()
  })

  it('returns null when model is empty', async () => {
    const handle = await createTestDb({ seed: false })
    await updateSettings(handle.db, {
      aiAssessment: { enabled: true, provider: 'openai', model: '' },
    })
    await setAiProviderSecret(handle.db, 'openai', { apiKey: 'sk-test' })
    expect(await loadActiveProviderConfig(handle.db)).toBeNull()
  })

  it('returns null when the active provider has no secret', async () => {
    const handle = await createTestDb({ seed: false })
    await updateSettings(handle.db, {
      aiAssessment: { enabled: true, provider: 'anthropic', model: 'claude' },
    })
    await setAiProviderSecret(handle.db, 'openai', { apiKey: 'sk-test' })
    expect(await loadActiveProviderConfig(handle.db)).toBeNull()
  })

  it('returns a full config when all conditions are met', async () => {
    const handle = await createTestDb({ seed: false })
    await updateSettings(handle.db, {
      aiAssessment: { enabled: true, provider: 'openai', model: 'gpt-test' },
    })
    await setAiProviderSecret(handle.db, 'openai', { apiKey: 'sk-test' })
    expect(await loadActiveProviderConfig(handle.db)).toEqual({
      provider: 'openai',
      model: 'gpt-test',
      apiKey: 'sk-test',
    })
  })

  it('includes baseUrl when the secret has one', async () => {
    const handle = await createTestDb({ seed: false })
    await updateSettings(handle.db, {
      aiAssessment: { enabled: true, provider: 'gemini', model: 'gemini-test' },
    })
    await setAiProviderSecret(handle.db, 'gemini', {
      apiKey: 'g-test',
      baseUrl: 'https://proxy.example.test',
    })
    expect(await loadActiveProviderConfig(handle.db)).toEqual({
      provider: 'gemini',
      model: 'gemini-test',
      apiKey: 'g-test',
      baseUrl: 'https://proxy.example.test',
    })
  })

  it('treats whitespace-only model as empty', async () => {
    const handle = await createTestDb({ seed: false })
    await updateSettings(handle.db, {
      aiAssessment: { enabled: true, provider: 'openai', model: '   ' },
    })
    await setAiProviderSecret(handle.db, 'openai', { apiKey: 'sk-test' })
    expect(await loadActiveProviderConfig(handle.db)).toBeNull()
  })
})

describe('isAiAssessmentAvailable', () => {
  it('returns false when no config can be resolved', async () => {
    const handle = await createTestDb({ seed: false })
    expect(await isAiAssessmentAvailable(handle.db)).toBe(false)
  })

  it('returns true when a full config can be resolved', async () => {
    const handle = await createTestDb({ seed: false })
    await updateSettings(handle.db, {
      aiAssessment: { enabled: true, provider: 'openai', model: 'gpt-test' },
    })
    await setAiProviderSecret(handle.db, 'openai', { apiKey: 'sk-test' })
    expect(await isAiAssessmentAvailable(handle.db)).toBe(true)
  })
})
