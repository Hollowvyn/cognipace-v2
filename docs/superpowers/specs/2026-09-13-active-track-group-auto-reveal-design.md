# Active Track Group Auto-Reveal Design

## Context

The Tracks dashboard persists the active track and active group correctly, but
its horizontally scrollable group tab list always mounts at the beginning. When
the restored active group is later in a long track, the problem table opens for
that group while its selected tab remains outside the visible area.

## Goal

Whenever the Tracks workspace opens or its active group changes, make the
selected group tab visible with the smallest necessary horizontal movement.

## Behavior

- Preserve the stored group order and selected group.
- On initial render, reveal the selected tab using nearest-edge alignment.
- Repeat the reveal when the active track, active group, or group order changes.
- Leave the tab where the nearest-edge reveal places it. It does not remain
  pinned while the user scrolls afterward.
- Keep the existing left and right scroll buttons and manual horizontal
  scrolling behavior.
- Give tabs enough inline scroll margin that the selected tab is not obscured by
  a visible scroll-button overlay.
- Use immediate scrolling so restoring the workspace does not introduce a
  distracting animation.

## Ownership and Data Flow

`ActiveTrackGroups` in the Tracks feature owns the behavior because it already
owns the tab-list element, active-group selection, and manual scroll controls.
It will retain a reference to the active tab and reveal that element after the
relevant rendered state changes. No route, runtime message, database, or
persistence contract changes are required.

## Edge Cases

- When the selected tab is already fully visible, nearest-edge alignment does
  not move the tab list.
- Tracks with zero or one group keep their current behavior and render no tab
  strip.
- Repeated workspace data updates that do not change the active track, active
  group, or group order do not reset a user's manual scroll position.

## Testing and Validation

Focused component tests will verify that:

- a persisted active group later in an overflowing list is requested into view
  on initial render;
- changing the active group requests the new selected tab into view with
  nearest-edge alignment; and
- existing scroll indicators and group selection behavior continue to work.

As a visible dashboard behavior change, validation requires the focused Tracks
test, `npm run lint`, `npm run check`, and `npm run build`. A human engineer must
also run happy-path and edge-case dashboard smoke tests and attach screenshot or
screen-recording proof before PR review or merge.

## Out of Scope

- Pinning a selected tab permanently to either edge
- Reordering groups or changing the persisted active group
- Replacing the existing manual scroll controls
- Changing track progress, problem rows, or review behavior
