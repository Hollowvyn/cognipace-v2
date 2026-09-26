import { buildTopicGraph, type TopicRelation } from './topic-graph'
import { buildTopicLookup, normalizeTopicLookupKey } from './topic-taxonomy'
import { legacyTopicAliasRows } from './topic-legacy-manifest'

type Timestamp = number | string

export interface TopicRows<T extends Timestamp> {
  topics: Array<{ id: string; label: string; createdAt: T; updatedAt: T }>
  topicAliases: Array<{
    aliasKey: string
    label: string
    topicId: string
    createdAt: T
    updatedAt: T
  }>
  topicRelations: Array<TopicRelation & { createdAt: T; updatedAt: T }>
  problemTopics: Array<{ problemSlug: string; topicId: string }>
}

export interface TopicReconciliationCatalogue {
  topics: readonly { id: string; label: string }[]
  aliases: readonly { aliasKey: string; label: string; topicId: string }[]
  relations: readonly TopicRelation[]
}

export interface ReconcileTopicOptions<T extends Timestamp> {
  legacy: boolean
  now: T
  catalogue: TopicReconciliationCatalogue
}

const obsoleteBroaderKeys = new Set([
  ...['depth-first-search', 'breadth-first-search'].flatMap((sourceTopicId) =>
    ['tree', 'binary-tree', 'graph-theory'].map((targetTopicId) =>
      JSON.stringify(['broader', sourceTopicId, targetTopicId]),
    ),
  ),
  JSON.stringify(['broader', 'union-find', 'graph-theory']),
  JSON.stringify(['broader', 'rolling-hash', 'string']),
  JSON.stringify(['broader', 'memoization', 'dynamic-programming']),
  JSON.stringify(['broader', 'memoization', 'recursion']),
])

function edgeKey(edge: TopicRelation) {
  return JSON.stringify([edge.kind, edge.sourceTopicId, edge.targetTopicId])
}

function relationOrder(a: TopicRelation, b: TopicRelation) {
  return (
    a.kind.localeCompare(b.kind) ||
    a.sourceTopicId.localeCompare(b.sourceTopicId) ||
    a.targetTopicId.localeCompare(b.targetTopicId)
  )
}

function compareTimestamp(a: Timestamp, b: Timestamp) {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a !== typeof b) return typeof a === 'number' ? -1 : 1
  return String(a).localeCompare(String(b))
}

function compareAliasRows<T extends Timestamp>(
  a: TopicRows<T>['topicAliases'][number],
  b: TopicRows<T>['topicAliases'][number],
) {
  return (
    a.aliasKey.localeCompare(b.aliasKey) || a.topicId.localeCompare(b.topicId)
  )
}

function deduplicateAliases<T extends Timestamp>(
  aliases: TopicRows<T>['topicAliases'],
  legacy: boolean,
) {
  const result = new Map<string, TopicRows<T>['topicAliases'][number]>()
  for (const alias of aliases) {
    const key = normalizeTopicLookupKey(alias.label)
    if (!legacy && alias.aliasKey !== key) {
      throw new Error(`Invalid topic alias key: ${alias.aliasKey}`)
    }
    const previous = result.get(key)
    if (previous && previous.topicId !== alias.topicId) {
      throw new Error(
        `Conflicting alias "${alias.label}": ${previous.topicId} / ${alias.topicId}`,
      )
    }
    if (!previous) result.set(key, { ...alias, aliasKey: key })
  }
  return [...result.values()].sort(
    (a, b) =>
      a.aliasKey.localeCompare(b.aliasKey) ||
      a.topicId.localeCompare(b.topicId),
  )
}

