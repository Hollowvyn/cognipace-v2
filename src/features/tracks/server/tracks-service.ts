import type { Db } from '@/platform/db'

import { getSettings } from '@/features/settings/server/settings-service'

import { createTracksRepository } from '../data/tracks-repository'

export async function getActiveTrack(db: Db) {
  const settings = await getSettings(db)

  if (settings.practice.mode === 'freePractice') {
    return null
  }

  return createTracksRepository(db).getActiveTrack()
}
