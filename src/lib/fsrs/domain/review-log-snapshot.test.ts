import { describe, expect, it } from 'vitest'

import {
  isFsrsReviewLogSnapshot,
  parseFsrsReviewLogSnapshot,
  parseSerializedFsrsReviewLogSnapshot,
  serializeFsrsReviewLogSnapshot,
  type FsrsReviewLogSnapshot,
} from './review-log-snapshot'

describe('FSRS review log snapshot contracts', () => {
  it('serializes and parses stored review logs through a typed boundary', () => {
    const log = createReviewLogSnapshot()
    const serialized = serializeFsrsReviewLogSnapshot(log)

    expect(parseSerializedFsrsReviewLogSnapshot(serialized)).toEqual(log)
    expect(parseFsrsReviewLogSnapshot(JSON.parse(serialized))).toEqual(log)
    expect(isFsrsReviewLogSnapshot(log)).toBe(true)
  })

  it('rejects malformed review log snapshots', () => {
    const log = createReviewLogSnapshot()

    for (const malformedLog of [
      { ...log, rating: 'manual' },
      { ...log, reviewedAt: '2026-01-01' },
    ]) {
      expect(isFsrsReviewLogSnapshot(malformedLog)).toBe(false)
    }

    expect(() =>
      parseFsrsReviewLogSnapshot({ ...log, stability: Number.NaN }),
    ).toThrow('Invalid FSRS review log snapshot.')
  })
})

function createReviewLogSnapshot(): FsrsReviewLogSnapshot {
  return {
    rating: 'good',
    state: 'learning',
    dueAt: '2026-01-02T09:00:00.000Z',
    stability: 0.5,
    difficulty: 5,
    elapsedDays: 0,
    lastElapsedDays: 0,
    scheduledDays: 1,
    learningSteps: 1,
    reviewedAt: '2026-01-01T10:00:00.000Z',
  }
}
