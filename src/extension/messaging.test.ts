import { describe, expect, expectTypeOf, it } from 'vitest'

import type {
  TrackImportRequest,
  TrackImportResult,
} from '@/features/tracks/api/tracks-contracts'

import { protocolMethodNames, sendMessage } from './messaging'

describe('extension messaging protocol', () => {
  it('exposes typed track import messaging', () => {
    const request = {
      surface: 'dashboard',
      file: {
        schemaVersion: 1,
        app: 'cognipace-track-import',
        problems: [],
        tracks: [
          {
            title: 'Interview Track',
            description: null,
            dueAt: null,
            groups: [{ title: 'Arrays', problemSlugs: ['two-sum'] }],
          },
        ],
      },
    } satisfies TrackImportRequest

    expect(protocolMethodNames).toContain('tracks.importTracks')
    const sendTrackImportMessage = () =>
      sendMessage('tracks.importTracks', request)

    expectTypeOf(
      sendTrackImportMessage,
    ).returns.toEqualTypeOf<Promise<TrackImportResult>>()
  })
})
