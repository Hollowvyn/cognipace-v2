import { PopupShell } from './popup-shell'

import { useAppShellData } from '@/features/app-shell'
import { useExtensionPing } from '@/hooks/use-extension-ping'

const fallbackData = {
  status: {
    label: 'Loading foundation',
    detail: 'Waiting for background service worker response.',
  },
  metrics: [
    { label: 'Due Today', value: '--' },
    { label: 'Streak', value: '--' },
  ],
  recommendation: {
    title: 'Loading recommendation',
    detail: 'The queue service is not connected yet.',
  },
  activeTrack: {
    title: 'Loading track',
    detail: 'The track service is not connected yet.',
  },
}

export function PopupApp() {
  const shell = useAppShellData('popup')
  const ping = useExtensionPing('popup')

  return (
    <PopupShell
      data={shell.data ?? fallbackData}
      pingLabel={ping.isSuccess ? 'Connected' : 'Connecting'}
    />
  )
}
