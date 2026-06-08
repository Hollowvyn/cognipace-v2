# GitHub Governance Templates Design

## Context

CogniPace v2 has strong agent governance docs, but the repository GitHub
surface is still thin. Current v2 has CI, PR title validation, and Release
Please workflows, but it does not yet have PR templates, issue templates,
project automation guidance, stale PR handling, or PR body hygiene checks.

The previous CogniPace repository had useful `.github` templates and workflows,
but those templates were lighter than the current governance expectations and
some workflows were tied to older repository structure or agent conventions.
This design restores the useful GitHub surface first, so humans and agents must
work through the same low-friction repository guardrails before any additional
agent-specific tightening.

## Goals

- Add concise PR and issue templates that engineers will actually fill out.
- Make PRs link to GitHub issues through the PR body, so GitHub Development
  links and auto-close behavior work.
- Use separate Story, Bug, and Task issue templates with direct type labels.
- Prefer GitHub Project built-in automation for adding issues and PRs to the
  CogniPace Project.
- Add GitHub Actions checks for objective PR hygiene, stale PR handling, and
  path labeling before adding heavier agent-specific automation.
- Keep quality proof centered on proper testing, not long PR prose.

## Non-Goals

- Do not implement the templates or workflows in this design pass.
- Do not add agent-specific PR conventions as the first enforcement layer.
- Do not require a full release-impact section for every PR.
- Do not rely on PR titles for issue closure or Development links.
- Do not add Project write-token automation unless built-in Project automation
  is insufficient.
- Do not make every PR run every possible command; CI can become path-aware
  where needed.

## PR Template

The PR template should be concise and review-focused:

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

The title remains Conventional Commit format, such as
`ci(github): add lightweight PR template`. The `Issue` section owns issue
linking. GitHub closing keywords such as `Closes #123`, `Fixes #123`, and
`Resolves #123` belong in the PR body or commit message, not the PR title.

The template is intentionally short. The testing section makes engineers state
which repository gates passed, which tests were added, which smoke flow was
checked, and which validation was skipped. The template does not duplicate the
full validation matrix; `docs/agent-governance.md` remains the source of truth
for choosing validation by risk area.

## Issue Templates

Create three issue templates. Each template should apply one type label by
default. Keep fields simple.

### Story

Use for user-facing feature or behavior requests.

Default label:

- `type: story`

Fields:

- `Details`: what should change and why.
- `Done when`: what outcome makes this complete.
- `Area`: Popup, Dashboard, Overlay, Background/runtime,
  Sync/backup/restore, Settings, Build/test/release, Docs/process, or Not sure.

### Bug

Use for broken or incorrect behavior.

Default label:

- `type: bug`

Fields:

- `Details`: what happened, including expected versus actual behavior when
  useful.
- `Reproduce`: steps, screenshot, log, or N/A.
- `Area`: Popup, Dashboard, Overlay, Background/runtime,
  Sync/backup/restore, Settings, Build/test/release, Docs/process, or Not sure.

### Task

Use for engineering, docs, tests, CI, cleanup, and maintenance work.

Default label:

- `type: task`

Fields:

- `Details`: what needs doing and why.
- `Done when`: what outcome or evidence makes this complete.
- `Area`: Popup, Dashboard, Overlay, Background/runtime, Database,
  Sync/backup/restore, Settings, Build/test/release, Docs/process, or Not sure.

### Issue Config

Disable blank issues. Keep a private security contact link so vulnerabilities
are not reported publicly.

## Labels

Add the type labels before relying on the issue templates:

| Label         | Purpose                                            | Suggested color   |
| ------------- | -------------------------------------------------- | ----------------- |
| `type: story` | User-facing feature or behavior request            | Green or blue     |
| `type: bug`   | Broken or incorrect behavior                       | Red               |
| `type: task`  | Engineering, docs, tests, CI, cleanup, maintenance | Purple or neutral |

Area labels can be added by a later labeler workflow. Type labels should come
directly from the issue templates, so issues are categorized immediately.

## Project Automation

Project membership is separate from issue closure. Use both:

- PR body issue links such as `Closes #123` for GitHub Development linking and
  automatic issue closure on merge into the default branch.
- GitHub Projects built-in auto-add rules to add new CogniPace issues and PRs to
  the CogniPace Project.

Prefer built-in Project automation because it avoids repository secrets and
custom token handling. If built-in automation cannot add the needed items, add a
later workflow using GitHub Projects v2 GraphQL or `actions/add-to-project` with
an explicit project write token.

## Workflow Plan

### Keep Current

- `.github/workflows/ci.yml`: required quality gate via `npm run check`.
- `.github/workflows/pr-title.yml`: Conventional Commit PR title validation.
- `.github/workflows/release-please.yml`: release PR and extension artifact
  flow.

### Add Now

- `.github/PULL_REQUEST_TEMPLATE.md` using the concise template above.
- `.github/ISSUE_TEMPLATE/story.yml`, `bug.yml`, `task.yml`, and `config.yml`.
- `.github/workflows/pr-hygiene.yml` as a blocking PR body check.
  - Require `Details`, `Issue`, `Testing`, and `Screenshots` headings.
  - Require either a closing keyword reference or `No issue - <reason>`.
  - Fail obvious placeholders such as `Closes #`, `[reason]`, or empty required
    sections.
  - Keep validation content checks shallow; CI should enforce commands.
- `.github/workflows/stale-prs.yml`.
  - Target pull requests only.
  - Leave issues untouched.
  - Use a long inactivity window so useful work is not closed aggressively.
- `.github/labeler.yml` and a labeler workflow for path-based area labels.
  - Apply labels for `.github`, docs/process, runtime, database, UI surfaces,
    sync/backup/restore, tests, and release/package paths.
  - Do not replace issue type labels.

### Add Later

- Path-aware validation workflows.
  - Require `npm run build` for extension behavior, runtime, sync, database,
    CI/workflow/package, and surface behavior changes.
  - Require `npm run zip` for release/package artifact changes.
- Dependabot configuration and possible cautious auto-merge after CI is stable.
- Dependency review, CodeQL, or deeper analysis if it gives useful signal
  without too much noise.
- Agent-specific PR convention checks only after templates and repository
  enforcement are stable.

## Validation Strategy

This design is docs/governance only. Implementation should validate Markdown
formatting for touched docs. Template/workflow implementation should use the
governance validation matrix:

- Template-only changes: Prettier on touched Markdown and YAML where applicable.
- Workflow changes: `npm run check`, plus static review of affected GitHub
  Actions behavior.
- Release/package workflow changes: `npm run check`, `npm run build`, and
  `npm run zip` when artifact behavior is touched.

## Acceptance Criteria

- CogniPace has a concise PR template with Details, Issue, Testing, and
  Screenshots sections.
- PR bodies link issues through closing keywords or document a no-issue reason.
- Story, Bug, and Task issue templates exist and apply `type:*` labels directly.
- Blank issues are disabled and a private security contact is present.
- New issues and PRs are added to the CogniPace Project through built-in Project
  automation or a documented fallback plan.
- PR hygiene checks block missing headings, missing issue linkage, and obvious
  placeholders.
- Stale PR automation exists for inactive pull requests and does not close
  issues.
- Path labeler automation exists or is planned before deeper path-aware
  validation.
- Agent-specific enforcement is deferred until repository templates and GitHub
  checks are stable.
