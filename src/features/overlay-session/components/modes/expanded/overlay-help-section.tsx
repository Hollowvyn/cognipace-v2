import { SquarePlay } from 'lucide-react'

import { IconButton } from '@/components/ui/icon-button'

import { createYouTubeSearchUrl } from '../../../domain'

export type OverlayHelpSectionProps = {
  searchQuery: string | null
}

const HELP_ACTION_LABEL = 'Search YouTube for this problem'

export function OverlayHelpSection({ searchQuery }: OverlayHelpSectionProps) {
  const searchUrl = searchQuery ? createYouTubeSearchUrl(searchQuery) : null

  return (
    <section aria-labelledby="overlay-help-heading">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2
          className="font-mono text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
          id="overlay-help-heading"
        >
          Help
        </h2>
      </div>

      {searchUrl ? (
        <IconButton
          asChild
          label={HELP_ACTION_LABEL}
          tooltip={HELP_ACTION_LABEL}
          variant="ghost"
        >
          <a href={searchUrl} rel="noopener noreferrer" target="_blank">
            <SquarePlay aria-hidden="true" />
          </a>
        </IconButton>
      ) : (
        <IconButton
          disabled
          label={HELP_ACTION_LABEL}
          tooltip="Problem details are still loading"
          variant="ghost"
        >
          <SquarePlay aria-hidden="true" />
        </IconButton>
      )}
    </section>
  )
}
