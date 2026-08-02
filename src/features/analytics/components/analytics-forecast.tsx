// src/features/analytics/components/analytics-forecast.tsx
import { Surface } from '@/components/ui/surface'
import type { ForecastEntry } from '@/features/analytics'
import { cn } from '@/utils/cn'

const MAX_BAR_HEIGHT = 80

export function AnalyticsForecast({
  forecast,
}: {
  forecast: ForecastEntry[]
}) {
  // ⚡ Bolt: Use .reduce instead of Math.max(...map) for O(n) time and O(1) space complexity
  // and to avoid Maximum Call Stack Exceeded errors on large arrays.
  const max = forecast.reduce((acc, e) => Math.max(acc, e.dueCount), 1)

  return (
    <Surface
      aria-label="14-day due forecast"
      className="grid gap-3"
      role="region"
    >
      <div className="text-[length:var(--cp-kicker-font-size)] font-bold uppercase leading-none text-muted-foreground">
        14-Day Due Forecast
      </div>

      <div
        className="flex items-end gap-1"
        style={{ height: `${MAX_BAR_HEIGHT + 20}px` }}
      >
        {forecast.map((entry, i) => {
          const isToday = i === 0
          const barHeight =
            entry.dueCount > 0
              ? Math.max((entry.dueCount / max) * MAX_BAR_HEIGHT, 3)
              : 0

          return (
            <div
              key={entry.date}
              className="flex flex-1 flex-col items-center gap-1 self-end"
              data-testid="forecast-bar"
            >
              <div
                className={cn(
                  'w-full rounded-t-[3px] bg-primary',
                  isToday ? 'opacity-100' : 'opacity-60',
                )}
                style={{ height: `${barHeight}px` }}
              />
              <div className="overflow-hidden whitespace-nowrap text-center text-[0.6rem] text-muted-foreground">
                {isToday ? 'Today' : formatBarDate(entry.date)}
              </div>
            </div>
          )
        })}
      </div>

      <div className="h-px bg-border" />

      <div className="flex gap-3">
        <span className="flex items-center gap-1 text-[0.68rem] text-muted-foreground">
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2 rounded-[2px] bg-primary opacity-100"
          />
          Today
        </span>
        <span className="flex items-center gap-1 text-[0.68rem] text-muted-foreground">
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2 rounded-[2px] bg-primary opacity-60"
          />
          Upcoming
        </span>
      </div>
    </Surface>
  )
}

const barDateFormatter = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})

function formatBarDate(dateStr: string): string {
  return barDateFormatter.format(new Date(dateStr))
}