function assertUniqueInputRows<T extends Timestamp>(rows: TopicRows<T>) {
  const topicIds = new Set<string>()
  for (const topic of rows.topics) {
    if (topicIds.has(topic.id)) {
      throw new Error(`Duplicate topic ID: ${topic.id}`)
    }
    topicIds.add(topic.id)
  }

  const joinKeys = new Set<string>()
  for (const join of rows.problemTopics) {
    const key = JSON.stringify([join.problemSlug, join.topicId])
    if (joinKeys.has(key)) throw new Error('Duplicate problem-topic join.')
    joinKeys.add(key)
  }

  const relationKeys = new Set<string>()
  for (const relation of rows.topicRelations) {
    if (relation.sourceTopicId === relation.targetTopicId) {
      throw new Error(
        `Topic relation cannot be a self-link for "${relation.sourceTopicId}".`,
      )
    }
    const key = edgeKey(relation)
    if (relationKeys.has(key))
      throw new Error('Duplicate typed topic relation.')
    relationKeys.add(key)
  }

  for (const join of rows.problemTopics) {
    if (!topicIds.has(join.topicId)) {
      throw new Error(
        `Problem-topic join targets unknown topic: ${join.topicId}`,
      )
    }
  }
  for (const alias of rows.topicAliases) {
    if (!topicIds.has(alias.topicId)) {
      throw new Error(`Topic alias targets unknown topic: ${alias.topicId}`)
    }
  }
  for (const relation of rows.topicRelations) {
    if (!topicIds.has(relation.sourceTopicId)) {
      throw new Error(`Unknown source topic: ${relation.sourceTopicId}`)
    }
    if (!topicIds.has(relation.targetTopicId)) {
      throw new Error(`Unknown target topic: ${relation.targetTopicId}`)
    }
  }
}

function removeObsoleteBroaderEdges<Edge extends TopicRelation>(
  edges: readonly Edge[],
) {
  return edges.filter((edge) => {
    const key = edgeKey(edge)
    return !(edge.kind === 'broader' && obsoleteBroaderKeys.has(key))
  })
}

function legacyDefaultTarget(
  alias: (typeof legacyTopicAliasRows)[number],
  catalogue: TopicReconciliationCatalogue,
) {
  return catalogue.topics.find((topic) => topic.label === alias.topicLabel)?.id
}

function buildEquivalenceMap(
  rows: TopicRows<Timestamp>,
  catalogue: TopicReconciliationCatalogue,
) {
  const canonicalIds = new Set(catalogue.topics.map(({ id }) => id))
  const safeAliasTargets = new Map<string, string>()
  for (const alias of catalogue.aliases) {
    const key = normalizeTopicLookupKey(alias.label)
    const previous = safeAliasTargets.get(key)
    if (previous && previous !== alias.topicId) {
      throw new Error(`Conflicting curated alias "${alias.label}".`)
    }
    safeAliasTargets.set(key, alias.topicId)
  }

  const equivalence = new Map<string, string>()
  for (const topic of rows.topics) {
    const targetId = safeAliasTargets.get(normalizeTopicLookupKey(topic.label))
    if (!targetId || topic.id === targetId) continue
    if (canonicalIds.has(topic.id)) {
      throw new Error(
        `Canonical topic ID "${topic.id}" collides with alias target "${targetId}".`,
      )
    }
    equivalence.set(topic.id, targetId)
  }
  return { safeAliasTargets, equivalence }
}

function resolveId(id: string, equivalence: ReadonlyMap<string, string>) {
  return equivalence.get(id) ?? id
}

