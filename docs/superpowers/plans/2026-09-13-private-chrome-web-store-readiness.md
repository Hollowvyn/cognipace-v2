# Private Chrome Web Store Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a Store-ready CogniPace Chrome MV3 release package, accurate private-listing material, and a documented manual publication/update path without changing product behavior or Chrome permissions.

**Architecture:** Keep the existing Release Please workflow as the version and GitHub Release authority. Add one Node-based validation boundary between WXT's production build and ZIP creation, keep extension icons in `public/`, and keep Store-only art under `store-assets/chrome-web-store/`. The first listing and upload remain human-run; a separate later design will automate updates with WXT's built-in `wxt submit` command and Chrome Web Store API v2.

**Tech Stack:** WXT 0.21.3, Chrome Manifest V3, Node.js 24, npm 11, Vitest, GitHub Actions, SVG/PNG assets, Chrome Web Store.

---

**Approved design:** [`docs/superpowers/specs/2026-09-13-private-chrome-web-store-release-design.md`](../specs/2026-09-13-private-chrome-web-store-release-design.md)

## Scope Boundary

This is the repository-readiness and first-manual-publication phase. It does not
add Store credentials or `wxt submit` to CI. After the private item is accepted
and one manual update is understood, write a separate design for WXT-native
submission automation using Chrome Web Store API v2, `wxt submit --dry-run`,
and GitHub Actions secrets.

WXT owns production manifest generation, copying `public/` assets, Chrome ZIP
creation, and the later submission command. Although WXT can autodetect
`public/icon-{size}.png` files and offers `@wxt-dev/auto-icons`, this phase keeps
the four final PNGs in source control and declares both `manifest.icons` and
`action.default_icon` explicitly. That keeps Store-critical bytes reviewable,
avoids adding a one-purpose build dependency, and lets `store:check` verify the
exact manifest contract.

## File Responsibility Map

**Create:**

- `scripts/validate-store-build.mjs` — validate the production Chrome manifest,
  version, icon declarations, and icon files.
- `scripts/validate-store-build.test.mjs` — happy-path and aggregated-failure
  tests for the Store build validator.
- `public/icon-16.png`, `public/icon-32.png`, `public/icon-48.png`, and
  `public/icon-128.png` — packaged extension/action icons.
- `store-assets/chrome-web-store/sources/recall-stack-mark.svg` — editable
  vector source for the approved Recall Stack mark.
- `store-assets/chrome-web-store/sources/promo-small-440x280.svg` — editable
  vector source for the small promotional tile.
- `store-assets/chrome-web-store/promo-small-440x280.png` — Store-uploadable
  promotional tile.
- `store-assets/chrome-web-store/screenshot-popup-1280x800.png` — real popup
  screenshot captured from the production build.
- `store-assets/chrome-web-store/screenshot-overlay-1280x800.png` — real
  LeetCode overlay screenshot captured from the production build.
- `store-assets/chrome-web-store/screenshot-dashboard-1280x800.png` — real
  dashboard screenshot captured from the production build.
- `PRIVACY.md` — public, hosted privacy policy.
- `docs/chrome-web-store.md` — canonical listing copy, disclosures, reviewer
  notes, and maintainer dashboard checklist.

**Modify:**

- `package.json` — expose `npm run store:check`.
- `wxt.config.ts` — declare extension and action icon maps without adding
  permissions.
- `.github/workflows/release-please.yml` — run Store build validation after
  build and before ZIP creation.
- `docs/release.md` — define the private Store handoff and failure path.
- `docs/testing.md` — define first-install, migration, and natural-update smoke
  checks.
- `CONTRIBUTING.md` — summarize the manual private Store release boundary.
- `docs/superpowers/README.md` — index this implementation plan.

### Task 1: Add a test-first Store build validator

**Files:**

- Create: `scripts/validate-store-build.test.mjs`
- Create: `scripts/validate-store-build.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the failing validator tests**

Create `scripts/validate-store-build.test.mjs`:

```js
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { validateStoreBuild } from './validate-store-build.mjs'

const fixtureRoots = []
const iconEntries = {
  16: '/icon-16.png',
  32: '/icon-32.png',
  48: '/icon-48.png',
  128: '/icon-128.png',
}

afterEach(async () => {
  await Promise.all(
    fixtureRoots
      .splice(0)
      .map((rootDir) => rm(rootDir, { force: true, recursive: true })),
  )
})

describe('validateStoreBuild', () => {
  it('accepts the approved MV3 identity, matching version, and complete icons', async () => {
    const rootDir = await createFixture()

    await expect(validateStoreBuild({ rootDir })).resolves.toMatchObject({
      iconFiles: ['icon-128.png', 'icon-16.png', 'icon-32.png', 'icon-48.png'],
      version: '1.3.2',
    })
  })

  it('reports every Store-critical manifest and file failure together', async () => {
    const rootDir = await createFixture({
      mutateManifest(manifest) {
        manifest.description = 'Different description'
        manifest.manifest_version = 2
        manifest.name = 'Different name'
        manifest.version = '1.3.0'
        delete manifest.icons[32]
        delete manifest.action.default_icon[128]
      },
      omitFiles: ['icon-48.png'],
      packageVersion: '1.3.2',
    })

    await expect(validateStoreBuild({ rootDir })).rejects.toThrow(
      [
        'Store build validation failed:',
        '- manifest_version must be 3',
        '- manifest name must be "CogniPace", received "Different name"',
        '- manifest description must be "Local-first LeetCode review and study pacing.", received "Different description"',
        '- manifest version "1.3.0" does not match package.json "1.3.2"',
        '- manifest.icons is missing size 32',
        '- manifest.action.default_icon is missing size 128',
        '- declared icon file does not exist: icon-48.png',
      ].join('\n'),
    )
  })

  it('rejects a missing production manifest', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'cognipace-store-check-'))
    fixtureRoots.push(rootDir)
    await writeFile(
      join(rootDir, 'package.json'),
      JSON.stringify({ version: '1.3.2' }),
    )

    await expect(validateStoreBuild({ rootDir })).rejects.toThrow(
      /could not read production manifest/,
    )
  })
})

