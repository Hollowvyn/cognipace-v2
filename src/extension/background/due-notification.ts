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
  const [hours, minutes] = time.split(':').map(Number)
  const target = new Date(now)
  target.setHours(hours, minutes, 0, 0)
  if (target > now) {
    return Math.ceil((target.getTime() - now.getTime()) / 60_000)
  }
  target.setDate(target.getDate() + 1)
  return Math.ceil((target.getTime() - now.getTime()) / 60_000)
}

export function createDueNotification(deps: DueNotificationDeps) {
  let jobsRegistered = false

  async function runDailyCheck(): Promise<void> {}

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
