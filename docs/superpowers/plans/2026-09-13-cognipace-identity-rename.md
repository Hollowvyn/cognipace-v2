# CogniPace Identity Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the maintained project's transitional `cognipace-v2` identity with canonical CogniPace naming across current repository metadata, GitHub, and the local checkout without changing extension behavior or rewriting history.

**Architecture:** Deliver the rename in three ordered phases: tracked package/documentation changes, GitHub repository migration, then local checkout and linked-worktree repair. Historical artifacts remain unchanged and rely on GitHub's repository redirect; runtime identifiers, storage, permissions, and extension version remain untouched.

**Tech Stack:** Git, Git worktrees, GitHub CLI, npm 11.19.0, Node.js 24.20.0, WXT, Markdown, JSON

---

## File Map

- Modify: `package.json` — canonical private npm package name.
- Modify: `package-lock.json` — lockfile root package names matching
  `package.json`.
- Modify: `README.md` — canonical repository description without the obsolete
  side-by-side v1 checkout statement.
- Modify: `docs/architecture.md` — current architecture names the maintained
  product CogniPace.
- Modify: `docs/test-plans/notification-alarm-e2e.md` — active test plan uses
  the canonical product name.
- Preserve: `CHANGELOG.md` — historical release URLs and names.
- Preserve: `docs/superpowers/**` except this design and plan — historical
  specs, plans, audits, issue links, PR links, and recorded filesystem paths.
- External mutation: rename GitHub repository
  `Hollowvyn/cognipace-v2` to `Hollowvyn/CogniPace`.
- External mutation: update the shared Git `origin` URL.
- Filesystem mutation: rename the main checkout directory from
  `cognipace-v2` to `CogniPace`, then repair linked worktree metadata.

## Task 1: Establish A Clean Rename Baseline

**Files:**

- Read: `docs/superpowers/specs/2026-09-13-cognipace-identity-rename-design.md`
- Read: `package.json`
- Read: `package-lock.json`
- Read: `README.md`
- Read: `docs/architecture.md`
- Read: `docs/test-plans/notification-alarm-e2e.md`

- [ ] **Step 1: Enter the dedicated rename worktree**

Run:

```bash
cd /private/tmp/cognipace-rename.yoRPpa
git status --short --branch
```

Expected: branch `codex/rename-cognipace`; only this plan is uncommitted when
the plan is being authored, and the worktree is clean when implementation
begins.

- [ ] **Step 2: Select the repository-pinned toolchain**

Run:

```bash
export PATH="/Users/tobiolutimehin/.nvm/versions/node/v24.20.0/bin:$PATH"
node --version
npm --version
```

Expected:

```text
v24.20.0
11.19.0
```

- [ ] **Step 3: Refresh and confirm the branch base before file edits**

Run:

```bash
git fetch origin
git log --oneline --decorate --max-count=3
git rev-list --left-right --count HEAD...origin/main
```

Expected: the commits ahead of `origin/main` are the approved rename design and
implementation plan. If `origin/main` is ahead, rebase the clean rename branch
before continuing; stop if a conflict touches any target file.

- [ ] **Step 4: Prove the current package identity check fails**

Run:

```bash
node --input-type=module -e "import fs from 'node:fs'; const pkg=JSON.parse(fs.readFileSync('package.json','utf8')); const lock=JSON.parse(fs.readFileSync('package-lock.json','utf8')); if(pkg.name!=='cognipace'||lock.name!=='cognipace'||lock.packages[''].name!=='cognipace') process.exit(1)"
```

Expected: exit code 1 because all three values are still `cognipace-v2`.

- [ ] **Step 5: Record the scoped current-identity matches**

Run:

```bash
rg -n -i --hidden \
  --glob '!node_modules/**' \
  --glob '!.git/**' \
  --glob '!.worktrees/**' \
  --glob '!dist/**' \
  --glob '!.output/**' \
  --glob '!CHANGELOG.md' \
  --glob '!docs/superpowers/**' \
  'cognipace[- _]?v2|cognipace v2' .
```

Expected: matches only in `package.json`, the two lockfile root-name fields,
`README.md`, `docs/architecture.md`, and
`docs/test-plans/notification-alarm-e2e.md`. Stop and classify any additional
match as current or historical before editing it.

## Task 2: Rename The Private Package

**Files:**

- Modify: `package.json:2`
- Modify: `package-lock.json:2`
- Modify: `package-lock.json:8`

- [ ] **Step 1: Change the package name in `package.json`**

Replace the root name with:

