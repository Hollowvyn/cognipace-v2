# Track Simple Recall Design

## Context

CogniPace currently marks an active-track problem complete only when its
controlling review is rated `good` or `easy`. A `hard` review is successful
recall in FSRS, but the Tracks feature stores it as incomplete. This makes
curriculum progress stricter than the review model the user is already using.

The current rule is enforced in four places:

- the Tracks domain completion-rating type
- the Tracks repository completion parser
- the Tracks runtime and backup contract
- the `track_problem_progress` database check constraint

## Product Decision

Track completion will use simple recall:

- `again` means the problem was not recalled and does not complete the track
  problem
- `hard`, `good`, and `easy` mean the problem was recalled and complete the
  track problem

FSRS continues to own scheduling and card-state updates. Tracks continues to
own curriculum completion. The Tracks feature interprets the FSRS rating for
its own progress state instead of deriving completion from global practice
history.

## Behavior

### Initial Review

When Study Plan mode is active and the reviewed problem belongs to the active
track:

- `hard`, `good`, or `easy` writes completed track progress with the original
  rating and review timestamp
- `again` writes incomplete controlling-attempt state

Free Practice continues to avoid writing active-track progress.

### Later Reviews

Once a track problem is complete, a later review does not undo its completion.
This preserves the existing monotonic progression behavior.

### Review Corrections

When the controlling review attempt is corrected:

- changing `hard`, `good`, or `easy` to `again` clears completion
- changing `again` to `hard`, `good`, or `easy` restores completion
- changing between recalled ratings updates the stored completion rating
- correcting an older, non-controlling attempt does not change track progress
- correcting an attempt after track progress was reset does not recreate it

## Data And Contracts

`TrackCompletedRating` and the matching Zod schema will accept
`hard | good | easy`. The repository completion parser will use the same set.

The SQLite check constraint on `track_problem_progress.completed_rating` will
be widened from `good | easy` to `hard | good | easy` through a generated
Drizzle migration. The migration will preserve existing rows while rebuilding
the constrained SQLite table as required.

The shared track completion schema is also used by backup parsing, so widening
it allows backups and sync payloads to preserve `hard` without changing their
overall shape or version. Existing backups containing `good` and `easy` remain
valid.

## Ownership And Data Flow

The existing flow remains unchanged:

```text
practice review save or override
-> FSRS schedules the card
-> practice/track workflow reconciles active-track progress
-> Tracks repository persists the completion rating
-> existing invalidation refreshes Tracks and other affected surfaces
```

No new runtime method, Chrome permission, feature boundary, or persistence
owner is introduced.

## Testing And Validation

Implementation will use test-first coverage for:

- `hard` completing an active-track problem
- `again` remaining incomplete
- a later review preserving completion
- controlling-attempt corrections across `again` and all recalled ratings
- track contracts accepting `hard` and rejecting `again` as a completion rating
- backup parsing and restore preserving `hard`
- the generated database migration and schema constraint

Required automated validation follows the database behavior-change matrix:

```sh
npm run db:generate
npm run db:check
npm run lint
npm run check
```

Focused repository, workflow, contract, and backup tests will run before the
full checks. A human engineer must also run the Tracks and cross-surface review
smoke flows for both a `hard` completion and an `again` non-completion, with
screenshot or screen-recording proof before PR review or merge.

## Non-Goals

- No changes to FSRS scheduling behavior.
- No derivation of track completion from historical practice data.
- No change to Free Practice behavior.
- No change to track reset semantics.
- No new completion status separate from the existing completion rating.
