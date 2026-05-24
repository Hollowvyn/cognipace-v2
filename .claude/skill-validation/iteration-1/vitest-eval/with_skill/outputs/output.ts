import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { settingsKv, trackSession, tracks } from '@/platform/db/schema'
import { createTestDb } from '@/platform/db/test-db'

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
          id: 'leetcode-75:arrays-hashing',
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

    it('returns null when no active track is set in the session', async () => {
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

    it('returns null when practice mode is freePractice', async () => {
      const handle = await createTestDb({
        now: new Date('2026-01-01T00:00:00.000Z'),
      })

      await handle.db
        .insert(settingsKv)
        .values({
          key: 'user-settings',
          value: JSON.stringify({
            schemaVersion: 1,
            practice: {
              dailyGoal: 5,
              mode: 'freePractice',
              problemFilters: { skipPremium: false },
            },
            review: { targetRetention: 0.9, order: 'dueFirst' },
            assessment: {
              requireSolveTime: false,
              strictTiming: false,
              timeTargetsMinutes: { easy: 15, medium: 30, hard: 45 },
            },
            overlay: { autoDetectSolved: true },
            reminders: { daily: { enabled: false, time: '09:00' } },
          }),
          updatedAt: new Date('2026-01-01T00:00:00.000Z').getTime(),
        })
        .onConflictDoUpdate({
          target: settingsKv.key,
          set: {
            value: JSON.stringify({
              schemaVersion: 1,
              practice: {
                dailyGoal: 5,
                mode: 'freePractice',
                problemFilters: { skipPremium: false },
              },
              review: { targetRetention: 0.9, order: 'dueFirst' },
              assessment: {
                requireSolveTime: false,
                strictTiming: false,
                timeTargetsMinutes: { easy: 15, medium: 30, hard: 45 },
              },
              overlay: { autoDetectSolved: true },
              reminders: { daily: { enabled: false, time: '09:00' } },
            }),
            updatedAt: new Date('2026-01-01T00:00:00.000Z').getTime(),
          },
        })

      const activeTrack = await getActiveTrack(handle.db)

      expect(activeTrack).toBeNull()
    })
  })

  describe('setActiveTrack', () => {
    it('sets the session active track and persists both ids', async () => {
      const handle = await createTestDb({
        now: new Date('2026-01-01T00:00:00.000Z'),
      })

      await setActiveTrack(handle.db, {
        surface: 'dashboard',
        trackId: 'grind-75',
      })

      const sessionRows = await handle.db.select().from(trackSession)

      expect(sessionRows).toMatchObject([
        {
          activeTrackId: 'grind-75',
          activeGroupId: 'grind-75:stack',
        },
      ])
    })

    it('returns the updated active track via getActiveTrack after setting it', async () => {
      const handle = await createTestDb({
        now: new Date('2026-01-01T00:00:00.000Z'),
      })

      await setActiveTrack(handle.db, {
        surface: 'dashboard',
        trackId: 'grind-75',
      })

      const activeTrack = await getActiveTrack(handle.db)

      expect(activeTrack).toMatchObject({
        track: {
          id: 'grind-75',
          title: 'Grind 75',
        },
        activeGroup: {
          id: 'grind-75:stack',
          title: 'Stack',
        },
      })
    })
  })

  describe('deleteTrack', () => {
    it('removes the track from the database', async () => {
      const handle = await createTestDb({
        now: new Date('2026-01-01T00:00:00.000Z'),
      })

      await deleteTrack(handle.db, {
        surface: 'dashboard',
        trackId: 'grind-75',
      })

      const trackRows = await handle.db.select().from(tracks)

      expect(trackRows.map((t) => t.id)).toEqual(['leetcode-75'])
    })

    it('clears the session when the active track is deleted', async () => {
      const handle = await createTestDb({
        now: new Date('2026-01-01T00:00:00.000Z'),
      })

      await deleteTrack(handle.db, {
        surface: 'dashboard',
        trackId: 'leetcode-75',
      })

      const sessionRows = await handle.db.select().from(trackSession)

      expect(sessionRows).toMatchObject([
        {
          activeTrackId: null,
          activeGroupId: null,
        },
      ])
    })

    it('returns null from getActiveTrack after the active track is deleted', async () => {
      const handle = await createTestDb({
        now: new Date('2026-01-01T00:00:00.000Z'),
      })

      await deleteTrack(handle.db, {
        surface: 'dashboard',
        trackId: 'leetcode-75',
      })

      const activeTrack = await getActiveTrack(handle.db)

      expect(activeTrack).toBeNull()
    })

    it('throws when the track does not exist', async () => {
      const handle = await createTestDb({
        now: new Date('2026-01-01T00:00:00.000Z'),
      })

      await expect(
        deleteTrack(handle.db, {
          surface: 'dashboard',
          trackId: 'non-existent-track',
        }),
      ).rejects.toThrow('non-existent-track')
    })
  })
})