```json
{
  "name": "cognipace",
  "private": true
}
```

Preserve every other field and the existing version.

- [ ] **Step 2: Change both root names in `package-lock.json`**

The beginning of the lockfile must read:

```json
{
  "name": "cognipace",
  "version": "1.3.2",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "cognipace",
      "version": "1.3.2"
    }
  }
}
```

This snippet shows the required identity fields only. Preserve the complete
existing dependency content and ordering around them.

- [ ] **Step 3: Prove package and lockfile identity agree**

Run:

```bash
node --input-type=module -e "import fs from 'node:fs'; const pkg=JSON.parse(fs.readFileSync('package.json','utf8')); const lock=JSON.parse(fs.readFileSync('package-lock.json','utf8')); if(pkg.name!=='cognipace'||lock.name!=='cognipace'||lock.packages[''].name!=='cognipace') process.exit(1); console.log('package identity: cognipace')"
```

Expected:

```text
package identity: cognipace
```

- [ ] **Step 4: Confirm the lockfile has no dependency churn**

Run:

```bash
git diff -- package.json package-lock.json
```

Expected: exactly three string replacements from `cognipace-v2` to
`cognipace`; no version or dependency changes.

- [ ] **Step 5: Commit the package identity**

Run:

```bash
git add package.json package-lock.json
git diff --cached --check
git commit -m "chore(package): adopt canonical CogniPace name"
```

Expected: one commit containing only the package and lockfile name changes.

## Task 3: Rename Current Documentation

**Files:**

- Modify: `README.md:9`
- Modify: `docs/architecture.md:5`
- Modify: `docs/test-plans/notification-alarm-e2e.md:3`

- [ ] **Step 1: Remove the obsolete README transition paragraph**

Replace:

```markdown
CogniPace v2 is a rebuild of the original CogniPace extension. In this local
workspace, the old implementation lives at `../CogniPace` for historical
comparison, but this repository is self-contained for development.
```

with:

```markdown
This repository is the canonical home of the maintained CogniPace extension.
```

- [ ] **Step 2: Update the current architecture name**

Change the opening sentence under `## System Shape` to:

```markdown
CogniPace is a local-first WXT Chrome MV3 extension. It has four runtime
surfaces:
```

- [ ] **Step 3: Update the active notification test-plan name**

Change its opening sentence to:

```markdown
This plan verifies the local due-notification flow for CogniPace. It covers
```

Preserve the rest of the test plan unchanged.

- [ ] **Step 4: Prove transitional identity is absent from current surfaces**

Run:

```bash
if rg -n -i --hidden \
  --glob '!node_modules/**' \
  --glob '!.git/**' \
  --glob '!.worktrees/**' \
  --glob '!dist/**' \
  --glob '!.output/**' \
  --glob '!CHANGELOG.md' \
  --glob '!docs/superpowers/**' \
  'cognipace[- _]?v2|cognipace v2' .; then
  exit 1
fi
```

Expected: no output and exit code 0 from the enclosing shell block.

- [ ] **Step 5: Format and validate the documentation diff**

Run:

```bash
npx prettier --write README.md docs/architecture.md docs/test-plans/notification-alarm-e2e.md
npx prettier --check README.md docs/architecture.md docs/test-plans/notification-alarm-e2e.md
git diff --check
git diff -- README.md docs/architecture.md docs/test-plans/notification-alarm-e2e.md
```

Expected: Prettier passes; the diff contains only the three approved current
identity edits.

- [ ] **Step 6: Commit the current documentation identity**

Run:

```bash
git add README.md docs/architecture.md docs/test-plans/notification-alarm-e2e.md
git diff --cached --check
git commit -m "docs: retire transitional v2 identity"
```

Expected: one commit containing only current documentation changes.

## Task 4: Validate Package And Extension Release Output

**Files:**

- Verify: `package.json`
- Verify: `package-lock.json`
- Verify generated: `dist/chrome-mv3/manifest.json`
- Verify generated: `dist/cognipace-1.3.2-chrome.zip`

- [ ] **Step 1: Install exactly the locked dependencies**

Run:

```bash
npm ci
```

Expected: exit code 0 with no lockfile modification.

- [ ] **Step 2: Run lint independently**

Run:

```bash
npm run lint
```

Expected: exit code 0.

- [ ] **Step 3: Run the full repository check**

Run:

```bash
npm run check
```

Expected: Drizzle check, WXT preparation/typecheck, ESLint, and all Vitest
tests pass with exit code 0.

- [ ] **Step 4: Build the production extension**

