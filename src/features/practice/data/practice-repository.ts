import { and, asc, eq } from 'drizzle-orm'

import {
  createInitialFsrsCard,
  defaultFsrsCardKind,
  parseSerializedFsrsReviewLogSnapshot,
  parseFsrsCardState,
  parseReviewRating,
  replayReviewHistorySequence,
  scheduleReview,
  serializeFsrsReviewLogSnapshot,
  type FsrsCardKind,
  type FsrsCardSnapshot,
  type FsrsReviewLogSnapshot,
  type ReviewRating,
} from '@/lib/fsrs'
import type { Db } from '@/platform/db'
import {
  fsrsCards,
  problemPractice,
  reviewAttempts,
  type FsrsCardRow,
  type ProblemPracticeRow,
  type ReviewAttemptRow,
} from '@/platform/db/schema'

import {
  derivePracticeSummary,
  normalizeReviewLogFields,
  reviewModes,
  statusFromReview,
  type OverrideLastReviewResultInput,
  type PracticeLogFields,
  type PracticeStateSnapshot,
  type PracticeSummary,
  type ReviewMode,
  type ReviewResult,
  type SaveReviewResultInput,
} from '../domain'

export function createPracticeRepository(db: Db) {
  return new PracticeRepository(db)
}

export class PracticeRepository {
  constructor(private readonly db: Db) {}

  async saveReviewResult(input: SaveReviewResultInput): Promise<ReviewResult> {
    const reviewedAt = input.reviewedAt ?? new Date()
    const cardKind = input.cardKind ?? defaultFsrsCardKind
    const cardId = createFsrsCardId(input.problemId, cardKind)
    const currentCard =
      (await this.getCard(input.problemId, cardKind)) ??
      createInitialFsrsCard(reviewedAt)
    const scheduled = scheduleReview(currentCard, input.rating, reviewedAt, {
      targetRetention: input.targetRetention,
    })
    const status = statusFromReview(input.rating, scheduled.card)
    const timestamp = reviewedAt.getTime()
    const reviewAttemptId =
      input.reviewAttemptId ?? createReviewAttemptId(input.problemId, timestamp)
    const attemptLog = normalizeReviewLogFields(input.log)

    return this.db.transaction(async (transactionDb) => {
      const previousPractice = await this.getPracticeState(
        input.problemId,
        transactionDb,
      )

      await this.upsertCard(transactionDb, {
        id: cardId,
        problemId: input.problemId,
        cardKind,
        card: scheduled.card,
        now: reviewedAt,
      })

      await transactionDb.insert(reviewAttempts).values({
        id: reviewAttemptId,
        problemId: input.problemId,
        cardId,
        rating: input.rating,
        reviewMode: input.reviewMode ?? 'manual',
        reviewedAt: timestamp,
        elapsedSeconds: normalizeElapsedSeconds(input.elapsedSeconds),
        isCorrect: input.isCorrect ?? null,
        ...toReviewLogRow(attemptLog),
        fsrsReviewLog: serializeFsrsReviewLogSnapshot(scheduled.log),
        createdAt: timestamp,
        updatedAt: timestamp,
      })

      const attempts = await this.readReviewAttempts(transactionDb, {
        problemId: input.problemId,
        cardId,
      })
      const practice = await this.upsertPracticeAggregate(transactionDb, {
        problemId: input.problemId,
        status,
        attempts,
        log: input.log === undefined ? previousPractice?.log : attemptLog,
        now: reviewedAt,
      })
      const summary = derivePracticeSummary({
        practice,
        card: scheduled.card,
        now: reviewedAt,
        targetRetention: input.targetRetention,
      })

      return {
        problemId: input.problemId,
        cardId,
        rating: input.rating,
        status,
        dueAt: scheduled.card.dueAt,
        reviewedAt,
        card: scheduled.card,
        summary,
      }
    })
  }

