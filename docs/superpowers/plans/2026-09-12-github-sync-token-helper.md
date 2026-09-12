# GitHub Sync Token Helper Implementation Plan

**Goal:** Add a compact link that opens GitHub's fine-grained token form with a
local-date name, no expiration, and Gists write access.

**Architecture:** Keep URL construction and rendering in the existing Sync
connection dialog. Do not change runtime, permissions, persistence, or secrets.

## Phase 1: Component and tests

**Files:**

- `src/features/sync/components/github-sync-connection-dialog.tsx`
- `src/features/sync/components/github-sync-connection-dialog.test.tsx`

- [x] Cover the exact endpoint and query parameters.
- [x] Cover the local-date boundary and restore test state.
- [x] Cover new, saved, and replacement visibility.
- [x] Add the conditional text link with safe new-tab attributes.

Verify:

```sh
npm test -- src/features/sync/components/github-sync-connection-dialog.test.tsx --run
```

## Phase 2: Current documentation

**Files:**

- `docs/product.md`
- `docs/testing.md`
- `docs/superpowers/specs/2026-09-12-github-sync-token-helper-design.md`

- [x] Document shipped behavior in product authority.
- [x] Add the helper to the GitHub Sync smoke flow.
- [x] Mark the approved design implemented.

## Phase 3: Validation and handoff

- [x] Run the focused component and Sync suites.
- [x] Run lint, build, zip, formatting, and whitespace checks.
- [x] Record baseline validation failures without hiding them.
- [ ] Human: verify the GitHub prefill and paste/test/save flow.
- [ ] Human: verify replacement state, narrow layout, and keyboard use.
- [ ] Human: attach screenshot or recording proof before merge.

## Done When

- New and replacement states expose the helper; saved state does not.
- GitHub receives the local-date name, no expiration, and only `gists=write`.
- No runtime, permission, persistence, secret, or sync behavior changes.
- Automated results and pending human proof are explicit in the PR.
