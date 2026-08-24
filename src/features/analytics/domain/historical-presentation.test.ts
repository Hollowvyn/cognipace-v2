import { describe, expect, it } from 'vitest'

import {
  createInitialFsrsCard,
  getRetrievability,
  normalizeFsrsSchedulingOptions,
  replayReviewHistorySequence,
} from '@/lib/fsrs'

import {
  buildHistoricalAnalyticsViews,
  type HistoricalPresentationOptions,
  type HistoricalAnalyticsReviewEvent,
} from './historical-presentation'
import {
  buildAnalyticsTimeFrame,
  shiftAnalyticsCalendarDays,
} from './analytics-time'
import { buildAnalyticsBucketsFromTimeFrame } from './analytics-range-policy'
import { medianBucketValues } from './chart-buckets'

const options: HistoricalPresentationOptions = {
  buckets: [
    {
      key: '2026-08-01',
      start: new Date('2026-08-01T00:00:00.000Z'),
      end: new Date('2026-08-01T23:59:59.999Z'),
      label: '2026-08-01',
    },
    {
      key: '2026-08-02',
      start: new Date('2026-08-02T00:00:00.000Z'),
      end: new Date('2026-08-02T23:59:59.999Z'),
      label: '2026-08-02',
    },
  ],
  end: new Date('2026-08-02T23:59:59.999Z'),
  fsrsOptions: normalizeFsrsSchedulingOptions({ targetRetention: 0.9 }),
  start: new Date('2026-08-01T00:00:00.000Z'),
  timeZone: 'UTC',
  timeFrame: {
    asOf: '2026-08-02T23:59:59.999Z',
    timeZone: 'UTC',
    timeZoneFallback: false,
    requestedRange: 90,
    periodStart: '2026-08-01T00:00:00.000Z',
    periodEnd: '2026-08-03T00:00:00.000Z',
    bucketGrain: 'week',
    allTimeUnsupported: false,
    buckets: [],
  },
}

function event(
  overrides: Partial<HistoricalAnalyticsReviewEvent> = {},
): HistoricalAnalyticsReviewEvent {
  return {
    cardId: 'card-1',
    fsrsReviewLog: JSON.stringify({
      rating: 'good',
      state: 'review',
      dueAt: '2026-08-01T12:00:00.000Z',
      stability: 6,
      difficulty: 5,
      elapsedDays: 1,
      lastElapsedDays: 1,
      scheduledDays: 4,
      learningSteps: 0,
      reviewedAt: '2026-08-01T12:00:00.000Z',
    }),
    id: 'one',
    problemSlug: 'problem-1',
    rating: 'good',
    reviewedAt: new Date('2026-08-01T12:00:00.000Z'),
    topicLabels: [],
    ...overrides,
  }
}

