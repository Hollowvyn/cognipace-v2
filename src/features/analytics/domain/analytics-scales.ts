export type NumericDomain = readonly [number, number]

const NICE_FACTORS = [1, 2, 5] as const

export function buildAdaptivePercentageDomain(
  values: readonly number[],
  references: readonly number[],
): NumericDomain {
  const points = finiteValues([...values, ...references])
  if (points.length === 0) return [0, 1]

  const [lower, upper] = buildCenteredDomain(
    Math.min(...points),
    Math.max(...points),
    0.25,
    1.5,
    0,
    1,
  )

  return [
    clamp(roundDown(lower, 0.05), 0, 1),
    clamp(roundUp(upper, 0.05), 0, 1),
  ]
}

export function buildAdaptiveDurationDomain(
  values: readonly number[],
): NumericDomain {
  const points = finiteValues(values)
  if (points.length === 0) return [0, 2]

  const [lower, upper] = buildCenteredDomain(
    Math.min(...points),
    Math.max(...points),
    2,
    1.5,
    0,
  )

  const step = niceStep(Number(((upper - lower) / 2).toFixed(12)))
  return [Math.max(0, niceFloorTo(lower, step)), niceCeilTo(upper, step)]
}

export function buildCountDomain(
  values: readonly number[],
  references: readonly number[] = [],
): NumericDomain {
  const peak = Math.max(0, ...finiteValues([...values, ...references]))
  if (peak === 0) return [0, 1]

  return [0, niceCeil(Math.max(1, peak) * 1.1)]
}

export function buildLogDurationDomain(
  values: readonly number[],
  reference = 7,
): NumericDomain {
  const points = finiteValues([
    ...values,
    7,
    ...(Number.isFinite(reference) && reference > 0 ? [reference] : []),
  ]).filter((value) => value > 0)
  const minimum = Math.min(...points)
  const maximum = Math.max(...points)

  return [
    10 ** Math.floor(Math.log10(minimum)),
    10 ** Math.ceil(Math.log10(maximum)),
  ]
}

function buildCenteredDomain(
  lower: number,
  upper: number,
  minimumWindow: number,
  expansion: number,
  lowerClamp: number,
  upperClamp?: number,
): [number, number] {
  const window = Math.max((upper - lower) * expansion, minimumWindow)
  let domainLower = (lower + upper) / 2 - window / 2
  let domainUpper = domainLower + window

  if (domainLower < lowerClamp) {
    domainLower = lowerClamp
    domainUpper = lowerClamp + window
  }

  if (upperClamp !== undefined && domainUpper > upperClamp) {
    domainUpper = upperClamp
    domainLower = upperClamp - window
  }

  if (upperClamp !== undefined && window >= upperClamp - lowerClamp) {
    return [lowerClamp, upperClamp]
  }

  return [domainLower, domainUpper]
}

function finiteValues(values: readonly number[]): number[] {
  return values.filter(Number.isFinite)
}

function clamp(value: number, lower: number, upper: number): number {
  return Math.min(upper, Math.max(lower, value))
}

function roundDown(value: number, step: number): number {
  return Number(
    (Math.floor((value + Number.EPSILON) / step) * step).toFixed(12),
  )
}

function roundUp(value: number, step: number): number {
  return Number((Math.ceil((value - Number.EPSILON) / step) * step).toFixed(12))
}

function niceStep(value: number): number {
  if (value <= 0 || !Number.isFinite(value)) return 1

  const magnitude = 10 ** Math.floor(Math.log10(value))
  const factor = NICE_FACTORS.find(
    (candidate) => candidate * magnitude >= value,
  )

  return factor === undefined ? 10 * magnitude : factor * magnitude
}

function niceFloorTo(value: number, step: number): number {
  if (value <= 0) return 0
  return Number((Math.floor(value / step) * step).toFixed(12))
}

function niceCeilTo(value: number, step: number): number {
  if (value <= 0) return 0
  return Number((Math.ceil(value / step) * step).toFixed(12))
}

function niceCeil(value: number): number {
  if (value <= 1) return 1

  const magnitude = 10 ** Math.floor(Math.log10(value))
  const factor = NICE_FACTORS.find(
    (candidate) => candidate * magnitude >= value,
  )

  return factor === undefined ? 10 * magnitude : factor * magnitude
}