Run:

```bash
npm run build
```

Expected: exit code 0 and `dist/chrome-mv3/manifest.json` exists.

- [ ] **Step 5: Confirm production branding and runtime-sensitive fields**

Run:

```bash
node --input-type=module -e "import fs from 'node:fs'; const manifest=JSON.parse(fs.readFileSync('dist/chrome-mv3/manifest.json','utf8')); if(manifest.name!=='CogniPace') process.exit(1); if(manifest.version!=='1.3.2') process.exit(1); console.log(manifest.name, manifest.version)"
```

Expected:

```text
CogniPace 1.3.2
```

- [ ] **Step 6: Build and inspect the release ZIP**

Run:

```bash
npm run zip
test -f dist/cognipace-1.3.2-chrome.zip
find dist -maxdepth 1 -type f -name '*.zip' -print | sort
```

Expected: `dist/cognipace-1.3.2-chrome.zip` exists. Any older ignored
`cognipace-v2-*.zip` files are stale local artifacts and are not committed.

- [ ] **Step 7: Confirm validation created no tracked changes**

Run:

```bash
git status --short --branch
git diff --check
```

Expected: clean worktree on `codex/rename-cognipace`, ahead of `origin/main`
only by the design, plan, package-name, and current-documentation commits.

## Task 5: Open And Merge The Rename Pull Request

**Files:**

- Read: `.github/PULL_REQUEST_TEMPLATE.md`
- Read: `docs/agent-governance.md`
- External mutation: GitHub issue and pull request

- [ ] **Step 1: Push the task branch**

Run:

```bash
git push --set-upstream origin codex/rename-cognipace
```

Expected: the branch is available on GitHub without a force push.

- [ ] **Step 2: Create the tracking issue**

Run:

```bash
rename_issue_url=$(gh issue create \
  --repo Hollowvyn/cognipace-v2 \
  --title "Adopt canonical CogniPace repository identity" \
  --body "Rename the maintained package, current documentation, GitHub repository, and local checkout from the transitional v2 identity to CogniPace. Preserve historical links and extension runtime identity. Design: docs/superpowers/specs/2026-09-13-cognipace-identity-rename-design.md. Plan: docs/superpowers/plans/2026-09-13-cognipace-identity-rename.md.")
rename_issue_number=${rename_issue_url##*/}
printf '%s\n' "$rename_issue_url"
```

Expected: one issue URL and a numeric `rename_issue_number`.

- [ ] **Step 3: Open the pull request**

Run in the same shell so `rename_issue_number` remains available:

```bash
gh pr create \
  --repo Hollowvyn/cognipace-v2 \
  --base main \
  --head codex/rename-cognipace \
  --title "chore(repo): adopt canonical CogniPace identity" \
  --body "## Details

Adopts CogniPace as the maintained repository and package identity while preserving historical records and the shipped extension identity.

## Issue

Closes #${rename_issue_number}

## Testing

- [x] \`npm run check\` passed
- [x] \`npm run build\` passed
- [x] \`npm run zip\` passed
- [x] Package/lockfile identity assertion passed
- [x] Production manifest remained CogniPace 1.3.2
- [x] Release ZIP is \`dist/cognipace-1.3.2-chrome.zip\`
- [x] Added/updated needed tests: N/A; identity-only metadata and prose change
- [x] Manual smoke tested: N/A; no product behavior or UI changed
- [x] Skipped validation: None

## Screenshots

N/A; no product behavior or UI changed.

## Release and rollback

Maintenance-only repository identity change. Roll back tracked files by reverting the squash commit before the GitHub rename; after the rename, GitHub can be renamed back and the origin URL restored."
```

Expected: a pull-request URL using the maintenance-only `chore` title.

- [ ] **Step 4: Wait for required checks**

Run:

```bash
gh pr checks --repo Hollowvyn/cognipace-v2 --watch
```

Expected: every required check passes. Do not merge with pending or failed
required checks.

- [ ] **Step 5: Merge through normal branch protection**

Run:

```bash
gh pr merge --repo Hollowvyn/cognipace-v2 --squash --delete-branch
```

Expected: the pull request merges without bypassing branch protection. If
review is required, stop and request the review instead of using admin bypass.

## Task 6: Rename And Verify The GitHub Repository

**Files:**

- External mutation: GitHub repository name
- External mutation: shared Git `origin` URL

- [ ] **Step 1: Verify the target slug is available**

Run:

