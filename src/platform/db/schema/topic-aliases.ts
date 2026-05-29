import { relations } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { topics } from './topics'

export const topicAliases = sqliteTable(
  'topic_aliases',
  {
    aliasKey: text('alias_key').primaryKey(),
    label: text('label').notNull(),
    topicId: text('topic_id')
      .notNull()
      .references(() => topics.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [index('topic_aliases_topic_idx').on(table.topicId)],
)

export const topicAliasesRelations = relations(topicAliases, ({ one }) => ({
  topic: one(topics, {
    fields: [topicAliases.topicId],
    references: [topics.id],
  }),
}))
