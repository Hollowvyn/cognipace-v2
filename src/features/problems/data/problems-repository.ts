import { and, asc, eq, inArray } from 'drizzle-orm'

import {
  derivePracticeSummary,
  normalizeReviewLogFields,
  parsePracticeStatus,
  type PracticeSummary,
  type PracticeStateSnapshot,
} from '@/features/practice/domain'
import {
  defaultFsrsCardKind,
  parseFsrsCardState,
  parseReviewRating,
  type FsrsCardSnapshot,
} from '@/lib/fsrs'
import {
  normalizeLeetCodeSlug,
  parseLeetCodeProblemInput,
} from '@/lib/leetcode'
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
  type FsrsCardRow,
  type InsertProblemRow,
  type ProblemPracticeRow,
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
      const timestamp = now.getTime()
      const problem = {
        slug: createLeetCodeProblemSlug(slug),
        title: input.title?.trim() || titleFromSlug(slug),
        difficulty: normalizeProblemDifficulty(input.difficulty),
        isPremium: input.isPremium ?? false,
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

  async getLibraryRowsBySlug(
    problemSlugs: readonly string[],
    options: ProblemLibraryReadOptions = {},
  ): Promise<ProblemLibraryRow[]> {
    const requestedSlugs = normalizeProblemSlugList(problemSlugs)

    if (requestedSlugs.length === 0) {
      return []
    }

    return this.readLibraryRows({
      now: options.now ?? new Date(),
      targetRetention: options.targetRetention,
      problemSlugs: requestedSlugs,
    })
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

      await setProblemTaxonomyLabels(transactionDb, slug, input)
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

      await setProblemTaxonomyLabels(transactionDb, slug, input)

      return true
    })

    return updated ? this.readRequiredProblemForEdit(slug) : null
  }

  async deleteProblems(problemSlugs: readonly string[]) {
    const requestedSlugs = normalizeProblemSlugList(problemSlugs)

    if (requestedSlugs.length > 0) {
      await this.db
        .delete(problems)
        .where(inArray(problems.slug, requestedSlugs))
    }
  }

  async bulkUpdateProblems(input: BulkUpdateProblemsInput, now = new Date()) {
    const requestedSlugs = normalizeProblemSlugList(input.problemSlugs)
    const existingRowSlugs = await this.readExistingProblemSlugs(requestedSlugs)
    const existingSlugs = requestedSlugs.filter((slug) =>
      existingRowSlugs.has(slug),
    )

    if (existingSlugs.length === 0) {
      return
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

      if (
        input.set.topicLabels !== undefined ||
        input.set.companyLabels !== undefined
      ) {
        for (const slug of existingSlugs) {
          await setProblemTaxonomyLabels(transactionDb, slug, input.set)
        }
      }
    })
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
        problem: problems,
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
    problemSlugs?: readonly string[] | undefined
  }) {
    const baseRows = await this.db
      .select({
        problem: problems,
        practice: problemPractice,
        card: fsrsCards,
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
      .where(
        options.problemSlugs
          ? inArray(problems.slug, [...options.problemSlugs])
          : undefined,
      )
      .orderBy(asc(problems.title), asc(problems.slug))
    const slugs = baseRows.map((row) => row.problem.slug)
    const [topicsBySlug, companiesBySlug, tracksBySlug, lastSolvedBySlug] =
      await Promise.all([
        readLabelsByProblem(this.db, 'topic', slugs),
        readLabelsByProblem(this.db, 'company', slugs),
        this.readTrackMembershipsByProblem(this.db, slugs),
        this.readLastSolvedByProblem(this.db, slugs),
      ])

    return baseRows.map((row) => {
      const problem = mapProblem(row.problem)
      const practice = row.practice
        ? mapProblemPracticeForLibrary(row.practice)
        : null
      const card = row.card ? mapFsrsCardForLibrary(row.card) : null
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
        readLabelsByProblem(db, 'topic', [problemSlug]),
        readLabelsByProblem(db, 'company', [problemSlug]),
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

  private async readExistingProblemSlugs(problemSlugs: readonly string[]) {
    if (problemSlugs.length === 0) {
      return new Set<string>()
    }

    const rows = await this.db
      .select({
        slug: problems.slug,
      })
      .from(problems)
      .where(inArray(problems.slug, [...problemSlugs]))

    return new Set(rows.map((row) => row.slug))
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
      .innerJoin(
        trackGroups,
        eq(trackGroups.id, trackGroupProblems.trackGroupId),
      )
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
    const [topicOptions, companyOptions] = await Promise.all([
      readLabelOptions(db, 'topic'),
      readLabelOptions(db, 'company'),
    ])

    return {
      topics: topicOptions,
      companies: companyOptions,
    } satisfies ProblemLibraryOptions
  }
}

function mapProblem(row: ProblemRow): Problem {
  return {
    slug: row.slug,
    title: row.title,
    difficulty: normalizeProblemDifficulty(row.difficulty),
    isPremium: row.isPremium,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
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

function mapProblemPracticeForLibrary(
  row: ProblemPracticeRow,
): PracticeStateSnapshot {
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

function mapFsrsCardForLibrary(row: FsrsCardRow): FsrsCardSnapshot {
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

async function readLabelsByProblem(
  db: ProblemReadDb,
  kind: TaxonomyKind,
  problemSlugs: readonly string[],
) {
  if (problemSlugs.length === 0) {
    return new Map<string, ProblemTaxonomyLabel[]>()
  }

  const source = taxonomySource(kind)
  return groupLabelsByProblem(
    await db
      .select({
        problemSlug: source.problemSlug,
        id: source.id,
        label: source.label,
      })
      .from(source.joinTable)
      .innerJoin(source.labelTable, eq(source.id, source.labelId))
      .where(inArray(source.problemSlug, [...problemSlugs]))
      .orderBy(asc(source.label)),
  )
}

async function readLabelOptions(db: ProblemReadDb, kind: TaxonomyKind) {
  const source = taxonomySource(kind)
  return db
    .select({
      id: source.id,
      label: source.label,
    })
    .from(source.labelTable)
    .orderBy(asc(source.label))
}

async function setProblemLabels(
  db: ProblemWriteDb,
  kind: TaxonomyKind,
  problemSlug: string,
  labels: readonly string[],
) {
  const storedLabels = await ensureLabels(db, kind, normalizeLabelList(labels))

  if (kind === 'topic') {
    await db
      .delete(problemTopics)
      .where(eq(problemTopics.problemSlug, problemSlug))

    if (storedLabels.length > 0) {
      await db
        .insert(problemTopics)
        .values(
          storedLabels.map((topic) => ({
            problemSlug,
            topicId: topic.id,
          })),
        )
        .onConflictDoNothing()
    }

    return
  }

  await db
    .delete(problemCompanies)
    .where(eq(problemCompanies.problemSlug, problemSlug))

  if (storedLabels.length > 0) {
    await db
      .insert(problemCompanies)
      .values(
        storedLabels.map((company) => ({
          problemSlug,
          companyId: company.id,
        })),
      )
      .onConflictDoNothing()
  }
}

async function setProblemTaxonomyLabels(
  db: ProblemWriteDb,
  problemSlug: string,
  labels: {
    topicLabels?: readonly string[] | undefined
    companyLabels?: readonly string[] | undefined
  },
) {
  if (labels.topicLabels !== undefined) {
    await setProblemLabels(db, 'topic', problemSlug, labels.topicLabels)
  }

  if (labels.companyLabels !== undefined) {
    await setProblemLabels(db, 'company', problemSlug, labels.companyLabels)
  }
}

async function ensureLabels(
  db: ProblemWriteDb,
  kind: TaxonomyKind,
  labels: readonly string[],
) {
  if (labels.length === 0) {
    return []
  }

  const source = taxonomySource(kind)

  await db
    .insert(source.labelTable)
    .values(labels.map((label) => ({ id: createTaxonomyId(label), label })))
    .onConflictDoNothing()

  return sortLabelsByInput(
    labels,
    await db
      .select({
        id: source.id,
        label: source.label,
      })
      .from(source.labelTable)
      .where(inArray(source.label, [...labels])),
  )
}

function taxonomySource(kind: TaxonomyKind) {
  return kind === 'topic'
    ? {
        labelTable: topics,
        joinTable: problemTopics,
        id: topics.id,
        label: topics.label,
        labelId: problemTopics.topicId,
        problemSlug: problemTopics.problemSlug,
      }
    : {
        labelTable: companies,
        joinTable: problemCompanies,
        id: companies.id,
        label: companies.label,
        labelId: problemCompanies.companyId,
        problemSlug: problemCompanies.problemSlug,
      }
}

function normalizeProblemSlugList(problemSlugs: readonly string[]) {
  return uniqueNormalizedStrings(problemSlugs, normalizeLeetCodeSlug)
}

function normalizeLabelList(labels: readonly string[]) {
  return uniqueNormalizedStrings(
    labels,
    (label) => label.trim().replace(/\s+/g, ' '),
    (label) => label.toLowerCase(),
  )
}

function uniqueNormalizedStrings(
  values: readonly string[],
  normalize: (value: string) => string,
  keyForValue: (value: string) => string = (value) => value,
) {
  const seen = new Set<string>()
  const normalizedValues: string[] = []

  for (const value of values) {
    const normalizedValue = normalize(value)
    const key = keyForValue(normalizedValue)

    if (!normalizedValue || seen.has(key)) {
      continue
    }

    seen.add(key)
    normalizedValues.push(normalizedValue)
  }

  return normalizedValues
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
type TaxonomyKind = 'topic' | 'company'

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

export interface UpdateProblemInput extends Omit<
  CreateProblemInput,
  'slugOrUrl'
> {
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