async function createFixture({
  mutateManifest = () => {},
  omitFiles = [],
  packageVersion = '1.3.2',
} = {}) {
  const rootDir = await mkdtemp(join(tmpdir(), 'cognipace-store-check-'))
  const outputDir = join(rootDir, 'dist', 'chrome-mv3')
  fixtureRoots.push(rootDir)

  await mkdir(outputDir, { recursive: true })
  await writeFile(
    join(rootDir, 'package.json'),
    JSON.stringify({ version: packageVersion }),
  )

  const manifest = {
    action: { default_icon: { ...iconEntries } },
    description: 'Local-first LeetCode review and study pacing.',
    icons: { ...iconEntries },
    manifest_version: 3,
    name: 'CogniPace',
    version: '1.3.2',
  }
  mutateManifest(manifest)

  await writeFile(join(outputDir, 'manifest.json'), JSON.stringify(manifest))

  for (const iconPath of Object.values(iconEntries)) {
    const fileName = iconPath.replace(/^\/+/, '')
    if (!omitFiles.includes(fileName)) {
      await writeFile(join(outputDir, fileName), 'png fixture')
    }
  }

  await access(join(outputDir, 'manifest.json'))
  return rootDir
}
```

- [ ] **Step 2: Run the focused test and verify the missing module failure**

Run:

```sh
npm run test -- scripts/validate-store-build.test.mjs --run
```

Expected: FAIL because `scripts/validate-store-build.mjs` does not exist.

- [ ] **Step 3: Implement the smallest complete validator**

Create `scripts/validate-store-build.mjs`:

```js
import { access, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

const expectedIdentity = {
  description: 'Local-first LeetCode review and study pacing.',
  name: 'CogniPace',
}
const requiredIconSizes = ['16', '32', '48', '128']

export async function validateStoreBuild({ rootDir = process.cwd() } = {}) {
  const outputDir = resolve(rootDir, 'dist', 'chrome-mv3')
  const manifestPath = resolve(outputDir, 'manifest.json')
  const packagePath = resolve(rootDir, 'package.json')
  const manifest = await readJson(manifestPath, 'production manifest')
  const packageJson = await readJson(packagePath, 'package.json')
  const errors = []
  const declaredIconFiles = new Set()

  if (manifest.manifest_version !== 3) {
    errors.push('manifest_version must be 3')
  }
  if (manifest.name !== expectedIdentity.name) {
    errors.push(
      `manifest name must be "${expectedIdentity.name}", received "${String(manifest.name)}"`,
    )
  }
  if (manifest.description !== expectedIdentity.description) {
    errors.push(
      `manifest description must be "${expectedIdentity.description}", received "${String(manifest.description)}"`,
    )
  }
  if (manifest.version !== packageJson.version) {
    errors.push(
      `manifest version "${String(manifest.version)}" does not match package.json "${String(packageJson.version)}"`,
    )
  }

  validateIconMap('manifest.icons', manifest.icons, declaredIconFiles, errors)
  validateIconMap(
    'manifest.action.default_icon',
    asObject(manifest.action)?.default_icon,
    declaredIconFiles,
    errors,
  )

  const iconFiles = [...declaredIconFiles].sort()
  for (const fileName of iconFiles) {
    try {
      await access(resolve(outputDir, fileName))
    } catch {
      errors.push(`declared icon file does not exist: ${fileName}`)
    }
  }

  if (errors.length > 0) {
    throw new Error(
      [
        'Store build validation failed:',
        ...errors.map((error) => `- ${error}`),
      ].join('\n'),
    )
  }

  return {
    iconFiles,
    manifestPath,
    version: manifest.version,
  }
}

function validateIconMap(label, value, declaredIconFiles, errors) {
  const iconMap = asObject(value)

  for (const size of requiredIconSizes) {
    const iconPath = iconMap?.[size]
    if (typeof iconPath !== 'string' || iconPath.length === 0) {
      errors.push(`${label} is missing size ${size}`)
      continue
    }
    declaredIconFiles.add(iconPath.replace(/^\/+/, ''))
  }
}

function asObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value
    : undefined
}

async function readJson(filePath, label) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'))
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(
      `Store build validation failed:\n- could not read ${label} at ${filePath}: ${detail}`,
    )
  }
}

const invocationUrl = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : null

if (invocationUrl === import.meta.url) {
  validateStoreBuild()
    .then(({ iconFiles, version }) => {
      process.stdout.write(
        `Store build validation passed for CogniPace ${version} with ${iconFiles.length} icon files.\n`,
      )
    })
    .catch((error) => {
      process.stderr.write(
        `${error instanceof Error ? error.message : String(error)}\n`,
      )
      process.exitCode = 1
    })
}
```

- [ ] **Step 4: Run the focused test and verify both cases pass**

Run:

```sh
npm run test -- scripts/validate-store-build.test.mjs --run
```

Expected: PASS with three tests.

- [ ] **Step 5: Expose the validator through npm**

Add this script between `zip` and `prepare:wxt` in `package.json`:

```json
"store:check": "node scripts/validate-store-build.mjs",
```

- [ ] **Step 6: Prove the current icon-less build is rejected**

Run:

```sh
npm run build
npm run store:check
```

Expected: `npm run build` passes, then `npm run store:check` fails with missing
`manifest.icons` and `manifest.action.default_icon` sizes. This is the RED proof
that release `v1.3.0` is not Store-ready.

- [ ] **Step 7: Commit the validator**

```sh
git add package.json scripts/validate-store-build.mjs scripts/validate-store-build.test.mjs
git commit -m "test(release): validate Chrome Web Store builds"
```

### Task 2: Add the Recall Stack extension identity

**Files:**

- Create: `store-assets/chrome-web-store/sources/recall-stack-mark.svg`
- Create: `public/icon-16.png`
- Create: `public/icon-32.png`
- Create: `public/icon-48.png`
- Create: `public/icon-128.png`
- Modify: `wxt.config.ts`

- [ ] **Step 1: Confirm the approved vector direction**

Use the approved Recall Stack direction from the design spec: exactly two
front-facing rounded review cards, light sage active card, forest receding card,
one amber due dot, two dark recall lines, transparent padding, no text, no
LeetCode marks, and no third card. This icon is intentionally authored as
deterministic SVG because it is a simple vector mark that must render identically
at every required Store size.

- [ ] **Step 2: Create the editable vector mark**

Create `store-assets/chrome-web-store/sources/recall-stack-mark.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-labelledby="title">
  <title id="title">CogniPace Recall Stack</title>
  <rect x="156" y="62" width="268" height="304" rx="58" fill="#2D5A43" stroke="#A1D1B4" stroke-width="12"/>
  <rect x="88" y="138" width="268" height="304" rx="58" fill="#A1D1B4" stroke="#063824" stroke-width="12"/>
  <rect x="132" y="218" width="144" height="26" rx="13" fill="#063824"/>
  <rect x="132" y="278" width="106" height="26" rx="13" fill="#063824"/>
  <circle cx="316" cy="184" r="31" fill="#FBBC00" stroke="#063824" stroke-width="10"/>
