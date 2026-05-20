import { relations } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { fsrsCards } from './fsrs-cards'
import { problems } from './problems'
import { reviewAttempts } from './review-attempts'

export const problemPractice = sqliteTable(
  'problem_practice',
  {
    problemId: text('problem_id')
      .primaryKey()
      .references(() => problems.id, { onDelete: 'cascade' }),
    status: text('status').notNull(),
    firstSeenAt: integer('first_seen_at').notNull(),
    lastSeenAt: integer('last_seen_at'),
    lastReviewedAt: integer('last_reviewed_at'),
    lastRating: text('last_rating'),
    lastElapsedSeconds: integer('last_elapsed_seconds'),
    bestElapsedSeconds: integer('best_elapsed_seconds'),
    interviewPattern: text('interview_pattern'),
    timeComplexity: text('time_complexity'),
    spaceComplexity: text('space_complexity'),
    languages: text('languages'),
    notes: text('notes'),
    solvedCount: integer('solved_count').notNull().default(0),
    attemptCount: integer('attempt_count').notNull().default(0),
    isSuspended: integer('is_suspended', { mode: 'boolean' })
      .notNull()
      .default(false),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    index('problem_practice_status_idx').on(table.status),
    index('problem_practice_last_reviewed_idx').on(table.lastReviewedAt),
    index('problem_practice_suspended_idx').on(table.isSuspended),
  ],
)

export const problemPracticeRelations = relations(
  problemPractice,
  ({ many, one }) => ({
    problem: one(problems, {
      fields: [problemPractice.problemId],
      references: [problems.id],
    }),
    fsrsCards: many(fsrsCards),
    attempts: many(reviewAttempts),
  }),
)

export type ProblemPracticeRow = typeof problemPractice.$inferSelect
