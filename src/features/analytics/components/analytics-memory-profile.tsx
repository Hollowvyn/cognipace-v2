import { Surface } from '@/components/ui/surface'
import { cn } from '@/utils/cn'

import type { SerializedAnalyticsSummary } from '../api/analytics-contracts'

interface AnalyticsMemoryProfileProps {
  profile: SerializedAnalyticsSummary['memoryProfile']
}

export function AnalyticsMemoryProfile({
  profile,
}: AnalyticsMemoryProfileProps) {
  const averageRetrievability = profile.averageRetrievability
  const hasRetrievability = averageRetrievability !== null
  const retrievabilityLabel = hasRetrievability
    ? `${Math.round(averageRetrievability * 100)}%`
    : 'Not enough review data'

  return (
    <Surface aria-label="Memory profile" className="grid gap-3" role="region">
      <h2 className="m-0 text-[length:var(--cp-kicker-font-size)] font-bold uppercase leading-none text-muted-foreground">
        Memory Profile
      </h2>

      <div className="grid min-w-0 gap-3 sm:grid-cols-3">
        <div className="grid min-h-[5rem] gap-2 rounded-[var(--cp-control-radius)] border border-border bg-muted p-3">
          <div className="text-[length:var(--cp-kicker-font-size)] font-bold uppercase leading-none text-muted-foreground">
            Total Tracked
          </div>
          <div className="text-3xl font-bold leading-none text-foreground tabular-nums">
            {profile.totalTracked}
          </div>
        </div>

        <div className="grid min-h-[5rem] gap-2 rounded-[var(--cp-control-radius)] border border-border bg-muted p-3">
          <div className="text-[length:var(--cp-kicker-font-size)] font-bold uppercase leading-none text-muted-foreground">
            Avg Retrievability
          </div>
          <div
            className={cn(
              'font-bold leading-none text-foreground tabular-nums',
              hasRetrievability ? 'text-3xl' : 'text-base leading-tight',
            )}
          >
            {retrievabilityLabel}
          </div>
          {profile.lowSample && hasRetrievability ? (
            <p className="m-0 text-[length:var(--cp-badge-font-size)] leading-snug text-muted-foreground">
              Limited review sample
            </p>
          ) : null}
        </div>

        <div className="grid min-h-[5rem] gap-2 rounded-[var(--cp-control-radius)] border border-border bg-muted p-3">
          <div className="text-[length:var(--cp-kicker-font-size)] font-bold uppercase leading-none text-muted-foreground">
            Overdue
          </div>
          <div className="text-3xl font-bold leading-none text-foreground tabular-nums">
            {profile.overdue}
          </div>
        </div>
      </div>

      <p className="m-0 text-[length:var(--cp-badge-font-size)] leading-snug text-muted-foreground">
        <span>{profile.dueToday} due today</span>
        {' | '}
        <span>{profile.learning} learning</span>
        {' | '}
        <span>{profile.review} review</span>
        {' | '}
        <span>{profile.mastered} mastered</span>
        {' | '}
        <span>{profile.suspended} suspended</span>
      </p>
    </Surface>
  )
}
