# GitHub Sync Token Helper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compact GitHub Sync helper that opens a fine-grained token form with a local-date token name, no expiration, and only Gists read/write access prefilled.

**Architecture:** Keep the change inside the existing `GitHubSyncConnectionDialog` owned by `src/features/sync`. Build the GitHub URL from a small local helper using local calendar parts, render it only during new-token or replacement entry, and leave runtime messaging, Chrome permissions, and secret handling untouched.

**Tech Stack:** React 19, TypeScript 6, Tailwind CSS tokens, lucide-react, Vitest, React Testing Library, WXT Chrome MV3.

---

## Locked Decisions

- Use GitHub's fine-grained token endpoint.
- Set `name` to `cognipace_gh_sync_YYYY-MM-DD` using the user's local date.
- Set `description` to `Sync CogniPace data through a private GitHub Gist`.
- Set `expires_in=none`.
- Set only `gists=write`; GitHub defines write as including read.
- Do not request repository, organization, or unrelated account permissions.
- Show `Create a token for CogniPace` only while entering or replacing a token.
- Open GitHub in a new tab with `rel="noopener noreferrer"` so the dialog and token draft remain intact.
- Do not add runtime methods, Chrome permissions, persistence, or secret-handling changes.

## File Structure

- `src/features/sync/components/github-sync-connection-dialog.tsx`: build the prefilled token URL and render the compact helper in the existing token group.
- `src/features/sync/components/github-sync-connection-dialog.test.tsx`: verify the exact minimal URL, safe external-link behavior, and new/replacement visibility states.
- `docs/product.md`: document the shipped token-creation helper in the current Sync behavior.
- `docs/testing.md`: add the helper and prefilled GitHub form to the GitHub Gist Sync manual smoke flow.
- `docs/superpowers/specs/2026-09-12-github-sync-token-helper-design.md`: mark the approved design implemented after validation.

## Task 1: Add the token template through component-level TDD

**Files:**

- Modify: `src/features/sync/components/github-sync-connection-dialog.test.tsx:1-72`
- Modify: `src/features/sync/components/github-sync-connection-dialog.tsx:1-31,56-63,203-210`

- [ ] **Step 1: Write the failing URL and visibility tests**

Update the Vitest import so fake time is always restored:

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.useRealTimers()
})
```

Add this test after `groups token and Gist entry controls into single rows`:

```tsx
it('links new token entry to the minimal prefilled GitHub token form', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 8, 12, 12, 0, 0))

  renderDialog({ status: notConfiguredStatus })

  const link = screen.getByRole('link', {
    name: /Create a token for CogniPace/i,
  })
  expect(link).toHaveAttribute('target', '_blank')
  expect(link).toHaveAttribute('rel', 'noopener noreferrer')

  const url = new URL(link.getAttribute('href') ?? '')

  expect(`${url.origin}${url.pathname}`).toBe(
    'https://github.com/settings/personal-access-tokens/new',
  )
  expect(Object.fromEntries(url.searchParams)).toEqual({
    name: 'cognipace_gh_sync_2026-09-12',
    description: 'Sync CogniPace data through a private GitHub Gist',
    expires_in: 'none',
    gists: 'write',
  })
})
```

Extend `keeps a saved token masked until the user chooses to replace it` with
these assertions before and after the existing Replace token click:

```tsx
expect(
  screen.queryByRole('link', { name: /Create a token for CogniPace/i }),
).not.toBeInTheDocument()

await user.click(screen.getByRole('button', { name: /Replace token/i }))

expect(
  screen.getByRole('link', { name: /Create a token for CogniPace/i }),
).toBeInTheDocument()
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```sh
npm test -- src/features/sync/components/github-sync-connection-dialog.test.tsx --run
```

Expected: FAIL because no link named `Create a token for CogniPace` exists.
The existing token masking and dialog action tests should remain green.

- [ ] **Step 3: Implement the local-date token URL**

Add `ExternalLink` to the existing lucide-react import:

