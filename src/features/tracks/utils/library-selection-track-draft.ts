const DRAFT_STORAGE_KEY_PREFIX = 'cognipace:track-draft:'
const MAX_DRAFT_AGE_MS = 60 * 60 * 1000

export interface LibrarySelectionTrackDraft {
  createdAt: string
  id: string
  problemSlugs: string[]
  source: 'library-selection'
}

interface LibrarySelectionTrackDraftCreateOptions {
  id?: string
  now?: Date
  storage?: Storage
}

interface LibrarySelectionTrackDraftReadOptions {
  now?: Date
  storage?: Storage
}

interface LibrarySelectionTrackDraftStorageOptions {
  storage?: Storage
}

export function createLibrarySelectionTrackDraft(
  problemSlugs: string[],
  options: LibrarySelectionTrackDraftCreateOptions = {},
): LibrarySelectionTrackDraft {
  const now = options.now ?? new Date()
  const draft: LibrarySelectionTrackDraft = {
    id: options.id ?? createDraftId(),
    source: 'library-selection',
    problemSlugs: dedupeProblemSlugs(problemSlugs),
    createdAt: now.toISOString(),
  }

  getStorage(options.storage).setItem(getDraftStorageKey(draft.id), JSON.stringify(draft))

  return draft
}

export function readLibrarySelectionTrackDraft(
  id: string | null | undefined,
  options: LibrarySelectionTrackDraftReadOptions = {},
): LibrarySelectionTrackDraft | null {
  if (!id) {
    return null
  }

  const storage = getStorage(options.storage)
  const key = getDraftStorageKey(id)
  const value = storage.getItem(key)

  if (value === null) {
    return null
  }

  try {
    const draft: unknown = JSON.parse(value)
    if (!isLibrarySelectionTrackDraft(draft, id)) {
      storage.removeItem(key)
      return null
    }

    const createdAtTime = Date.parse(draft.createdAt)
    const nowTime = (options.now ?? new Date()).getTime()

    if (
      Number.isNaN(createdAtTime) ||
      createdAtTime > nowTime ||
      nowTime - createdAtTime > MAX_DRAFT_AGE_MS
    ) {
      storage.removeItem(key)
      return null
    }

    return draft
  } catch {
    storage.removeItem(key)
    return null
  }
}

export function clearLibrarySelectionTrackDraft(
  id: string | null | undefined,
  options: LibrarySelectionTrackDraftStorageOptions = {},
) {
  if (!id) {
    return
  }

  getStorage(options.storage).removeItem(getDraftStorageKey(id))
}

function createDraftId() {
  return globalThis.crypto?.randomUUID?.() ?? `draft-${Date.now()}`
}

function dedupeProblemSlugs(problemSlugs: string[]) {
  return [...new Set(problemSlugs.filter((slug) => slug.length > 0))]
}

function getDraftStorageKey(id: string) {
  return `${DRAFT_STORAGE_KEY_PREFIX}${id}`
}

function getStorage(storage?: Storage) {
  return storage ?? globalThis.sessionStorage
}

function isLibrarySelectionTrackDraft(
  draft: unknown,
  expectedId: string,
): draft is LibrarySelectionTrackDraft {
  if (typeof draft !== 'object' || draft === null) {
    return false
  }

  const value = draft as Partial<LibrarySelectionTrackDraft>

  return (
    value.id === expectedId &&
    value.source === 'library-selection' &&
    typeof value.createdAt === 'string' &&
    Array.isArray(value.problemSlugs) &&
    value.problemSlugs.length > 0 &&
    value.problemSlugs.every((slug) => typeof slug === 'string' && slug.length > 0)
  )
}
