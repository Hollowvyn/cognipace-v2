# CogniPace Bulletproof React Skill Design

## Summary

Create a new project-local skill that teaches future agents how to apply
Bulletproof React principles to the actual CogniPace architecture instead of a
generic SPA template. The new skill will live alongside the existing generic
skills, but it will become the preferred architecture lens for this repository.

The skill is not a rewrite of the current `bulletproof-react-auditor`. It is a
new, narrower, more accurate project skill that encodes the repo's real
ownership boundaries, extension runtime constraints, testing expectations, and
approved patterns.

## Problem

The current `bulletproof-react-auditor` skill is too generic for this codebase:

- it assumes a conventional React SPA instead of a Chrome MV3 extension with
  popup, dashboard, overlay, and background surfaces
- it does not treat `docs/architecture.md`, `CONTRIBUTING.md`, boundary tests,
  and ESLint restricted-import rules as the authoritative architecture contract
- it recommends patterns that do not fit the repo's current app shape
- it does not tell future agents when to defer to other project skills for
  TypeScript, Zod, Drizzle, TanStack Query, hooks, or testing work

The result is low-signal guidance that sounds correct in the abstract but is
not precise enough for safe work inside this repository.

## Goals

- Create a new repo-specific architecture skill under `.agents/skills`.
- Encode the actual CogniPace ownership model and dependency direction.
- Teach agents how to audit or design changes against repo-enforced boundaries.
- Keep the main skill concise and push detail into references.
- Explicitly describe when to use other existing skills instead of duplicating
  them.
- Validate the skill with a RED/GREEN loop using realistic architecture prompts.

## Non-Goals

- Do not delete or redesign the existing `bulletproof-react-auditor` skill.
- Do not introduce a new runtime architecture layer.
- Do not restate all library documentation inline when existing skills already
  cover that area.
- Do not turn this into a generic React or generic Bulletproof React primer.

## Source Of Truth

The new skill should treat these files as primary architecture authority for
CogniPace:

- `README.md`
- `docs/product.md`
- `docs/architecture.md`
- `docs/testing.md`
- `design.md`
- `CONTRIBUTING.md`
- `src/testing/architecture-boundaries.test.ts`
- `eslint.config.js`

Upstream Bulletproof React is guidance, not law. Use it to support principles
such as feature ownership, unidirectional dependencies, colocated feature code,
and clean public surfaces, but adapt those principles to this repository.

The skill should also preserve discoverability of the upstream Bulletproof React
docs at <https://github.com/alan2207/bulletproof-react/tree/master/docs>. Those
docs should remain available as secondary reference material for deeper
principles, examples, or terminology, while CogniPace's own docs and enforced
boundaries remain the deciding authority when the two differ.

## Recommended Skill Name And Location

- Skill name: `cognipace-bulletproof-react`
- Folder:
  `./.agents/skills/cognipace-bulletproof-react`

This keeps the generic `bulletproof-react-auditor` intact while giving the repo
its own authoritative architecture skill.

## Skill Trigger Intent

The frontmatter description should trigger on situations such as:

- repo architecture review for CogniPace
- deciding where new code belongs in this repository
- evaluating feature ownership or import boundaries
- planning or auditing React changes against the repo's Bulletproof-style
  structure
- working on popup, dashboard, overlay, background, runtime messaging, or
  feature API boundaries

The description should describe when to use the skill, not summarize the
workflow.

## Planned Skill Structure

```txt
.agents/skills/cognipace-bulletproof-react/
  SKILL.md
  references/
    cognipace-ownership-map.md
    cognipace-boundary-rules.md
    bulletproof-react-deltas.md
    bulletproof-react-upstream-map.md
```

`SKILL.md` should stay short and operational. The references hold the
repository-specific detail.

## SKILL.md Content Plan

### Overview

Explain that CogniPace follows a compact Bulletproof React shape adapted for a
local-first Chrome MV3 extension:

```txt
entrypoints -> app -> features -> platform/lib/components
```

Make clear that "Bulletproof React" in this repo means:

- most product logic belongs in `src/features`
- `src/app` composes surfaces and routes, but does not own domain rules
- `src/extension` is the trusted runtime boundary for background work
- `src/platform` and `src/lib` own infrastructure and integrations
- shared `src/components` stay generic

### Required Reading / First Checks

Tell future agents to inspect:

1. `docs/architecture.md`
2. `CONTRIBUTING.md`
3. `src/testing/architecture-boundaries.test.ts`
4. `eslint.config.js`

before making structural recommendations.

Then tell them to load the upstream Bulletproof React reference only when they
need deeper generic guidance that is not already answered by the CogniPace docs
or codebase evidence.

### Quick Decision Rules

Include a small decision table:

- "Where does this code belong?"
- "Is this a feature write owner?"
- "Is this crossing the runtime boundary?"
- "Is this shared UI or feature UI?"
- "Is this local UI state or query/runtime state?"

### Repo-Specific Rules

