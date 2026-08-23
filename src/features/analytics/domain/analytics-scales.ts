export type AnalyticsDomain = readonly [number, number]

const percentageStep = 0.05

export function buildAdaptivePercentageDomain(
  values: readonly number[],
  references: readonly number[] = [],
): AnalyticsDomain {
  const visibleValues = finiteValues([...values, ...references])
  if (visibleValues.length === 0) return [0, 1]

  const lo = Math.min(...visibleValues)
  const hi = Math.max(...visibleValues)
  const window = Math.max((hi - lo) * 1.5, 0.25)
  const center = (lo + hi) / 2
  let lower = center - window / 2
  let upper = center + window / 2

  if (lower < 0) {
    upper = Math.min(1, upper - lower)
    lower = 0
  }
  if (upper > 1) {
    lower = Math.max(0, lower - (upper - 1))
    upper = 1
  }

  return [roundDown(lower, percentageStep), roundUp(upper, percentageStep)]
}

export function buildMagnitudeDomain(
  values: readonly number[],
  requiredReference = 0,
): AnalyticsDomain {
  const peak = Math.max(0, requiredReference, ...finiteValues(values))
  if (peak === 0) return [0, 1]

  return [0, niceCeil(Math.max(1, peak) * 1.1)]
}

export function buildLogDurationDomain(
  values: readonly number[],
  benchmark = 7,
): AnalyticsDomain {
  const positiveValues = finiteValues([...values, benchmark]).filter(
    (value) => value > 0,
  )
  if (positiveValues.length === 0) return [1, 10]

  return [
    10 ** Math.floor(Math.log10(Math.min(...positiveValues))),
    10 ** Math.ceil(Math.log10(Math.max(...positiveValues))),
  ]
}

function finiteValues(values: readonly number[]): number[] {
  return values.filter(Number.isFinite)
}

function roundDown(value: number, step: number): number {
  return roundToStepPrecision(
    Math.max(0, Math.floor((value + Number.EPSILON) / step) * step),
    step,
  )
}

function roundUp(value: number, step: number): number {
  return roundToStepPrecision(
    Math.min(1, Math.ceil((value - Number.EPSILON) / step) * step),
    step,
  )
}

function roundToStepPrecision(value: number, step: number): number {
  const decimals = Math.max(0, Math.ceil(-Math.log10(step)))
  return Number(value.toFixed(decimals))
}

function niceCeil(value: number): number {
  const power = 10 ** Math.floor(Math.log10(value))
  const normalized = value / power
  const nice =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10

  return nice * power
}
