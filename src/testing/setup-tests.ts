import '@testing-library/jest-dom/vitest'
import { beforeEach, vi } from 'vitest'

const chromeLocalStorage = new Map<string, unknown>()

beforeEach(() => {
  chromeLocalStorage.clear()
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get(keys: string[] | string) {
          const output: Record<string, unknown> = {}

          for (const key of Array.isArray(keys) ? keys : [keys]) {
            output[key] = chromeLocalStorage.get(key)
          }

          return Promise.resolve(output)
        },
        set(values: Record<string, unknown>) {
          for (const [key, value] of Object.entries(values)) {
            chromeLocalStorage.set(key, value)
          }

          return Promise.resolve()
        },
        remove(keys: string[] | string) {
          for (const key of Array.isArray(keys) ? keys : [keys]) {
            chromeLocalStorage.delete(key)
          }

          return Promise.resolve()
        },
        setAccessLevel: vi.fn(() => Promise.resolve()),
      },
    },
  })
})
