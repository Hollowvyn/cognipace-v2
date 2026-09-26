import type { Db } from '@/platform/db'
import { topicAliases, topicRelations, topics } from '@/platform/db/schema'

import { buildTopicGraph } from '../domain/topic-graph'
import { buildTopicLookup } from '../domain/topic-taxonomy'

export interface ProblemTopicOption {
  id: string
  label: string
  aliases: string[]
}

export async function readTopicReadModel(db: Pick<Db, 'select'>) {
  const [topicRows, aliases, relations] = await Promise.all([
    db.select().from(topics),
    db.select().from(topicAliases),
    db.select().from(topicRelations),
  ])

  buildTopicLookup(topicRows, aliases)
  const graph = buildTopicGraph(topicRows, relations)
  const byId = new Map(
    topicRows.map((row) => [row.id, { id: row.id, label: row.label }]),
  )
  const aliasesById = new Map<string, string[]>()
  for (const alias of aliases) {
    const values = aliasesById.get(alias.topicId) ?? []
    values.push(alias.label)
    aliasesById.set(alias.topicId, values)
  }

  const options: ProblemTopicOption[] = [...byId.values()]
    .sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id))
    .map((topic) => ({
      ...topic,
      aliases: (aliasesById.get(topic.id) ?? []).sort(),
    }))

  return {
    options,
    effectiveTopicIds: (directIds: readonly string[]) =>
      graph.effectiveTopicIds(directIds),
    parentTopics: (id: string) =>
      graph
        .ancestorsOf(id)
        .map((parentId) => byId.get(parentId)!)
        .sort(
          (a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id),
        ),
  }
}

export type TopicReadModel = Awaited<ReturnType<typeof readTopicReadModel>>