</svg>
```

- [ ] **Step 3: Render exact PNG sizes**

Run:

```sh
rsvg-convert -w 16 -h 16 store-assets/chrome-web-store/sources/recall-stack-mark.svg -o public/icon-16.png
rsvg-convert -w 32 -h 32 store-assets/chrome-web-store/sources/recall-stack-mark.svg -o public/icon-32.png
rsvg-convert -w 48 -h 48 store-assets/chrome-web-store/sources/recall-stack-mark.svg -o public/icon-48.png
rsvg-convert -w 128 -h 128 store-assets/chrome-web-store/sources/recall-stack-mark.svg -o public/icon-128.png
```

Expected: four transparent PNGs with the requested pixel dimensions.

- [ ] **Step 4: Inspect the rendered sizes and the smallest mark**

Run:

```sh
sips -g pixelWidth -g pixelHeight -g hasAlpha public/icon-16.png public/icon-32.png public/icon-48.png public/icon-128.png
```

Expected: widths and heights of 16, 32, 48, and 128 respectively, with alpha
enabled. Open `public/icon-16.png` and `public/icon-128.png` and confirm the two
cards, two recall lines, and amber dot remain distinguishable.

- [ ] **Step 5: Declare extension and action icons**

Update `wxt.config.ts` to define one shared icon map and use it in both manifest
locations:

```ts
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'wxt'

const extensionIcons = {
  16: '/icon-16.png',
  32: '/icon-32.png',
  48: '/icon-48.png',
  128: '/icon-128.png',
} as const

export default defineConfig({
  srcDir: 'src',
  manifestVersion: 3,
  modules: ['@wxt-dev/module-react'],
  imports: false,
  manifest: {
    name: 'CogniPace',
    description: 'Local-first LeetCode review and study pacing.',
    icons: extensionIcons,
    action: {
      default_icon: extensionIcons,
    },
    permissions: ['storage', 'alarms', 'notifications'],
    host_permissions: [
      'https://leetcode.com/*',
      'https://www.leetcode.com/*',
      'https://api.github.com/*',
      'https://api.openai.com/*',
      'https://api.anthropic.com/*',
      'https://generativelanguage.googleapis.com/*',
    ],
    content_security_policy: {
      extension_pages:
        "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
    },
  },
  vite: () => ({
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  }),
})
```

- [ ] **Step 6: Build and prove the Store validator turns GREEN**

Run:

```sh
npm run build
npm run store:check
```

Expected: both commands pass, ending with:

```text
Store build validation passed for CogniPace 1.3.2 with 4 icon files.
```

- [ ] **Step 7: Inspect the generated manifest**

Run:

```sh
node -e "const m=require('./dist/chrome-mv3/manifest.json'); console.log(JSON.stringify({name:m.name,description:m.description,version:m.version,icons:m.icons,action:m.action},null,2))"
```

Expected: CogniPace identity, current package/main baseline version `1.3.2`, four `icons` entries, four
`action.default_icon` entries, and the WXT-generated popup action retained.

- [ ] **Step 8: Commit the icon identity**

```sh
git add public/icon-16.png public/icon-32.png public/icon-48.png public/icon-128.png store-assets/chrome-web-store/sources/recall-stack-mark.svg wxt.config.ts
git commit -m "feat(brand): add Recall Stack extension icons"
```

### Task 3: Gate the release ZIP on Store validation

**Files:**

- Modify: `.github/workflows/release-please.yml`

- [ ] **Step 1: Confirm the workflow invokes the Store validation gate**

Run:

```sh
rg -n "store:check|Check Store metadata" .github/workflows/release-please.yml
```

Expected: exactly one `Check Store metadata` step and one `npm run store:check`
run are present.

- [ ] **Step 2: Confirm the Store validation gate placement**

Run this read-only inspection:

```sh
rg -n -B 3 -A 3 "Build extension|Check Store metadata|Zip extension|store:check" .github/workflows/release-please.yml
```

Expected: the existing `Check Store metadata` step runs immediately after
`Build extension` and before `Zip extension`. Do not insert a duplicate gate or
modify the workflow in this plan step.

- [ ] **Step 3: Run the exact local artifact path**

Run:

```sh
npm run build
npm run store:check
npm run zip
STORE_VERSION="$(node -p "require('./package.json').version")"
STORE_ZIP="dist/cognipace-v2-${STORE_VERSION}-chrome.zip"
unzip -l "$STORE_ZIP"
unzip -p "$STORE_ZIP" manifest.json
```

Expected: the validator passes, WXT creates
`dist/cognipace-v2-${STORE_VERSION}-chrome.zip`, the ZIP has
`manifest.json` at its root, and all four PNG icons appear in the ZIP.

- [ ] **Step 4: Review workflow permissions and secrets**

Run:

```sh
git diff -- .github/workflows/release-please.yml
```

Expected: the only workflow change is one local validation step. No GitHub
permission, check name, event trigger, or secret changes are present.

- [ ] **Step 5: Commit the release gate**

```sh
git add .github/workflows/release-please.yml
git commit -m "ci(release): gate extension zip on Store metadata"
```

### Task 4: Publish an accurate repository privacy policy

**Files:**

- Create: `PRIVACY.md`

- [ ] **Step 1: Create the policy with current behavior only**

Create `PRIVACY.md` with this content:

```markdown
# CogniPace Privacy Policy

Effective date: September 13, 2026

CogniPace is a local-first Chrome extension for planning and recording
deliberate LeetCode practice. This policy explains what information the
extension handles, why it handles it, and the optional third-party services a
user can choose to connect.

## Summary

- CogniPace does not operate a hosted application backend.
- Core problem, practice, review, track, settings, and analytics data stays in
  the user's Chrome browser profile.
- CogniPace does not contain developer-operated analytics, advertising, or
  tracking.
- CogniPace does not sell personal information.
- GitHub Gist sync and AI assessments are optional and use credentials supplied
  by the user.

## Information CogniPace Handles

### Local study data

