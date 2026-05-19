import { relations } from 'drizzle-orm'
import { sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { problemTopics } from './problem-topics'

export const topics = sqliteTable('topics', {
  id: text('id').primaryKey(),
  label: text('label').notNull().unique(),
})

export const topicsRelations = relations(topics, ({ many }) => ({
  problems: many(problemTopics),
}))
