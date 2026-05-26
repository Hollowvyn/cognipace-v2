import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  deleteSecret,
  getSecretStatus,
  readSecret,
  restrictSecretStorageAccess,
  saveSecret,
} from './secret-store'

const storage = new Map<string, unknown>()
const setAccessLevel = vi.fn()

beforeEach(() => {
  storage.clear()
  setAccessLevel.mockReset()
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
        remove(keys: string[] | string) {
          for (const key of Array.isArray(keys) ? keys : [keys]) {
            storage.delete(key)
          }
          return Promise.resolve()
        },
        setAccessLevel,
      },
    },
  })
})

describe('secret store', () => {
  it('stores and reads provider secrets from chrome local storage', async () => {
    await saveSecret('github:gist', 'ghp_secret')

    await expect(readSecret('github:gist')).resolves.toBe('ghp_secret')
  })

  it('returns status without exposing raw secret values', async () => {
    await saveSecret('github:gist', 'ghp_secret')

    const status = await getSecretStatus('github:gist')

    expect(status).toMatchObject({
      provider: 'github:gist',
      configured: true,
    })
    expect(typeof status.updatedAt).toBe('string')
    expect(typeof status.fingerprint).toBe('string')
    expect(JSON.stringify(status)).not.toContain('ghp_secret')
  })

  it('deletes secrets and clears configured status', async () => {
    await saveSecret('github:gist', 'ghp_secret')
    await deleteSecret('github:gist')

    await expect(readSecret('github:gist')).resolves.toBeNull()
    await expect(getSecretStatus('github:gist')).resolves.toMatchObject({
      configured: false,
      fingerprint: null,
    })
  })

  it('ignores stored secrets whose provider does not match the storage key', async () => {
    storage.set('cognipace_secret_v1:github:gist', {
      provider: 'genai:openai',
      value: 'sk_secret',
      updatedAt: new Date().toISOString(),
      fingerprint: '12345678',
    })

    await expect(readSecret('github:gist')).resolves.toBeNull()
    await expect(getSecretStatus('github:gist')).resolves.toMatchObject({
      configured: false,
      fingerprint: null,
    })
  })

  it('restricts local storage to trusted extension contexts', async () => {
    await restrictSecretStorageAccess()

    expect(setAccessLevel).toHaveBeenCalledWith({
      accessLevel: 'TRUSTED_CONTEXTS',
    })
  })
})
