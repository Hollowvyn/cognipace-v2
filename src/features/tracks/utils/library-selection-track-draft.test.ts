import { describe, expect, it } from 'vitest'

import {
  clearLibrarySelectionTrackDraft,
  createLibrarySelectionTrackDraft,
  readLibrarySelectionTrackDraft,
} from './library-selection-track-draft'

describe('library selection track draft', () => {
  it('stores and reads selected problem slugs by draft id', () => {
    const storage = new MemoryStorage()
    const draft = createLibrarySelectionTrackDraft(['two-sum', 'two-sum', 'binary-search'], {
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

  it('rejects missing, malformed, empty, and expired drafts', () => {
    const storage = new MemoryStorage()

    expect(readLibrarySelectionTrackDraft(null, { storage })).toBeNull()
    expect(readLibrarySelectionTrackDraft('missing', { storage })).toBeNull()

    storage.setItem('cognipace:track-draft:bad-json', '{')
    expect(readLibrarySelectionTrackDraft('bad-json', { storage })).toBeNull()

    storage.setItem(
      'cognipace:track-draft:empty',
      JSON.stringify({
        id: 'empty',
        source: 'library-selection',
        problemSlugs: [],
        createdAt: '2026-05-24T12:00:00.000Z',
      }),
    )
    expect(readLibrarySelectionTrackDraft('empty', { storage })).toBeNull()

    const expired = createLibrarySelectionTrackDraft(['two-sum'], {
      id: 'expired',
      now: new Date('2026-05-24T12:00:00.000Z'),
      storage,
    })
    expect(expired.id).toBe('expired')
    expect(
      readLibrarySelectionTrackDraft('expired', {
        now: new Date('2026-05-24T13:01:00.000Z'),
        storage,
      }),
    ).toBeNull()
  })

  it('clears drafts by id', () => {
    const storage = new MemoryStorage()
    createLibrarySelectionTrackDraft(['two-sum'], {
      id: 'draft-1',
      now: new Date('2026-05-24T12:00:00.000Z'),
      storage,
    })

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
