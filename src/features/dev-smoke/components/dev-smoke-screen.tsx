import { RefreshCw } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { InlineStatus } from '@/components/ui/inline-status'
import { Surface } from '@/components/ui/surface'
import type { Tone } from '@/components/ui/types'

import type { DevSmokeReport } from '../api/dev-smoke-contracts'
import { useDevSmokeReport } from '../api/dev-smoke-api'

export function DevSmokeScreen() {
  const [runLiveGenAi, setRunLiveGenAi] = useState(false)
  const query = useDevSmokeReport(runLiveGenAi)

  return (
    <div className="flex min-w-0 flex-col gap-[var(--cp-surface-gap)]">
      <Surface className="grid gap-3">
        <label className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
          <input
            checked={runLiveGenAi}
            className="size-4 accent-primary"
            onChange={(event) => {
              setRunLiveGenAi(event.target.checked)
            }}
            type="checkbox"
          />
          <span>Run live GenAI provider smoke</span>
        </label>
        {runLiveGenAi ? (
          <InlineStatus tone="warning">
            Live provider smoke may call the configured provider. Secret values
            are never shown here.
          </InlineStatus>
        ) : null}
      </Surface>

      {query.isPending ? <LoadingState /> : null}
      {query.isError ? (
        <ErrorState
          onRetry={() => {
            void query.refetch()
          }}
        />
      ) : null}
      {query.isSuccess && query.data ? <Report report={query.data} /> : null}
    </div>
  )
}

function LoadingState() {
  return (
    <Surface>
      <InlineStatus>Loading dashboard smoke report...</InlineStatus>
    </Surface>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <Surface className="grid gap-3">
      <InlineStatus role="alert" tone="danger">
        Failed to run dashboard smoke checks.
      </InlineStatus>
      <div>
        <Button onClick={onRetry} size="sm" variant="outline">
          <RefreshCw aria-hidden="true" />
          Retry
        </Button>
      </div>
    </Surface>
  )
}

function Report({ report }: { report: DevSmokeReport }) {
  return (
    <Surface
      aria-label="Dashboard smoke report"
      className="grid gap-4"
      role="region"
    >
      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
        <h2 className="m-0 text-[length:var(--cp-title-font-size)] font-bold leading-tight text-foreground">
          Smoke Checks
        </h2>
        <p className="m-0 text-xs text-muted-foreground">
          Generated {report.generatedAt}
        </p>
      </div>

      <ul className="m-0 grid list-none gap-2 p-0">
        {report.checks.map((check) => {
          const status = statusPresentation[check.status]

          return (
            <li
              aria-label={`${check.label}: ${status.label}`}
              className="grid gap-2 rounded-[var(--cp-radius-md)] border border-border bg-muted/40 p-3"
              key={check.id}
            >
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 font-semibold text-foreground">
                  {check.label}
                </span>
                <span
                  className="rounded-full border border-[color:var(--cp-tone-border)] bg-[var(--cp-tone-bg)] px-2 py-1 text-xs font-bold uppercase leading-none text-[color:var(--cp-tone-fg)]"
                  data-cp-tone={status.tone}
                >
                  {status.label}
                </span>
              </div>
              <p className="m-0 text-sm leading-snug text-muted-foreground">
                {sanitizeSmokeDetail(check.detail)}
              </p>
              {typeof check.latencyMs === 'number' ? (
                <p className="m-0 text-xs font-semibold tabular-nums text-muted-foreground">
                  {check.latencyMs} ms
                </p>
              ) : null}
            </li>
          )
        })}
      </ul>
    </Surface>
  )
}

const statusPresentation = {
  pass: { label: 'Pass', tone: 'success' },
  warn: { label: 'Warn', tone: 'warning' },
  fail: { label: 'Fail', tone: 'danger' },
  skip: { label: 'Skip', tone: 'neutral' },
} as const satisfies Record<
  DevSmokeReport['checks'][number]['status'],
  { label: string; tone: Tone }
>

function sanitizeSmokeDetail(detail: string) {
  return detail
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, '$1[redacted]')
    .replace(/\b(sk-[A-Za-z0-9_-]{8,})\b/g, '[redacted]')
    .replace(
      /\b(api[_-]?key|token|secret)(\s*[:=]\s*)[^\s,;]+/gi,
      '$1$2[redacted]',
    )
}
