import { relations } from 'drizzle-orm'
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core'

import { problems } from './problems'
import { trackGroups } from './track-groups'

export const trackGroupProblems = sqliteTable(
  'track_group_problems',
  {
    trackGroupId: text('track_group_id')
      .notNull()
      .references(() => trackGroups.id, { onDelete: 'cascade' }),
    problemId: text('problem_id')
      .notNull()
      .references(() => problems.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.trackGroupId, table.problemId] }),
    index('track_group_problems_problem_idx').on(table.problemId),
  ],
)

export const trackGroupProblemsRelations = relations(
  trackGroupProblems,
  ({ one }) => ({
    group: one(trackGroups, {
      fields: [trackGroupProblems.trackGroupId],
      references: [trackGroups.id],
    }),
    problem: one(problems, {
      fields: [trackGroupProblems.problemId],
      references: [problems.id],
    }),
  }),
)
