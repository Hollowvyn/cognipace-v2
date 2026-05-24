import { describe, expect, it } from 'vitest'

import { createSerializedActiveTrack } from '@/testing/track-fixtures'

import {
  serializedActiveTrackSchema,
  trackCompletedRatingSchema,
  tracksCreateTrackRequestSchema,
  tracksDeleteTrackRequestSchema,
  tracksGetWorkspaceRequestSchema,
  tracksResetTrackProgressRequestSchema,
  tracksSetActiveTrackRequestSchema,
  tracksUpdateTrackRequestSchema,
} from './tracks-contracts'

describe('tracks runtime contracts', () => {
  it('accepts a valid active track response without legacy active flags', () => {
    const parsed = serializedActiveTrackSchema.parse(
      createSerializedActiveTrack(),
    )

    expect(parsed?.track).not.toHaveProperty('isActive')
  })

  it('rejects progress with an inconsistent percent', () => {
    const response = createSerializedActiveTrack({
      progress: {
        completedCount: 1,
        totalCount: 2,
        percent: 99,
      },
    })

    expect(serializedActiveTrackSchema.safeParse(response).success).toBe(false)
  })

  it('only accepts dashboard workspace requests', () => {
    expect(
      tracksGetWorkspaceRequestSchema.safeParse({
        surface: 'dashboard',
      }).success,
    ).toBe(true)
    expect(
      tracksGetWorkspaceRequestSchema.safeParse({
        surface: 'popup',
      }).success,
    ).toBe(false)
  })

  it('rejects create and update requests without groups', () => {
    expect(
      tracksCreateTrackRequestSchema.safeParse({
        surface: 'dashboard',
        title: 'Interview Track',
        description: null,
        dueAt: null,
        groups: [],
      }).success,
    ).toBe(false)
    expect(
      tracksUpdateTrackRequestSchema.safeParse({
        surface: 'dashboard',
        trackId: 'leetcode-75',
        title: 'Interview Track',
        description: null,
        dueAt: null,
        groups: [],
      }).success,
    ).toBe(false)
  })

  it('only accepts completed ratings that can complete track progress', () => {
    expect(trackCompletedRatingSchema.safeParse('good').success).toBe(true)
    expect(trackCompletedRatingSchema.safeParse('easy').success).toBe(true)
    expect(trackCompletedRatingSchema.safeParse('again').success).toBe(false)
  })

  it('requires dashboard surface and a non-empty track id for active, delete, and reset requests', () => {
    for (const schema of [
      tracksSetActiveTrackRequestSchema,
      tracksDeleteTrackRequestSchema,
      tracksResetTrackProgressRequestSchema,
    ]) {
      expect(
        schema.safeParse({
          surface: 'dashboard',
          trackId: 'leetcode-75',
        }).success,
      ).toBe(true)
      expect(
        schema.safeParse({
          surface: 'popup',
          trackId: 'leetcode-75',
        }).success,
      ).toBe(false)
      expect(
        schema.safeParse({
          surface: 'dashboard',
          trackId: '',
        }).success,
      ).toBe(false)
    }
  })
})
