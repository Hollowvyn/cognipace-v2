import { eq } from 'drizzle-orm'

import {
  buildTopicLookup,
  createTopicId,
  normalizeTopicLabelList,
  normalizeTopicLookupKey,
  type TopicSummary,
} from '@/features/problems/domain/topic-taxonomy'
import type { Db } from '@/platform/db'
import { problemTopics, topicAliases, topics } from '@/platform/db/schema'

export async function resolveTopicLabels(
  db: TopicResolverDb,
  labels: readonly string[],
  now = new Date(),
): Promise<TopicSummary[]> {
  const normalized = normalizeTopicLabelList(labels)

  if (normalized.length === 0) return []

  const topicRows = await db.select().from(topics)
  const aliasRows = await db.select().from(topicAliases)
  const lookup = buildTopicLookup(topicRows, aliasRows)
  const seen = new Set<string>()
  const result: TopicSummary[] = []

  for (const label of normalized) {
    const key = normalizeTopicLookupKey(label)
    let topic = lookup.get(key)

    if (!topic) {
      const id = createTopicId(new Set(lookup.keys()))
      topic = { id, label }

      await db.insert(topics).values({
        ...topic,
        createdAt: now.getTime(),
        updatedAt: now.getTime(),
      })

      lookup.set(key, topic)
      lookup.set(normalizeTopicLookupKey(id), topic)
    }

    if (!seen.has(topic.id)) {
      seen.add(topic.id)
      result.push(topic)
    }
  }

  return result
}

export async function replaceProblemTopicLabels(
  db: TopicResolverDb,
  problemSlug: string,
  labels: readonly string[],
  now = new Date(),
) {
  const resolvedTopics = await resolveTopicLabels(db, labels, now)

  await db
    .delete(problemTopics)
    .where(eq(problemTopics.problemSlug, problemSlug))

  await insertProblemTopics(db, problemSlug, resolvedTopics)
}

export async function mergeProblemTopicLabels(
  db: TopicResolverDb,
  problemSlug: string,
  labels: readonly string[],
  now = new Date(),
) {
  const resolvedTopics = await resolveTopicLabels(db, labels, now)

  await insertProblemTopics(db, problemSlug, resolvedTopics)
}

async function insertProblemTopics(
  db: TopicResolverDb,
  problemSlug: string,
  resolvedTopics: readonly TopicSummary[],
) {
  if (resolvedTopics.length === 0) return

  await db
    .insert(problemTopics)
    .values(
      resolvedTopics.map((topic) => ({
        problemSlug,
        topicId: topic.id,
      })),
    )
    .onConflictDoNothing()
}

export type TopicResolverDb = Pick<Db, 'delete' | 'insert' | 'select'>
