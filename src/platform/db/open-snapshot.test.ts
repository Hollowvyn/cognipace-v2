import { describe, expect, it, vi } from 'vitest'

import type { DbHandle } from './client'
import type { SnapshotState } from './snapshot-state'
import { openSnapshot, type OpenSnapshotDependencies } from './open-snapshot'

const handle = { rawDb: { close: vi.fn() } } as unknown as DbHandle

function storedState(fingerprint = '11111111'): SnapshotState {
  return {
    kind: 'stored',
    raw: { snapshot: 'encoded', fingerprint },
    fingerprint,
    bytes: new Uint8Array([1]),
  }
}

function dependencies(
  overrides: Partial<OpenSnapshotDependencies> = {},
): OpenSnapshotDependencies {
  return {
    currentFingerprint: '22222222',
    read: vi.fn().mockResolvedValue(storedState()),
    preserve: vi.fn().mockResolvedValue(undefined),
    fresh: vi.fn().mockResolvedValue(handle),
    restore: vi.fn().mockResolvedValue(handle),
    validate: vi.fn().mockResolvedValue(undefined),
    upgrade: vi.fn().mockResolvedValue(undefined),
    prepare: vi.fn().mockResolvedValue(undefined),
    publish: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('openSnapshot', () => {
  it('does not publish or return a handle when preparation fails', async () => {
    const close = vi.fn()
    const failingHandle = { rawDb: { close } } as unknown as DbHandle
    const publish = vi.fn(() => Promise.resolve())
    const deps = dependencies({
      restore: vi.fn().mockResolvedValue(failingHandle),
      prepare: vi.fn().mockRejectedValue(new Error('alias conflict')),
      publish,
    })
    await expect(openSnapshot(deps)).rejects.toThrow('alias conflict')
    expect(publish).not.toHaveBeenCalled()
    expect(close).toHaveBeenCalledOnce()
  })

  it('keeps the operation error primary when closing also fails', async () => {
    const operationError = new Error('alias conflict')
    const cleanupError = new Error('close failed')
    const close = vi.fn(() => {
      throw cleanupError
    })
    const failingHandle = { rawDb: { close } } as unknown as DbHandle
    const deps = dependencies({
      restore: vi.fn().mockResolvedValue(failingHandle),
      prepare: vi.fn().mockRejectedValue(operationError),
    })

    await expect(openSnapshot(deps)).rejects.toBe(operationError)
  })

  it('preserves, restores, upgrades, prepares, validates, then publishes in order', async () => {
    const events: string[] = []
    const prepare = vi.fn(() => {
      events.push('prepare')
      return Promise.resolve()
    })
    const deps = dependencies({
      preserve: vi.fn(() => {
        events.push('preserve')
        return Promise.resolve()
      }),
      restore: vi.fn(() => {
        events.push('restore')
        return Promise.resolve(handle)
      }),
      validate: vi.fn((_handle, fingerprint) => {
        events.push(
          fingerprint === '11111111' ? 'validate old' : 'validate new',
        )
        return Promise.resolve()
      }),
      upgrade: vi.fn(() => {
        events.push('upgrade')
        return Promise.resolve()
      }),
      prepare,
      publish: vi.fn(() => {
        events.push('publish')
        return Promise.resolve()
      }),
    })

    await expect(openSnapshot(deps)).resolves.toBe(handle)
    expect(events).toEqual([
      'preserve',
      'restore',
      'validate old',
      'upgrade',
      'prepare',
      'validate new',
      'publish',
    ])
    expect(prepare).toHaveBeenCalledWith(handle, {
      kind: 'upgrade',
      fromFingerprint: '11111111',
    })
  })

  it('does not upgrade, prepare, or publish a matching snapshot', async () => {
    const upgrade = vi.fn(() => Promise.resolve())
    const prepare = vi.fn(() => Promise.resolve())
    const publish = vi.fn(() => Promise.resolve())
    const deps = dependencies({
      read: vi.fn().mockResolvedValue(storedState('22222222')),
      upgrade,
      prepare,
      publish,
    })

    await expect(openSnapshot(deps)).resolves.toBe(handle)
    expect(upgrade).not.toHaveBeenCalled()
    expect(prepare).not.toHaveBeenCalled()
    expect(publish).not.toHaveBeenCalled()
  })

  it('persists a fresh database before returning it', async () => {
    const events: string[] = []
    const deps = dependencies({
      read: vi.fn(() => Promise.resolve({ kind: 'empty' as const })),
      fresh: vi.fn(() => {
        events.push('fresh')
        return Promise.resolve(handle)
      }),
      prepare: vi.fn(() => {
        events.push('prepare')
        return Promise.resolve()
      }),
      validate: vi.fn(() => {
        events.push('validate')
        return Promise.resolve()
      }),
      publish: vi.fn(() => {
        events.push('publish')
        return Promise.resolve()
      }),
    })

    await expect(openSnapshot(deps)).resolves.toBe(handle)
    expect(events).toEqual(['fresh', 'prepare', 'validate', 'publish'])
  })

  it.each([
    ['preserve', ['preserve']],
    ['restore', ['preserve', 'restore']],
    ['validate old', ['preserve', 'restore', 'validate old']],
    ['upgrade', ['preserve', 'restore', 'validate old', 'upgrade']],
    ['prepare', ['preserve', 'restore', 'validate old', 'upgrade', 'prepare']],
    [
      'validate new',
      [
        'preserve',
        'restore',
        'validate old',
        'upgrade',
        'prepare',
        'validate new',
      ],
    ],
    [
      'publish',
      [
        'preserve',
        'restore',
        'validate old',
        'upgrade',
        'prepare',
        'validate new',
        'publish',
      ],
    ],
  ])('stops after %s fails', async (failedStep, expectedEvents) => {
    const events: string[] = []
    const step = (name: string) =>
      vi.fn(() => {
        events.push(name)
        if (name === failedStep) throw new Error(`${name} failed`)
        return Promise.resolve()
      })
    const deps = dependencies({
      preserve: step('preserve'),
      restore: vi.fn(() => {
        events.push('restore')
        if ('restore' === failedStep) throw new Error('restore failed')
        return Promise.resolve(handle)
      }),
      validate: vi.fn((_handle, fingerprint) => {
        const name =
          fingerprint === '11111111' ? 'validate old' : 'validate new'
        events.push(name)
        if (name === failedStep) throw new Error(`${name} failed`)
        return Promise.resolve()
      }),
      upgrade: step('upgrade'),
      prepare: step('prepare'),
      publish: step('publish'),
    })

    await expect(openSnapshot(deps)).rejects.toThrow(`${failedStep} failed`)
    expect(events).toEqual(expectedEvents)
  })

  it.each([
    ['fresh', ['fresh']],
    ['prepare', ['fresh', 'prepare']],
    ['validate', ['fresh', 'prepare', 'validate']],
    ['publish', ['fresh', 'prepare', 'validate', 'publish']],
  ])(
    'does not return an unpersisted fresh database if %s fails',
    async (failedStep, expectedEvents) => {
      const events: string[] = []
      const close = vi.fn()
      const freshHandle = { rawDb: { close } } as unknown as DbHandle
      const step = (name: string) =>
        vi.fn(() => {
          events.push(name)
          if (name === failedStep) throw new Error(`${name} failed`)
          return Promise.resolve()
        })
      const deps = dependencies({
        read: vi.fn(() => Promise.resolve({ kind: 'empty' as const })),
        fresh: vi.fn(() => {
          events.push('fresh')
          if ('fresh' === failedStep) throw new Error('fresh failed')
          return Promise.resolve(freshHandle)
        }),
        prepare: step('prepare'),
        validate: step('validate'),
        publish: step('publish'),
      })

      await expect(openSnapshot(deps)).rejects.toThrow(`${failedStep} failed`)
      expect(events).toEqual(expectedEvents)
      if (failedStep === 'fresh') expect(close).not.toHaveBeenCalled()
      else expect(close).toHaveBeenCalledOnce()
    },
  )
})