  async overrideLastReviewResult(
    input: OverrideLastReviewResultInput,
  ): Promise<ReviewResult> {
    const cardKind = input.cardKind ?? defaultFsrsCardKind
    const cardId = createFsrsCardId(input.problemId, cardKind)

    return this.db.transaction(async (transactionDb) => {
      const attempts = await this.readReviewAttempts(transactionDb, {
        problemId: input.problemId,
        cardId,
      })
      const latestAttempt = attempts.at(-1)

      if (!latestAttempt) {
        throw new Error('No review result exists to override.')
      }

      const changedAt = new Date()
      const updatedAttempt: PracticeReviewAttempt = {
        ...latestAttempt,
        rating: input.rating,
        reviewedAt: input.reviewedAt ?? latestAttempt.reviewedAt,
        elapsedSeconds:
          input.elapsedSeconds === undefined
            ? latestAttempt.elapsedSeconds
            : normalizeElapsedSeconds(input.elapsedSeconds),
        isCorrect:
          input.isCorrect === undefined
            ? latestAttempt.isCorrect
            : input.isCorrect,
        log:
          input.log === undefined
            ? latestAttempt.log
            : normalizeReviewLogFields(input.log),
        updatedAt: changedAt,
      }
      const updatedAttempts = [...attempts.slice(0, -1), updatedAttempt]
      const replayedReview = replayReviewHistorySequence(updatedAttempts, {
        targetRetention: input.targetRetention,
      }).at(-1)
      if (!replayedReview) {
        throw new Error('No review result exists to override.')
      }

      const replayedCard = replayedReview.card
      const status = statusFromReview(input.rating, replayedCard)

      await this.upsertCard(transactionDb, {
        id: cardId,
        problemId: input.problemId,
        cardKind,
        card: replayedCard,
        now: changedAt,
      })

      await transactionDb
        .update(reviewAttempts)
        .set({
          rating: updatedAttempt.rating,
          reviewedAt: updatedAttempt.reviewedAt.getTime(),
          elapsedSeconds: updatedAttempt.elapsedSeconds,
          isCorrect: updatedAttempt.isCorrect,
          ...toReviewLogRow(updatedAttempt.log),
          fsrsReviewLog: serializeFsrsReviewLogSnapshot(replayedReview.log),
          updatedAt: updatedAttempt.updatedAt.getTime(),
        })
        .where(eq(reviewAttempts.id, updatedAttempt.id))

      const practice = await this.upsertPracticeAggregate(transactionDb, {
        problemId: input.problemId,
        status,
        attempts: updatedAttempts,
        log: updatedAttempt.log,
        now: changedAt,
      })
      const summary = derivePracticeSummary({
        practice,
        card: replayedCard,
        now: changedAt,
        targetRetention: input.targetRetention,
      })

      return {
        problemId: input.problemId,
        cardId,
        rating: input.rating,
        status,
        dueAt: replayedCard.dueAt,
        reviewedAt: updatedAttempt.reviewedAt,
        card: replayedCard,
        summary,
      }
    })
  }

  async getPracticeSummary(
    problemId: string,
    options: {
      cardKind?: FsrsCardKind | undefined
      now?: Date | undefined
      targetRetention?: number | undefined
    } = {},
  ): Promise<PracticeSummary> {
    const cardKind = options.cardKind ?? defaultFsrsCardKind
    const [practice, card] = await Promise.all([
      this.getPracticeState(problemId),
      this.getCard(problemId, cardKind),
    ])

    return derivePracticeSummary({
      practice,
      card,
      now: options.now,
      targetRetention: options.targetRetention,
    })
  }

  async getOrCreateCard(
    problemId: string,
    cardKind: FsrsCardKind = defaultFsrsCardKind,
    now = new Date(),
  ) {
    const existingCard = await this.getCard(problemId, cardKind)

    if (existingCard) {
      return existingCard
    }

    const initialCard = createInitialFsrsCard(now)
    await this.upsertCard(this.db, {
      id: createFsrsCardId(problemId, cardKind),
      problemId,
      cardKind,
      card: initialCard,
      now,
    })

    return initialCard
  }

  async getCard(
    problemId: string,
    cardKind: FsrsCardKind = defaultFsrsCardKind,
  ): Promise<FsrsCardSnapshot | null> {
    const rows = await this.db
      .select()
      .from(fsrsCards)
      .where(
        and(
          eq(fsrsCards.problemId, problemId),
          eq(fsrsCards.cardKind, cardKind),
        ),
      )
      .limit(1)

    return rows[0] ? mapFsrsCard(rows[0]) : null
  }

  async getPracticeState(
    problemId: string,
    db: PracticeReadDb = this.db,
  ): Promise<PracticeStateSnapshot | null> {
    const rows = await db
      .select()
      .from(problemPractice)
      .where(eq(problemPractice.problemId, problemId))
      .limit(1)

    return rows[0] ? mapPracticeState(rows[0]) : null
  }

