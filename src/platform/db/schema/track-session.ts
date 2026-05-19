import { relations } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { trackGroups } from './track-groups'
import { tracks } from './tracks'

export const trackSession = sqliteTable('track_session', {
  id: text('id').primaryKey(),
  activeTrackId: text('active_track_id').references(() => tracks.id, {
    onDelete: 'set null',
  }),
  activeGroupId: text('active_group_id').references(() => trackGroups.id, {
    onDelete: 'set null',
  }),
  startedAt: integer('started_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const trackSessionRelations = relations(trackSession, ({ one }) => ({
  activeTrack: one(tracks, {
    fields: [trackSession.activeTrackId],
    references: [tracks.id],
  }),
  activeGroup: one(trackGroups, {
    fields: [trackSession.activeGroupId],
    references: [trackGroups.id],
  }),
}))
