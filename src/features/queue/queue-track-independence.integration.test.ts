import { describe, expect, it } from 'vitest'

import { getTodayQueue } from '@/features/queue/server/queue-service'
import { createTracksRepository } from '@/features/tracks/data/tracks-repository'
import { createTestDb } from '@/platform/db/test-db'

describe('queue track independence', () => {
  it('returns the same queue counts and items regardless of active track state', async () => {
    const handle = await createTestDb()
    const now = new Date('2026-01-01T12:00:00.000Z')

    // The seeded DB has an active track (ByteByteGo) by default.
    const withTrack = await getTodayQueue(handle.db, now)

    // Deactivate the track — simulates a user with no active track selected.
    await createTracksRepository(handle.db).clearActiveTrack(now)

    const withoutTrack = await getTodayQueue(handle.db, now)

    // Queue counts and order must be identical — track state must not influence them.
    expect(withoutTrack.dueCount).toBe(withTrack.dueCount)
    expect(withoutTrack.newCount).toBe(withTrack.newCount)
    expect(withoutTrack.reinforcementCount).toBe(withTrack.reinforcementCount)
    expect(withoutTrack.excludedCount).toBe(withTrack.excludedCount)
    expect(withoutTrack.items.map((i) => i.problemSlug)).toEqual(
      withTrack.items.map((i) => i.problemSlug),
    )
  })
})
