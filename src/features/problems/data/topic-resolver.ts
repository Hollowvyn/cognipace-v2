import { eq, inArray } from 'drizzle-orm'

import {
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
  const normalizedLabels = normalizeTopicLabelList(labels)

  if (normalizedLabels.length === 0) {
    return []
  }

  const inputKeys = normalizedLabels.map(normalizeTopicLookupKey)
  const resolvedByInputKey = new Map<string, TopicSummary>()

  await resolveTopicsById(db, inputKeys, resolvedByInputKey)
  await resolveTopicsByLabel(db, inputKeys, resolvedByInputKey)
  await resolveTopicsByAlias(db, inputKeys, resolvedByInputKey)
  await createMissingTopics(db, normalizedLabels, resolvedByInputKey, now)

  return collapseResolvedTopicsByInputOrder(
    normalizedLabels,
    resolvedByInputKey,
  )
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

async function resolveTopicsById(
  db: TopicResolverDb,
  inputKeys: readonly string[],
  resolvedByInputKey: Map<string, TopicSummary>,
) {
  const rows = await db
    .select({
      id: topics.id,
      label: topics.label,
    })
    .from(topics)
    .where(inArray(topics.id, [...inputKeys]))
  const topicsById = new Map(rows.map((topic) => [topic.id, topic]))

  for (const key of inputKeys) {
    const topic = topicsById.get(key)

    if (topic) {
      resolvedByInputKey.set(key, topic)
    }
  }
}

async function resolveTopicsByLabel(
  db: TopicResolverDb,
  inputKeys: readonly string[],
  resolvedByInputKey: Map<string, TopicSummary>,
) {
  const unresolvedKeys = inputKeys.filter((key) => !resolvedByInputKey.has(key))

  if (unresolvedKeys.length === 0) {
    return
  }

  const unresolvedKeySet = new Set(unresolvedKeys)
  const rows = await db
    .select({
      id: topics.id,
      label: topics.label,
    })
    .from(topics)
  const topicsByLookupKey = new Map<string, TopicSummary>()

  for (const topic of rows) {
    const key = normalizeTopicLookupKey(topic.label)

    if (unresolvedKeySet.has(key) && !topicsByLookupKey.has(key)) {
      topicsByLookupKey.set(key, topic)
    }
  }

  for (const key of unresolvedKeys) {
    const topic = topicsByLookupKey.get(key)

    if (topic) {
      resolvedByInputKey.set(key, topic)
    }
  }
}

async function resolveTopicsByAlias(
  db: TopicResolverDb,
  inputKeys: readonly string[],
  resolvedByInputKey: Map<string, TopicSummary>,
) {
  const unresolvedKeys = inputKeys.filter((key) => !resolvedByInputKey.has(key))

  if (unresolvedKeys.length === 0) {
    return
  }

  const rows = await db
    .select({
      aliasKey: topicAliases.aliasKey,
      id: topics.id,
      label: topics.label,
    })
    .from(topicAliases)
    .innerJoin(topics, eq(topicAliases.topicId, topics.id))
    .where(inArray(topicAliases.aliasKey, [...unresolvedKeys]))

  const topicsByAliasKey = new Map<string, TopicSummary>()

  for (const row of rows) {
    topicsByAliasKey.set(row.aliasKey, { id: row.id, label: row.label })
  }

  for (const key of unresolvedKeys) {
    const topic = topicsByAliasKey.get(key)

    if (topic) {
      resolvedByInputKey.set(key, topic)
    }
  }
}

async function createMissingTopics(
  db: TopicResolverDb,
  labels: readonly string[],
  resolvedByInputKey: Map<string, TopicSummary>,
  now: Date,
) {
  const missingLabels = labels.filter(
    (label) => !resolvedByInputKey.has(normalizeTopicLookupKey(label)),
  )

  if (missingLabels.length === 0) {
    return
  }

  const timestamp = now.getTime()

  await db
    .insert(topics)
    .values(
      missingLabels.map((label) => ({
        id: createTopicId(label),
        label,
        createdAt: timestamp,
        updatedAt: timestamp,
      })),
    )
    .onConflictDoNothing()

  const createdTopicIds = missingLabels.map(createTopicId)
  const rows = await db
    .select({
      id: topics.id,
      label: topics.label,
    })
    .from(topics)
    .where(inArray(topics.id, createdTopicIds))
  const topicsById = new Map(rows.map((topic) => [topic.id, topic]))

  for (const label of missingLabels) {
    const topicId = createTopicId(label)
    const topic = topicsById.get(topicId)

    if (!topic) {
      throw new Error(`Failed to resolve topic "${label}".`)
    }

    resolvedByInputKey.set(normalizeTopicLookupKey(label), topic)
  }
}

async function insertProblemTopics(
  db: TopicResolverDb,
  problemSlug: string,
  resolvedTopics: readonly TopicSummary[],
) {
  if (resolvedTopics.length === 0) {
    return
  }

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

function collapseResolvedTopicsByInputOrder(
  labels: readonly string[],
  resolvedByInputKey: ReadonlyMap<string, TopicSummary>,
) {
  const topicsInOrder: TopicSummary[] = []
  const seenTopicIds = new Set<string>()

  for (const label of labels) {
    const key = normalizeTopicLookupKey(label)
    const topic = resolvedByInputKey.get(key)

    if (!topic) {
      throw new Error(`Failed to resolve topic "${label}".`)
    }

    if (seenTopicIds.has(topic.id)) {
      continue
    }

    seenTopicIds.add(topic.id)
    topicsInOrder.push(topic)
  }

  return topicsInOrder
}

export type TopicResolverDb = Pick<Db, 'delete' | 'insert' | 'select'>
