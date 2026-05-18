import {
  appShellDataSchema,
  appShellRequestSchema,
  onMessage,
  pingRequestSchema,
} from '@/extension/messaging'

import { getAppShellData } from './app-shell-service'
import { assertCanCallExtensionMethod } from './runtime-policy'

export function registerBackgroundHandlers() {
  onMessage('runtime.ping', ({ data }) => {
    const request = pingRequestSchema.parse(data)

    assertCanCallExtensionMethod('runtime.ping', request.surface)
    return {
      ok: true,
      surface: request.surface,
      receivedAt: new Date().toISOString(),
    }
  })

  onMessage('app.getShellData', ({ data }) => {
    const request = appShellRequestSchema.parse(data)

    assertCanCallExtensionMethod('app.getShellData', request.surface)
    return appShellDataSchema.parse(getAppShellData(request))
  })
}
