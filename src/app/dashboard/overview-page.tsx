import { Surface } from '@/components/ui/surface'
import { useDashboardAppShellData } from '@/features/app-shell'
import { useExtensionPing } from '@/hooks/use-extension-ping'

export function OverviewPage() {
  const shell = useDashboardAppShellData()
  const ping = useExtensionPing('dashboard')
  const data = shell.data

  return (
    <div className="flex flex-col gap-[var(--cp-surface-gap)]">
      <header>
        <p className="m-0 text-[length:var(--cp-kicker-font-size)] font-bold uppercase leading-none text-muted-foreground">
          Overview
        </p>
        <h2 className="mt-1 text-[length:var(--cp-title-font-size)] font-bold leading-tight text-foreground">
          Extension Foundation
        </h2>
        <p className="mt-1 max-w-2xl text-[length:var(--cp-copy-font-size)] leading-relaxed text-muted-foreground">
          This shell proves routing, providers, background messaging, and the
          shared layout are in place before product UI polish.
        </p>
      </header>

      <Surface>
        <p className="m-0 text-[length:var(--cp-kicker-font-size)] font-bold uppercase leading-none text-muted-foreground">
          Runtime
        </p>
        <h3 className="mt-1 text-[length:var(--cp-title-font-size)] font-bold leading-tight text-foreground">
          {ping.isSuccess ? 'Background connected' : 'Connecting to background'}
        </h3>
        <p className="mt-1 text-[length:var(--cp-copy-font-size)] leading-relaxed text-muted-foreground">
          {data?.status.detail ?? 'Waiting for shell data.'}
        </p>
      </Surface>

      <section className="grid gap-3 md:grid-cols-2">
        <Surface>
          <p className="m-0 text-[length:var(--cp-kicker-font-size)] font-bold uppercase leading-none text-muted-foreground">
            Recommended Now
          </p>
          <h3 className="mt-1 text-[length:var(--cp-title-font-size)] font-bold leading-tight text-foreground">
            {data?.recommendation.title ?? 'Loading recommendation'}
          </h3>
          <p className="mt-1 text-[length:var(--cp-copy-font-size)] leading-relaxed text-muted-foreground">
            {data?.recommendation.detail}
          </p>
        </Surface>
        <Surface>
          <p className="m-0 text-[length:var(--cp-kicker-font-size)] font-bold uppercase leading-none text-muted-foreground">
            Active Track
          </p>
          <h3 className="mt-1 text-[length:var(--cp-title-font-size)] font-bold leading-tight text-foreground">
            {data?.activeTrack.title ?? 'Loading track'}
          </h3>
          <p className="mt-1 text-[length:var(--cp-copy-font-size)] leading-relaxed text-muted-foreground">
            {data?.activeTrack.detail}
          </p>
        </Surface>
      </section>
    </div>
  )
}
