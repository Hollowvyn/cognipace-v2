import { relations } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { problemTopics } from './problem-topics'
import { topicAliases } from './topic-aliases'
import { topicRelations } from './topic-relations'

export const topics = sqliteTable('topics', {
  id: text('id').primaryKey(),
  label: text('label').notNull().unique(),
  createdAt: integer('created_at').notNull().default(0),
  updatedAt: integer('updated_at').notNull().default(0),
})

export const topicsRelations = relations(topics, ({ many }) => ({
  problems: many(problemTopics),
  aliases: many(topicAliases),
  parentRelations: many(topicRelations, { relationName: 'parentTopic' }),
  childRelations: many(topicRelations, { relationName: 'childTopic' }),
}))
