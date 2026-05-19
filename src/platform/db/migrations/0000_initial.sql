PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS problems (
  id TEXT PRIMARY KEY NOT NULL,
  source TEXT NOT NULL,
  external_id TEXT,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  url TEXT NOT NULL,
  is_premium INTEGER NOT NULL DEFAULT false,
  acceptance_rate REAL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS problems_slug_unique ON problems (slug);
CREATE INDEX IF NOT EXISTS problems_slug_idx ON problems (slug);

CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY NOT NULL,
  label TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS topics_label_unique ON topics (label);

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY NOT NULL,
  label TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS companies_label_unique ON companies (label);

CREATE TABLE IF NOT EXISTS problem_topics (
  problem_id TEXT NOT NULL REFERENCES problems (id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL REFERENCES topics (id) ON DELETE CASCADE,
  PRIMARY KEY (problem_id, topic_id)
);

CREATE INDEX IF NOT EXISTS problem_topics_topic_idx ON problem_topics (topic_id);

CREATE TABLE IF NOT EXISTS problem_companies (
  problem_id TEXT NOT NULL REFERENCES problems (id) ON DELETE CASCADE,
  company_id TEXT NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  PRIMARY KEY (problem_id, company_id)
);

CREATE INDEX IF NOT EXISTS problem_companies_company_idx ON problem_companies (company_id);

CREATE TABLE IF NOT EXISTS problem_practice (
  problem_id TEXT PRIMARY KEY NOT NULL REFERENCES problems (id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER,
  last_reviewed_at INTEGER,
  solved_count INTEGER NOT NULL DEFAULT 0,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  is_suspended INTEGER NOT NULL DEFAULT false,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS problem_practice_status_idx ON problem_practice (status);
CREATE INDEX IF NOT EXISTS problem_practice_last_reviewed_idx ON problem_practice (last_reviewed_at);
CREATE INDEX IF NOT EXISTS problem_practice_suspended_idx ON problem_practice (is_suspended);

CREATE TABLE IF NOT EXISTS fsrs_cards (
  id TEXT PRIMARY KEY NOT NULL,
  problem_id TEXT NOT NULL REFERENCES problems (id) ON DELETE CASCADE,
  card_kind TEXT NOT NULL,
  due_at INTEGER NOT NULL,
  stability REAL NOT NULL,
  difficulty REAL NOT NULL,
  elapsed_days INTEGER NOT NULL,
  scheduled_days INTEGER NOT NULL,
  learning_steps INTEGER NOT NULL,
  reps INTEGER NOT NULL,
  lapses INTEGER NOT NULL,
  state TEXT NOT NULL,
  last_review_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS fsrs_cards_due_idx ON fsrs_cards (due_at);
CREATE UNIQUE INDEX IF NOT EXISTS fsrs_cards_problem_kind_unique ON fsrs_cards (problem_id, card_kind);

CREATE TABLE IF NOT EXISTS review_attempts (
  id TEXT PRIMARY KEY NOT NULL,
  problem_id TEXT NOT NULL REFERENCES problems (id) ON DELETE CASCADE,
  card_id TEXT NOT NULL REFERENCES fsrs_cards (id) ON DELETE CASCADE,
  rating TEXT NOT NULL,
  review_mode TEXT NOT NULL,
  reviewed_at INTEGER NOT NULL,
  elapsed_seconds INTEGER,
  is_correct INTEGER,
  notes TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS review_attempts_problem_idx ON review_attempts (problem_id);
CREATE INDEX IF NOT EXISTS review_attempts_card_idx ON review_attempts (card_id);
CREATE INDEX IF NOT EXISTS review_attempts_reviewed_at_idx ON review_attempts (reviewed_at);

CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT false,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS tracks_slug_unique ON tracks (slug);
CREATE INDEX IF NOT EXISTS tracks_active_idx ON tracks (is_active);

CREATE TABLE IF NOT EXISTS track_groups (
  id TEXT PRIMARY KEY NOT NULL,
  track_id TEXT NOT NULL REFERENCES tracks (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS track_groups_track_idx ON track_groups (track_id);

CREATE TABLE IF NOT EXISTS track_group_problems (
  track_group_id TEXT NOT NULL REFERENCES track_groups (id) ON DELETE CASCADE,
  problem_id TEXT NOT NULL REFERENCES problems (id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  PRIMARY KEY (track_group_id, problem_id)
);

CREATE INDEX IF NOT EXISTS track_group_problems_problem_idx ON track_group_problems (problem_id);

CREATE TABLE IF NOT EXISTS track_session (
  id TEXT PRIMARY KEY NOT NULL,
  active_track_id TEXT REFERENCES tracks (id) ON DELETE SET NULL,
  active_group_id TEXT REFERENCES track_groups (id) ON DELETE SET NULL,
  started_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings_kv (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