```tsx
import {
  CheckCircle2,
  ExternalLink,
  GitBranch,
  KeyRound,
  Loader2,
  Trash2,
  UploadCloud,
} from 'lucide-react'
```

Add the URL builder below `maskedStoredToken`:

```tsx
const githubTokenCreationPage =
  'https://github.com/settings/personal-access-tokens/new'

function createGitHubTokenCreationUrl(now: Date) {
  const localDate = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
  const url = new URL(githubTokenCreationPage)

  url.searchParams.set('name', `cognipace_gh_sync_${localDate}`)
  url.searchParams.set(
    'description',
    'Sync CogniPace data through a private GitHub Gist',
  )
  url.searchParams.set('expires_in', 'none')
  url.searchParams.set('gists', 'write')

  return url.toString()
}
```

Create the URL with the rest of the dialog's derived view state:

```tsx
const tokenCreationUrl = createGitHubTokenCreationUrl(new Date())
```

Replace the standalone token label paragraph with a wrapping label row and the
conditional link:

```tsx
<div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
  <p
    className="m-0 text-[length:var(--cp-copy-font-size)] font-semibold"
    id={tokenGroupId}
  >
    GitHub token
  </p>
  {!hasSavedToken ? (
    <a
      className="inline-flex items-center gap-1 rounded-[var(--cp-control-radius)] text-[length:var(--cp-badge-font-size)] font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      href={tokenCreationUrl}
      rel="noopener noreferrer"
      target="_blank"
    >
      Create a token for CogniPace
      <ExternalLink aria-hidden="true" className="size-3" />
    </a>
  ) : null}
</div>
```

Do not change the token input, Test token, Save token, Replace token, secret
storage, or dialog focus-trap code. The existing `a[href]` focus selector will
automatically include the new link.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```sh
npm test -- src/features/sync/components/github-sync-connection-dialog.test.tsx --run
```

Expected: PASS for the new URL and visibility cases and all existing dialog
cases.

- [ ] **Step 5: Commit the tested UI change**

```sh
git add src/features/sync/components/github-sync-connection-dialog.tsx src/features/sync/components/github-sync-connection-dialog.test.tsx
git commit -m "feat(sync): add GitHub token creation helper"
```

## Task 2: Align current product and testing documentation

**Files:**

- Modify: `docs/product.md:240-251`
- Modify: `docs/testing.md:134-155`
- Modify: `docs/superpowers/specs/2026-09-12-github-sync-token-helper-design.md:3-5`

- [ ] **Step 1: Document the helper in current product behavior**

Add this sentence after the first Settings dialog paragraph in the Sync section
of `docs/product.md`:

```markdown
When entering or replacing a token, the dialog links to GitHub's fine-grained
token form with a local-date CogniPace name, no expiration, and only Gists write
access prefilled. Gists write includes the read access needed for pull actions.
```

- [ ] **Step 2: Update the GitHub Gist Sync manual flow**

Replace steps 1 through 4 under `### GitHub Gist Sync` in `docs/testing.md` with:

```markdown
1. Open Settings > Data Management.
2. In GitHub Sync, open Connect GitHub Sync.
3. Use Create a token for CogniPace and confirm GitHub opens in a new tab with
   the token name `cognipace_gh_sync_YYYY-MM-DD` for the current local date, no
   expiration, and Gists write access prefilled without repository access.
4. Generate and copy the token in a test account, return to the still-open
   CogniPace dialog, enter the token, confirm it is masked, use Test token, then
   Save token.
```

Keep the remaining private Gist, backup exclusion, second-profile, conflict,
and automatic sync steps in their current order, renumbered by Markdown.

- [ ] **Step 3: Mark the design implemented**

Change the design status to:

```markdown
## Status

Approved and implemented.
```

- [ ] **Step 4: Format and check the touched documentation**

Run:

```sh
npx prettier --check docs/product.md docs/testing.md docs/superpowers/specs/2026-09-12-github-sync-token-helper-design.md
```