CogniPace stores its problem catalog, practice records, review schedules,
recall ratings, study tracks, settings, derived analytics, backup metadata, and
sync status in the extension's local browser storage.

### LeetCode page and submission data

On supported LeetCode problem pages, CogniPace may read the problem URL and
slug, title, difficulty, topic labels, problem statement, editor language,
solution code, submission status, runtime, memory result, passed and total test
counts, failure diagnostics, and timing needed for the user-facing practice and
review workflow. CogniPace does not monitor unrelated websites.

### GitHub Gist sync data

If the user enables GitHub Gist sync, CogniPace stores the user-provided GitHub
token locally, calls GitHub to validate it, reads the associated GitHub login,
and transfers a CogniPace backup envelope to or from a Gist. New Gists created
by CogniPace are private; existing connected Gists may be public or private
under GitHub. Gist content and retention are also governed by the user's
GitHub account and GitHub's policies.

### Optional AI assessment data

If the user enables an AI provider, CogniPace stores the user-provided API key
locally and sends an assessment request directly to the selected provider:
OpenAI, Anthropic, or Google Gemini. Depending on the assessment, that request
may contain the problem slug, title, difficulty, topics, statement, submission
status, language, runtime, memory result, test counts, solution code, failure
diagnostics, timing, prior rating, and session context. The selected provider's
terms and privacy policy govern its processing of that request.

## How Information Is Used

CogniPace uses this information only to provide the extension's study,
practice, review scheduling, backup/restore, optional sync, optional AI
assessment, and user-requested support functions. It is not used for
advertising, credit decisions, lending, or sale to data brokers.

## Storage, Transfer, and Sharing

Core data is processed locally in the browser. Information leaves the browser
only when needed for a user-selected function:

- LeetCode requests support the problem-page and submission workflow.
- GitHub requests validate a user-supplied token and perform optional Gist sync.
- AI-provider requests perform optional assessments using the user's selected
  provider and API key.

CogniPace does not send this information to a CogniPace-operated server. It does
not share information with independent advertisers or analytics providers.

Raw GitHub tokens and AI-provider API keys are kept in local extension storage.
They are excluded from CogniPace backup files, Gist sync envelopes, logs, and
user-interface status payloads.

## Retention and Deletion

Local information remains in the browser profile until the user changes or
clears it, restores another backup, removes the extension and its associated
browser data, or the browser removes that data.

The Settings page provides backup export, backup restore, and local-data clear
controls. Because backups intentionally exclude credentials, GitHub and
AI-provider secrets must be re-entered after moving to another extension
installation.

Deleting local data does not delete information already sent to an optional
third-party service. Users must manage or delete connected Gists through
GitHub and manage provider-side assessment data through the selected AI
provider.

## Security

CogniPace limits its Chrome permissions and remote hosts to the functions
described above and does not load remote executable code. No storage or
transmission method can guarantee absolute security, so users should protect
their browser profile and revoke a GitHub token or AI-provider key if they
believe it has been exposed.

## Changes to This Policy

Material changes to CogniPace data handling will be reflected in this policy
and in the Chrome Web Store privacy disclosures before the changed behavior is
released.

## Contact

For privacy questions or support, open an issue at
https://github.com/Hollowvyn/cognipace-v2/issues.
```

- [ ] **Step 2: Cross-check every external transfer against the manifest**

Run:

```sh
rg -n "leetcode|github|openai|anthropic|generativelanguage" wxt.config.ts PRIVACY.md
```

Expected: each declared host family has a matching explanation in the policy.
No undeclared CogniPace backend, telemetry, advertising, or credential backup
appears in the policy.

- [ ] **Step 3: Format and commit the policy**

Run:

```sh
npx prettier --check PRIVACY.md
git add PRIVACY.md
git commit -m "docs(privacy): publish extension data policy"
```

Expected: Prettier passes before the commit.

### Task 5: Create the Store listing and reviewer source of truth

**Files:**

- Create: `docs/chrome-web-store.md`

- [ ] **Step 1: Create the complete listing document**

Create `docs/chrome-web-store.md`:

```markdown
# Chrome Web Store

This document is the maintainer source of truth for the CogniPace Chrome Web
Store listing. The first Store item is Private and limited to trusted testers.

## Listing

**Name:** CogniPace

**Category:** Productivity

**Language:** English

**Short description:** Local-first LeetCode review and study pacing.

**Single purpose:** Help users plan and record deliberate LeetCode review with
local spaced-repetition and study-track guidance.

**Detailed description:**

CogniPace turns LeetCode practice into a deliberate recall loop.

Use the compact popup to see what is due and what to study next. Capture
problem and submission context from supported LeetCode problem pages, record
recall ratings, organize ordered study tracks, and review progress in the
dashboard.

Core study data stays in the local Chrome profile. Backup export and restore are
built in. Users may optionally connect GitHub Gist sync. New Gists created by
CogniPace are private; existing connected Gists may be public or private under
GitHub. Users may also optionally configure their own OpenAI, Anthropic, or
Google Gemini API key for AI-assisted assessment.

CogniPace has no developer-operated analytics, advertising, hosted account, or
hosted application backend.

CogniPace is independently developed and is not affiliated with or endorsed by
LeetCode.

**Support URL:** https://github.com/Hollowvyn/cognipace-v2/issues

**Privacy-policy URL:**
https://github.com/Hollowvyn/cognipace-v2/blob/main/PRIVACY.md

## Permission Justifications

### storage

Stores the local database snapshot, study settings, review schedules, track
state, sync metadata, and user-supplied GitHub or AI-provider credentials in
the extension's Chrome profile.

### alarms

Schedules enabled due-review reminders and safe background GitHub Gist sync
work. The extension does not use alarms for tracking or advertising.

### notifications

Shows local due-review reminders when the user enables reminders. It does not
send marketing notifications.

### https://leetcode.com/_ and https://www.leetcode.com/_

Runs the problem-page overlay and reads the active problem and submission
context required by the user-facing capture and review workflow. The extension
does not monitor unrelated sites.

### https://api.github.com/*

Validates a user-provided GitHub token and performs optional Gist backup/sync
actions initiated or enabled by the user.

### https://api.openai.com/*

Sends optional assessment requests to OpenAI only after the user enables the
feature and supplies an OpenAI API key.

### https://api.anthropic.com/*

Sends optional assessment requests to Anthropic only after the user enables the
feature and supplies an Anthropic API key.

### https://generativelanguage.googleapis.com/*

