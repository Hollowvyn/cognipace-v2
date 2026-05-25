export type TrackTargetStatusKind =
  | 'none'
  | 'upcoming'
  | 'due-today'
  | 'overdue'
  | 'complete'

export type TrackTargetStatusTone = 'neutral' | 'success' | 'warning' | 'danger'

export interface TrackTargetProgress {
  completedCount: number
  totalCount: number
  percent: number
}

export interface TrackTargetStatusInput {
  dueAt: Date | string | null | undefined
  generatedAt?: Date | string | undefined
  progress: TrackTargetProgress
}

export interface TrackTargetStatus {
  hasTarget: boolean
  kind: TrackTargetStatusKind
  dateLabel: string | null
  compactDateLabel: string | null
  statusLabel: string | null
  detailLabel: string | null
  catalogLabel: string | null
  popupLabel: string | null
  daysDelta: number | null
  tone: TrackTargetStatusTone
}

const dayMs = 24 * 60 * 60 * 1000

const monthLabels = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

export function getTrackTargetStatus({
  dueAt,
  generatedAt,
  progress,
}: TrackTargetStatusInput): TrackTargetStatus {
  const dueDateKey = toDateInputValue(dueAt)

  if (!dueDateKey) {
    return {
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
    }
  }

  const todayDateKey = getTodayDateInputValue(generatedAt)
  const daysDelta = diffDateKeysInDays(dueDateKey, todayDateKey)
  const dateLabel = formatDateLabel(dueDateKey)
  const compactDateLabel = formatCompactDateLabel(dueDateKey)

  if (isComplete(progress)) {
    return {
      catalogLabel: `Target ${compactDateLabel} · Complete`,
      compactDateLabel,
      dateLabel,
      daysDelta,
      detailLabel: null,
      hasTarget: true,
      kind: 'complete',
      popupLabel: 'Complete',
      statusLabel: 'Complete',
      tone: 'success',
    }
  }

  if (daysDelta === 0) {
    return {
      catalogLabel: `Target ${compactDateLabel} · Due today`,
      compactDateLabel,
      dateLabel,
      daysDelta,
      detailLabel: null,
      hasTarget: true,
      kind: 'due-today',
      popupLabel: 'Due today',
      statusLabel: 'Due today',
      tone: 'warning',
    }
  }

  if (daysDelta < 0) {
    const daysLate = Math.abs(daysDelta)
    const detailLabel = `${daysLate} ${pluralizeDay(daysLate)} late`

    return {
      catalogLabel: `Target ${compactDateLabel} · Overdue · ${detailLabel}`,
      compactDateLabel,
      dateLabel,
      daysDelta,
      detailLabel,
      hasTarget: true,
      kind: 'overdue',
      popupLabel: 'Overdue',
      statusLabel: 'Overdue',
      tone: 'danger',
    }
  }

  const label = `${daysDelta} ${pluralizeDay(daysDelta)} left`

  return {
    catalogLabel: `Target ${compactDateLabel} · ${label}`,
    compactDateLabel,
    dateLabel,
    daysDelta,
    detailLabel: null,
    hasTarget: true,
    kind: 'upcoming',
    popupLabel: label,
    statusLabel: label,
    tone: 'success',
  }
}

export function getTodayDateInputValue(now: Date | string = new Date()): string {
  if (now instanceof Date) {
    return toLocalDateInputValue(now) || toLocalDateInputValue(new Date())
  }

  return toDateInputValue(now) || toLocalDateInputValue(new Date())
}

export function isPastDateInputValue(
  value: Date | string | null | undefined,
  now: Date | string = new Date(),
): boolean {
  const dateKey = toDateInputValue(value)

  if (!dateKey) {
    return false
  }

  return diffDateKeysInDays(dateKey, getTodayDateInputValue(now)) < 0
}

export function getDateInputMin(
  currentValue: Date | string | null | undefined,
  initialValue: Date | string | null | undefined,
  now: Date | string = new Date(),
): string | undefined {
  const currentDateKey = toDateInputValue(currentValue)
  const initialDateKey = toDateInputValue(initialValue)

  if (
    currentDateKey &&
    initialDateKey &&
    currentDateKey === initialDateKey &&
    isPastDateInputValue(initialDateKey, now)
  ) {
    return undefined
  }

  return getTodayDateInputValue(now)
}

export function toDateInputValue(
  value: Date | string | null | undefined,
): string {
  if (!value) {
    return ''
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return ''
    }

    return value.toISOString().slice(0, 10)
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)

  if (!match) {
    return ''
  }

  return `${match[1]}-${match[2]}-${match[3]}`
}

function isComplete(progress: TrackTargetProgress): boolean {
  return (
    progress.totalCount > 0 &&
    (progress.percent === 100 ||
      progress.completedCount === progress.totalCount)
  )
}

function diffDateKeysInDays(leftDateKey: string, rightDateKey: string): number {
  return Math.round(
    (dateKeyToUtcTime(leftDateKey) - dateKeyToUtcTime(rightDateKey)) / dayMs,
  )
}

function dateKeyToUtcTime(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number)

  return Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1)
}

function toLocalDateInputValue(value: Date): string {
  if (Number.isNaN(value.getTime())) {
    return ''
  }

  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function formatDateLabel(dateKey: string): string {
  const { day, month, year } = parseDateKey(dateKey)

  return `${monthLabels[month - 1]} ${day}, ${year}`
}

function formatCompactDateLabel(dateKey: string): string {
  const { day, month } = parseDateKey(dateKey)

  return `${monthLabels[month - 1]} ${day}`
}

function parseDateKey(dateKey: string): {
  day: number
  month: number
  year: number
} {
  const [year, month, day] = dateKey.split('-').map(Number)

  return {
    day: day ?? 1,
    month: month ?? 1,
    year: year ?? 0,
  }
}

function pluralizeDay(count: number): string {
  return count === 1 ? 'day' : 'days'
}
