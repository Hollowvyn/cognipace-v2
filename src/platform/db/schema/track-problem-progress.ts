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

import { reviewAttempts } from './review-attempts'
import { trackGroupProblems } from './track-group-problems'

export const trackProblemProgress = sqliteTable(
  'track_problem_progress',
  {
    trackId: text('track_id').notNull(),
    problemSlug: text('problem_slug').notNull(),
    reviewAttemptId: text('review_attempt_id').references(
      () => reviewAttempts.id,
      {
        onDelete: 'set null',
      },
    ),
    completedAt: integer('completed_at'),
    completedRating: text('completed_rating'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.trackId, table.problemSlug] }),
    foreignKey({
      name: 'track_problem_progress_membership_fk',
      columns: [table.trackId, table.problemSlug],
      foreignColumns: [
        trackGroupProblems.trackId,
        trackGroupProblems.problemSlug,
      ],
    }).onDelete('cascade'),
    check(
      'track_problem_progress_completion_pair_check',
      sql`((${table.completedAt} is null and ${table.completedRating} is null) or (${table.completedAt} is not null and ${table.completedRating} is not null and ${table.completedRating} in ('hard', 'good', 'easy')))`,
    ),
    index('track_problem_progress_review_attempt_idx').on(
      table.reviewAttemptId,
    ),
    index('track_problem_progress_problem_slug_idx').on(table.problemSlug),
  ],
)

export const trackProblemProgressRelations = relations(
  trackProblemProgress,
  ({ one }) => ({
    membership: one(trackGroupProblems, {
      fields: [trackProblemProgress.trackId, trackProblemProgress.problemSlug],
      references: [trackGroupProblems.trackId, trackGroupProblems.problemSlug],
    }),
    reviewAttempt: one(reviewAttempts, {
      fields: [trackProblemProgress.reviewAttemptId],
      references: [reviewAttempts.id],
    }),
  }),
)

export type TrackProblemProgressRow = typeof trackProblemProgress.$inferSelect
