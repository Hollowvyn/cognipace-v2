import { relations, sql } from 'drizzle-orm'
import {
  check,
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core'

import { trackGroupProblems } from './track-group-problems'

export const trackProblemProgress = sqliteTable(
  'track_problem_progress',
  {
    trackGroupId: text('track_group_id').notNull(),
    problemSlug: text('problem_slug').notNull(),
    completedAt: integer('completed_at').notNull(),
    completedRating: text('completed_rating').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.trackGroupId, table.problemSlug] }),
    foreignKey({
      name: 'track_problem_progress_membership_fk',
      columns: [table.trackGroupId, table.problemSlug],
      foreignColumns: [
        trackGroupProblems.trackGroupId,
        trackGroupProblems.problemSlug,
      ],
    }).onDelete('cascade'),
    check(
      'track_problem_progress_completed_rating_check',
      sql`${table.completedRating} in ('good', 'easy')`,
    ),
    index('track_problem_progress_problem_slug_idx').on(table.problemSlug),
  ],
)

export const trackProblemProgressRelations = relations(
  trackProblemProgress,
  ({ one }) => ({
    membership: one(trackGroupProblems, {
      fields: [
        trackProblemProgress.trackGroupId,
        trackProblemProgress.problemSlug,
      ],
      references: [
        trackGroupProblems.trackGroupId,
        trackGroupProblems.problemSlug,
      ],
    }),
  }),
)

export type TrackProblemProgressRow =
  typeof trackProblemProgress.$inferSelect
