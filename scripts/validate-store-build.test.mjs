import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'vitest';

import { validateStoreBuild } from './validate-store-build.mjs';

const tempDirectories = [];

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function createFixture({ manifest, version = '1.3.0', files = [] }) {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'cognipace-store-build-'));
  tempDirectories.push(rootDir);
  const buildDir = path.join(rootDir, '.output', 'chrome-mv3');
  await mkdir(buildDir, { recursive: true });
  await writeFile(path.join(rootDir, 'package.json'), JSON.stringify({ version }));
  if (manifest !== undefined) {
    await writeFile(path.join(buildDir, 'manifest.json'), JSON.stringify(manifest));
  }
  await Promise.all(files.map(async (file) => {
    const filePath = path.join(buildDir, file);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, 'icon');
  }));
  return rootDir;
}

const completeIcons = {
  '16': 'icons/16.png',
  '32': 'icons/32.png',
  '48': 'icons/48.png',
  '128': 'icons/128.png',
};

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
    });

    const result = await validateStoreBuild({ rootDir });

    assert.deepEqual(result, {
      iconFiles: Object.values(completeIcons).sort(),
      manifestPath: path.join(rootDir, '.output', 'chrome-mv3', 'manifest.json'),
      version: '1.3.0',
    });
  });

  it('aggregates identity, version, icon-size, and missing-file failures', async () => {
    const rootDir = await createFixture({
      manifest: {
        manifest_version: 2,
        name: 'Wrong Name',
        description: 'Wrong description',
        version: '2.0.0',
        icons: { '16': '/icons/missing.png', '32': '/icons/missing.png', '48': '/icons/missing.png' },
        action: { default_icon: { '16': '/icons/missing.png', '32': '/icons/missing.png', '128': '/icons/missing.png' } },
      },
      files: [],
    });

    await assert.rejects(
      validateStoreBuild({ rootDir }),
      (error) => {
        assert.match(error.message, /^Store build validation failed:/);
        for (const expected of [
          'manifest_version must be 3',
          'name must be exactly "CogniPace"',
          'description must be exactly "Local-first LeetCode review and study pacing."',
          'manifest version 2.0.0 does not match package.json version 1.3.0',
          'manifest.icons is missing required size 128',
          'manifest.action.default_icon is missing required size 48',
          'icon file is missing: icons/missing.png',
        ]) {
          assert.match(error.message, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
        }
        return true;
      },
    );
  });

  it('reports a missing production manifest', async () => {
    const rootDir = await createFixture({ manifest: undefined });

    await assert.rejects(
      validateStoreBuild({ rootDir }),
      (error) => {
        assert.match(error.message, /manifest\.json/);
        assert.match(error.message, /could not be read/);
        return true;
      },
    );
  });
});
