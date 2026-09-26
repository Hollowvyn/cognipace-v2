import { afterEach, describe, expect, it } from 'vitest'

import { createTestDb } from '@/platform/db/test-db'
import {
  problemTopics,
  topicAliases,
  topicRelations,
  topics,
} from '@/platform/db/schema'
import {
  seedTopicAliases,
  seedTopicRelations,
  seedTopics,
} from '@/platform/db/topic-taxonomy-seed'
import { reconcileTopicTaxonomy } from './topic-reconciliation'

const handles: Awaited<ReturnType<typeof createTestDb>>[] = []

afterEach(() => {
  while (handles.length > 0) handles.pop()?.rawDb.close()
})

async function readTaxonomy(
  db: Awaited<ReturnType<typeof createTestDb>>['db'],
) {
  return {
    topics: await db.select().from(topics).orderBy(topics.id),
    aliases: await db
      .select()
      .from(topicAliases)
      .orderBy(topicAliases.aliasKey),
    relations: await db
      .select()
      .from(topicRelations)
      .orderBy(
        topicRelations.kind,
        topicRelations.sourceTopicId,
        topicRelations.targetTopicId,
      ),
    joins: await db
      .select()
      .from(problemTopics)
      .orderBy(problemTopics.problemSlug, problemTopics.topicId),
  }
}

describe('topic taxonomy repository reconciliation', () => {
  it('preserves custom rows and is idempotent across repeated transactions', async () => {
    const handle = await createTestDb({ seed: false })
    handles.push(handle)
    await handle.db.insert(topics).values([
      { id: 'tree', label: 'Tree', createdAt: 1, updatedAt: 2 },
      { id: 'binary-tree', label: 'Binary Tree', createdAt: 3, updatedAt: 4 },
      { id: 'custom-topic', label: 'Custom Topic', createdAt: 5, updatedAt: 6 },
    ])
    await handle.db.insert(topicAliases).values({
      aliasKey: 'custom-name',
      label: 'Custom Name',
      topicId: 'tree',
      createdAt: 1,
      updatedAt: 2,
    })
    await handle.db.insert(topicRelations).values({
      sourceTopicId: 'custom-topic',
      targetTopicId: 'tree',
      kind: 'applies-to',
      createdAt: 7,
      updatedAt: 8,
    })

    const catalogue = {
      topics: seedTopics,
      aliases: seedTopicAliases,
      relations: seedTopicRelations,
    }
    await reconcileTopicTaxonomy(handle.db, {
      legacy: true,
      now: new Date('2026-09-26T12:00:00.000Z'),
      catalogue,
    })
    const first = await readTaxonomy(handle.db)

    await reconcileTopicTaxonomy(handle.db, {
      legacy: true,
      now: new Date('2026-09-27T12:00:00.000Z'),
      catalogue,
    })

    expect(await readTaxonomy(handle.db)).toEqual(first)
    expect(first.topics).toContainEqual({
      id: 'custom-topic',
      label: 'Custom Topic',
      createdAt: 5,
      updatedAt: 6,
    })
    expect(first.topics).toContainEqual({
      id: 'tree',
      label: 'Tree',
      createdAt: 1,
      updatedAt: 2,
    })
    expect(first.topics).toContainEqual({
      id: 'binary-tree',
      label: 'Binary Tree',
      createdAt: 3,
      updatedAt: 4,
    })
    expect(first.aliases).toContainEqual({
      aliasKey: 'custom name',
      label: 'Custom Name',
      topicId: 'tree',
      createdAt: 1,
      updatedAt: 2,
    })
    expect(first.relations).toContainEqual({
      sourceTopicId: 'custom-topic',
      targetTopicId: 'tree',
      kind: 'applies-to',
      createdAt: 7,
      updatedAt: 8,
    })
  })

  it('leaves every taxonomy table untouched when alias reconciliation collides', async () => {
    const handle = await createTestDb({ seed: false })
    handles.push(handle)
    await handle.db.insert(topics).values([
      { id: 'tree', label: 'Tree', createdAt: 1, updatedAt: 2 },
      { id: 'binary-tree', label: 'Binary Tree', createdAt: 3, updatedAt: 4 },
    ])
    await handle.db.insert(topicAliases).values({
      aliasKey: 'heap',
      label: 'Heap',
      topicId: 'tree',
      createdAt: 5,
      updatedAt: 6,
    })
    const before = await readTaxonomy(handle.db)

    await expect(
      reconcileTopicTaxonomy(handle.db, {
        legacy: false,
        now: new Date('2026-09-26T12:00:00.000Z'),
        catalogue: {
          topics: seedTopics,
          aliases: seedTopicAliases,
          relations: seedTopicRelations,
        },
      }),
    ).rejects.toThrow(/conflicting alias.*heap/i)

    expect(await readTaxonomy(handle.db)).toEqual(before)
  })

  it('rolls back all taxonomy changes when SQLite rejects a later insert', async () => {
    const handle = await createTestDb({ seed: false })
    handles.push(handle)
    await handle.db.insert(topics).values([
      { id: 'tree', label: 'Tree', createdAt: 1, updatedAt: 2 },
      { id: 'binary-tree', label: 'Binary Tree', createdAt: 3, updatedAt: 4 },
      { id: 'custom-topic', label: 'Custom Topic', createdAt: 5, updatedAt: 6 },
    ])
    await handle.db.insert(topicAliases).values({
      aliasKey: 'custom-name',
      label: 'Custom Name',
      topicId: 'tree',
      createdAt: 7,
      updatedAt: 8,
    })
    await handle.db.insert(topicRelations).values({
      sourceTopicId: 'custom-topic',
      targetTopicId: 'tree',
      kind: 'applies-to',
      createdAt: 9,
      updatedAt: 10,
    })
    const before = await readTaxonomy(handle.db)
    handle.rawDb.exec(`
      CREATE TRIGGER reject_topic_alias_reinsert
      BEFORE INSERT ON topic_aliases
      BEGIN
        SELECT RAISE(ABORT, 'forced taxonomy write failure');
      END;
    `)

    await expect(
      reconcileTopicTaxonomy(handle.db, {
        legacy: true,
        now: new Date('2026-09-26T12:00:00.000Z'),
        catalogue: {
          topics: seedTopics,
          aliases: seedTopicAliases,
          relations: seedTopicRelations,
        },
      }),
    ).rejects.toThrow(/Failed query: insert into "topic_aliases"/)

    expect(await readTaxonomy(handle.db)).toEqual(before)
  })
})
