import { relations } from 'drizzle-orm'
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  unique,
} from 'drizzle-orm/sqlite-core'

import { problemPractice } from './problem-practice'
import { problems } from './problems'
import { reviewAttempts } from './review-attempts'

export const fsrsCards = sqliteTable(
  'fsrs_cards',
  {
    id: text('id').primaryKey(),
    problemSlug: text('problem_slug')
      .notNull()
      .references(() => problems.slug, { onDelete: 'cascade' }),
    cardKind: text('card_kind').notNull(),
    dueAt: integer('due_at').notNull(),
    stability: real('stability').notNull(),
    difficulty: real('difficulty').notNull(),
    elapsedDays: integer('elapsed_days').notNull(),
    scheduledDays: integer('scheduled_days').notNull(),
    learningSteps: integer('learning_steps').notNull(),
    reps: integer('reps').notNull(),
    lapses: integer('lapses').notNull(),
    state: text('state').notNull(),
    lastReviewAt: integer('last_review_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    index('fsrs_cards_due_idx').on(table.dueAt),
    unique('fsrs_cards_problem_slug_kind_unique').on(
      table.problemSlug,
      table.cardKind,
    ),
  ],
)

export const fsrsCardsRelations = relations(fsrsCards, ({ many, one }) => ({
  problem: one(problems, {
    fields: [fsrsCards.problemSlug],
    references: [problems.slug],
  }),
  practice: one(problemPractice, {
    fields: [fsrsCards.problemSlug],
    references: [problemPractice.problemSlug],
  }),
  attempts: many(reviewAttempts),
}))

export type FsrsCardRow = typeof fsrsCards.$inferSelect
export type InsertFsrsCardRow = typeof fsrsCards.$inferInsert
