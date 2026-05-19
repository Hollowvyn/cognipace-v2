import { SurfaceCard } from '@/components/ui/surface-card'
import { useAppShellData } from '@/features/app-shell'
import { useExtensionPing } from '@/hooks/use-extension-ping'

export function OverviewPage() {
  const shell = useAppShellData('dashboard')
  const ping = useExtensionPing('dashboard')
  const data = shell.data

  return (
    <div className="cp-stack">
      <header>
        <p className="cp-kicker">Overview</p>
        <h2 className="cp-title">Extension foundation</h2>
        <p className="cp-copy">
          This shell proves routing, providers, background messaging, and the
          shared layout are in place before product UI polish.
        </p>
      </header>

      <SurfaceCard>
        <p className="cp-kicker">Runtime</p>
        <h3 className="cp-title">
          {ping.isSuccess ? 'Background connected' : 'Connecting to background'}
        </h3>
        <p className="cp-copy">
          {data?.status.detail ?? 'Waiting for shell data.'}
        </p>
      </SurfaceCard>

      <section className="grid gap-3 md:grid-cols-2">
        <SurfaceCard>
          <p className="cp-kicker">Recommended Now</p>
          <h3 className="cp-title">
            {data?.recommendation.title ?? 'Loading recommendation'}
          </h3>
          <p className="cp-copy">{data?.recommendation.detail}</p>
        </SurfaceCard>
        <SurfaceCard>
          <p className="cp-kicker">Active Track</p>
          <h3 className="cp-title">
            {data?.activeTrack.title ?? 'Loading track'}
          </h3>
          <p className="cp-copy">{data?.activeTrack.detail}</p>
        </SurfaceCard>
      </section>
    </div>
  )
}
