# Dependency And CI Phase 1 Toolchain Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore deterministic local and GitHub installs with one pinned Node
and npm toolchain, repair the lockfile under that toolchain, and make the
existing validation path pass its current alarm scheduler typecheck.

**Architecture:** Keep this pull request at the toolchain-baseline boundary.
Declare the same Node/npm contract for contributors, npm, CI, and release
builds; regenerate the npm lockfile mechanically; and replace the scheduler's
handwritten alarm-create shape with WXT's exact browser type. Do not redesign CI
or update dependency constraints in this pull request.

**Tech Stack:** Node.js 24.20.0, npm 11.19.0, npm lockfile v3, WXT, TypeScript,
Vitest, GitHub Actions.

**Approved design:**
[`../specs/2026-09-12-dependency-ci-modernization-design.md`](../specs/2026-09-12-dependency-ci-modernization-design.md)

## Scope And Pull Request Boundary

This plan implements only the first pull request in the approved modernization
sequence:

- pin Node 24.20.0 and npm 11.19.0;
- repair `package-lock.json` with that exact toolchain;
- fix the existing Chrome alarm typecheck without changing behavior;
- make the current CI and release workflows consume the pinned toolchain; and
- document the contributor setup contract.

The following work remains in later pull requests and must not be pulled into
this implementation:

- Prettier scope and repository-wide formatting normalization;
- CI job splitting, concurrency, dependency review, and required-check
  aggregation;
- GitHub Actions major-version upgrades;
- branch-protection changes;
- npm dependency updates or security remediation;
- Dependabot configuration; and
- product, permission, persistence, or sync behavior changes.

## File Map

| File                                                         | Responsibility in this phase                                                       |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `.nvmrc`                                                     | Pin the supported Node patch for local tools and Actions.                          |
| `package.json`                                               | Declare the exact Node/npm runtime and package-manager contract.                   |
| `package-lock.json`                                          | Record a clean npm 11.19.0 dependency graph without dependency upgrades.           |
| `.github/workflows/ci.yml`                                   | Use `.nvmrc`, install the pinned npm, and report tool versions before `npm ci`.    |
| `.github/workflows/release-please.yml`                       | Use the same toolchain for release validation and packaging.                       |
| `src/extension/background/scheduler/alarm-scheduler.ts`      | Reuse WXT's exact alarm creation type.                                             |
| `src/extension/background/scheduler/alarm-scheduler.test.ts` | Reuse the production type in the fake adapter while preserving scheduler coverage. |
| `README.md`                                                  | Give contributors the deterministic quick-start commands.                          |
| `docs/testing.md`                                            | Make test setup match CI and release builds.                                       |
| `CONTRIBUTING.md`                                            | State the repository toolchain agreement.                                          |

## Task 1: Pin The Toolchain And Repair The Lockfile

**Files:**

- Create: `.nvmrc`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Activate the audited toolchain before changing package metadata**

Run:

```sh
nvm install 24.20.0
nvm use 24.20.0
npm install --global npm@11.19.0
node --version
npm --version
```

Expected versions:

```text
v24.20.0
11.19.0
```

If either exact version is unavailable, stop and refresh the Node 24/npm 11
patch choice in the approved design and this plan before changing files. Do not
silently substitute another major version.

- [ ] **Step 2: Reproduce the clean-install failure before repairing it**

Run:

```sh
npm ci
```

Expected RED result: npm exits with `EUSAGE` because the current lockfile is
missing transitive entries including `@emnapi/core` and `@emnapi/runtime`.
Preserve the exact error in the implementation notes. If the install already
passes, compare the active versions with Step 1 and inspect the lockfile before
continuing; do not regenerate it without demonstrating why.

- [ ] **Step 3: Add the repository toolchain contract**

Create `.nvmrc`:

```text
24.20.0
```

In `package.json`, insert the following immediately after `"version"` and
before `"type"`:

```json
"packageManager": "npm@11.19.0",
"engines": {
  "node": "24.20.0",
  "npm": "11.19.0"
},
"devEngines": {
  "runtime": {
    "name": "node",
    "version": "24.20.0",
    "onFail": "error"
  },
  "packageManager": {
    "name": "npm",
    "version": "11.19.0",
    "onFail": "error"
  }
},
```

Format only the manifest:

```sh
npx prettier --write package.json
```

- [ ] **Step 4: Regenerate only the lockfile under the pinned toolchain**

Run:

