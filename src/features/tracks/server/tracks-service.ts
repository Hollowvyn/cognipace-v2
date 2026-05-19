import type { Db } from '@/platform/db'

import { createTracksRepository } from '../data/tracks-repository'

export function getActiveTrack(db: Db) {
  return createTracksRepository(db).getActiveTrack()
}
