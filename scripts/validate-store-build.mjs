import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

const REQUIRED_ICON_SIZES = ['16', '32', '48', '128']
const EXPECTED_NAME = 'CogniPace'
const EXPECTED_DESCRIPTION = 'Local-first LeetCode review and study pacing.'

async function readJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'))
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`${filePath} could not be read: ${detail}`)
  }
}

function iconPath(value) {
  return typeof value === 'string' && value.trim()
    ? value.replace(/^[/\\]+/, '').replaceAll('\\', '/')
    : null
}

function isAbsoluteIconPath(value) {
  return (
    typeof value === 'string' &&
    (path.posix.isAbsolute(value) || path.win32.isAbsolute(value)) &&
    !/^\/icon-[^/\\]+$/.test(value)
  )
}

export async function validateStoreBuild({ rootDir = process.cwd() } = {}) {
  const buildRoot = path.join(rootDir, '.output', 'chrome-mv3')
  const manifestPath = path.join(buildRoot, 'manifest.json')
  const packagePath = path.join(rootDir, 'package.json')
  const errors = []
  let manifest
  let packageJson

  try {
    manifest = await readJson(manifestPath)
  } catch (error) {
    errors.push(error.message)
  }
  try {
    packageJson = await readJson(packagePath)
  } catch (error) {
    errors.push(error.message)
  }

  if (manifest && packageJson) {
    if (manifest.manifest_version !== 3)
      errors.push('manifest_version must be 3')
    if (manifest.name !== EXPECTED_NAME)
      errors.push(`name must be exactly "${EXPECTED_NAME}"`)
    if (manifest.description !== EXPECTED_DESCRIPTION) {
      errors.push(`description must be exactly "${EXPECTED_DESCRIPTION}"`)
    }
    if (manifest.version !== packageJson.version) {
      errors.push(
        `manifest version ${manifest.version} does not match package.json version ${packageJson.version}`,
      )
    }
  }

  const iconFiles = new Set()
  const invalidIconPaths = new Set()
  if (manifest) {
    const maps = [
      ['manifest.icons', manifest.icons],
      ['manifest.action.default_icon', manifest.action?.default_icon],
    ]
    for (const [label, iconMap] of maps) {
      for (const size of REQUIRED_ICON_SIZES) {
        if (
          !iconMap ||
          typeof iconMap !== 'object' ||
          !iconPath(iconMap[size])
        ) {
          errors.push(`${label} is missing required size ${size}`)
        }
      }
      if (iconMap && typeof iconMap === 'object') {
        for (const value of Object.values(iconMap)) {
          if (isAbsoluteIconPath(value)) {
            const normalized = iconPath(value)
            if (!invalidIconPaths.has(normalized)) {
              errors.push(`icon path must be relative to build root: ${value}`)
              invalidIconPaths.add(normalized)
            }
            continue
          }
          const originalPath =
            typeof value === 'string' ? value.replace(/^[/\\]+/, '') : null
          const normalized = iconPath(value)
          if (!normalized) continue
          const resolved = path.resolve(buildRoot, normalized)
          const relative = path.relative(buildRoot, resolved)
          if (relative.startsWith('..') || path.isAbsolute(relative)) {
            if (!invalidIconPaths.has(normalized)) {
              errors.push(`icon path escapes build root: ${originalPath}`)
              invalidIconPaths.add(normalized)
            }
            continue
          }
          iconFiles.add(normalized)
        }
      }
    }
  }

  for (const iconFile of [...iconFiles].sort()) {
    try {
      await access(path.join(buildRoot, iconFile))
    } catch {
      errors.push(`icon file is missing: ${iconFile}`)
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Store build validation failed:\n${errors.map((error) => `- ${error}`).join('\n')}`,
    )
  }

  return {
    iconFiles: [...iconFiles].sort(),
    manifestPath,
    version: manifest.version,
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const result = await validateStoreBuild()
    console.log(
      `Store build validation passed for CogniPace ${result.version} with ${result.iconFiles.length} icon files.`,
    )
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