Expected: `All matched files use Prettier code style!` or the repository's
equivalent success output.

- [ ] **Step 5: Commit the authority-doc updates**

```sh
git add docs/product.md docs/testing.md docs/superpowers/specs/2026-09-12-github-sync-token-helper-design.md
git commit -m "docs(sync): document token creation helper"
```

## Task 3: Run required validation and prepare human smoke proof

**Files:**

- Verify: `src/features/sync/components/github-sync-connection-dialog.tsx`
- Verify: `src/features/sync/components/github-sync-connection-dialog.test.tsx`
- Verify: `docs/product.md`
- Verify: `docs/testing.md`

- [ ] **Step 1: Run the focused sync dialog test**

Run:

```sh
npm test -- src/features/sync/components/github-sync-connection-dialog.test.tsx --run
```

Expected: PASS.

- [ ] **Step 2: Run the complete GitHub Sync focused suite**

Run:

```sh
npm test -- src/features/sync/server/sync-service.test.ts src/features/sync/api/sync-api.test.tsx src/extension/background/register-handlers.test.ts src/extension/background/runtime-policy.test.ts src/features/sync/hooks/use-github-sync-controller.test.tsx src/features/sync/components/github-sync-panel.test.tsx src/features/sync/components/github-sync-connection-dialog.test.tsx src/features/sync/components/dashboard-sync-actions.test.tsx --run
```

Expected: PASS. Although runtime and secret code are untouched, this suite
proves the dialog change did not regress the surrounding sync workflow.

- [ ] **Step 3: Run the required UI and dashboard validation matrix**

Run each command separately and record its exact result:

```sh
npm run lint
npm run check
npm run build
npm run format
git diff origin/main...HEAD --check
```

Expected: every command exits successfully with no lint, type, test, build,
formatting, or whitespace errors.

- [ ] **Step 4: Record the unchanged security and runtime boundaries**

Confirm in the handoff and PR-ready summary:

```text
Sender authorization: unchanged; the helper sends no runtime message.
Zod parsing: unchanged; no runtime payload was added.
Secret redaction/storage: unchanged; token entry still uses the existing masked background-owned flow.
Cache invalidation and sync side effects: unchanged; opening the helper only creates a new browser tab.
Chrome permissions: unchanged.
```

- [ ] **Step 5: Hand off the required human smoke checklist**

The human engineer must run and record these checks before PR review or merge:

```text
Happy path: Open Connect GitHub Sync, activate Create a token for CogniPace, and verify the GitHub form opens in a new tab with today's local-date name, no expiration, and only Gists write access. Return to the still-open dialog, paste the token, test it, and save it.
Replacement edge: Open Manage GitHub Sync, confirm the link is hidden with the masked saved token, choose Replace token, and confirm the link appears with a fresh local-date URL.
Responsive edge: Repeat new-token entry at a narrow dashboard width and confirm the label/link wrap without breaking the token input actions or keyboard focus.
Visual proof: Attach a screenshot or recording of the CogniPace helper and GitHub's prefilled token form.
```

Agents must report these checks as skipped pending human execution unless a
human actually runs them during the implementation session. Do not mark them
N/A.

## Done When

- New-token and replacement states expose the compact helper.
- Saved-token state remains masked and does not show the helper until Replace
  token is chosen.
- The token name uses the user's local date as
  `cognipace_gh_sync_YYYY-MM-DD`.
- The GitHub template requests no expiration and only `gists=write`, which
  includes read.
- The helper opens safely in a new tab and requests no new Chrome permission.
- Existing token validation, persistence, runtime, and sync behavior remain
  unchanged.
- Focused tests, the full GitHub Sync suite, `npm run lint`, `npm run check`,
  `npm run build`, `npm run format`, and the branch whitespace check pass.
- The handoff names every command run, every skipped command with its reason,
  remaining risk, release impact, rollback guidance, and the unchecked human
  smoke and visual-proof requirements.
