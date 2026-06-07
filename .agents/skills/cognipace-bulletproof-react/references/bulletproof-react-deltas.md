# CogniPace vs Generic Bulletproof React

- Extension runtime messaging is first-class architecture here.
- The background worker is part of the app architecture, not an implementation detail.
- TanStack Query caches runtime-backed reads; SQLite plus background services remain the source of truth.
- Avoid default recommendations for Redux, Zustand, HOCs, render props, SSR, or RSC unless the repo shape changes.
