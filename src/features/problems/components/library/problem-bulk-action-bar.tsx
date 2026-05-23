import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
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
      const protectedCount = response.protectedProblemSlugs.length
      const missingCount = response.missingProblemSlugs.length

      setConfirmation(null)
      onClearSelection()
      setMessage(
        formatBulkDeleteResult(deletedCount, protectedCount, missingCount),
      )
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
      className="grid gap-2 border-t border-border bg-muted/35 px-4 py-3 md:px-5"
    >
      {error ? (
        <InlineStatus role="alert" tone="danger">
          {error}
        </InlineStatus>
      ) : null}
      {message ? <InlineStatus>{message}</InlineStatus> : null}
      {selectedRows.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="font-semibold text-foreground">
            {selectedRows.length} selected
          </span>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              disabled={isPending}
              onClick={() => setSelectedSuspended(true)}
              size="sm"
              variant="ghost"
            >
              Suspend
            </Button>
            <Button
              disabled={isPending}
              onClick={() => setSelectedSuspended(false)}
              size="sm"
              variant="ghost"
            >
              Resume
            </Button>
            <Button
              disabled={isPending}
              onClick={() => setConfirmation('reset')}
              size="sm"
              variant="ghost"
            >
              Reset Schedule
            </Button>
            <Button
              disabled={isPending}
              onClick={() => setIsMetadataDialogOpen(true)}
              size="sm"
              variant="ghost"
            >
              Edit Metadata
            </Button>
            <Button
              disabled={isPending}
              onClick={() => setConfirmation('delete')}
              size="sm"
              variant="ghost"
            >
              Delete Problems
            </Button>
            <Button
              className="px-0"
              disabled={isPending}
              onClick={onClearSelection}
              size="sm"
              variant="ghost"
            >
              Clear selection
            </Button>
          </div>
        </div>
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
          description={`Only user-created problems can be deleted. Protected selected problems will be skipped.`}
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
  protectedCount: number,
  missingCount: number,
) {
  return [
    `Deleted ${deletedCount} ${pluralize('problem', deletedCount)}.`,
    `Skipped ${protectedCount} protected ${pluralize('problem', protectedCount)}.`,
    `Skipped ${missingCount} missing ${pluralize('problem', missingCount)}.`,
  ].join(' ')
}
