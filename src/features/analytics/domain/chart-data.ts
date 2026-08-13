import {
  createInitialFsrsCard,
  getRetrievability,
  isReviewRating,
  parseSerializedFsrsReviewLogSnapshot,
  scheduleReview,
  type FsrsCardSnapshot,
} from '@/lib/fsrs'

export interface AnalyticsReviewEvent {
  id: string
  cardId: string
  problemSlug: string
  title: string
  topicLabels: string[]
  rating: string
  reviewedAt: Date
  isCorrect: boolean | null
  fsrsReviewLog: string | null
}

export interface AnalyticsCurrentCard {
  slug: string
  title: string
  topics: string[]
  retrievability: number
  targetRetention: number
  stabilityDays: number
  difficulty: number
  lapseCount: number
  dueAt: Date
  lastReviewAt: Date | null
  suspended?: boolean
}

export interface AnalyticsOverdueSnapshot {
  date: Date
  overdueCount: number
}

export interface RecallQualityPoint {
  date: string
  observedRecall: number | null
  predictedRecall: number | null
  targetRetention: number
  reviewCount: number
  eligibleSampleSize: number
}

export interface ConsistencyPoint {
  week: string
  reviewDays: number
  firstPassRecall: number | null
  sampleSize: number
  associationOnly: true
}

export interface RatingsMixPoint {
  date: string
  again: number
  hard: number
  good: number
  easy: number
  total: number
  hardAgainShare: number | null
}

export interface TopicPoint {
  topic: string
  recallQuality: number | null
  sampleSize: number
  lowSample: boolean
}

export interface StabilityPoint {
  week: string
  medianStabilityDays: number | null
  sampleSize: number
}

export interface OverdueBacklogPoint {
  date: string
  overdueCount: number
  historyAvailable: boolean
}

export interface UpcomingLoadPoint {
  date: string
  dueCount: number
  overdueCount: number
  today: boolean
}

export interface RetentionHealthPoint {
  slug: string
  title: string
  retrievability: number
  targetRetention: number
  daysSinceReview: number
  stabilityDays: number
  difficulty: number
  lapseCount: number
  overdueDays: number
}

export interface FragileKnowledgeRow {
  slug: string
  title: string
  retrievability: number
  stabilityDays: number
  difficulty: number
  lapseCount: number
  overdueDays: number
  topics: string[]
}

export interface AnalyticsRangeOptions {
  start: Date
  end: Date
  targetRetention: number
  lowSampleThreshold?: number
}

const dayMs = 24 * 60 * 60 * 1000

export function toAnalyticsDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function toAnalyticsWeekKey(date: Date): string {
  const day = new Date(date)
  const dayOfWeek = day.getDay() || 7
  day.setDate(day.getDate() - dayOfWeek + 1)
  return toAnalyticsDateKey(day)
}

export function buildRecallQualityPoints(
  events: readonly AnalyticsReviewEvent[],
  options: AnalyticsRangeOptions,
): RecallQualityPoint[] {
  const points = dailyKeys(options).map((date) => ({
    date,
    observed: [] as boolean[],
    predicted: [] as number[],
    reviewCount: 0,
  }))
  const byDate = new Map(points.map((point) => [point.date, point]))
  for (const event of events) {
    const point = byDate.get(toAnalyticsDateKey(event.reviewedAt))
    if (
      !point ||
      event.reviewedAt < options.start ||
      event.reviewedAt > options.end
    )
      continue
    point.reviewCount += 1
    if (event.isCorrect !== null) point.observed.push(event.isCorrect)
  }
  for (const prediction of buildPredictedRecall(events, options)) {
    const point = byDate.get(prediction.date)
    if (point && prediction.value !== null)
      point.predicted.push(prediction.value)
  }
  return points.map((point) => ({
    date: point.date,
    observedRecall: ratio(
      point.observed.filter(Boolean).length,
      point.observed.length,
    ),
    predictedRecall: average(point.predicted),
    targetRetention: options.targetRetention,
    reviewCount: point.reviewCount,
    eligibleSampleSize: point.observed.length,
  }))
}

