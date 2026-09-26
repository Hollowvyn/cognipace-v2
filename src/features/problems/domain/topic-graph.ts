export type TopicRelationKind = 'broader' | 'applies-to'

export interface TopicRelation {
  sourceTopicId: string
  targetTopicId: string
  kind: TopicRelationKind
}

interface TopicGraph {
  ancestorsOf(topicId: string): readonly string[]
  effectiveTopicIds(directIds: readonly string[]): string[]
}

const relationKinds = new Set<TopicRelationKind>(['broader', 'applies-to'])

export function buildTopicGraph(
  topics: readonly { id: string }[],
  relations: readonly TopicRelation[],
): TopicGraph {
  const topicIds = new Set<string>()

  for (const topic of topics) {
    if (topicIds.has(topic.id)) {
      throw new Error(`Duplicate topic ID "${topic.id}".`)
    }
    topicIds.add(topic.id)
  }

  const broader = new Map<string, Set<string>>(
    topics.map(({ id }) => [id, new Set<string>()]),
  )
  const edges = new Set<string>()

  for (const relation of relations) {
    if (!relationKinds.has(relation.kind)) {
      throw new Error(`Unknown topic relation kind "${relation.kind}".`)
    }
    if (!topicIds.has(relation.sourceTopicId)) {
      throw new Error(`Unknown source topic "${relation.sourceTopicId}".`)
    }
    if (!topicIds.has(relation.targetTopicId)) {
      throw new Error(`Unknown target topic "${relation.targetTopicId}".`)
    }
    if (relation.sourceTopicId === relation.targetTopicId) {
      throw new Error(
        `Topic relation cannot be a self-link for "${relation.sourceTopicId}".`,
      )
    }

    const edgeKey = JSON.stringify([
      relation.sourceTopicId,
      relation.targetTopicId,
      relation.kind,
    ])
    if (edges.has(edgeKey)) {
      throw new Error(`Duplicate ${relation.kind} topic relation.`)
    }
    edges.add(edgeKey)

    if (relation.kind === 'broader') {
      broader.get(relation.sourceTopicId)!.add(relation.targetTopicId)
    }
  }

  const incomingBroaderEdges = new Map<string, number>(
    topics.map(({ id }) => [id, 0]),
  )
  for (const targets of broader.values()) {
    for (const targetId of targets) {
      incomingBroaderEdges.set(
        targetId,
        incomingBroaderEdges.get(targetId)! + 1,
      )
    }
  }

  const ready = topics
    .map(({ id }) => id)
    .filter((id) => incomingBroaderEdges.get(id) === 0)
  const topologicalOrder: string[] = []

  for (let index = 0; index < ready.length; index += 1) {
    const topicId = ready[index]!
    topologicalOrder.push(topicId)

    for (const parentId of broader.get(topicId)!) {
      const remaining = incomingBroaderEdges.get(parentId)! - 1
      incomingBroaderEdges.set(parentId, remaining)
      if (remaining === 0) ready.push(parentId)
    }
  }

  if (topologicalOrder.length !== topics.length) {
    throw new Error('Topic broader relations contain a cycle.')
  }

  const ancestors = new Map<string, readonly string[]>()
  for (const topicId of topologicalOrder.reverse()) {
    const topicAncestors = new Set<string>()
    for (const parentId of broader.get(topicId)!) {
      topicAncestors.add(parentId)
      for (const ancestorId of ancestors.get(parentId)!) {
        topicAncestors.add(ancestorId)
      }
    }
    ancestors.set(topicId, [...topicAncestors].sort())
  }

  return {
    ancestorsOf(topicId) {
      const topicAncestors = ancestors.get(topicId)
      if (!topicAncestors) {
        throw new Error(`Unknown topic ID "${topicId}".`)
      }
      return topicAncestors
    },
    effectiveTopicIds(directIds) {
      const effectiveIds = new Set<string>()
      for (const topicId of directIds) {
        effectiveIds.add(topicId)
        const topicAncestors = ancestors.get(topicId)
        if (!topicAncestors) {
          throw new Error(`Unknown topic ID "${topicId}".`)
        }
        for (const ancestorId of topicAncestors) {
          effectiveIds.add(ancestorId)
        }
      }
      return [...effectiveIds].sort()
    },
  }
}
