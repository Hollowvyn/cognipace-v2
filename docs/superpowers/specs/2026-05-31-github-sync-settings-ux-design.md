# GitHub Sync Settings UX Design

## Status

Approved visual direction. Awaiting written spec review before implementation
planning.

## Context

GitHub Gist sync now has directional pull/push actions, automatic safe sync, and
force pull/push dialogs. The current Settings card still exposes every setup
detail at once: token input, token save/test actions, Gist ID input,
connect/create actions, pull/push actions, delete token, and an `Enabled` badge.

That makes a configured connection look unfinished because the token input is
empty even when a token is already stored. It also mixes two separate concepts:
whether the app is connected to a Gist, and whether automatic background sync is
running.

## Goals

- Make the Settings card clear in both first-run and configured states.
- Move GitHub token and Gist setup/editing into a dialog.
- Separate connection state from automatic sync state.
- Replace ambiguous `Enabled` / `Disabled` wording with connection and
  auto-sync wording.
- Show a saved token as masked and verified without exposing the token value.
- Keep manual `Pull latest` and `Push local` available whenever the connection
  exists, even when automatic sync is paused.
- Preserve existing force pull, force push, token storage, and background-only
  secret access rules.
- Keep the implementation inside the sync feature and existing shared UI
  primitives.

## Non-Goals

- No new sync backend or GitHub OAuth flow.
- No token display or token export.
- No changes to GitHub token storage security.
- No new shared design system primitives unless the existing primitives cannot
  express the dialog cleanly.
- No redesign of backup/import/clear-data cards.
- No change to dashboard header pull/push shortcuts beyond wording or disabled
  logic needed by the new auto-sync semantics.

## Selected Direction

Use the approved Option A: **Connection Summary + Manage Dialog**.

The Settings card becomes a quiet summary. It shows whether GitHub Sync is
connected, whether auto-sync is on or paused, the latest useful sync timestamp,
and the manual directional actions. Token and Gist fields move into a
`Connect GitHub Sync` / `Manage GitHub Sync` dialog.

Option B, a stepper-like first-run card, is treated as the not-connected state of
Option A rather than a separate design. Option C, two separate cards for
connection and sync controls, is rejected because it makes an optional feature
feel heavier than the rest of Data Management.

## Product Model

The UI must distinguish two concepts:

1. **Connection**
   - `Connected`: a GitHub token is configured and a Gist ID is connected.
   - `Not connected`: either the token or Gist connection is missing.

2. **Auto-sync**
   - `Auto-sync on`: background automatic push and clean open-check pull are
     enabled.
   - `Auto-sync paused`: the connection remains, but automatic background sync
     is paused.

Manual pull/push actions belong to connection, not auto-sync. If the app is
connected but auto-sync is paused, `Pull latest` and `Push local` still work.
Pausing auto-sync only stops background sync work and clears pending automatic
jobs.

The existing sync metadata `enabled` flag should be treated as auto-sync enabled
state. For this v1, keep the existing runtime/storage field name unless a later
implementation plan explicitly budgets a mechanical rename. The UI copy and
behavior must not present it as the whole connection being enabled or disabled.

## Settings Card States

### Not Connected

Visible content:

- Title: `GitHub Sync`
- Description: `Sync CogniPace through a private GitHub Gist.`
- Badge: `Not connected`
- Summary title: `Connect a GitHub token and private Gist`
- Summary detail:
  `Your token stays in trusted extension storage and is never exported.`
- Primary action: `Connect GitHub Sync`

The not-connected card should not show token or Gist input fields. It should not
show `Pull latest`, `Push local`, or auto-sync controls because manual actions
require a connection.

### Connected, Auto-Sync On

Visible content:

- Title: `GitHub Sync`
- Description: `Sync CogniPace through a private GitHub Gist.`
- Badges: `Connected`, `Auto-sync on`
- Summary title: `Connected to private Gist`
- Summary detail:
  `Token saved and verified. Last pull: <date/time>`
  or the latest directional sync equivalent.
- Secondary action: `Manage connection`
- Manual actions: `Pull latest`, `Push local`
- Auto action: `Pause auto-sync`

### Connected, Auto-Sync Paused

Visible content:

- Badges: `Connected`, `Auto-sync paused`
- Summary title: `Connected to private Gist`
- Summary detail:
  `Automatic sync is paused. Manual pull and push still work.`
  plus the latest sync timestamp when available.
- Secondary action: `Manage connection`
- Manual actions: `Pull latest`, `Push local`
- Auto action: `Resume auto-sync`

## Dialog Design

The dialog is used for both first setup and later management.

Dialog title:

- `Connect GitHub Sync` when not connected.
- `Manage GitHub Sync` when connected.

Dialog description:

- First setup: `Add a GitHub token, then create or connect a private Gist.`
- Connected: `Update the token, connect another Gist, or pause automatic syncing.`

### Token Row

The token row must keep the input and its actions on one row at dashboard
widths:

```text
[GitHub token input or masked saved token] [Save/Replace token] [Test token]
```

Responsive behavior:

