# Non-Destructive Track Import Design

## Summary

CogniPace will add a non-destructive JSON import workflow to the Tracks
dashboard. A user can import one or more ordered study tracks without using
full-backup restore and without replacing existing local data.

The importer reuses existing Library problems by normalized LeetCode slug,
creates missing problems with supplied metadata or safe fallbacks, and creates
the imported tracks through the existing Tracks persistence boundary. It does
not modify practice history, settings, active-track state, existing problems,
or unrelated tracks.

## Approved Product Behavior

- The entry point lives on the Tracks screen beside the existing `New Track`
  action.
- `Import Tracks` opens a dashboard route modal owned by the Tracks feature.
- The modal accepts one `.json` file, validates it locally for a preview, and
  requires an explicit `Import Tracks` action before persistence.
- A successful import reports tracks created, missing problems created, and
  existing problems reused.
- The imported tracks are not activated automatically.
- The import is atomic: either every track and required problem is created or
  no import writes remain.

## Non-Goals

- Selective import of backup topics, companies, settings, practice history, or
  review state
- Updating metadata for an existing problem
- Updating, merging, or replacing an existing track
- Importing track progress or changing the active track
- Expanding Chrome permissions, sync behavior, or backup schema behavior

The planned selective-backup section in Settings remains future work for
topics, companies, and problems. Tracks leave that placeholder because this
dedicated workflow owns track creation instead.

## User Experience

The Tracks screen renders `Import Tracks` as an outline action next to the
primary `New Track` action everywhere the track action group appears, including
the empty state and the all-tracks section.

The import modal has four states:

1. **Empty:** explains that existing problems are reused and missing problems
   are created, provides the file picker, and includes concise JSON-format
   guidance.
2. **Invalid:** keeps the selected filename visible and reports an actionable
   validation or JSON parsing error. No import action is enabled.
3. **Ready:** shows the number of tracks, groups, and unique referenced
   problems, then enables `Import Tracks`.
4. **Importing or failed:** disables duplicate submissions while pending and
   reports runtime errors without closing the modal. On success, the modal
   shows the result summary and offers `Done` to return to Tracks.

The modal remains keyboard accessible through the existing `RouteModal`
behavior. The native file input accepts `.json` and `application/json`.

## Public JSON Contract

Track imports use a contract versioned independently from full backups and
database migrations:

```json
{
  "schemaVersion": 1,
  "app": "cognipace-track-import",
  "problems": [
    {
      "slug": "two-sum",
      "title": "Two Sum",
      "difficulty": "easy",
      "isPremium": false
    }
  ],
  "tracks": [
    {
      "title": "Example Interview Track",
      "description": "An ordered interview-preparation path.",
      "dueAt": null,
      "groups": [
        {
          "title": "Arrays & Hashing",
          "problemSlugs": ["two-sum"]
        }
      ]
    }
  ]
}
```

### Authoring Guidance

- Use canonical LeetCode slugs such as `two-sum`, not full URLs.
- Keep reusable problem metadata in the top-level `problems` array and refer to
  it from groups through `problemSlugs`.
- `title`, `difficulty`, and `isPremium` are optional for problem definitions.
  A missing title is derived from the slug, difficulty defaults to `unknown`,
  and premium defaults to `false`.
- `problems` is optional. A group may reference a valid slug without a matching
  problem definition; the same fallbacks create the missing Library row.
- Track descriptions and due dates are optional. A supplied due date must be an
  ISO datetime.
- A track must contain at least one group, and each group must contain at least
  one problem slug.
- A normalized problem slug may appear only once within a track. The same
  problem may appear in different imported tracks.
- Track titles must be unique within the file.

Schemas use strict objects so misspelled or unsupported fields fail validation
instead of being silently ignored. Reasonable file limits guard the runtime
boundary: at most 20 tracks, 100 groups per track, 1,000 problem references per
track, and 5,000 top-level problem definitions.

## Conflict Policy

### Existing Problems

Problem identity is the normalized LeetCode slug. If a referenced problem
already exists, the importer reuses it and does not update its title,
difficulty, premium status, topics, companies, practice state, or timestamps.

If a problem does not exist, the importer creates it from its optional
top-level definition. Missing values use the contract fallbacks. Importing a
missing problem does not create practice, FSRS, or review-attempt rows.

### Existing Tracks

Track identity follows the existing Tracks repository: the normalized track
title produces the durable track id. If any imported track id already exists,
the complete import is rejected before writes. The error names the conflicting
track and asks the user to rename it or delete the existing track explicitly.

Imported tracks with duplicate normalized titles are rejected during contract
validation. Existing tracks are never updated or replaced.

### Duplicate Memberships

A problem can belong to only one group within a track because the current
database enforces unique track/problem identity. Duplicate normalized slugs
within a track are rejected and identify the later duplicate path. This avoids
silently changing source curriculum order.

