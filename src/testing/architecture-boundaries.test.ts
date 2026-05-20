import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))))
const srcRoot = join(repoRoot, 'src')
const featureDeepImportPattern =
  /(?:\bfrom\s+|\bimport\s+|\bimport\()\s*['"](@\/features\/([^/'"]+)\/[^'"]+)['"]/g

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

  it('keeps app feature imports on public feature barrels', () => {
    const offenders = sourceFiles(['app']).flatMap((file) =>
      findNestedFeatureImports(file).map(({ importPath }) =>
        formatImportOffender(file, importPath),
      ),
    )

    expect(offenders).toEqual([])
  })

  it('keeps cross-feature imports on public feature barrels', () => {
    const offenders = sourceFiles(['features']).flatMap((file) => {
      const currentFeatureName = getOwningFeatureName(file)

      return findNestedFeatureImports(file)
        .filter(({ featureName }) => featureName !== currentFeatureName)
        .map(({ importPath }) => formatImportOffender(file, importPath))
    })

    expect(offenders).toEqual([])
  })

  it('does not introduce a custom runtime-rpc library', () => {
    const libEntries = readdirSync(join(srcRoot, 'lib'))

    expect(libEntries).not.toContain('runtime-rpc')
  })

  it('keeps global styles free of legacy product class selectors', () => {
    const styleFiles = [
      join(srcRoot, 'app/styles.css'),
      join(srcRoot, 'styles/base.css'),
      join(srcRoot, 'styles/surfaces.css'),
      join(srcRoot, 'styles/tokens.css'),
    ]
    const offenders = styleFiles.filter((file) => {
      const content = readFileSync(file, 'utf8')
      return /\.cp-[a-z0-9-]+/.test(content)
    })

    expect(offenders.map(toRepoPath)).toEqual([])
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

function findNestedFeatureImports(file: string) {
  const content = readFileSync(file, 'utf8')
  const imports: Array<{ featureName: string; importPath: string }> = []

  for (const match of content.matchAll(featureDeepImportPattern)) {
    const importPath = match[1]
    const featureName = match[2]

    if (importPath && featureName) {
      imports.push({ featureName, importPath })
    }
  }

  return imports
}

function getOwningFeatureName(file: string) {
  const [featureName] = relative(join(srcRoot, 'features'), file).split(/[\\/]/)

  if (!featureName) {
    throw new Error(`Could not determine owning feature for ${file}`)
  }

  return featureName
}

function formatImportOffender(file: string, importPath: string) {
  return `${toRepoPath(file)} -> ${importPath}`
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
