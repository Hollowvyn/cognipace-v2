/** Supported FSRS learning states exposed by the public library facade. */
export const fsrsCardStates = [
  'new',
  'learning',
  'review',
  'relearning',
] as const

/** Supported FSRS scheduler profile identifiers. */
export const fsrsCardKinds = ['default'] as const

/** Normalized FSRS learning state persisted by CogniPace. */
export type FsrsCardState = (typeof fsrsCardStates)[number]

/** Scheduler profile identifier for a persisted FSRS card. */
export type FsrsCardKind = (typeof fsrsCardKinds)[number]

/** Default scheduler profile used for LeetCode practice cards. */
export const defaultFsrsCardKind: FsrsCardKind = 'default'

/** Dependency-free snapshot of a ts-fsrs card persisted by CogniPace. */
export interface FsrsCardSnapshot {
  dueAt: Date
  stability: number
  difficulty: number
  /** @deprecated Upstream ts-fsrs removes elapsed_days in v6; derive from dates instead. */
  elapsedDays: number
  scheduledDays: number
  learningSteps: number
  reps: number
  lapses: number
  state: FsrsCardState
  lastReviewAt: Date | null
}

/** Checks whether a persisted string is a supported FSRS card state. */
export function isFsrsCardState(value: string): value is FsrsCardState {
  return fsrsCardStates.includes(value as FsrsCardState)
}

/** Parses a persisted FSRS card state at storage and API boundaries. */
export function parseFsrsCardState(value: string): FsrsCardState {
  if (isFsrsCardState(value)) {
    return value
  }

  throw new Error(`Invalid FSRS card state "${value}".`)
}

/** Checks whether a persisted string is a supported FSRS card kind. */
export function isFsrsCardKind(value: string): value is FsrsCardKind {
  return fsrsCardKinds.includes(value as FsrsCardKind)
}

/** Parses a persisted FSRS card kind at storage and API boundaries. */
export function parseFsrsCardKind(value: string): FsrsCardKind {
  if (isFsrsCardKind(value)) {
    return value
  }

  throw new Error(`Invalid FSRS card kind "${value}".`)
}
