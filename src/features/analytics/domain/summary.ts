export interface ObservedRatingQualityResult {
  value: number | null
  label: string
  sampleSize: number
  lowSample: boolean
}

export interface AnalyticsMetricSummary {
  value: number | null
  sampleSize: number
  lowSample: boolean
}

export interface ForecastEntry {
  date: string
  dueCount: number
}

export interface WeakProblem {
  slug: string
  title: string
  lapseCount: number
  difficulty: number
  retrievability: number
}

export interface MemoryProfileInput {
  totalTracked: number
  dueToday: number
  overdue: number
  learning: number
  review: number
  mastered: number
  suspended: number
  retrievabilities: number[]
}

export interface MemoryProfile {
  totalTracked: number
  dueToday: number
  overdue: number
  learning: number
  review: number
  mastered: number
  suspended: number
  averageRetrievability: number | null
  lowSample: boolean
}

export interface RetentionScatterEntry {
  slug: string
  title: string
  retrievability: number
  daysSinceReview: number
  difficulty: number
  stability: number
  lapseCount: number
  lastReviewAt: string
}

export interface ReferenceCurvePoint {
  days: number
  retrievability: number
}

export interface AnalyticsSummaryInput {
  generatedAt: Date
  reviewDays: number
  totalReviews: number
  currentStreak: number
  observedRatingQuality: ObservedRatingQualityResult
  range: 14 | 30 | 90
  periodStart: Date
  periodEnd: Date
  forecast: ForecastEntry[]
  weakProblems: WeakProblem[]
  memoryProfile: MemoryProfile
  targetRetention: number
  scatter: RetentionScatterEntry[]
  referenceCurve: ReferenceCurvePoint[]
  chartDataStatus?: 'unavailable' | 'ready'
  predictedRecall?: AnalyticsMetricSummary
  recallQuality?: import('./chart-data').RecallQualityPoint[]
  consistency?: import('./chart-data').ConsistencyPoint[]
  ratingsMix?: import('./chart-data').RatingsMixPoint[]
  topics?: import('./chart-data').TopicPoint[]
  stability?: import('./chart-data').StabilityPoint[]
  overdueBacklog?: import('./chart-data').OverdueBacklogPoint[]
  overdueHistoryAvailableFrom?: string | null
  upcomingLoad?: import('./chart-data').UpcomingLoadPoint[]
  retentionHealth?: import('./chart-data').RetentionHealthPoint[]
  fragileKnowledge?: import('./chart-data').FragileKnowledgeRow[]
}

export interface AnalyticsSummary {
  generatedAt: string
  reviewDays: number
  totalReviews: number
  currentStreak: number
  observedRatingQuality: number | null
  observedRatingQualityLabel: string
  range: 14 | 30 | 90
  periodStart: string
  periodEnd: string
  observedRatingSampleSize: number
  lowSample: boolean
  dueForecast14Days: ForecastEntry[]
  weakProblems: WeakProblem[]
  memoryProfile: MemoryProfile
  targetRetention: number
  retentionScatter: RetentionScatterEntry[]
  retentionScatterCurve: ReferenceCurvePoint[]
  chartDataStatus: 'unavailable' | 'ready'
  predictedRecall: AnalyticsMetricSummary
  recallQuality: import('./chart-data').RecallQualityPoint[]
  consistency: import('./chart-data').ConsistencyPoint[]
  ratingsMix: import('./chart-data').RatingsMixPoint[]
  topics: import('./chart-data').TopicPoint[]
  stability: import('./chart-data').StabilityPoint[]
  overdueBacklog: import('./chart-data').OverdueBacklogPoint[]
  overdueHistoryAvailableFrom: string | null
  upcomingLoad: import('./chart-data').UpcomingLoadPoint[]
  retentionHealth: import('./chart-data').RetentionHealthPoint[]
  fragileKnowledge: import('./chart-data').FragileKnowledgeRow[]
}

export function buildObservedRatingQuality(
  attempts: Array<{ rating: string; reviewedAt: Date }>,
  now: Date,
  range: 14 | 30 | 90,
): ObservedRatingQualityResult {
  const since = subtractDays(now, range)
  const recent = attempts.filter((a) => a.reviewedAt >= since)
  const sampleSize = recent.length

  if (sampleSize < 10) {
    return { value: null, label: '—', sampleSize, lowSample: true }
  }

  const positive = recent.filter(
    (a) => a.rating === 'good' || a.rating === 'easy',
  ).length
  const value = positive / sampleSize
  const label = `${Math.round(value * 100)}%`

  return { value, label, sampleSize, lowSample: false }
}

