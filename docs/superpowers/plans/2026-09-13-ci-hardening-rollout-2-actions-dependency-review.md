# CI Hardening Rollout 2 Actions And Dependency Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace mutable GitHub Action tags with reviewed immutable release
SHAs, add pull-request-only dependency vulnerability review, and extend the
stable aggregate without changing application, package, release, or branch
protection behavior.

**Architecture:** Keep the Rollout 1 `Check`, `Build`, `Format`, and
`Required Checks` contract intact. Upgrade and pin every external Action in its
existing workflow, add a least-privilege `Dependency Review` job to CI for pull
requests, and make the aggregate require dependency review success on pull
requests but accept its expected skip on pushes to `main`.

**Tech Stack:** GitHub Actions, Bash, Node.js 24.20.0, npm 11.19.0, Prettier,
GitHub Dependency Review Action v5.

---

**Approved design:**
[`../specs/2026-09-12-dependency-ci-modernization-design.md`](../specs/2026-09-12-dependency-ci-modernization-design.md)

## Scope And Preconditions

This plan implements only the fourth pull-request boundary in the approved
dependency and CI modernization sequence:

- upgrade every external Action already used by `.github/workflows`;
- replace every mutable Action tag with a full release commit SHA and version
  comment;
- add pull-request-only dependency vulnerability review;
- extend `Required Checks` to understand the event-specific dependency review
  result; and
- update contributor documentation for the final CI job contract.

Rollout 1 is a hard prerequisite. Its pull-request run and the latest
non-superseded push-to-`main` run must pass `Check`, `Build`, `Format`, and
`Required Checks` before implementation starts. A superseded run cancelled by
workflow concurrency is expected, but the newer run must finish green.

The following work is outside this plan:

- npm dependency updates or lockfile changes;
- Dependabot configuration;
- Action input, workflow trigger, or permission expansion beyond the new
  read-only Dependency Review job;
- Release Please cadence, release asset, or Chrome Web Store changes;
- branch-protection mutation;
- product, runtime, database, sync, or extension-permission changes; and
- manual dispatch of state-mutating Stale or Release Please workflows.

## Reviewed Action Releases

The following releases were rechecked against the official repositories on
September 13, 2026. Each tag resolves directly to the recorded full commit SHA.

| Action                                | Release   | Full commit SHA                            |
| ------------------------------------- | --------- | ------------------------------------------ |
| `actions/checkout`                    | `v7.0.1`  | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| `actions/setup-node`                  | `v7.0.0`  | `820762786026740c76f36085b0efc47a31fe5020` |
| `actions/labeler`                     | `v7.0.0`  | `bf12e9b00b37c5c0ca2b87b79b2daf7891dbda13` |
| `actions/stale`                       | `v11.0.0` | `4391f3da665fdf50b6810c1a66712fb9ba21aa93` |
| `googleapis/release-please-action`    | `v5.0.0`  | `45996ed1f6d02564a971a2fa1b5860e934307cf7` |
| `amannn/action-semantic-pull-request` | `v6.1.1`  | `48f256284bd46cdaab1048c3721360e808335d50` |
| `actions/dependency-review-action`    | `v5.0.0`  | `a1d282b36b6f3519aa1f3fc636f609c47dddb294` |

Release-note review found these relevant migration facts:

- Checkout v7 adds safer handling for privileged fork checkouts and moves to
  ESM; CogniPace does not use the affected unsafe checkout opt-in.
- Setup Node v7 moves to ESM, removes no input used here, and preserves the
  explicit npm cache configuration.
- Labeler v7 and Stale v11 move to ESM without changing their documented inputs
  or behavior.
- Release Please Action v5 moves to Node 24 and updates the bundled
  `release-please` library; the existing token and manifest inputs remain
  supported.
- Semantic Pull Request v6.1.1 is the current patch on the already-used v6
  major and fixes header correspondence parsing.
- Dependency Review v5 moves to Node 24 and requires runner v2.327.1 or newer;
  GitHub-hosted `ubuntu-latest` satisfies this requirement.

## File Map

