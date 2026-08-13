import { Line } from 'recharts'
import type { LineDrawShapeProps } from 'recharts'

import { classifyLineContinuity } from '../../domain/chart-buckets'
import { DASHED_LINE_EVIDENCE_LABEL } from './chart-shared'

export { DASHED_LINE_EVIDENCE_LABEL }

interface LineSegment {
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
  yAxisId?: string
}

function getNumericValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function buildLineSegments<T extends Record<string, unknown>>(
  data: readonly T[],
  dataKey: keyof T & string,
  maximumGap: number,
): LineSegment[] {
  const continuity = classifyLineContinuity(
    data.map((point) => getNumericValue(point[dataKey])),
    maximumGap,
  )
  const segments: LineSegment[] = []
  let solidStart: number | null = null
  let solidEnd: number | null = null
  const flushSolid = () => {
    if (solidStart === null || solidEnd === null) return
    segments.push({
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
        fromIndex: connection.fromIndex,
        toIndex: connection.toIndex,
        kind: 'bridge',
      })
    }
  }
  flushSolid()
  return segments
}

const SEGMENT_VALUE_KEY = '__cpAnalyticsSegmentValue'

function maskSegmentData<T extends Record<string, unknown>>(
  data: readonly T[],
  dataKey: keyof T & string,
  fromIndex: number,
  toIndex: number,
): Array<T & Record<typeof SEGMENT_VALUE_KEY, number | null>> {
  return data.map((point, index) => ({
    ...point,
    [SEGMENT_VALUE_KEY]:
      index >= fromIndex && index <= toIndex
        ? getNumericValue(point[dataKey])
        : null,
  }))
}

function createBridgeShape(testId: string) {
  return function BridgeShape({
    points,
    stroke,
    strokeDasharray,
    strokeWidth,
  }: LineDrawShapeProps) {
    const endpoints = points?.filter(
      (point) => point.x !== null && point.y !== null,
    )
    const from = endpoints?.[0]
    const to = endpoints?.at(-1)

    if (!from || !to || from === to) return null

    return (
      <path
        aria-hidden="true"
        d={`M${from.x},${from.y}L${to.x},${to.y}`}
        data-testid={testId}
        fill="none"
        stroke={stroke}
        strokeDasharray={strokeDasharray}
        strokeWidth={strokeWidth}
      />
    )
  }
}

export function LineSegments<T extends Record<string, unknown>>({
  data,
  dataKey,
  maximumGap,
  seriesKey,
  stroke,
  strokeWidth = 2.5,
  type = 'monotone',
  yAxisId,
}: LineSegmentsProps<T>) {
  const segments = buildLineSegments(data, dataKey, maximumGap)

  if (segments.length === 0) return null

  return (
    <>
      <Line
        activeDot={false}
        aria-hidden="true"
        data={data}
        data-testid={`${seriesKey}-semantic-tooltip-source`}
        dataKey={dataKey}
        dot={false}
        isAnimationActive={false}
        legendType="none"
        name={seriesKey}
        stroke="transparent"
        strokeWidth={0}
        type={type}
        {...(yAxisId === undefined ? {} : { yAxisId })}
      />
      {segments.map((segment) => {
        const testId = `${seriesKey}-${segment.kind}-${segment.fromIndex}-${segment.toIndex}`

        return (
          <Line
            activeDot={false}
            aria-hidden="true"
            data={maskSegmentData(
              data,
              dataKey,
              segment.fromIndex,
              segment.toIndex,
            )}
            data-testid={testId}
            dataKey={
              SEGMENT_VALUE_KEY as keyof (T &
                Record<typeof SEGMENT_VALUE_KEY, number | null>) &
                string
            }
            dot={false}
            isAnimationActive={false}
            key={`${segment.kind}-${segment.fromIndex}-${segment.toIndex}`}
            legendType="none"
            name={seriesKey}
            stroke={stroke}
            {...(segment.kind === 'bridge'
              ? {
                  shape: createBridgeShape(testId),
                  strokeDasharray: '5 5',
                }
              : {})}
            strokeWidth={strokeWidth}
            tooltipType="none"
            type={type}
            {...(yAxisId === undefined ? {} : { yAxisId })}
          />
        )
      })}
    </>
  )
}