```bash
if gh repo view Hollowvyn/CogniPace --json nameWithOwner >/dev/null 2>&1; then
  echo "Hollowvyn/CogniPace already exists; stop before renaming" >&2
  exit 1
fi
gh repo view Hollowvyn/cognipace-v2 --json nameWithOwner,visibility,defaultBranchRef
```

Expected: the target lookup fails because the old repository was sunset; the
source lookup returns the public repository with default branch `main`.

- [ ] **Step 2: Record GitHub settings visible before the rename**

Run:

```bash
gh secret list --repo Hollowvyn/cognipace-v2 --app actions
gh api repos/Hollowvyn/cognipace-v2/rulesets --paginate --jq 'map({id,name,enforcement})'
gh api repos/Hollowvyn/cognipace-v2/branches/main/protection --jq '{required_status_checks,enforce_admins,required_pull_request_reviews,required_conversation_resolution,restrictions}'
gh release list --repo Hollowvyn/cognipace-v2 --limit 10
gh run list --repo Hollowvyn/cognipace-v2 --limit 10
gh api repos/Hollowvyn/cognipace-v2 --jq '{name,visibility,default_branch,archived,has_issues,has_projects,has_wiki,homepage,topics}'
```

Expected: capture the displayed secret names, rulesets, recent releases, recent
Actions runs, and repository settings in the execution log. Secret values are
never read or printed.

- [ ] **Step 3: Rename the repository non-interactively**

Run:

```bash
gh repo rename -R Hollowvyn/cognipace-v2 CogniPace --yes
```

Expected: exit code 0 and the canonical repository becomes
`Hollowvyn/CogniPace`.

- [ ] **Step 4: Update the shared origin URL**

Run:

```bash
git remote set-url origin https://github.com/Hollowvyn/CogniPace.git
git remote -v
git fetch origin
```

Expected: fetch and push URLs both use `Hollowvyn/CogniPace.git`; fetch exits
successfully.

- [ ] **Step 5: Verify the renamed GitHub repository**

Run:

```bash
gh repo view Hollowvyn/CogniPace --json nameWithOwner,url,visibility,defaultBranchRef,isArchived
gh secret list --repo Hollowvyn/CogniPace --app actions
gh api repos/Hollowvyn/CogniPace/rulesets --paginate --jq 'map({id,name,enforcement})'
gh api repos/Hollowvyn/CogniPace/branches/main/protection --jq '{required_status_checks,enforce_admins,required_pull_request_reviews,required_conversation_resolution,restrictions}'
gh release list --repo Hollowvyn/CogniPace --limit 10
gh run list --repo Hollowvyn/CogniPace --limit 10
gh issue list --repo Hollowvyn/CogniPace --limit 1
gh pr list --repo Hollowvyn/CogniPace --state all --limit 1
git ls-remote --symref origin HEAD
```

Expected: repository name `Hollowvyn/CogniPace`, public visibility, default
branch `main`, existing secret names and rulesets unchanged, releases and
Actions visible, issue/PR queries successful, and remote HEAD targeting main.

- [ ] **Step 6: Verify the historical URL redirect**

Run:

```bash
redirect_target=$(curl --silent --location --output /dev/null --write-out '%{url_effective}' https://github.com/Hollowvyn/cognipace-v2)
printf '%s\n' "$redirect_target"
case "$redirect_target" in
  https://github.com/Hollowvyn/CogniPace|https://github.com/Hollowvyn/CogniPace/) ;;
  *) exit 1 ;;
esac
```

Expected: the former repository URL resolves to the canonical repository URL.
Do not create a new repository at the former slug because that would remove
GitHub's redirect.

## Task 7: Rename The Local Checkout And Repair Worktrees

**Files:**

- Move: `/Users/tobiolutimehin/WebstormProjects/cognipace-v2`
- Target: `/Users/tobiolutimehin/WebstormProjects/CogniPace`
- Repair: main `.git` worktree administration and linked-worktree `.git`
  pointers

- [ ] **Step 1: Schedule the local maintenance window**

Close active CogniPace terminals, development servers, WebStorm windows, and
Codex tasks that use the main checkout or linked worktrees. Perform the
remaining steps from a terminal whose current directory is
`/Users/tobiolutimehin/WebstormProjects`, not from inside the repository.

Expected: no process is actively writing to an affected checkout.

- [ ] **Step 2: Verify exact source and target directories**

Run:

