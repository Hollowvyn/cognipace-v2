# CogniPace Boundary Rules

- Shared code must not import `@/app/*`, `@/features/*`, or `@/entrypoints/*`.
- Feature code must not depend on `@/app/*` or `@/entrypoints/*`.
- App and cross-feature imports must use public feature surfaces, not deep private internals.
- Review scheduling writes stay behind `features/practice/data/practice-repository.ts`.
- The `apiKey` literal stays isolated to `features/genai`.
- Queue stays free of tracks imports.
- Settings UI must not call alarms or notifications APIs directly.
