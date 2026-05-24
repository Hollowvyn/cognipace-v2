# Agent Operating Guide

## Required Reading

Before substantial work, read:

- `README.md`
- `docs/product.md`
- `docs/architecture.md`
- `docs/testing.md`
- `design.md`
- `CONTRIBUTING.md`
- `docs/superpowers/README.md` for historical planning context

For library, framework, SDK, API, CLI, or cloud-service documentation requests, use Context7 MCP: resolve the library ID first, then query the current docs.

## Authority

- `docs/product.md` owns current product behavior and scope.
- `docs/architecture.md` owns current technical structure and change recipes.
- `design.md` owns current visual and interaction direction.
- `docs/superpowers/*` files are planning artifacts unless current docs say otherwise.

## Safety Rules

- Do not revert unrelated user work.
- Do not add account, auth, backend, sync, team, or generic SaaS behavior without explicit approval.
- Do not expand Chrome permissions without explicit approval.
- Validate runtime payloads with Zod.
- Keep database writes behind the owning feature repository or service.
- Keep dependency direction: `entrypoints -> app -> features -> platform/lib/components`.
- Prefer existing feature patterns over new architecture layers.
- Keep docs honest about current behavior and validation actually run.

## Change Guidance

- For runtime, database, route, feature mutation, popup, or overlay changes, follow `docs/architecture.md`.
- For product behavior and testing expectations, follow `docs/product.md` and `docs/testing.md`.
- For visible UI changes, follow `design.md` and existing component patterns.

## Validation

- For docs-only changes, run Prettier on the touched Markdown files.
- For substantial feature or runtime code, run focused tests first, then `npm run check`.
- For database changes, run the relevant Drizzle/database checks.
