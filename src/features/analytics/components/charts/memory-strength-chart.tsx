import type { ChartConfig } from '@/components/ui/chart'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import { ChartEmptyState, chartDimension, formatDays } from './chart-shared'
import type { StabilityPoint } from './types'

const memoryStrengthChartConfig = {
  medianStabilityDays: {
    label: 'Median stability',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig

export function MemoryStrengthChart({ data }: { data: StabilityPoint[] }) {
  const points = data.filter(
    (point): point is StabilityPoint & { medianStabilityDays: number } =>
      point.medianStabilityDays !== null,
  )

  if (points.length === 0) {
    return (
      <ChartEmptyState
        detail="FSRS stability becomes useful here after review logs provide a reliable interval history."
        message="No memory strength trend available yet."
      />
    )
  }

  return (
    <ChartContainer
      accessibleDescription="Median FSRS stability in each selected time bucket. Higher stability generally means the problem can go longer between reviews."
      accessibleName="Memory strength chart"
      aria-label="Memory strength chart"
      aria-roledescription="area chart"
      className="aspect-auto h-64 min-h-[16rem]"
      config={memoryStrengthChartConfig}
      initialDimension={chartDimension}
      role="img"
    >
      <AreaChart
        accessibilityLayer
        data={points}
        margin={{ bottom: 4, left: 0, right: 8, top: 8 }}
      >
        <defs>
          <linearGradient id="memory-strength-fill" x1="0" x2="0" y1="0" y2="1">
            <stop
              offset="5%"
              stopColor="var(--color-medianStabilityDays)"
              stopOpacity={0.3}
            />
            <stop
              offset="95%"
              stopColor="var(--color-medianStabilityDays)"
              stopOpacity={0}
            />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--color-border)" vertical={false} />
        <XAxis axisLine={false} dataKey="bucketStart" tickLine={false} />
        <YAxis
          axisLine={false}
          tickFormatter={formatDays}
          tickLine={false}
          width={42}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              active={false}
              formatter={(value) => [
                formatDays(typeof value === 'number' ? value : null),
                'Median stability',
              ]}
              payload={[]}
            />
          }
        />
        <Area
          dataKey="medianStabilityDays"
          fill="url(#memory-strength-fill)"
          fillOpacity={1}
          isAnimationActive={false}
          name="Median stability"
          stroke="var(--color-medianStabilityDays)"
          strokeWidth={2.5}
          type="monotone"
        />
      </AreaChart>
    </ChartContainer>
  )
}
