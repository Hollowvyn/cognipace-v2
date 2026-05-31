import { browser } from 'wxt/browser'

export type AlarmInfo = {
  delayInMinutes?: number
  periodInMinutes?: number
}

export type AlarmAdapter = {
  clear: (name: string) => Promise<boolean>
  create: (name: string, info: AlarmInfo) => Promise<void>
  get: (name: string) => Promise<{ name: string } | undefined>
  onAlarm: (
    listener: (alarm: { name: string }) => void | Promise<void>,
  ) => () => void
}

export type AlarmJob = {
  name: string
  run: () => Promise<void> | void
  startup?: AlarmInfo | undefined
}

export type AlarmScheduler = ReturnType<typeof createAlarmScheduler>

export function createAlarmScheduler(
  input: {
    alarms?: AlarmAdapter | undefined
  } = {},
) {
  const alarms = input.alarms ?? createChromeAlarmAdapter()
  const jobs = new Map<string, AlarmJob>()
  const unsubscribe = alarms.onAlarm(async (alarm) => {
    const job = jobs.get(alarm.name)

    if (!job) {
      return
    }

    await job.run()
  })

  return {
    async clear(name: string) {
      assertRegisteredJob(name)
      await alarms.clear(name)
    },
    dispose() {
      unsubscribe()
    },
    register(job: AlarmJob) {
      jobs.set(job.name, job)
    },
    async repairStartupAlarms() {
      for (const job of jobs.values()) {
        if (!job.startup) {
          continue
        }

        const existingAlarm = await alarms.get(job.name)

        if (existingAlarm) {
          continue
        }

        await alarms.create(job.name, job.startup)
      }
    },
    async schedule(name: string, info: AlarmInfo) {
      assertRegisteredJob(name)
      await alarms.create(name, info)
    },
  }

  function assertRegisteredJob(name: string) {
    if (jobs.has(name)) {
      return
    }

    throw new Error(`Unknown alarm job: ${name}`)
  }
}

export function createChromeAlarmAdapter(): AlarmAdapter {
  return {
    clear(name) {
      return browser.alarms.clear(name)
    },
    create(name, info) {
      return browser.alarms.create(name, info)
    },
    async get(name) {
      const alarm = await browser.alarms.get(name)

      return alarm ? { name: alarm.name } : undefined
    },
    onAlarm(listener) {
      const onAlarm = (alarm: { name: string }) => listener(alarm)

      browser.alarms.onAlarm.addListener(onAlarm)

      return () => {
        browser.alarms.onAlarm.removeListener(onAlarm)
      }
    },
  }
}
