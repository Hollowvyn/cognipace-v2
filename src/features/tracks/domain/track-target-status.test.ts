import { describe, expect, it } from 'vitest'

import {
  getDateInputMin,
  getTodayDateInputValue,
  getTrackTargetStatus,
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

describe('getTrackTargetStatus', () => {
  it('returns none when there is no target date', () => {
    expect(
      getTrackTargetStatus({
        dueAt: null,
        generatedAt,
        progress: progress(),
      }),
    ).toEqual({
      catalogLabel: null,
      compactDateLabel: null,
      dateLabel: null,
      daysDelta: null,
      detailLabel: null,
      hasTarget: false,
      kind: 'none',
      popupLabel: null,
      statusLabel: null,
      tone: 'neutral',
    })
  })

  it('returns upcoming when the target date is in the future', () => {
    expect(
      getTrackTargetStatus({
        dueAt: '2026-06-15T00:00:00.000Z',
        generatedAt,
        progress: progress(),
      }),
    ).toEqual({
      catalogLabel: 'Target Jun 15 · 21 days left',
      compactDateLabel: 'Jun 15',
      dateLabel: 'Jun 15, 2026',
      daysDelta: 21,
      detailLabel: null,
      hasTarget: true,
      kind: 'upcoming',
      popupLabel: '21 days left',
      statusLabel: '21 days left',
      tone: 'success',
    })
  })

  it('returns due today when the target date matches the generated date', () => {
    expect(
      getTrackTargetStatus({
        dueAt: '2026-05-25T00:00:00.000Z',
        generatedAt,
        progress: progress(),
      }),
    ).toMatchObject({
      catalogLabel: 'Target May 25 · Due today',
      daysDelta: 0,
      detailLabel: null,
      kind: 'due-today',
      popupLabel: 'Due today',
      statusLabel: 'Due today',
      tone: 'warning',
    })
  })

  it('returns overdue when the target date is in the past', () => {
    expect(
      getTrackTargetStatus({
        dueAt: '2026-05-21T00:00:00.000Z',
        generatedAt,
        progress: progress(),
      }),
    ).toMatchObject({
      catalogLabel: 'Target May 21 · Overdue · 4 days late',
      daysDelta: -4,
      detailLabel: '4 days late',
      kind: 'overdue',
      popupLabel: 'Overdue',
      statusLabel: 'Overdue',
      tone: 'danger',
    })
  })

  it('returns complete for a finished track even when the target date is overdue', () => {
    expect(
      getTrackTargetStatus({
        dueAt: '2026-05-21T00:00:00.000Z',
        generatedAt,
        progress: progress({ completedCount: 9, percent: 100, totalCount: 10 }),
      }),
    ).toMatchObject({
      catalogLabel: 'Target May 21 · Complete',
      daysDelta: -4,
      detailLabel: null,
      kind: 'complete',
      popupLabel: 'Complete',
      statusLabel: 'Complete',
      tone: 'success',
    })
  })

  it('does not treat a zero-total track as complete', () => {
    expect(
      getTrackTargetStatus({
        dueAt: '2026-05-21T00:00:00.000Z',
        generatedAt,
        progress: progress({ completedCount: 0, percent: 0, totalCount: 0 }),
      }),
    ).toMatchObject({
      kind: 'overdue',
      statusLabel: 'Overdue',
      tone: 'danger',
    })
  })

  it('compares UTC-midnight persisted dates by date key instead of timestamp', () => {
    expect(
      getTrackTargetStatus({
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

  it('leaves the date input minimum unset for an unchanged saved past date', () => {
    expect(getDateInputMin('', null, generatedAt)).toBe('2026-05-25')
    expect(
      getDateInputMin('2026-05-21', '2026-05-21', generatedAt),
    ).toBeUndefined()
    expect(getDateInputMin('2026-05-22', '2026-05-21', generatedAt)).toBe(
      '2026-05-25',
    )
  })

  it('uses the local calendar day for date input today', () => {
    const localEveningNow = new Date(2026, 4, 25, 22, 0, 0)

    expect(getTodayDateInputValue(localEveningNow)).toBe('2026-05-25')
    expect(isPastDateInputValue('2026-05-25', localEveningNow)).toBe(false)
    expect(isPastDateInputValue('2026-05-24', localEveningNow)).toBe(true)
    expect(getDateInputMin('', null, localEveningNow)).toBe('2026-05-25')
    expect(
      getDateInputMin('2026-05-24', '2026-05-24', localEveningNow),
    ).toBeUndefined()
  })
})
