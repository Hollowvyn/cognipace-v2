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
    problemSlug: text('problem_slug')
      .notNull()
      .references(() => problems.slug, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.trackGroupId, table.problemSlug] }),
    index('track_group_problems_problem_slug_idx').on(table.problemSlug),
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
      fields: [trackGroupProblems.problemSlug],
      references: [problems.slug],
    }),
  }),
)
