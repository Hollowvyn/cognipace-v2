export const queryKeys = {
  appShell: {
    all: ['app-shell-data'] as const,
    popup: () => [...queryKeys.appShell.all, 'popup'] as const,
    dashboard: () => [...queryKeys.appShell.all, 'dashboard'] as const,
    overlay: (problemSlug?: string | null) =>
      [...queryKeys.appShell.all, 'overlay', problemSlug ?? null] as const,
  },
  practice: {
    all: ['practice-details'] as const,
    details: (problemId: string, at?: string | null) =>
      [...queryKeys.practice.all, problemId, at ?? null] as const,
  },
  problems: {
    all: ['problems'] as const,
  },
  queue: {
    all: ['today-queue'] as const,
    today: (at?: string | null) =>
      [...queryKeys.queue.all, at ?? 'now'] as const,
  },
  settings: {
    all: ['settings'] as const,
  },
  tracks: {
    all: ['tracks'] as const,
    active: (surface?: string | null) =>
      [...queryKeys.tracks.all, 'active', surface ?? null] as const,
  },
} as const