function twoDayCoarsenedOptions(): HistoricalPresentationOptions {
  return {
    ...options,
    buckets: [
      {
        key: '2026-08-01',
        start: options.buckets[0]!.start,
        end: options.buckets[1]!.end,
        label: '2026-08-01 – 2026-08-02',
      },
    ],
  }
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

describe('buildHistoricalAnalyticsViews', () => {
  it('pairs rating-derived recalled outcomes with the FSRS estimate from the exact reviews', () => {
    const views = buildHistoricalAnalyticsViews(
      [
        event(),
        event({
          id: 'two',
          rating: 'again',
          reviewedAt: new Date('2026-08-01T13:00:00.000Z'),
        }),
      ],
      options,
    )

    expect(views.observedRecallVsFsrs.rows[0]).toMatchObject({
      recalledCount: 1,
      pairedReviews: 2,
      observedRecall: 0.5,
      provenance: 'reconstructed',
    })
    expect(views.observedRecallVsFsrs.rows[0]?.fsrsEstimate).not.toBeNull()
    expect(views.observedRecallVsFsrs.rows[0]?.difference).not.toBeNull()
  })

  it('replays each card’s full ordered history before filtering unsorted interleaved events', () => {
    const historyA = [
      {
        rating: 'good' as const,
        reviewedAt: new Date('2026-07-14T12:00:00.000Z'),
      },
      {
        rating: 'again' as const,
        reviewedAt: new Date('2026-07-20T12:00:00.000Z'),
      },
      {
        rating: 'good' as const,
        reviewedAt: new Date('2026-08-01T12:00:00.000Z'),
      },
    ]
    const historyB = [
      {
        rating: 'hard' as const,
        reviewedAt: new Date('2026-07-10T12:00:00.000Z'),
      },
      {
        rating: 'good' as const,
        reviewedAt: new Date('2026-07-19T12:00:00.000Z'),
      },
      {
        rating: 'again' as const,
        reviewedAt: new Date('2026-08-01T14:00:00.000Z'),
      },
    ]
    const expectedACard = replayReviewHistorySequence(
      historyA,
      options.fsrsOptions,
    )[1]!.card
    const expectedBCard = replayReviewHistorySequence(
      historyB,
      options.fsrsOptions,
    )[1]!.card
    const expectedAEstimate = getRetrievability(
      expectedACard,
      historyA[2]!.reviewedAt,
      options.fsrsOptions,
    )
    const expectedBEstimate = getRetrievability(
      expectedBCard,
      historyB[2]!.reviewedAt,
      options.fsrsOptions,
    )
    const rangeStartEstimate = getRetrievability(
      createInitialFsrsCard(historyA[2]!.reviewedAt),
      historyA[2]!.reviewedAt,
      options.fsrsOptions,
    )

    const views = buildHistoricalAnalyticsViews(
      [
        event({
          cardId: 'card-b',
          id: 'b-visible',
          rating: 'again',
          reviewedAt: historyB[2]!.reviewedAt,
        }),
        event({
          cardId: 'card-a',
          id: 'a-prior-two',
          rating: 'again',
          reviewedAt: historyA[1]!.reviewedAt,
        }),
        event({
          cardId: 'card-a',
          id: 'a-visible',
          rating: 'good',
          reviewedAt: historyA[2]!.reviewedAt,
        }),
        event({
          cardId: 'card-b',
          id: 'b-prior-two',
          rating: 'good',
          reviewedAt: historyB[1]!.reviewedAt,
        }),
        event({
          cardId: 'card-a',
          id: 'a-prior-one',
          rating: 'good',
          reviewedAt: historyA[0]!.reviewedAt,
        }),
        event({
          cardId: 'card-b',
          id: 'b-prior-one',
          rating: 'hard',
          reviewedAt: historyB[0]!.reviewedAt,
        }),
      ],
      options,
    )

    expect(views.observedRecallVsFsrs.rows[0]).toMatchObject({
      pairedReviews: 2,
      observedRecall: 0.5,
    })
    expect(views.observedRecallVsFsrs.rows[0]?.fsrsEstimate).toBeCloseTo(
      (expectedAEstimate + expectedBEstimate) / 2,
    )
    expect((expectedAEstimate + expectedBEstimate) / 2).not.toBeCloseTo(
      rangeStartEstimate,
    )
  })

  it('coarsens historical views from raw review evidence instead of daily derived values', () => {
    const dayTwoPriorRatings = ['again', 'hard', 'good'] as const
    const reviewHistories = [
      {
        cardId: 'day-one',
        history: [
          {
            rating: 'good' as const,
            reviewedAt: new Date('2026-07-14T12:00:00.000Z'),
          },
          {
            rating: 'good' as const,
            reviewedAt: new Date('2026-08-01T12:00:00.000Z'),
          },
        ],
      },
      ...Array.from({ length: 9 }, (_, index) => ({
        cardId: `day-two-${index}`,
        history: [
          {
            rating: dayTwoPriorRatings[index % dayTwoPriorRatings.length]!,
            reviewedAt: new Date(
              `2026-07-${String(10 + index).padStart(2, '0')}T12:00:00.000Z`,
            ),
          },
          {
            rating: 'again' as const,
            reviewedAt: new Date('2026-08-02T12:00:00.000Z'),
          },
        ],
      })),
    ]
    const events = reviewHistories.flatMap(({ cardId, history }) =>
      history.map((review, index) =>
        event({
          cardId,
          id: `${cardId}-${index}`,
          rating: review.rating,
          reviewedAt: review.reviewedAt,
        }),
      ),
    )
    const rawFsrsSamples = reviewHistories.map(({ history }) => {
      const replayed = replayReviewHistorySequence(history, options.fsrsOptions)
      return getRetrievability(
        replayed[0]!.card,
        history[1]!.reviewedAt,
        options.fsrsOptions,
      )
    })
    const rawFsrsEstimate = mean(rawFsrsSamples)
    const dailyViews = buildHistoricalAnalyticsViews(events, options)
    const coarsenedViews = buildHistoricalAnalyticsViews(
      events,
      twoDayCoarsenedOptions(),
    )
    const dailyFsrsEstimates = dailyViews.observedRecallVsFsrs.rows.map(
      (row) => row.fsrsEstimate,
    )
    const derivedDailyEstimateAverage = mean(
      dailyFsrsEstimates.filter(
        (estimate): estimate is number => estimate !== null,
      ),
    )

    expect(
      dailyViews.observedRecallVsFsrs.rows.map((row) => row.observedRecall),
    ).toEqual([1, 0])
    expect(
      dailyViews.practiceRhythm.rows.map((row) => row.reviewSuccess),
    ).toEqual([1, 0])
    expect(dailyViews.ratingsMix.rows.map((row) => row.againShare)).toEqual([
      0, 1,
    ])
    expect(rawFsrsEstimate).not.toBeCloseTo(derivedDailyEstimateAverage)
    expect(coarsenedViews.observedRecallVsFsrs.rows[0]).toMatchObject({
      recalledCount: 1,
      pairedReviews: 10,
      observedRecall: 0.1,
    })
    expect(
      coarsenedViews.observedRecallVsFsrs.rows[0]?.fsrsEstimate,
    ).toBeCloseTo(rawFsrsEstimate)
    expect(coarsenedViews.observedRecallVsFsrs.rows[0]?.difference).toBeCloseTo(
      0.1 - rawFsrsEstimate,
    )
    expect(coarsenedViews.practiceRhythm.rows[0]).toMatchObject({
      completedReviews: 10,
      goodEasy: 1,
      validRatings: 10,
      reviewSuccess: 0.1,
    })
    expect(coarsenedViews.ratingsMix.rows[0]).toMatchObject({
      again: 9,
      hard: 0,
      good: 1,
      easy: 0,
      validRatings: 10,
      challengingReviews: 9,
      againShare: 0.9,
      hardShare: 0,
      goodShare: 0.1,
      easyShare: 0,
    })
  })

  it('coarsens Memory Strength from raw replayed post-review samples', () => {
    const history = [
      {
        rating: 'good' as const,
        reviewedAt: new Date('2026-08-01T08:00:00.000Z'),
      },
      {
        rating: 'again' as const,
        reviewedAt: new Date('2026-08-01T10:00:00.000Z'),
      },
      {
        rating: 'easy' as const,
        reviewedAt: new Date('2026-08-01T12:00:00.000Z'),
      },
      {
        rating: 'hard' as const,
        reviewedAt: new Date('2026-08-02T12:00:00.000Z'),
      },
    ]
    const rawStabilitySamples = replayReviewHistorySequence(
      history,
      options.fsrsOptions,
    ).map((review) => review.card.stability)
    const rawMedian = medianBucketValues(rawStabilitySamples)!
    const derivedDailyMedian = medianBucketValues([
      medianBucketValues(rawStabilitySamples.slice(0, 3))!,
      medianBucketValues(rawStabilitySamples.slice(3))!,
    ])!
    const views = buildHistoricalAnalyticsViews(
      history.map((review, index) =>
        event({
          cardId: 'stability-card',
          id: `stability-${index}`,
          rating: review.rating,
          reviewedAt: review.reviewedAt,
        }),
      ),
      twoDayCoarsenedOptions(),
    )

    expect(rawMedian).not.toBeCloseTo(derivedDailyMedian)
    expect(views.memoryStrength.rows[0]).toMatchObject({
      eligibleReviews: 4,
      medianStrengthDays: rawMedian,
    })
  })

  it('keeps known zero-practice buckets at zero and their Review Success unknown', () => {
    const views = buildHistoricalAnalyticsViews([event()], options)

    expect(views.practiceRhythm.rows[1]).toMatchObject({
      completedReviews: 0,
      goodEasy: 0,
      validRatings: 0,
      reviewSuccess: null,
      evidence: 'measured',
    })
    expect(views.observedRecallVsFsrs.rows[1]).toMatchObject({
      recalledCount: 0,
      pairedReviews: 0,
      observedRecall: null,
      fsrsEstimate: null,
      difference: null,
      provenance: 'reconstructed',
      evidence: 'not-measured',
    })
    expect(views.memoryStrength.rows[1]).toMatchObject({
      medianStrengthDays: null,
      q1: null,
      q3: null,
      eligibleReviews: 0,
      medianChangeDays: null,
      provenance: 'reconstructed',
      evidence: 'not-measured',
    })
    expect(views.ratingsMix.rows[1]).toMatchObject({
      again: 0,
      hard: 0,
      good: 0,
      easy: 0,
      validRatings: 0,
      challengingReviews: 0,
      againShare: null,
      hardShare: null,
      goodShare: null,
      easyShare: null,
      evidence: 'not-measured',
    })
  })

  it('only exposes a memory-strength IQR when a bucket has four eligible reviews', () => {
    const withThree = buildHistoricalAnalyticsViews(
      Array.from({ length: 3 }, (_, index) =>
        event({
          id: `three-${index}`,
          reviewedAt: new Date(
            `2026-08-01T${String(10 + index).padStart(2, '0')}:00:00.000Z`,
          ),
        }),
      ),
      options,
    )
    const withFour = buildHistoricalAnalyticsViews(
      Array.from({ length: 4 }, (_, index) =>
        event({
          id: `four-${index}`,
          reviewedAt: new Date(
            `2026-08-01T${String(10 + index).padStart(2, '0')}:00:00.000Z`,
          ),
        }),
      ),
      options,
    )

    expect(withThree.memoryStrength.rows[0]).toMatchObject({
      q1: null,
      q3: null,
    })
    expect(withFour.memoryStrength.rows[0]).toMatchObject({
      eligibleReviews: 4,
      provenance: 'reconstructed',
    })
    expect(withFour.memoryStrength.rows[0]?.q1).not.toBeNull()
    expect(withFour.memoryStrength.rows[0]?.q3).not.toBeNull()
  })

  it('derives post-review Memory Strength from the replayed post-review card rather than the stored log snapshot', () => {
    const reviewedAt = new Date('2026-08-01T12:00:00.000Z')
    const replayedPostReview = replayReviewHistorySequence(
      [{ rating: 'good', reviewedAt }],
      options.fsrsOptions,
    )[0]!.card.stability
    const views = buildHistoricalAnalyticsViews(
      [
        event({
          fsrsReviewLog: JSON.stringify({
            rating: 'good',
            state: 'review',
            dueAt: '2026-08-01T12:00:00.000Z',
            stability: 999,
            difficulty: 5,
            elapsedDays: 1,
            lastElapsedDays: 1,
            scheduledDays: 4,
            learningSteps: 0,
            reviewedAt: '2026-08-01T12:00:00.000Z',
          }),
          reviewedAt,
        }),
      ],
      options,
    )

    expect(views.memoryStrength.rows[0]?.medianStrengthDays).toBeCloseTo(
      replayedPostReview,
    )
    expect(views.memoryStrength.rows[0]?.medianStrengthDays).not.toBe(999)
  })

  it('builds valid-rating composition rows with zero categories and no invented empty stack', () => {
    const views = buildHistoricalAnalyticsViews(
      [
        event({ id: 'again', rating: 'again' }),
        event({ id: 'good', rating: 'good' }),
        event({ id: 'invalid', rating: 'unknown' }),
      ],
      options,
    )

    expect(views).toMatchObject({
      ratingsMix: {
        rows: [
          {
            again: 1,
            hard: 0,
            good: 1,
            easy: 0,
            validRatings: 2,
            againShare: 0.5,
            hardShare: 0,
            goodShare: 0.5,
            easyShare: 0,
            challengingReviews: 1,
            evidence: 'measured',
          },
          {
            validRatings: 0,
            againShare: null,
            hardShare: null,
            goodShare: null,
            easyShare: null,
            evidence: 'not-measured',
          },
        ],
      },
    })
  })

  it('withholds a short-span prior-period direction through the shifted as-of boundary', () => {
    const asOf = new Date('2026-08-22T12:00:00.000Z')
    const comparisonOptions = optionsForComparison(asOf, 'UTC')
    const previousAsOf = shiftAnalyticsCalendarDays(asOf, -90, 'UTC')
    const previousBuckets = buildAnalyticsBucketsFromTimeFrame(
      buildAnalyticsTimeFrame({
        asOf: previousAsOf,
        requestedRange: 90,
        allTimeStart: null,
        timeZone: 'UTC',
      }),
    )
    const selected = comparisonOptions.buckets.map((bucket, index) =>
      event({
        id: `selected-${index}`,
        rating: index < 3 ? 'again' : 'good',
        reviewedAt:
          index === comparisonOptions.buckets.length - 1
            ? asOf
            : new Date(bucket.start.getTime() + 12 * 60 * 60 * 1000),
      }),
    )
    const previous = previousBuckets.map((bucket, index) =>
      event({
        id: `previous-${index}`,
        rating: index < 7 ? 'again' : 'good',
        reviewedAt:
          index === previousBuckets.length - 1
            ? previousAsOf
            : new Date(bucket.start.getTime() + 12 * 60 * 60 * 1000),
      }),
    )

    const views = buildHistoricalAnalyticsViews(
      [...selected, ...previous],
      comparisonOptions,
    )

    expect(views.ratingsMix.comparison).toMatchObject({
      direction: null,
      previousHardAgainShare: null,
      previousValidRatings: 13,
    })
    expect(views.ratingsMix.comparison.difference).toBeNull()
  })

  it('uses calendar-day shifting across daylight saving time without overstating a short trend', () => {
    const asOf = new Date('2026-03-10T16:00:00.000Z')
    const timeFrameOptions = optionsForComparison(asOf, 'America/New_York')
    const previousAsOf = shiftAnalyticsCalendarDays(
      asOf,
      -90,
      'America/New_York',
    )
    const previousBuckets = buildAnalyticsBucketsFromTimeFrame(
      buildAnalyticsTimeFrame({
        asOf: previousAsOf,
        requestedRange: 90,
        allTimeStart: null,
        timeZone: 'America/New_York',
      }),
    )
    const selected = timeFrameOptions.buckets.map((bucket, index) =>
      event({
        id: `selected-dst-${index}`,
        rating: index < 3 ? 'again' : 'good',
        reviewedAt:
          index === timeFrameOptions.buckets.length - 1
            ? asOf
            : new Date(bucket.start.getTime() + 12 * 60 * 60 * 1000),
      }),
    )
    const prior = previousBuckets.map((bucket, index) =>
      event({
        id: `prior-dst-${index}`,
        rating: index < 7 ? 'again' : 'good',
        // The exact prior local-time cutoff stays eligible across the DST shift.
        reviewedAt:
          index === previousBuckets.length - 1
            ? previousAsOf
            : new Date(bucket.start.getTime() + 12 * 60 * 60 * 1000),
      }),
    )

    const views = buildHistoricalAnalyticsViews(
      [...selected, ...prior],
      timeFrameOptions,
    )

    expect(views.ratingsMix.comparison).toMatchObject({
      direction: null,
      previousHardAgainShare: null,
      previousValidRatings: 14,
    })
  })

  it('withholds direction when comparable samples do not meet trend evidence', () => {
    const asOf = new Date('2026-08-22T12:00:00.000Z')
    const comparisonOptions = optionsForComparison(asOf, 'UTC')
    const previousAsOf = shiftAnalyticsCalendarDays(asOf, -90, 'UTC')
    const previousBuckets = buildAnalyticsBucketsFromTimeFrame(
      buildAnalyticsTimeFrame({
        asOf: previousAsOf,
        requestedRange: 90,
        allTimeStart: null,
        timeZone: 'UTC',
      }),
    )
    const selected = comparisonOptions.buckets
      .slice(0, 10)
      .map((bucket, index) =>
        event({
          id: `selected-gapped-${index}`,
          rating: 'good',
          reviewedAt: new Date(bucket.start.getTime() + 12 * 60 * 60 * 1000),
        }),
      )
    const prior = previousBuckets.slice(0, 10).map((bucket, index) =>
      event({
        id: `prior-gapped-${index}`,
        rating: 'again',
        reviewedAt: new Date(bucket.start.getTime() + 12 * 60 * 60 * 1000),
      }),
    )

    const views = buildHistoricalAnalyticsViews(
      [...selected, ...prior],
      comparisonOptions,
    )

    expect(views.ratingsMix.comparison).toEqual({
      previousHardAgainShare: null,
      previousValidRatings: 10,
      difference: null,
      direction: null,
    })
  })

  it('emits direction only when both Ratings Mix periods meet trend evidence', () => {
    const asOf = new Date('2026-08-22T12:00:00.000Z')
    const timeFrame = buildAnalyticsTimeFrame({
      asOf,
      requestedRange: 90,
      allTimeStart: null,
      timeZone: 'UTC',
    })
    const comparisonOptions = {
      ...options,
      buckets: buildAnalyticsBucketsFromTimeFrame(timeFrame),
      end: asOf,
      start: new Date(timeFrame.periodStart!),
      timeFrame,
      timeZone: 'UTC',
    }
    const previousAsOf = shiftAnalyticsCalendarDays(asOf, -90, 'UTC')
    const previousBuckets = buildAnalyticsBucketsFromTimeFrame(
      buildAnalyticsTimeFrame({
        asOf: previousAsOf,
        requestedRange: 90,
        allTimeStart: null,
        timeZone: 'UTC',
      }),
    )
    const selected = comparisonOptions.buckets
      .slice(0, 6)
      .flatMap((bucket, week) =>
        Array.from({ length: 5 }, (_, sample) =>
          event({
            id: `trend-selected-${week}-${sample}`,
            rating: 'good',
            reviewedAt: new Date(
              bucket.start.getTime() + (sample + 1) * 60_000,
            ),
          }),
        ),
      )
    const prior = previousBuckets.slice(0, 6).flatMap((bucket, week) =>
      Array.from({ length: 5 }, (_, sample) =>
        event({
          id: `trend-prior-${week}-${sample}`,
          rating: 'again',
          reviewedAt: new Date(bucket.start.getTime() + (sample + 1) * 60_000),
        }),
      ),
    )

    expect(
      buildHistoricalAnalyticsViews([...selected, ...prior], comparisonOptions)
        .ratingsMix.comparison,
    ).toMatchObject({
      previousHardAgainShare: 1,
      previousValidRatings: 30,
      difference: -1,
      direction: 'down',
    })
  })

  it.each([90, 120] as const)(
    'uses an equivalent selected-frame prior window for %s days',
    (requestedRange) => {
      const asOf = new Date('2026-08-22T12:00:00.000Z')
      const timeFrame = buildAnalyticsTimeFrame({
        asOf,
        requestedRange,
        allTimeStart: null,
        timeZone: 'UTC',
      })
      const comparisonOptions = {
        ...options,
        buckets: buildAnalyticsBucketsFromTimeFrame(timeFrame),
        end: asOf,
        start: new Date(timeFrame.periodStart!),
        timeFrame,
        timeZone: 'UTC',
      }
      const previousAsOf = shiftAnalyticsCalendarDays(
        asOf,
        -requestedRange,
        'UTC',
      )
      const previousFrame = buildAnalyticsTimeFrame({
        asOf: previousAsOf,
        requestedRange,
        allTimeStart: null,
        timeZone: 'UTC',
      })
      const selected = comparisonOptions.buckets
        .slice(0, 6)
        .flatMap((bucket, week) =>
          Array.from({ length: 5 }, (_, sample) =>
            event({
              id: `selected-frame-${requestedRange}-${week}-${sample}`,
              rating: 'good',
              reviewedAt: new Date(
                bucket.start.getTime() + (sample + 1) * 60_000,
              ),
            }),
          ),
        )
      const prior = buildAnalyticsBucketsFromTimeFrame(previousFrame)
        .slice(0, 6)
        .flatMap((bucket, week) =>
          Array.from({ length: 5 }, (_, sample) =>
            event({
              id: `prior-frame-${requestedRange}-${week}-${sample}`,
              rating: 'again',
              reviewedAt: new Date(
                bucket.start.getTime() + (sample + 1) * 60_000,
              ),
            }),
          ),
        )

      expect(
        buildHistoricalAnalyticsViews(
          [...selected, ...prior],
          comparisonOptions,
        ).ratingsMix.comparison,
      ).toMatchObject({
        previousHardAgainShare: 1,
        previousValidRatings: 30,
        difference: -1,
        direction: 'down',
      })
    },
  )

  it('does not compare an All-time presentation with a prior window', () => {
    const asOf = new Date('2026-08-22T12:00:00.000Z')
    const timeFrame = buildAnalyticsTimeFrame({
      asOf,
      requestedRange: 'all',
      allTimeStart: new Date('2025-01-01T12:00:00.000Z'),
      timeZone: 'UTC',
    })
    const comparison = buildHistoricalAnalyticsViews([], {
      ...options,
      buckets: buildAnalyticsBucketsFromTimeFrame(timeFrame),
      end: asOf,
      start: new Date(timeFrame.periodStart!),
      timeFrame,
      timeZone: 'UTC',
    }).ratingsMix.comparison

    expect(comparison).toEqual({
      previousHardAgainShare: null,
      previousValidRatings: 0,
      difference: null,
      direction: null,
    })
  })

  it('withholds the prior-period direction when either comparison period has fewer than 10 valid ratings', () => {
    const selected = Array.from({ length: 10 }, (_, index) =>
      event({
        id: `selected-qualified-${index}`,
        rating: 'good',
        reviewedAt: new Date('2026-08-01T12:00:00.000Z'),
      }),
    )
    const prior = Array.from({ length: 9 }, (_, index) =>
      event({
        id: `prior-insufficient-${index}`,
        rating: 'again',
        reviewedAt: new Date('2026-05-03T12:00:00.000Z'),
      }),
    )

    const views = buildHistoricalAnalyticsViews(
      [...selected, ...prior],
      options,
    )

    expect(views.ratingsMix.comparison).toEqual({
      previousHardAgainShare: null,
      previousValidRatings: 9,
      difference: null,
      direction: null,
    })
  })

  it('ranks only the five lowest qualifying normalized topics by Good + Easy Review Success', () => {
    const reviews = Array.from({ length: 10 }, (_, index) =>
      event({
        cardId: `graph-${index % 3}`,
        id: `graph-${index}`,
        problemSlug: `graph-${index % 3}`,
        rating: index < 4 ? 'again' : 'good',
        topicLabels: ['Graphs', 'graphs', ' Graphs '],
      }),
    ).concat(
      Array.from({ length: 10 }, (_, index) =>
        event({
          cardId: `array-${index % 3}`,
          id: `array-${index}`,
          problemSlug: `array-${index % 3}`,
          rating: 'easy',
          topicLabels: ['Arrays'],
        }),
      ),
    )

    const views = buildHistoricalAnalyticsViews(reviews, options)

    expect(views).toMatchObject({
      topicPerformance: {
        rows: [
          {
            topic: 'Graphs',
            reviewSuccess: 0.6,
            goodEasy: 6,
            validRatings: 10,
            distinctProblems: 3,
            evidence: 'Measured',
          },
          {
            topic: 'Arrays',
            reviewSuccess: 1,
            goodEasy: 10,
            validRatings: 10,
            distinctProblems: 3,
            evidence: 'Measured',
          },
        ],
        strongerQualifyingTopics: 0,
      },
    })
  })

  it('retains only five qualifying topics and counts stronger qualifiers separately', () => {
    const reviews = Array.from({ length: 6 }, (_, topicIndex) =>
      Array.from({ length: 10 }, (_, reviewIndex) =>
        event({
          cardId: `topic-${topicIndex}-${reviewIndex % 3}`,
          id: `topic-${topicIndex}-${reviewIndex}`,
          problemSlug: `topic-${topicIndex}-${reviewIndex % 3}`,
          rating: reviewIndex < topicIndex ? 'good' : 'again',
          topicLabels: [`Topic ${topicIndex}`],
        }),
      ),
    ).flat()

    const views = buildHistoricalAnalyticsViews(reviews, options)

    expect(views.topicPerformance.rows).toHaveLength(5)
    expect(views.topicPerformance.rows.map((row) => row.topic)).toEqual([
      'Topic 0',
      'Topic 1',
      'Topic 2',
      'Topic 3',
      'Topic 4',
    ])
    expect(views.topicPerformance.strongerQualifyingTopics).toBe(1)
  })
})

function optionsForComparison(
  asOf: Date,
  timeZone: string,
): HistoricalPresentationOptions {
  const timeFrame = buildAnalyticsTimeFrame({
    asOf,
    requestedRange: 90,
    allTimeStart: null,
    timeZone,
  })

  return {
    ...options,
    buckets: buildAnalyticsBucketsFromTimeFrame(timeFrame),
    end: asOf,
    start: new Date(timeFrame.periodStart!),
    timeFrame,
    timeZone,
  }
}
