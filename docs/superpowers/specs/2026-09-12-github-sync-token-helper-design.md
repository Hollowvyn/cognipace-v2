# GitHub Sync Token Helper Design

## Status

Approved and implemented.

## Context

GitHub Sync requires a token with Gist access. The connection dialog should
send users directly to GitHub's fine-grained token form with only the required
settings prefilled, then remain open for the generated token.

## Decision

- Show `Create a token for CogniPace` while entering or replacing a token.
- Hide it while displaying a saved masked token.
- Open GitHub in a new tab with `rel="noopener noreferrer"`.
- Keep the link in the existing feature-owned connection dialog.

Use this endpoint:

```text
https://github.com/settings/personal-access-tokens/new
```

| Parameter     | Value                                               |
| ------------- | --------------------------------------------------- |
| `name`        | `cognipace_gh_sync_YYYY-MM-DD`                      |
| `description` | `Sync CogniPace data through a private GitHub Gist` |
| `expires_in`  | `none`                                              |
| `gists`       | `write`                                             |

Build the date from the user's local year, month, and day. `gists=write`
includes read access; request no repository or unrelated permissions.

## Boundaries

This is a normal external link. It adds no OAuth flow, token transfer, runtime
message, Chrome permission, persistence, secret-handling change, or sync side
effect. Existing token validation, masking, saving, and replacement remain
unchanged.

## Verification

Component coverage verifies the URL, local-date boundary, external-link
attributes, and new/saved/replacement visibility. Before merge, a human must
smoke-test token creation and return, replacement state, narrow-width keyboard
use, and attach screenshot or recording proof.
