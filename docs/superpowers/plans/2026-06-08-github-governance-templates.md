# GitHub Governance Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add low-friction GitHub PR and issue templates plus first-pass workflow guardrails for PR hygiene, stale PRs, labels, and Project tracking.

**Architecture:** Keep GitHub governance mostly declarative in `.github` files. Use templates for human-entered context, GitHub Actions for objective checks, GitHub issue labels for Bug/Task categorization, and built-in GitHub Project automation for Project membership before adding token-backed Project workflows.

**Tech Stack:** GitHub issue forms, GitHub Actions, `actions/labeler`, `actions/stale`, Node.js inside Actions, Prettier for Markdown/YAML formatting, existing npm validation scripts.

---

## File Structure

- Create `.github/PULL_REQUEST_TEMPLATE.md`: concise PR body template with Details, Issue, Testing, and Screenshots.
- Create `.github/ISSUE_TEMPLATE/bug.yml`: Bug issue form with `type: bug` label.
- Create `.github/ISSUE_TEMPLATE/task.yml`: Task issue form with `type: task` label.
- Create `.github/ISSUE_TEMPLATE/config.yml`: disables blank issues and keeps private security contact.
- Create `.github/workflows/pr-hygiene.yml`: blocks PRs with missing template headings, missing issue links/no-issue reason, or obvious unfilled prompt text.
- Use inline stale workflow configuration in `.github/workflows/stale-prs.yml`; do not create a separate `.github/stale.yml`.
- Create `.github/workflows/stale-prs.yml`: marks and closes inactive PRs while leaving issues untouched.
- Create `.github/labeler.yml`: path-based area label rules for PRs.
- Create `.github/workflows/labeler.yml`: runs `actions/labeler` for pull requests.

Repository settings outside git:

- Create or update labels `type: bug`, `type: task`, `status: stale`, `keep-open`, and area labels used by `.github/labeler.yml`.
- Configure GitHub Projects built-in auto-add for new issues and pull requests in the CogniPace repository.

## Task 1: Repository Labels And Project Setup

**Files:**

- No file changes.

- [ ] **Step 1: Confirm repository remote**

Run:

```bash
gh repo view --json nameWithOwner --jq .nameWithOwner
```

Expected: prints the CogniPace repository in `owner/name` form.

- [ ] **Step 2: Create or update type labels**

Run these commands from `/Users/tobiolutimehin/WebstormProjects/cognipace-v2`:

```bash
gh label create "type: bug" --color "d73a4a" --description "Broken or incorrect behavior" || gh label edit "type: bug" --color "d73a4a" --description "Broken or incorrect behavior"
gh label create "type: task" --color "6f42c1" --description "Planned product, engineering, docs, tests, CI, cleanup, or maintenance work" || gh label edit "type: task" --color "6f42c1" --description "Planned product, engineering, docs, tests, CI, cleanup, or maintenance work"
```

Expected: labels exist with the requested names, colors, and descriptions.

- [ ] **Step 3: Create or update workflow labels**

Run:

```bash
gh label create "status: stale" --color "ededed" --description "Inactive pull request marked by stale automation" || gh label edit "status: stale" --color "ededed" --description "Inactive pull request marked by stale automation"
gh label create "keep-open" --color "0e8a16" --description "Prevent stale automation from closing this issue or pull request" || gh label edit "keep-open" --color "0e8a16" --description "Prevent stale automation from closing this issue or pull request"
gh label create "area: github" --color "5319e7" --description "GitHub templates, workflows, labels, or repository automation" || gh label edit "area: github" --color "5319e7" --description "GitHub templates, workflows, labels, or repository automation"
gh label create "area: docs" --color "0075ca" --description "Documentation or process docs" || gh label edit "area: docs" --color "0075ca" --description "Documentation or process docs"
gh label create "area: popup" --color "1d76db" --description "Popup surface" || gh label edit "area: popup" --color "1d76db" --description "Popup surface"
gh label create "area: dashboard" --color "1d76db" --description "Dashboard surface" || gh label edit "area: dashboard" --color "1d76db" --description "Dashboard surface"
gh label create "area: overlay" --color "1d76db" --description "LeetCode overlay surface" || gh label edit "area: overlay" --color "1d76db" --description "LeetCode overlay surface"
gh label create "area: runtime" --color "fbca04" --description "Extension runtime, background, or messaging" || gh label edit "area: runtime" --color "fbca04" --description "Extension runtime, background, or messaging"
gh label create "area: database" --color "bfdadc" --description "Database, Drizzle schema, migrations, or persistence" || gh label edit "area: database" --color "bfdadc" --description "Database, Drizzle schema, migrations, or persistence"
gh label create "area: sync" --color "c2e0c6" --description "Sync, backup, restore, GitHub Gist, or external data movement" || gh label edit "area: sync" --color "c2e0c6" --description "Sync, backup, restore, GitHub Gist, or external data movement"
gh label create "area: tests" --color "f9d0c4" --description "Tests or test infrastructure" || gh label edit "area: tests" --color "f9d0c4" --description "Tests or test infrastructure"
gh label create "area: release" --color "fef2c0" --description "Release, package, build artifact, or store handoff" || gh label edit "area: release" --color "fef2c0" --description "Release, package, build artifact, or store handoff"
```