export function buildDueForecast(
  cards: Array<{ dueAt: Date }>,
  now: Date,
): ForecastEntry[] {
  const entries: ForecastEntry[] = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() + i)
    return { date: toLocalDateKey(d), dueCount: 0 }
  })

  const todayKey = toLocalDateKey(now)
  const dateToIndex = new Map(entries.map((e, i) => [e.date, i]))

  for (const card of cards) {
    const key = card.dueAt < now ? todayKey : toLocalDateKey(card.dueAt)
    const index = dateToIndex.get(key)
    if (index !== undefined) {
      entries[index]!.dueCount++
    }
  }

  return entries
}

export function buildWeakProblems(candidates: WeakProblem[]): WeakProblem[] {
  return [...candidates]
    .sort((a, b) => {
      if (b.lapseCount !== a.lapseCount) return b.lapseCount - a.lapseCount
      if (b.difficulty !== a.difficulty) return b.difficulty - a.difficulty
      return a.retrievability - b.retrievability
    })
    .slice(0, 10)
}

export function buildMemoryProfile(input: MemoryProfileInput): MemoryProfile {
  const sampleSize = input.retrievabilities.length
  const averageRetrievability =
    sampleSize === 0
      ? null
      : Math.round(
          (input.retrievabilities.reduce((sum, value) => sum + value, 0) /
            sampleSize) *
            100,
        ) / 100

  return {
    totalTracked: input.totalTracked,
    dueToday: input.dueToday,
    overdue: input.overdue,
    learning: input.learning,
    review: input.review,
    mastered: input.mastered,
    suspended: input.suspended,
    averageRetrievability,
    lowSample: sampleSize < 10,
  }
}

// Entries and curve are pre-computed by the service (FSRS math stays server-side); this sorts only.
export function buildRetentionScatter(
  entries: RetentionScatterEntry[],
  referenceCurve: ReferenceCurvePoint[],
): { scatter: RetentionScatterEntry[]; referenceCurve: ReferenceCurvePoint[] } {
  return {
    scatter: [...entries].sort((a, b) => a.daysSinceReview - b.daysSinceReview),
    referenceCurve,
  }
}

export function buildAnalyticsSummary(
  input: AnalyticsSummaryInput,
): AnalyticsSummary {
  return {
    generatedAt: input.generatedAt.toISOString(),
    reviewDays: input.reviewDays,
    totalReviews: input.totalReviews,
    currentStreak: input.currentStreak,
    observedRatingQuality: input.observedRatingQuality.value,
    observedRatingQualityLabel: input.observedRatingQuality.label,
    observedRatingSampleSize: input.observedRatingQuality.sampleSize,
    lowSample: input.observedRatingQuality.lowSample,
    range: input.range,
    periodStart: input.periodStart.toISOString(),
    periodEnd: input.periodEnd.toISOString(),
    dueForecast14Days: input.forecast,
    weakProblems: input.weakProblems,
    memoryProfile: input.memoryProfile,
    targetRetention: input.targetRetention,
    retentionScatter: input.scatter,
    retentionScatterCurve: input.referenceCurve,
    chartDataStatus: input.chartDataStatus ?? 'unavailable',
    predictedRecall: input.predictedRecall ?? {
      value: null,
      sampleSize: 0,
      lowSample: true,
    },
    recallQuality: input.recallQuality ?? [],
    consistency: input.consistency ?? [],
    ratingsMix: input.ratingsMix ?? [],
    topics: input.topics ?? [],
    stability: input.stability ?? [],
    overdueBacklog: input.overdueBacklog ?? [],
    overdueHistoryAvailableFrom: input.overdueHistoryAvailableFrom ?? null,
    upcomingLoad: input.upcomingLoad ?? [],
    retentionHealth: input.retentionHealth ?? [],
    fragileKnowledge: input.fragileKnowledge ?? [],
  }
}

function subtractDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() - days)
  return result
}

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
