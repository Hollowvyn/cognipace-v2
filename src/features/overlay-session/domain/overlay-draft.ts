import type { PracticeLogFields } from '@/features/practice'

export type OverlayDraftField = keyof OverlayDraftLog

export type OverlayDraftLog = {
  interviewPattern: string
  timeComplexity: string
  spaceComplexity: string
  languages: string
  notes: string
}

export const overlayDraftFields = [
  'interviewPattern',
  'timeComplexity',
  'spaceComplexity',
  'languages',
  'notes',
] as const satisfies readonly OverlayDraftField[]

export function createEmptyOverlayDraft(): OverlayDraftLog {
  return {
    interviewPattern: '',
    timeComplexity: '',
    spaceComplexity: '',
    languages: '',
    notes: '',
  }
}

export function createOverlayDraftFromLog(
  log?: PracticeLogFields | null,
): OverlayDraftLog {
  return {
    interviewPattern: log?.interviewPattern ?? '',
    timeComplexity: log?.timeComplexity ?? '',
    spaceComplexity: log?.spaceComplexity ?? '',
    languages: log?.languages ?? '',
    notes: log?.notes ?? '',
  }
}

export function toPracticeLogPatch(log: OverlayDraftLog): PracticeLogFields {
  return {
    interviewPattern: normalizeDraftValue(log.interviewPattern),
    timeComplexity: normalizeDraftValue(log.timeComplexity),
    spaceComplexity: normalizeDraftValue(log.spaceComplexity),
    languages: normalizeDraftValue(log.languages),
    notes: normalizeDraftValue(log.notes),
  }
}

export function overlayDraftsEqual(
  left: OverlayDraftLog,
  right: OverlayDraftLog,
) {
  return overlayDraftFields.every((field) => left[field] === right[field])
}

function normalizeDraftValue(value: string) {
  const trimmed = value.trim()

  return trimmed.length > 0 ? trimmed : null
}
