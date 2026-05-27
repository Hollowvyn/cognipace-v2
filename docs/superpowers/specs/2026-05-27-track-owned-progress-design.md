# Track-Owned Progress Design

## Context

Tracks currently store curriculum completion in `track_problem_progress`, keyed
by `(track_group_id, problem_slug)`. That makes progress effectively owned by a
group membership even though product behavior describes progress as track-owned.

The mismatch showed up while testing review corrections:

- a `good` or `easy` review can complete an active-track problem
- changing that review to `hard` or `again` cannot safely clear the completion
- changing it back cannot safely restore completion
- resetting a track should prevent old review edits from resurrecting progress

Subagent review found the same root issue from three angles:

- schema: progress is tied to group membership and needs rescue logic during
  group edits
- write flow: practice save and track completion are separate transactions
  coordinated in the background handler
- contracts: completion is represented as loose nullable fields, and backup
  session/progress validation allows states the runtime does not use

## Product Decisions

- A problem can appear at most once in a track.
- Tracks own curriculum progress.
- Practice owns global FSRS scheduling, review attempts, and practice history.
- Library/global practice status remains separate from track completion.
- Free Practice does not write active-track progress.
- Track reset clears only track progress and does not touch global practice
  history.
- Review correction support is included in this pass.

## Data Model

Progress should belong to the durable track/problem pair:

```txt
track_id + problem_slug
```

Groups remain the organization and ordering layer. Moving a problem between
groups changes location, not progress identity.

Schema direction:

- Add `track_id` to `track_group_problems`.
- Enforce uniqueness on `(track_id, problem_slug)`.
- Re-key `track_problem_progress` by `(track_id, problem_slug)`.
- Keep the progress row dependent on the track/problem membership so removing a
  problem from a track clears its progress.
- Add `review_attempt_id` so corrections can reconcile the exact active-track
  review attempt that currently controls the membership state.

The intended progress row is a track-owned state row. It stores the review
attempt that currently controls the track/problem state. Completed fields are
populated only when that controlling attempt is a completing rating.

```txt
track_problem_progress
- track_id
- problem_slug
- review_attempt_id nullable
- completed_at nullable
- completed_rating nullable
- created_at
- updated_at
```

`completed_rating` remains constrained to `good | easy` when present. A row with
`completed_at = null` and `completed_rating = null` represents a controlling
active-track review attempt that did not complete the track problem. This state
is required so a later override from `hard` or `again` to `good` or `easy` can
complete the same active-track problem without deriving from global practice
history. `review_attempt_id` is written for all new active-track reviews; it is
nullable only for restored legacy progress rows or if a global practice reset
deletes the source review attempt.

## Write Flow

The background handler should stop owning the rule "if review is good/easy,
record track completion." It should delegate to a service workflow that can run
practice and track writes in one database transaction.

Target flow:

```txt
runtime handler
-> parse and authorize
-> runDbMutation
-> one DB transaction
   -> save or override practice review
   -> reconcile active-track progress when Study Plan is active
-> read fresh practice details
-> flush snapshot
-> broadcast invalidation
```

Ownership boundaries stay intact:

- `practice` repository writes cards, review attempts, and practice aggregates.
- `tracks` repository writes track membership and progress state.
- a small service-level coordinator composes the two repositories for review
  save/override workflows.

## Completion Policy

Initial save:

- `good` or `easy` completes the matching problem in the active track when Study
  Plan is active.
- `hard` or `again` does not complete track progress.
- Free Practice never writes track progress.

Override:

- If the overridden review attempt is the attempt that completed the track
  problem, changing it to `hard` or `again` clears that completion.
- Changing the same attempt back to `good` or `easy` restores completion.
- Changing `good` to `easy`, or `easy` to `good`, updates the stored completed
  rating.
- If the track was reset after the attempt, the progress row is gone and the old
  override does not recreate it.
- If a different later attempt now controls the track completion, editing an
  older attempt does not affect track progress.

Reset:

- `tracks.resetTrackProgress(trackId)` deletes rows by `track_id`.
- It does not delete review attempts, FSRS cards, or problem practice state.
- Old practice overrides after reset do not recreate deleted progress.

## Migration

Migration should preserve current local state when possible:

1. Add `track_id` to `track_group_problems`.
2. Backfill `track_group_problems.track_id` from `track_groups.track_id`.
3. Rebuild or constrain memberships so `(track_id, problem_slug)` is unique.
4. Rebuild `track_problem_progress` around `(track_id, problem_slug)`.
5. Backfill existing progress by joining old progress rows through
   `track_groups`.
6. Add `review_attempt_id` as nullable storage, while requiring the runtime
   active-track review workflow to write it for new rows.

If duplicate problem memberships already exist in the same track, the migration
should fail when the new uniqueness constraint is applied. The implementation
must not silently drop duplicate user data.

## Backup And Sync

Backup progress rows should serialize by `trackId + problemSlug`, not
`trackGroupId + problemSlug`.

Restore should validate:

- a problem appears at most once per track
- progress rows reference existing track/problem memberships
- track session rows use the singleton `id: "active"`
- at most one session row exists
- `activeGroupId` is null when `activeTrackId` is null
- when both active ids exist, the active group belongs to the active track

Because sync envelopes use backup data, the implementation will bump the backup
schema to version `2`, export only the new track-owned progress shape, and keep
restore compatibility for version `1` by normalizing old `trackGroupId +
problemSlug` progress rows through their group track ids. The sync envelope
version does not need to change because the envelope protocol is unchanged.

## Contracts And Types

Track membership completion should stop being a loose nullable pair in domain
code. Prefer a small discriminated shape internally:

```ts
type TrackProblemCompletion =
  | { status: 'incomplete' }
  | {
      status: 'completed'
      completedAt: Date
      completedRating: TrackCompletedRating
      reviewAttemptId: string | null
    }
```

Runtime serialization can still expose fields shaped for the current UI, but the
domain should not be able to construct half-completed states.

Practice save/override results should expose the relevant review attempt id to
the coordinator without leaking repository internals into UI contracts unless a
UI surface actually needs it.

## Tests

Repository tests:

- duplicate problem in the same track is rejected
- group move preserves progress
- membership removal clears progress for that track/problem
- reset deletes progress by track id
- active-track completion does not leak to inactive tracks

Practice/track workflow tests:

- `good` and `easy` complete active-track progress in Study Plan
- `hard` and `again` do not complete active-track progress
- Free Practice never writes track progress
- override `good/easy -> hard/again` clears only the sourced completion
- override `hard/again -> good/easy` restores only the sourced completion
- override `good <-> easy` updates the stored completion rating
- reset prevents old overrides from resurrecting progress
- a later controlling attempt prevents old attempt edits from mutating progress

Backup/sync tests:

- new progress shape serializes and restores
- selected old progress compatibility policy is covered
- invalid duplicate track problems are rejected
- invalid singleton session rows are rejected
- active group outside active track is rejected

Runtime tests:

- review save/override delegates to the atomic workflow
- snapshot flush still happens before invalidation
- invalidation includes `practice`, `problems`, `queue`, `tracks`, and
  `app-shell`

## Non-Goals

- No global derivation of track completion from all historical review attempts.
- No support for duplicate appearances of the same problem in one track.
- No changes to Library ownership of global problem management.
- No changes to Free Practice hiding active-track progression.
- No broader backup/sync redesign beyond the compatibility needed for this
  schema change.
