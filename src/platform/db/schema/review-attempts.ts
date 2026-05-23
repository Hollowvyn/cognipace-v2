import { relations } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { fsrsCards } from './fsrs-cards'
import { problemPractice } from './problem-practice'
import { problems } from './problems'

export const reviewAttempts = sqliteTable(
  'review_attempts',
  {
    id: text('id').primaryKey(),
    problemSlug: text('problem_slug')
      .notNull()
      .references(() => problems.slug, { onDelete: 'cascade' }),
    cardId: text('card_id')
      .notNull()
      .references(() => fsrsCards.id, { onDelete: 'cascade' }),
    rating: text('rating').notNull(),
    reviewMode: text('review_mode').notNull(),
    reviewedAt: integer('reviewed_at').notNull(),
    elapsedSeconds: integer('elapsed_seconds'),
    isCorrect: integer('is_correct', { mode: 'boolean' }),
    interviewPattern: text('interview_pattern'),
    timeComplexity: text('time_complexity'),
    spaceComplexity: text('space_complexity'),
    languages: text('languages'),
    notes: text('notes'),
    fsrsReviewLog: text('fsrs_review_log'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull().default(0),
  },
  (table) => [
    index('review_attempts_problem_slug_idx').on(table.problemSlug),
    index('review_attempts_card_idx').on(table.cardId),
    index('review_attempts_reviewed_at_idx').on(table.reviewedAt),
  ],
)

export const reviewAttemptsRelations = relations(reviewAttempts, ({ one }) => ({
  problem: one(problems, {
    fields: [reviewAttempts.problemSlug],
    references: [problems.slug],
  }),
  practice: one(problemPractice, {
    fields: [reviewAttempts.problemSlug],
    references: [problemPractice.problemSlug],
  }),
  card: one(fsrsCards, {
    fields: [reviewAttempts.cardId],
    references: [fsrsCards.id],
  }),
}))

export type ReviewAttemptRow = typeof reviewAttempts.$inferSelect
