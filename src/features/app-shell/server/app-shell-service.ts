import type { AppShellRequest } from '@/extension/messaging'
import { getTodayQueue } from '@/features/queue'
import { getSettings } from '@/features/settings'
import { getActiveTrack } from '@/features/tracks'
import type { Db } from '@/platform/db'

import type { AppShellData } from '../domain'

export async function getAppShellData(
  db: Db,
  request: AppShellRequest,
): Promise<AppShellData> {
  const [settings, queue, activeTrack] = await Promise.all([
    getSettings(db),
    getTodayQueue(db),
    getActiveTrack(db),
  ])
  const recommendation = queue.items[0]
  const scope =
    request.surface === 'content-script' ? 'overlay' : request.surface

  return {
    status: {
      label: 'Data foundation online',
      detail: `Local SQLite, FSRS, and typed messaging are connected for ${scope}.`,
    },
    metrics: [
      { label: 'Due Today', value: String(queue.dueCount) },
      { label: 'Daily Goal', value: String(settings.dailyQuestionGoal) },
    ],
    recommendation: recommendation
      ? {
          title: recommendation.title,
          detail: `${recommendation.category === 'due' ? 'Review' : 'Start'} ${recommendation.difficulty}.`,
        }
      : {
          title: 'Queue is clear',
          detail: 'No due or new problems are available for the active group.',
        },
    activeTrack: activeTrack
      ? {
          title: activeTrack.track.title,
          detail: activeTrack.nextProblem
            ? `Next: ${activeTrack.nextProblem.title}`
            : 'All problems in the active group are complete.',
        }
      : {
          title: 'No active track',
          detail: 'Choose a track to start queue generation.',
        },
  }
}
