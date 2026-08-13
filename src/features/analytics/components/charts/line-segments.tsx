import { Line } from 'recharts'

import { classifyLineContinuity } from '../../domain/chart-buckets'
import { DASHED_LINE_EVIDENCE_LABEL } from './chart-shared'

export { DASHED_LINE_EVIDENCE_LABEL }

interface LineSegment<T> {
  data: readonly T[]
  fromIndex: number
  toIndex: number
  kind: 'bridge' | 'solid'
}

export interface LineSegmentsProps<T extends Record<string, unknown>> {
  data: readonly T[]
  dataKey: keyof T & string
  maximumGap: number
  seriesKey: string
  stroke: string
  strokeWidth?: number
  type?: 'linear' | 'monotone'
}

function getNumericValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function buildLineSegments<T extends Record<string, unknown>>(
  data: readonly T[],
  dataKey: keyof T & string,
  maximumGap: number,
): LineSegment<T>[] {
  const continuity = classifyLineContinuity(
    data.map((point) => getNumericValue(point[dataKey])),
    maximumGap,
  )
  const segments: LineSegment<T>[] = []
  let solidStart: number | null = null
  let solidEnd: number | null = null
  const flushSolid = () => {
    if (solidStart === null || solidEnd === null) return
    segments.push({
      data: data.slice(solidStart, solidEnd + 1),
      fromIndex: solidStart,
      toIndex: solidEnd,
      kind: 'solid',
    })
    solidStart = null
    solidEnd = null
  }
  for (const connection of continuity) {
    if (connection.kind === 'solid') {
      if (solidEnd === connection.fromIndex) solidEnd = connection.toIndex
      else {
        flushSolid()
        solidStart = connection.fromIndex
        solidEnd = connection.toIndex
      }
      continue
    }
    flushSolid()
    if (connection.kind === 'bridge') {
      segments.push({
        data: [data[connection.fromIndex]!, data[connection.toIndex]!],
        fromIndex: connection.fromIndex,
        toIndex: connection.toIndex,
        kind: 'bridge',
      })
    }
  }
  flushSolid()
  return segments
}

export function LineSegments<T extends Record<string, unknown>>({
  data,
  dataKey,
  maximumGap,
  seriesKey,
  stroke,
  strokeWidth = 2.5,
  type = 'monotone',
}: LineSegmentsProps<T>) {
  return buildLineSegments(data, dataKey, maximumGap).map((segment) => (
    <Line
      activeDot={false}
      data={segment.data}
      data-testid={`${seriesKey}-${segment.kind}-${segment.fromIndex}-${segment.toIndex}`}
      dataKey={dataKey}
      dot={false}
      isAnimationActive={false}
      key={`${segment.kind}-${segment.fromIndex}-${segment.toIndex}`}
      legendType="none"
      name={seriesKey}
      stroke={stroke}
      {...(segment.kind === 'bridge' ? { strokeDasharray: '5 5' } : {})}
      strokeWidth={strokeWidth}
      tooltipType="none"
      type={type}
    />
  ))
}
