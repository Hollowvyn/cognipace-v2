import type { DbHandle } from './client'
import type { SnapshotState } from './snapshot-state'

export interface PublishContext {
  kind: 'fresh' | 'upgrade'
  fromFingerprint: string | null
}

export interface OpenSnapshotDependencies {
  currentFingerprint: string
  read(): Promise<SnapshotState>
  preserve(raw: Record<string, unknown>): Promise<void>
  fresh(): Promise<DbHandle>
  restore(bytes: Uint8Array): Promise<DbHandle>
  validate(handle: DbHandle, fingerprint: string): Promise<void>
  upgrade(handle: DbHandle, fingerprint: string): Promise<void>
  prepare(handle: DbHandle, context: PublishContext): Promise<void>
  publish(handle: DbHandle): Promise<void>
}

export async function openSnapshot(deps: OpenSnapshotDependencies) {
  const state = await deps.read()
  if (state.kind === 'invalid') {
    await deps.preserve(state.raw)
    throw new Error(`Database recovery required: ${state.reason}`)
  }

  let handle: DbHandle | undefined
  try {
    if (state.kind === 'empty') {
      handle = await deps.fresh()
      await deps.prepare(handle, { kind: 'fresh', fromFingerprint: null })
      await deps.validate(handle, deps.currentFingerprint)
      await deps.publish(handle)
      return handle
    }

    if (state.fingerprint !== deps.currentFingerprint)
      await deps.preserve(state.raw)
    handle = await deps.restore(state.bytes)
    await deps.validate(handle, state.fingerprint)
    if (state.fingerprint === deps.currentFingerprint) return handle

    await deps.upgrade(handle, state.fingerprint)
    await deps.prepare(handle, {
      kind: 'upgrade',
      fromFingerprint: state.fingerprint,
    })
    await deps.validate(handle, deps.currentFingerprint)
    await deps.publish(handle)
    return handle
  } catch (error) {
    try {
      handle?.rawDb.close()
    } catch (cleanupError) {
      if (error instanceof Error) {
        try {
          Object.defineProperty(error, 'cleanupError', {
            value: cleanupError,
            configurable: true,
          })
        } catch {
          // Preserve the operation failure even when it cannot carry cleanup detail.
        }
      }
    }
    throw error
  }
}
