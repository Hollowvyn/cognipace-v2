import type { SerializedAnalyticsSummary } from '../../api/analytics-contracts'

export type RecallQualityPoint =
  SerializedAnalyticsSummary['recallQuality'][number]
export type ConsistencyPoint = SerializedAnalyticsSummary['consistency'][number]
export type RatingsMixPoint = SerializedAnalyticsSummary['ratingsMix'][number]
export type TopicPoint = SerializedAnalyticsSummary['topics'][number]
export type StabilityPoint = SerializedAnalyticsSummary['stability'][number]
export type OverdueBacklogPoint =
  SerializedAnalyticsSummary['overdueBacklog'][number]
export type UpcomingLoadPoint =
  SerializedAnalyticsSummary['upcomingLoad'][number]
export type RetentionHealthPoint =
  SerializedAnalyticsSummary['retentionHealth'][number]
