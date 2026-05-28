import { relations } from 'drizzle-orm'
import {
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

import { problems } from './problems'
import { trackGroups } from './track-groups'
import { tracks } from './tracks'

export const trackGroupProblems = sqliteTable(
  'track_group_problems',
  {
    trackGroupId: text('track_group_id').notNull(),
    trackId: text('track_id')
      .notNull()
      .references(() => tracks.id, { onDelete: 'cascade' }),
    problemSlug: text('problem_slug')
      .notNull()
      .references(() => problems.slug, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.trackGroupId, table.problemSlug] }),
    foreignKey({
      name: 'track_group_problems_group_track_fk',
      columns: [table.trackGroupId, table.trackId],
      foreignColumns: [trackGroups.id, trackGroups.trackId],
    }).onDelete('cascade'),
    uniqueIndex('track_group_problems_track_problem_unique').on(
      table.trackId,
      table.problemSlug,
    ),
    index('track_group_problems_track_idx').on(table.trackId),
    index('track_group_problems_problem_slug_idx').on(table.problemSlug),
  ],
)

export const trackGroupProblemsRelations = relations(
  trackGroupProblems,
  ({ one }) => ({
    group: one(trackGroups, {
      fields: [trackGroupProblems.trackGroupId, trackGroupProblems.trackId],
      references: [trackGroups.id, trackGroups.trackId],
    }),
    track: one(tracks, {
      fields: [trackGroupProblems.trackId],
      references: [tracks.id],
    }),
    problem: one(problems, {
      fields: [trackGroupProblems.problemSlug],
      references: [problems.slug],
    }),
  }),
)
