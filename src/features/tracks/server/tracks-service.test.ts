import { describe, expect, it } from 'vitest'

import { createSettingsRepository } from '@/features/settings/data/settings-repository'
import { createTestDb } from '@/platform/db/test-db'

import { getActiveTrack } from './tracks-service'

describe('tracks service', () => {
  it('returns the active track in study-plan mode', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })

    const activeTrack = await getActiveTrack(handle.db)

    expect(activeTrack).toMatchObject({
      track: {
        id: 'leetcode-75',
      },
      nextProblem: {
        slug: 'two-sum',
      },
    })
  })

  it('returns null in free-practice mode', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })

    await createSettingsRepository(handle.db).updateSettings({
      practice: {
        mode: 'freePractice',
      },
    })

    await expect(getActiveTrack(handle.db)).resolves.toBeNull()
  })
})
