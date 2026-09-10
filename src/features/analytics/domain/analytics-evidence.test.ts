import { describe, expect, it } from 'vitest'

import {
  buildEvidenceStates,
  classifyAnalyticsEvidence,
  type AnalyticsEvidenceClassificationInput,
  type AnalyticsEvidenceInput,
} from './analytics-evidence'

const baseInput: AnalyticsEvidenceInput = {
  hasMeasurement: true,
  isPartial: true,
  isReconstructed: true,
  trendSupported: false,
}

describe('analytics evidence', () => {
  it('keeps measured, in-progress, reconstructed, and insufficient evidence distinct', () => {
    expect(buildEvidenceStates(baseInput)).toEqual([
      'measured',
      'in-progress',
      'reconstructed',
      'insufficient-evidence',
    ])
  })

  it('uses not-measured instead of a fabricated zero and does not add trend status', () => {
    expect(
      buildEvidenceStates({
        hasMeasurement: false,
        isPartial: false,
        isReconstructed: false,
        trendSupported: false,
      }),
    ).toEqual(['not-measured'])
  })
})

const date = (value: string) => new Date(value)

function createInput(
  overrides: Partial<AnalyticsEvidenceClassificationInput> = {},
): AnalyticsEvidenceClassificationInput {
  return {
    asOf: date('2026-05-30T12:00:00.000Z'),
    periodStart: date('2026-04-01T00:00:00.000Z'),
    timeZone: 'UTC',
    buckets: [],
    ...overrides,
  }
}

function measuredBucket(
  key: string,
  observations: readonly { observedAt: Date; value: number | null }[],
) {
  return { key, observations }
}

