# YouTube Overlay Help Design

Date: 2026-09-11
Status: Approved design, awaiting implementation plan

## Context

The expanded LeetCode overlay supports review timing, assessment, and a
structured log, but it does not yet offer a lightweight route to outside help.
The first help resource should search YouTube for the current LeetCode problem.
The area may gain more hint resources later, so the initial action should not be
locked into the overlay header or presented as an oversized full-width card.

## Goals

- Add a compact Help area to the expanded overlay.
- Open a YouTube results search for the current problem in a new tab.
- Prefer the canonical problem title and always use the problem slug as the
  fallback search term.
- Keep URL construction isolated, testable, and easy to change later.
- Preserve the overlay's existing high-density visual hierarchy and accessible
  icon-button behavior.

## Non-Goals

- Adding help controls to collapsed or docked overlay modes.
- Adding additional hint providers or resources in this change.
- Persisting the generated YouTube URL or any help state.
- Adding runtime messages, background handlers, database fields, Chrome
  permissions, or network clients.
- Creating a generic cross-feature external-link framework before reuse exists.

## Chosen UX

Add a small `HELP` shelf between Assessment and Structured Log in the expanded
overlay's scrollable content. The shelf uses the same uppercase section-label
language as the surrounding overlay. Its first and only resource is a
left-aligned, icon-only YouTube link.

The action uses the existing shared icon-button styling with Lucide's YouTube
icon. Its accessible name and tooltip are `Search YouTube for this problem`.
The icon remains visually neutral and uses the existing hover and keyboard-focus
treatment rather than introducing YouTube brand color into the overlay.

The link opens in a new tab with `target="_blank"` and
`rel="noopener noreferrer"`.

## Architecture And Ownership

The change follows CogniPace's existing dependency direction:

```text
overlay app composition
-> overlay-session feature UI
-> overlay-session pure URL helper
```

`OverlayShell` derives a dedicated help search term with this precedence:

1. captured page metadata title
2. stored problem title from overlay context
3. current LeetCode problem slug

This value remains separate from the display-title fallback so placeholder copy
such as `Reading page` can never become a search query.

`ExpandedOverlay` receives the search term in its view model and passes it to a
small feature-owned Help component. That component owns the Help shelf and its
single link, while a pure overlay-session helper owns YouTube URL construction.
The helper accepts a search term and returns a complete YouTube results URL.

The URL is derived when rendering and is never stored.

## URL Construction And Fallbacks

The helper uses `https://www.youtube.com/results` as the fixed base and
`URLSearchParams` for the `search_query` parameter. It trims the selected search
term and relies on standards-based encoding so a title such as
`33. Search in Rotated Sorted Array` produces:

```text
https://www.youtube.com/results?search_query=33.+Search+in+Rotated+Sorted+Array
```

The canonical title is preferred because it produces the clearest search. The
slug is always the fallback when a title is unavailable. If neither a usable
title nor slug exists during an exceptional transient state, the Help shelf
renders a disabled icon button rather than searching for placeholder text.

## Error Handling

The native link delegates new-tab navigation to the browser, matching existing
external-link patterns in CogniPace. There is no application loading state or
runtime error state because the extension does not perform the YouTube request.
The fixed base URL and encoded query prevent arbitrary URL input from reaching
the link.

## Testing And Validation

Focused automated tests should verify:

- exact URL construction and encoding for a numbered problem title
- title precedence over slug
- slug fallback when metadata and stored title are unavailable
- disabled behavior when no valid title or slug exists
- the Help shelf's placement in the expanded overlay
- the link's accessible name, tooltip, `href`, `target`, and `rel`
- unchanged collapsed and docked routing

Implementation validation should run the focused overlay-session tests first,
then the repository checks required by `docs/agent-governance.md` for a visible
overlay behavior change.

Before PR review or merge, the human engineer must run and record the LeetCode
overlay smoke flow. The proof should cover a title-based search, the slug
fallback edge case, keyboard focus and tooltip behavior, a correctly opened new
tab, and a screenshot or screen recording of the expanded Help shelf.

## Expected Change Boundary

The implementation should remain within:

- `src/features/overlay-session/components/overlay-shell.tsx`
- `src/features/overlay-session/components/modes/expanded/*`
- `src/features/overlay-session/domain/*`
- focused overlay-session tests

No app-shell contract, extension runtime protocol, persistence, or platform
integration change is expected.
