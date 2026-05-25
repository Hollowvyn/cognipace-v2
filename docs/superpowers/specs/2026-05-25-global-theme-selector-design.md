# Global Theme Selector Design

## Context

CogniPace already has theme tokens for `system`, `light`, and `dark` through
`data-cp-theme` on `SurfaceRoot`. Today the surfaces default to `system` because
there is no persisted user-facing theme preference or control.

The app also already has a Settings-owned pattern for cross-surface preferences:
study mode lives in `UserSettings`, can be changed from Settings through the
dirty-state form, and can be toggled from faster UI through a Settings
repository operation. The theme selector should follow that pattern instead of
creating a separate local-storage preference or putting next-mode rules in UI
components.

## Goals

- Add a global persisted theme preference with values `system`, `light`, and
  `dark`.
- Apply the saved theme to dashboard, popup, and LeetCode overlay surfaces.
- Add a compact dashboard title-row icon button that cycles the theme
  immediately.
- Keep the next-theme cycle order inside the Settings domain/repository, not in
  the dashboard UI.
- Add an Appearance control to Settings that uses the existing draft and
  `Save Settings` workflow.
- Preserve backup, restore, reset defaults, and runtime validation behavior by
  storing the preference inside existing user settings.

## Non-Goals

- Do not add a new database table or Chrome storage key for theme preference.
- Do not add account, sync, backend, or SaaS-style profile behavior.
- Do not expand Chrome extension permissions.
- Do not make the dashboard header button open a menu in this pass.
- Do not exclude the overlay from the global setting. If light mode exposes
  overlay contrast issues, fix the affected overlay styling.

## Product Behavior

Theme mode is a global user preference. The default is `system`, which follows
the browser or OS color-scheme preference through the existing CSS media query.

The dashboard title row includes one icon-only theme button on every dashboard
route. The button shows the current saved mode:

- `Monitor` for `system`
- `Sun` for `light`
- `Moon` for `dark`

Clicking the button immediately cycles to the next mode and persists it. The
cycle order is:

```text
system -> light -> dark -> system
```

The UI passes only the current mode and invokes the cycle command. It does not
compute the next mode.

Settings adds an Appearance section or row with a three-option segmented
control. That control edits the settings draft. It does not persist until the
user clicks `Save Settings`, consistent with the rest of Settings.

## Architecture

Add an `appearance` branch to `UserSettings`:

```ts
appearance: {
  themeMode: 'system' | 'light' | 'dark'
}
```

The setting lives in the existing `settings_kv` row keyed by `user-settings`.
No Drizzle migration is required because the JSON shape is validated and merged
by the Settings domain. The new field should be Zod-defaulted so existing saved
settings without `appearance` parse successfully and keep their current
practice, review, assessment, overlay, and reminder values.

The Settings domain owns:

- `themeModeSchema`
- the default appearance value
- merge and patch behavior for `appearance.themeMode`
- a pure `deriveNextThemeMode` helper

The Settings repository owns a `cycleThemeMode` operation. It reads current
settings, derives the next mode through the domain rule, persists the merged
settings, and returns the saved settings.

Expose a runtime method named `settings.cycleThemeMode`, authorized for the
dashboard surface. The handler should use the same mutation queue, snapshot
flush, and `settings` invalidation path as `settings.toggleStudyMode` and
`settings.updateSettings`.

## Components

Add a dashboard header action that renders on the same row as the page title.
The existing `DashboardPageHeader` can be extended to accept actions, or a small
dashboard-level wrapper can compose title, description, and actions. The action
should remain visually compact and align with existing `IconButton` patterns.

The theme button receives:

- current theme mode
- pending state
- click handler
- optional status or accessible error messaging

It renders the icon and accessible label from the current mode. It does not know
the next mode.

Settings adds an Appearance section using the existing settings row and
segmented-control patterns. The settings draft controller gains a
`setThemeMode` action for the form workflow.

## Data Flow

Fast dashboard cycle:

```text
user clicks header theme button
-> dashboard calls settings.cycleThemeMode
-> runtime validates request and authorizes dashboard sender
-> Settings repository reads current settings
-> Settings domain derives next theme mode
-> repository persists updated user-settings JSON
-> background flushes DB snapshot
-> background broadcasts settings invalidation
-> mounted surfaces refetch settings/app-shell data
-> SurfaceRoot receives updated theme mode
-> CSS tokens update the rendered surface
```

Settings page save:

```text
user changes Appearance segmented control
-> settings draft updates locally
-> Save Settings sends settings.updateSettings with appearance patch
-> existing settings mutation and invalidation flow persists the preference
```

Dashboard receives the saved theme mode through the settings query used by the
dashboard shell/header. Popup and overlay receive the saved theme mode through
their app-shell payloads by adding the smallest `appearance` summary needed to
the existing app-shell contracts. Do not introduce a global client store for the
theme.

## Error Handling

If the header cycle mutation is pending, the button should avoid duplicate
submissions. If the mutation fails, the surface keeps the currently rendered
theme and exposes a short accessible error message using the closest existing
dashboard feedback pattern. The failure should not mutate local UI into a mode
that was not persisted.

If settings fail to load for a surface, the theme should fall back to `system`,
matching today’s behavior.

If a stored value has an invalid or missing appearance branch, Settings parsing
should fall back to default appearance while preserving settings branches that
pass their schemas.

## Testing

Add focused tests for:

- `UserSettings` parsing with missing `appearance` defaults to `system`.
- settings patch creation includes `appearance.themeMode` only when changed.
- repository `cycleThemeMode` persists `system -> light -> dark -> system`.
- runtime policy and handler coverage for `settings.cycleThemeMode`.
- dashboard header button calls the cycle runtime method and disables while
  pending.
- Settings Appearance segmented control participates in the dirty-state form and
  sends an `appearance` patch only on save.
- dashboard, popup, and overlay pass the saved mode to `SurfaceRoot` as
  `data-cp-theme`.

For implementation validation, run focused tests first, then `npm run check`
for the substantial runtime and UI change.
