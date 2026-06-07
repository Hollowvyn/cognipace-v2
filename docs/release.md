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