```sh
node --version
npm --version
npm install --package-lock-only --ignore-scripts
git diff -- package.json package-lock.json
```

Expected result:

- the root lockfile package records the new toolchain metadata;
- missing transitive packages required by npm 11.19.0 appear;
- direct dependency constraints in `package.json` do not change; and
- the diff contains no opportunistic dependency update.

If npm re-resolves unrelated packages, inspect each change and constrain this
task to the minimum graph npm 11.19.0 needs for a clean install. Do not absorb a
dependency batch into this pull request.

- [ ] **Step 5: Prove the repaired lockfile installs cleanly**

Run:

```sh
npm ci
npm audit --omit=dev
```

Expected result: both commands exit zero and the production audit reports zero
vulnerabilities. Record full-tree development advisories separately; they are
owned by later dependency phases.

- [ ] **Step 6: Commit the toolchain and lockfile unit**

Run:

```sh
git add .nvmrc package.json package-lock.json
git commit -m "build(toolchain): pin Node and npm versions"
```

## Task 2: Make The Alarm Scheduler Use The Exact Browser Type

**Files:**

- Modify: `src/extension/background/scheduler/alarm-scheduler.ts`
- Modify: `src/extension/background/scheduler/alarm-scheduler.test.ts`

- [ ] **Step 1: Confirm the existing typecheck failure**

Run:

```sh
npm run typecheck
```

Expected RED result: TypeScript reports `TS2769` at the
`browser.alarms.create(name, info)` call because the local `AlarmInfo` shape is
not assignable to WXT's browser alarm creation input.

- [ ] **Step 2: Replace the handwritten production shape with WXT's type**

Change the import and exported alias in
`src/extension/background/scheduler/alarm-scheduler.ts` to:

```ts
import { browser, type Browser } from 'wxt/browser'

export type AlarmInfo = Browser.alarms.AlarmCreateInfo
```

Leave the `AlarmAdapter`, registered-job checks, startup repair, clear, and
listener behavior unchanged. This is a type-alignment fix, not a scheduler
redesign.

- [ ] **Step 3: Make the fake adapter share the production type**

Change the test import to:

```ts
import {
  createAlarmScheduler,
  type AlarmAdapter,
  type AlarmInfo,
} from './alarm-scheduler'
```

Delete the test-local `AlarmInfo` declaration. Keep
`FakeAlarmAdapter.created` as:

```ts
created: Array<[string, AlarmInfo]>
```

This prevents the fake and production adapter contracts from drifting apart.

- [ ] **Step 4: Run the focused scheduler regression suite**

Run:

```sh
npm test -- src/extension/background/scheduler/alarm-scheduler.test.ts --run
```

Expected result: the scheduler suite passes, including alarm creation, startup
repair, duplicate protection, unknown alarm handling, clear, and unsubscribe
coverage.

- [ ] **Step 5: Prove the typecheck is green**

Run:

```sh
npm run typecheck
```

Expected result: TypeScript exits zero. If a new error appears after the WXT
type is adopted, fix only the adapter boundary or its fake; do not widen the
browser type with casts or add a second local shape.

- [ ] **Step 6: Commit the focused runtime type fix**

Run:

```sh
git add src/extension/background/scheduler/alarm-scheduler.ts \
  src/extension/background/scheduler/alarm-scheduler.test.ts
git commit -m "fix(runtime): align alarm scheduler browser types"
```

## Task 3: Align Existing CI And Release Builds With The Toolchain

**Files:**

- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/release-please.yml`

- [ ] **Step 1: Record the current floating setup**

Run:

```sh
rg -n "setup-node|node-version|npm ci" \
  .github/workflows/ci.yml \
  .github/workflows/release-please.yml
```

Expected RED evidence: both workflows request the floating Node line
`node-version: '24'`, and neither explicitly installs or reports npm 11.19.0.

- [ ] **Step 2: Update the current CI job without redesigning it**

In `.github/workflows/ci.yml`, change the setup and install portion to:

```yaml
- name: Setup Node
  uses: actions/setup-node@v4
  with:
    node-version-file: '.nvmrc'
    cache: npm

- name: Install pinned npm
  run: npm install --global npm@11.19.0

- name: Show toolchain versions
  run: |
    node --version
    npm --version

- name: Install dependencies
  run: npm ci