  private async readReviewAttempts(
    db: PracticeReadDb,
    input: {
      problemId: string
      cardId: string
    },
  ): Promise<PracticeReviewAttempt[]> {
    const rows = await db
      .select()
      .from(reviewAttempts)
      .where(
        and(
          eq(reviewAttempts.problemId, input.problemId),
          eq(reviewAttempts.cardId, input.cardId),
        ),
      )
      .orderBy(asc(reviewAttempts.reviewedAt), asc(reviewAttempts.createdAt))

    return rows.map(mapReviewAttempt)
  }

  private async upsertPracticeAggregate(
    db: PracticeWriteDb,
    input: {
      problemId: string
      status: PracticeStateSnapshot['status']
      attempts: PracticeReviewAttempt[]
      log?: Required<PracticeLogFields> | undefined
      now: Date
    },
  ): Promise<PracticeStateSnapshot> {
    const aggregate = summarizeAttempts(input.attempts)
    const log = input.log ?? aggregate.lastAttempt.log
    const firstReviewedAt = aggregate.firstAttempt.reviewedAt.getTime()
    const lastReviewedAt = aggregate.lastAttempt.reviewedAt.getTime()
    const updatedAt = input.now.getTime()

    await db
      .insert(problemPractice)
      .values({
        problemId: input.problemId,
        status: input.status,
        firstSeenAt: firstReviewedAt,
        lastSeenAt: lastReviewedAt,
        lastReviewedAt,
        solvedCount: aggregate.solvedCount,
        attemptCount: aggregate.attemptCount,
        isSuspended: false,
        lastRating: aggregate.lastAttempt.rating,
        lastElapsedSeconds: aggregate.lastAttempt.elapsedSeconds,
        bestElapsedSeconds: aggregate.bestElapsedSeconds,
        ...toPracticeLogRow(log),
        createdAt: firstReviewedAt,
        updatedAt,
      })
      .onConflictDoUpdate({
        target: problemPractice.problemId,
        set: {
          status: input.status,
          lastSeenAt: lastReviewedAt,
          lastReviewedAt,
          solvedCount: aggregate.solvedCount,
          attemptCount: aggregate.attemptCount,
          isSuspended: false,
          lastRating: aggregate.lastAttempt.rating,
          lastElapsedSeconds: aggregate.lastAttempt.elapsedSeconds,
          bestElapsedSeconds: aggregate.bestElapsedSeconds,
          ...toPracticeLogRow(log),
          updatedAt,
        },
      })

    const practice = await this.getPracticeState(input.problemId, db)

    if (!practice) {
      throw new Error(`Failed to read practice state for "${input.problemId}".`)
    }

    return practice
  }

  private async upsertCard(
    db: PracticeWriteDb,
    input: {
      id: string
      problemId: string
      cardKind: FsrsCardKind
      card: FsrsCardSnapshot
      now: Date
    },
  ) {
    const row = toFsrsCardRow(input)

    await db
      .insert(fsrsCards)
      .values(row)
      .onConflictDoUpdate({
        target: fsrsCards.id,
        set: {
          dueAt: row.dueAt,
          stability: row.stability,
          difficulty: row.difficulty,
          elapsedDays: row.elapsedDays,
          scheduledDays: row.scheduledDays,
          learningSteps: row.learningSteps,
          reps: row.reps,
          lapses: row.lapses,
          state: row.state,
          lastReviewAt: row.lastReviewAt,
          updatedAt: row.updatedAt,
        },
      })
  }
}

type PracticeReadDb = Pick<Db, 'select'>
type PracticeWriteDb = Pick<Db, 'insert' | 'select' | 'update'>

interface PracticeReviewAttempt {
  id: string
  problemId: string
  cardId: string
  rating: ReviewRating
  reviewMode: ReviewMode
  reviewedAt: Date
  elapsedSeconds: number | null
  isCorrect: boolean | null
  log: Required<PracticeLogFields>
  createdAt: Date
  updatedAt: Date
  fsrsReviewLog: FsrsReviewLogSnapshot | null
}

export function createFsrsCardId(problemId: string, cardKind: FsrsCardKind) {
  return `${problemId}:${cardKind}`
}

function mapFsrsCard(row: FsrsCardRow): FsrsCardSnapshot {
  return {
    dueAt: new Date(row.dueAt),
    stability: row.stability,
    difficulty: row.difficulty,
    elapsedDays: row.elapsedDays,
    scheduledDays: row.scheduledDays,
    learningSteps: row.learningSteps,
    reps: row.reps,
    lapses: row.lapses,
    state: parseFsrsCardState(row.state),
    lastReviewAt: row.lastReviewAt === null ? null : new Date(row.lastReviewAt),
  }
}

