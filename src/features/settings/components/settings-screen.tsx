import { RefreshCw } from 'lucide-react'
import type { FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { InlineStatus } from '@/components/ui/inline-status'
import { Surface } from '@/components/ui/surface'
import { DataManagementScreen } from '@/features/backup'

import { useSettingsDraft } from '../hooks/use-settings-draft'
import { AdvancedReviewSection } from './sections/advanced-review-section'
import { DailyPracticeSection } from './sections/daily-practice-section'
import { LeetCodeOverlaySection } from './sections/leetcode-overlay-section'
import { SettingsSaveDock } from './settings-save-bar'
import { SettingsToast } from './settings-toast'

export function SettingsScreen() {
  const controller = useSettingsDraft()

  if (controller.isInitialLoading) {
    return (
      <Surface className="max-w-[64rem]">
        <InlineStatus>Loading settings…</InlineStatus>
      </Surface>
    )
  }

  if (controller.isError && !controller.draft) {
    return (
      <Surface className="grid max-w-[64rem] gap-3">
        <InlineStatus role="alert" tone="danger">
          {controller.loadError ?? 'Failed to load settings.'}
        </InlineStatus>
        <div>
          <Button
            onClick={controller.actions.retry}
            size="sm"
            variant="outline"
          >
            <RefreshCw aria-hidden="true" />
            Retry
          </Button>
        </div>
      </Surface>
    )
  }

  if (!controller.draft) {
    return null
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (controller.hasValidationErrors) {
      focusFirstInvalidField(event.currentTarget)
      return
    }

    if (!controller.canSave) {
      return
    }

    void controller.actions.save()
  }

  return (
    <div className="grid min-w-0 w-full max-w-[64rem] gap-[var(--cp-surface-gap)]">
      <form
        aria-label="Settings preferences"
        className="grid min-w-0 gap-[var(--cp-surface-gap)]"
        onSubmit={handleSubmit}
      >
        <Surface className="grid p-0">
          <div className="px-4 pb-6 pt-4 md:px-5 lg:px-7">
            <DailyPracticeSection
              actions={controller.actions}
              draft={controller.draft}
              fieldErrors={controller.fieldErrors}
              numberInputs={controller.numberInputs}
            />
            <LeetCodeOverlaySection
              actions={controller.actions}
              draft={controller.draft}
            />
            <AdvancedReviewSection
              actions={controller.actions}
              draft={controller.draft}
              fieldErrors={controller.fieldErrors}
              numberInputs={controller.numberInputs}
            />
          </div>
          <SettingsSaveDock
            canDiscard={controller.canDiscard}
            canResetDefaults={controller.canResetDefaults}
            canSave={controller.canSave}
            hasChanges={controller.hasChanges}
            hasValidationErrors={controller.hasValidationErrors}
            isResettingDefaults={controller.isResettingDefaults}
            isSaving={controller.isSaving}
            onDiscard={controller.actions.discard}
            onResetDefaults={() => {
              void controller.actions.resetDefaults()
            }}
          />
        </Surface>
        <SettingsToast status={controller.status} />
      </form>
      <DataManagementScreen />
    </div>
  )
}

function focusFirstInvalidField(form: HTMLFormElement) {
  const field = form.querySelector<HTMLElement>('[aria-invalid="true"]')
  field?.focus()
}
