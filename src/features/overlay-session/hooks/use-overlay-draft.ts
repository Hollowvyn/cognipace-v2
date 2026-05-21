import { useCallback } from 'react'

import type { OverlayDraftField } from '../domain/overlay-draft'
import {
  hasUnpersistedDraftChanges,
  type OverlaySessionAction,
  type OverlaySessionState,
} from '../domain/overlay-session-state'

export type OverlayDraftController = {
  hasUnpersistedChanges: boolean
  setField: (field: OverlayDraftField, value: string) => void
  clearField: (field: OverlayDraftField) => void
}

export function useOverlayDraft(
  state: OverlaySessionState,
  dispatch: (action: OverlaySessionAction) => void,
): OverlayDraftController {
  const setField = useCallback(
    (field: OverlayDraftField, value: string) => {
      dispatch({ type: 'set-draft-field', field, value })
    },
    [dispatch],
  )

  const clearField = useCallback(
    (field: OverlayDraftField) => {
      dispatch({ type: 'set-draft-field', field, value: '' })
    },
    [dispatch],
  )

  return {
    hasUnpersistedChanges: hasUnpersistedDraftChanges(state),
    setField,
    clearField,
  }
}
