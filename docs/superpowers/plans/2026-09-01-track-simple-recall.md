# Track Simple Recall Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `hard`, `good`, and `easy` complete active-track problems while `again` remains incomplete, preserving the original FSRS rating across persistence, runtime contracts, backup, and review corrections.

**Architecture:** FSRS continues to schedule practice cards, while Tracks owns the separate curriculum-completion decision. Widen the existing Tracks completion-rating union and shared Zod schema, then widen the repository parser and SQLite constraint through a generated migration; keep the current practice/track transaction workflow, runtime methods, and invalidation behavior unchanged.

**Tech Stack:** TypeScript 6, Vitest, Zod 4, Drizzle ORM/Kit, SQLite WASM, WXT Chrome MV3.

---

## Locked Decisions

- Simple recall means `hard | good | easy`; `again` is the only non-completing review rating.
- Persist the original recalled rating. Do not coerce `hard` to `good`.
- A later `again` review does not undo an existing completion.
- Correcting the controlling attempt to `again` clears completion; correcting it to any recalled rating completes or updates it.
- Free Practice, track reset, runtime methods, cache invalidation, backup version, sync envelope version, and FSRS scheduling remain unchanged.
- The schema migration must preserve existing `good` and `easy` progress rows.

## File Structure

- `src/features/tracks/domain/track.ts`: widen the domain completion-rating union.
- `src/features/tracks/api/tracks-contracts.ts`: widen the shared runtime/backup Zod completion-rating schema.
- `src/features/tracks/api/tracks-contracts.test.ts`: prove runtime rows accept `hard` and reject `again` as completion.
- `src/features/backup/api/backup-contracts.test.ts`: prove current backups accept and preserve `hard` through the shared schema.
- `src/features/tracks/data/tracks-repository.ts`: classify `hard` as a completing rating.
- `src/features/tracks/data/tracks-repository.test.ts`: prove initial and later hard reviews persist complete track progress.
- `src/features/practice/practice-core.integration.test.ts`: prove save and correction behavior across the practice/track transaction workflow.
- `src/platform/db/schema/track-problem-progress.ts`: widen the SQLite completion-pair check constraint.
- `src/platform/db/migrations/0007_track_simple_recall.sql`: generated SQLite table-rebuild migration.
- `src/platform/db/migrations/meta/0007_snapshot.json`: generated Drizzle schema snapshot.
- `src/platform/db/migrations/meta/_journal.json`: generated migration journal entry.
- `docs/product.md`: document the current simple-recall track policy.
- `docs/testing.md`: document the required hard/again manual smoke flow.

## Implementation Checklist

1. Widen `TrackCompletedRating`, its shared Zod schema, and the repository parser
   to accept `hard | good | easy` while rejecting `again` as a completion.
2. Widen the SQLite check constraint and generate migration 0007. Confirm the
   table rebuild preserves rows, keys, foreign keys, and indexes.
3. Keep the existing practice/track transaction, later-review preservation,
   controlling-review correction, reset, Free Practice, runtime, and
   invalidation paths unchanged.
4. Document the policy in `docs/product.md` and add human-run Tracks smoke cases
   to `docs/testing.md`.

## Coverage Matrix

| Contract                                                   | Evidence                                         |
| ---------------------------------------------------------- | ------------------------------------------------ |
| Initial `hard` completes progress                          | Tracks repository and practice integration tests |
| Initial `again` remains incomplete                         | Practice integration test                        |
| Later `again` preserves completion                         | Practice integration test                        |
| Controlling correction crosses the recall boundary         | Practice integration tests                       |
| Recalled-to-recalled correction updates the rating         | Practice integration test                        |
| Runtime and backup contracts preserve `hard`               | Contract tests                                   |
| Migration preserves rows and accepts only recalled ratings | DB foundation test                               |

## Validation

Run focused tests first:

```sh
npm run test -- src/features/tracks/api/tracks-contracts.test.ts src/features/backup/api/backup-contracts.test.ts
npm run test -- src/features/tracks/data/tracks-repository.test.ts src/features/practice/practice-core.integration.test.ts src/testing/db-foundation.test.ts
```

Then run the required database behavior-change matrix:

```sh
npm run db:check
npm run lint
npm run check
npm run build
npx prettier --check docs/product.md docs/testing.md docs/superpowers/specs/2026-09-01-track-simple-recall-design.md docs/superpowers/plans/2026-09-01-track-simple-recall.md
git diff origin/main...HEAD --check
```

## Human Smoke Proof

- In Study Plan mode, save `hard` for an incomplete active-track problem and
  confirm progress and next guidance advance.
- Confirm an initial `again` remains incomplete and a later `again` does not
  clear an existing completion.
- Correct the controlling review across the recall boundary and between recalled
  ratings; confirm progress clears, restores, or updates as appropriate.
- Confirm overlay, popup, and dashboard state agree after each rating.
- Attach screenshot or screen-recording proof of the `hard` happy path and
  `again` edge path before review or merge.

Automated checks do not replace real-time extension smoke proof. Sender
authorization, runtime routing, secrets, permissions, sync orchestration, and
envelope versions remain unchanged. Migration 0007 preserves existing rows,
but developers should back up disposable local data before migration testing
because the local database fingerprint changes.

## Done When

- `hard`, `good`, and `easy` persist as completed active-track ratings.
- `again` remains incomplete.
- Save, later-review, controlling-correction, reset, Free Practice, runtime serialization, backup parsing, and migration behavior are covered.
- Existing backup and sync shapes remain compatible without a version bump.
- Product and testing authority docs describe the shipped policy.
- Focused tests, `npm run db:check`, `npm run lint`, `npm run check`, and
  `npm run build` pass.
- The handoff lists exact commands run, exact commands skipped with reasons, remaining risk, and the required unchecked human smoke/visual-proof checklist.
