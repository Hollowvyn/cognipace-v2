import { and, eq, sql } from 'drizzle-orm'

import {
  createInitialFsrsCard,
  defaultFsrsCardKind,
  scheduleReview,
  type FsrsCardKind,
  type FsrsCardSnapshot,
} from '@/lib/fsrs'
import type { Db } from '@/platform/db'
import {
  fsrsCards,
  problemPractice,
  reviewAttempts,
  type FsrsCardRow,
} from '@/platform/db/schema'

import {
  statusFromReview,
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

    return this.db.transaction(async (transactionDb) => {
      await this.upsertCard(transactionDb, {
        id: cardId,
        problemId: input.problemId,
        cardKind,
        card: scheduled.card,
        now: reviewedAt,
      })

      await transactionDb
        .insert(problemPractice)
        .values({
          problemId: input.problemId,
          status,
          firstSeenAt: timestamp,
          lastSeenAt: timestamp,
          lastReviewedAt: timestamp,
          solvedCount: input.isCorrect ? 1 : 0,
          attemptCount: 1,
          isSuspended: false,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
        .onConflictDoUpdate({
          target: problemPractice.problemId,
          set: {
            status,
            lastSeenAt: timestamp,
            lastReviewedAt: timestamp,
            solvedCount: sql`${problemPractice.solvedCount} + ${
              input.isCorrect ? 1 : 0
            }`,
            attemptCount: sql`${problemPractice.attemptCount} + 1`,
            updatedAt: timestamp,
          },
        })

      await transactionDb.insert(reviewAttempts).values({
        id: reviewAttemptId,
        problemId: input.problemId,
        cardId,
        rating: input.rating,
        reviewMode: input.reviewMode ?? 'manual',
        reviewedAt: timestamp,
        elapsedSeconds: input.elapsedSeconds ?? null,
        isCorrect: input.isCorrect ?? null,
        notes: input.notes ?? null,
        createdAt: timestamp,
      })

      return {
        problemId: input.problemId,
        cardId,
        rating: input.rating,
        status,
        dueAt: scheduled.card.dueAt,
        reviewedAt,
        card: scheduled.card,
      }
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

type PracticeWriteDb = Pick<Db, 'insert'>

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
    state: row.state as FsrsCardSnapshot['state'],
    lastReviewAt: row.lastReviewAt === null ? null : new Date(row.lastReviewAt),
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

function createReviewAttemptId(problemId: string, timestamp: number) {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }

  return `${problemId}:${timestamp}`
}