Sends optional assessment requests to Google Gemini only after the user enables
the feature and supplies a Gemini API key.

## Remote Code

**Uses remote code:** No.

CogniPace calls the APIs listed above but does not download or execute remote
JavaScript or WebAssembly. Executable extension code is packaged in the
submitted ZIP.

## Privacy Practices

Declare the following handled data categories, including information processed
locally:

- **Personally identifiable information:** the GitHub login returned when an
  optional user-provided token is validated.
- **Authentication information:** optional GitHub tokens and AI-provider API
  keys supplied by the user.
- **Web history:** supported LeetCode problem URLs and slugs that the user saves
  or practices with CogniPace.
- **User activity:** problem-page navigation, submission outcomes, recall
  ratings, practice timing, and review actions needed for the study workflow.
- **Website content:** LeetCode problem statements, metadata, submission
  diagnostics, and solution code used by capture or optional AI assessment.

Certify that the data is used only for the extension's single purpose and its
user-facing backup, sync, and assessment features. Do not select advertising,
data sale, creditworthiness, or unrelated profiling purposes.

The extension does not transmit data to a CogniPace-operated server. Optional
transfers go directly to GitHub or the AI provider selected by the user, as
described in `PRIVACY.md`.

## Reviewer Instructions

1. Install the submitted private item with the reviewer account.
2. Open the extension popup. The starter catalog loads locally without an
   account, GitHub token, or AI-provider key.
3. Use the popup CogniPace heading or Settings control to open the dashboard.
4. In the dashboard, verify Overview, Library, Tracks, Analytics, and Settings
   load from local extension data.
5. Open https://leetcode.com/problems/two-sum/ while signed into any LeetCode
   account that can access the problem. Verify the CogniPace overlay appears and
   can start a local practice session.
6. GitHub Gist sync is optional. Testing it requires a reviewer-supplied GitHub
   token with Gist access; no developer account is required.
7. AI assessment is optional. Testing it requires a reviewer-supplied API key
   for OpenAI, Anthropic, or Google Gemini; no developer key is bundled.
8. The hidden `/dev/smoke` dashboard route is for development validation and is
   not required for the primary user flow.

## Private Distribution

1. In the Chrome Web Store developer dashboard, create the item and upload the
   official CogniPace ZIP from the GitHub Release.
2. Complete Listing and Privacy fields using this document and `PRIVACY.md`.
3. Set Distribution visibility to **Private**.
4. Add the approved trusted-tester Google accounts or Google Group.
5. Leave distribution regions at the maintainer-approved defaults unless a
   specific restriction is required.
6. Submit the item for review.
7. Do not switch the item to Unlisted or Public without a separately approved
   release decision.

## First Store Installation

An unpacked development copy normally has a different extension ID and separate
local storage.

1. Export a backup from the unpacked copy if its local data matters.
2. Disable the unpacked copy so two content scripts do not render on the same
   LeetCode page.
3. Install the private Store item using an approved tester account.
4. Restore the backup into the Store copy when desired.
5. Re-enter the GitHub token and AI-provider keys because backups exclude
   credentials.

## Manual Update

1. Merge normal release-triggering work and review the Release Please pull
   request.
2. Merge the Release Please pull request.
3. Confirm the GitHub Release contains
   `cognipace-{version}-chrome-mv3.zip`.
4. Upload that exact asset as the Store item's new package.
5. Submit the new version for review and publish it after approval.
6. Do not rebuild or substitute a local ZIP.

## Failure and Rollback

- If repository validation, ZIP creation, or GitHub asset upload fails, do not
  submit that version.
- If Store review rejects the version, fix the cause through a normal pull
  request and release a higher version. Do not mutate the tagged asset.
- If a release requests new permissions, stop publication until the permission
  change and Store disclosures receive explicit human approval.
- If a tester cannot install the private item, verify the signed-in Google
  account and trusted-tester or Google Group membership before changing code.
- The Store cannot roll an item back to a lower version. Recover by releasing a
  higher patch version that restores the last known-good behavior.

## Deferred WXT Submission Automation

After the first private publication and a later manual update succeed, design a
separate automation phase around WXT's built-in Chrome Web Store support:

1. Keep the existing Store item and visibility.
2. Use Chrome Web Store API v2 with a publisher-linked service account.
3. Store `CHROME_EXTENSION_ID`, `CHROME_PUBLISHER_ID`,
   `CHROME_SERVICE_ACCOUNT_CLIENT_EMAIL`, and
   `CHROME_SERVICE_ACCOUNT_PRIVATE_KEY` in GitHub Actions secrets.
4. Validate authentication with `wxt submit --dry-run`.
5. Submit the already validated release ZIP with `wxt submit --chrome-zip`
   followed by the exact downloaded GitHub Release asset path.
6. Use `DEFAULT_PUBLISH` only when updates should publish automatically after
   review approval; use `STAGED_PUBLISH` when a maintainer must release an
   approved version manually.
7. Do not commit `.env.submit` or create a custom Store API client unless an
   evidenced WXT limitation requires one.