describe('analytics evidence display classifier', () => {
  it('uses a single measured bucket as one mark after 30 local calendar days', () => {
    expect(
      classifyAnalyticsEvidence(
        createInput({
          buckets: [
            measuredBucket('2026-05-01', [
              { observedAt: date('2026-05-01T12:00:00.000Z'), value: 0.8 },
            ]),
          ],
        }),
      ),
    ).toEqual({
      historyDays: 30,
      measuredBuckets: 1,
      observations: 1,
      tableOnly: false,
      displayMode: 'single',
      supportsLine: false,
      supportsDirection: false,
    })
  })

  it.each([
    ['29 days', '2026-05-02T12:00:00.000Z', 'table'],
    ['30 days', '2026-05-01T12:00:00.000Z', 'single'],
  ] as const)(
    'uses the correct display mode at the H %s boundary',
    (_label, observedAt, displayMode) => {
      const result = classifyAnalyticsEvidence(
        createInput({
          buckets: [
            measuredBucket('observed', [
              { observedAt: date(observedAt), value: 0.8 },
            ]),
          ],
        }),
      )

      expect(result.historyDays).toBe(displayMode === 'table' ? 29 : 30)
      expect(result.tableOnly).toBe(displayMode === 'table')
      expect(result.displayMode).toBe(displayMode)
      expect(result.supportsLine).toBe(false)
      expect(result.supportsDirection).toBe(false)
    },
  )

  it.each([
    [1, 'single'],
    [2, 'marks'],
    [5, 'marks'],
    [6, 'marks'],
  ] as const)(
    'classifies M = %i as %s without enough total observations for a trend',
    (measuredBuckets, displayMode) => {
      const result = classifyAnalyticsEvidence(
        createInput({
          buckets: Array.from({ length: measuredBuckets }, (_, index) =>
            measuredBucket(`bucket-${index}`, [
              {
                observedAt: date(
                  `2026-05-${String(index + 1).padStart(2, '0')}T12:00:00.000Z`,
                ),
                value: 0.8,
              },
            ]),
          ),
        }),
      )

      expect(result.measuredBuckets).toBe(measuredBuckets)
      expect(result.displayMode).toBe(displayMode)
      expect(result.supportsLine).toBe(false)
      expect(result.supportsDirection).toBe(false)
    },
  )

  it.each([
    [29, 'marks'],
    [30, 'trend'],
  ] as const)(
    'requires S = 30 observations before M = 6 supports a trend',
    (observations, displayMode) => {
      const buckets = Array.from({ length: 6 }, (_, index) =>
        measuredBucket(`bucket-${index}`, [
          {
            observedAt: date(
              `2026-05-${String(index + 1).padStart(2, '0')}T12:00:00.000Z`,
            ),
            value: 0.8,
          },
        ]),
      )
      buckets[0]!.observations = Array.from(
        { length: observations - 5 },
        () => ({
          observedAt: date('2026-05-01T12:00:00.000Z'),
          value: 0.8,
        }),
      )

      const result = classifyAnalyticsEvidence(createInput({ buckets }))

      expect(result.observations).toBe(observations)
      expect(result.displayMode).toBe(displayMode)
      expect(result.supportsLine).toBe(displayMode === 'trend')
      expect(result.supportsDirection).toBe(displayMode === 'trend')
    },
  )

  it('starts H at the first eligible metric observation after the selected start', () => {
    const result = classifyAnalyticsEvidence(
      createInput({
        asOf: date('2026-03-30T12:00:00.000Z'),
        periodStart: date('2026-01-01T00:00:00.000Z'),
        buckets: [
          measuredBucket('before-period', [
            { observedAt: date('2025-12-31T23:00:00.000Z'), value: 0.8 },
          ]),
          measuredBucket('first-eligible', [
            { observedAt: date('2026-03-01T00:00:00.000Z'), value: 0.8 },
          ]),
        ],
      }),
    )

    expect(result).toMatchObject({
      historyDays: 30,
      measuredBuckets: 1,
      observations: 1,
      displayMode: 'single',
    })
  })

  it('does not treat null, invalid, or future observations as measured and leaves empty buckets intact', () => {
    const buckets = [
      measuredBucket('empty', []),
      measuredBucket('unknown', [
        { observedAt: date('2026-05-01T12:00:00.000Z'), value: null },
        { observedAt: new Date('invalid'), value: 0.8 },
        { observedAt: date('2026-06-01T12:00:00.000Z'), value: 0.8 },
      ]),
      measuredBucket('measured', [
        { observedAt: date('2026-05-01T12:00:00.000Z'), value: 0.8 },
      ]),
    ]
    const originalKeys = buckets.map((bucket) => bucket.key)

    const result = classifyAnalyticsEvidence(createInput({ buckets }))

    expect(result).toMatchObject({ measuredBuckets: 1, observations: 1 })
    expect(buckets.map((bucket) => bucket.key)).toEqual(originalKeys)
    expect(buckets[0]?.observations).toEqual([])
  })

  it('counts local calendar days through DST and local midnight instead of 24-hour intervals', () => {
    const result = classifyAnalyticsEvidence(
      createInput({
        asOf: date('2026-04-06T12:00:00.000Z'),
        periodStart: date('2026-03-01T05:00:00.000Z'),
        timeZone: 'America/New_York',
        buckets: [
          measuredBucket('spring-forward', [
            { observedAt: date('2026-03-08T05:00:00.000Z'), value: 0.8 },
          ]),
        ],
      }),
    )

    expect(result).toMatchObject({
      historyDays: 30,
      displayMode: 'single',
    })
  })

  it('returns table-only evidence for empty selected data', () => {
    expect(classifyAnalyticsEvidence(createInput())).toEqual({
      historyDays: 0,
      measuredBuckets: 0,
      observations: 0,
      tableOnly: true,
      displayMode: 'table',
      supportsLine: false,
      supportsDirection: false,
    })
  })

  it('returns table-only evidence for invalid classifier input', () => {
    expect(
      classifyAnalyticsEvidence(
        createInput({
          asOf: new Date('invalid'),
          periodStart: null,
          buckets: [],
        }),
      ),
    ).toEqual({
      historyDays: 0,
      measuredBuckets: 0,
      observations: 0,
      tableOnly: true,
      displayMode: 'table',
      supportsLine: false,
      supportsDirection: false,
    })
  })
})
