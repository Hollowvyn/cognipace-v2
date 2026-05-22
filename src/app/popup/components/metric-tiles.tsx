import { Surface } from '@/components/ui/surface'
import type { PopupAppShellData } from '@/features/app-shell'

export function MetricTiles({
  metrics,
}: {
  metrics: PopupAppShellData['metrics']
}) {
  return (
    <section
      aria-label="Practice Metrics"
      className="grid grid-cols-2 gap-[var(--cp-space-2)]"
    >
      {metrics.slice(0, 2).map((metric) => (
        <Surface className="min-h-[4.25rem] !p-3" key={metric.label}>
          <dl className="m-0">
            <dt className="m-0 text-[0.6875rem] font-bold uppercase leading-none text-muted-foreground">
              {metric.label}
            </dt>
            <dd className="m-0 mt-1.5 block text-[1.125rem] font-extrabold leading-none text-foreground tabular-nums">
              {metric.value}
            </dd>
          </dl>
        </Surface>
      ))}
    </section>
  )
}
