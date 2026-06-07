# Release Please Release System Design

## Context

CogniPace is a local-first Chrome MV3 extension built with WXT, React, TypeScript,
SQLite WASM, Drizzle, and Vitest. The app already has the release-critical build
scripts in `package.json`:

- `npm run check`
- `npm run build`
- `npm run zip`

The project does not currently have checked-in GitHub Actions workflows. The
current package version is still `0.0.0`, and official user releases need a
repeatable path to semantic versioning, changelog generation, release artifacts,
and Chrome Web Store handoff.

The repository requires squash merge. That makes the pull request title the
practical release signal, because the squash commit on `main` is what release
automation will inspect.

## Goals

- Use semantic versioning without requiring `.changeset` files.
- Generate changelogs automatically from Conventional Commit-style release
  history.
- Keep releases deliberate through a maintained release pull request.
- Automatically attach a store-ready WXT zip to the GitHub Release.
- Keep Chrome Web Store upload and final publish timing manual.
- Keep the setup small enough for a single maintainer to operate.

## Non-Goals

- Do not add automatic Chrome Web Store API publishing in the first release
  system.
- Do not add commitlint for every branch commit initially.
- Do not introduce Changesets or per-PR release note files.
- Do not create a generic release platform or broad operational framework.
- Do not publish to npm or GitHub Packages.

## Recommended Approach

Use `googleapis/release-please-action` as the release engine and enforce
Conventional Commit pull request titles as the source of semver intent.

Add three workflows:

- `CI`: validates pull requests and `main` with the repo's standard checks.
- `PR title lint`: rejects pull request titles that do not follow the agreed
  Conventional Commit format.
- `Release Please`: maintains the release PR on `main`; when the release PR is
  merged, creates the semver tag and GitHub Release, then builds and uploads the
  extension zip to that release.

This gives the project an automated release path without turning every merge into
an immediate Chrome Web Store submission.

## Semantic Policy

Pull request titles should follow:

```text
<type>(optional-scope): short summary
```

Release-relevant types:

- `feat`: minor version.
- `fix`: patch version.
- `perf`: patch version.
- `docs`: patch version when user-facing, store-facing, or release-facing.
- `refactor`: patch version only when the change has user-visible behavior or
  release risk.

Maintenance types:

- `chore`
- `test`
- `ci`
- `build`
- `style`

Breaking changes use `!`:

```text
feat!: reset incompatible local snapshot format
```

Examples:

```text
feat(sync): add safe Gist conflict recovery
fix(overlay): preserve timer state after LeetCode navigation
docs(store): clarify local-first data handling
ci(release): upload extension zip to GitHub releases
chore: update dependencies
```

Pull request descriptions are useful for review but are not the default release
source. If a squash-merged pull request needs multiple release note entries, use
release-please's `BEGIN_COMMIT_OVERRIDE` block in the pull request body.

## Release Flow

1. A feature, fix, or release-relevant documentation pull request is opened with
   a Conventional Commit title.
2. Pull request checks run, including title lint and normal CI.
3. The pull request is squash-merged.
4. Release Please reads the new commit on `main` and creates or updates the
   release pull request.
5. The release pull request contains the package version bump and changelog
   update.
6. When the maintainer is ready to ship, they review and merge the release pull
   request.
7. Release Please creates the semver tag and GitHub Release.
8. The release workflow builds, checks, zips, and uploads the extension zip to
   the GitHub Release.
9. The maintainer uploads that exact GitHub Release zip to the Chrome Web Store.

The GitHub Release zip is the canonical official artifact for a version.

## Workflow Responsibilities

### CI

Run on pull requests and pushes to `main`.

Expected steps:

- Check out the repository.
- Set up Node.
- Install dependencies with `npm ci`.
- Run `npm run check`.

This workflow proves the candidate code meets the repository's documented
validation gate.

### PR Title Lint

Run on pull request events that can change the title.

Expected behavior:

- Validate pull request titles against Conventional Commit format.
- Permit the agreed type list.
- Fail quickly with a message that shows valid examples.

Because squash merge is required, this workflow is the main enforcement point for
release-please correctness.

### Release Please

Run on pushes to `main`.

Expected behavior:

- Maintain the release pull request.
- Update `package.json`, `package-lock.json` if needed, and `CHANGELOG.md`.
- Create the semver tag and GitHub Release when the release pull request is
  merged.
- Expose release outputs such as `release_created`, `tag_name`, `version`, and
  release body.

When `release_created` is true, the same workflow should continue with artifact
creation:

- Check out the released SHA.
- Install dependencies with `npm ci`.
- Run `npm run check`.
- Run `npm run build`.
- Run `npm run zip`.
- Locate the WXT zip artifact.
- Upload the zip to the GitHub Release.

## Chrome Web Store Handoff

Chrome Web Store submission remains manual.

The maintainer should:

- Open the GitHub Release for the target version.
- Download the attached extension zip.
- Upload that exact zip to the Chrome Web Store developer dashboard.
- Review listing, privacy, permissions, and release notes.
- Submit for review and choose the appropriate publish timing.

The maintainer should not upload a locally built zip for an official release if
the GitHub Release artifact job failed.

## Failure Handling

- If pull request title lint fails, fix the title before merge.
- If normal CI fails, do not merge the pull request.
- If the release PR changelog or version is wrong, fix the source Conventional
  Commit history where practical, or use a documented release-please override
  before shipping.
- If release artifact build or upload fails after the GitHub Release is created,
  treat the GitHub Release as incomplete until the artifact is uploaded from CI.
- If Chrome Web Store review rejects the artifact for code or manifest reasons,
  fix the issue in a follow-up pull request and ship a new release.

## Required Repository Changes

- Add `.github/workflows/ci.yml`.
- Add `.github/workflows/pr-title.yml` using
  `amannn/action-semantic-pull-request`.
- Add `.github/workflows/release-please.yml`.
- Add `release-please-config.json` and `.release-please-manifest.json`.
- Add `CHANGELOG.md`.
- Add `docs/release.md` with maintainer release instructions.
- Update `CONTRIBUTING.md` with pull request title rules and release basics.
- Add a small helper script only if WXT zip discovery is awkward in CI.

## Implementation Defaults

- Use Node 24 in GitHub Actions to match the repository's current Node type
  target.
- Configure Release Please with the `node` release type so `package.json`,
  `package-lock.json`, and `CHANGELOG.md` are updated together.
- Configure Release Please to use root package releases with tags formatted as
  `vX.Y.Z`.
- Keep normal CI focused on `npm run check`.
- Run `npm run build` and `npm run zip` in the release artifact path after a
  GitHub Release is created.
- Allow the semantic pull request action to validate the configured release and
  maintenance types listed in this spec.

## Validation Plan

For the release-system implementation:

- Run Prettier on touched Markdown, JSON, and YAML files.
- Run `npm run check`.
- Inspect workflow triggers, permissions, and release conditions.
- Confirm release artifact upload is gated by the release-please
  `release_created` output.
- Confirm the release docs explain that Chrome Web Store upload is manual and
  must use the GitHub Release zip.