Expected: all labels exist. If `gh` reports that a label exists, the `edit` side updates it.

- [ ] **Step 4: Configure GitHub Project auto-add**

In GitHub, open the CogniPace Project settings and configure built-in workflows:

1. Add items from repository: CogniPace.
2. Auto-add new issues from the CogniPace repository.
3. Auto-add new pull requests from the CogniPace repository.
4. Set initial status to Todo.

Expected: newly opened CogniPace issues and PRs appear in the CogniPace Project without a repository workflow token.

## Task 2: Add Concise PR Template

**Files:**

- Create: `.github/PULL_REQUEST_TEMPLATE.md`

- [ ] **Step 1: Create PR template**

Create `.github/PULL_REQUEST_TEMPLATE.md` with:

```md
## Details

[What changed, why, and anything reviewers should pay close attention to.]

## Issue

Closes #

<!-- Or: No issue - short reason -->

## Testing

- [ ] `npm run check` passed
  - db check
  - typecheck
  - lint
  - tests
- [ ] `npm run build` passed, or N/A: [reason]
- [ ] `npm run zip` passed, or N/A: [reason]
- [ ] Added/updated needed tests: [unit, runtime/integration, UI/component, or N/A]
- [ ] Manual smoke tested: [flow, or N/A]
- [ ] Skipped validation: [commands/flows skipped and reason, or None]

## Screenshots

[Required for visible popup, dashboard, or overlay changes. Otherwise: N/A]
```

- [ ] **Step 2: Format PR template**

Run:

```bash
npx prettier --write .github/PULL_REQUEST_TEMPLATE.md
```

Expected: Prettier finishes without errors.

- [ ] **Step 3: Commit PR template**

Run:

```bash
git add .github/PULL_REQUEST_TEMPLATE.md
git commit -m "docs(github): add pull request template"
```

Expected: commit succeeds.

## Task 3: Add Bug And Task Issue Forms

**Files:**

- Create: `.github/ISSUE_TEMPLATE/bug.yml`
- Create: `.github/ISSUE_TEMPLATE/task.yml`
- Create: `.github/ISSUE_TEMPLATE/config.yml`

- [ ] **Step 1: Create issue template directory**

Run:

```bash
mkdir -p .github/ISSUE_TEMPLATE
```

Expected: `.github/ISSUE_TEMPLATE` exists.

- [ ] **Step 2: Add Bug issue form**

Create `.github/ISSUE_TEMPLATE/bug.yml` with:

```yaml
name: Bug
description: Report broken or incorrect CogniPace behavior.
title: '[Bug]: '
labels:
  - 'type: bug'
body:
  - type: textarea
    id: details
    attributes:
      label: Details
      description: What happened? Include expected vs actual behavior if useful.
    validations:
      required: true

  - type: textarea
    id: reproduce
    attributes:
      label: Reproduce
      description: Steps, screenshot, log, or N/A.

  - type: dropdown
    id: area
    attributes:
      label: Area
      multiple: true
      options:
        - Popup
        - Dashboard
        - Overlay
        - Background/runtime
        - Sync/backup/restore
        - Settings
        - Build/test/release
        - Docs/process
        - Not sure
```

