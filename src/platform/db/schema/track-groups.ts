import { relations } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { trackGroupProblems } from './track-group-problems'
import { tracks } from './tracks'

export const trackGroups = sqliteTable(
  'track_groups',
  {
    id: text('id').primaryKey(),
    trackId: text('track_id')
      .notNull()
      .references(() => tracks.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    position: integer('position').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [index('track_groups_track_idx').on(table.trackId)],
)

export const trackGroupsRelations = relations(trackGroups, ({ many, one }) => ({
  track: one(tracks, {
    fields: [trackGroups.trackId],
    references: [tracks.id],
  }),
  problems: many(trackGroupProblems),
}))

export type TrackGroupRow = typeof trackGroups.$inferSelect
