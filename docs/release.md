# Release

CogniPace releases are managed with Release Please and GitHub Actions. The
Chrome Web Store upload remains manual.

## Release Cadence

Release Please uses a hybrid cadence instead of running after every merge to
`main`. Bug-fix and dependency pull requests (`fix` and `deps`) open or update a
patch release pull request immediately after merge. Other release-triggering
work is batched into the weekly Friday run at 15:00 UTC, and maintainers can
also run the GitHub Actions `Release Please` workflow manually when an off-cycle
release is needed.

Normal pull requests can continue merging while a release pull request is open.
New bug fixes refresh the release pull request immediately; other release-worthy
changes refresh it on the next scheduled or manual workflow run. Merging the
Release Please pull request still finalizes the version immediately: the
workflow allows release merge commits through its `push` trigger so Release
Please can create the semver tag and GitHub Release, then upload the extension
zip.

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
2. If the merge is a `fix` or `deps` commit, Release Please opens or updates a
   patch release pull request immediately.
3. For other release-triggering commits, Release Please opens or updates a
   release pull request on Friday at 15:00 UTC, or when a maintainer manually
   runs the workflow.
4. Review the release pull request version and changelog.
5. If more pull requests merge before ship time, bug fixes refresh
   automatically; otherwise run the workflow manually or wait for the next
   Friday run.
6. Merge the release pull request when ready to ship.
7. Release Please creates the semver tag and GitHub Release.
8. The release workflow runs `npm run check`, `npm run build`,
   `npm run store:check`, and `npm run zip`.
9. The release workflow uploads `cognipace-{version}-chrome-mv3.zip` to the
   GitHub Release. WXT creates the local package first at
   `dist/cognipace-{version}-chrome.zip`.
10. For a Store release, upload that exact GitHub Release ZIP to the existing
    private Chrome Web Store item and submit the version for review.

The GitHub Release zip is the official artifact for the version.

## Private Chrome Web Store Handoff

The first private Store submission must use a release newer than `v1.3.2`.
The historical `v1.3.0` release proved the GitHub packaging path but does not
contain declared PNG extension icons and is not Store-ready.

Before opening the Store dashboard:

1. Confirm `npm run check`, `npm run build`,
   `npm run store:check`, and `npm run zip` passed for the release.
2. Confirm the GitHub Release contains the exact
   `cognipace-{version}-chrome-mv3.zip` asset. For local packaging, WXT's
   source artifact is `dist/cognipace-{version}-chrome.zip`.
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
- If a newly merged pull request is missing from an open release pull request,
  check whether it was a `fix` or `deps` commit. Patch-class commits should
  refresh automatically; otherwise run the `Release Please` workflow manually or
  wait for the next Friday run.
- If release artifact upload fails, do not upload a local zip to the Chrome Web
  Store for that version.
- If Chrome Web Store review rejects the package for code or manifest reasons,
  fix the issue in a follow-up pull request and ship a new release.
- If `npm run store:check` fails, do not run the Store handoff for that
  release.
- If the Store rejects listing, privacy, permission, or reviewer information,
  update the repository source of truth and submit a higher release when code
  or manifest changes are required.
- Do not upload `v1.3.0` to the Store because it lacks the approved PNG
  icon declarations.
- The Store cannot install a lower version over a published higher version.
  Recover by releasing a higher patch version with the last known-good
  behavior.