```

- [ ] **Step 2: Check listing identity and every permission against source**

Run:

```sh
rg -n "name:|description:|permissions:|host_permissions:" wxt.config.ts
rg -n "^### |^## Remote Code|^## Privacy Practices" docs/chrome-web-store.md
```

Expected: every current permission and host permission appears once with a
specific justification, and the name/short description match `wxt.config.ts`.

- [ ] **Step 3: Check privacy consistency**

Run:

```sh
rg -n "hosted|telemetry|advertis|sell|GitHub|OpenAI|Anthropic|Gemini|credential" PRIVACY.md docs/chrome-web-store.md
```

Expected: the listing and policy agree that core data is local, optional
transfers are user-enabled, credentials are excluded from backups, and there is
no developer-operated backend, telemetry, advertising, or data sale.

- [ ] **Step 4: Format and commit the Store copy**

Run:

```sh
npx prettier --check docs/chrome-web-store.md
git add docs/chrome-web-store.md
git commit -m "docs(store): add private listing and reviewer copy"
```

Expected: Prettier passes before the commit.

### Task 6: Create Store promotional and screenshot assets

**Files:**

- Create: `store-assets/chrome-web-store/sources/promo-small-440x280.svg`
- Create: `store-assets/chrome-web-store/promo-small-440x280.png`
- Create: `store-assets/chrome-web-store/screenshot-popup-1280x800.png`
- Create: `store-assets/chrome-web-store/screenshot-overlay-1280x800.png`
- Create: `store-assets/chrome-web-store/screenshot-dashboard-1280x800.png`

- [ ] **Step 1: Create the editable promotional tile**

Create `store-assets/chrome-web-store/sources/promo-small-440x280.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="440" height="280" viewBox="0 0 440 280" role="img" aria-labelledby="title description">
  <title id="title">CogniPace</title>
  <desc id="description">Recall Stack mark with the words Build durable recall.</desc>
  <rect width="440" height="280" fill="#101414"/>
  <circle cx="78" cy="42" r="92" fill="#18231F"/>
  <circle cx="410" cy="250" r="126" fill="#18231F"/>
  <rect x="76" y="52" width="128" height="150" rx="28" fill="#2D5A43" stroke="#A1D1B4" stroke-width="6"/>
  <rect x="42" y="88" width="128" height="150" rx="28" fill="#A1D1B4" stroke="#063824" stroke-width="6"/>
  <rect x="63" y="127" width="70" height="12" rx="6" fill="#063824"/>
  <rect x="63" y="158" width="52" height="12" rx="6" fill="#063824"/>
  <circle cx="151" cy="111" r="15" fill="#FBBC00" stroke="#063824" stroke-width="5"/>
  <text x="226" y="112" fill="#DFE3E2" font-family="Nunito Sans, Arial, sans-serif" font-size="30" font-weight="800">CogniPace</text>
  <text x="226" y="151" fill="#A1D1B4" font-family="Nunito Sans, Arial, sans-serif" font-size="18" font-weight="700">Build durable recall.</text>
  <rect x="226" y="174" width="126" height="4" rx="2" fill="#FBBC00"/>
</svg>
```

- [ ] **Step 2: Render and verify the 440×280 PNG**

Run:

```sh
rsvg-convert -w 440 -h 280 store-assets/chrome-web-store/sources/promo-small-440x280.svg -o store-assets/chrome-web-store/promo-small-440x280.png
sips -g pixelWidth -g pixelHeight store-assets/chrome-web-store/promo-small-440x280.png
```

Expected: width 440 and height 280. Inspect the PNG at 100% and confirm the
mark is not clipped, text is legible, and no LeetCode logo or endorsement claim
appears.

- [ ] **Step 3: Prepare a clean production screenshot profile**

Run:

```sh
npm run build
STORE_PROFILE_DIR="$(mktemp -d /tmp/cognipace-store-profile.XXXXXX)"
echo "$STORE_PROFILE_DIR"
open -na "Google Chrome" --args --user-data-dir="$STORE_PROFILE_DIR" --load-extension="$PWD/dist/chrome-mv3"
```

Expected: the command prints an isolated temporary profile directory and opens
Chrome with the production extension. Do not use a personal Chrome profile. Do
not enter GitHub or AI-provider credentials.

- [ ] **Step 4: Capture the actual popup**

In the clean profile:

1. Let the built-in local starter catalog finish loading.
2. Open a public LeetCode Two Sum problem page.
3. Open the CogniPace toolbar popup.
4. Capture the 1280×800 Chrome window with the popup visible.
5. Save the image as
   `store-assets/chrome-web-store/screenshot-popup-1280x800.png`.

Expected: the real popup is readable, the page contains no personal account
information, and no browser profile avatar, token, API key, private note, or
Gist identifier is visible.

- [ ] **Step 5: Capture the actual LeetCode overlay**

In the same clean profile:

1. Keep the public Two Sum problem open.
2. Open the CogniPace overlay and start a local practice session.
3. Keep solution code, account identity, and submission history out of frame.
4. Set the captured viewport to 1280×800.
5. Save it as
   `store-assets/chrome-web-store/screenshot-overlay-1280x800.png`.

Expected: the overlay is the production UI, its boundaries are visible, and
the composition does not imply LeetCode endorsement.

- [ ] **Step 6: Capture the actual dashboard**

In the same clean profile:

1. Open the CogniPace dashboard from the popup heading.
2. Use the Overview page with only the built-in local starter data.
3. Set the viewport to 1280×800.
4. Save it as
   `store-assets/chrome-web-store/screenshot-dashboard-1280x800.png`.

Expected: the production navigation and overview are visible with no secrets or
personally identifying data.

- [ ] **Step 7: Verify all Store image dimensions**

Run:

```sh
sips -g pixelWidth -g pixelHeight store-assets/chrome-web-store/promo-small-440x280.png store-assets/chrome-web-store/screenshot-popup-1280x800.png store-assets/chrome-web-store/screenshot-overlay-1280x800.png store-assets/chrome-web-store/screenshot-dashboard-1280x800.png
```

Expected: the promotional tile is 440×280 and all three screenshots are
1280×800. Open every file at original size and perform a second secret/identity
inspection before committing.

- [ ] **Step 8: Commit the Store imagery**

```sh
git add store-assets/chrome-web-store
git commit -m "feat(store): add Recall Stack listing assets"
```

### Task 7: Align release, testing, and contribution documentation

**Files:**

- Modify: `docs/release.md`
- Modify: `docs/testing.md`
- Modify: `CONTRIBUTING.md`
- Modify: `docs/superpowers/README.md`

- [ ] **Step 1: Update the automated release steps**

In `docs/release.md`, replace steps 8 through 10 of **Normal Release Flow**
with:

```markdown
8. The release workflow runs `npm run check`, `npm run build`,
   `npm run store:check`, and `npm run zip`.
9. The release workflow uploads
   `cognipace-{version}-chrome-mv3.zip` to the GitHub Release.
10. For a Store release, upload that exact GitHub Release ZIP to the existing
    private Chrome Web Store item and submit the version for review.
```

- [ ] **Step 2: Add the private Store handoff**

Insert this section in `docs/release.md` before **Failure Handling**:

```markdown
## Private Chrome Web Store Handoff

The historical `v1.3.0` release proved the GitHub packaging path but does not
contain declared PNG extension icons. The first private Store submission must
use a release newer than `v1.3.2`.

Before opening the Store dashboard:

1. Confirm `npm run check`, `npm run build`,
   `npm run store:check`, and `npm run zip` passed for the release.
2. Confirm the GitHub Release contains the named CogniPace ZIP.
3. Confirm `PRIVACY.md` is available from the public `main` branch.
4. Confirm the Store listing, permission explanations, privacy selections, and
   reviewer instructions match `docs/chrome-web-store.md`.
