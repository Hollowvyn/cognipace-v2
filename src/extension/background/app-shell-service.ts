import type { AppShellData, AppShellRequest } from '@/extension/messaging'

export function getAppShellData(request: AppShellRequest): AppShellData {
  const scope =
    request.surface === 'content-script' ? 'overlay' : request.surface

  return {
    status: {
      label: 'Foundation online',
      detail: `Typed messaging is connected for the ${scope} surface.`,
    },
    metrics: [
      { label: 'Due Today', value: '--' },
      { label: 'Streak', value: '--' },
    ],
    recommendation: {
      title: 'Recommendation service pending',
      detail:
        'Queue generation, FSRS, and local persistence land after the shell.',
    },
    activeTrack: {
      title: 'Track service pending',
      detail: 'Active-track progression will plug into this panel later.',
    },
  }
}
