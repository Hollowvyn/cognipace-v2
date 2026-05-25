import { describe, expect, it } from 'vitest'

import {
  deriveTrackTargetStatus,
  getDateInputMin,
  getTodayDateInputValue,
  isPastDateInputValue,
  toDateInputValue,
} from './track-target-status'

const generatedAt = '2026-05-25T16:30:00.000Z'

function progress(
  overrides: Partial<{
    completedCount: number
    percent: number
    totalCount: number
  }> = {},
) {
  return {
    completedCount: overrides.completedCount ?? 0,
    percent: overrides.percent ?? 0,
    totalCount: overrides.totalCount ?? 10,
  }
}

describe('deriveTrackTargetStatus', () => {
  it('returns none when there is no target date', () => {
    expect(
      deriveTrackTargetStatus({
        dueAt: null,
        generatedAt,
        progress: progress(),
      }),
    ).toMatchObject({
      compactDateLabel: 'No target',
      dateLabel: 'No target date',
      daysDelta: null,
      hasTarget: false,
      kind: 'none',
      tone: 'neutral',
    })
  })

  it('returns upcoming when the target date is in the future', () => {
    expect(
      deriveTrackTargetStatus({
        dueAt: '2026-06-15T00:00:00.000Z',
        generatedAt,
        progress: progress(),
      }),
    ).toEqual({
      catalogLabel: 'Due Jun 15',
      compactDateLabel: 'Jun 15',
      dateLabel: 'Jun 15, 2026',
      daysDelta: 21,
      detailLabel: 'Target date is Jun 15, 2026.',
      hasTarget: true,
      kind: 'upcoming',
      popupLabel: '21 days left',
      statusLabel: '21 days left',
      tone: 'neutral',
    })
  })

  it('returns due today when the target date matches the generated date', () => {
    expect(
      deriveTrackTargetStatus({
        dueAt: '2026-05-25T00:00:00.000Z',
        generatedAt,
        progress: progress(),
      }),
    ).toMatchObject({
      daysDelta: 0,
      detailLabel: 'Target date is today.',
      kind: 'due-today',
      popupLabel: 'Due today',
      statusLabel: 'Due today',
      tone: 'warning',
    })
  })

  it('returns overdue when the target date is in the past', () => {
    expect(
      deriveTrackTargetStatus({
        dueAt: '2026-05-21T00:00:00.000Z',
        generatedAt,
        progress: progress(),
      }),
    ).toMatchObject({
      daysDelta: -4,
      detailLabel: 'Target date was 4 days ago.',
      kind: 'overdue',
      popupLabel: '4 days late',
      statusLabel: '4 days late',
      tone: 'danger',
    })
  })

  it('returns complete for a finished track even when the target date is overdue', () => {
    expect(
      deriveTrackTargetStatus({
        dueAt: '2026-05-21T00:00:00.000Z',
        generatedAt,
        progress: progress({ completedCount: 9, percent: 100, totalCount: 10 }),
      }),
    ).toMatchObject({
      daysDelta: -4,
      detailLabel: 'Track completed by the target date.',
      kind: 'complete',
      popupLabel: 'Complete',
      statusLabel: 'Complete',
      tone: 'success',
    })
  })

  it('does not treat a zero-total track as complete', () => {
    expect(
      deriveTrackTargetStatus({
        dueAt: '2026-05-21T00:00:00.000Z',
        generatedAt,
        progress: progress({ completedCount: 0, percent: 0, totalCount: 0 }),
      }),
    ).toMatchObject({
      kind: 'overdue',
      statusLabel: '4 days late',
      tone: 'danger',
    })
  })

  it('compares UTC-midnight persisted dates by date key instead of timestamp', () => {
    expect(
      deriveTrackTargetStatus({
        dueAt: '2026-05-25T00:00:00.000Z',
        generatedAt: '2026-05-25T23:59:59.000Z',
        progress: progress(),
      }),
    ).toMatchObject({
      daysDelta: 0,
      kind: 'due-today',
      statusLabel: 'Due today',
    })
  })
})

describe('date input helpers', () => {
  it('formats today, parses input values, and detects past dates by date key', () => {
    expect(getTodayDateInputValue(generatedAt)).toBe('2026-05-25')
    expect(toDateInputValue('2026-06-15T00:00:00.000Z')).toBe('2026-06-15')
    expect(toDateInputValue(null)).toBe('')
    expect(isPastDateInputValue('2026-05-24', generatedAt)).toBe(true)
    expect(isPastDateInputValue('2026-05-25', generatedAt)).toBe(false)
    expect(isPastDateInputValue('2026-05-26', generatedAt)).toBe(false)
  })

  it('allows an existing saved past date to remain the date input minimum', () => {
    expect(getDateInputMin('', null, generatedAt)).toBe('2026-05-25')
    expect(getDateInputMin('2026-05-21', '2026-05-21', generatedAt)).toBe(
      '2026-05-21',
    )
    expect(getDateInputMin('2026-05-22', '2026-05-21', generatedAt)).toBe(
      '2026-05-25',
    )
  })
})
