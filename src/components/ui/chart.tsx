import * as React from 'react'
import * as RechartsPrimitive from 'recharts'

import { cn } from '@/utils/cn'

const CHART_THEMES = {
  light: ":root, [data-cp-theme='light'], [data-cp-theme='system']",
  dark: "[data-cp-theme='dark']",
} as const

export type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode
    icon?: React.ComponentType
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof CHART_THEMES, string> }
  )
>

interface ChartContextValue {
  config: ChartConfig
}

const ChartContext = React.createContext<ChartContextValue | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)

  if (!context) {
    throw new Error('useChart must be used within a <ChartContainer />')
  }

  return context
}

export interface ChartContainerProps extends React.ComponentProps<'div'> {
  config: ChartConfig
  children: React.ComponentProps<
    typeof RechartsPrimitive.ResponsiveContainer
  >['children']
  /** Provides deterministic dimensions before ResponsiveContainer measures the DOM. */
  initialDimension?: React.ComponentProps<
    typeof RechartsPrimitive.ResponsiveContainer
  >['initialDimension']
}

export const ChartContainer = React.forwardRef<
  HTMLDivElement,
  ChartContainerProps
>(({ id, className, children, config, initialDimension, ...props }, ref) => {
  const uniqueId = React.useId()
  const chartId = `chart-${id ?? uniqueId.replace(/:/g, '')}`

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        {...props}
        ref={ref}
        data-chart={chartId}
        className={cn(
          'relative flex aspect-video min-h-48 w-full min-w-0 justify-center text-xs',
          '[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground',
          '[&_.recharts-cartesian-grid_line[stroke="#ccc"]]:stroke-border/50',
          '[&_.recharts-curve.recharts-tooltip-cursor]:stroke-border',
          '[&_.recharts-dot[stroke="#fff"]]:stroke-transparent',
          '[&_.recharts-layer]:outline-none',
          '[&_.recharts-polar-grid_[stroke="#ccc"]]:stroke-border',
          '[&_.recharts-radial-bar-background-sector]:fill-muted',
          '[&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted',
          '[&_.recharts-reference-line_[stroke="#ccc"]]:stroke-border',
          '[&_.recharts-sector[stroke="#fff"]]:stroke-transparent',
          '[&_.recharts-surface]:outline-none',
          className,
        )}
      >
        <ChartStyle config={config} id={chartId} />
        <RechartsPrimitive.ResponsiveContainer
          height="100%"
          minHeight="12rem"
          width="100%"
          {...(initialDimension ? { initialDimension } : {})}
        >
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
})
ChartContainer.displayName = 'Chart'

function ChartStyle({ config, id }: { config: ChartConfig; id: string }) {
  const colorConfig = Object.entries(config).filter(
    ([, itemConfig]) => itemConfig.theme || itemConfig.color,
  )

  if (!colorConfig.length) {
    return null
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(CHART_THEMES)
          .map(
            ([theme, selector]) => `
${selector} [data-chart="${id}"] {
${colorConfig
  .map(([key, itemConfig]) => {
    const color =
      itemConfig.theme?.[theme as keyof typeof CHART_THEMES] ?? itemConfig.color

    return color ? `  --color-${key}: ${color};` : null
  })
  .filter(Boolean)
  .join('\n')}
}
`,
          )
          .join('\n'),
      }}
    />
  )
}

export const ChartTooltip = RechartsPrimitive.Tooltip

type ChartTooltipContentProps = React.ComponentProps<'div'> &
  Pick<
    RechartsPrimitive.TooltipContentProps,
    'active' | 'label' | 'labelFormatter' | 'payload' | 'formatter'
  > & {
    color?: string
    hideIndicator?: boolean
    hideLabel?: boolean
    indicator?: 'line' | 'dot' | 'dashed'
    labelClassName?: string
    labelKey?: string
    nameKey?: string
  }

