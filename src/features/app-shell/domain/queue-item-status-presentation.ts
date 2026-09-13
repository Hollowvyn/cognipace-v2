import type { AppShellQueueItem } from '../api/app-shell-contracts'

export function getQueueItemStatusPresentation(
  reason: AppShellQueueItem['reason'],
) {
  switch (reason) {
    case 'overdue':
      return { label: 'Overdue', tone: 'danger' as const }
    case 'due-today':
      return { label: 'Due today', tone: 'warning' as const }
    case 'new-problem':
      return { label: 'New', tone: 'info' as const }
    case 'reinforcement':
      return { label: 'Extra Practice', tone: 'success' as const }
  }
}
