import type { UserSettings } from '@/features/settings/domain'
import type { AlarmScheduler } from './scheduler/alarm-scheduler'

export const dueCheckAlarmName = 'due:daily-check'

export type DueNotificationDeps = {
  now: () => Date
  readSettings: () => Promise<Pick<UserSettings, 'reminders'>>
  readQueueSummary: () => Promise<{ dueCount: number }>
  readState: () => Promise<{ lastNotifiedDate: string | null }>
  writeState: (date: string) => Promise<void>
  notify: (title: string, message: string) => Promise<void>
  checkAlarmScheduled: (name: string) => Promise<boolean>
  scheduler: Pick<AlarmScheduler, 'clear' | 'register' | 'schedule'>
}

export function normalizeNotificationTime(time: string, now: Date): number {
  const parts = time.split(':').map(Number)
  const hours = parts[0]!
  const minutes = parts[1]!
  const target = new Date(now)
  target.setHours(hours, minutes, 0, 0)
  if (target > now) {
    return Math.ceil((target.getTime() - now.getTime()) / 60_000)
  }
  target.setDate(target.getDate() + 1)
  return Math.ceil((target.getTime() - now.getTime()) / 60_000)
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function createDueNotification(deps: DueNotificationDeps) {
  let jobsRegistered = false

  async function runDailyCheck(): Promise<void> {
    const settings = await deps.readSettings()
    if (!settings.reminders.daily.enabled) {
      return
    }

    const now = deps.now()
    const today = toDateString(now)
    const state = await deps.readState()
    const { dueCount } = await deps.readQueueSummary()

    if (state.lastNotifiedDate !== today && dueCount > 0) {
      await deps.notify(
        'Reviews due',
        `You have ${dueCount} review${dueCount === 1 ? '' : 's'} due today.`,
      )
      await deps.writeState(today)
    }

    await deps.scheduler.schedule(dueCheckAlarmName, {
      delayInMinutes: normalizeNotificationTime(settings.reminders.daily.time, now),
    })
  }

  async function handleStartup(): Promise<void> {}

  async function onSettingsChanged(
    _prev: Pick<UserSettings, 'reminders'>,
    _next: Pick<UserSettings, 'reminders'>,
  ): Promise<void> {}

  function registerJobs(): void {
    if (jobsRegistered) return
    deps.scheduler.register({ name: dueCheckAlarmName, run: runDailyCheck })
    jobsRegistered = true
  }

  return { handleStartup, onSettingsChanged, registerJobs, runDailyCheck }
}
