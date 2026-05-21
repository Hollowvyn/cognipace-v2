import { ArrowRight, LoaderCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'

import type { OverlayNextStepState } from '../../../domain'

type OverlayNextCardProps = {
  nextStep: OverlayNextStepState
}

export function OverlayNextCard({ nextStep }: OverlayNextCardProps) {
  if (nextStep.status === 'hidden') {
    return null
  }

  if (nextStep.status === 'loading') {
    return (
      <section
        aria-label="Up next"
        aria-live="polite"
        className="border border-border bg-card p-3"
      >
        <div className="flex items-center gap-2 text-[0.8rem] text-muted-foreground">
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          <span>{nextStep.message ?? 'Finding next problem...'}</span>
        </div>
      </section>
    )
  }

  if (nextStep.status === 'error') {
    return (
      <section
        aria-label="Up next"
        aria-live="polite"
        className="border border-border bg-card p-3"
      >
        <div className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Up next
        </div>
        <p className="m-0 mt-2 text-[0.8rem] text-destructive">
          {nextStep.message ?? 'Could not load the next problem.'}
        </p>
      </section>
    )
  }

  const value = nextStep.value

  if (!value) {
    return null
  }

  return (
    <section
      aria-label="Up next"
      aria-live="polite"
      className="border border-border bg-card p-3"
    >
      <div className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Up next
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="m-0 truncate font-mono text-[0.86rem] font-semibold text-foreground">
            {value.title}
          </h2>
          <p className="m-0 mt-1 truncate text-[0.75rem] text-muted-foreground">
            {value.detail}
          </p>
        </div>
        {value.problem ? (
          <Button asChild size="sm" variant="outline">
            <a href={value.problem.url}>
              <ArrowRight aria-hidden="true" />
              Open
            </a>
          </Button>
        ) : null}
      </div>
    </section>
  )
}