| File                                                                                    | Responsibility in this rollout                                       |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `.github/workflows/ci.yml`                                                              | Pin checkout/setup, add Dependency Review, and extend the aggregate. |
| `.github/workflows/labeler.yml`                                                         | Pin Labeler v7 without changing label behavior or permissions.       |
| `.github/workflows/pr-title.yml`                                                        | Pin Semantic Pull Request v6.1.1 without changing title policy.      |
| `.github/workflows/release-please.yml`                                                  | Pin Release Please, checkout, and setup-node without changing flow.  |
| `.github/workflows/stale-prs.yml`                                                       | Pin Stale v11 without changing issue/PR policy.                      |
| `CONTRIBUTING.md`                                                                       | Document Dependency Review and the final aggregate contract.         |
| `docs/superpowers/README.md`                                                            | Index this implementation plan.                                      |
| `docs/superpowers/plans/2026-09-13-ci-hardening-rollout-2-actions-dependency-review.md` | Record this phase-sized plan.                                        |

No application source, package manifest, lockfile, release configuration,
Chrome permission, or repository-setting file belongs in this rollout.

## Task 1: Enforce The Rollout 1 And Repository Baseline

**Files:**

- Verify only; do not modify files

- [ ] **Step 1: Confirm the branch starts clean from latest `main`**

Run:

```sh
git status --short --branch
git fetch origin main
git merge-base --is-ancestor origin/main HEAD
```

Expected result: the worktree is clean, `origin/main` is an ancestor, and this
rollout branch contains no unrelated commits.

- [ ] **Step 2: Confirm Rollout 1 hosted proof**

Run:

```sh
gh run list --workflow CI --branch main --limit 5 \
  --json databaseId,headSha,event,status,conclusion,url
```

Open the newest non-superseded run for the current `origin/main` SHA. Expected:
`Check`, `Build`, `Format`, and `Required Checks` all complete successfully.
Record any older cancellation caused by the same-ref concurrency group as
expected evidence rather than a validation failure.

- [ ] **Step 3: Reproduce the declared local baseline**

Run:

```sh
node --version
npm --version
npm ci
npm run format
git status --short
```

Expected versions are Node `v24.20.0` and npm `11.19.0`. The install and format
gate must pass without modifying tracked files.

- [ ] **Step 4: Record branch protection without changing it**

Run:

```sh
gh api repos/Hollowvyn/cognipace-v2/branches/main/protection \
  --jq '{strict: .required_status_checks.strict, contexts: .required_status_checks.contexts, approvals: .required_pull_request_reviews.required_approving_review_count}'
```

Expected before: strict up-to-date checking is `true`, approval count is `1`,
and required contexts remain empty. If the live state differs, stop and review
the rollout before editing workflows.

## Task 2: Reverify And Pin Governance Automation

**Files:**

- Modify: `.github/workflows/labeler.yml`
- Modify: `.github/workflows/pr-title.yml`
- Modify: `.github/workflows/stale-prs.yml`

- [ ] **Step 1: Recheck official tags and immutable targets**

Run each pair before editing:

```sh
gh api repos/actions/labeler/releases/latest --jq .tag_name
git ls-remote https://github.com/actions/labeler.git refs/tags/v7.0.0

gh api repos/actions/stale/releases/latest --jq .tag_name
git ls-remote https://github.com/actions/stale.git refs/tags/v11.0.0

gh api repos/amannn/action-semantic-pull-request/releases/latest --jq .tag_name
git ls-remote https://github.com/amannn/action-semantic-pull-request.git refs/tags/v6.1.1
```

Expected tags and SHAs must match the reviewed table above. If a newer stable
release exists, stop and review its official release notes before changing the
plan or workflow.

- [ ] **Step 2: Replace the three mutable references**

Use these exact references:

```yaml
uses: actions/labeler@bf12e9b00b37c5c0ca2b87b79b2daf7891dbda13 # v7.0.0
uses: actions/stale@4391f3da665fdf50b6810c1a66712fb9ba21aa93 # v11.0.0
uses: amannn/action-semantic-pull-request@48f256284bd46cdaab1048c3721360e808335d50 # v6.1.1
```

