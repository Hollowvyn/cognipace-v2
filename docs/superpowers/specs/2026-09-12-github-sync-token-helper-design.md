# GitHub Sync Token Helper Design

## Status

Approved for implementation planning.

## Context

The Connect GitHub Sync dialog asks the user to provide a GitHub token but does
not help them create one with the permissions CogniPace needs. This interrupts
setup because the user must find GitHub's token settings, identify the correct
token type and permission, and then return to the still-open dialog.

GitHub supports URL templates for fine-grained personal access tokens. The
CogniPace Gist workflow needs the account-level `Gists: write` permission;
GitHub defines write access as including read access. No repository permission
is required.

## Goals

- Add a small token-creation hyperlink to the GitHub token section.
- Open GitHub's fine-grained token form in a new tab so the CogniPace dialog
  remains available for pasting the generated token.
- Prefill only the settings required for CogniPace Gist sync.
- Give each token a recognizable name containing the user's current local date.
- Preserve all existing token storage, validation, masking, and replacement
  behavior.

## Non-Goals

- No OAuth or GitHub App flow.
- No automatic token transfer from GitHub back to CogniPace.
- No additional Chrome permissions or runtime messages.
- No change to secret storage, backup exclusion, or sync behavior.
- No repository, organization, or unrelated GitHub permissions.

## Selected Direction

Add a compact text link beside the `GitHub token` label in the feature-owned
`GitHubSyncConnectionDialog`. The link reads `Create a token for CogniPace` and
uses an external-link affordance. It appears while the user is entering a new
token or replacing an existing token. It is hidden while a saved token is shown
in its normal masked state because token creation is not part of that state.

The link opens a new tab with `target="_blank"` and uses
`rel="noopener noreferrer"`. Opening a new tab preserves the dialog and its
current draft state so the user can return and paste the generated token.

Two heavier alternatives were considered and rejected:

- Adding another button to the token input row would crowd the existing Test
  and Save or Replace actions.
- Adding an instructional callout would give an optional helper too much visual
  weight in the compact dialog.

## Token Template

Build the link from GitHub's fine-grained token endpoint:

```text
https://github.com/settings/personal-access-tokens/new
```

Set these query parameters:

| Parameter     | Value                                                    |
| ------------- | -------------------------------------------------------- |
| `name`        | `cognipace_gh_sync_YYYY-MM-DD`                           |
| `description` | `Sync CogniPace data through a private GitHub Gist`       |
| `expires_in`  | `none`                                                   |
| `gists`       | `write`                                                  |

The date uses the user's local calendar date at render time. It must be built
from local year, month, and day values rather than by slicing a UTC ISO string,
which could produce the wrong date near midnight. Month and day are zero-padded.

`gists=write` is the complete requested read/write permission because GitHub's
write level includes read. The template must not add repository access or any
other permission.

## Ownership And Data Flow

The helper stays in `src/features/sync`, which already owns the dialog and
GitHub Gist setup workflow. It is a normal external link and does not call the
background service worker, expose a token, mutate local state, or cross the
extension runtime boundary.

The existing flow remains unchanged:

```text
open token helper
-> GitHub opens in a new tab with the form prefilled
-> user generates and copies the token
-> user returns to the existing CogniPace dialog
-> user pastes, tests, and saves through the current trusted flow
```

## Accessibility And Responsive Behavior

- The link has a descriptive accessible name matching its visible purpose.
- The external-link icon is decorative and hidden from assistive technology.
- Keyboard users can reach and activate the link in the dialog's focus trap.
- The label and link may wrap at narrow widths without changing the token input
  and action grouping.
- Existing focus restoration and Escape behavior remain unchanged.

## Error Handling

The helper performs no network request inside CogniPace. GitHub owns validation
of the token template and token generation form. If GitHub is unavailable, its
new tab displays that failure while the CogniPace dialog and draft remain
unchanged.

Existing token validation continues to report invalid credentials or
permissions after the user returns. The helper does not treat opening GitHub as
proof that a valid token was created.

## Testing

Focused component tests should verify:

- New-token state renders the token helper.
- The helper URL uses the local date in `YYYY-MM-DD` format.
- The URL includes `expires_in=none` and `gists=write`.
- The URL excludes repository and unrelated permissions.
- The link opens a new tab with safe external-link attributes.
- Saved-token state hides the helper.
- Choosing Replace token reveals the helper.
- Existing token masking, testing, saving, replacement, and dialog focus tests
  continue to pass.

Manual dashboard smoke testing must cover the happy path and edge case:

1. Open Connect GitHub Sync and confirm the helper opens GitHub in a new tab
   with the expected name, description, no expiration, and Gists read/write
   access prefilled.
2. Return to the still-open dialog, paste the generated token, test it, and save
   it.
3. Open Manage GitHub Sync and confirm the normal masked-token state does not
   show the helper; choose Replace token and confirm the helper appears.
4. Confirm the dialog remains usable at a narrow dashboard width.

Screenshot or screen-recording proof of the helper and prefilled GitHub form is
required before PR review or merge.

## Acceptance Criteria

- A user entering or replacing a GitHub token can open a small
  `Create a token for CogniPace` link.
- GitHub opens in a new tab and CogniPace's dialog remains open.
- The fine-grained token form is prefilled with
  `cognipace_gh_sync_YYYY-MM-DD`, using the user's local date.
- The form is prefilled with no expiration and only Gists write permission,
  which includes read.
- No repository permission is requested.
- Existing secret handling and sync behavior are unchanged.
