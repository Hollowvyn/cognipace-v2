import { defineBackground } from 'wxt/utils/define-background'

import { registerBackgroundHandlers } from '@/extension/background/register-handlers'
import { restrictSecretStorageAccess } from '@/platform/secrets'

export default defineBackground({
  type: 'module',
  main() {
    void startTrustedBackground()
  },
})

async function startTrustedBackground() {
  try {
    await restrictSecretStorageAccess()
    registerBackgroundHandlers()
  } catch (error) {
    console.error(
      'CogniPace background failed to initialize trusted storage',
      error,
    )
  }
}
