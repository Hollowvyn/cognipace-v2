---
name: cognipace-bulletproof-react
description: Use when reviewing, planning, or implementing React architecture changes in the CogniPace repository, especially when deciding feature ownership, runtime boundaries, import direction, popup/dashboard/overlay responsibilities, or how Bulletproof React principles apply to this Chrome MV3 extension.
---

# CogniPace Bulletproof React

Apply Bulletproof React principles through CogniPace's actual extension
architecture, not a generic SPA template.

Treat these as primary authority before making structural recommendations:
- `docs/agent-governance.md` when lifecycle, validation, handoff, or skill
  routing matters
- `docs/architecture.md`
- `docs/product.md` when surface behavior, scope, or read-only ownership matters
- `design.md` when popup, dashboard, overlay, or visible UI decisions matter
- `docs/testing.md` when recommending validation scope, smoke checks, or proof
- `CONTRIBUTING.md`
- `src/testing/architecture-boundaries.test.ts`
- `eslint.config.js`

Core direction:
`entrypoints -> app -> features -> platform/lib/components`

Upstream Bulletproof React guidance is secondary to repo docs and enforced
boundaries.

Decision sequence:
1. Read the relevant authority sections.
2. Classify the surface, feature, and runtime boundary.
3. Apply the dependency direction.
4. Check enforced boundaries.
5. Route validation through governance and testing docs.

## Ownership And Boundaries

- `src/app` composes surfaces and routes; it does not own domain rules or direct persistence.
- `src/features` owns product behavior; writes stay behind the owning repository or server service.
- `src/extension` is the trusted runtime boundary for background work, sender authorization, and handler registration.
- `src/platform` and `src/lib` own infrastructure and integrations.
- `src/components` stays generic; feature UI lives inside the owning feature.
- Check `docs/product.md` before assigning new behavior to a surface; some surfaces are intentionally read-only or intentionally compact.
- Runtime payloads are validated with Zod at the extension boundary.
- Compose features at the app layer instead of deep cross-feature imports.

## Skill Composition

Load other skills only when the task actually reaches those boundaries:
- `context7-mcp` for current library docs
- `zod` for runtime contracts and parsing details
- `tanstack-query` for query/invalidation design
- `drizzle-orm` or `drizzle-migrations` for DB/repository work
- `vitest` for test shape and Testing Library guidance
- `hooks-pattern` or `presentational-container-pattern` for component/controller extraction

## References

Read these references as needed:
- `references/cognipace-ownership-map.md` for a routing quick reference
- `references/cognipace-boundary-rules.md` for common boundary tripwires
- `references/bulletproof-react-deltas.md` for CogniPace-specific deltas from a
  generic SPA
- `references/bulletproof-react-upstream-map.md` only after repo authority docs
  and tests when generic Bulletproof React framing is useful
