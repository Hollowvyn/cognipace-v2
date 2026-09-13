# Private Chrome Web Store Release Design

## Status

Approved for implementation planning.

## Context

CogniPace already uses Release Please and GitHub Actions to create a versioned
WXT Chrome MV3 ZIP. Release `v1.3.0` proved the repaired pipeline by attaching
`cognipace-1.3.0-chrome-mv3.zip` to the GitHub Release.

The current artifact is not ready for Chrome Web Store submission. Its manifest
does not declare extension icons, and the repository does not yet own the Store
listing graphics, privacy policy, permission explanations, reviewer
instructions, or first-publication checklist.

The immediate goal is a private Store item for named Google-account testers.
The reason to use the Store is operational rather than promotional: install the
extension once, publish reviewed higher versions, and let Chrome deliver normal
extension updates without repeatedly loading unpacked builds.

Release `v1.3.0` is evidence that the GitHub packaging path works, but it must
not be uploaded to the Store because it lacks the required icon metadata. The
first Store submission must use a later official release containing every
artifact and validation described here.

## Goals

- Publish one private CogniPace Chrome Web Store item for trusted testers.
- Make every Store-facing statement accurate for the current local-first,
  optional Gist-sync, and optional BYOK AI behavior.
- Keep Store graphics, copy, privacy language, and release instructions in
  source control.
- Make missing or malformed Store-critical manifest metadata fail before the
  release ZIP is attached to GitHub.
- Use the GitHub Release ZIP as the only Chrome Web Store package.
- Verify a Store installation and a later natural Chrome update without
  reinstalling the extension.

## Non-Goals

- Do not make the item public or unlisted in this phase.
- Do not add Chrome permissions, accounts, a hosted backend, telemetry, ads, or
  paid behavior.
- Do not automate the first Store submission.
- Do not add Chrome Web Store API credentials to GitHub in this phase.
- Do not create parallel beta and production Store items.
- Do not change product persistence, backup, sync, or AI behavior to satisfy
  listing copy.

## Approaches Considered

### One private item with manual Store upload

This is the selected approach. GitHub produces and preserves the canonical ZIP;
a maintainer uploads it to the private item, submits it for review, and lets the
Store publish it after approval. Chrome owns installed-extension update checks.

This approach has the fewest credentials and moving parts while the first
listing, privacy declarations, and review behavior are still being proven.

### One private item with immediate API publishing

WXT's built-in `wxt submit` command can upload and submit higher versions from
CI through its publishing adapter, but the first item setup and first use of a
new visibility remain manual. Adding a Google Cloud project, publisher-linked
service account, authentication, and release failure recovery before the first
accepted package would combine two independent risks. Submission automation is
deferred until the manual path succeeds.

The later automation design should start with WXT's Chrome Web Store API v2
support, `wxt submit --dry-run`, and CI-provided service-account secrets. It
must not introduce a custom Store API client unless an evidenced WXT limitation
requires one.

### Separate private testing and production items

Separate items permit parallel beta and production channels, but they create
different extension IDs, independent local storage, separate listings, and
repetitive-content obligations. CogniPace does not need parallel channels yet.

## Release Architecture

The release path is:

```text
normal pull requests
-> Release Please pull request
-> semver tag and GitHub Release
-> checked WXT Chrome MV3 ZIP
-> manual upload to the private Chrome Web Store item
-> Chrome Web Store review and publication
-> automatic Chrome update checks for trusted-tester installations
```

The GitHub Release asset is the only accepted Store package. GitHub's generated
source archives and unverified local ZIPs are not submission artifacts.

Chrome Web Store account configuration remains outside the repository:

- publisher account and registration
- trusted-tester Google accounts or Google Groups
- Store item ID
- review status and staged/published state
- future Chrome Web Store API identity and credentials

## Repository-Owned Artifacts

### Extension icons and manifest

Add `public/icon-16.png`, `public/icon-32.png`, `public/icon-48.png`, and
`public/icon-128.png`. Declare them in `wxt.config.ts` as extension icons and as
the action's default icons so WXT copies the files and emits explicit paths in
the generated manifest.

The 128-pixel image uses transparent padding around approximately 96 pixels of
artwork, remains legible on light and dark backgrounds, and is included in the
extension ZIP.

### Store identity and graphics

The approved identity is **Recall Stack**:

- two layered review cards as the main form
- Terra Compact dark slate surfaces
- primary green for the active recall card
- forest green for the receding card
- amber for the due marker
- off-white for the small interior detail
- front-facing, low-detail geometry that survives 16-pixel rendering

Store-only graphics live under `store-assets/chrome-web-store/` and are not
packaged with the extension. The first asset set contains:

- `promo-small-440x280.png`, based on Recall Stack
- `screenshot-popup-1280x800.png`
- `screenshot-overlay-1280x800.png`
- `screenshot-dashboard-1280x800.png`

Screenshots use realistic seeded test data, show the actual product UI, and
contain no real tokens, API keys, Gist IDs, private notes, or personally
identifying account data. The graphics must not imply affiliation with or
endorsement by LeetCode.

### Listing and reviewer copy

Create `docs/chrome-web-store.md` as the maintainer source of truth for:

- item name and short description
- detailed Store description
- single-purpose statement
- privacy-form data categories
- justification for every permission and host permission
- remote-code declaration
- support URL
- reviewer test instructions
- private-distribution and trusted-tester steps
- first publication, update, rollback, and rejection handling

