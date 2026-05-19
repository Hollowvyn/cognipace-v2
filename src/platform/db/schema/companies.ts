import { relations } from 'drizzle-orm'
import { sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { problemCompanies } from './problem-companies'

export const companies = sqliteTable('companies', {
  id: text('id').primaryKey(),
  label: text('label').notNull().unique(),
})

export const companiesRelations = relations(companies, ({ many }) => ({
  problems: many(problemCompanies),
}))
