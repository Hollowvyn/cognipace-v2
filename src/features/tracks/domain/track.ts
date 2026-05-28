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

export interface TrackCatalogItem {
  track: Track
  progress: TrackProgress
  isActive: boolean
  activeGroupId: string | null
}

export interface TrackSessionState {
  activeTrack: Track | null
  activeGroup: TrackGroup | null
  startedAt: Date
  updatedAt: Date
}

export type TrackCompletedRating = 'good' | 'easy'

export interface TrackProblemMembership {
  trackId: string
  groupId: string
  groupTitle: string
  groupPosition: number
  problemSlug: string
  problemPosition: number
  completedAt: Date | null
  completedRating: TrackCompletedRating | null
}

export interface TrackProblemMembershipInput {
  problemSlug: string
}

export interface TrackGroupInput {
  id?: string | undefined
  title: string
  problemSlugs: string[]
}

export interface TrackMutationInput {
  title: string
  description: string | null
  dueAt: Date | string | null
  groups: TrackGroupInput[]
}

export type CreateTrackInput = TrackMutationInput

export interface UpdateTrackInput extends TrackMutationInput {
  trackId: string
}

export interface TrackCompletionInput {
  problemSlug: string
  rating: string
  completedAt?: Date | undefined
}

export interface ActiveTrack {
  track: Track
  activeGroup: TrackGroup | null
  progress: TrackProgress
  nextProblem: Problem | null
}
