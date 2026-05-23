import { useMemo, useState } from 'react'
import {
  CirclePause,
  CirclePlay,
  Pencil,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react'

import { IconButton } from '@/components/ui/icon-button'
import { InlineStatus } from '@/components/ui/inline-status'
import {
  useResetPracticeSchedule,
  useSetPracticeSuspended,
} from '@/features/practice'

import {
  useBulkDeleteProblems,
  useBulkUpdateProblems,
} from '../../api/problems-api'
import type {
  ProblemLibraryOptions,
  ProblemLibraryRow,
  ProblemsBulkUpdateProblemsRequest,
} from '../../api/problems-contracts'
import { ProblemConfirmationDialog } from './problem-confirmation-dialog'
import { ProblemBulkMetadataDialog } from './problem-bulk-metadata-dialog'

type BulkConfirmation = 'delete' | 'reset'

export function ProblemBulkActionBar({
  onClearSelection,
  options,
  selectedRows,
}: {
  onClearSelection: () => void
  options: ProblemLibraryOptions
  selectedRows: readonly ProblemLibraryRow[]
}) {
  const bulkDelete = useBulkDeleteProblems()
  const bulkUpdate = useBulkUpdateProblems()
  const resetSchedule = useResetPracticeSchedule()
  const setSuspended = useSetPracticeSuspended()
  const [confirmation, setConfirmation] = useState<BulkConfirmation | null>(
    null,
  )
  const [isMetadataDialogOpen, setIsMetadataDialogOpen] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const selectedProblemSlugs = useMemo(
    () => selectedRows.map((row) => row.problem.slug),
    [selectedRows],
  )
  const isPending =
    bulkDelete.isPending ||
    bulkUpdate.isPending ||
    resetSchedule.isPending ||
    setSuspended.isPending

  if (selectedRows.length === 0 && !message && !error) {
    return null
  }

  async function runAction(action: () => Promise<unknown>) {
    setError(null)
    setMessage(null)

    try {
      await action()
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Bulk action failed.',
      )
    }
  }

  function setSelectedSuspended(suspended: boolean) {
    void runAction(async () => {
      await Promise.all(
        selectedProblemSlugs.map((problemSlug) =>
          setSuspended.mutateAsync({
            surface: 'dashboard',
            problemSlug,
            suspended,
          }),
        ),
      )
    })
  }

  async function confirmReset() {
    await runAction(async () => {
      await Promise.all(
        selectedProblemSlugs.map((problemSlug) =>
          resetSchedule.mutateAsync({
            surface: 'dashboard',
            problemSlug,
          }),
        ),
      )
      setConfirmation(null)
      onClearSelection()
    })
  }

  async function confirmDelete() {
    await runAction(async () => {
      const response = await bulkDelete.mutateAsync({
        surface: 'dashboard',
        problemSlugs: selectedProblemSlugs,
      })
      const deletedCount = response.deletedProblemSlugs.length
      const missingCount = response.missingProblemSlugs.length

      setConfirmation(null)
      onClearSelection()
      setMessage(formatBulkDeleteResult(deletedCount, missingCount))
    })
  }

  async function updateMetadata(set: ProblemsBulkUpdateProblemsRequest['set']) {
    await runAction(async () => {
      const response = await bulkUpdate.mutateAsync({
        surface: 'dashboard',
        problemSlugs: selectedProblemSlugs,
        set,
      })

      setIsMetadataDialogOpen(false)
      onClearSelection()
      setMessage(
        `Updated ${response.updatedProblemSlugs.length} ${pluralize(
          'problem',
          response.updatedProblemSlugs.length,
        )}.`,
      )
    })
  }

  return (
    <section
      aria-label="Bulk actions"
      className="flex min-w-0 flex-wrap items-center gap-2"
    >
      {error ? (
        <InlineStatus role="alert" tone="danger">
          {error}
        </InlineStatus>
      ) : null}
      {message ? <InlineStatus>{message}</InlineStatus> : null}
      {selectedRows.length > 0 ? (
        <>
          <span className="whitespace-nowrap font-semibold text-foreground">
            {selectedRows.length} selected
          </span>
          <div className="inline-flex items-center gap-1">
            <IconButton
              disabled={isPending}
              label="Suspend"
              onClick={() => setSelectedSuspended(true)}
              tooltip="Suspend selected"
              variant="ghost"
            >
              <CirclePause aria-hidden="true" />
            </IconButton>
            <IconButton
              disabled={isPending}
              label="Resume"
              onClick={() => setSelectedSuspended(false)}
              tooltip="Resume selected"
              variant="ghost"
            >
              <CirclePlay aria-hidden="true" />
            </IconButton>
            <IconButton
              disabled={isPending}
              label="Reset Schedule"
              onClick={() => setConfirmation('reset')}
              tooltip="Reset selected schedules"
              variant="ghost"
            >
              <RotateCcw aria-hidden="true" />
            </IconButton>
            <IconButton
              disabled={isPending}
              label="Edit Metadata"
              onClick={() => setIsMetadataDialogOpen(true)}
              tooltip="Edit selected metadata"
              variant="ghost"
            >
              <Pencil aria-hidden="true" />
            </IconButton>
            <IconButton
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={isPending}
              label="Delete Problems"
              onClick={() => setConfirmation('delete')}
              tooltip="Delete selected problems"
              variant="ghost"
            >
              <Trash2 aria-hidden="true" />
            </IconButton>
            <IconButton
              className="text-muted-foreground hover:text-foreground"
              disabled={isPending}
              label="Clear selection"
              onClick={onClearSelection}
              tooltip="Clear selection"
              variant="ghost"
            >
              <X aria-hidden="true" />
            </IconButton>
          </div>
        </>
      ) : null}

      {confirmation === 'reset' ? (
        <ProblemConfirmationDialog
          confirmLabel="Reset Schedule"
          description={`This clears schedules and review history for ${selectedRows.length} selected ${pluralize('problem', selectedRows.length)}.`}
          onCancel={() => setConfirmation(null)}
          onConfirm={() => {
            void confirmReset()
          }}
          pending={isPending}
          title="Reset selected schedules?"
        />
      ) : null}

      {isMetadataDialogOpen ? (
        <ProblemBulkMetadataDialog
          onCancel={() => setIsMetadataDialogOpen(false)}
          onSubmit={(set) => {
            void updateMetadata(set)
          }}
          options={options}
          pending={isPending}
          selectedCount={selectedRows.length}
        />
      ) : null}

      {confirmation === 'delete' ? (
        <ProblemConfirmationDialog
          confirmLabel="Delete Problems"
          description="This permanently deletes the selected problems and their practice data."
          onCancel={() => setConfirmation(null)}
          onConfirm={() => {
            void confirmDelete()
          }}
          pending={isPending}
          title="Delete selected problems?"
        />
      ) : null}
    </section>
  )
}

function pluralize(label: string, count: number) {
  return count === 1 ? label : `${label}s`
}

function formatBulkDeleteResult(
  deletedCount: number,
  missingCount: number,
) {
  const result = [`Deleted ${deletedCount} ${pluralize('problem', deletedCount)}.`]

  if (missingCount > 0) {
    result.push(
      `Skipped ${missingCount} missing ${pluralize('problem', missingCount)}.`,
    )
  }

  return result.join(' ')
}