The approved item name is `CogniPace`, the short description is
`Local-first LeetCode review and study pacing.`, and the single-purpose
statement is `Help users plan and record deliberate LeetCode review with local
spaced-repetition and study-track guidance.` The support destination is
`https://github.com/Hollowvyn/cognipace-v2/issues`.

### Privacy policy

Create a root `PRIVACY.md` so its public GitHub page can be entered as the
initial privacy-policy URL. It describes the current behavior without promising
future features. After merge, the canonical initial URL is
`https://github.com/Hollowvyn/cognipace-v2/blob/main/PRIVACY.md`.

The policy covers:

- local problem, practice, review, track, settings, and analytics data
- LeetCode problem-page metadata, problem statements, submission results,
  diagnostics, and solution code when the user-facing workflow reads them
- optional GitHub token validation, GitHub account identifier handling, and
  private Gist backup/sync transfers initiated or enabled by the user
- optional AI-provider API keys and assessment payloads sent to the user's
  configured OpenAI, Anthropic, or Google Gemini provider
- local secret storage and the exclusion of raw secrets from backups, Gist sync
  envelopes, logs, and UI status payloads
- export, restore, local clear, extension removal, and external Gist/provider
  deletion responsibilities
- no developer-operated telemetry, advertising, sale of data, or hosted
  CogniPace backend

## Permission And Data Disclosures

The Store submission explains the current manifest permissions:

- `storage`: persist the local database snapshot, settings, sync metadata, and
  trusted local secrets.
- `alarms`: schedule due-review reminders and safe background sync work.
- `notifications`: show enabled local due-review reminders.
- `https://leetcode.com/*` and `https://www.leetcode.com/*`: render the
  problem-page overlay and read problem/submission context for user-facing
  practice workflows.
- `https://api.github.com/*`: validate a user-provided token and perform
  optional private Gist sync.
- OpenAI, Anthropic, and Google Gemini API hosts: perform optional user-enabled
  BYOK assessment requests from trusted background code.

The remote-code answer is **No**. CogniPace calls remote APIs but does not load
or execute remote JavaScript or WebAssembly.

This phase audits and explains existing permissions. Any move to optional host
permissions or any permission expansion requires a separate approved behavior
design.

## Store Installation And Local Data

A Store-installed item has the Store-assigned extension ID. An existing
unpacked development copy normally has a different extension ID and therefore a
different local database and secret store.

The first-install checklist must therefore:

1. Export a CogniPace backup from the unpacked copy when its data matters.
2. Disable the unpacked copy before testing the Store copy so two content
   scripts do not render competing overlays.
3. Install the private Store item with an approved trusted-tester account.
4. Restore the exported backup into the Store copy when desired.
5. Re-enter GitHub and AI-provider secrets because backups intentionally exclude
   them.

Once the Store copy is installed, later Store versions retain the same extension
ID and local storage. Existing schema-migration compatibility rules still apply.

## Store Build Validation

Add a small release validation command that reads the production WXT build and
fails unless:

- `manifest.json` exists at the build root
- `manifest_version` is `3`
- manifest name and description match the approved listing identity
- manifest version matches `package.json`
- icon entries for 16, 32, 48, and 128 pixels exist
- every declared icon file exists in the production build

Run this validation after `npm run build` and before `npm run zip` in the release
workflow. The first implementation phase also inspects the resulting ZIP to
confirm that its root layout and manifest match the checked build.

## Failure Handling

- If checks, build validation, ZIP creation, or GitHub asset upload fails, do
  not submit that version to the Store.
- If the GitHub Release lacks the named CogniPace ZIP, do not substitute a
  source archive or local build.
- If the Store rejects a package for code, manifest, privacy, or listing
  reasons, fix the issue through a normal pull request and publish a higher
  patch version.
- Do not replace or mutate an already tagged official release artifact.
- If an update requests additional permissions, stop publication until the
  permission change has explicit human approval and the listing/privacy copy is
  updated.
- If a tester cannot access the private listing, verify the signed-in Google
  account and trusted-tester or Google Group membership before changing code.
- Keep API automation out of the recovery path until the manual release has
  succeeded.

## Verification

Repository validation for Store-readiness changes includes:

```sh
npm run format
npm run lint
npm run check
npm run build
npm run store:check
npm run zip
```

The handoff records the exact generated manifest and ZIP inspection performed.
The human maintainer must also:

- smoke-test the production unpacked build across popup, dashboard, overlay,
  background reminders, optional Gist sync, and optional AI settings as
  relevant to the package
- attach screenshot or screen-recording proof of the happy path and at least one
  edge path before merge
- upload the GitHub Release ZIP to the private item
- install it with a trusted-tester account
- exercise backup migration from the unpacked copy when applicable
- verify the next legitimate published release changes the version shown in
  `chrome://extensions` without reinstalling the item

## Documentation Alignment

Update `docs/release.md`, `docs/testing.md`, `CONTRIBUTING.md`, and the planning
artifact index so they describe the private Store handoff, required artifact
validation, human-only dashboard steps, and later automatic-update proof.

The WXT submission-automation phase will receive its own design after the
private manual path is accepted and the first update behavior is understood.

## Done When

- The official release ZIP contains the declared icon set and passes the Store
  build validation command.
- Store graphics, listing copy, privacy language, permission explanations, and
  reviewer instructions are committed and internally consistent.
- A maintainer publishes the private item for at least one trusted tester using
  the official GitHub Release ZIP.
- The Store installation passes the documented happy-path and edge-case smoke
  checks.
- A later legitimate version reaches the Store-installed copy through Chrome's
  normal update mechanism without a reinstall.
