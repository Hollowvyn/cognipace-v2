import { Download, Loader2, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { InlineStatus } from '@/components/ui/inline-status'
import { Surface } from '@/components/ui/surface'

interface ResetLocalDataPanelProps {
  error: string | null
  isExporting: boolean
  isResetting: boolean
  onExport: () => void
  onOpenResetDialog: () => void
  status: string | null
}

export function ResetLocalDataPanel({
  error,
  isExporting,
  isResetting,
  onExport,
  onOpenResetDialog,
  status,
}: ResetLocalDataPanelProps) {
  return (
    <Surface aria-labelledby="reset-local-data-title" className="grid gap-4">
      <header className="grid gap-1">
        <h2
          className="m-0 text-[length:var(--cp-title-font-size)] font-bold leading-tight"
          id="reset-local-data-title"
        >
          Reset local data
        </h2>
        <p className="m-0 text-[length:var(--cp-copy-font-size)] text-muted-foreground">
          Clear local CogniPace data only after exporting anything you need.
        </p>
      </header>

      {error ? (
        <InlineStatus role="alert" tone="danger">
          {error}
        </InlineStatus>
      ) : null}
      {status ? <InlineStatus>{status}</InlineStatus> : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={isExporting || isResetting}
          onClick={onExport}
          size="sm"
          variant="outline"
        >
          {isExporting ? (
            <Loader2
              aria-hidden="true"
              className="animate-spin motion-reduce:animate-none"
            />
          ) : (
            <Download aria-hidden="true" />
          )}
          Export current backup
        </Button>
        <Button
          disabled={isResetting}
          onClick={onOpenResetDialog}
          size="sm"
          variant="destructive"
        >
          <Trash2 aria-hidden="true" />
          Reset local data
        </Button>
      </div>
    </Surface>
  )
}