Change only each `uses:` value. Preserve triggers, permissions, job names,
secrets, and every Action input.

- [ ] **Step 3: Validate the focused workflow changes**

Run:

```sh
npx prettier --check \
  .github/workflows/labeler.yml \
  .github/workflows/pr-title.yml \
  .github/workflows/stale-prs.yml
git diff --check
git diff -- \
  .github/workflows/labeler.yml \
  .github/workflows/pr-title.yml \
  .github/workflows/stale-prs.yml
```

Expected: only three immutable Action-reference lines change, each with the
reviewed version comment.

- [ ] **Step 4: Commit governance Action pins**

```sh
git add \
  .github/workflows/labeler.yml \
  .github/workflows/pr-title.yml \
  .github/workflows/stale-prs.yml
git commit -m "ci(deps): pin governance actions"
```

## Task 3: Pin CI And Release Actions

**Files:**

- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/release-please.yml`

- [ ] **Step 1: Recheck official tags and immutable targets**

Run:

```sh
gh api repos/actions/checkout/releases/latest --jq .tag_name
git ls-remote https://github.com/actions/checkout.git refs/tags/v7.0.1

gh api repos/actions/setup-node/releases/latest --jq .tag_name
git ls-remote https://github.com/actions/setup-node.git refs/tags/v7.0.0

gh api repos/googleapis/release-please-action/releases/latest --jq .tag_name
git ls-remote https://github.com/googleapis/release-please-action.git refs/tags/v5.0.0
```

Expected tags and SHAs must match the reviewed table. A newer release pauses
implementation for release-note review.

- [ ] **Step 2: Pin checkout and setup-node in every CI job**

Replace all three Checkout references with:

```yaml
uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
```

Replace all three Setup Node references with:

```yaml
uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
```

Preserve the three stable validation commands, cache input, toolchain setup,
concurrency group, permissions, and aggregate behavior.

- [ ] **Step 3: Pin the three release workflow Actions**

Use these exact references:

```yaml
uses: googleapis/release-please-action@45996ed1f6d02564a971a2fa1b5860e934307cf7 # v5.0.0
uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
```

Preserve the Release Please token, configuration/manifest paths, release
conditions, tag checkout, npm bootstrap, validation, artifact preparation, and
upload logic exactly.

- [ ] **Step 4: Validate CI and release workflow pinning**

Run:

```sh
npx prettier --check \
  .github/workflows/ci.yml \
  .github/workflows/release-please.yml
git diff --check
git diff -- .github/workflows/ci.yml .github/workflows/release-please.yml
```

Expected: only existing Action references change. No workflow trigger,
permission, input, condition, secret, shell command, or job name changes.

- [ ] **Step 5: Commit CI and release Action pins**

```sh
git add .github/workflows/ci.yml .github/workflows/release-please.yml
git commit -m "ci(deps): pin build and release actions"
```

## Task 4: Add Pull-Request Dependency Review

**Files:**

- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Confirm the new job is absent**

Run:

```sh
rg -n "Dependency Review|dependency-review|fail-on-severity" \
  .github/workflows/ci.yml
```

Expected RED result: no matches.

- [ ] **Step 2: Add the pull-request-only job**

Insert after `format` and before `required-checks`:

```yaml
dependency-review:
  name: Dependency Review
  if: ${{ github.event_name == 'pull_request' }}
  runs-on: ubuntu-latest

  steps:
    - name: Checkout
      uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1

    - name: Review dependency changes
      uses: actions/dependency-review-action@a1d282b36b6f3519aa1f3fc636f609c47dddb294 # v5.0.0
      with:
        fail-on-severity: moderate
        fail-on-scopes: runtime, development, unknown
        license-check: false
        comment-summary-in-pr: never
