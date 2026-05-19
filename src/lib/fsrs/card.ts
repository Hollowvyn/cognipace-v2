import { State, type Card, type CardInput } from 'ts-fsrs'

export const fsrsCardStates = [
  'new',
  'learning',
  'review',
  'relearning',
] as const

export const fsrsCardKinds = ['default'] as const

export type FsrsCardState = (typeof fsrsCardStates)[number]
export type FsrsCardKind = (typeof fsrsCardKinds)[number]

export const defaultFsrsCardKind: FsrsCardKind = 'default'

export interface FsrsCardSnapshot {
  dueAt: Date
  stability: number
  difficulty: number
  elapsedDays: number
  scheduledDays: number
  learningSteps: number
  reps: number
  lapses: number
  state: FsrsCardState
  lastReviewAt: Date | null
}

export function toFsrsCard(snapshot: FsrsCardSnapshot): CardInput {
  const card: CardInput = {
    due: snapshot.dueAt,
    stability: snapshot.stability,
    difficulty: snapshot.difficulty,
    elapsed_days: snapshot.elapsedDays,
    scheduled_days: snapshot.scheduledDays,
    learning_steps: snapshot.learningSteps,
    reps: snapshot.reps,
    lapses: snapshot.lapses,
    state: toFsrsState(snapshot.state),
  }

  if (snapshot.lastReviewAt) {
    card.last_review = snapshot.lastReviewAt
  }

  return card
}

export function fromFsrsCard(card: Card): FsrsCardSnapshot {
  return {
    dueAt: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: fromFsrsState(card.state),
    lastReviewAt: card.last_review ?? null,
  }
}

export function toFsrsState(state: FsrsCardState) {
  switch (state) {
    case 'new':
      return State.New
    case 'learning':
      return State.Learning
    case 'review':
      return State.Review
    case 'relearning':
      return State.Relearning
  }
}

export function fromFsrsState(state: State): FsrsCardState {
  switch (state) {
    case State.New:
      return 'new'
    case State.Learning:
      return 'learning'
    case State.Review:
      return 'review'
    case State.Relearning:
      return 'relearning'
  }
}
