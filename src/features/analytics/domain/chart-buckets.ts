export type LineContinuity =
  | { kind: 'solid'; fromIndex: number; toIndex: number }
  | { kind: 'bridge'; fromIndex: number; toIndex: number }
  | { kind: 'unbridgeable'; fromIndex: number; toIndex: number }

export function recomputeBucketRatio(
  samples: readonly { numerator: number; denominator: number }[],
): number | null {
  const numerator = samples.reduce((sum, sample) => sum + sample.numerator, 0)
  const denominator = samples.reduce(
    (sum, sample) => sum + sample.denominator,
    0,
  )

  return denominator === 0 ? null : numerator / denominator
}

export function sumBucketValues(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0)
}

export function medianBucketValues(values: readonly number[]): number | null {
  if (values.length === 0) return null

  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)

  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!
}

export function lastBucketValue<T>(values: readonly T[]): T | null {
  return values.at(-1) ?? null
}

export function classifyLineContinuity(
  values: readonly (number | null)[],
  maximumGapBuckets: number,
): LineContinuity[] {
  if (!Number.isInteger(maximumGapBuckets) || maximumGapBuckets < 0) {
    throw new RangeError('Maximum chart gap must be a non-negative integer.')
  }

  const continuity: LineContinuity[] = []
  let previousValueIndex: number | null = null

  for (const [index, value] of values.entries()) {
    if (value === null) continue

    if (previousValueIndex !== null) {
      const gap = index - previousValueIndex - 1
      continuity.push({
        kind:
          gap === 0
            ? 'solid'
            : gap <= maximumGapBuckets
              ? 'bridge'
              : 'unbridgeable',
        fromIndex: previousValueIndex,
        toIndex: index,
      })
    }

    previousValueIndex = index
  }

  return continuity
}
