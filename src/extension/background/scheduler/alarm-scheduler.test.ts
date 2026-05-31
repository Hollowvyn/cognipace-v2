import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createAlarmScheduler, type AlarmAdapter } from './alarm-scheduler'

describe('alarm scheduler', () => {
  let adapter: FakeAlarmAdapter

  beforeEach(() => {
    adapter = createFakeAlarmAdapter()
  })

  it('creates namespaced alarms and dispatches registered jobs', async () => {
    const scheduler = createAlarmScheduler({ alarms: adapter })
    const run = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)

    scheduler.register({ name: 'sync:auto-push', run })
    await scheduler.schedule('sync:auto-push', { delayInMinutes: 0.5 })
    await adapter.fire('sync:auto-push')

    expect(adapter.created).toEqual([
      ['sync:auto-push', { delayInMinutes: 0.5 }],
    ])
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('repairs repeating alarms that are missing on startup', async () => {
    const scheduler = createAlarmScheduler({ alarms: adapter })

    scheduler.register({
      name: 'sync:poll',
      run: vi.fn(),
      startup: { delayInMinutes: 10, periodInMinutes: 10 },
    })

    await scheduler.repairStartupAlarms()

    expect(adapter.created).toEqual([
      ['sync:poll', { delayInMinutes: 10, periodInMinutes: 10 }],
    ])
  })

  it('does not replace an existing startup alarm', async () => {
    adapter.existing.add('sync:poll')
    const scheduler = createAlarmScheduler({ alarms: adapter })

    scheduler.register({
      name: 'sync:poll',
      run: vi.fn(),
      startup: { delayInMinutes: 10, periodInMinutes: 10 },
    })

    await scheduler.repairStartupAlarms()

    expect(adapter.created).toEqual([])
  })

  it('clears a scheduled alarm', async () => {
    const scheduler = createAlarmScheduler({ alarms: adapter })

    scheduler.register({ name: 'sync:auto-push', run: vi.fn() })
    await scheduler.clear('sync:auto-push')

    expect(adapter.cleared).toEqual(['sync:auto-push'])
  })

  it('throws when scheduling an unregistered alarm name', async () => {
    const scheduler = createAlarmScheduler({ alarms: adapter })

    await expect(
      scheduler.schedule('sync:auto-push', { delayInMinutes: 0.5 }),
    ).rejects.toThrowError('Unknown alarm job: sync:auto-push')
  })

  it('throws when clearing an unregistered alarm name', async () => {
    const scheduler = createAlarmScheduler({ alarms: adapter })

    await expect(scheduler.clear('sync:auto-push')).rejects.toThrowError(
      'Unknown alarm job: sync:auto-push',
    )
  })

  it('ignores unknown alarms safely', async () => {
    createAlarmScheduler({ alarms: adapter })

    await expect(adapter.fire('unknown:job')).resolves.toBeUndefined()
  })

  it('disposes the alarm listener and prevents later dispatch', async () => {
    const scheduler = createAlarmScheduler({ alarms: adapter })
    const run = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)

    scheduler.register({ name: 'sync:auto-push', run })
    scheduler.dispose()
    await adapter.fire('sync:auto-push')

    expect(run).not.toHaveBeenCalled()
  })
})

type AlarmInfo = {
  delayInMinutes?: number
  periodInMinutes?: number
}

type FakeAlarmAdapter = AlarmAdapter & {
  cleared: string[]
  created: Array<[string, AlarmInfo]>
  existing: Set<string>
  fire: (name: string) => Promise<void>
}

function createFakeAlarmAdapter(): FakeAlarmAdapter {
  let listener: ((alarm: { name: string }) => void | Promise<void>) | null =
    null
  const existing = new Set<string>()

  return {
    cleared: [],
    created: [],
    existing,
    async clear(name) {
      this.cleared.push(name)
      existing.delete(name)
      return true
    },
    async create(name, info) {
      this.created.push([name, info])
      existing.add(name)
    },
    async get(name) {
      return existing.has(name) ? { name } : undefined
    },
    onAlarm(listenerInput) {
      listener = listenerInput
      return () => {
        listener = null
      }
    },
    async fire(name) {
      await listener?.({ name })
    },
  }
}
