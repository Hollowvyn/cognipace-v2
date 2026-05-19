import type { Problem } from '@/features/problems'

export interface Track {
  id: string
  slug: string
  title: string
  description: string | null
  isActive: boolean
}

export interface TrackGroup {
  id: string
  trackId: string
  title: string
  position: number
}

export interface ActiveTrack {
  track: Track
  activeGroup: TrackGroup | null
  nextProblem: Problem | null
}
