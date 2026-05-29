import { relations, sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core'

import { topics } from './topics'

export const topicRelations = sqliteTable(
  'topic_relations',
  {
    parentTopicId: text('parent_topic_id')
      .notNull()
      .references(() => topics.id, { onDelete: 'cascade' }),
    childTopicId: text('child_topic_id')
      .notNull()
      .references(() => topics.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.parentTopicId, table.childTopicId] }),
    index('topic_relations_parent_idx').on(table.parentTopicId),
    index('topic_relations_child_idx').on(table.childTopicId),
    check(
      'topic_relations_no_self_check',
      sql`${table.parentTopicId} <> ${table.childTopicId}`,
    ),
  ],
)

export const topicRelationsRelations = relations(topicRelations, ({ one }) => ({
  parent: one(topics, {
    fields: [topicRelations.parentTopicId],
    references: [topics.id],
    relationName: 'parentTopic',
  }),
  child: one(topics, {
    fields: [topicRelations.childTopicId],
    references: [topics.id],
    relationName: 'childTopic',
  }),
}))