- At narrow widths, the input stays first and the actions wrap below it.
- The row must not stretch buttons into unreadable shapes.

First setup or replacement state:

- The field is a password input with placeholder `ghp_...`.
- `Save token` validates the token with GitHub before storing it.
- `Test token` validates the typed token without replacing the saved token.
- Invalid tokens remain in the password field and do not create a connected
  state.

Saved token state:

- The field is read-only and shows a masked value such as
  `................` or an equivalent password-style mask.
- The UI must never show the actual token.
- Supporting text: `Verified with GitHub. Stored only in trusted extension storage.`
- Actions: `Replace token`, `Test token`.
- `Replace token` switches the row into password-entry mode.
- The existing save path validates before storing, so any configured token from
  this app is eligible for the verified wording. `Test token` remains available
  for explicit re-checks.

### Gist Row

The Gist row must keep the field and actions on one row at dashboard widths:

```text
[Private Gist ID input] [Connect Gist] [Create private Gist]
```

Behavior:

- `Connect Gist` uses the current Gist ID field value.
- `Create private Gist` creates a private CogniPace Gist using the saved token.
- Both actions are disabled until a valid token is configured or has just been
  saved in the current dialog session.
- After successful Gist creation or connection, the card becomes `Connected`.
- If connecting reveals a conflict or remote-change decision, keep using the
  existing sync result/confirmation messaging instead of silently overwriting
  local or remote data.

### Dialog Footer

Footer actions:

- `Pause auto-sync` or `Resume auto-sync` when connected.
- `Delete token` when a token is configured.
- `Cancel` / `Close` as the neutral dismiss action.

`Delete token` removes the secret and returns the card to `Not connected`.
For this v1, deleting the token does not need to clear the remembered Gist ID.
The previous Gist ID can prefill the dialog as a draft after reconnecting a
token, but the UI must not present the app as connected without a token.

## Manual Action Dialogs

Manual `Pull latest` and `Push local` continue to use explicit result and
confirmation dialogs.

- Safe pull blocked by local dirty data opens the force-pull dialog.
- Safe push blocked by changed remote data opens the force-push dialog.
- Force actions remain destructive and require confirmation.
- Auto-sync never opens force dialogs.

## Error Handling

- Token validation failures stay scoped to the connect/manage dialog.
- GitHub permission, authentication, network, missing Gist, invalid remote, and
  unsupported schema errors continue to use existing sync error classification.
- The card shows compact error or retry-needed state when sync metadata contains
  an error, but the primary connection/auto-sync split remains visible.
- Paused auto-sync is not an error state.

## Architecture

Ownership stays in `src/features/sync`.

Expected component shape:

- `GitHubSyncPanel` owns the summary card, open dialog state, and manual action
  dialog state.
- A feature-owned connect/manage dialog component owns token and Gist drafts.
- Existing shared primitives (`Button`, `Badge`, `InlineStatus`, `Surface`, and
  existing dialog patterns) should be reused.
- Feature API/controller hooks remain the boundary for runtime calls.

Runtime and service semantics:

- `status.configured` continues to mean token configured plus Gist ID connected.
- `status.enabled` is presented as auto-sync on/off.
- Automatic sync paths require `status.enabled === true`.
- Manual pull/push require a connected token and Gist, but must not be blocked
  just because auto-sync is paused.
- Setting auto-sync to paused clears pending automatic sync jobs.

## Testing

Focused tests should cover:

- Not-connected card renders one `Connect GitHub Sync` CTA and no empty token or
  Gist fields.
- Connected card renders `Connected`, `Auto-sync on`, masked/verified token
  summary, `Manage connection`, `Pull latest`, and `Push local`.
- Paused connected card renders `Connected`, `Auto-sync paused`,
  `Resume auto-sync`, and still enables manual pull/push actions.
- Connect/manage dialog renders token input plus actions on the same logical
  row, and Gist input plus actions on the same logical row.
- Saved token state renders a masked read-only token field and never the token
  value.
- `Replace token` switches to password-entry mode.
- Saving a token calls the validating save path.
- Testing a token validates without replacing the stored token.
- Gist actions are disabled until a valid token is configured or saved in the
  dialog session.
- Pausing auto-sync calls the set-enabled runtime path, clears pending automatic
  sync jobs, and does not delete token or Gist metadata.
- Manual pull/push still call their runtime paths when connected and paused.
- Existing force pull/force push dialog tests continue to pass.

## Acceptance Criteria

- The Settings GitHub Sync card no longer shows always-visible token and Gist
  setup fields.
- Users can tell at a glance whether GitHub Sync is connected and whether
  auto-sync is on or paused.
- A stored token never appears as an empty editable field in the connected
  state.
- A stored token is represented as masked and verified without exposing the
  secret.
- Token and Gist setup/editing happen in a dialog.
- Token row and Gist row keep their input and buttons together on dashboard
  widths.
- Manual pull/push remain directional and available while connected, including
  when auto-sync is paused.
- Pausing auto-sync does not remove the connection.
- Tests cover the new user structure and the service semantics needed by the UX.
