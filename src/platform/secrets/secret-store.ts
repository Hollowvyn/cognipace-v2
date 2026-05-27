import {
  secretStatusSchema,
  storedSecretSchema,
  type SecretProviderId,
  type SecretStatus,
} from './secret-contracts'
import { createSecretFingerprint } from './secret-redaction'

const secretKeyPrefix = 'cognipace_secret_v1:'

export async function restrictSecretStorageAccess() {
  const localStorage = readChromeLocalStorage()

  if (
    'setAccessLevel' in localStorage &&
    typeof localStorage.setAccessLevel === 'function'
  ) {
    await localStorage.setAccessLevel({
      accessLevel: 'TRUSTED_CONTEXTS',
    })
  }
}

export async function saveSecret(
  provider: SecretProviderId,
  value: string,
  now = new Date(),
) {
  const normalizedValue = value.trim()

  if (!normalizedValue) {
    throw new Error('Secret value is required.')
  }

  const storedSecret = storedSecretSchema.parse({
    provider,
    value: normalizedValue,
    updatedAt: now.toISOString(),
    fingerprint: await createSecretFingerprint(normalizedValue),
  })

  await readChromeLocalStorage().set({
    [createSecretStorageKey(provider)]: storedSecret,
  })
}

export async function readSecret(provider: SecretProviderId) {
  const stored = await readStoredSecret(provider)
  return stored?.value ?? null
}

export async function deleteSecret(provider: SecretProviderId) {
  await readChromeLocalStorage().remove(createSecretStorageKey(provider))
}

export async function getSecretStatus(
  provider: SecretProviderId,
): Promise<SecretStatus> {
  const stored = await readStoredSecret(provider)

  return secretStatusSchema.parse({
    provider,
    configured: Boolean(stored),
    updatedAt: stored?.updatedAt ?? null,
    fingerprint: stored?.fingerprint ?? null,
  })
}

async function readStoredSecret(provider: SecretProviderId) {
  const result = await readChromeLocalStorage().get(
    createSecretStorageKey(provider),
  )
  const value = result[createSecretStorageKey(provider)]
  const parsed = storedSecretSchema.safeParse(value)

  if (!parsed.success || parsed.data.provider !== provider) {
    return null
  }

  return parsed.data
}

function createSecretStorageKey(provider: SecretProviderId) {
  return `${secretKeyPrefix}${provider}`
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
  remove(keys: string[] | string): Promise<void>
  setAccessLevel?:
    | ((options: { accessLevel: 'TRUSTED_CONTEXTS' }) => Promise<void>)
    | undefined
}
