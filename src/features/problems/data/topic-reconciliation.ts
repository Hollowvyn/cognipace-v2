import { inArray } from 'drizzle-orm'

import type { Db } from '@/platform/db'
import {
  problemTopics,
  topicAliases,
  topicRelations,
  topics,
} from '@/platform/db/schema'
import {
  reconcileTopicRows,
  type TopicReconciliationCatalogue,
} from '../domain/topic-reconciliation'

export async function reconcileTopicTaxonomy(
  db: Db,
  options: {
    legacy: boolean
    now: Date
    catalogue: TopicReconciliationCatalogue
  },
) {
  await db.transaction(async (tx) => {
    const before = {
      topics: await tx.select().from(topics),
      topicAliases: await tx.select().from(topicAliases),
      topicRelations: await tx.select().from(topicRelations),
      problemTopics: await tx.select().from(problemTopics),
    }
    const after = reconcileTopicRows(before, {
      legacy: options.legacy,
      now: options.now.getTime(),
      catalogue: options.catalogue,
    })

    const keepIds = new Set(after.topics.map((row) => row.id))
    const removedIds = before.topics
      .filter((row) => !keepIds.has(row.id))
      .map((row) => row.id)

    // Validate and compute the complete replacement before the first write.
    await tx.delete(problemTopics)
    await tx.delete(topicRelations)
    await tx.delete(topicAliases)
    if (removedIds.length > 0) {
      await tx.delete(topics).where(inArray(topics.id, removedIds))
    }
    if (after.topics.length > 0) {
      await tx.insert(topics).values(after.topics).onConflictDoNothing()
    }
    if (after.topicAliases.length > 0) {
      await tx.insert(topicAliases).values(after.topicAliases)
    }
    if (after.topicRelations.length > 0) {
      await tx
        .insert(topicRelations)
        .values(after.topicRelations as (typeof topicRelations.$inferInsert)[])
    }
    if (after.problemTopics.length > 0) {
      await tx.insert(problemTopics).values(after.problemTopics)
    }
  })
}
