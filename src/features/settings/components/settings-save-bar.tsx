import { RotateCcw, Save, Undo2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/utils/cn'

interface SettingsSaveDockProps {
  canDiscard: boolean
  canResetDefaults: boolean
  canSave: boolean
  hasChanges: boolean
  hasValidationErrors: boolean
  isResettingDefaults: boolean
  isSaving: boolean
  onDiscard: () => void
  onResetDefaults: () => void
}

export function SettingsSaveDock({
  canDiscard,
  canResetDefaults,
  canSave,
  hasChanges,
  hasValidationErrors,
  isResettingDefaults,
  isSaving,
  onDiscard,
  onResetDefaults,
}: SettingsSaveDockProps) {
  const status = readSaveDockStatus({
    hasChanges,
    hasValidationErrors,
    isSaving,
  })

  return (
    <footer
      aria-label="Settings actions"
      className="shrink-0 border-t border-border bg-card px-4 py-2.5 text-card-foreground md:px-5 lg:px-7"
    >
      <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p
            aria-live="polite"
            className={cn(
              'm-0 flex min-w-0 items-center gap-2 text-[length:var(--cp-copy-font-size)] font-medium leading-snug md:min-w-40',
              status.textClassName,
            )}
            role={hasValidationErrors ? 'alert' : 'status'}
          >
            <span
              aria-hidden="true"
              className={cn(
                'size-2 shrink-0 rounded-full',
                status.dotClassName,
              )}
            />
            <span className="min-w-0 truncate">{status.label}</span>
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2 md:justify-end">
          <Button
            className="w-auto shrink-0 text-muted-foreground"
            disabled={!canResetDefaults}
            onClick={onResetDefaults}
            size="sm"
            variant="ghost"
          >
            <RotateCcw aria-hidden="true" />
            {isResettingDefaults ? 'Resetting…' : 'Reset Defaults'}
          </Button>
          <Button
            className="w-auto shrink-0"
            disabled={!canDiscard}
            onClick={onDiscard}
            size="sm"
            variant="ghost"
          >
            <Undo2 aria-hidden="true" />
            Discard
          </Button>
          <Button
            className="w-auto shrink-0"
            disabled={!canSave}
            size="sm"
            type="submit"
          >
            <Save aria-hidden="true" />
            {isSaving ? 'Saving…' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </footer>
  )
}

interface SaveDockStatusInput {
  hasChanges: boolean
  hasValidationErrors: boolean
  isSaving: boolean
}

function readSaveDockStatus({
  hasChanges,
  hasValidationErrors,
  isSaving,
}: SaveDockStatusInput) {
  if (isSaving) {
    return {
      dotClassName: 'bg-[color:var(--cp-tone-info-fg)]',
      label: 'Saving changes…',
      textClassName: 'text-[color:var(--cp-tone-info-fg)]',
    }
  }

  if (hasValidationErrors) {
    return {
      dotClassName: 'bg-[color:var(--cp-tone-danger-fg)]',
      label: 'Fix highlighted settings',
      textClassName: 'text-[color:var(--cp-tone-danger-fg)]',
    }
  }

  if (hasChanges) {
    return {
      dotClassName: 'bg-[color:var(--cp-tone-warning-fg)]',
      label: 'Unsaved changes',
      textClassName: 'text-[color:var(--cp-tone-warning-fg)]',
    }
  }

  return {
    dotClassName: 'bg-transparent',
    label: 'No pending changes',
    textClassName: 'text-muted-foreground',
  }
}