Capture high-signal invariants such as:

- keep dependency direction:
  `entrypoints -> app -> features -> platform/lib/components`
- keep writes behind the owning feature repository or server service
- validate runtime payloads with Zod at the extension boundary
- treat the background service worker as the trusted boundary
- compose features at the app layer instead of deep cross-feature imports
- prefer app-shell read models and feature-owned APIs over ad hoc data access
- do not introduce global client stores by default
- do not let shared infrastructure import `app`, `features`, or `entrypoints`
- preserve popup compactness and overlay recoverability when changing UI flows

### Cross-Skill Composition

The skill should explicitly direct the agent to use other skills when the task
touches specialized areas:

- `context7-mcp` for current library/framework docs
- `typescript-core` for strict typing and runtime type boundaries
- `zod` for schemas and parsing strategy
- `vitest` for test shape and testing-library usage
- `drizzle-orm` or `drizzle-migrations` for schema and repository work
- `hooks-pattern` for reusable stateful logic
- `presentational-container-pattern` when controller/view separation is useful
- `tanstack-query` for query and invalidation concerns

The skill should say when not to load those skills too, to avoid unnecessary
context.

## Reference File Plan

### `references/cognipace-ownership-map.md`

Summarize the authoritative ownership map derived from `docs/architecture.md`
and `CONTRIBUTING.md`:

- surface responsibilities
- feature ownership list
- which folders are composition-only vs write-owning
- common routing of work such as popup changes, overlay changes, runtime
  methods, DB changes, sync changes, and settings changes

### `references/cognipace-boundary-rules.md`

Summarize the enforced boundaries from:

- `src/testing/architecture-boundaries.test.ts`
- `eslint.config.js`

Include concrete rules and examples such as:

- forbidden import directions
- allowed public feature surfaces
- repository ownership for review scheduling writes
- GenAI `apiKey` isolation
- approved AI host permissions
- notification isolation rules
- queue/tracks boundary rule

### `references/bulletproof-react-deltas.md`

Document how CogniPace intentionally differs from generic Bulletproof React:

- extension runtime boundary is first-class
- `src/extension` matters as much as `src/app`
- background messaging is part of the architecture contract
- TanStack Router exists only for dashboard app composition, not as a universal
  page framework
- TanStack Query is used for runtime-backed cache/state, but SQLite and the
  background layer remain the source of truth
- no default recommendation for Zustand, Redux, HOCs, render props, SSR/RSC,
  or broad context expansion

### `references/bulletproof-react-upstream-map.md`

Provide a compact map of the upstream docs that are worth consulting, with links
and when to read each one. For example:

- project structure
- API layer
- state management
- components and styling
- testing
- error handling
- performance

This file should not copy the upstream docs verbatim. It should act as a guide
for when to consult them and how to reconcile them with CogniPace's repo-local
rules.

## Validation Plan (RED/GREEN)

The skill must be tested against realistic prompts before claiming it is ready.

### RED prompts against the current generic skill

Run at least three prompts against the existing `bulletproof-react-auditor` and
capture where it fails or stays too generic:

1. "Audit where a new runtime message for the overlay timer should live in
   CogniPace."
2. "Review whether a popup component can write to the DB directly in this repo."
3. "Plan where a new analytics mutation and invalidation flow belongs in
   CogniPace."

Expected baseline failure modes:

- generic folder-structure advice without extension/runtime specifics
- no reference to Zod boundary parsing
- no reliance on architecture-boundary tests or ESLint rules
- weak guidance on ownership of writes, background handlers, or query
  invalidation

### GREEN prompts against the new skill

Re-run equivalent prompts with the new skill and expect it to:

- anchor answers in the actual repo structure
- name the owning layer or feature
- mention the runtime boundary and Zod validation when relevant
- refer to boundary tests or restricted imports as architecture evidence
- suggest loading a specialized skill only when needed

## Implementation Steps

1. Initialize a new skill folder in `.agents/skills`.
2. Write `SKILL.md` with concise trigger-focused frontmatter and operational
   guidance.
3. Write the three reference files.
4. Generate or update UI metadata if needed for local skill discovery.
5. Validate the skill with `quick_validate.py`.
6. Run the RED/GREEN prompt checks and refine wording if the skill leaves
   loopholes.

## Risks

- If the skill is too long, agents will skim it and miss the repo-specific
  rules.
- If the description summarizes workflow instead of trigger conditions, agents
  may not read the body.
- If the skill duplicates other skills, it will waste context and drift out of
  date.
- If the references merely repeat Bulletproof React upstream, the skill will not
  improve project accuracy.

## Success Criteria

The new skill is successful when a future agent can use it to answer
architecture questions in a way that:

- matches `docs/architecture.md` and `CONTRIBUTING.md`
- respects the enforced boundaries in tests and ESLint
- chooses the correct owning feature/layer for common CogniPace changes
- treats extension runtime messaging as a first-class architectural concern
- avoids generic React advice that conflicts with the current repo shape
