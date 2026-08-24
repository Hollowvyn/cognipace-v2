# Track Import

Track import creates new local Tracks from a strict JSON file. It is a
non-destructive workflow: existing problems are reused, existing problem
metadata and practice state are preserved, and existing tracks are never
updated or replaced.

## Import a file

1. Open the dashboard and navigate to **Tracks**.
2. Choose **Import Tracks**.
3. Select one `.json` file.
4. Review the preview counts for tracks, groups, and unique referenced
   problems.
5. Choose **Import Tracks** to commit the import.

Selecting a file only validates it and builds a preview. Persistence happens
only after the explicit import action. Imported tracks are created inactive;
the workflow never changes the active track.

## File envelope

The file must use the versioned `cognipace-track-import` envelope. Objects are
strict: unsupported or misspelled fields are rejected.

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

### Fields

| Field                   | Required | Rules and defaults                                                                                    |
| ----------------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| `schemaVersion`         | Yes      | Must be `1`.                                                                                          |
| `app`                   | Yes      | Must be `cognipace-track-import`.                                                                     |
| `problems`              | No       | Top-level problem definitions; defaults to `[]`. Maximum 5,000 definitions.                           |
| `tracks`                | Yes      | One or more tracks; maximum 20 tracks.                                                                |
| `problems[].slug`       | Yes      | Canonical problem slug, trimmed and normalized; maximum 200 characters.                               |
| `problems[].title`      | No       | Display title for a missing problem. If omitted, it is derived from the slug. Maximum 200 characters. |
| `problems[].difficulty` | No       | `easy`, `medium`, `hard`, or `unknown`; defaults to `unknown`.                                        |
| `problems[].isPremium`  | No       | Boolean; defaults to `false`.                                                                         |
| `tracks[].title`        | Yes      | New track title, trimmed and normalized; maximum 200 characters.                                      |
| `tracks[].description`  | No       | Nullable trimmed text; defaults to `null`; maximum 1,000 characters.                                  |
| `tracks[].dueAt`        | No       | Nullable ISO datetime; defaults to `null`.                                                            |
| `tracks[].groups`       | Yes      | At least one group and at most 100 groups per track.                                                  |
| `groups[].title`        | Yes      | Trimmed group title; maximum 200 characters.                                                          |
| `groups[].problemSlugs` | Yes      | At least one slug per group and at most 1,000 references per group.                                   |

The combined `problemSlugs` references in one track are also limited to 1,000.
A normalized problem slug can occur only once in a track, even when the
references are in different groups. The same problem can be referenced by
different tracks in the same file.

## Slugs and metadata

Use canonical LeetCode slugs such as `two-sum`,
`valid-parentheses`, and `merge-intervals`. Do not use a full LeetCode URL or
the problem title in `problemSlugs`. The importer normalizes slug-like values
for identity, but canonical slugs make files deterministic and easier to
review.

Put reusable metadata in the top-level `problems` array and reference it from
groups. A top-level definition is optional: a referenced slug without a
definition still creates a missing Library problem using the derived title,
`unknown` difficulty, and `false` premium status.

When a referenced problem already exists, identity is its normalized slug. The
importer reuses that row without changing its title, difficulty, premium flag,
topics, companies, practice state, or timestamps. It does not create practice,
FSRS, or review-attempt rows for a missing problem.

## Conflicts and rollback

- Top-level problem definitions with duplicate normalized slugs are rejected.
- Tracks with duplicate normalized titles are rejected.
- A normalized problem slug appearing twice in one track is rejected, and the
  later membership is identified in the validation error.
- Track IDs are derived from normalized track titles; the file does not supply
  IDs. If a derived ID already belongs to a local track, the complete import is
  rejected with the conflicting title/ID. Rename the imported track or delete
  the existing track explicitly before retrying.
- Existing tracks are never merged, updated, or replaced.

Validation happens before writes. The persistence step uses one database
transaction for all missing problems, tracks, groups, and memberships. If any
track conflict or persistence error occurs, the transaction rolls back: no
imported problem, track, group, or membership remains, and existing local data
is unchanged. The workflow does not activate an imported track or import
progress, settings, topics, companies, or review state.

On success, the result counts mean:

- **Tracks created**: imported track rows committed.
- **Problems created**: referenced slugs that were missing and inserted.
- **Problems reused**: referenced slugs that already existed and were left
  unchanged.

## Best practices

- Keep one top-level definition per reusable slug and keep group membership
  order explicit.
- Preserve the source curriculum's group order and do not pad a list to match
  a marketing name or expected count.
- Include authoritative titles or difficulty only when the source provides
  them; otherwise rely on the documented fallbacks.
- Keep track titles unique in a file and choose names that will not collide with
  local track IDs.
- Validate the file through the Tracks preview before sharing it.
- Treat the checked-in artifact as an example of the public contract:
  [NeetCode 150 and 250 import](../track-imports/neetcode-150-and-250.json).

## NeetCode example

The checked-in NeetCode file is generated from the legacy curated source at
`CogniPace/src/features/problems/data/seed/curatedSets.ts`. It contains the
`NeetCode 150` and `NeetCode 250` tracks, 35 groups, and 240 unique referenced
problems. After preserving source order and keeping only the first occurrence
of each problem within a track, the tracks contain 144 and 232 unique
memberships respectively. Legacy duplicate memberships are omitted because
the current Tracks model permits one track membership per problem; no padding
or invented problems are added.