- [ ] **Step 3: Add Task issue form**

Create `.github/ISSUE_TEMPLATE/task.yml` with:

```yaml
name: Task
description: Request planned product, engineering, docs, tests, CI, cleanup, or maintenance work.
title: '[Task]: '
labels:
  - 'type: task'
body:
  - type: textarea
    id: details
    attributes:
      label: Details
      description: What needs doing and why?
    validations:
      required: true

  - type: textarea
    id: done
    attributes:
      label: Done when
      description: What outcome or evidence makes this complete?

  - type: dropdown
    id: area
    attributes:
      label: Area
      multiple: true
      options:
        - Popup
        - Dashboard
        - Overlay
        - Background/runtime
        - Database
        - Sync/backup/restore
        - Settings
        - Build/test/release
        - Docs/process
        - Not sure
```

- [ ] **Step 4: Disable blank issues and add security contact**

Create `.github/ISSUE_TEMPLATE/config.yml` with:

```yaml
blank_issues_enabled: false
contact_links:
  - name: Security report
    url: mailto:olutimehintobi@gmail.com?subject=Security%20Report%20for%20CogniPace
    about: Report vulnerabilities privately instead of opening a public issue.
```

- [ ] **Step 5: Format issue forms**

Run:

```bash
npx prettier --write .github/ISSUE_TEMPLATE/bug.yml .github/ISSUE_TEMPLATE/task.yml .github/ISSUE_TEMPLATE/config.yml
```

Expected: Prettier finishes without errors.

- [ ] **Step 6: Commit issue forms**

Run:

```bash
git add .github/ISSUE_TEMPLATE/bug.yml .github/ISSUE_TEMPLATE/task.yml .github/ISSUE_TEMPLATE/config.yml
git commit -m "docs(github): add issue templates"
```

Expected: commit succeeds.

## Task 4: Add PR Hygiene Workflow

**Files:**

- Create: `.github/workflows/pr-hygiene.yml`

- [ ] **Step 1: Add PR hygiene workflow**

Create `.github/workflows/pr-hygiene.yml` with:

```yaml
name: PR Hygiene

on:
  pull_request:
    types:
      - opened
      - reopened
      - edited
      - synchronize
      - ready_for_review

permissions:
  pull-requests: read

jobs:
  validate:
    name: Validate PR body
    runs-on: ubuntu-latest

    steps:
      - name: Check PR template fields
        shell: bash
        run: |
          node <<'NODE'
          const fs = require('fs');

          const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
          const body = event.pull_request?.body || '';
          const failures = [];

          const requiredHeadings = ['## Details', '## Issue', '## Testing', '## Screenshots'];

          for (const heading of requiredHeadings) {
            if (!body.includes(heading)) {
              failures.push(`Missing required heading: ${heading}`);
            }
          }

          function sectionAfter(heading) {
            const start = body.indexOf(heading);
            if (start === -1) {
              return '';
            }

            const afterHeading = body.slice(start + heading.length);
            const nextHeading = afterHeading.search(/\n##\s+/);

            if (nextHeading === -1) {
              return afterHeading.trim();
            }

            return afterHeading.slice(0, nextHeading).trim();
          }

          const details = sectionAfter('## Details');
          const issue = sectionAfter('## Issue');
          const testing = sectionAfter('## Testing');
          const screenshots = sectionAfter('## Screenshots');

          if (!details || details.includes('[What changed')) {
            failures.push('Details must describe the change and cannot keep template prompt text.');
          }

          const closingKeyword = /\b(close|closes|closed|fix|fixes|fixed|resolve|resolves|resolved)\s+([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+#\d+|#\d+)/i;
          const noIssue = /\bNo issue\s*-\s*\S.{2,}/i;

          if (!closingKeyword.test(issue) && !noIssue.test(issue)) {
            failures.push('Issue must include a closing keyword such as "Closes #123" or "No issue - <reason>".');
          }

          if (/Closes\s*#\s*$/i.test(issue.trim())) {
            failures.push('Issue still contains an empty "Closes #" prompt.');
          }

          if (!testing.includes('npm run check')) {
            failures.push('Testing must mention npm run check.');
          }

          if (testing.includes('[reason]') || testing.includes('[flow') || testing.includes('[commands/flows')) {
            failures.push('Testing must replace template prompt text with validation results or N/A reasons.');
          }

          if (!/Skipped validation:\s*(None|N\/A|.+)/i.test(testing)) {
            failures.push('Testing must state skipped validation, even when the answer is None.');
          }

          if (!screenshots || screenshots.includes('[Required for visible')) {
            failures.push('Screenshots must include evidence or N/A.');
          }

          if (failures.length > 0) {
            console.error('PR hygiene check failed:');
            for (const failure of failures) {
              console.error(`- ${failure}`);
            }
            process.exit(1);
          }

          console.log('PR hygiene check passed.');
          NODE
```