function reconcileAliases<T extends Timestamp>(
  rows: TopicRows<T>,
  options: ReconcileTopicOptions<T>,
  safeAliasTargets: ReadonlyMap<string, string>,
  equivalence: ReadonlyMap<string, string>,
) {
  const legacyDefaults = new Map<string, string>()
  if (options.legacy) {
    for (const legacyAlias of legacyTopicAliasRows) {
      const oldTargetId = legacyDefaultTarget(legacyAlias, options.catalogue)
      if (!oldTargetId) continue
      legacyDefaults.set(
        JSON.stringify([legacyAlias.label, oldTargetId]),
        legacyAlias.label,
      )
    }
  }

  const existing = [] as TopicRows<T>['topicAliases']
  for (const alias of rows.topicAliases) {
    const key = normalizeTopicLookupKey(alias.label)
    const newTargetId = safeAliasTargets.get(key)
    const exactLegacyDefault = legacyDefaults.has(
      JSON.stringify([alias.label, alias.topicId]),
    )
    if (options.legacy && exactLegacyDefault) {
      if (!newTargetId || newTargetId !== alias.topicId) continue
    } else if (
      newTargetId &&
      resolveId(alias.topicId, equivalence) !== newTargetId
    ) {
      throw new Error(
        `Conflicting alias "${alias.label}": ${alias.topicId} / ${newTargetId}`,
      )
    }
    existing.push({ ...alias, topicId: resolveId(alias.topicId, equivalence) })
  }

  const equivalentLabels: TopicRows<T>['topicAliases'] = []
  for (const topic of rows.topics) {
    const targetId = equivalence.get(topic.id)
    if (!targetId) continue
    equivalentLabels.push({
      aliasKey: normalizeTopicLookupKey(topic.label),
      label: topic.label,
      topicId: resolveId(targetId, equivalence),
      createdAt: topic.createdAt,
      updatedAt: topic.updatedAt,
    })
  }

  const candidates = [...existing, ...equivalentLabels].sort(compareAliasRows)
  const aliases = deduplicateAliases(candidates, options.legacy)
  const byKey = new Map(aliases.map((alias) => [alias.aliasKey, alias]))

  for (const alias of options.catalogue.aliases) {
    const key = normalizeTopicLookupKey(alias.label)
    const targetId = resolveId(alias.topicId, equivalence)
    const previous = byKey.get(key)
    if (previous) {
      if (previous.topicId !== targetId) {
        throw new Error(
          `Conflicting alias "${alias.label}": ${previous.topicId} / ${targetId}`,
        )
      }
      continue
    }
    const inserted = {
      ...alias,
      topicId: targetId,
      createdAt: options.now,
      updatedAt: options.now,
    }
    aliases.push(inserted)
    byKey.set(key, inserted)
  }

  return aliases.sort(
    (a, b) =>
      a.aliasKey.localeCompare(b.aliasKey) ||
      a.topicId.localeCompare(b.topicId),
  )
}

