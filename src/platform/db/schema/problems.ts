import { relations, sql } from 'drizzle-orm'
import { check, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { problemDifficulties } from '@/lib/problem-catalog'

import { problemCompanies } from './problem-companies'
import { problemPractice } from './problem-practice'
import { problemTopics } from './problem-topics'
import { trackGroupProblems } from './track-group-problems'

export const problems = sqliteTable(
  'problems',
  {
    slug: text('slug').primaryKey(),
    title: text('title').notNull(),
    difficulty: text('difficulty', { enum: problemDifficulties }).notNull(),
    isPremium: integer('is_premium', { mode: 'boolean' })
      .notNull()
      .default(false),
    isUserCreated: integer('is_user_created', { mode: 'boolean' })
      .notNull()
      .default(false),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    check(
      'problems_difficulty_check',
      sql`${table.difficulty} in ('easy', 'medium', 'hard', 'unknown')`,
    ),
  ],
)

export const problemsRelations = relations(problems, ({ many, one }) => ({
  topics: many(problemTopics),
  companies: many(problemCompanies),
  practice: one(problemPractice, {
    fields: [problems.slug],
    references: [problemPractice.problemSlug],
  }),
  trackMemberships: many(trackGroupProblems),
}))

export type ProblemRow = typeof problems.$inferSelect
export type InsertProblemRow = typeof problems.$inferInsert
