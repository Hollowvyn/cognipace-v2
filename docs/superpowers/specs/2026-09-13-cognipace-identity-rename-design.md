# CogniPace Identity Rename Design

## Status

Approved for implementation planning on 2026-09-13.

## Context

The original CogniPace repository has been sunset and archived. The maintained
repository, currently named `Hollowvyn/cognipace-v2`, is now the canonical
product. The shipped extension already uses the user-facing name `CogniPace`,
but the repository slug, local checkout directory, private npm package name,
and a few current documentation statements still carry the transitional `v2`
name.

The repository also has multiple linked Git worktrees. Moving the main checkout
without repairing the worktree administration paths would break those linked
checkouts.

## Goal

Make the maintained project consistently identifiable as CogniPace wherever
the current identity matters, while preserving historical records and avoiding
any change to the installed extension's runtime identity or user data.

The target identities are:

- Product and extension display name: `CogniPace`
- GitHub repository: `Hollowvyn/CogniPace`
- Private npm package: `cognipace`
- Local checkout directory: `CogniPace`

## Non-Goals

- Do not rewrite historical specs, plans, audits, changelog entries, issue
  links, pull-request links, release notes, tags, or commits.
- Do not recreate or import the archived original repository.
- Do not change the Chrome extension identity, manifest permissions, persisted
  storage, database schema, release version, or product behavior.
- Do not rename source modules, runtime message names, storage keys, or other
  identifiers that already use the canonical `cognipace` name.
- Do not add GitHub features, topics, Pages configuration, or repository
  policies unrelated to the identity migration.

## Repository File Changes

Update only current, maintained identity surfaces:

- Change the root package name in `package.json` and `package-lock.json` from
  `cognipace-v2` to `cognipace`.
- Update the README so the maintained repository is described simply as
  CogniPace and remove the obsolete statement that the original checkout lives
  beside it.
- Update the current architecture overview and active test-plan prose that
  still call the maintained product CogniPace v2.
- Update any other live configuration or current documentation references
  discovered by a final scoped search.

Historical material under `docs/superpowers`, existing `CHANGELOG.md` entries,
and historical issue or pull-request URLs remain unchanged. GitHub redirects
from the former repository slug preserve those links after the rename.

## GitHub Migration

The tracked file changes land before the GitHub repository slug changes. After
the change is merged:

1. Rename `Hollowvyn/cognipace-v2` to `Hollowvyn/CogniPace`.
2. Update the shared `origin` remote to the canonical URL.
3. Verify the repository name, default branch, visibility, issues, pull
   requests, releases, tags, Actions, repository secrets, rulesets or branch
   protection, and release workflow visibility.
4. Verify that the former repository URL redirects to the renamed repository.

GitHub preserves repository information and redirects web and Git traffic when
a repository is renamed. No repository may be created at the former slug,
because doing so would remove the redirect relied upon by historical links.

## Local Checkout And Worktree Migration

The local directory rename is a separate maintenance step after repository
work and active processes are complete:

1. Record `git status --short --branch` and `git worktree list --porcelain` for
   the main checkout and every linked worktree.
2. Do not proceed while any affected task is actively running or while an
   uncommitted worktree has not been accounted for.
3. Rename `/Users/tobiolutimehin/WebstormProjects/cognipace-v2` to
   `/Users/tobiolutimehin/WebstormProjects/CogniPace`.
4. From the renamed main checkout, run `git worktree repair`, passing the new
   paths of any linked worktrees that moved with the main directory.
5. Verify Git status, branch identity, and repository common-directory
   resolution from every linked worktree.
6. Reopen or re-register the renamed project in Codex and WebStorm as needed.

Git's worktree repair command is the supported recovery mechanism when the
main working tree or linked working trees have been moved outside Git.

## Delivery Sequence

Use three reviewable phases:

1. **Tracked identity changes:** package metadata and current documentation on
   a dedicated branch and pull request.
2. **GitHub identity change:** repository rename, remote update, and GitHub
   settings verification after the pull request is merged.
3. **Local path migration:** maintenance-window directory rename, worktree
   repair, and editor/project reopening.

The GitHub rename and local path migration must not be folded into an
unreviewed bulk search-and-replace operation.

## Validation

For the tracked identity change:

- Confirm `package.json` and `package-lock.json` agree on `cognipace`.
- Run a scoped search proving no transitional identity remains in current
  maintained surfaces.
- Run Prettier on every touched Markdown file.
- Run `npm run lint` and `npm run check`.
- Run `npm run build` and `npm run zip` because package and extension release
  metadata are in scope.
- Inspect the generated manifest and ZIP filename to confirm the production
  extension remains `CogniPace` and the release artifact remains correctly
  named.

For the GitHub migration:

- Query the repository at its new canonical name.
- Verify the old repository URL redirects.
- Inspect Actions, secrets by name, releases, tags, rulesets or branch
  protection, and the default branch.
- Fetch from and push a harmless branch check through the updated remote only
  when normal branch protections permit it; do not force-push.

For the local migration:

- Verify all registered worktree paths exist after repair.
- Run `git status --short --branch` from every worktree.
- Confirm the main checkout's common Git directory resolves below the renamed
  path and linked worktrees resolve to the same repository.

This rename does not change app behavior, so browser smoke testing and visual
proof are not required. Build and release-artifact validation still apply.

## Failure Handling And Recovery

- If tracked validation fails, do not merge the pull request.
- If the GitHub rename fails, leave the repository at its existing slug and
  keep the tracked rename commit available for correction.
- If a GitHub setting is missing after the rename, stop release activity until
  the setting is restored or the discrepancy is understood.
- If local worktree repair fails, preserve every directory in place and use the
  pre-migration worktree inventory to repair paths individually. Do not delete
  or forcibly remove an unclean worktree.
- The archived original repository is independent of this migration and is not
  modified by any recovery action.
