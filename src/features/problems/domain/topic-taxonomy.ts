export interface TopicSummary {
  id: string
  label: string
}

export interface TopicAliasLookup {
  aliasKey: string
  label: string
  topicId: string
}

export function normalizeTopicSearchKey(value: string) {
  return value
    .normalize('NFC')
    .trim()
    .replace(/\s+/gu, ' ')
    .replace(/[\u2010-\u2015\u2212]/gu, '-')
    .toLowerCase()
    .normalize('NFC')
}

export function normalizeTopicLookupKey(value: string) {
  const key = normalizeTopicSearchKey(value)

  if (!/[\p{L}\p{N}]/u.test(key)) {
    throw new Error('Topic names must contain a Unicode letter or number.')
  }

  return key
}

export function normalizeTopicLabelList(labels: readonly string[]) {
  const seen = new Set<string>()
  const normalizedLabels: string[] = []

  for (const label of labels) {
    const normalizedLabel = label.normalize('NFC').trim().replace(/\s+/gu, ' ')

    if (!normalizedLabel) {
      continue
    }

    const key = normalizeTopicLookupKey(normalizedLabel)

    if (seen.has(key)) continue

    seen.add(key)
    normalizedLabels.push(normalizedLabel)
  }

  return normalizedLabels
}

export function createTopicId(
  occupied: ReadonlySet<string>,
  nextId: () => string = () => crypto.randomUUID(),
) {
  const occupiedKeys = new Set(
    [...occupied].map((value) => normalizeTopicLookupKey(value)),
  )

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const id = `topic-${nextId()}`
    const key = normalizeTopicLookupKey(id)

    if (!occupiedKeys.has(key)) return id
  }

  throw new Error('Unable to allocate a unique topic ID after 8 attempts.')
}

export function buildTopicLookup(
  topics: readonly TopicSummary[],
  aliases: readonly TopicAliasLookup[],
) {
  const lookup = new Map<string, TopicSummary>()
  const topicIds = new Set<string>()

  const register = (key: string, topic: TopicSummary) => {
    const existing = lookup.get(key)

    if (existing && existing.id !== topic.id) {
      throw new Error(`Topic key collision for "${key}".`)
    }

    lookup.set(key, topic)
  }

  for (const topic of topics) {
    const idKey = normalizeTopicLookupKey(topic.id)

    if (topicIds.has(idKey)) {
      throw new Error(`Duplicate topic ID "${topic.id}".`)
    }
    topicIds.add(idKey)

    const summary = { id: topic.id, label: topic.label.normalize('NFC') }
    register(idKey, summary)
    register(normalizeTopicLookupKey(summary.label), summary)
  }

  const aliasKeys = new Set<string>()

  for (const alias of aliases) {
    const aliasKey = normalizeTopicLookupKey(alias.aliasKey)
    const labelKey = normalizeTopicLookupKey(alias.label)

    if (alias.aliasKey !== labelKey) {
      throw new Error(
        `Alias key "${alias.aliasKey}" must match its normalized label.`,
      )
    }
    if (aliasKeys.has(aliasKey)) {
      throw new Error(`Duplicate topic alias key "${aliasKey}".`)
    }
    aliasKeys.add(aliasKey)

    const topic = topics.find((candidate) => candidate.id === alias.topicId)

    if (!topic) {
      throw new Error(
        `Topic alias "${aliasKey}" targets unknown topic "${alias.topicId}".`,
      )
    }

    register(aliasKey, { id: topic.id, label: topic.label.normalize('NFC') })
  }

  return lookup
}
