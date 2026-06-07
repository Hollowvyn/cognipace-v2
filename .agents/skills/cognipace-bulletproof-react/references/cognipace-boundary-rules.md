# CogniPace Boundary Rules

- Shared code must not import `@/app/*`, `@/features/*`, or `@/entrypoints/*`.
- Feature code must not depend on `@/app/*` or `@/entrypoints/*`.
- Extension runtime code must not depend on `@/app/*` or `@/entrypoints/*`.
- App and cross-feature imports must use public feature surfaces, not deep private internals.
- Allowed cross-feature surfaces are root feature barrels or narrow public paths such as `domain/*`, `api/*contracts`, `api/*serializers`, and `server/*service`.
- Root feature barrels must not re-export `data/*` or `server/*` internals.
- Review scheduling writes stay behind `features/practice/data/practice-repository.ts`.
- The `apiKey` literal stays isolated to `features/genai`.
- Approved AI host permissions are exactly:
  - `https://api.openai.com/*`
  - `https://api.anthropic.com/*`
  - `https://generativelanguage.googleapis.com/*`
- AI host permissions must not broaden to wildcard hosts such as `https://*/*` or `*://*/*`.
- Queue stays free of tracks imports.
- Notification work stays in background runtime code such as `src/extension/background/due-notification.ts` and alarm scheduling paths.
- Notification background code must not import FSRS internals directly from `@/lib/fsrs`.
- Settings UI must not call alarms or notifications APIs directly.
- React components should request reminder behavior through runtime methods, not `chrome.alarms`, `browser.alarms`, `chrome.notifications`, or `browser.notifications`.