- [ ] **Step 2: Format PR hygiene workflow**

Run:

```bash
npx prettier --write .github/workflows/pr-hygiene.yml
```

Expected: Prettier finishes without errors.

- [ ] **Step 3: Static review PR hygiene workflow**

Run:

```bash
sed -n '1,220p' .github/workflows/pr-hygiene.yml
```

Expected:

- Workflow uses `pull_request`, not `pull_request_target`.
- Workflow has read-only `pull-requests` permission.
- Workflow does not checkout untrusted PR code.
- Workflow reads only `$GITHUB_EVENT_PATH`.

- [ ] **Step 4: Commit PR hygiene workflow**

Run:

```bash
git add .github/workflows/pr-hygiene.yml
git commit -m "ci(github): validate pull request bodies"
```

Expected: commit succeeds.

## Task 5: Add Stale PR Workflow

**Files:**

- Create: `.github/workflows/stale-prs.yml`

- [ ] **Step 1: Add stale PR workflow**

Create `.github/workflows/stale-prs.yml` with:

```yaml
name: Close Stale PRs

on:
  schedule:
    - cron: '0 14 * * 3'
  workflow_dispatch:

permissions:
  issues: write
  pull-requests: write

jobs:
  stale:
    name: Mark and close stale pull requests
    runs-on: ubuntu-latest

    steps:
      - name: Run stale policy
        uses: actions/stale@v10
        with:
          days-before-pr-stale: 60
          days-before-pr-close: 7
          stale-pr-label: 'status: stale'
          exempt-pr-labels: 'keep-open'
          stale-pr-message: 'This pull request has been inactive for 60 days. Add the `keep-open` label or push an update if it should stay open.'
          close-pr-message: 'Closing this pull request after 67 days of inactivity. Reopen it when the work is ready to continue.'
          days-before-issue-stale: -1
          days-before-issue-close: -1
```

- [ ] **Step 2: Format stale workflow**

Run:

```bash
npx prettier --write .github/workflows/stale-prs.yml
```

Expected: Prettier finishes without errors.

- [ ] **Step 3: Commit stale workflow**

Run:

```bash
git add .github/workflows/stale-prs.yml
git commit -m "ci(github): close stale pull requests"
```

Expected: commit succeeds.

## Task 6: Add Path Labeler

**Files:**

- Create: `.github/labeler.yml`
- Create: `.github/workflows/labeler.yml`

- [ ] **Step 1: Add labeler configuration**

Create `.github/labeler.yml` with:

