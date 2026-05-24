import { serializeProblem } from '@/features/problems/api/problems-serializers'

import type { ActiveTrack, Track, TrackGroup, TrackProgress } from '../domain'
import {
  serializedActiveTrackSchema,
  serializedTrackGroupSchema,
  serializedTrackProgressSchema,
  serializedTrackSchema,
  type SerializedActiveTrack,
  type SerializedTrack,
  type SerializedTrackGroup,
  type SerializedTrackProgress,
} from './tracks-contracts'

export function serializeTrack(track: Track): SerializedTrack {
  return serializedTrackSchema.parse({
    ...track,
    dueAt: track.dueAt?.toISOString() ?? null,
  })
}

export function serializeTrackGroup(group: TrackGroup): SerializedTrackGroup {
  return serializedTrackGroupSchema.parse(group)
}

export function serializeTrackProgress(
  progress: TrackProgress,
): SerializedTrackProgress {
  return serializedTrackProgressSchema.parse(progress)
}

export function serializeActiveTrack(
  activeTrack: ActiveTrack | null,
): SerializedActiveTrack {
  return serializedActiveTrackSchema.parse(
    activeTrack
      ? {
          track: serializeTrack(activeTrack.track),
          activeGroup: activeTrack.activeGroup
            ? serializeTrackGroup(activeTrack.activeGroup)
            : null,
          progress: serializeTrackProgress(activeTrack.progress),
          nextProblem: activeTrack.nextProblem
            ? serializeProblem(activeTrack.nextProblem)
            : null,
        }
      : null,
  )
}
