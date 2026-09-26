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
    sourceTopicId: text('source_topic_id')
      .notNull()
      .references(() => topics.id, { onDelete: 'cascade' }),
    targetTopicId: text('target_topic_id')
      .notNull()
      .references(() => topics.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ['broader', 'applies-to'] }).notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.kind, table.sourceTopicId, table.targetTopicId],
    }),
    index('topic_relations_source_idx').on(table.sourceTopicId),
    index('topic_relations_target_idx').on(table.targetTopicId),
    check(
      'topic_relations_no_self_check',
      sql`${table.sourceTopicId} <> ${table.targetTopicId}`,
    ),
    check(
      'topic_relations_kind_check',
      sql`${table.kind} IN ('broader', 'applies-to')`,
    ),
  ],
)

export const topicRelationsRelations = relations(topicRelations, ({ one }) => ({
  sourceTopic: one(topics, {
    fields: [topicRelations.sourceTopicId],
    references: [topics.id],
    relationName: 'sourceTopic',
  }),
  targetTopic: one(topics, {
    fields: [topicRelations.targetTopicId],
    references: [topics.id],
    relationName: 'targetTopic',
  }),
}))