function buildPredictedRecall(
  events: readonly AnalyticsReviewEvent[],
  options: AnalyticsRangeOptions,
) {
  const results: Array<{ date: string; value: number }> = []
  const byCard = new Map<string, AnalyticsReviewEvent[]>()
  for (const event of events) {
    const history = byCard.get(event.cardId) ?? []
    history.push(event)
    byCard.set(event.cardId, history)
  }
  for (const history of byCard.values()) {
    let card: FsrsCardSnapshot | null = null
    for (const event of [...history].sort(compareEvents)) {
      if (!isReviewRating(event.rating)) continue
      card ??= createInitialFsrsCard(event.reviewedAt)
      const predicted = getRetrievability(card, event.reviewedAt)
      if (
        event.reviewedAt >= options.start &&
        event.reviewedAt <= options.end
      ) {
        results.push({
          date: toAnalyticsDateKey(event.reviewedAt),
          value: predicted,
        })
      }
      card = scheduleReview(card, event.rating, event.reviewedAt).card
    }
  }
  return results
}

export function buildConsistencyPoints(
  events: readonly AnalyticsReviewEvent[],
  options: AnalyticsRangeOptions,
): ConsistencyPoint[] {
  const weeks = new Map<string, { days: Set<string>; correct: boolean[] }>()
  for (const event of events) {
    if (event.reviewedAt < options.start || event.reviewedAt > options.end)
      continue
    const week = weeks.get(toAnalyticsWeekKey(event.reviewedAt)) ?? {
      days: new Set(),
      correct: [],
    }
    week.days.add(toAnalyticsDateKey(event.reviewedAt))
    if (event.isCorrect !== null) week.correct.push(event.isCorrect)
    weeks.set(toAnalyticsWeekKey(event.reviewedAt), week)
  }
  return [...weeks.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, value]) => ({
      week,
      reviewDays: value.days.size,
      firstPassRecall: ratio(
        value.correct.filter(Boolean).length,
        value.correct.length,
      ),
      sampleSize: value.correct.length,
      associationOnly: true,
    }))
}

export function buildRatingsMixPoints(
  events: readonly AnalyticsReviewEvent[],
  options: AnalyticsRangeOptions,
): RatingsMixPoint[] {
  return dailyKeys(options).map((date) => {
    const counts = { again: 0, hard: 0, good: 0, easy: 0 }
    for (const event of events)
      if (
        toAnalyticsDateKey(event.reviewedAt) === date &&
        isReviewRating(event.rating)
      )
        counts[event.rating] += 1
    const total = counts.again + counts.hard + counts.good + counts.easy
    return {
      date,
      ...counts,
      total,
      hardAgainShare: total === 0 ? null : (counts.again + counts.hard) / total,
    }
  })
}

export function buildTopicPoints(
  events: readonly AnalyticsReviewEvent[],
  options: AnalyticsRangeOptions,
): TopicPoint[] {
  const topics = new Map<string, boolean[]>()
  for (const event of events) {
    if (
      event.isCorrect === null ||
      event.reviewedAt < options.start ||
      event.reviewedAt > options.end
    )
      continue
    for (const topic of new Set(event.topicLabels))
      (topics.get(topic) ?? (topics.set(topic, []), topics.get(topic)!)).push(
        event.isCorrect,
      )
  }
  const threshold = options.lowSampleThreshold ?? 10
  return [...topics.entries()]
    .map(([topic, values]) => ({
      topic,
      recallQuality: ratio(values.filter(Boolean).length, values.length),
      sampleSize: values.length,
      lowSample: values.length < threshold,
    }))
    .sort(
      (a, b) =>
        (a.recallQuality ?? 2) - (b.recallQuality ?? 2) ||
        a.topic.localeCompare(b.topic),
    )
}

export function buildStabilityPoints(
  events: readonly AnalyticsReviewEvent[],
  options: AnalyticsRangeOptions,
): StabilityPoint[] {
  const grouped = new Map<string, number[]>()
  for (const event of events) {
    if (
      event.reviewedAt < options.start ||
      event.reviewedAt > options.end ||
      !event.fsrsReviewLog
    )
      continue
    const stability = parseValidStability(event.fsrsReviewLog)
    if (stability === null) continue
    const values = grouped.get(toAnalyticsWeekKey(event.reviewedAt)) ?? []
    values.push(stability)
    grouped.set(toAnalyticsWeekKey(event.reviewedAt), values)
  }
  return [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, values]) => ({
      week,
      medianStabilityDays: median(values),
      sampleSize: values.length,
    }))
}