function mapPracticeState(row: ProblemPracticeRow): PracticeStateSnapshot {
  return {
    status: parsePracticeStatus(row.status),
    lastReviewedAt:
      row.lastReviewedAt === null ? null : new Date(row.lastReviewedAt),
    attemptCount: row.attemptCount,
    solvedCount: row.solvedCount,
    isSuspended: row.isSuspended,
    lastRating:
      row.lastRating === null ? null : parseReviewRating(row.lastRating),
    lastElapsedSeconds: row.lastElapsedSeconds,
    bestElapsedSeconds: row.bestElapsedSeconds,
    log: normalizeReviewLogFields({
      interviewPattern: row.interviewPattern,
      timeComplexity: row.timeComplexity,
      spaceComplexity: row.spaceComplexity,
      languages: row.languages,
      notes: row.notes,
    }),
  }
}

function mapReviewAttempt(row: ReviewAttemptRow): PracticeReviewAttempt {
  return {
    id: row.id,
    problemId: row.problemId,
    cardId: row.cardId,
    rating: parseReviewRating(row.rating),
    reviewMode: parseReviewMode(row.reviewMode),
    reviewedAt: new Date(row.reviewedAt),
    elapsedSeconds: row.elapsedSeconds,
    isCorrect: row.isCorrect,
    log: normalizeReviewLogFields({
      interviewPattern: row.interviewPattern,
      timeComplexity: row.timeComplexity,
      spaceComplexity: row.spaceComplexity,
      languages: row.languages,
      notes: row.notes,
    }),
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
    fsrsReviewLog: parseStoredFsrsReviewLogSnapshot(row.fsrsReviewLog),
  }
}

function toFsrsCardRow(input: {
  id: string
  problemId: string
  cardKind: FsrsCardKind
  card: FsrsCardSnapshot
  now: Date
}) {
  const timestamp = input.now.getTime()

  return {
    id: input.id,
    problemId: input.problemId,
    cardKind: input.cardKind,
    dueAt: input.card.dueAt.getTime(),
    stability: input.card.stability,
    difficulty: input.card.difficulty,
    elapsedDays: input.card.elapsedDays,
    scheduledDays: input.card.scheduledDays,
    learningSteps: input.card.learningSteps,
    reps: input.card.reps,
    lapses: input.card.lapses,
    state: input.card.state,
    lastReviewAt: input.card.lastReviewAt?.getTime() ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

function summarizeAttempts(attempts: PracticeReviewAttempt[]) {
  const [firstAttempt] = attempts
  const lastAttempt = attempts.at(-1)

  if (!firstAttempt || !lastAttempt) {
    throw new Error('Cannot summarize an empty review attempt history.')
  }

  const elapsedValues = attempts
    .map((attempt) => attempt.elapsedSeconds)
    .filter((value): value is number => value !== null && value > 0)

  return {
    firstAttempt,
    lastAttempt,
    attemptCount: attempts.length,
    solvedCount: attempts.filter((attempt) => attempt.isCorrect === true)
      .length,
    bestElapsedSeconds:
      elapsedValues.length > 0 ? Math.min(...elapsedValues) : null,
  }
}

function normalizeElapsedSeconds(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null
  }

  return Math.round(value)
}

function toPracticeLogRow(log: Required<PracticeLogFields>) {
  return {
    interviewPattern: log.interviewPattern,
    timeComplexity: log.timeComplexity,
    spaceComplexity: log.spaceComplexity,
    languages: log.languages,
    notes: log.notes,
  }
}

function toReviewLogRow(log: Required<PracticeLogFields>) {
  return toPracticeLogRow(log)
}

function parseStoredFsrsReviewLogSnapshot(
  value: string | null,
): FsrsReviewLogSnapshot | null {
  if (!value) {
    return null
  }

  try {
    return parseSerializedFsrsReviewLogSnapshot(value)
  } catch {
    return null
  }
}

function parseReviewMode(value: string): ReviewMode {
  if (reviewModes.includes(value as ReviewMode)) {
    return value as ReviewMode
  }

  throw new Error(`Invalid review mode "${value}".`)
}

function parsePracticeStatus(value: string): PracticeStateSnapshot['status'] {
  switch (value) {
    case 'new':
    case 'learning':
    case 'review':
    case 'mastered':
    case 'suspended':
      return value
    default:
      throw new Error(`Invalid practice status "${value}".`)
  }
}

function createReviewAttemptId(problemId: string, timestamp: number) {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }

  return `${problemId}:${timestamp}`
}
