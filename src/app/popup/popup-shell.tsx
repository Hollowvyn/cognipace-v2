import { ExternalLink, RefreshCw, Settings } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Surface, SurfaceRoot } from '@/components/ui/surface'
import type { PopupAppShellData } from '@/features/app-shell'

type PopupShellProps = {
  data: PopupAppShellData
  pingLabel: string
}

export function PopupShell({ data, pingLabel }: PopupShellProps) {
  return (
    <SurfaceRoot
      className="flex flex-col gap-[var(--cp-surface-gap)] p-[var(--cp-surface-padding)]"
      surface="popup"
    >
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 text-[length:var(--cp-kicker-font-size)] font-bold uppercase leading-none text-muted-foreground">
            CogniPace
          </p>
          <h1 className="mt-1 text-[length:var(--cp-title-font-size)] font-bold leading-tight text-foreground">
            Study Loop
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <IconButton
            disabled
            label="Refresh Queue"
            tooltip="Refresh Queue"
            variant="ghost"
          >
            <RefreshCw aria-hidden="true" />
          </IconButton>
          <IconButton
            disabled
            label="Open Settings"
            tooltip="Open Settings"
            variant="ghost"
          >
            <Settings aria-hidden="true" />
          </IconButton>
        </div>
      </header>

      <Surface>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="m-0 text-[length:var(--cp-kicker-font-size)] font-bold uppercase leading-none text-muted-foreground">
              Status
            </p>
            <h2 className="mt-1 text-[length:var(--cp-title-font-size)] font-bold leading-tight text-foreground">
              {data.status.label}
            </h2>
            <p className="mt-1 text-[length:var(--cp-copy-font-size)] leading-relaxed text-muted-foreground">
              {data.status.detail}
            </p>
          </div>
          <Badge tone={pingLabel === 'Connected' ? 'success' : 'warning'}>
            {pingLabel}
          </Badge>
        </div>
      </Surface>

      <section
        aria-label="Practice Metrics"
        className="grid grid-cols-2 gap-[var(--cp-space-2)]"
      >
        {data.metrics.map((metric) => (
          <Surface key={metric.label}>
            <p className="m-0 text-[length:var(--cp-kicker-font-size)] font-bold uppercase leading-none text-muted-foreground">
              {metric.label}
            </p>
            <strong className="mt-2 block text-[1.375rem] font-extrabold leading-none text-foreground tabular-nums">
              {metric.value}
            </strong>
          </Surface>
        ))}
      </section>

      <Surface>
        <p className="m-0 text-[length:var(--cp-kicker-font-size)] font-bold uppercase leading-none text-muted-foreground">
          Recommended Now
        </p>
        <h2 className="mt-1 text-[length:var(--cp-title-font-size)] font-bold leading-tight text-foreground">
          {data.recommendation.title}
        </h2>
        <p className="mt-1 text-[length:var(--cp-copy-font-size)] leading-relaxed text-muted-foreground">
          {data.recommendation.detail}
        </p>
        <div className="mt-4">
          <Button disabled variant="outline">
            <ExternalLink aria-hidden="true" data-icon="inline-start" />
            Open Problem
          </Button>
        </div>
      </Surface>

      <Surface>
        <p className="m-0 text-[length:var(--cp-kicker-font-size)] font-bold uppercase leading-none text-muted-foreground">
          Active Track
        </p>
        <h2 className="mt-1 text-[length:var(--cp-title-font-size)] font-bold leading-tight text-foreground">
          {data.activeTrack.title}
        </h2>
        <p className="mt-1 text-[length:var(--cp-copy-font-size)] leading-relaxed text-muted-foreground">
          {data.activeTrack.detail}
        </p>
      </Surface>
    </SurfaceRoot>
  )
}
