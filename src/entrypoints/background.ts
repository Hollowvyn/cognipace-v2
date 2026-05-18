import { defineBackground } from 'wxt/utils/define-background'

import { registerBackgroundHandlers } from '@/extension/background/register-handlers'

export default defineBackground({
  type: 'module',
  main() {
    registerBackgroundHandlers()
  },
})
