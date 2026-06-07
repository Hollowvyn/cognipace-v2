# CogniPace vs Generic Bulletproof React

- Extension runtime messaging is first-class architecture here.
- `src/extension` matters as much as `src/app`.
- The background worker is part of the app architecture, not an implementation detail.
- Background messaging is part of the architecture contract, not just transport glue.
- TanStack Router is dashboard-only app composition, not a universal page framework for every surface.
- TanStack Query caches runtime-backed reads; SQLite plus background services remain the source of truth.
- Avoid default recommendations for Redux, Zustand, HOCs, render props, broad context expansion, SSR, or RSC unless the repo shape changes.
