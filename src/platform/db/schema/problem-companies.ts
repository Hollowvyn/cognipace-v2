import { relations } from 'drizzle-orm'
import { index, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { companies } from './companies'
import { problems } from './problems'

export const problemCompanies = sqliteTable(
  'problem_companies',
  {
    problemSlug: text('problem_slug')
      .notNull()
      .references(() => problems.slug, { onDelete: 'cascade' }),
    companyId: text('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.problemSlug, table.companyId] }),
    index('problem_companies_company_idx').on(table.companyId),
  ],
)

export const problemCompaniesRelations = relations(
  problemCompanies,
  ({ one }) => ({
    problem: one(problems, {
      fields: [problemCompanies.problemSlug],
      references: [problems.slug],
    }),
    company: one(companies, {
      fields: [problemCompanies.companyId],
      references: [companies.id],
    }),
  }),
)