```

Keep the job name `Check`, triggers, permissions, runner, and `npm run check`
unchanged. The stable job redesign belongs to the later CI phase.

- [ ] **Step 3: Apply the same setup to release artifacts**

In `.github/workflows/release-please.yml`:

- replace `node-version: '24'` with `node-version-file: '.nvmrc'`;
- add `Install pinned npm` and `Show toolchain versions` steps after Setup Node;
- copy the existing release-created `if` condition onto both new steps; and
- leave Release Please, checkout ref, validation, build, zip, and upload logic
  unchanged.

The inserted steps should be:

```yaml
- name: Install pinned npm
  if: ${{ steps.release.outputs.release_created == 'true' }}
  run: npm install --global npm@11.19.0

- name: Show toolchain versions
  if: ${{ steps.release.outputs.release_created == 'true' }}
  run: |
    node --version
    npm --version
```

- [ ] **Step 4: Statically validate the workflow edit**

Run:

```sh
npx prettier --check .github/workflows/ci.yml \
  .github/workflows/release-please.yml
rg -n "node-version: '24'" .github/workflows
rg -n "node-version-file|npm@11.19.0|Show toolchain versions" \
  .github/workflows/ci.yml \
  .github/workflows/release-please.yml
git diff --check
git diff -- .github/workflows/ci.yml .github/workflows/release-please.yml
```

Expected result: Prettier and whitespace checks pass; the old floating Node
setting has no matches in these workflows; and both paths show the same pinned
setup. Do not upgrade `actions/setup-node`, `actions/checkout`, or Release
Please here.

- [ ] **Step 5: Commit the workflow alignment**

Run:

```sh
git add .github/workflows/ci.yml .github/workflows/release-please.yml
git commit -m "ci: use the pinned Node toolchain"
```

## Task 4: Document The Deterministic Contributor Setup

**Files:**

- Modify: `README.md`
- Modify: `docs/testing.md`
- Modify: `CONTRIBUTING.md`

- [ ] **Step 1: Update the README quick start**

Replace the Getting Started command block with:

```sh
nvm install
nvm use
npm install --global npm@11.19.0
npm ci
npm run dev
```

Immediately after it, explain that `.nvmrc` pins Node and `package.json` pins
npm so local installs use the same toolchain as CI and release builds. Keep the
existing WXT and Chrome loading guidance.

- [ ] **Step 2: Update the testing setup**

Replace the dependency-install block in `docs/testing.md` with:

```sh
nvm install
nvm use
npm install --global npm@11.19.0
npm ci
```

Add one sentence that these versions match CI and release packaging. Keep the
existing `npm run dev`, build, extension loading, and smoke instructions.

- [ ] **Step 3: Add the contributor agreement**

Under `CONTRIBUTING.md`'s Working Agreement, immediately after the README
orientation bullet, add:

```md
- Use the Node version in `.nvmrc`, the npm version declared in `package.json`,
  and `npm ci` before validation so local lockfile behavior matches CI and
  release builds.
```

- [ ] **Step 4: Validate only the touched documentation**

Run:

```sh
npx prettier --check README.md docs/testing.md CONTRIBUTING.md
git diff --check
git diff -- README.md docs/testing.md CONTRIBUTING.md
```

Expected result: the touched docs pass formatting, name the same toolchain
contract, and contain no unrelated documentation changes.

- [ ] **Step 5: Commit the documentation unit**

Run:

```sh
git add README.md docs/testing.md CONTRIBUTING.md
git commit -m "docs: document the pinned development toolchain"
```

## Task 5: Validate The Pull Request Boundary And Prepare Handoff

**Files:**

- Verify all files listed in the File Map
- Do not add new implementation files in this task

- [ ] **Step 1: Prove a clean install with the declared versions**

Run:

```sh
nvm use
npm install --global npm@11.19.0
node --version
npm --version
npm ci
git status --short
```

Expected result: versions are `v24.20.0` and `11.19.0`, `npm ci` exits zero,
and install hooks create no untracked or modified source files. Generated WXT
artifacts already ignored by the repository are acceptable.

- [ ] **Step 2: Run focused alarm and background regressions**

Run:

```sh
npm test -- \
  src/extension/background/scheduler/alarm-scheduler.test.ts \
  src/extension/background/due-notification.test.ts \
  src/extension/background/sync-auto-sync.test.ts \
  --run
```

Expected result: all focused tests pass.

- [ ] **Step 3: Run the required automated validation**

Run each command separately and record its exact result:

```sh
npm audit --omit=dev
npm run lint
npm run check
npm run build
npm run zip
npx prettier --check \
  package.json \
  .github/workflows/ci.yml \
  .github/workflows/release-please.yml \
  src/extension/background/scheduler/alarm-scheduler.ts \
  src/extension/background/scheduler/alarm-scheduler.test.ts \
  README.md \
  docs/testing.md \
  CONTRIBUTING.md
