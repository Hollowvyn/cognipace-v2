import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const settingsKv = sqliteTable('settings_kv', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export type SettingsKvRow = typeof settingsKv.$inferSelect
