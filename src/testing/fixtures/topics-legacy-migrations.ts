import migration0000 from '@/platform/db/migrations/0000_initial.sql?raw'
import migration0001 from '@/platform/db/migrations/0001_lively_namor.sql?raw'
import migration0002 from '@/platform/db/migrations/0002_add_track_due_at.sql?raw'
import migration0003 from '@/platform/db/migrations/0003_problem_slugs_and_constraints.sql?raw'
import migration0004 from '@/platform/db/migrations/0004_tracks_phase_3.sql?raw'
import migration0005 from '@/platform/db/migrations/0005_concerned_jubilee.sql?raw'
import migration0006 from '@/platform/db/migrations/0006_polite_vindicator.sql?raw'
import migration0007 from '@/platform/db/migrations/0007_track_simple_recall.sql?raw'

export const frozenLegacyMigrationEntries = [
  { path: './migrations/0000_initial.sql', sql: migration0000 },
  { path: './migrations/0001_lively_namor.sql', sql: migration0001 },
  { path: './migrations/0002_add_track_due_at.sql', sql: migration0002 },
  {
    path: './migrations/0003_problem_slugs_and_constraints.sql',
    sql: migration0003,
  },
  { path: './migrations/0004_tracks_phase_3.sql', sql: migration0004 },
  { path: './migrations/0005_concerned_jubilee.sql', sql: migration0005 },
  { path: './migrations/0006_polite_vindicator.sql', sql: migration0006 },
  { path: './migrations/0007_track_simple_recall.sql', sql: migration0007 },
] as const

// Pinned from the baseline migration SQL. Historical edits must not update this.
export const expectedLegacyMigrationFingerprint = 'b1c2b4d7'