```

Keep workflow-level `contents: read`. Do not add `pull-requests: write`, a
secret, `pull_request_target`, `warn-only`, an advisory allowlist, or a license
policy.

- [ ] **Step 3: Extend the aggregate dependencies and inputs**

Add `dependency-review` to `required-checks.needs`, then add these fixed values
to the aggregate step environment:

```yaml
EVENT_NAME: ${{ github.event_name }}
DEPENDENCY_REVIEW_RESULT: ${{ needs.dependency-review.result }}
```

Print both values with the existing result log lines.

- [ ] **Step 4: Replace the aggregate decision with event-specific logic**

Use this exact shell logic after printing the results:

```bash
case "$EVENT_NAME" in
  pull_request)
    expected_dependency_review_result="success"
    ;;
  push)
    expected_dependency_review_result="skipped"
    ;;
  *)
    echo "Unexpected event: $EVENT_NAME" >&2
    exit 1
    ;;
esac

if [[ "$CHECK_RESULT" != "success" ]] ||
  [[ "$BUILD_RESULT" != "success" ]] ||
  [[ "$FORMAT_RESULT" != "success" ]] ||
  [[ "$DEPENDENCY_REVIEW_RESULT" != "$expected_dependency_review_result" ]]; then
  echo "One or more required jobs did not produce the expected result." >&2
  exit 1
fi
```

The aggregate remains `if: ${{ always() }}` so it evaluates failures,
cancellations, and the expected push-only skip instead of being skipped itself.

- [ ] **Step 5: Statically exercise the aggregate matrix**

Run the shell decision locally with fixed values for these cases:

| Event          | Validation results | Dependency Review | Expected |
| -------------- | ------------------ | ----------------- | -------- |
| `pull_request` | all `success`      | `success`         | pass     |
| `push`         | all `success`      | `skipped`         | pass     |
| `pull_request` | any `failure`      | `success`         | fail     |
| `pull_request` | all `success`      | `skipped`         | fail     |
| `push`         | all `success`      | `success`         | fail     |
| either event   | any `cancelled`    | expected result   | fail     |

Also run:

```sh
npx prettier --check .github/workflows/ci.yml
rg -n "name: (Check|Build|Format|Dependency Review|Required Checks)$" \
  .github/workflows/ci.yml
rg -n "pull_request_target|pull-requests: write|warn-only" \
  .github/workflows/ci.yml || true
