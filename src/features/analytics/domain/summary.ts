export interface RetentionProxyResult {
  value: number
  label: string
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

export interface AnalyticsSummaryInput {
  generatedAt: Date
  reviewDays: number
  totalReviews: number
  currentStreak: number
  retention: RetentionProxyResult
  forecast: ForecastEntry[]
  weakProblems: WeakProblem[]
}

export interface AnalyticsSummary {
  generatedAt: string
  reviewDays: number
  totalReviews: number
  currentStreak: number
  retentionProxy: number
  retentionProxyLabel: string
  retentionSampleSize: number
  lowSample: boolean
  dueForecast14Days: ForecastEntry[]
  weakProblems: WeakProblem[]
}

export function buildRetentionProxy(
  attempts: Array<{ rating: string; reviewedAt: Date }>,
  now: Date,
): RetentionProxyResult {
  const since = subtractDays(now, 30)
  const recent = attempts.filter((a) => a.reviewedAt >= since)
  const sampleSize = recent.length

  if (sampleSize < 10) {
    return { value: 0, label: '—', sampleSize, lowSample: true }
  }

  const positive = recent.filter(
    (a) => a.rating === 'good' || a.rating === 'easy',
  ).length
  const value = positive / sampleSize
  const label = `${Math.round(value * 100)}%`

  return { value, label, sampleSize, lowSample: false }
}

// Placeholders — implemented in Tasks 2 and 3
export function buildDueForecast(
  _cards: Array<{ dueAt: Date }>,
  _now: Date,
): ForecastEntry[] {
  return []
}

export function buildWeakProblems(_candidates: WeakProblem[]): WeakProblem[] {
  return []
}

export function buildAnalyticsSummary(
  _input: AnalyticsSummaryInput,
): AnalyticsSummary {
  throw new Error('Not implemented')
}

function subtractDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() - days)
  return result
}
