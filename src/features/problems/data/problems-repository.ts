import { and, asc, eq, inArray } from 'drizzle-orm'

import {
  derivePracticeSummary,
  normalizeReviewLogFields,
  parsePracticeStatus,
  type PracticeStateSnapshot,
  type PracticeSummary,
} from '@/features/practice/domain'
import { renamePracticeProblemReferences } from '@/features/practice/data/practice-repository'
import {
  defaultFsrsCardKind,
  parseFsrsCardState,
  parseReviewRating,
  type FsrsCardSnapshot,
} from '@/lib/fsrs'
import { normalizeLeetCodeSlug, parseLeetCodeProblemInput } from '@/lib/leetcode'
import type { Db } from '@/platform/db'
import {
  companies,
  fsrsCards,
  problemCompanies,
  problemPractice,
  problemTopics,
  problems,
  reviewAttempts,
  topics,
  trackGroupProblems,
  trackGroups,
  tracks,
  type InsertProblemRow,
  type ProblemRow,
} from '@/platform/db/schema'

import {
  createLeetCodeProblemSlug,
  normalizeProblemDifficulty,
  titleFromSlug,
  type Problem,
  type ProblemContext,
  type UpsertProblemInput,
} from '../domain'
import type { ProblemLibraryStatus } from '../api/problems-contracts'

export function createProblemsRepository(db: Db) {
  return new ProblemsRepository(db)
}

export class ProblemsRepository {
  constructor(private readonly db: Db) {}

  async upsertFromLeetCode(input: UpsertProblemInput, now = new Date()) {
    const slug = normalizeLeetCodeSlug(input.slug)

    if (!slug) {
      throw new Error('Cannot upsert a LeetCode problem without a slug.')
    }

    await this.db.transaction(async (transactionDb) => {
      await this.renameProblemSlug(transactionDb, {
        fromSlug: input.previousSlug,
        toSlug: slug,
        now,
      })

      const timestamp = now.getTime()
      const problem = {
        slug: createLeetCodeProblemSlug(slug),
        title: input.title?.trim() || titleFromSlug(slug),
        difficulty: normalizeProblemDifficulty(input.difficulty),
        isPremium: input.isPremium ?? false,
        isUserCreated: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      } as const

      await transactionDb
        .insert(problems)
        .values(problem)
        .onConflictDoUpdate({
          target: problems.slug,
          set: {
            title: problem.title,
            difficulty: problem.difficulty,
            isPremium: problem.isPremium,
            updatedAt: timestamp,
          },
        })
    })

    const savedProblem = await this.getBySlug(slug)

    if (!savedProblem) {
      throw new Error(`Failed to read saved problem "${slug}".`)
    }

    return savedProblem
  }

  async getLibrary(options: ProblemLibraryReadOptions = {}) {
    const generatedAt = options.now ?? new Date()
    const rows = await this.readLibraryRows({
      now: generatedAt,
      targetRetention: options.targetRetention,
    })
    const summary = summarizeLibraryRows(rows)

    return {
      generatedAt,
      summary,
      options: await this.readLibraryOptions(this.db),
      rows,
    } satisfies ProblemLibrary
  }

  async getForEdit(problemSlug: string) {
    return this.readProblemForEdit(this.db, normalizeLeetCodeSlug(problemSlug))
  }

