import { relations } from 'drizzle-orm'
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core'

import { problemCompanies } from './problem-companies'
import { problemPractice } from './problem-practice'
import { problemTopics } from './problem-topics'
import { trackGroupProblems } from './track-group-problems'

export const problems = sqliteTable(
  'problems',
  {
    id: text('id').primaryKey(),
    source: text('source').notNull(),
    externalId: text('external_id'),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    difficulty: text('difficulty').notNull(),
    url: text('url').notNull(),
    isPremium: integer('is_premium', { mode: 'boolean' })
      .notNull()
      .default(false),
    acceptanceRate: real('acceptance_rate'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [index('problems_slug_idx').on(table.slug)],
)

export const problemsRelations = relations(problems, ({ many, one }) => ({
  topics: many(problemTopics),
  companies: many(problemCompanies),
  practice: one(problemPractice, {
    fields: [problems.id],
    references: [problemPractice.problemId],
  }),
  trackMemberships: many(trackGroupProblems),
}))

export type ProblemRow = typeof problems.$inferSelect
export type InsertProblemRow = typeof problems.$inferInsert
