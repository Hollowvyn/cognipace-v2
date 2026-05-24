import type { Problem } from '@/features/problems'

export interface Track {
  id: string
  slug: string
  title: string
  description: string | null
  dueAt: Date | null
}

export interface TrackGroup {
  id: string
  trackId: string
  title: string
  position: number
}

export interface TrackProgress {
  completedCount: number
  totalCount: number
  percent: number
}

export interface ActiveTrack {
  track: Track
  activeGroup: TrackGroup | null
  progress: TrackProgress
  nextProblem: Problem | null
}