```yaml
'area: github':
  - changed-files:
      - any-glob-to-any-file:
          - '.github/**/*'

'area: docs':
  - changed-files:
      - any-glob-to-any-file:
          - '**/*.md'
          - 'docs/**/*'
          - 'design.md'
          - 'AGENTS.md'
          - 'CLAUDE.md'

'area: popup':
  - changed-files:
      - any-glob-to-any-file:
          - 'src/entrypoints/popup/**/*'
          - 'src/app/popup/**/*'
          - 'src/features/app-shell/**/*'

'area: dashboard':
  - changed-files:
      - any-glob-to-any-file:
          - 'src/entrypoints/dashboard/**/*'
          - 'src/app/dashboard/**/*'

'area: overlay':
  - changed-files:
      - any-glob-to-any-file:
          - 'src/entrypoints/leetcode.content.tsx'
          - 'src/app/overlay/**/*'
          - 'src/features/overlay-session/**/*'
          - 'src/features/leetcode-capture/**/*'

'area: runtime':
  - changed-files:
      - any-glob-to-any-file:
          - 'src/entrypoints/background.ts'
          - 'src/extension/**/*'

'area: database':
  - changed-files:
      - any-glob-to-any-file:
          - 'drizzle.config.ts'
          - 'src/platform/db/**/*'
          - 'src/features/*/data/**/*'

'area: sync':
  - changed-files:
      - any-glob-to-any-file:
          - 'src/features/sync/**/*'
          - 'src/features/settings/**/*backup*'
          - 'src/lib/github/**/*'
          - 'src/platform/secrets/**/*'

'area: tests':
  - changed-files:
      - any-glob-to-any-file:
          - 'src/**/*.test.ts'
          - 'src/**/*.test.tsx'
          - 'src/testing/**/*'

'area: release':
  - changed-files:
      - any-glob-to-any-file:
          - '.github/workflows/release-please.yml'
          - 'release-please-config.json'
          - '.release-please-manifest.json'
          - 'package.json'
          - 'package-lock.json'
          - 'wxt.config.ts'
```

- [ ] **Step 2: Add labeler workflow**

Create `.github/workflows/labeler.yml` with:

```yaml
name: PR Labeler

on:
  pull_request_target:
    types:
      - opened
      - reopened
      - synchronize

permissions:
  contents: read
  pull-requests: write

jobs:
  labeler:
    name: Apply area labels
    runs-on: ubuntu-latest

    steps:
      - name: Label pull request
        uses: actions/labeler@v6
        with:
          repo-token: '${{ secrets.GITHUB_TOKEN }}'
          configuration-path: .github/labeler.yml
          sync-labels: true
```

- [ ] **Step 3: Format labeler files**

Run:

```bash
npx prettier --write .github/labeler.yml .github/workflows/labeler.yml
```

Expected: Prettier finishes without errors.

- [ ] **Step 4: Static review labeler workflow**

Run:

```bash
sed -n '1,180p' .github/workflows/labeler.yml
sed -n '1,260p' .github/labeler.yml
```

Expected:

- Labeler workflow does not run repository code.
- `pull_request_target` is limited to labeling.
- Area labels match labels created in Task 1.

- [ ] **Step 5: Commit labeler**

Run:

```bash
git add .github/labeler.yml .github/workflows/labeler.yml
git commit -m "ci(github): label pull requests by area"
```

Expected: commit succeeds.

## Task 7: Final Validation

**Files:**

- Validate all files touched by Tasks 2 through 6.

- [ ] **Step 1: Run formatting check for touched Markdown and YAML**

Run:

```bash
npx prettier --check .github/PULL_REQUEST_TEMPLATE.md .github/ISSUE_TEMPLATE/bug.yml .github/ISSUE_TEMPLATE/task.yml .github/ISSUE_TEMPLATE/config.yml .github/workflows/pr-hygiene.yml .github/workflows/stale-prs.yml .github/labeler.yml .github/workflows/labeler.yml
```

Expected: all files use Prettier code style.

- [ ] **Step 2: Run repository check**

Run:

```bash
npm run check
```

Expected: passes. This command runs Drizzle check, WXT type generation, TypeScript, ESLint, and Vitest.

- [ ] **Step 3: Build extension**

Run:

```bash
npm run build
```

Expected: WXT builds the Chrome MV3 extension successfully.

- [ ] **Step 4: Decide whether to run zip**

Run:

```bash
npm run zip
```

Expected: WXT creates an extension zip under `.output`.

Reason: this implementation touches GitHub release/package guardrails and the PR template explicitly asks authors to think about `npm run zip`; running it here confirms the packaging command still works.

- [ ] **Step 5: Final static review**

Run:

```bash
git diff --check
git status --short
```

Expected:

- `git diff --check` prints no whitespace errors.
- `git status --short` shows only intentional files if final commits have not yet been made, or a clean worktree if all task commits were made.

- [ ] **Step 6: Final handoff**

Final handoff must include:

- What changed.
- Issue context or documented no-issue reason.
- Exact validation commands run.
- Exact validation skipped and why.
- Remaining risk, especially that Project auto-add requires GitHub repository settings outside git.
- Whether `.github` workflow behavior was validated locally, by static review, or by PR run.
