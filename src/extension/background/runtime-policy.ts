import type { ExtensionSurface } from '@/extension/messaging'

const methodSurfaceAccess = {
  'runtime.ping': ['background', 'popup', 'dashboard', 'content-script'],
  'app.getShellData': ['popup', 'dashboard', 'content-script'],
} as const satisfies Record<string, readonly ExtensionSurface[]>

export type ExtensionMethod = keyof typeof methodSurfaceAccess

export function isExtensionMethod(method: string): method is ExtensionMethod {
  return method in methodSurfaceAccess
}

export function canCallExtensionMethod(
  method: string,
  surface: ExtensionSurface,
) {
  return (
    isExtensionMethod(method) &&
    (methodSurfaceAccess[method] as readonly ExtensionSurface[]).includes(
      surface,
    )
  )
}

export function assertCanCallExtensionMethod(
  method: string,
  surface: ExtensionSurface,
) {
  if (!canCallExtensionMethod(method, surface)) {
    throw new Error(`Surface "${surface}" is not allowed to call "${method}".`)
  }
}