export function buildOverdueBacklogPoints(
  snapshots: readonly AnalyticsOverdueSnapshot[] | null,
  options: AnalyticsRangeOptions,
): OverdueBacklogPoint[] {
  if (!snapshots?.length) return []
  const byDate = new Map(
    snapshots.map((snapshot) => [
      toAnalyticsDateKey(snapshot.date),
      snapshot.overdueCount,
    ]),
  )
  return dailyKeys(options).map((date) => ({
    date,
    overdueCount: byDate.get(date) ?? 0,
    historyAvailable: byDate.has(date),
  }))
}

export function buildUpcomingLoadPoints(
  dueDates: readonly Date[],
  now: Date,
): UpcomingLoadPoint[] {
  const points = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(now)
    date.setDate(date.getDate() + index)
    return {
      date: toAnalyticsDateKey(date),
      dueCount: 0,
      overdueCount: 0,
      today: index === 0,
    }
  })
  const todayKey = points[0]!.date
  for (const dueAt of dueDates) {
    if (dueAt < now) points[0]!.overdueCount += 1
    else {
      const point = points.find(
        (candidate) => candidate.date === toAnalyticsDateKey(dueAt),
      )
      if (point) point.dueCount += 1
    }
  }
  return points.map((point) => (point.date === todayKey ? point : point))
}

export function buildRetentionHealth(
  cards: readonly AnalyticsCurrentCard[],
  now: Date,
): { health: RetentionHealthPoint[]; fragile: FragileKnowledgeRow[] } {
  const rows = cards
    .filter((card) => !card.suspended && Number.isFinite(card.retrievability))
    .map((card) => {
      const daysSinceReview =
        card.lastReviewAt === null
          ? 0
          : Math.max(
              0,
              Math.floor((now.getTime() - card.lastReviewAt.getTime()) / dayMs),
            )
      const overdueDays = Math.max(
        0,
        Math.floor((now.getTime() - card.dueAt.getTime()) / dayMs),
      )
      return { card, daysSinceReview, overdueDays }
    })
  const health = rows
    .map(({ card, daysSinceReview, overdueDays }) => ({
      slug: card.slug,
      title: card.title,
      retrievability: card.retrievability,
      targetRetention: card.targetRetention,
      daysSinceReview,
      stabilityDays: card.stabilityDays,
      difficulty: card.difficulty,
      lapseCount: card.lapseCount,
      overdueDays,
    }))
    .sort(
      (a, b) =>
        a.retrievability - b.retrievability || a.slug.localeCompare(b.slug),
    )
  const fragile = health
    .filter(
      (row) =>
        row.retrievability < row.targetRetention ||
        row.stabilityDays < 3 ||
        row.lapseCount > 0 ||
        row.overdueDays > 0,
    )
    .map((row) => ({
      ...row,
      topics: cards.find((card) => card.slug === row.slug)?.topics ?? [],
    }))
    .sort(
      (a, b) =>
        a.retrievability - b.retrievability ||
        b.overdueDays - a.overdueDays ||
        a.slug.localeCompare(b.slug),
    )
  return { health, fragile }
}

function dailyKeys(options: AnalyticsRangeOptions): string[] {
  const keys: string[] = []
  const date = new Date(options.start)
  while (date <= options.end) {
    keys.push(toAnalyticsDateKey(date))
    date.setDate(date.getDate() + 1)
  }
  return keys
}
function compareEvents(
  a: AnalyticsReviewEvent,
  b: AnalyticsReviewEvent,
): number {
  return (
    a.reviewedAt.getTime() - b.reviewedAt.getTime() || a.id.localeCompare(b.id)
  )
}
function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator
}
function average(values: readonly number[]): number | null {
  return values.length === 0
    ? null
    : values.reduce((sum, value) => sum + value, 0) / values.length
}
function median(values: readonly number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2
}
function parseValidStability(serialized: string): number | null {
  try {
    return parseSerializedFsrsReviewLogSnapshot(serialized).stability
  } catch {
    return null
  }
}
