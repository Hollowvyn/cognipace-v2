import { configDefaults, defineConfig } from 'vitest/config'
import { WxtVitest } from 'wxt/testing/vitest-plugin'

export default defineConfig({
  plugins: await WxtVitest({
    dev: {
      server: {
        host: '127.0.0.1',
        port: 3000,
        strictPort: true,
      },
    },
  }),
  test: {
    environment: 'jsdom',
    exclude: [...configDefaults.exclude, '.worktrees/**'],
    globals: true,
    setupFiles: ['./src/testing/setup-tests.ts'],
  },
})
