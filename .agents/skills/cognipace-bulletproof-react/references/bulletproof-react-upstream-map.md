# Upstream Bulletproof React Map

Use upstream docs as secondary references:

- [Project Structure](https://github.com/alan2207/bulletproof-react?tab=readme-ov-file#project-structure): read before moving code across `src/app`, `src/features`, `src/lib`, `src/platform`, or shared UI boundaries.
- [API Layer](https://github.com/alan2207/bulletproof-react?tab=readme-ov-file#api-layer): read when shaping request declarations, typed contracts, or data-boundary serialization.
- [State Management](https://github.com/alan2207/bulletproof-react?tab=readme-ov-file#state-management): read when deciding between local UI state, app composition state, and TanStack Query runtime-cache state.
- [Components And Styling](https://github.com/alan2207/bulletproof-react?tab=readme-ov-file#components-and-styling): read when deciding colocation, composition, or when shared UI extraction is justified.
- [Testing](https://github.com/alan2207/bulletproof-react?tab=readme-ov-file#testing): read when choosing integration-first test scope for feature, runtime, and repository behavior.
- [Error Handling](https://github.com/alan2207/bulletproof-react?tab=readme-ov-file#error-handling): read when a change introduces failure states, runtime errors, or user-facing recovery flows.
- [Performance](https://github.com/alan2207/bulletproof-react?tab=readme-ov-file#performance): read when work touches render churn, query invalidation, expensive view models, or background-open latency.

If upstream guidance conflicts with CogniPace docs, prefer CogniPace docs and enforced repo boundaries.
