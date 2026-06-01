import { eq } from 'drizzle-orm'

import type { Db } from '@/platform/db'
import { settingsKv } from '@/platform/db/schema'

import {
  aiProviderSecretsSchema,
  emptyAiProviderSecrets,
  type AiProviderSecret,
  type AiProviderSecrets,
} from '../domain/genai-secrets-types'
import type { GenAiProviderId } from '../domain/genai-types'

const SECRETS_KEY = 'genai-secrets'

export function createGenAiSecretsStore(db: Db) {
  return new GenAiSecretsStore(db)
}

export class GenAiSecretsStore {
  constructor(private readonly db: Db) {}

  async read(): Promise<AiProviderSecrets> {
    const row = await this.db
      .select({ value: settingsKv.value })
      .from(settingsKv)
      .where(eq(settingsKv.key, SECRETS_KEY))
      .get()
    if (!row) return emptyAiProviderSecrets

    let parsedJson: unknown
    try {
      parsedJson = JSON.parse(row.value)
    } catch {
      return emptyAiProviderSecrets
    }
    const parsed = aiProviderSecretsSchema.safeParse(parsedJson)
    return parsed.success ? parsed.data : emptyAiProviderSecrets
  }

  async setProvider(
    provider: GenAiProviderId,
    secret: AiProviderSecret,
    now = new Date(),
  ): Promise<AiProviderSecrets> {
    return this.write((current) => ({ ...current, [provider]: secret }), now)
  }

  async clearProvider(
    provider: GenAiProviderId,
    now = new Date(),
  ): Promise<AiProviderSecrets> {
    return this.write((current) => {
      const next = { ...current }
      delete next[provider]
      return next
    }, now)
  }

  async clearAll(now = new Date()): Promise<AiProviderSecrets> {
    return this.write(() => ({}), now)
  }

  private async write(
    mutate: (current: AiProviderSecrets) => AiProviderSecrets,
    now: Date,
  ): Promise<AiProviderSecrets> {
    return this.db.transaction(async (tx) => {
      const current = await this.read()
      const next = mutate(current)
      const timestamp = now.getTime()
      const serialized = JSON.stringify(next)
      await tx
        .insert(settingsKv)
        .values({
          key: SECRETS_KEY,
          value: serialized,
          updatedAt: timestamp,
        })
        .onConflictDoUpdate({
          target: settingsKv.key,
          set: { value: serialized, updatedAt: timestamp },
        })
      return next
    })
  }
}