5. Confirm the 440×280 promotional tile and three 1280×800 screenshots contain
   no secrets or personal account data.

For the first publication, create the listing manually, set visibility to
Private, add the approved trusted-tester accounts or Google Group, upload the
exact GitHub Release ZIP, and submit it for review.

For each manual update, upload the next exact GitHub Release ZIP to the same
Store item. Keeping the Store item preserves the extension ID and allows Chrome
to deliver published higher versions to existing tester installations.

WXT submission automation is intentionally deferred. After the first private
publication and a later manual update succeed, design the CI path around
`wxt submit`, Chrome Web Store API v2, a publisher-linked service account,
and `wxt submit --dry-run`. Do not commit `.env.submit`.
```

- [ ] **Step 3: Extend release failure handling**

Append these bullets to **Failure Handling** in `docs/release.md`:

```markdown
- If `npm run store:check` fails, do not run the Store handoff for that
  release.
- If the Store rejects listing, privacy, permission, or reviewer information,
  update the repository source of truth and submit a higher release when code
  or manifest changes are required.
- Do not upload `v1.3.0` to the Store because it lacks the approved PNG
  icon declarations.
- The Store cannot install a lower version over a published higher version.
  Recover by releasing a higher patch version with the last known-good behavior.
```

- [ ] **Step 4: Add Store-specific smoke testing**

Insert this section in `docs/testing.md` before **Current Incomplete
Surfaces**:

```markdown
## Private Chrome Web Store Release

### Pre-Merge Production Package

1. Run `npm run check`, `npm run build`,
   `npm run store:check`, and `npm run zip`.
2. Load `dist/chrome-mv3` unpacked in a clean Chrome profile.
3. Happy path: verify the popup loads, the dashboard opens, the starter catalog
   is available, and the overlay appears on a supported LeetCode problem page.
4. Edge path: keep GitHub Gist sync and AI assessment unconfigured and verify
   the local core workflow remains usable without either optional integration.
5. Verify due-reminder and optional integration flows that are relevant to the
   release using the existing smoke sections in this document.
6. Attach screenshot or screen-recording proof for the happy path and edge path
   before PR review or merge.

### First Store Installation

1. Export a backup from the unpacked CogniPace copy if its local data matters.
2. Disable the unpacked copy before installing the Store copy.
3. Install the private item while signed into an approved trusted-tester Google
   account.
4. Verify the popup, dashboard, and LeetCode overlay happy path.
5. Edge path: verify the Store copy starts with separate local storage rather
   than silently reading the unpacked copy's database.
6. Restore the exported backup when desired and verify representative problems,
   practice records, review state, and tracks.
7. Verify GitHub and AI-provider secrets were not restored, then re-enter them
   only if those optional integrations are being tested.

### Natural Store Update

1. Record the installed Store version from `chrome://extensions`.
2. Upload and publish a legitimate higher release through the same private
   Store item.
3. Leave the Store copy installed and do not load the new release unpacked.
4. After Chrome performs its normal extension update checks, verify the higher
   version appears in `chrome://extensions` without reinstalling CogniPace.
5. Happy path: verify existing local study data remains available after the
   update.
6. Edge path: verify credentials remain local and existing schema migrations do
   not clear or duplicate study data.
7. Record the before/after versions and attach screenshot or screen-recording
   proof.
