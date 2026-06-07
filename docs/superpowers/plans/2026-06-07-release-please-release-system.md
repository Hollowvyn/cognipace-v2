# Release Please Release System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a GitHub Actions release system that enforces squash-merge PR title semantics, lets Release Please maintain version/changelog release PRs, and uploads the WXT extension zip to each GitHub Release.

**Architecture:** Keep release automation outside product runtime code. GitHub Actions own validation, PR-title enforcement, release PR generation, and artifact upload; release-please config owns semver/changelog behavior; docs own maintainer handoff and first-release bootstrap rules.

**Tech Stack:** GitHub Actions, `googleapis/release-please-action@v4`, `amannn/action-semantic-pull-request@v6`, Node 24, npm, WXT.

---

## File Structure

- Create `.github/workflows/ci.yml`: standard CI validation for pull requests and pushes to `main`.
- Create `.github/workflows/pr-title.yml`: Conventional Commit PR title enforcement for squash-merge release semantics.
- Create `.github/workflows/release-please.yml`: release PR maintenance, GitHub Release creation, WXT zip build, and artifact upload.
- Create `release-please-config.json`: Release Please manifest configuration for the root Node package.
- Create `.release-please-manifest.json`: current known release version manifest.
- Create `CHANGELOG.md`: release-please-managed changelog file.
- Create `docs/release.md`: maintainer release workflow, semantic title rules,
  `RELEASE_PLEASE_TOKEN` setup, first `1.0.0` bootstrap, failure handling,
  Chrome Web Store handoff.
- Modify `CONTRIBUTING.md`: add PR title and release workflow expectations.

## Task 1: Add Standard CI Workflow

**Files:**

- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create CI workflow**

Create `.github/workflows/ci.yml` with this exact content:

```yaml
name: CI

on:
  pull_request:
  push:
    branches:
      - main

permissions:
  contents: read

jobs:
  check:
    name: Check
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Run checks
        run: npm run check
```

- [ ] **Step 2: Format CI workflow**

Run:

```bash
npx prettier --check .github/workflows/ci.yml
```

Expected: PASS with `All matched files use Prettier code style!` or equivalent
Prettier success output.

- [ ] **Step 3: Commit CI workflow**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add standard validation workflow"
```

## Task 2: Add PR Title Lint Workflow

**Files:**

- Create: `.github/workflows/pr-title.yml`

- [ ] **Step 1: Create PR title lint workflow**

Create `.github/workflows/pr-title.yml` with this exact content:

```yaml
name: PR Title

on:
  pull_request_target:
    types:
      - opened
      - reopened
      - edited
      - synchronize

permissions:
  pull-requests: read

jobs:
  validate:
    name: Validate PR title
    runs-on: ubuntu-latest

    steps:
      - name: Validate semantic title
        uses: amannn/action-semantic-pull-request@v6
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          types: |
            feat
            fix
            deps
            chore
            test
            ci
            build
            style
            docs
            perf
            refactor
```

- [ ] **Step 2: Format PR title workflow**

Run:

```bash
npx prettier --check .github/workflows/pr-title.yml
```

Expected: PASS with Prettier success output.

- [ ] **Step 3: Commit PR title workflow**

```bash
git add .github/workflows/pr-title.yml
git commit -m "ci: enforce semantic pull request titles"
```

## Task 3: Add Release Please Configuration

**Files:**

- Create: `release-please-config.json`
- Create: `.release-please-manifest.json`
- Create: `CHANGELOG.md`

- [ ] **Step 1: Create Release Please config**

Create `release-please-config.json` with this exact content:

```json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "include-component-in-tag": false,
  "packages": {
    ".": {
      "release-type": "node",
      "changelog-path": "CHANGELOG.md"
    }
  }
}
```

- [ ] **Step 2: Create Release Please manifest**

Create `.release-please-manifest.json` with this exact content:

```json
{
  ".": "0.0.0"
}
```

- [ ] **Step 3: Create initial changelog**

Create `CHANGELOG.md` with this exact content:

```markdown
# Changelog

Release notes are maintained by Release Please from Conventional Commit squash
commits.
```

- [ ] **Step 4: Format Release Please files**

Run:

```bash
npx prettier --check release-please-config.json .release-please-manifest.json CHANGELOG.md
```

Expected: PASS with Prettier success output.

- [ ] **Step 5: Commit Release Please config**

```bash
git add release-please-config.json .release-please-manifest.json CHANGELOG.md
git commit -m "ci(release): configure release-please"
```

## Task 4: Add Release Please Workflow With Extension Artifact Upload

**Files:**

- Create: `.github/workflows/release-please.yml`

- [ ] **Step 1: Create release workflow**

Create `.github/workflows/release-please.yml` with this exact content:

```yaml
name: Release Please

on:
  push:
    branches:
      - main

permissions:
  contents: write
  pull-requests: write
  issues: write

