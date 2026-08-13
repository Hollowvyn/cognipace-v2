import {
  createInitialFsrsCard,
  getRetrievability,
  isReviewRating,
  parseSerializedFsrsReviewLogSnapshot,
  replayReviewHistorySequence,
  type NormalizedFsrsSchedulingOptions,
  type ReviewRating,
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
  cardId: string
  slug: string
  title: string
  topics: string[]
  retrievability: number
  targetRetention: number
  stabilityDays: number
  difficulty: number
  lapseCount: number
  dueAt: Date
  createdAt: Date
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

export interface PredictedRecallSample {
  date: string
  value: number
}

export interface ConsistencyPoint {
  week: string
  reviewDays: number
  observedCorrectness: number | null
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

export interface HardAgainSummary {
  selectedShare: number | null
  previousShare: number | null
  delta: number | null
  direction: 'up' | 'down' | 'flat' | null
  sampleSize: number
  previousSampleSize: number
  lowSample: boolean
  previousLowSample: boolean
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

export interface OverdueBacklogResult {
  points: OverdueBacklogPoint[]
  overdueHistoryAvailableFrom: string | null
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
  fsrsOptions: NormalizedFsrsSchedulingOptions
  lowSampleThreshold?: number
}

export interface RetentionHealthOptions {
  fragileDifficultyThreshold: number
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
  for (const prediction of buildPredictedRecallSamples(events, options)) {
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
    targetRetention: options.fsrsOptions.targetRetention,
    reviewCount: point.reviewCount,
    eligibleSampleSize: point.observed.length,
  }))
}

export function buildPredictedRecallSamples(
  events: readonly AnalyticsReviewEvent[],
  options: AnalyticsRangeOptions,
): PredictedRecallSample[] {
  const results: PredictedRecallSample[] = []
  const byCard = new Map<string, AnalyticsReviewEvent[]>()
  for (const event of events) {
    const history = byCard.get(event.cardId) ?? []
    history.push(event)
    byCard.set(event.cardId, history)
  }
  for (const history of byCard.values()) {
    const orderedHistory = history
      .filter(
        (event): event is AnalyticsReviewEvent & { rating: ReviewRating } =>
          isReviewRating(event.rating),
      )
      .sort(compareEvents)
    const replayedReviews = replayReviewHistorySequence(
      orderedHistory.map((event) => ({
        reviewedAt: event.reviewedAt,
        rating: event.rating,
      })),
      options.fsrsOptions,
    )

    for (const [index, event] of orderedHistory.entries()) {
      const card =
        replayedReviews[index - 1]?.card ??
        createInitialFsrsCard(event.reviewedAt)
      const predicted = getRetrievability(
        card,
        event.reviewedAt,
        options.fsrsOptions,
      )
      if (
        event.reviewedAt >= options.start &&
        event.reviewedAt <= options.end
      ) {
        results.push({
          date: toAnalyticsDateKey(event.reviewedAt),
          value: predicted,
        })
      }
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
      observedCorrectness: ratio(
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
        event.reviewedAt >= options.start &&
        event.reviewedAt <= options.end &&
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

export function buildHardAgainSummary(
  events: readonly AnalyticsReviewEvent[],
  options: AnalyticsRangeOptions,
  lowSampleThreshold = 10,
): HardAgainSummary {
  const periodLength = options.end.getTime() - options.start.getTime()
  const previousStart = new Date(options.start.getTime() - periodLength)
  const selectedRatings = events.filter(
    (event) =>
      event.reviewedAt >= options.start &&
      event.reviewedAt <= options.end &&
      isReviewRating(event.rating),
  )
  const previousRatings = events.filter(
    (event) =>
      event.reviewedAt >= previousStart &&
      event.reviewedAt < options.start &&
      isReviewRating(event.rating),
  )
  const selectedShare = calculateHardAgainShare(selectedRatings)
  const previousShare = calculateHardAgainShare(previousRatings)
  const lowSample = selectedRatings.length < lowSampleThreshold
  const previousLowSample = previousRatings.length < lowSampleThreshold
  const delta =
    lowSample ||
    previousLowSample ||
    selectedShare === null ||
    previousShare === null
      ? null
      : selectedShare - previousShare

  return {
    selectedShare: lowSample ? null : selectedShare,
    previousShare: previousLowSample ? null : previousShare,
    delta,
    direction:
      delta === null ? null : delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
    sampleSize: selectedRatings.length,
    previousSampleSize: previousRatings.length,
    lowSample,
    previousLowSample,
  }
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
): OverdueBacklogResult {
  const overdueHistoryAvailableFrom = snapshots?.length
    ? [...snapshots]
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .at(0)!
        .date.toISOString()
    : null

  if (!snapshots?.length) {
    return { points: [], overdueHistoryAvailableFrom }
  }
  const byDate = new Map(
    snapshots
      .filter(
        (snapshot) =>
          snapshot.date >= options.start && snapshot.date <= options.end,
      )
      .map((snapshot) => [toAnalyticsDateKey(snapshot.date), snapshot]),
  )

  return {
    points: [...byDate.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, snapshot]) => ({
        date,
        overdueCount: snapshot.overdueCount,
        historyAvailable: true,
      })),
    overdueHistoryAvailableFrom,
  }
}

export function reconstructOverdueBacklogSnapshots(
  events: readonly AnalyticsReviewEvent[],
  cards: readonly AnalyticsCurrentCard[],
  options: AnalyticsRangeOptions,
): AnalyticsOverdueSnapshot[] {
  const activeCards = cards.filter((card) => !card.suspended)
  if (activeCards.length === 0) return []

  const eventsByCard = new Map<string, AnalyticsReviewEvent[]>()
  for (const event of events) {
    const history = eventsByCard.get(event.cardId) ?? []
    history.push(event)
    eventsByCard.set(event.cardId, history)
  }

  const intervalsByCard = activeCards.map((card) => ({
    card,
    intervals: buildKnownOverdueIntervals(
      card,
      eventsByCard.get(card.cardId) ?? [],
      options.end,
    ),
  }))

  return dailyKeys(options).flatMap((date) => {
    const observationAt = observationDateForKey(date, options.end)
    let overdueCount = 0

    for (const { card, intervals } of intervalsByCard) {
      if (observationAt < card.createdAt) continue
      const interval = intervals.find(
        (candidate) =>
          observationAt >= candidate.start &&
          observationAt < candidate.endExclusive,
      )
      if (!interval) return []
      if (interval.dueAt <= observationAt) overdueCount += 1
    }

    return [{ date: observationAt, overdueCount }]
  })
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
  for (const dueAt of dueDates) {
    if (dueAt < now) points[0]!.overdueCount += 1
    else {
      const point = points.find(
        (candidate) => candidate.date === toAnalyticsDateKey(dueAt),
      )
      if (point) point.dueCount += 1
    }
  }
  return points
}

export function buildRetentionHealth(
  cards: readonly AnalyticsCurrentCard[],
  now: Date,
  options: RetentionHealthOptions,
): { health: RetentionHealthPoint[]; fragile: FragileKnowledgeRow[] } {
  const rows = cards
    .filter(
      (card) =>
        !card.suspended &&
        card.lastReviewAt !== null &&
        Number.isFinite(card.retrievability),
    )
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
        row.overdueDays > 0 ||
        row.difficulty >= options.fragileDifficultyThreshold,
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

function calculateHardAgainShare(
  events: readonly AnalyticsReviewEvent[],
): number | null {
  if (events.length === 0) return null
  return (
    events.filter(
      (event) => event.rating === 'again' || event.rating === 'hard',
    ).length / events.length
  )
}

interface KnownOverdueInterval {
  start: Date
  endExclusive: Date
  dueAt: Date
}

function buildKnownOverdueIntervals(
  card: AnalyticsCurrentCard,
  events: readonly AnalyticsReviewEvent[],
  end: Date,
): KnownOverdueInterval[] {
  const ordered = [...events].sort(compareEvents)
  const intervals: KnownOverdueInterval[] = []
  let segmentStart: Date | null = card.createdAt
  let lastKnownReviewAt: Date | null = null

  for (const event of ordered) {
    const log = parseReviewLog(event.fsrsReviewLog)
    if (!log || !isReviewRating(event.rating)) {
      segmentStart = null
      continue
    }

    if (segmentStart !== null && segmentStart <= event.reviewedAt) {
      intervals.push({
        start: segmentStart,
        endExclusive: event.reviewedAt,
        dueAt: new Date(log.dueAt),
      })
    }
    segmentStart = event.reviewedAt
    lastKnownReviewAt = event.reviewedAt
  }

  if (
    card.lastReviewAt === null &&
    ordered.length === 0 &&
    card.createdAt <= end
  ) {
    intervals.push({
      start: card.createdAt,
      endExclusive: new Date(end.getTime() + 1),
      dueAt: card.dueAt,
    })
  } else if (
    lastKnownReviewAt !== null &&
    card.lastReviewAt?.getTime() === lastKnownReviewAt.getTime()
  ) {
    intervals.push({
      start: lastKnownReviewAt,
      endExclusive: new Date(end.getTime() + 1),
      dueAt: card.dueAt,
    })
  }

  return intervals
}

function parseReviewLog(serialized: string | null) {
  if (!serialized) return null
  try {
    return parseSerializedFsrsReviewLogSnapshot(serialized)
  } catch {
    return null
  }
}

function observationDateForKey(dateKey: string, end: Date): Date {
  const [year, month, day] = dateKey.split('-')
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    23,
    59,
    59,
    999,
  )
  return date > end ? end : date
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
