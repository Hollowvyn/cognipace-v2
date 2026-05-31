import { Badge } from '@/components/ui/badge'
import { InlineStatus } from '@/components/ui/inline-status'
import { Surface } from '@/components/ui/surface'
import type { WeakProblem } from '@/features/analytics'

export function AnalyticsWeakProblems({
  problems,
}: {
  problems: WeakProblem[]
}) {
  return (
    <Surface
      aria-label="Weak problems"
      className="grid gap-3"
      role="region"
    >
      <div className="text-[length:var(--cp-kicker-font-size)] font-bold uppercase leading-none text-muted-foreground">
        Weak Problems
      </div>

      {problems.length === 0 ? (
        <InlineStatus>No weak problems found — keep it up!</InlineStatus>
      ) : (
        <>
          <table className="w-full border-collapse text-[length:var(--cp-copy-font-size)]">
            <thead>
              <tr>
                <th className="border-b border-border pb-2 text-left text-[length:var(--cp-kicker-font-size)] font-bold uppercase text-muted-foreground">
                  Problem
                </th>
                <th className="border-b border-border pb-2 text-left text-[length:var(--cp-kicker-font-size)] font-bold uppercase text-muted-foreground">
                  Lapses
                </th>
                <th className="border-b border-border pb-2 text-right text-[length:var(--cp-kicker-font-size)] font-bold uppercase text-muted-foreground">
                  Retention
                </th>
              </tr>
            </thead>
            <tbody>
              {problems.map((problem) => {
                const pct = Math.round(problem.retrievability * 100)
                return (
                  <tr key={problem.slug}>
                    <td className="border-b border-border py-2">
                      <div className="font-medium text-foreground">
                        {problem.title}
                      </div>
                      <div className="text-[length:var(--cp-badge-font-size)] text-muted-foreground">
                        {problem.slug}
                      </div>
                    </td>
                    <td className="border-b border-border py-2">
                      <Badge tone="neutral">
                        {problem.lapseCount}{' '}
                        {problem.lapseCount === 1 ? 'lapse' : 'lapses'}
                      </Badge>
                    </td>
                    <td className="border-b border-border py-2 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                          <div
                            aria-hidden="true"
                            className="h-full rounded-full bg-primary"
                            style={{
                              width: `${pct}%`,
                            }}
                          />
                        </div>
                        <span className="tabular-nums text-foreground">
                          {pct}%
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="m-0 text-[length:var(--cp-badge-font-size)] text-muted-foreground">
            Sorted by lapses, then difficulty, then lowest retention. Suspended
            problems excluded.
          </p>
        </>
      )}
    </Surface>
  )
}
