import { Loader2 } from 'lucide-react'
import { useMemo } from 'react'

import { Button } from '@/components/ui/button'
import { InlineStatus } from '@/components/ui/inline-status'
import { useProblemLibrary, type ProblemLibraryRow } from '@/features/problems'

import { TrackForm } from './track-form'
import {
  clearLibrarySelectionTrackDraft,
  readLibrarySelectionTrackDraft,
} from '../utils/library-selection-track-draft'

export function LibrarySelectionTrackForm({
  draftId,
  onCancel,
  onSaved,
}: {
  draftId: string | null | undefined
  onCancel: () => void
  onSaved: () => void
}) {
  const libraryQuery = useProblemLibrary({ surface: 'dashboard' })
  const draft = readLibrarySelectionTrackDraft(draftId)
  const resolvedProblemRows = useMemo(
    () =>
      resolveDraftProblemRows(
        draft?.problemSlugs ?? [],
        libraryQuery.data?.rows ?? [],
      ),
    [draft?.problemSlugs, libraryQuery.data?.rows],
  )

  if (!draft) {
    return (
      <RecoverableDraftError
        message="Track selection draft was not found."
        onReturn={onCancel}
      />
    )
  }

  if (libraryQuery.isPending) {
    return (
      <InlineStatus>
        <Loader2 aria-hidden="true" className="animate-spin" />
        Loading selected Library problems…
      </InlineStatus>
    )
  }

  if (libraryQuery.isError || !libraryQuery.data) {
    return (
      <RecoverableDraftError
        message="Selected Library problems could not be loaded."
        onReturn={onCancel}
      />
    )
  }

  if (resolvedProblemRows.length === 0) {
    return (
      <RecoverableDraftError
        message="No selected Library problems are still available."
        onReturn={onCancel}
      />
    )
  }

  return (
    <div className="grid gap-4">
      {resolvedProblemRows.length < draft.problemSlugs.length ? (
        <InlineStatus tone="warning">
          Some selected problems are no longer available.
        </InlineStatus>
      ) : null}
      <TrackForm
        initialDraft={{
          id: draft.id,
          problemRows: resolvedProblemRows,
          selectedCount: resolvedProblemRows.length,
          source: 'library-selection',
        }}
        mode="create"
        onCancel={onCancel}
        onSaved={() => {
          clearLibrarySelectionTrackDraft(draft.id)
          onSaved()
        }}
      />
    </div>
  )
}

function resolveDraftProblemRows(
  problemSlugs: readonly string[],
  libraryRows: readonly ProblemLibraryRow[],
) {
  const rowsBySlug = new Map(
    libraryRows.map((row) => [row.problem.slug, row] as const),
  )

  return problemSlugs.flatMap((slug) => {
    const row = rowsBySlug.get(slug)

    return row ? [row] : []
  })
}

function RecoverableDraftError({
  message,
  onReturn,
}: {
  message: string
  onReturn: () => void
}) {
  return (
    <div className="grid gap-3">
      <InlineStatus role="alert" tone="danger">
        {message}
      </InlineStatus>
      <div>
        <Button onClick={onReturn} type="button" variant="outline">
          Return to Library
        </Button>
      </div>
    </div>
  )
}
