import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, it } from 'vitest'

import { validateStoreBuild } from './validate-store-build.mjs'

const tempDirectories = []

afterEach(async () => {
  await Promise.all(
    tempDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  )
})

async function createFixture({ manifest, version = '1.3.0', files = [] }) {
  const rootDir = await mkdtemp(
    path.join(os.tmpdir(), 'cognipace-store-build-'),
  )
  tempDirectories.push(rootDir)
  const buildDir = path.join(rootDir, '.output', 'chrome-mv3')
  await mkdir(buildDir, { recursive: true })
  await writeFile(
    path.join(rootDir, 'package.json'),
    JSON.stringify({ version }),
  )
  if (manifest !== undefined) {
    await writeFile(
      path.join(buildDir, 'manifest.json'),
      JSON.stringify(manifest),
    )
  }
  await Promise.all(
    files.map(async (file) => {
      const filePath = path.join(buildDir, file)
      await mkdir(path.dirname(filePath), { recursive: true })
      await writeFile(filePath, 'icon')
    }),
  )
  return rootDir
}

const completeIcons = {
  16: 'icons/16.png',
  32: 'icons/32.png',
  48: 'icons/48.png',
  128: 'icons/128.png',
}
const REQUIRED_ICON_SIZES = ['16', '32', '48', '128']

describe('validateStoreBuild', () => {
  it('accepts a valid MV3 identity, version, and complete icon maps', async () => {
    const rootDir = await createFixture({
      manifest: {
        manifest_version: 3,
        name: 'CogniPace',
        description: 'Local-first LeetCode review and study pacing.',
        version: '1.3.0',
        icons: completeIcons,
        action: { default_icon: { ...completeIcons } },
      },
      files: Object.values(completeIcons),
    })

    const result = await validateStoreBuild({ rootDir })

    assert.deepEqual(result, {
      iconFiles: Object.values(completeIcons).sort(),
      manifestPath: path.join(
        rootDir,
        '.output',
        'chrome-mv3',
        'manifest.json',
      ),
      version: '1.3.0',
    })
  })

  it('accepts complete slash-prefixed WXT root icon resources', async () => {
    const rootIcons = Object.fromEntries(
      REQUIRED_ICON_SIZES.map((size) => [size, `/icon-${size}.png`]),
    )
    const rootDir = await createFixture({
      manifest: {
        manifest_version: 3,
        name: 'CogniPace',
        description: 'Local-first LeetCode review and study pacing.',
        version: '1.3.0',
        icons: rootIcons,
        action: { default_icon: { ...rootIcons } },
      },
      files: Object.values(rootIcons).map((file) => file.slice(1)),
    })

    const result = await validateStoreBuild({ rootDir })

    assert.deepEqual(
      result.iconFiles,
      Object.values(rootIcons)
        .map((file) => file.slice(1))
        .sort(),
    )
  })

  it('aggregates identity, version, icon-size, and missing-file failures', async () => {
    const rootDir = await createFixture({
      manifest: {
        manifest_version: 2,
        name: 'Wrong Name',
        description: 'Wrong description',
        version: '2.0.0',
        icons: {
          16: 'icons/missing.png',
          32: 'icons/missing.png',
          48: 'icons/missing.png',
        },
        action: {
          default_icon: {
            16: 'icons/missing.png',
            32: 'icons/missing.png',
            128: 'icons/missing.png',
          },
        },
      },
      files: [],
    })

    await assert.rejects(validateStoreBuild({ rootDir }), (error) => {
      assert.match(error.message, /^Store build validation failed:/)
      for (const expected of [
        'manifest_version must be 3',
        'name must be exactly "CogniPace"',
        'description must be exactly "Local-first LeetCode review and study pacing."',
        'manifest version 2.0.0 does not match package.json version 1.3.0',
        'manifest.icons is missing required size 128',
        'manifest.action.default_icon is missing required size 48',
        'icon file is missing: icons/missing.png',
      ]) {
        assert.match(
          error.message,
          new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
        )
      }
      return true
    })
  })

  it('rejects malformed icon values instead of treating them as declared paths', async () => {
    const rootDir = await createFixture({
      manifest: {
        manifest_version: 3,
        name: 'CogniPace',
        description: 'Local-first LeetCode review and study pacing.',
        version: '1.3.0',
        icons: { ...completeIcons, 16: 1 },
        action: { default_icon: { ...completeIcons, 32: {} } },
      },
      files: Object.values(completeIcons),
    })

    await assert.rejects(validateStoreBuild({ rootDir }), (error) => {
      assert.match(error.message, /manifest\.icons is missing required size 16/)
      assert.match(
        error.message,
        /manifest\.action\.default_icon is missing required size 32/,
      )
      return true
    })
  })

  it('rejects icon paths that escape the production build root', async () => {
    const rootDir = await createFixture({
      manifest: {
        manifest_version: 3,
        name: 'CogniPace',
        description: 'Local-first LeetCode review and study pacing.',
        version: '1.3.0',
        icons: Object.fromEntries(
          REQUIRED_ICON_SIZES.map((size) => [size, '../../package.json']),
        ),
        action: {
          default_icon: Object.fromEntries(
            REQUIRED_ICON_SIZES.map((size) => [size, '../../package.json']),
          ),
        },
      },
    })

    await assert.rejects(validateStoreBuild({ rootDir }), (error) => {
      assert.match(
        error.message,
        /icon path escapes build root: \.\.\/\.\.\/package\.json/,
      )
      assert.doesNotMatch(error.message, /icon file is missing/)
      return true
    })
  })

  it('rejects absolute filesystem icon paths while allowing WXT root resources', async () => {
    const rootDir = await createFixture({
      manifest: {
        manifest_version: 3,
        name: 'CogniPace',
        description: 'Local-first LeetCode review and study pacing.',
        version: '1.3.0',
        icons: { ...completeIcons, 16: '/tmp/accepted.png' },
        action: { default_icon: { ...completeIcons, 16: '/icon-16.png' } },
      },
      files: [...Object.values(completeIcons), 'icon-16.png'],
    })

    await assert.rejects(validateStoreBuild({ rootDir }), (error) => {
      assert.match(
        error.message,
        /icon path must be relative to build root: \/tmp\/accepted\.png/,
      )
      return true
    })
  })

  it('rejects Windows drive-absolute icon paths', async () => {
    const rootDir = await createFixture({
      manifest: {
        manifest_version: 3,
        name: 'CogniPace',
        description: 'Local-first LeetCode review and study pacing.',
        version: '1.3.0',
        icons: { ...completeIcons, 16: String.raw`C:\tmp\accepted.png` },
        action: { default_icon: { ...completeIcons } },
      },
      files: Object.values(completeIcons),
    })

    await assert.rejects(validateStoreBuild({ rootDir }), (error) => {
      assert.match(
        error.message,
        /icon path must be relative to build root: C:\\tmp\\accepted\.png/,
      )
      return true
    })
  })

  it('reports a missing production manifest', async () => {
    const rootDir = await createFixture({ manifest: undefined })

    await assert.rejects(validateStoreBuild({ rootDir }), (error) => {
      assert.match(error.message, /manifest\.json/)
      assert.match(error.message, /could not be read/)
      return true
    })
  })
})