## Architecture And Ownership

The implementation follows
`entrypoints -> app -> features -> platform/lib/components`.

- `src/app/dashboard` adds the import modal route and composes the Tracks action
  links. It owns no validation or persistence rules.
- `src/features/tracks/api` owns the strict Zod file/request/response contracts,
  file summary helper, runtime API method, and TanStack mutation hook.
- `src/features/tracks/components` owns the import form and transient file,
  preview, pending, error, and success state.
- `src/features/tracks/server` owns import orchestration and conflict policy.
- `src/features/problems/data` gains a narrow create-missing operation that
  inserts normalized fallback problem rows with conflict-do-nothing semantics.
  It never updates existing rows.
- `src/features/tracks/data` continues to own track/group/membership writes.
- `src/extension` validates and authorizes the dashboard-only runtime method,
  flushes the database snapshot, and broadcasts `tracks` and `problems` cache
  invalidation tags.

No database schema or migration changes are required.

## Data Flow And Atomicity

```text
Tracks import modal
-> parse JSON and validate TrackImportFile for preview
-> tracks.importTracks runtime request
-> Zod request parse and dashboard sender authorization
-> Tracks import service
-> one SQLite transaction
   -> preflight existing track conflicts
   -> read referenced existing problem slugs
   -> insert only missing problems
   -> create tracks, groups, and ordered memberships
-> serialize TrackImportResult
-> flush local database snapshot
-> broadcast tracks/problems invalidation
-> show result in the modal
```

The service receives the normalized contract output and performs every write in
one database transaction. Repository helpers that currently start their own
transactions will expose transaction-safe internal operations or accept the
transaction database so the importer does not commit partial work.

## Error Handling

- Invalid JSON: `Selected file is not valid JSON.`
- Wrong envelope: `Selected file is not a CogniPace track import.`
- Unsupported schema: report the received and supported schema versions.
- Contract errors: show the first useful field path and validation message.
- Existing track conflict: name the conflicting title/id and make no writes.
- Persistence failure: report `Track import failed.` with the safe runtime
  message when available and leave the modal ready for retry.

Raw file contents are never logged. Runtime errors do not include secrets or
unrelated local data.

## Documentation And Example Artifact

- Add `docs/track-import.md` as the durable authoring guide with the contract,
  field table, conflict behavior, and examples.
- Update product, architecture, design, and testing authority docs to describe
  the implemented Tracks workflow and remove Tracks from the planned Settings
  selective-import list.
- Add `track-imports/neetcode-150-and-250.json`, generated from the legacy
  CogniPace curated source. It contains the two named tracks, shared problem
  definitions, ordered groups, and de-duplicated memberships required by the
  current database constraint.
- The handoff states the source-list counts and any legacy duplicates that had
  to be removed rather than claiming the marketing names are literal counts.

## Testing And Validation

Automated coverage follows test-first development:

- Contract tests for valid files, defaults, normalization-sensitive duplicate
  detection, limits, wrong envelopes, and useful error paths
- Repository/service integration tests proving existing problem metadata is
  unchanged, missing problems are created, tracks preserve group/order, active
  state and practice history are untouched, conflicts write nothing, and a
  multi-track failure is atomic
- Runtime policy and handler tests for dashboard-only authorization, request
  and response parsing, snapshot mutation flow, and `tracks`/`problems`
  invalidation
- API hook tests for the new runtime call and local query invalidation
- Component and route tests for empty, invalid, ready, pending, success, and
  failure states plus Tracks-screen discoverability
- Contract validation of the checked-in NeetCode JSON artifact

Required automated commands are the focused test files followed by:

```sh
npm run lint
npm run check
npm run build
npx prettier --check <touched markdown and JSON files>
```

The current clean baseline already has unrelated Drizzle/type/lint command
failures; validation handoff must report whether those exact failures remain
unchanged and must not hide them behind the passing focused tests.

Human smoke proof is required before PR review or merge:

1. Import a file containing one existing and one missing problem; confirm the
   result summary reports one reused and one created problem.
2. Confirm the new track preserves group and problem order and can be activated
   normally.
3. Confirm existing problem metadata, practice history, settings, active track,
   and unrelated tracks remain unchanged.
4. Attempt a duplicate-track import and confirm the error appears with no
   partial track or problem writes.
5. Attach screenshots or a recording of the ready preview, success result, and
   conflict error.

## Release And Recovery

This is a local persisted-data and dashboard behavior change without a schema
migration or permission expansion. Rollback removes the runtime method, Tracks
modal/action, and documentation; tracks already imported remain ordinary local
tracks and can be deleted through the existing Tracks UI. Missing problems
created by an import remain ordinary Library rows and can be deleted through
existing Library management.