```bash
test -d /Users/tobiolutimehin/WebstormProjects/cognipace-v2
test ! -e /Users/tobiolutimehin/WebstormProjects/CogniPace
git -C /Users/tobiolutimehin/WebstormProjects/cognipace-v2 status --short --branch
git -C /Users/tobiolutimehin/WebstormProjects/cognipace-v2 worktree list --porcelain
```

Expected: the source exists, the target does not, and every worktree is
displayed. Stop if any uncommitted work is not recognized and accounted for;
do not stash, reset, or delete it.

- [ ] **Step 3: Capture the registered worktree paths in memory**

Run in zsh:

```zsh
old_root=/Users/tobiolutimehin/WebstormProjects/cognipace-v2
new_root=/Users/tobiolutimehin/WebstormProjects/CogniPace
registered_worktrees=("${(@f)$(git -C "$old_root" worktree list --porcelain | awk '/^worktree / {print substr($0,10)}')}")
printf '%s\n' "${registered_worktrees[@]}"
```

Expected: the first path is the old main checkout and all known linked
worktrees appear. Keep this shell open through Step 6.

- [ ] **Step 4: Move the main checkout directory**

Run in the same zsh shell:

```zsh
cd /Users/tobiolutimehin/WebstormProjects
mv "$old_root" "$new_root"
test ! -e "$old_root"
test -d "$new_root"
```

Expected: the source path is absent and the renamed directory exists. This is
a move, not a deletion.

- [ ] **Step 5: Translate moved nested-worktree paths**

Run in the same zsh shell:

```zsh
repaired_worktrees=()
for registered_path in "${registered_worktrees[@]}"; do
  if [[ "$registered_path" == "$old_root" ]]; then
    continue
  fi
  repaired_worktrees+=("${registered_path/#$old_root/$new_root}")
done
printf '%s\n' "${repaired_worktrees[@]}"
```

Expected: external linked-worktree paths are unchanged; linked worktrees that
were nested beneath the main checkout now begin with the new root.

- [ ] **Step 6: Repair both directions of every worktree link**

Run in the same zsh shell:

```zsh
git -C "$new_root" worktree repair "${repaired_worktrees[@]}"
git -C "$new_root" worktree list --porcelain
```

Expected: every worktree is listed at its current path with no prunable or
missing annotation.

- [ ] **Step 7: Verify every repaired checkout**

Run in the same zsh shell:

```zsh
git -C "$new_root" status --short --branch
git -C "$new_root" rev-parse --path-format=absolute --git-common-dir
for repaired_path in "${repaired_worktrees[@]}"; do
  test -d "$repaired_path"
  git -C "$repaired_path" status --short --branch
  git -C "$repaired_path" rev-parse --path-format=absolute --git-common-dir
done
```

Expected: every status command succeeds, pre-existing uncommitted changes are
still present, and every common Git directory resolves to
`/Users/tobiolutimehin/WebstormProjects/CogniPace/.git`.

- [ ] **Step 8: Reopen local tools at the canonical path**

Open `/Users/tobiolutimehin/WebstormProjects/CogniPace` as the maintained
project in Codex and WebStorm. Remove the stale saved-project entry pointing to
`cognipace-v2` only after the renamed project opens successfully.

Expected: new tasks and IDE sessions use the canonical local path. Historical
absolute paths inside archived planning documents remain unchanged.

## Final Verification And Handoff

- [ ] **Step 1: Run the canonical-identity search from the renamed checkout**

Run:

```bash
if rg -n -i --hidden \
  --glob '!node_modules/**' \
  --glob '!.git/**' \
  --glob '!.worktrees/**' \
  --glob '!dist/**' \
  --glob '!.output/**' \
  --glob '!CHANGELOG.md' \
  --glob '!docs/superpowers/**' \
  'cognipace[- _]?v2|cognipace v2' \
  /Users/tobiolutimehin/WebstormProjects/CogniPace; then
  exit 1
fi
```

Expected: no current transitional identity matches.

- [ ] **Step 2: Record the final evidence**

The handoff must list:

- exact commits and pull request
- new repository URL and verified old-URL redirect
- package, lockfile, manifest, and ZIP identity results
- GitHub settings categories checked before and after rename
- every automated command run and its result
- every skipped command or manual step with its reason
- all repaired worktree paths and their status result
- confirmation that no runtime identity, user data, permissions, or historical
  records changed

- [ ] **Step 3: State the recovery position**

Record that tracked changes can be reverted with a normal pull request, GitHub
can be renamed back while no repository occupies the old slug, and the local
directory can be moved back followed by `git worktree repair`. Do not use force
pushes, hard resets, or forced worktree removal as rollback mechanisms.