git diff --check origin/main...HEAD
```

Expected result: every command exits zero. `npm run check` is still required
even though lint and the focused tests were run separately because it proves
the repository's current combined gate.

- [ ] **Step 4: Expose the known repository-wide formatting debt**

Run:

```sh
npm run format
```

Expected result for this pull request: the command remains RED on the existing
broad formatting surface, including evaluation artifacts under
`.claude/skill-validation` and previously unformatted maintained files. Record
the exact failure as skipped remediation, not as a passing gate. Do not fix the
files here: the next approved pull request defines the maintained Prettier
surface and performs the isolated mechanical normalization. If the command
unexpectedly passes, record that result and do not manufacture formatting
changes.

- [ ] **Step 5: Run the required happy-path runtime smoke test**

Human validation:

1. Run `npm run build` and load `.output/chrome-mv3` in Chrome.
2. Open the hidden dashboard route `#/dev/smoke`.
3. Run the default smoke flow.
4. Confirm background health and the notification dry run complete without a
   service-worker alarm error.
5. Attach a screenshot or screen recording to the pull request.

This proof is required because the pull request touches a runtime source file,
even though the intended change is type-only.

- [ ] **Step 6: Run the required alarm-repair edge smoke test**

With automatic sync configured, open the extension service worker console and
run:

```js
await chrome.alarms.clear('sync:poll')
await chrome.alarms.get('sync:poll')
```

Expected result: the second expression returns `undefined`. Reload the
extension, reopen the service worker console, and run:

```js
await chrome.alarms.get('sync:poll')
```

Expected result: Chrome returns a repeating `sync:poll` alarm. Attach proof to
the pull request. Do not alter alarm names or intervals during this smoke test.

- [ ] **Step 7: Review the branch as a pull request**

Run:

```sh
git status --short --branch
git log --oneline origin/main..HEAD
git diff --stat origin/main...HEAD
git diff origin/main...HEAD -- \
  .nvmrc \
  package.json \
  package-lock.json \
  .github/workflows/ci.yml \
  .github/workflows/release-please.yml \
  src/extension/background/scheduler/alarm-scheduler.ts \
  src/extension/background/scheduler/alarm-scheduler.test.ts \
  README.md \
  docs/testing.md \
  CONTRIBUTING.md
```

Confirm the diff has no dependency constraint upgrades, Actions major updates,
formatting sweep, product behavior change, Chrome permission change, or
unrelated user work.

- [ ] **Step 8: Prepare the PR-ready handoff**

Use this Conventional Commit pull request title:

```text
fix(build): restore deterministic validation baseline
```

The pull request body must include:

- scope and the explicit no-issue reason, unless an issue was created;
- the pinned Node/npm versions and why the lockfile changed;
- exact automated validation commands and results;
- the known repository-wide `npm run format` failure and the next phase that
  owns it;
- happy-path and edge-case smoke results with screenshot or recording links;
- CI and release impact;
- patch release impact from the runtime type fix; and
- rollback guidance: revert this pull request as a unit if the pinned
  toolchain or alarm type causes a regression.

- [ ] **Step 9: Dry-run the existing GitHub paths before merge**

Push the branch and open the pull request. Confirm the existing `Check` job
reaches `npm run check` and passes using the logged `v24.20.0`/`11.19.0` pair.
Do not change branch protection in this pull request. Release packaging remains
guarded by the existing Release Please `release_created` condition and is
validated by static review here; its next real release run provides the final
hosted proof.

## Done When

- A clean checkout uses Node 24.20.0/npm 11.19.0 and passes `npm ci`.
- `npm run check`, `npm run build`, and `npm run zip` pass locally.
- Production dependency audit results remain at zero vulnerabilities.
- Alarm scheduler behavior is unchanged and uses WXT's exact create type.
- Existing CI and release packaging use and log the pinned toolchain.
- Touched files pass targeted Prettier and whitespace validation.
- The full `npm run format` debt is reported honestly and deferred only to the
  separately approved formatting pull request.
- Human happy-path and edge-case alarm smoke evidence is attached before review
  or merge.
- The diff contains no dependency upgrades, Actions upgrades, CI redesign,
  formatting sweep, permission expansion, or unrelated changes.