jobs:
  release:
    name: Release
    runs-on: ubuntu-latest

    steps:
      - name: Run Release Please
        id: release
        uses: googleapis/release-please-action@v4
        with:
          token: ${{ secrets.RELEASE_PLEASE_TOKEN }}
          config-file: release-please-config.json
          manifest-file: .release-please-manifest.json

      - name: Checkout release tag
        if: ${{ steps.release.outputs.release_created == 'true' }}
        uses: actions/checkout@v4
        with:
          ref: ${{ steps.release.outputs.tag_name }}

      - name: Setup Node
        if: ${{ steps.release.outputs.release_created == 'true' }}
        uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: npm

      - name: Install dependencies
        if: ${{ steps.release.outputs.release_created == 'true' }}
        run: npm ci

      - name: Run checks
        if: ${{ steps.release.outputs.release_created == 'true' }}
        run: npm run check

      - name: Build extension
        if: ${{ steps.release.outputs.release_created == 'true' }}
        run: npm run build

      - name: Zip extension
        if: ${{ steps.release.outputs.release_created == 'true' }}
        run: npm run zip

      - name: Prepare release asset
        if: ${{ steps.release.outputs.release_created == 'true' }}
        id: extension_asset
        shell: bash
        run: |
          zip_path="$(find .output -maxdepth 1 -type f -name '*.zip' | sort | tail -n 1)"
          if [[ -z "$zip_path" ]]; then
            echo "No WXT zip artifact found in .output" >&2
            exit 1
          fi

          asset_name="cognipace-${{ steps.release.outputs.version }}-chrome-mv3.zip"
          cp "$zip_path" "$asset_name"

          echo "path=$asset_name" >> "$GITHUB_OUTPUT"
          echo "name=$asset_name" >> "$GITHUB_OUTPUT"

      - name: Upload extension zip
        if: ${{ steps.release.outputs.release_created == 'true' }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          gh release upload "${{ steps.release.outputs.tag_name }}" \
            "${{ steps.extension_asset.outputs.path }}" \
            --clobber
```

- [ ] **Step 2: Format release workflow**

Run:

```bash
npx prettier --check .github/workflows/release-please.yml
```

Expected: PASS with Prettier success output.

- [ ] **Step 3: Check release workflow for release-created gating**

Run:

```bash
rg -n "release_created == 'true'|gh release upload|npm run zip" .github/workflows/release-please.yml
```

Expected: output includes all three patterns in `.github/workflows/release-please.yml`.

- [ ] **Step 4: Commit release workflow**

```bash
git add .github/workflows/release-please.yml
git commit -m "ci(release): upload extension zip on release"
```

## Task 5: Add Maintainer Release Documentation

**Files:**

- Create: `docs/release.md`

- [ ] **Step 1: Create release documentation**

Create `docs/release.md` with this exact content:

````markdown
# Release

CogniPace releases are managed with Release Please and GitHub Actions. The
Chrome Web Store upload remains manual.

## Pull Request Titles

The repository uses squash merge, so the pull request title becomes the squash
commit that Release Please reads.

Use Conventional Commit titles:

```text
<type>(optional-scope): short summary
```

Release-triggering types:

- `feat`: minor version
- `fix`: patch version
- `deps`: patch version
- any allowed type with `!`: major version

Allowed maintenance types:

- `chore`
- `test`
- `ci`
- `build`
- `style`
- `docs`
- `perf`
- `refactor`

Examples:

```text
feat(sync): add safe Gist conflict recovery
fix(overlay): preserve timer state after LeetCode navigation
fix(docs): clarify local-first data handling
ci(release): upload extension zip to GitHub releases
chore: update dependencies
```

Release Please generally creates release PRs from `feat`, `fix`, `deps`, and
breaking-change commits. If a documentation or maintenance change should ship as
a patch release, use a release-triggering title such as `fix(docs): clarify
local-first data handling`.

## Normal Release Flow

The `Release Please` workflow requires a `RELEASE_PLEASE_TOKEN` repository
secret. Use a fine-grained personal access token or GitHub App token that can
write contents, open pull requests, create GitHub Releases, and update release
PR labels or comments. Do not use the default `GITHUB_TOKEN` for the Release
Please step, because pull requests created with that token do not trigger the
normal pull request workflows.

1. Merge release-triggering pull requests (`feat`, `fix`, `deps`, or breaking
   changes) with semantic titles.
2. Release Please opens or updates a release pull request on `main`.
3. Review the release pull request version and changelog.
4. Merge the release pull request when ready to ship.
5. Release Please creates the semver tag and GitHub Release.
6. The release workflow runs `npm run check`, `npm run build`, and
   `npm run zip`.
7. The release workflow uploads `cognipace-<version>-chrome-mv3.zip` to the
   GitHub Release.
8. Upload that exact GitHub Release zip to the Chrome Web Store developer
   dashboard.

The GitHub Release zip is the official artifact for the version.

## First 1.0.0 Release

Release Please can be forced to propose a specific version with a `Release-As`
footer in the squash commit body:

```text
chore(release): bootstrap 1.0.0

Release-As: 1.0.0
```

Use this once when preparing the first `1.0.0` release if Release Please would
otherwise propose a pre-1.0 version.

## Multiple Release Notes From One Pull Request

If a squash-merged pull request needs multiple changelog entries, add a
Release Please override block to the pull request body before merging:

```text
BEGIN_COMMIT_OVERRIDE
feat: add release artifact upload

fix: correct release handoff documentation
END_COMMIT_OVERRIDE
```

## Failure Handling

- If PR title lint fails, edit the pull request title before merge.
- If CI fails, fix the pull request before merge.
- If the release PR version or changelog is wrong, fix the source commit
  convention or use a documented Release Please override before shipping.
- If release artifact upload fails, do not upload a local zip to the Chrome Web
  Store for that version.
- If Chrome Web Store review rejects the package for code or manifest reasons,
  fix the issue in a follow-up pull request and ship a new release.
````

- [ ] **Step 2: Format release documentation**

Run:

```bash
npx prettier --check docs/release.md
```

Expected: PASS with Prettier success output.

- [ ] **Step 3: Commit release documentation**

```bash
git add docs/release.md
git commit -m "docs(release): document release workflow"
```

## Task 6: Update Contributing Guide

**Files:**

- Modify: `CONTRIBUTING.md`

- [ ] **Step 1: Add release workflow section**

In `CONTRIBUTING.md`, add this section after the `## Working Agreement` list and
before `## Architecture`:

````markdown
## Pull Requests And Releases

CogniPace uses squash merge. Pull request titles must follow Conventional Commit
format because the squash commit title drives Release Please versioning and
changelog generation.

Use this format:

```text
<type>(optional-scope): short summary
```

Release-triggering title types:

- `feat`: minor version
- `fix`: patch version
- `deps`: patch version
- any allowed type with `!`: major version

Allowed maintenance types:

- `chore`
- `test`
- `ci`
- `build`
- `style`
- `docs`
- `perf`
- `refactor`

Examples:

```text
feat(tracks): add active group recovery
fix(sync): prevent dirty local data from auto-pulling
fix(docs): clarify Chrome Web Store release handoff
ci(release): upload extension zip to GitHub releases
```

Release Please maintains the release pull request on `main`. Merging that
release pull request creates the GitHub Release and triggers the extension zip
artifact upload. Chrome Web Store submission remains a manual maintainer step
using the zip attached to the GitHub Release.

The Release Please workflow uses the `RELEASE_PLEASE_TOKEN` repository secret so
generated release pull requests still trigger normal pull request checks.

See `docs/release.md` for the complete release process.
````

- [ ] **Step 2: Format contributing guide**

Run:

```bash
npx prettier --check CONTRIBUTING.md
```

Expected: PASS with Prettier success output.

- [ ] **Step 3: Commit contributing update**

```bash
git add CONTRIBUTING.md
git commit -m "docs(release): add contributing release rules"
```

## Task 7: Final Validation

**Files:**

- Verify: `.github/workflows/ci.yml`
- Verify: `.github/workflows/pr-title.yml`
- Verify: `.github/workflows/release-please.yml`
- Verify: `release-please-config.json`
- Verify: `.release-please-manifest.json`
- Verify: `CHANGELOG.md`
- Verify: `docs/release.md`
- Verify: `CONTRIBUTING.md`

- [ ] **Step 1: Run formatting checks for release-system files**

Run:

```bash
npx prettier --check .github/workflows/ci.yml .github/workflows/pr-title.yml .github/workflows/release-please.yml release-please-config.json .release-please-manifest.json CHANGELOG.md docs/release.md CONTRIBUTING.md
```

Expected: PASS with Prettier success output.

- [ ] **Step 2: Run repository validation**

Run:

```bash
npm run check
```

Expected: PASS. This runs Drizzle checks, WXT preparation, TypeScript, ESLint,
and Vitest.

- [ ] **Step 3: Verify release workflow references required release outputs**

Run:

```bash
rg -n "release_created|tag_name|version|gh release upload|npm run check|npm run build|npm run zip" .github/workflows/release-please.yml
```

Expected: output includes all required release output and artifact commands.

- [ ] **Step 4: Verify docs mention Chrome Web Store manual handoff**

Run:

```bash
rg -n "Chrome Web Store|GitHub Release zip|manual" docs/release.md CONTRIBUTING.md
```

Expected: output includes Chrome Web Store handoff language in `docs/release.md`
and release workflow language in `CONTRIBUTING.md`.

- [ ] **Step 5: Review final diff**

Run:

```bash
git diff --stat HEAD
```

Expected: output lists only release-system workflow, config, changelog, and docs
files.
