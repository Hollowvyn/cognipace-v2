import { ExternalLink, RefreshCw, Settings } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SurfaceCard } from '@/components/ui/surface-card'
import type { AppShellData } from '@/extension/messaging'

type PopupShellProps = {
  data: AppShellData
  pingLabel: string
}

export function PopupShell({ data, pingLabel }: PopupShellProps) {
  return (
    <main className="cp-surface cp-popup cp-stack p-4">
      <header className="cp-row">
        <div>
          <p className="cp-kicker">CogniPace</p>
          <h1 className="cp-title">Study loop</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            aria-label="Refresh queue"
            disabled
            size="icon"
            variant="ghost"
          >
            <RefreshCw />
          </Button>
          <Button
            aria-label="Open settings"
            disabled
            size="icon"
            variant="ghost"
          >
            <Settings />
          </Button>
        </div>
      </header>

      <SurfaceCard>
        <div className="cp-row">
          <div>
            <p className="cp-kicker">Status</p>
            <h2 className="cp-title">{data.status.label}</h2>
            <p className="cp-copy">{data.status.detail}</p>
          </div>
          <Badge>{pingLabel}</Badge>
        </div>
      </SurfaceCard>

      <section className="cp-metric-grid" aria-label="Practice metrics">
        {data.metrics.map((metric) => (
          <SurfaceCard key={metric.label}>
            <p className="cp-kicker">{metric.label}</p>
            <strong className="cp-metric-value">{metric.value}</strong>
          </SurfaceCard>
        ))}
      </section>

      <SurfaceCard>
        <p className="cp-kicker">Recommended Now</p>
        <h2 className="cp-title">{data.recommendation.title}</h2>
        <p className="cp-copy">{data.recommendation.detail}</p>
        <div className="mt-4">
          <Button disabled variant="outline">
            <ExternalLink />
            Open problem
          </Button>
        </div>
      </SurfaceCard>

      <SurfaceCard>
        <p className="cp-kicker">Active Track</p>
        <h2 className="cp-title">{data.activeTrack.title}</h2>
        <p className="cp-copy">{data.activeTrack.detail}</p>
      </SurfaceCard>
    </main>
  )
}
