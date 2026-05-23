import { Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { InlineStatus } from '@/components/ui/inline-status'
import { useDeleteProblem } from '@/features/problems/api/problems-api'
import type {
  ProblemLibraryRow,
  SerializedProblem,
} from '@/features/problems/api/problems-contracts'
import {
  useResetPracticeSchedule,
  useSetPracticeSuspended,
} from '@/features/practice'

import { ProblemConfirmationDialog } from './problem-confirmation-dialog'

export type RenderProblemEditAction = (problem: SerializedProblem) => ReactNode

type PendingConfirmation = 'delete' | 'reset'

export function ProblemRowActions({
  renderEditProblemAction,
  row,
}: {
  renderEditProblemAction: RenderProblemEditAction
  row: ProblemLibraryRow
}) {
  const deleteProblem = useDeleteProblem()
  const resetSchedule = useResetPracticeSchedule()
  const setSuspended = useSetPracticeSuspended()
  const [confirmation, setConfirmation] = useState<PendingConfirmation | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)
  const isSuspended = row.summary.suspended || row.status === 'suspended'
  const isPending =
    deleteProblem.isPending || resetSchedule.isPending || setSuspended.isPending

  async function runAction(action: () => Promise<unknown>) {
    setError(null)

    try {
      await action()
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Problem action failed.',
      )
    }
  }

  async function confirmDelete() {
    await runAction(async () => {
      const response = await deleteProblem.mutateAsync({
        surface: 'dashboard',
        problemSlug: row.problem.slug,
      })

      if (response.protectedProblemSlugs.includes(row.problem.slug)) {
        setConfirmation(null)
        setError('This problem is protected and cannot be deleted.')
        return
      }

      if (response.missingProblemSlugs.includes(row.problem.slug)) {
        setConfirmation(null)
        setError('This problem no longer exists.')
        return
      }

      setConfirmation(null)
    })
  }

  async function confirmReset() {
    await runAction(async () => {
      await resetSchedule.mutateAsync({
        surface: 'dashboard',
        problemSlug: row.problem.slug,
      })
      setConfirmation(null)
    })
  }

  return (
    <div className="grid gap-3">
      {error ? (
        <InlineStatus role="alert" tone="danger">
          {error}
        </InlineStatus>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        {renderEditProblemAction(row.problem)}
        <Button
          disabled={isPending}
          onClick={() => {
            void runAction(() =>
              setSuspended.mutateAsync({
                surface: 'dashboard',
                problemSlug: row.problem.slug,
                suspended: !isSuspended,
              }),
            )
          }}
          size="sm"
          variant="ghost"
        >
          {isSuspended ? 'Resume' : 'Suspend'}
        </Button>
        <Button
          disabled={isPending}
          onClick={() => setConfirmation('reset')}
          size="sm"
          variant="ghost"
        >
          Reset Schedule
        </Button>
        {row.problem.isUserCreated ? (
          <Button
            disabled={isPending}
            onClick={() => setConfirmation('delete')}
            size="sm"
            variant="destructive"
          >
            <Trash2 aria-hidden="true" />
            Delete
          </Button>
        ) : null}
      </div>

      {confirmation === 'reset' ? (
        <ProblemConfirmationDialog
          confirmLabel="Reset Schedule"
          description="This clears the FSRS schedule and review history for this problem."
          onCancel={() => setConfirmation(null)}
          onConfirm={() => {
            void confirmReset()
          }}
          pending={isPending}
          title="Reset schedule?"
        />
      ) : null}

      {confirmation === 'delete' ? (
        <ProblemConfirmationDialog
          confirmLabel="Delete Problem"
          description="This permanently deletes this user-created problem and its practice data."
          onCancel={() => setConfirmation(null)}
          onConfirm={() => {
            void confirmDelete()
          }}
          pending={isPending}
          title="Delete problem?"
        />
      ) : null}
    </div>
  )
}
