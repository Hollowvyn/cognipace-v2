import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/platform/db/schema/index.ts',
  out: './src/platform/db/migrations',
})