```

- [ ] **Step 5: Clarify the contribution boundary**

Replace the final Chrome Web Store sentence in **Pull Requests And Releases** in
`CONTRIBUTING.md` with:

```markdown
Chrome Web Store submission remains a manual maintainer step using the exact ZIP
attached to the GitHub Release. The first item is Private for approved trusted
testers. Store-facing copy, privacy disclosures, assets, reviewer instructions,
and the manual handoff are maintained in `docs/chrome-web-store.md` and
`docs/release.md`. WXT-native submission automation is a later phase after
the manual publication and update path is proven.
```

- [ ] **Step 6: Verify this plan remains indexed**

Confirm this remains the first bullet under **Plans** in
`docs/superpowers/README.md`:

```markdown
- [`plans/2026-09-13-private-chrome-web-store-readiness.md`](./plans/2026-09-13-private-chrome-web-store-readiness.md): test-first implementation plan for Recall Stack extension icons, Store package validation, private listing/privacy material, real product screenshots, manual first publication, and natural update proof, with WXT-native submission automation deferred until the manual path succeeds.
```

- [ ] **Step 7: Format and inspect the documentation changes**

Run:

```sh
npx prettier --check PRIVACY.md CONTRIBUTING.md docs/chrome-web-store.md docs/release.md docs/testing.md docs/superpowers/README.md
git diff --check
```

Expected: both commands pass.

- [ ] **Step 8: Commit the aligned release documentation**

```sh
git add CONTRIBUTING.md docs/release.md docs/testing.md docs/superpowers/README.md
git commit -m "docs(release): document private Store handoff"
```

### Task 8: Run full repository and artifact verification

**Files:**

- Verify all files changed by Tasks 1 through 7.

- [ ] **Step 1: Run the focused validator tests**

Run:

```sh
npm run test -- scripts/validate-store-build.test.mjs --run
```

Expected: PASS with the valid-build, aggregated-failure, and missing-manifest
cases.

- [ ] **Step 2: Run repository formatting and code validation**

Run:

```sh
npm run format
npm run lint
npm run check
```

Expected: all commands pass. `npm run check` includes the database check,
TypeScript check, ESLint, and complete Vitest suite.

- [ ] **Step 3: Build, validate, and package the production extension**

Run:

```sh
npm run build
npm run store:check
npm run zip
```

Expected: all commands pass and WXT creates
`dist/cognipace-v2-{version}-chrome.zip`.

- [ ] **Step 4: Inspect the manifest and ZIP**

Run:

```sh
STORE_VERSION="$(node -p "require('./package.json').version")"
STORE_ZIP="dist/cognipace-v2-${STORE_VERSION}-chrome.zip"
node -e "const m=require('./dist/chrome-mv3/manifest.json'); const p=require('./package.json'); if(m.version!==p.version) throw new Error('version mismatch'); console.log(JSON.stringify({manifest_version:m.manifest_version,name:m.name,description:m.description,version:m.version,permissions:m.permissions,host_permissions:m.host_permissions,icons:m.icons,action:m.action},null,2))"
unzip -t "$STORE_ZIP"
unzip -l "$STORE_ZIP"
shasum -a 256 "$STORE_ZIP"
```

Expected:

- manifest version 3
- name and description match the approved listing
- package and manifest versions match
- existing permissions and host permissions are unchanged
- four extension and action icon declarations are present
- the ZIP integrity test passes
- `manifest.json` and all four icon PNGs are at the ZIP root
- `store-assets/` and its listing-only images are absent from the extension ZIP
- a SHA-256 digest is printed for the handoff record

- [ ] **Step 5: Recheck all image dimensions**

Run:

```sh
sips -g pixelWidth -g pixelHeight -g hasAlpha public/icon-16.png public/icon-32.png public/icon-48.png public/icon-128.png
sips -g pixelWidth -g pixelHeight store-assets/chrome-web-store/promo-small-440x280.png store-assets/chrome-web-store/screenshot-popup-1280x800.png store-assets/chrome-web-store/screenshot-overlay-1280x800.png store-assets/chrome-web-store/screenshot-dashboard-1280x800.png
```

Expected: icon dimensions are 16, 32, 48, and 128; the tile is 440×280; each
screenshot is 1280×800.

- [ ] **Step 6: Review the final diff and permission boundary**

Run:

```sh
git diff --check origin/main...HEAD
git diff --stat origin/main...HEAD
git diff origin/main...HEAD -- wxt.config.ts .github/workflows/release-please.yml package.json
git status --short --branch
```

Expected: no whitespace errors, no Chrome permission additions, no Store or
Google credentials, no `.env.submit`, and no unrelated user changes.

- [ ] **Step 7: Prepare the PR-ready handoff**

Use this release-triggering PR title:

```text
fix(release): prepare private Chrome Web Store distribution
```

The PR body must name:

- the Recall Stack icon and Store assets
- the Store build validator and release-workflow gate
- the privacy/listing/reviewer documentation
- every exact automated command run
- any skipped command or human flow with its reason
- remaining risk in GitHub Actions execution and Store review
- human-run popup, dashboard, overlay, first-install, and edge-path smoke
- attached screenshot or screen-recording proof
- release impact: expected patch release higher than the current main baseline
  `v1.3.2`
- rollback: revert before release, or ship a higher corrective patch after a
  Store version is published
- no issue, with the reason that this work continues the explicitly requested
  private Store release preparation

### Task 9: Complete the first private Store publication

**Files:**

- Read: `docs/chrome-web-store.md`
- Read: `docs/release.md`
- Use: `store-assets/chrome-web-store/*`
- Use: the official GitHub Release ZIP

This task is human-run because it changes publisher account state, accepts Store
attestations, and selects trusted testers.

- [ ] **Step 1: Merge and create a Store-ready release**

Merge the approved PR with the exact title:

```text
fix(release): prepare private Chrome Web Store distribution
```

Review and merge the resulting Release Please patch-release PR. The resulting
version must be greater than the current main baseline `1.3.2`. Use the actual
higher release version throughout the remaining steps; do not assume a
specific next version.

- [ ] **Step 2: Verify the official GitHub Release asset**

From the new GitHub Release:

1. Confirm the release tag and ZIP filename use the same version.
2. Download `cognipace-{version}-chrome-mv3.zip` for the released version.
3. Confirm the release workflow passed `npm run store:check`.
4. Inspect the downloaded ZIP rather than using GitHub's generated source
   archives.
5. If another release version was created, use its exact
   `cognipace-{version}-chrome-mv3.zip` asset consistently.

- [ ] **Step 3: Create and complete the private listing**

In the Chrome Web Store developer dashboard:

1. Create a new item.
2. Upload the exact downloaded GitHub Release ZIP.
3. Copy the name, descriptions, category, support URL, privacy-policy URL,
   permission explanations, remote-code answer, and reviewer instructions from
   `docs/chrome-web-store.md`.
4. Upload `promo-small-440x280.png` and the three 1280×800 screenshots.
5. Complete the Privacy practices selections exactly as recorded in
   `docs/chrome-web-store.md`.
6. Set visibility to **Private**.
7. Add only the approved trusted-tester Google accounts or Google Group.
8. Re-read every certification before submitting it.
9. Submit the item for review.

Expected: the dashboard accepts the package and shows the private item in review
or approved/published state. Do not switch it to Unlisted or Public.

- [ ] **Step 4: Verify first installation and migration behavior**

After approval:

1. Export any important backup from the unpacked development copy.
2. Disable the unpacked copy.
3. Open the private listing while signed into an approved tester account.
4. Install CogniPace and verify the installed version in
   `chrome://extensions`.
5. Run the popup, dashboard, and LeetCode overlay happy path.
6. Verify the clean Store copy does not silently inherit the unpacked copy's
   local database.
7. Restore the backup when desired and verify representative study data.
8. Confirm GitHub and AI-provider credentials were not restored.
9. Attach happy-path and edge-path screenshot or recording proof to the PR or
   release record.

### Task 10: Prove a natural Store update before adding automation

**Files:**

- Read: `docs/chrome-web-store.md`
- Read: `docs/testing.md`
- Use: the next legitimate official GitHub Release ZIP

- [ ] **Step 1: Record the existing Store installation**

Before publishing the next legitimate release, record the installed version
shown in `chrome://extensions` and confirm the extension was installed from
the private Store item rather than loaded unpacked.

- [ ] **Step 2: Upload the next legitimate release manually**

Upload the next higher `cognipace-{version}-chrome-mv3.zip` from its GitHub
Release to the same Store item, submit it for review, and publish it after
approval. Do not create a second Store item and do not reinstall the extension.

- [ ] **Step 3: Observe the natural update**

Leave the private Store copy installed. After Chrome performs its normal update
checks, verify:

- `chrome://extensions` shows the newly published higher version
- existing local study data remains available
- the popup, dashboard, and overlay still work
- locally stored optional credentials remain configured
- no duplicate content script or second extension item appears

Record the before/after versions and attach screenshot or screen-recording
proof.

- [ ] **Step 4: Open the WXT automation design only after proof**

Once Task 10 Step 3 succeeds, start a separate design for:

- Chrome Web Store API v2
- a publisher-linked service account
- GitHub Actions secrets
- `wxt submit --dry-run`
- submitting the already validated GitHub Release ZIP
- choosing `DEFAULT_PUBLISH` versus `STAGED_PUBLISH`
- failure handling for pending review, rejected upload, and Store/API outage

Do not add a custom Chrome Web Store API client unless a verified limitation in
WXT's built-in submission path requires it.