export function reconcileTopicRows<T extends Timestamp>(
  input: TopicRows<T>,
  options: ReconcileTopicOptions<T>,
): TopicRows<T> {
  const rows: TopicRows<T> = {
    topics: input.topics.map((row) => ({ ...row })),
    topicAliases: input.topicAliases.map((row) => ({ ...row })),
    topicRelations: input.topicRelations.map((row) => ({ ...row })),
    problemTopics: input.problemTopics.map((row) => ({ ...row })),
  }

  assertUniqueInputRows(rows)
  buildTopicLookup(options.catalogue.topics, options.catalogue.aliases)
  buildTopicGraph(options.catalogue.topics, options.catalogue.relations)

  const { safeAliasTargets, equivalence } = buildEquivalenceMap(
    rows,
    options.catalogue,
  )

  const topics = rows.topics
    .filter(({ id }) => !equivalence.has(id))
    .map((topic) => ({ ...topic }))
  const currentIds = new Set(topics.map(({ id }) => id))
  for (const canonical of options.catalogue.topics) {
    const existing = topics.find(({ id }) => id === canonical.id)
    if (existing) continue
    if (currentIds.has(canonical.id)) {
      throw new Error(`Canonical topic ID collision: ${canonical.id}`)
    }
    topics.push({
      id: canonical.id,
      label: canonical.label,
      createdAt: options.now,
      updatedAt: options.now,
    })
    currentIds.add(canonical.id)
  }
  const topicsById = new Map(topics.map((topic) => [topic.id, topic]))
  const remap = (id: string) => resolveId(id, equivalence)

  const aliases = reconcileAliases(rows, options, safeAliasTargets, equivalence)

  const joinsByKey = new Map<string, TopicRows<T>['problemTopics'][number]>()
  for (const join of rows.problemTopics) {
    const remapped = { ...join, topicId: remap(join.topicId) }
    joinsByKey.set(
      JSON.stringify([remapped.problemSlug, remapped.topicId]),
      remapped,
    )
  }
  const problemTopics = [...joinsByKey.values()].sort(
    (a, b) =>
      a.problemSlug.localeCompare(b.problemSlug) ||
      a.topicId.localeCompare(b.topicId),
  )

  let relations = rows.topicRelations.map((edge) => ({
    ...edge,
    wasConverted: false,
  }))
  if (options.legacy) {
    const appliesTo = new Set(
      options.catalogue.relations
        .filter(({ kind }) => kind === 'applies-to')
        .map((edge) => edgeKey(edge)),
    )
    const retained = removeObsoleteBroaderEdges(relations)
    const converted = relations.flatMap((edge) => {
      const key = edgeKey(edge)
      if (!obsoleteBroaderKeys.has(key)) return []
      const appliesToEdge = { ...edge, kind: 'applies-to' as const }
      return appliesTo.has(edgeKey(appliesToEdge))
        ? [{ ...appliesToEdge, wasConverted: true }]
        : []
    })
    relations = [...retained, ...converted]
  }

  const relationCandidates: Array<
    TopicRelation & {
      createdAt: T
      updatedAt: T
      isCanonicalIdentity: boolean
      originalIdentity: string
    }
  > = []
  for (const edge of relations) {
    const sourceTopicId = remap(edge.sourceTopicId)
    const targetTopicId = remap(edge.targetTopicId)
    if (sourceTopicId === targetTopicId) continue
    relationCandidates.push({
      ...edge,
      sourceTopicId,
      targetTopicId,
      isCanonicalIdentity:
        !edge.wasConverted &&
        edge.sourceTopicId === sourceTopicId &&
        edge.targetTopicId === targetTopicId,
      originalIdentity: edgeKey({
        kind: edge.wasConverted ? 'broader' : edge.kind,
        sourceTopicId: edge.sourceTopicId,
        targetTopicId: edge.targetTopicId,
      }),
    })
  }

  const relationsByKey = new Map<
    string,
    TopicRows<T>['topicRelations'][number]
  >()
  for (const edge of relationCandidates.sort((a, b) => {
    if (a.isCanonicalIdentity !== b.isCanonicalIdentity) {
      return a.isCanonicalIdentity ? -1 : 1
    }
    return (
      relationOrder(a, b) ||
      a.originalIdentity.localeCompare(b.originalIdentity) ||
      compareTimestamp(a.createdAt, b.createdAt) ||
      compareTimestamp(a.updatedAt, b.updatedAt)
    )
  })) {
    const key = edgeKey(edge)
    if (!relationsByKey.has(key)) {
      relationsByKey.set(key, {
        kind: edge.kind,
        sourceTopicId: edge.sourceTopicId,
        targetTopicId: edge.targetTopicId,
        createdAt: edge.createdAt,
        updatedAt: edge.updatedAt,
      })
    }
  }

  for (const curated of options.catalogue.relations) {
    const sourceTopicId = remap(curated.sourceTopicId)
    const targetTopicId = remap(curated.targetTopicId)
    if (!topicsById.has(sourceTopicId) || !topicsById.has(targetTopicId)) {
      throw new Error(
        `Curated relation has unknown endpoint: ${sourceTopicId} / ${targetTopicId}`,
      )
    }
    const relation = { ...curated, sourceTopicId, targetTopicId }
    const key = edgeKey(relation)
    if (!relationsByKey.has(key)) {
      relationsByKey.set(key, {
        ...relation,
        createdAt: options.now,
        updatedAt: options.now,
      })
    }
  }
  const topicRelations = [...relationsByKey.values()].sort(relationOrder)

  if (problemTopics.some(({ topicId }) => !topicsById.has(topicId))) {
    throw new Error('Problem-topic join references an unknown topic.')
  }
  for (const alias of aliases) {
    if (!topicsById.has(alias.topicId)) {
      throw new Error(`Topic alias targets unknown topic: ${alias.topicId}`)
    }
  }
  buildTopicLookup(topics, aliases)
  buildTopicGraph(topics, topicRelations)

  return {
    topics: topics.sort((a, b) => a.id.localeCompare(b.id)),
    topicAliases: aliases,
    topicRelations,
    problemTopics,
  }
}
