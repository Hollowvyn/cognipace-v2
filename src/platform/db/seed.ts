import type { Db } from './client'
import {
  problems,
  topics,
  trackGroupProblems,
  trackGroups,
  tracks,
  trackSession,
} from './schema'

const seedProblems = [
  {
    slug: 'two-sum',
    title: 'Two Sum',
    difficulty: 'easy',
    isPremium: false,
  },
  {
    slug: 'valid-parentheses',
    title: 'Valid Parentheses',
    difficulty: 'easy',
    isPremium: false,
  },
] as const

const seedTopics = [
  { id: 'array', label: 'Array' },
  { id: 'hash-table', label: 'Hash Table' },
  { id: 'stack', label: 'Stack' },
] as const

const seedTracks = [
  {
    id: 'leetcode-75',
    slug: 'leetcode-75',
    title: 'LeetCode 75',
    description: 'Focused starter track for high-signal interview patterns.',
    isActive: true,
  },
  {
    id: 'grind-75',
    slug: 'grind-75',
    title: 'Grind 75',
    description: 'Compact practice set for repeated algorithm review.',
    isActive: false,
  },
] as const

const seedTrackGroups = [
  {
    id: 'leetcode-75:arrays-hashing',
    trackId: 'leetcode-75',
    title: 'Arrays and Hashing',
    position: 1,
  },
  {
    id: 'grind-75:stack',
    trackId: 'grind-75',
    title: 'Stack',
    position: 1,
  },
] as const

const seedTrackGroupProblems = [
  {
    trackGroupId: 'leetcode-75:arrays-hashing',
    problemSlug: 'two-sum',
    position: 1,
  },
  {
    trackGroupId: 'grind-75:stack',
    problemSlug: 'valid-parentheses',
    position: 1,
  },
] as const

export async function seedInitialCatalog(db: Db, now = new Date()) {
  const timestamp = now.getTime()

  await db
    .insert(problems)
    .values(
      seedProblems.map((problem) => ({
        ...problem,
        createdAt: timestamp,
        updatedAt: timestamp,
      })),
    )
    .onConflictDoNothing()

  await db
    .insert(topics)
    .values([...seedTopics])
    .onConflictDoNothing()

  await db
    .insert(tracks)
    .values(
      seedTracks.map((track) => ({
        ...track,
        createdAt: timestamp,
        updatedAt: timestamp,
      })),
    )
    .onConflictDoNothing()

  await db
    .insert(trackGroups)
    .values(
      seedTrackGroups.map((group) => ({
        ...group,
        createdAt: timestamp,
        updatedAt: timestamp,
      })),
    )
    .onConflictDoNothing()

  await db
    .insert(trackGroupProblems)
    .values([...seedTrackGroupProblems])
    .onConflictDoNothing()

  await db
    .insert(trackSession)
    .values({
      id: 'active',
      activeTrackId: 'leetcode-75',
      activeGroupId: 'leetcode-75:arrays-hashing',
      startedAt: timestamp,
      updatedAt: timestamp,
    })
    .onConflictDoNothing()
}
