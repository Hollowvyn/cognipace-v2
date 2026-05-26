import { describe, expect, it } from 'vitest'

import {
  clearLibrarySelectionTrackDraft,
  createLibrarySelectionTrackDraft,
  readLibrarySelectionTrackDraft,
} from './library-selection-track-draft'

describe('library selection track draft', () => {
  it('stores and reads selected problem slugs by draft id with deduped slugs', () => {
    const storage = new MemoryStorage()
    const problemSlugs = ['two-sum', 'two-sum', 'binary-search'] as const
    const draft = createLibrarySelectionTrackDraft(problemSlugs, {
      id: 'draft-1',
      now: new Date('2026-05-24T12:00:00.000Z'),
      storage,
    })

    expect(draft).toEqual({
      id: 'draft-1',
      source: 'library-selection',
      problemSlugs: ['two-sum', 'binary-search'],
      createdAt: '2026-05-24T12:00:00.000Z',
    })
    expect(
      readLibrarySelectionTrackDraft('draft-1', {
        now: new Date('2026-05-24T12:10:00.000Z'),
        storage,
      }),
    ).toEqual(draft)
  })

  it('returns null for missing drafts', () => {
    const storage = new MemoryStorage()

    expect(readLibrarySelectionTrackDraft(null, { storage })).toBeNull()
    expect(readLibrarySelectionTrackDraft('missing', { storage })).toBeNull()
  })

  it.each([
    {
      id: 'bad-json',
      name: 'bad JSON',
      storedValue: '{',
    },
    {
      id: 'wrong-shape',
      name: 'wrong shape',
      storedValue: JSON.stringify({
        id: 'wrong-shape',
        source: 'library-selection',
        problemSlugs: 'two-sum',
        createdAt: '2026-05-24T12:00:00.000Z',
      }),
    },
    {
      id: 'empty-slugs',
      name: 'empty slugs',
      storedValue: JSON.stringify({
        id: 'empty-slugs',
        source: 'library-selection',
        problemSlugs: [],
        createdAt: '2026-05-24T12:00:00.000Z',
      }),
    },
    {
      id: 'invalid-created-at',
      name: 'invalid createdAt',
      storedValue: JSON.stringify({
        id: 'invalid-created-at',
        source: 'library-selection',
        problemSlugs: ['two-sum'],
        createdAt: 'not-a-date',
      }),
    },
    {
      id: 'impossible-created-at',
      name: 'impossible createdAt',
      storedValue: JSON.stringify({
        id: 'impossible-created-at',
        source: 'library-selection',
        problemSlugs: ['two-sum'],
        createdAt: '2026-02-31T12:00:00.000Z',
      }),
    },
  ])('rejects invalid stored payloads: $name', ({ id, storedValue }) => {
    const storage = new MemoryStorage()
    const storageKey = `cognipace:track-draft:${id}`

    storage.setItem(storageKey, storedValue)

    expect(
      readLibrarySelectionTrackDraft(id, {
        now: new Date('2026-05-24T12:10:00.000Z'),
        storage,
      }),
    ).toBeNull()
    expect(storage.getItem(storageKey)).toBeNull()
  })

  it('returns null for expired drafts', () => {
    const storage = new MemoryStorage()
    const expired = createLibrarySelectionTrackDraft(['two-sum'], {
      id: 'expired',
      now: new Date('2026-05-24T12:00:00.000Z'),
      storage,
    })
    const storageKey = 'cognipace:track-draft:expired'

    expect(expired.id).toBe('expired')
    expect(
      readLibrarySelectionTrackDraft('expired', {
        now: new Date('2026-05-24T13:01:00.000Z'),
        storage,
      }),
    ).toBeNull()
    expect(storage.getItem(storageKey)).toBeNull()
  })

  it('clears drafts by id', () => {
    const storage = new MemoryStorage()
    const draft = createLibrarySelectionTrackDraft(['two-sum'], {
      id: 'draft-1',
      now: new Date('2026-05-24T12:00:00.000Z'),
      storage,
    })

    expect(() =>
      clearLibrarySelectionTrackDraft(null, { storage }),
    ).not.toThrow()
    expect(() =>
      clearLibrarySelectionTrackDraft(undefined, { storage }),
    ).not.toThrow()
    expect(
      readLibrarySelectionTrackDraft('draft-1', {
        now: new Date('2026-05-24T12:10:00.000Z'),
        storage,
      }),
    ).toEqual(draft)

    clearLibrarySelectionTrackDraft('draft-1', { storage })

    expect(readLibrarySelectionTrackDraft('draft-1', { storage })).toBeNull()
  })
})

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>()

  get length() {
    return this.values.size
  }

  clear() {
    this.values.clear()
  }

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key: string) {
    this.values.delete(key)
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}
