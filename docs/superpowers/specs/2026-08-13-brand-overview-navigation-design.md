# CogniPace brand navigation design

## Context

The CogniPace brand mark and name appear in both the popup header and the
dashboard sidebar, but neither currently provides a direct path to the
dashboard Overview route. Settings already gives users a surface-level way to
open a dashboard destination from the popup, so the brand should provide the
same kind of orientation affordance.

## Goal

Make the full CogniPace brand treatment clickable in both visible surfaces and
have it lead to dashboard Overview.

## Non-goals

- Do not change dashboard route definitions or the existing Overview screen.
- Do not change the Settings or Tracks actions.
- Do not add a new runtime message or broaden runtime permissions.
- Do not extract a shared brand component for two surface-specific controls.

## Chosen approach

Keep navigation owned by each surface's existing composition:

- In the popup, add an `openOverview` controller action that uses the existing
  dashboard-tab opening helper with no route suffix. The popup brand becomes a
  semantic button with an accessible “Open Overview” label while preserving
  the current visual mark and name.
- In the dashboard, wrap the existing sidebar brand treatment in a TanStack
  Router link to `/`, with the same accessible “Open Overview” label. This
  keeps dashboard navigation in the dashboard router and avoids an unnecessary
  runtime round trip.

Both controls will retain the current brand styling, show a visible focus
indicator, and make the icon and name part of one activation target.

## Testing and validation

- Extend popup shell/controller tests to verify the brand action calls
  `openOverview` and opens the default dashboard URL.
- Extend dashboard route tests to verify activating the brand from a non-root
  route navigates to `/` and renders Overview.
- Run focused popup/dashboard tests, formatting, type checking, lint, and the
  production build as appropriate for the touched UI surfaces.
- Human smoke testing must cover pointer and keyboard activation in both the
  popup and dashboard, including activation from Settings and from a dashboard
  page other than Overview, with screenshot or recording proof before review.

## Release and rollback

This is a client-side navigation-only change with no schema, permission,
runtime-contract, or migration impact. Rollback is limited to reverting the
brand wrappers, popup action, and focused tests.
