# Analytics Dashboard System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved nine-view Analytics dashboard with truthful local-time data, accessible interaction, and no expansion beyond CogniPace's local-first dashboard scope.

**Architecture:** Preserve `entrypoints -> app -> features -> platform/lib/components`; keep Analytics read-only; keep FSRS package calls in `src/lib/fsrs`; build feature-owned presentation rows behind the Analytics service; validate the runtime response with Zod; and render explicit feature charts over generic Shadcn/Recharts primitives. Keep only shared code that has a live runtime consumer.

**Tech Stack:** TypeScript 6, React 19, Recharts 3.10, Zod 4, TanStack Query 5, date-fns 4, Vitest 4, Testing Library, WXT Chrome MV3, Tailwind CSS 4.

---

## Approved design

Implementation authority for the target state:

- `docs/superpowers/specs/2026-08-22-analytics-dashboard-system-design.md`

Current behavior authority remains `docs/product.md`, `docs/architecture.md`,
`docs/testing.md`, and `design.md` until each target behavior lands. Update
those files only in the final integration phase, when their new wording becomes
true.

## Execution sequence

The implementation is sequenced so each stage leaves the repository green:

1. Build local-time range and evidence contracts.
2. Add the five historical views.
3. Add rating and topic views.
4. Add current-state diagnostics.
5. Add workload views and update authority docs.

Each stage ends with focused tests, repository validation, and a dedicated Conventional Commit. Do not continue while required automated validation is failing.

## Specification coverage map

| Approved requirement                                                                                 | Owning phase                       |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------- |
| local timezone, half-open ranges, 14/30/90 buckets, partial today, fixed forecast bounds             | Phase 1                            |
| evidence vocabulary/gates, missing-zero semantics, adaptive/count/log domains, shared precision      | Phase 1                            |
| explicit chart components, chart a11y, and shared semantic tokens                                    | Phase 1                            |
| View 1 Observed Recall vs FSRS, View 2 Memory Strength, View 3 Practice Rhythm                       | Phase 2                            |
| View 4 Ratings Mix, View 5 Topic Performance                                                         | Phase 3                            |
| View 6 Retention Map, rich detail, View 7 Memory Signals                                             | Phase 4                            |
| View 8 daily overdue backlog, View 9 fixed upcoming load                                             | Phase 5                            |
| final story order, compatibility removal, loading/error/refresh, authority docs                      | Phase 5                            |
| automated validation and mandatory human visual/smoke proof                                          | every phase; final gate in Phase 5 |

## Locked ownership map

### Shared and generic

- `src/components/ui/chart.tsx`: generic chart container, tooltip, legend, and
  responsive/a11y plumbing only.
- `src/styles/tokens.css`: named cross-theme Analytics semantic tokens.
- `src/lib/fsrs/*`: the only direct `ts-fsrs` integration, including target-
  duration derivation introduced in Phase 4.
- `src/lib/leetcode/domain/problem-url.ts`: existing canonical URL builder.

### Analytics domain and runtime

- `src/features/analytics/domain/analytics-time.ts`: IANA timezone validation,
  local-calendar bounds, stable keys, partial-day and forecast boundaries.
- `src/features/analytics/domain/analytics-readiness.ts`: evidence state and
  trend-support calculations.
- `src/features/analytics/domain/historical-presentation.ts`: Views 1–5
  eligibility and presentation-row builders.
- `src/features/analytics/domain/current-state-presentation.ts`: Views 6–7
  cohort, status, ranking, and reason builders.
- `src/features/analytics/domain/workload-presentation.ts`: Views 8–9 daily
  backlog and fixed schedule builders.
- `src/features/analytics/api/analytics-contracts.ts`: request and top-level
  serialized response composition.
- `src/features/analytics/server/analytics-service.ts`: one local read pass and
  orchestration only; no chart-local business logic.

### Analytics UI

- `src/features/analytics/components/charts/*`: one explicit component per
  chart; never one chart-type switchboard.
- `src/features/analytics/components/analytics-screen.tsx`: approved story
  order and integration only.

## Compatibility strategy

Do not replace the entire runtime payload before any consumer can render it.

1. Phase 1 adds shared metadata and helpers without changing visible behavior.
2. Phases 2–4 add validated `views` fields and switch coherent screen sections.
3. Phase 5 switches workload, removes superseded serialized fields/components,
   and updates authority docs.

Do not retain compatibility metadata or generic presentation layers after
their live consumer has moved. Components must never derive locked metrics from
old misleading field names.

## No schema change in this plan suite

This plan implements honest reconstructed provenance. It does not persist
immutable pre-review retrievability, post-review stability, model version, or
settings snapshots. That is a separately approved Practice-owned Drizzle
migration. Do not add Analytics writes or silently backfill replayed values as
captured facts.

## Phase gates

At the end of every stage:

```sh
npm run lint
npm run check
```

At the end of every visible UI stage, also run:

```sh
npm run build
```

Use focused Vitest files before full validation. Format touched files and run
`git diff --check` before every commit.

## Final automated acceptance

Phase 5 must leave these green:

```sh
npm run lint
npm run check
npm run build
```

No `db:generate` is expected because this suite deliberately excludes schema
work. `npm run check` still runs `db:check` through the repository script.

## Final human proof gate

An agent cannot complete this gate. Before PR review or merge, the human
engineer must attach screenshots or a screen recording covering:

- all nine views with representative data;
- 14/30/90 historical selections;
- sparse, missing, zero, partial-today, reconstructed, and error states;
- Retention Map pointer, keyboard, pin, same-point close, Escape, outside click,
  focus restoration, and LeetCode navigation;
- narrow layout, 200–400% zoom, reduced motion, and color-independent meaning;
- fixed 14-day forecast and daily backlog exception.

Record exact happy-path and edge-case flows in the PR template. Do not mark
manual smoke or visual proof N/A.

## Final done-when checklist

- [ ] Nine stable view IDs and names match the approved specification.
- [ ] Views 1–5 use the locked historical metrics and evidence language.
- [ ] Retention Map and Memory Signals use one current-state presentation source.
- [ ] Recent Overdue Backlog stays daily at every historical range.
- [ ] Upcoming Review Load stays fixed at today plus 13 days.
- [ ] Tooltips, tables, summaries, and accessible announcements use identical
      names, units, precision, and ordering.
- [ ] Current authority docs describe the shipped behavior and old planning
      documents remain historical only.
- [ ] Automated commands pass and human smoke/visual proof is attached.

## Execution boundary

Start with the local-time and evidence contracts. Stop for review after each stage commit. Do not use the
untracked August 13 plan as an execution source; this approved August 22 suite
supersedes it without modifying that user-owned file.