export const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  ChartTooltipContentProps
>(
  (
    {
      active,
      className,
      color,
      formatter,
      hideIndicator = false,
      hideLabel = false,
      indicator = 'dot',
      label,
      labelClassName,
      labelFormatter,
      labelKey,
      nameKey,
      payload,
      ...props
    },
    ref,
  ) => {
    const { config } = useChart()

    const tooltipLabel = React.useMemo(() => {
      if (hideLabel || !payload?.length) {
        return null
      }

      const [item] = payload
      const key = String(labelKey ?? item?.dataKey ?? item?.name ?? 'value')
      const itemConfig = getPayloadConfigFromPayload(config, item, key)
      const value =
        !labelKey && typeof label === 'string'
          ? (config[label]?.label ?? label)
          : itemConfig?.label

      if (labelFormatter) {
        return (
          <div className={cn('font-medium', labelClassName)}>
            {labelFormatter(value, payload)}
          </div>
        )
      }

      if (!value) {
        return null
      }

      return <div className={cn('font-medium', labelClassName)}>{value}</div>
    }, [
      config,
      hideLabel,
      label,
      labelClassName,
      labelFormatter,
      labelKey,
      payload,
    ])

    if (!active || !payload?.length) {
      return null
    }

    const nestLabel = payload.length === 1 && indicator !== 'dot'

    return (
      <div
        {...props}
        ref={ref}
        className={cn(
          'grid min-w-32 items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl',
          className,
        )}
      >
        {!nestLabel ? tooltipLabel : null}
        <div className="grid gap-1.5">
          {payload
            .filter((item) => item.type !== 'none')
            .map((item, index) => {
              const key = String(
                nameKey ?? item.name ?? item.dataKey ?? 'value',
              )
              const itemConfig = getPayloadConfigFromPayload(config, item, key)
              const indicatorColor = color ?? item.payload?.fill ?? item.color
              const Icon = itemConfig?.icon

              return (
                <div
                  key={`${key}-${index}`}
                  className={cn(
                    'flex w-full flex-wrap items-stretch gap-2',
                    '[&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground',
                    indicator === 'dot' && 'items-center',
                  )}
                >
                  {Icon ? (
                    <Icon />
                  ) : (
                    !hideIndicator && (
                      <div
                        className={cn(
                          'shrink-0 rounded-[2px] border-[--color-border] bg-[--color-bg]',
                          {
                            'h-2.5 w-2.5': indicator === 'dot',
                            'w-1': indicator === 'line',
                            'w-0 border-[1.5px] border-dashed bg-transparent':
                              indicator === 'dashed',
                            'my-0.5': nestLabel && indicator === 'dashed',
                          },
                        )}
                        style={
                          {
                            '--color-bg': indicatorColor,
                            '--color-border': indicatorColor,
                          } as React.CSSProperties
                        }
                      />
                    )
                  )}
                  <div
                    className={cn(
                      'flex flex-1 justify-between leading-none',
                      nestLabel ? 'items-end' : 'items-center',
                    )}
                  >
                    <div className="grid gap-1.5">
                      {nestLabel ? tooltipLabel : null}
                      <span className="text-muted-foreground">
                        {itemConfig?.label ?? item.name}
                      </span>
                    </div>
                    {item.value != null && (
                      <span className="font-mono font-medium tabular-nums text-foreground">
                        {item.value.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
        </div>
      </div>
    )
  },
)
ChartTooltipContent.displayName = 'ChartTooltip'

export const ChartLegend = RechartsPrimitive.Legend

type ChartLegendContentProps = React.ComponentProps<'div'> & {
  hideIcon?: boolean
  nameKey?: string
  payload?: ReadonlyArray<RechartsPrimitive.LegendPayload>
  verticalAlign?: RechartsPrimitive.LegendProps['verticalAlign']
}

export const ChartLegendContent = React.forwardRef<
  HTMLDivElement,
  ChartLegendContentProps
>(
  (
    {
      className,
      hideIcon = false,
      nameKey,
      payload,
      verticalAlign = 'bottom',
      ...props
    },
    ref,
  ) => {
    const { config } = useChart()

    if (!payload?.length) {
      return null
    }

    return (
      <div
        {...props}
        ref={ref}
        className={cn(
          'flex items-center justify-center gap-4',
          verticalAlign === 'top' ? 'pb-3' : 'pt-3',
          className,
        )}
      >
        {payload
          .filter((item) => item.type !== 'none')
          .map((item, index) => {
            const key = String(nameKey ?? item.dataKey ?? 'value')
            const itemConfig = getPayloadConfigFromPayload(config, item, key)
            const Icon = itemConfig?.icon

            return (
              <div
                key={`${key}-${index}`}
                className="flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground"
              >
                {Icon && !hideIcon ? (
                  <Icon />
                ) : (
                  <div
                    aria-hidden="true"
                    className="h-2 w-2 shrink-0 rounded-[2px]"
                    style={{ backgroundColor: item.color }}
                  />
                )}
                {itemConfig?.label ?? item.value}
              </div>
            )
          })}
      </div>
    )
  },
)
ChartLegendContent.displayName = 'ChartLegend'

function getPayloadConfigFromPayload(
  config: ChartConfig,
  payload: unknown,
  key: string,
) {
  if (typeof payload !== 'object' || payload === null) {
    return undefined
  }

  const payloadRecord = payload as Record<string, unknown>
  const nestedPayload =
    typeof payloadRecord.payload === 'object' && payloadRecord.payload !== null
      ? (payloadRecord.payload as Record<string, unknown>)
      : undefined

  const configLabelKey =
    typeof payloadRecord[key] === 'string'
      ? payloadRecord[key]
      : typeof nestedPayload?.[key] === 'string'
        ? nestedPayload[key]
        : key

  return config[configLabelKey] ?? config[key]
}

export { ChartStyle }