git diff --check
git diff -- .github/workflows/ci.yml
```

Expected: all five stable display names exist, no privileged PR trigger/write
permission/warn-only escape exists, and formatting/whitespace checks pass.

- [ ] **Step 6: Commit Dependency Review and aggregate integration**

```sh
git add .github/workflows/ci.yml
git commit -m "ci: add dependency review to required checks"
```

## Task 5: Document The Final CI Contract

**Files:**

- Modify: `CONTRIBUTING.md`

- [ ] **Step 1: Update the stable job description**

Change the current CI paragraph to:

```md
CI publishes stable `Check`, `Build`, `Format`, `Dependency Review`, and
`Required Checks` results. `Dependency Review` runs only for pull requests and
rejects newly introduced moderate-or-higher vulnerabilities. `Required Checks`
is the branch-protection interface; it requires dependency review success on
pull requests and accepts the job's expected skip on pushes to `main`. The
individual validation jobs remain visible for diagnosis and are not required
directly.
```

Keep the following branch-protection paragraph staged in the future tense until
Rollout 3 changes repository settings.

- [ ] **Step 2: Validate and commit the documentation edit**

Run:

```sh
npx prettier --check CONTRIBUTING.md
git diff --check
git diff -- CONTRIBUTING.md
```

Expected: the docs describe the new job and event-specific aggregate without
claiming branch protection is already active.

Commit:

```sh
git add CONTRIBUTING.md
git commit -m "docs(ci): document dependency review gate"
```

## Task 6: Validate The Complete Rollout 2 Branch

**Files:**

- Verify all files in the File Map

- [ ] **Step 1: Run the complete local validation matrix**

Run each command and record its exact result:

```sh
node --version
npm --version
npm ci
npm audit --omit=dev
npm run lint
npm run check
npm run build
npm run zip
npm run format
npx prettier --check .github/workflows/*.yml CONTRIBUTING.md docs/superpowers/README.md
npx prettier --check --ignore-path /dev/null \
  docs/superpowers/plans/2026-09-13-ci-hardening-rollout-2-actions-dependency-review.md
git diff --check origin/main...HEAD
```

Expected: Node `v24.20.0`, npm `11.19.0`, zero production audit findings, all
commands exit zero, and 157 test files / 1,562 tests remain green. Record any
existing non-blocking warnings.

- [ ] **Step 2: Audit Action-reference immutability**

Run:

```sh
rg -n '^\s+uses:' .github/workflows
```

Expected: every external `uses:` reference is a 40-character SHA followed by
the reviewed release comment. No mutable major tag, branch, or abbreviated SHA
remains.

- [ ] **Step 3: Audit scope and preserved behavior**

Run:

```sh
git diff --name-status origin/main...HEAD
git diff --stat origin/main...HEAD
git diff origin/main...HEAD -- package.json package-lock.json \
  release-please-config.json .release-please-manifest.json
git log --oneline origin/main..HEAD
git status --short --branch
```

Expected: only the workflow files, contributor docs, plan, and planning index
change; package, lockfile, release configuration, application, permission, and
artifact inputs remain untouched; the worktree is clean.

- [ ] **Step 4: Re-read branch protection without changing it**

Run the Task 1 branch-protection query again. Expected: strict `true`, approval
count `1`, and no required contexts. Rollout 3 owns the external mutation.

## Task 7: Obtain Hosted Proof And Hand Off Rollout 3

**Files:**

- Verify hosted state only; do not modify branch protection

- [ ] **Step 1: Prepare and open the pull request after authorization**

Use this title:

```text
ci(deps): pin actions and add dependency review
```

The pull-request body must record:

- exact local command results and warnings;
- Action releases and immutable SHAs;
- unchanged triggers, inputs, permissions, secrets, package files, release
  behavior, and branch protection;
- `Manual smoke tested:` with the CI-only no-runtime rationale;
- `Skipped validation:` naming hosted PR proof, post-merge push proof, the next
  natural eligible Stale/Release Please runs, and local `actionlint` if absent;
- screenshots as N/A for a CI/docs-only change;
- release impact: none under the `ci(deps)` title policy; and
- rollback: revert the Action pins, dependency-review integration, and docs
  commits together.

- [ ] **Step 2: Verify the pull-request job graph**

Require successful hosted results for:

```text
Check
Build
Format
Dependency Review
Required Checks
Validate PR title
Validate PR body
```

Confirm the aggregate logs `pull_request` plus four `success` results. Confirm
Labeler v7 and Semantic Pull Request v6.1.1 execute successfully. If Dependency
Review is unavailable because of repository licensing or dependency graph
state, stop and reassess; do not add `warn-only`, reduce severity, or remove it
from the aggregate.

- [ ] **Step 3: Verify the post-merge push matrix**

After maintainer-authorized merge, follow the newest non-superseded CI run on
`main`. `Check`, `Build`, and `Format` must succeed; `Dependency Review` must be
`skipped`; `Required Checks` must succeed and log the expected push matrix.

Do not manually dispatch Stale or Release Please merely to test an upgrade,
because those workflows can mutate external state. Review them statically here;
their next natural scheduled or eligible run supplies hosted execution proof.

- [ ] **Step 4: Hand off Rollout 3**

Only after the pull-request and push-to-`main` matrices pass, proceed to the
separate branch-protection rollout. That rollout requires exactly
`Required Checks`, `Validate PR title`, and `Validate PR body`, while preserving
all unrelated branch settings.

## Done When

- Every external Action reference is pinned to a reviewed full release SHA with
  a version comment.
- `Dependency Review` rejects newly introduced moderate-or-higher
  vulnerabilities across runtime, development, and unknown scopes on pull
  requests without adding write permissions or comments.
- `Required Checks` accepts Dependency Review success on pull requests and its
  expected skip on pushes to `main`, while rejecting every unexpected result.
- Current CI, labeler, PR-title, release, and stale behavior remains otherwise
  unchanged.
- Full local validation, hosted pull-request proof, and post-merge push proof
  pass.
- Branch protection remains unchanged until Rollout 3.
