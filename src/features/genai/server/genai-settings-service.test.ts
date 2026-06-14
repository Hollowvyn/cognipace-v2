import { describe, expect, it } from 'vitest'

import { settingsKv } from '@/platform/db/schema'
import { createTestDb } from '@/platform/db/test-db'
import { updateSettings } from '@/features/settings/server/settings-service'
import { saveSecret } from '@/platform/secrets'
import {
  readGenAiConnectionMetadata,
  selectGenAiProvider as selectStoredGenAiProvider,
  updateGenAiProviderModel,
  updateProviderVerification,
} from '@/features/genai/data/genai-connection-metadata-store'

import {
  clearAiProviderSecret,
  clearGenAiProviderSecret,
  getGenAiProviderStatus,
  getAiProviderSecretPresence,
  isAiAssessmentAvailable,
  loadActiveProviderConfig,
  saveGenAiProviderModel,
  saveGenAiProviderSecret,
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

  it('does not write GenAI API keys into settings_kv', async () => {
    const handle = await createTestDb({ seed: false })

    await setAiProviderSecret(handle.db, 'openai', { apiKey: 'sk-test' })

    const rows = await handle.db.select().from(settingsKv)
    expect(rows.some((row) => row.key === 'genai-secrets')).toBe(false)
    expect(JSON.stringify(rows)).not.toContain('sk-test')
  })
})

describe('loadActiveProviderConfig', () => {
  it('returns null when Auto assessment is disabled even with AI, provider, and secret configured', async () => {
    const handle = await createTestDb({ seed: false })
    await updateSettings(handle.db, {
      assessment: { autoAssessmentEnabled: false },
      aiAssessment: { enabled: true, provider: 'openai', model: 'legacy' },
    })
    await selectStoredGenAiProvider('openai')
    await updateGenAiProviderModel('openai', 'gpt-test')
    await updateProviderVerification('openai', {
      state: 'valid',
      verifiedAt: '2026-06-14T09:00:00.000Z',
      checkedModel: 'gpt-test',
      errorCode: null,
      message: null,
    })
    await setAiProviderSecret(handle.db, 'openai', { apiKey: 'sk-test' })

    expect(await loadActiveProviderConfig(handle.db)).toBeNull()
  })

  it('returns null when AI assessment is disabled but Auto is enabled', async () => {
    const handle = await createTestDb({ seed: false })
    await updateSettings(handle.db, {
      assessment: { autoAssessmentEnabled: true },
      aiAssessment: { enabled: false, provider: 'openai', model: 'gpt-test' },
    })
    await selectStoredGenAiProvider('openai')
    await updateProviderVerification('openai', {
      state: 'valid',
      verifiedAt: '2026-06-14T09:00:00.000Z',
      checkedModel: 'gpt-4o-mini',
      errorCode: null,
      message: null,
    })
    await setAiProviderSecret(handle.db, 'openai', { apiKey: 'sk-test' })
    expect(await loadActiveProviderConfig(handle.db)).toBeNull()
  })

  it('returns null when selected provider verification does not match the model', async () => {
    const handle = await createTestDb({ seed: false })
    await updateSettings(handle.db, {
      assessment: { autoAssessmentEnabled: true },
      aiAssessment: { enabled: true, provider: 'openai', model: 'legacy' },
    })
    await selectStoredGenAiProvider('openai')
    await updateGenAiProviderModel('openai', 'gpt-test')
    await updateProviderVerification('openai', {
      state: 'valid',
      verifiedAt: '2026-06-14T09:00:00.000Z',
      checkedModel: 'gpt-old',
      errorCode: null,
      message: null,
    })
    await setAiProviderSecret(handle.db, 'openai', { apiKey: 'sk-test' })

    expect(await loadActiveProviderConfig(handle.db)).toBeNull()
  })

  it('returns null when selected provider is unverified', async () => {
    const handle = await createTestDb({ seed: false })
    await updateSettings(handle.db, {
      assessment: { autoAssessmentEnabled: true },
      aiAssessment: { enabled: true, provider: 'openai', model: 'legacy' },
    })
    await selectStoredGenAiProvider('anthropic')
    await setAiProviderSecret(handle.db, 'anthropic', { apiKey: 'sk-test' })

    expect(await loadActiveProviderConfig(handle.db)).toBeNull()
  })

  it('returns null when selected verified provider has no secret', async () => {
    const handle = await createTestDb({ seed: false })
    await updateSettings(handle.db, {
      assessment: { autoAssessmentEnabled: true },
      aiAssessment: { enabled: true, provider: 'openai', model: 'legacy' },
    })
    await selectStoredGenAiProvider('anthropic')
    await updateProviderVerification('anthropic', {
      state: 'valid',
      verifiedAt: '2026-06-14T09:00:00.000Z',
      checkedModel: 'claude-haiku-4-5',
      errorCode: null,
      message: null,
    })
    await setAiProviderSecret(handle.db, 'openai', { apiKey: 'sk-test' })

    expect(await loadActiveProviderConfig(handle.db)).toBeNull()
  })

  it('returns selected verified provider config from metadata and trusted secret without leaking key in status', async () => {
    const handle = await createTestDb({ seed: false })
    await updateSettings(handle.db, {
      assessment: { autoAssessmentEnabled: true },
      aiAssessment: { enabled: true, provider: 'gemini', model: 'legacy' },
    })
    await selectStoredGenAiProvider('openai')
    await updateGenAiProviderModel('openai', 'gpt-test')
    await setAiProviderSecret(handle.db, 'openai', { apiKey: 'sk-test' })
    await updateProviderVerification('openai', {
      state: 'valid',
      verifiedAt: '2026-06-14T09:00:00.000Z',
      checkedModel: 'gpt-test',
      errorCode: null,
      message: null,
    })

    expect(await loadActiveProviderConfig(handle.db)).toEqual({
      provider: 'openai',
      model: 'gpt-test',
      apiKey: 'sk-test',
    })

    const status = await getGenAiProviderStatus(handle.db)
    expect(status.selectedProvider).toBe('openai')
    expect(status.selectedReady).toBe(true)
    expect(JSON.stringify(status)).not.toMatch(/sk-test|apiKey/)
  })

  it('does not include baseUrl even when a stale saved secret has one', async () => {
    const handle = await createTestDb({ seed: false })
    await updateSettings(handle.db, {
      assessment: { autoAssessmentEnabled: true },
      aiAssessment: { enabled: true, provider: 'gemini', model: 'gemini-test' },
    })
    await selectStoredGenAiProvider('gemini')
    await updateGenAiProviderModel('gemini', 'gemini-test')
    await updateProviderVerification('gemini', {
      state: 'valid',
      verifiedAt: '2026-06-14T09:00:00.000Z',
      checkedModel: 'gemini-test',
      errorCode: null,
      message: null,
    })
    await saveSecret(
      'genai:google',
      JSON.stringify({
        apiKey: 'g-test',
        baseUrl: 'https://proxy.example.test',
      }),
    )
    expect(await loadActiveProviderConfig(handle.db)).toEqual({
      provider: 'gemini',
      model: 'gemini-test',
      apiKey: 'g-test',
    })
  })
})

