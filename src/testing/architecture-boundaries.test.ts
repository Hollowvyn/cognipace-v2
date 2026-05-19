import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))))
const srcRoot = join(repoRoot, 'src')

describe('architecture boundaries', () => {
  it('keeps shared infrastructure from importing app or feature code', () => {
    const sharedFiles = sourceFiles([
      'components',
      'hooks',
      'lib',
      'platform',
      'types',
      'utils',
    ])
    const offenders = sharedFiles.filter((file) => {
      const content = readFileSync(file, 'utf8')
      return /from ['"]@\/(app|features|entrypoints)\//.test(content)
    })

    expect(offenders.map(toRepoPath)).toEqual([])
  })

  it('keeps cross-feature imports on public feature barrels', () => {
    const featureFiles = sourceFiles(['features'])
    const offenders = featureFiles.filter((file) => {
      const content = readFileSync(file, 'utf8')
      return /from ['"]@\/features\/[^'"]+\/(api|data|domain|server)\//.test(
        content,
      )
    })

    expect(offenders.map(toRepoPath)).toEqual([])
  })

  it('does not introduce a custom runtime-rpc library', () => {
    const libEntries = readdirSync(join(srcRoot, 'lib'))

    expect(libEntries).not.toContain('runtime-rpc')
  })
})

function sourceFiles(directories: string[]) {
  return directories.flatMap((directory) =>
    walk(join(srcRoot, directory)).filter(
      (file) =>
        (file.endsWith('.ts') || file.endsWith('.tsx')) &&
        !file.endsWith('.test.ts') &&
        !file.endsWith('.test.tsx'),
    ),
  )
}

function walk(path: string): string[] {
  if (statSync(path).isFile()) {
    return [path]
  }

  return readdirSync(path).flatMap((entry) => walk(join(path, entry)))
}

function toRepoPath(path: string) {
  return relative(repoRoot, path)
}