  async createProblem(input: CreateProblemInput, now = new Date()) {
    const parsedInput = parseLeetCodeProblemInput(input.slugOrUrl)

    if (!parsedInput) {
      throw new Error('Cannot create a problem without a LeetCode slug.')
    }

    const slug = createLeetCodeProblemSlug(parsedInput.slug)
    const timestamp = now.getTime()

    await this.db.transaction(async (transactionDb) => {
      await transactionDb
        .insert(problems)
        .values({
          slug,
          title: input.title.trim(),
          difficulty: normalizeProblemDifficulty(input.difficulty),
          isPremium: input.isPremium,
          isUserCreated: true,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
        .onConflictDoUpdate({
          target: problems.slug,
          set: {
            title: input.title.trim(),
            difficulty: normalizeProblemDifficulty(input.difficulty),
            isPremium: input.isPremium,
            updatedAt: timestamp,
          },
        })

      await this.setProblemTopics(transactionDb, slug, input.topicLabels)
      await this.setProblemCompanies(transactionDb, slug, input.companyLabels)
    })

    return this.readRequiredProblemForEdit(slug)
  }

  async updateProblem(input: UpdateProblemInput, now = new Date()) {
    const slug = normalizeLeetCodeSlug(input.problemSlug)
    const timestamp = now.getTime()

    const updated = await this.db.transaction(async (transactionDb) => {
      const existing = await this.readProblemRow(transactionDb, slug)

      if (!existing) {
        return false
      }

      await transactionDb
        .update(problems)
        .set({
          title: input.title.trim(),
          difficulty: normalizeProblemDifficulty(input.difficulty),
          isPremium: input.isPremium,
          updatedAt: timestamp,
        })
        .where(eq(problems.slug, slug))

      await this.setProblemTopics(transactionDb, slug, input.topicLabels)
      await this.setProblemCompanies(transactionDb, slug, input.companyLabels)

      return true
    })

    return updated ? this.readRequiredProblemForEdit(slug) : null
  }

  async deleteProblems(problemSlugs: readonly string[]) {
    const requestedSlugs = normalizeProblemSlugList(problemSlugs)
    const existingRows = await this.readProblemOwnershipRows(requestedSlugs)
    const existingBySlug = new Map(existingRows.map((row) => [row.slug, row]))
    const deletedProblemSlugs = requestedSlugs.filter(
      (slug) => existingBySlug.get(slug)?.isUserCreated === true,
    )
    const protectedProblemSlugs = requestedSlugs.filter((slug) => {
      const row = existingBySlug.get(slug)
      return row !== undefined && !row.isUserCreated
    })
    const missingProblemSlugs = requestedSlugs.filter(
      (slug) => !existingBySlug.has(slug),
    )

    if (deletedProblemSlugs.length > 0) {
      await this.db
        .delete(problems)
        .where(inArray(problems.slug, deletedProblemSlugs))
    }

    return {
      deletedProblemSlugs,
      protectedProblemSlugs,
      missingProblemSlugs,
    } satisfies ProblemDeleteResult
  }

  async bulkUpdateProblems(input: BulkUpdateProblemsInput, now = new Date()) {
    const requestedSlugs = normalizeProblemSlugList(input.problemSlugs)
    const existingRows = await this.readProblemOwnershipRows(requestedSlugs)
    const existingSlugs = requestedSlugs.filter((slug) =>
      existingRows.some((row) => row.slug === slug),
    )
    const existingSet = new Set(existingSlugs)
    const missingProblemSlugs = requestedSlugs.filter(
      (slug) => !existingSet.has(slug),
    )

    if (existingSlugs.length === 0) {
      return {
        updatedProblemSlugs: [],
        missingProblemSlugs,
      } satisfies ProblemBulkUpdate
    }

    const timestamp = now.getTime()

    await this.db.transaction(async (transactionDb) => {
      const scalarUpdate: Partial<InsertProblemRow> = {
        updatedAt: timestamp,
      }

      if (input.set.difficulty !== undefined) {
        scalarUpdate.difficulty = normalizeProblemDifficulty(
          input.set.difficulty,
        )
      }

      if (input.set.isPremium !== undefined) {
        scalarUpdate.isPremium = input.set.isPremium
      }

      await transactionDb
        .update(problems)
        .set(scalarUpdate)
        .where(inArray(problems.slug, existingSlugs))

      if (input.set.topicLabels !== undefined) {
        for (const slug of existingSlugs) {
          await this.setProblemTopics(
            transactionDb,
            slug,
            input.set.topicLabels,
          )
        }
      }

      if (input.set.companyLabels !== undefined) {
        for (const slug of existingSlugs) {
          await this.setProblemCompanies(
            transactionDb,
            slug,
            input.set.companyLabels,
          )
        }
      }
    })

    return {
      updatedProblemSlugs: existingSlugs,
      missingProblemSlugs,
    } satisfies ProblemBulkUpdate
  }

  async getBySlug(slug: string) {
    const rows = await this.db
      .select()
      .from(problems)
      .where(eq(problems.slug, normalizeLeetCodeSlug(slug)))
      .limit(1)

    return rows[0] ? mapProblem(rows[0]) : null
  }

  async getContextBySlug(slug: string): Promise<ProblemContext | null> {
    const rows = await this.db
      .select({
        problem: {
          slug: problems.slug,
          title: problems.title,
          difficulty: problems.difficulty,
          isPremium: problems.isPremium,
          isUserCreated: problems.isUserCreated,
          createdAt: problems.createdAt,
          updatedAt: problems.updatedAt,
        },
        practiceStatus: problemPractice.status,
        cardDueAt: fsrsCards.dueAt,
      })
      .from(problems)
      .leftJoin(problemPractice, eq(problemPractice.problemSlug, problems.slug))
      .leftJoin(
        fsrsCards,
        and(
          eq(fsrsCards.problemSlug, problems.slug),
          eq(fsrsCards.cardKind, defaultFsrsCardKind),
        ),
      )
      .where(eq(problems.slug, normalizeLeetCodeSlug(slug)))
      .limit(1)

    const row = rows[0]

    if (!row) {
      return null
    }

    return {
      problem: mapProblem(row.problem),
      isTracked: row.practiceStatus !== null,
      practiceStatus:
        row.practiceStatus === null
          ? null
          : parsePracticeStatus(row.practiceStatus),
      dueAt: row.cardDueAt === null ? null : new Date(row.cardDueAt),
    }
  }

  private async readLibraryRows(options: {
    now: Date
    targetRetention?: number | undefined
  }) {
    const baseRows = await this.db
      .select({
        problem: problemReadFields,
        practice: practiceReadFields,
        card: cardReadFields,
      })
      .from(problems)
      .leftJoin(problemPractice, eq(problemPractice.problemSlug, problems.slug))
      .leftJoin(
        fsrsCards,
        and(
          eq(fsrsCards.problemSlug, problems.slug),
          eq(fsrsCards.cardKind, defaultFsrsCardKind),
        ),
      )
      .orderBy(asc(problems.title), asc(problems.slug))
    const slugs = baseRows.map((row) => row.problem.slug)
    const [topicsBySlug, companiesBySlug, tracksBySlug, lastSolvedBySlug] =
      await Promise.all([
        this.readTopicsByProblem(this.db, slugs),
        this.readCompaniesByProblem(this.db, slugs),
        this.readTrackMembershipsByProblem(this.db, slugs),
        this.readLastSolvedByProblem(this.db, slugs),
      ])

    return baseRows.map((row) => {
      const problem = mapProblem(row.problem)
      const practice = mapPracticeState(row.practice)
      const card = mapFsrsCard(row.card)
      const summary = derivePracticeSummary({
        practice,
        card,
        now: options.now,
        targetRetention: options.targetRetention,
      })

      return {
        problem,
        status: deriveProblemLibraryStatus(summary),
        summary,
        nextReviewAt: summary.nextReviewAt,
        lastReviewedAt: summary.lastReviewedAt,
        lastSolvedAt: lastSolvedBySlug.get(problem.slug) ?? null,
        topics: topicsBySlug.get(problem.slug) ?? [],
        companies: companiesBySlug.get(problem.slug) ?? [],
        trackMemberships: tracksBySlug.get(problem.slug) ?? [],
      } satisfies ProblemLibraryRow
    })
  }

  private async readProblemForEdit(
    db: ProblemReadDb,
    problemSlug: string,
  ): Promise<ProblemForEdit | null> {
    const problem = await this.readProblemRow(db, problemSlug)

    if (!problem) {
      return null
    }

    const [topicsBySlug, companiesBySlug, tracksBySlug, options] =
      await Promise.all([
        this.readTopicsByProblem(db, [problemSlug]),
        this.readCompaniesByProblem(db, [problemSlug]),
        this.readTrackMembershipsByProblem(db, [problemSlug]),
        this.readLibraryOptions(db),
      ])

    return {
      problem: mapProblem(problem),
      topics: topicsBySlug.get(problemSlug) ?? [],
      companies: companiesBySlug.get(problemSlug) ?? [],
      trackMemberships: tracksBySlug.get(problemSlug) ?? [],
      options,
    }
  }

  private async readRequiredProblemForEdit(problemSlug: string) {
    const problemForEdit = await this.getForEdit(problemSlug)

    if (!problemForEdit) {
      throw new Error(`Failed to read saved problem "${problemSlug}".`)
    }

    return problemForEdit
  }

  private async readProblemRow(db: ProblemReadDb, problemSlug: string) {
    const rows = await db
      .select()
      .from(problems)
      .where(eq(problems.slug, problemSlug))
      .limit(1)

    return rows[0] ?? null
  }

  private async readProblemOwnershipRows(problemSlugs: readonly string[]) {
    if (problemSlugs.length === 0) {
      return []
    }

    return this.db
      .select({
        slug: problems.slug,
        isUserCreated: problems.isUserCreated,
      })
      .from(problems)
      .where(inArray(problems.slug, [...problemSlugs]))
  }

  private async readTopicsByProblem(
    db: ProblemReadDb,
    problemSlugs: readonly string[],
  ) {
    if (problemSlugs.length === 0) {
      return new Map<string, ProblemTaxonomyLabel[]>()
    }

    const rows = await db
      .select({
        problemSlug: problemTopics.problemSlug,
        id: topics.id,
        label: topics.label,
      })
      .from(problemTopics)
      .innerJoin(topics, eq(topics.id, problemTopics.topicId))
      .where(inArray(problemTopics.problemSlug, [...problemSlugs]))
      .orderBy(asc(topics.label))

    return groupLabelsByProblem(rows)
  }

  private async readCompaniesByProblem(
    db: ProblemReadDb,
    problemSlugs: readonly string[],
  ) {
    if (problemSlugs.length === 0) {
      return new Map<string, ProblemTaxonomyLabel[]>()
    }

    const rows = await db
      .select({
        problemSlug: problemCompanies.problemSlug,
        id: companies.id,
        label: companies.label,
      })
      .from(problemCompanies)
      .innerJoin(companies, eq(companies.id, problemCompanies.companyId))
      .where(inArray(problemCompanies.problemSlug, [...problemSlugs]))
      .orderBy(asc(companies.label))

    return groupLabelsByProblem(rows)
  }

  private async readTrackMembershipsByProblem(
    db: ProblemReadDb,
    problemSlugs: readonly string[],
  ) {
    if (problemSlugs.length === 0) {
      return new Map<string, ProblemTrackMembership[]>()
    }

    const rows = await db
      .select({
        problemSlug: trackGroupProblems.problemSlug,
        trackId: tracks.id,
        trackSlug: tracks.slug,
        trackTitle: tracks.title,
        groupId: trackGroups.id,
        groupTitle: trackGroups.title,
        groupPosition: trackGroups.position,
        problemPosition: trackGroupProblems.position,
      })
      .from(trackGroupProblems)
      .innerJoin(trackGroups, eq(trackGroups.id, trackGroupProblems.trackGroupId))
      .innerJoin(tracks, eq(tracks.id, trackGroups.trackId))
      .where(inArray(trackGroupProblems.problemSlug, [...problemSlugs]))
      .orderBy(
        asc(tracks.title),
        asc(trackGroups.position),
        asc(trackGroupProblems.position),
      )

    const grouped = new Map<string, ProblemTrackMembership[]>()

    for (const row of rows) {
      const memberships = grouped.get(row.problemSlug) ?? []
      memberships.push({
        trackId: row.trackId,
        trackSlug: row.trackSlug,
        trackTitle: row.trackTitle,
        groupId: row.groupId,
        groupTitle: row.groupTitle,
        groupPosition: row.groupPosition,
        problemPosition: row.problemPosition,
      })
      grouped.set(row.problemSlug, memberships)
    }

    return grouped
  }

  private async readLastSolvedByProblem(
    db: ProblemReadDb,
    problemSlugs: readonly string[],
  ) {
    if (problemSlugs.length === 0) {
      return new Map<string, Date>()
    }

    const rows = await db
      .select({
        problemSlug: reviewAttempts.problemSlug,
        reviewedAt: reviewAttempts.reviewedAt,
      })
      .from(reviewAttempts)
      .where(
        and(
          inArray(reviewAttempts.problemSlug, [...problemSlugs]),
          eq(reviewAttempts.isCorrect, true),
        ),
      )
      .orderBy(asc(reviewAttempts.problemSlug), asc(reviewAttempts.reviewedAt))
    const lastSolvedBySlug = new Map<string, Date>()

    for (const row of rows) {
      lastSolvedBySlug.set(row.problemSlug, new Date(row.reviewedAt))
    }

    return lastSolvedBySlug
  }

  private async readLibraryOptions(db: ProblemReadDb) {
    const [topicOptions, companyOptions, trackGroupOptions] = await Promise.all([
      db
        .select({
          id: topics.id,
          label: topics.label,
        })
        .from(topics)
        .orderBy(asc(topics.label)),
      db
        .select({
          id: companies.id,
          label: companies.label,
        })
        .from(companies)
        .orderBy(asc(companies.label)),
      db
        .select({
          trackId: tracks.id,
          trackSlug: tracks.slug,
          trackTitle: tracks.title,
          groupId: trackGroups.id,
          groupTitle: trackGroups.title,
          groupPosition: trackGroups.position,
        })
        .from(trackGroups)
        .innerJoin(tracks, eq(tracks.id, trackGroups.trackId))
        .orderBy(asc(tracks.title), asc(trackGroups.position)),
    ])

    return {
      topics: topicOptions,
      companies: companyOptions,
      trackGroups: trackGroupOptions,
    } satisfies ProblemLibraryOptions
  }

  private async setProblemTopics(
    db: ProblemWriteDb,
    problemSlug: string,
    labels: readonly string[],
  ) {
    const normalizedLabels = normalizeLabelList(labels)
    const storedTopics = await this.ensureTopics(db, normalizedLabels)

    await db
      .delete(problemTopics)
      .where(eq(problemTopics.problemSlug, problemSlug))

    if (storedTopics.length === 0) {
      return
    }

    await db
      .insert(problemTopics)
      .values(
        storedTopics.map((topic) => ({
          problemSlug,
          topicId: topic.id,
        })),
      )
      .onConflictDoNothing()
  }

  private async setProblemCompanies(
    db: ProblemWriteDb,
    problemSlug: string,
    labels: readonly string[],
  ) {
    const normalizedLabels = normalizeLabelList(labels)
    const storedCompanies = await this.ensureCompanies(db, normalizedLabels)

    await db
      .delete(problemCompanies)
      .where(eq(problemCompanies.problemSlug, problemSlug))

    if (storedCompanies.length === 0) {
      return
    }

    await db
      .insert(problemCompanies)
      .values(
        storedCompanies.map((company) => ({
          problemSlug,
          companyId: company.id,
        })),
      )
      .onConflictDoNothing()
  }

  private async ensureTopics(
    db: ProblemWriteDb,
    labels: readonly string[],
  ) {
    if (labels.length === 0) {
      return []
    }

    await db
      .insert(topics)
      .values(labels.map((label) => ({ id: createTaxonomyId(label), label })))
      .onConflictDoNothing()

    const storedTopics = await db
      .select({
        id: topics.id,
        label: topics.label,
      })
      .from(topics)
      .where(inArray(topics.label, [...labels]))

    return sortLabelsByInput(labels, storedTopics)
  }

  private async ensureCompanies(
    db: ProblemWriteDb,
    labels: readonly string[],
  ) {
    if (labels.length === 0) {
      return []
    }

    await db
      .insert(companies)
      .values(labels.map((label) => ({ id: createTaxonomyId(label), label })))
      .onConflictDoNothing()

    const storedCompanies = await db
      .select({
        id: companies.id,
        label: companies.label,
      })
      .from(companies)
      .where(inArray(companies.label, [...labels]))

    return sortLabelsByInput(labels, storedCompanies)
  }

  private async renameProblemSlug(
    db: ProblemWriteDb,
    input: {
      fromSlug?: string | null | undefined
      toSlug: string
      now: Date
    },
  ) {
    const fromSlug = input.fromSlug ? normalizeLeetCodeSlug(input.fromSlug) : ''
    const toSlug = normalizeLeetCodeSlug(input.toSlug)

    if (!fromSlug || fromSlug === toSlug) {
      return
    }

    const existingOldProblem = await this.readProblemRow(db, fromSlug)
    const existingTargetProblem = await this.readProblemRow(db, toSlug)

    if (!existingOldProblem || existingTargetProblem) {
      return
    }

    const timestamp = input.now.getTime()
    await db.insert(problems).values({
      ...existingOldProblem,
      slug: toSlug,
      updatedAt: timestamp,
    })
    await db
      .update(problemTopics)
      .set({ problemSlug: toSlug })
      .where(eq(problemTopics.problemSlug, fromSlug))
    await db
      .update(problemCompanies)
      .set({ problemSlug: toSlug })
      .where(eq(problemCompanies.problemSlug, fromSlug))
    await db
      .update(trackGroupProblems)
      .set({ problemSlug: toSlug })
      .where(eq(trackGroupProblems.problemSlug, fromSlug))
    await renamePracticeProblemReferences(db, {
      fromSlug,
      toSlug,
      now: input.now,
    })

    await db.delete(problems).where(eq(problems.slug, fromSlug))
  }
}

const problemReadFields = {
  slug: problems.slug,
  title: problems.title,
  difficulty: problems.difficulty,
  isPremium: problems.isPremium,
  isUserCreated: problems.isUserCreated,
  createdAt: problems.createdAt,
  updatedAt: problems.updatedAt,
} as const

const practiceReadFields = {
  status: problemPractice.status,
  lastReviewedAt: problemPractice.lastReviewedAt,
  lastRating: problemPractice.lastRating,
  lastElapsedSeconds: problemPractice.lastElapsedSeconds,
  bestElapsedSeconds: problemPractice.bestElapsedSeconds,
  interviewPattern: problemPractice.interviewPattern,
  timeComplexity: problemPractice.timeComplexity,
  spaceComplexity: problemPractice.spaceComplexity,
  languages: problemPractice.languages,
  notes: problemPractice.notes,
  solvedCount: problemPractice.solvedCount,
  attemptCount: problemPractice.attemptCount,
  isSuspended: problemPractice.isSuspended,
} as const

const cardReadFields = {
  dueAt: fsrsCards.dueAt,
  stability: fsrsCards.stability,
  difficulty: fsrsCards.difficulty,
  elapsedDays: fsrsCards.elapsedDays,
  scheduledDays: fsrsCards.scheduledDays,
  learningSteps: fsrsCards.learningSteps,
  reps: fsrsCards.reps,
  lapses: fsrsCards.lapses,
  state: fsrsCards.state,
  lastReviewAt: fsrsCards.lastReviewAt,
} as const

function mapProblem(row: ProblemRow): Problem {
  return {
    slug: row.slug,
    title: row.title,
    difficulty: normalizeProblemDifficulty(row.difficulty),
    isPremium: row.isPremium,
    isUserCreated: row.isUserCreated,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  }
}

function mapPracticeState(
  row: SelectedPracticeReadRow | null,
): PracticeStateSnapshot | null {
  if (!row || row.status === null) {
    return null
  }

  return {
    status: parsePracticeStatus(row.status),
    lastReviewedAt:
      row.lastReviewedAt === null ? null : new Date(row.lastReviewedAt),
    attemptCount: row.attemptCount ?? 0,
    solvedCount: row.solvedCount ?? 0,
    isSuspended: row.isSuspended === true,
    lastRating:
      row.lastRating === null || row.lastRating === undefined
        ? null
        : parseReviewRating(row.lastRating),
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

function mapFsrsCard(
  row: SelectedCardReadRow | null,
): FsrsCardSnapshot | null {
  if (!row || row.dueAt === null) {
    return null
  }

  return {
    dueAt: new Date(row.dueAt),
    stability: row.stability ?? 0,
    difficulty: row.difficulty ?? 0,
    elapsedDays: row.elapsedDays ?? 0,
    scheduledDays: row.scheduledDays ?? 0,
    learningSteps: row.learningSteps ?? 0,
    reps: row.reps ?? 0,
    lapses: row.lapses ?? 0,
    state: parseFsrsCardState(row.state ?? 'new'),
    lastReviewAt:
      row.lastReviewAt === null || row.lastReviewAt === undefined
        ? null
        : new Date(row.lastReviewAt),
  }
}

function deriveProblemLibraryStatus(
  summary: PracticeSummary,
): ProblemLibraryStatus {
  if (summary.suspended) {
    return 'suspended'
  }

  if (summary.isDue) {
    return 'due'
  }

  return summary.isStarted ? 'scheduled' : 'not-started'
}

function summarizeLibraryRows(rows: readonly ProblemLibraryRow[]) {
  return {
    totalCount: rows.length,
    filteredCount: rows.length,
    dueCount: rows.filter((row) => row.status === 'due').length,
    suspendedCount: rows.filter((row) => row.status === 'suspended').length,
  }
}

function groupLabelsByProblem(
  rows: readonly (ProblemTaxonomyLabel & { problemSlug: string })[],
) {
  const grouped = new Map<string, ProblemTaxonomyLabel[]>()

  for (const row of rows) {
    const labels = grouped.get(row.problemSlug) ?? []
    labels.push({ id: row.id, label: row.label })
    grouped.set(row.problemSlug, labels)
  }

  return grouped
}

function normalizeProblemSlugList(problemSlugs: readonly string[]) {
  const seen = new Set<string>()
  const normalizedSlugs: string[] = []

  for (const problemSlug of problemSlugs) {
    const normalizedSlug = normalizeLeetCodeSlug(problemSlug)

    if (!normalizedSlug || seen.has(normalizedSlug)) {
      continue
    }

    seen.add(normalizedSlug)
    normalizedSlugs.push(normalizedSlug)
  }

  return normalizedSlugs
}

function normalizeLabelList(labels: readonly string[]) {
  const seen = new Set<string>()
  const normalizedLabels: string[] = []

  for (const label of labels) {
    const normalizedLabel = label.trim().replace(/\s+/g, ' ')
    const key = normalizedLabel.toLowerCase()

    if (!normalizedLabel || seen.has(key)) {
      continue
    }

    seen.add(key)
    normalizedLabels.push(normalizedLabel)
  }

  return normalizedLabels
}

function createTaxonomyId(label: string) {
  return normalizeLeetCodeSlug(label)
}

function sortLabelsByInput(
  inputLabels: readonly string[],
  labels: readonly ProblemTaxonomyLabel[],
) {
  const labelsByLabel = new Map(labels.map((label) => [label.label, label]))

  return inputLabels.map((label) => {
    const storedLabel = labelsByLabel.get(label)

    if (!storedLabel) {
      throw new Error(`Failed to read saved label "${label}".`)
    }

    return storedLabel
  })
}

type ProblemReadDb = Pick<Db, 'select'>
type ProblemWriteDb = Pick<Db, 'delete' | 'insert' | 'select' | 'update'>

interface SelectedPracticeReadRow {
  status: string | null
  lastReviewedAt: number | null
  lastRating: string | null
  lastElapsedSeconds: number | null
  bestElapsedSeconds: number | null
  interviewPattern: string | null
  timeComplexity: string | null
  spaceComplexity: string | null
  languages: string | null
  notes: string | null
  solvedCount: number | null
  attemptCount: number | null
  isSuspended: boolean | null
}

interface SelectedCardReadRow {
  dueAt: number | null
  stability: number | null
  difficulty: number | null
  elapsedDays: number | null
  scheduledDays: number | null
  learningSteps: number | null
  reps: number | null
  lapses: number | null
  state: string | null
  lastReviewAt: number | null
}

export interface ProblemLibraryReadOptions {
  now?: Date | undefined
  targetRetention?: number | undefined
}

export interface ProblemTaxonomyLabel {
  id: string
  label: string
}

export interface ProblemTrackMembership {
  trackId: string
  trackSlug: string
  trackTitle: string
  groupId: string
  groupTitle: string
  groupPosition: number
  problemPosition: number
}

export interface ProblemLibraryOptions {
  topics: ProblemTaxonomyLabel[]
  companies: ProblemTaxonomyLabel[]
  trackGroups: Omit<ProblemTrackMembership, 'problemPosition'>[]
}

export interface ProblemLibraryRow {
  problem: Problem
  status: ProblemLibraryStatus
  summary: PracticeSummary
  nextReviewAt: Date | null
  lastReviewedAt: Date | null
  lastSolvedAt: Date | null
  topics: ProblemTaxonomyLabel[]
  companies: ProblemTaxonomyLabel[]
  trackMemberships: ProblemTrackMembership[]
}

export interface ProblemLibrary {
  generatedAt: Date
  summary: {
    totalCount: number
    filteredCount: number
    dueCount: number
    suspendedCount: number
  }
  options: ProblemLibraryOptions
  rows: ProblemLibraryRow[]
}

export interface ProblemForEdit {
  problem: Problem
  topics: ProblemTaxonomyLabel[]
  companies: ProblemTaxonomyLabel[]
  trackMemberships: ProblemTrackMembership[]
  options: ProblemLibraryOptions
}

export interface CreateProblemInput {
  slugOrUrl: string
  title: string
  difficulty: string
  isPremium: boolean
  topicLabels: string[]
  companyLabels: string[]
}

export interface UpdateProblemInput extends Omit<CreateProblemInput, 'slugOrUrl'> {
  problemSlug: string
}

export interface BulkUpdateProblemsInput {
  problemSlugs: string[]
  set: {
    difficulty?: string | undefined
    isPremium?: boolean | undefined
    topicLabels?: string[] | undefined
    companyLabels?: string[] | undefined
  }
}

export interface ProblemDeleteResult {
  deletedProblemSlugs: string[]
  protectedProblemSlugs: string[]
  missingProblemSlugs: string[]
}

export interface ProblemBulkUpdate {
  updatedProblemSlugs: string[]
  missingProblemSlugs: string[]
}