describe('getGenAiProviderStatus and provider setup mutations', () => {
  it('defaults to Gemini and selectedReady false', async () => {
    const handle = await createTestDb({ seed: false })

    const status = await getGenAiProviderStatus(handle.db)
    const gemini = status.providers.find(
      (provider) => provider.provider === 'gemini',
    )

    expect(status.selectedProvider).toBe('gemini')
    expect(status.selectedReady).toBe(false)
    expect(gemini).toMatchObject({
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      secretConfigured: false,
      verificationState: 'unverified',
    })
  })

  it('model change, secret save, and secret clear reset verification', async () => {
    const handle = await createTestDb({ seed: false })
    await updateProviderVerification('gemini', {
      state: 'valid',
      verifiedAt: '2026-06-14T09:00:00.000Z',
      checkedModel: 'gemini-2.5-flash',
      errorCode: null,
      message: null,
    })

    const modelResult = await saveGenAiProviderModel(
      handle.db,
      'gemini',
      'gemini-3.0-flash',
    )
    expect(modelResult.status).toMatchObject({
      selectedProvider: 'gemini',
      selectedReady: false,
    })
    expect(
      (await readGenAiConnectionMetadata()).providers.gemini.verification.state,
    ).toBe('unverified')

    await updateProviderVerification('gemini', {
      state: 'valid',
      verifiedAt: '2026-06-14T09:01:00.000Z',
      checkedModel: 'gemini-3.0-flash',
      errorCode: null,
      message: null,
    })
    const secretResult = await saveGenAiProviderSecret(
      handle.db,
      'gemini',
      { apiKey: 'AIza-test' },
    )
    expect(secretResult.status.selectedReady).toBe(false)
    expect(
      (await readGenAiConnectionMetadata()).providers.gemini.verification.state,
    ).toBe('unverified')

    await updateProviderVerification('gemini', {
      state: 'valid',
      verifiedAt: '2026-06-14T09:02:00.000Z',
      checkedModel: 'gemini-3.0-flash',
      errorCode: null,
      message: null,
    })
    const clearResult = await clearGenAiProviderSecret(handle.db, 'gemini')
    expect(clearResult.status.selectedReady).toBe(false)
    expect(
      (await readGenAiConnectionMetadata()).providers.gemini.verification.state,
    ).toBe('unverified')
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
      assessment: { autoAssessmentEnabled: true },
      aiAssessment: { enabled: true, provider: 'openai', model: 'gpt-test' },
    })
    await selectStoredGenAiProvider('openai')
    await updateGenAiProviderModel('openai', 'gpt-test')
    await setAiProviderSecret(handle.db, 'openai', { apiKey: 'sk-test' })
    await updateProviderVerification('openai', {
      state: 'valid',
      verifiedAt: '2026-06-14T09:00:00.000Z',
      checkedModel: 'gpt-test',
      errorCode: null,
      message: null,
    })
    expect(await isAiAssessmentAvailable(handle.db)).toBe(true)
  })
})
