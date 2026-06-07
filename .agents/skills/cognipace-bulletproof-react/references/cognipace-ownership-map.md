# CogniPace Ownership Map

- Popup, dashboard, overlay, and background are separate runtime surfaces.
- `src/app` owns composition.
- `src/features/app-shell` owns surface read models.
- `src/features/practice` owns review scheduling writes.
- `src/features/settings` owns persisted preferences and settings form behavior.
- `src/features/sync` owns GitHub Gist sync behavior.
- `src/features/analytics` owns read-only review-health models.
- `src/features/overlay-session` owns overlay workflow state.
