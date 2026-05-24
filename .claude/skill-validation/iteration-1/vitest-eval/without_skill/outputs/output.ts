import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { trackSession, tracks } from '@/platform/db/schema'
import { createTestDb } from '@/platform/db/test-db'
import { updateSettings } from '@/features/settings/server/settings-service'

import {
  deleteTrack,
  getActiveTrack,
  setActiveTrack,
} from '@/features/tracks/server/tracks-service'

describe('TracksService', () => {
  describe('getActiveTrack', () => {
    it('delegates to the repository and returns the active track', async () => {
      const handle = await createTestDb({
        now: new Date('2026-01-01T00:00:00.000Z'),
      })

      const activeTrack = await getActiveTrack(handle.db)

      expect(activeTrack).toMatchObject({
        track: {
          id: 'leetcode-75',
          title: 'LeetCode 75',
        },
        activeGroup: {
          title: 'Arrays and Hashing',
        },
        progress: {
          completedCount: 0,
          totalCount: 1,
          percent: 0,
        },
        nextProblem: {
          slug: 'two-sum',
        },
      })
    })

    it('returns null when there is no active track in the session', async () => {
      const handle = await createTestDb({
        now: new Date('2026-01-01T00:00:00.000Z'),
      })

      await handle.db
        .update(trackSession)
        .set({ activeTrackId: null, activeGroupId: null })
        .where(eq(trackSession.id, 'active'))

      const activeTrack = await getActiveTrack(handle.db)

      expect(activeTrack).toBeNull()
    })

    it('returns null when practice mode is freePractice regardless of session state', async () => {
      const handle = await createTestDb({
        now: new Date('2026-01-01T00:00:00.000Z'),
      })

      await updateSettings(handle.db, { practice: { mode: 'freePractice' } })

      const activeTrack = await getActiveTrack(handle.db)

      expect(activeTrack).toBeNull()
    })
  })

  describe('setActiveTrack', () => {
    it('sets the active track and updates the session', async () => {
      const handle = await createTestDb({
        now: new Date('2026-01-01T00:00:00.000Z'),
      })

      await setActiveTrack(handle.db, { trackId: 'grind-75' })

      const sessionRows = await handle.db.select().from(trackSession)

      expect(sessionRows).toMatchObject([
        {
          activeTrackId: 'grind-75',
        },
      ])
    })

    it('returns the updated active track after setting it', async () => {
      const handle = await createTestDb({
        now: new Date('2026-01-01T00:00:00.000Z'),
      })

      await setActiveTrack(handle.db, { trackId: 'grind-75' })

      const activeTrack = await getActiveTrack(handle.db)

      expect(activeTrack).toMatchObject({
        track: {
          id: 'grind-75',
          title: 'Grind 75',
        },
      })
    })
  })

  describe('deleteTrack', () => {
    it('removes the track from the database', async () => {
      const handle = await createTestDb({
        now: new Date('2026-01-01T00:00:00.000Z'),
      })

      await deleteTrack(handle.db, { trackId: 'grind-75' })

      const trackRows = await handle.db.select().from(tracks)

      expect(trackRows.map((track) => track.id)).toEqual(['leetcode-75'])
    })

    it('clears the session when deleting the active track', async () => {
      const handle = await createTestDb({
        now: new Date('2026-01-01T00:00:00.000Z'),
      })

      await deleteTrack(handle.db, { trackId: 'leetcode-75' })

      const sessionRows = await handle.db.select().from(trackSession)

      expect(sessionRows).toMatchObject([
        {
          activeTrackId: null,
          activeGroupId: null,
        },
      ])
    })

    it('throws when deleting a track that does not exist', async () => {
      const handle = await createTestDb({
        now: new Date('2026-01-01T00:00:00.000Z'),
      })

      await expect(
        deleteTrack(handle.db, { trackId: 'nonexistent-track' }),
      ).rejects.toThrow(/nonexistent-track/)
    })
  })
})
