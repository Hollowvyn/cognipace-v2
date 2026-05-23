PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__problem_id_map` (
	`old_id` text PRIMARY KEY NOT NULL,
	`new_slug` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__problem_id_map`("old_id", "new_slug")
SELECT "id", "slug" FROM `problems`;
--> statement-breakpoint
CREATE TABLE `__fsrs_card_id_map` (
	`old_card_id` text PRIMARY KEY NOT NULL,
	`new_card_id` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__fsrs_card_id_map`("old_card_id", "new_card_id")
SELECT `fsrs_cards`.`id`, `__problem_id_map`.`new_slug` || ':' || `fsrs_cards`.`card_kind`
FROM `fsrs_cards`
INNER JOIN `__problem_id_map` ON `__problem_id_map`.`old_id` = `fsrs_cards`.`problem_id`;
--> statement-breakpoint
CREATE TABLE `__new_problems` (
	`slug` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`difficulty` text NOT NULL,
	`is_premium` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "problems_difficulty_check" CHECK(`difficulty` in ('easy', 'medium', 'hard', 'unknown'))
);
--> statement-breakpoint
INSERT INTO `__new_problems`(
	"slug",
	"title",
	"difficulty",
	"is_premium",
	"created_at",
	"updated_at"
)
SELECT
	"slug",
	"title",
	CASE
		WHEN lower("difficulty") in ('easy', 'medium', 'hard', 'unknown') THEN lower("difficulty")
		ELSE 'unknown'
	END,
	"is_premium",
	"created_at",
	"updated_at"
FROM `problems`;
--> statement-breakpoint
CREATE TABLE `__new_problem_topics` (
	`problem_slug` text NOT NULL,
	`topic_id` text NOT NULL,
	PRIMARY KEY(`problem_slug`, `topic_id`),
	FOREIGN KEY (`problem_slug`) REFERENCES `problems`(`slug`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_problem_topics`("problem_slug", "topic_id")
SELECT `__problem_id_map`.`new_slug`, `problem_topics`.`topic_id`
FROM `problem_topics`
INNER JOIN `__problem_id_map` ON `__problem_id_map`.`old_id` = `problem_topics`.`problem_id`;
--> statement-breakpoint
CREATE TABLE `__new_problem_companies` (
	`problem_slug` text NOT NULL,
	`company_id` text NOT NULL,
	PRIMARY KEY(`problem_slug`, `company_id`),
	FOREIGN KEY (`problem_slug`) REFERENCES `problems`(`slug`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_problem_companies`("problem_slug", "company_id")
SELECT `__problem_id_map`.`new_slug`, `problem_companies`.`company_id`
FROM `problem_companies`
INNER JOIN `__problem_id_map` ON `__problem_id_map`.`old_id` = `problem_companies`.`problem_id`;
--> statement-breakpoint
CREATE TABLE `__new_problem_practice` (
	`problem_slug` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`first_seen_at` integer NOT NULL,
	`last_seen_at` integer,
	`last_reviewed_at` integer,
	`last_rating` text,
	`last_elapsed_seconds` integer,
	`best_elapsed_seconds` integer,
	`interview_pattern` text,
	`time_complexity` text,
	`space_complexity` text,
	`languages` text,
	`notes` text,
	`solved_count` integer DEFAULT 0 NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`is_suspended` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`problem_slug`) REFERENCES `problems`(`slug`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_problem_practice`(
	"problem_slug",
	"status",
	"first_seen_at",
	"last_seen_at",
	"last_reviewed_at",
	"last_rating",
	"last_elapsed_seconds",
	"best_elapsed_seconds",
	"interview_pattern",
	"time_complexity",
	"space_complexity",
	"languages",
	"notes",
	"solved_count",
	"attempt_count",
	"is_suspended",
	"created_at",
	"updated_at"
)
SELECT
	`__problem_id_map`.`new_slug`,
	`problem_practice`.`status`,
	`problem_practice`.`first_seen_at`,
	`problem_practice`.`last_seen_at`,
	`problem_practice`.`last_reviewed_at`,
	`problem_practice`.`last_rating`,
	`problem_practice`.`last_elapsed_seconds`,
	`problem_practice`.`best_elapsed_seconds`,
	`problem_practice`.`interview_pattern`,
	`problem_practice`.`time_complexity`,
	`problem_practice`.`space_complexity`,
	`problem_practice`.`languages`,
	`problem_practice`.`notes`,
	`problem_practice`.`solved_count`,
	`problem_practice`.`attempt_count`,
	`problem_practice`.`is_suspended`,
	`problem_practice`.`created_at`,
	`problem_practice`.`updated_at`
FROM `problem_practice`
INNER JOIN `__problem_id_map` ON `__problem_id_map`.`old_id` = `problem_practice`.`problem_id`;
--> statement-breakpoint
CREATE TABLE `__new_fsrs_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`problem_slug` text NOT NULL,
	`card_kind` text NOT NULL,
	`due_at` integer NOT NULL,
	`stability` real NOT NULL,
	`difficulty` real NOT NULL,
	`elapsed_days` integer NOT NULL,
	`scheduled_days` integer NOT NULL,
	`learning_steps` integer NOT NULL,
	`reps` integer NOT NULL,
	`lapses` integer NOT NULL,
	`state` text NOT NULL,
	`last_review_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`problem_slug`) REFERENCES `problems`(`slug`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_fsrs_cards`(
	"id",
	"problem_slug",
	"card_kind",
	"due_at",
	"stability",
	"difficulty",
	"elapsed_days",
	"scheduled_days",
	"learning_steps",
	"reps",
	"lapses",
	"state",
	"last_review_at",
	"created_at",
	"updated_at"
)
SELECT
	`__fsrs_card_id_map`.`new_card_id`,
	`__problem_id_map`.`new_slug`,
	`fsrs_cards`.`card_kind`,
	`fsrs_cards`.`due_at`,
	`fsrs_cards`.`stability`,
	`fsrs_cards`.`difficulty`,
	`fsrs_cards`.`elapsed_days`,
	`fsrs_cards`.`scheduled_days`,
	`fsrs_cards`.`learning_steps`,
	`fsrs_cards`.`reps`,
	`fsrs_cards`.`lapses`,
	`fsrs_cards`.`state`,
	`fsrs_cards`.`last_review_at`,
	`fsrs_cards`.`created_at`,
	`fsrs_cards`.`updated_at`
FROM `fsrs_cards`
INNER JOIN `__problem_id_map` ON `__problem_id_map`.`old_id` = `fsrs_cards`.`problem_id`
INNER JOIN `__fsrs_card_id_map` ON `__fsrs_card_id_map`.`old_card_id` = `fsrs_cards`.`id`;
--> statement-breakpoint
CREATE TABLE `__new_review_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`problem_slug` text NOT NULL,
	`card_id` text NOT NULL,
	`rating` text NOT NULL,
	`review_mode` text NOT NULL,
	`reviewed_at` integer NOT NULL,
	`elapsed_seconds` integer,
	`is_correct` integer,
	`interview_pattern` text,
	`time_complexity` text,
	`space_complexity` text,
	`languages` text,
	`notes` text,
	`fsrs_review_log` text,
	`created_at` integer NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`problem_slug`) REFERENCES `problems`(`slug`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`card_id`) REFERENCES `fsrs_cards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_review_attempts`(
	"id",
	"problem_slug",
	"card_id",
	"rating",
	"review_mode",
	"reviewed_at",
	"elapsed_seconds",
	"is_correct",
	"interview_pattern",
	"time_complexity",
	"space_complexity",
	"languages",
	"notes",
	"fsrs_review_log",
	"created_at",
	"updated_at"
)
SELECT
	`review_attempts`.`id`,
	`__problem_id_map`.`new_slug`,
	`__fsrs_card_id_map`.`new_card_id`,
	`review_attempts`.`rating`,
	`review_attempts`.`review_mode`,
	`review_attempts`.`reviewed_at`,
	`review_attempts`.`elapsed_seconds`,
	`review_attempts`.`is_correct`,
	`review_attempts`.`interview_pattern`,
	`review_attempts`.`time_complexity`,
	`review_attempts`.`space_complexity`,
	`review_attempts`.`languages`,
	`review_attempts`.`notes`,
	`review_attempts`.`fsrs_review_log`,
	`review_attempts`.`created_at`,
	`review_attempts`.`updated_at`
FROM `review_attempts`
INNER JOIN `__problem_id_map` ON `__problem_id_map`.`old_id` = `review_attempts`.`problem_id`
INNER JOIN `__fsrs_card_id_map` ON `__fsrs_card_id_map`.`old_card_id` = `review_attempts`.`card_id`;
--> statement-breakpoint
CREATE TABLE `__new_track_group_problems` (
	`track_group_id` text NOT NULL,
	`problem_slug` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`track_group_id`, `problem_slug`),
	FOREIGN KEY (`track_group_id`) REFERENCES `track_groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`problem_slug`) REFERENCES `problems`(`slug`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_track_group_problems`("track_group_id", "problem_slug", "position")
SELECT `track_group_problems`.`track_group_id`, `__problem_id_map`.`new_slug`, `track_group_problems`.`position`
FROM `track_group_problems`
INNER JOIN `__problem_id_map` ON `__problem_id_map`.`old_id` = `track_group_problems`.`problem_id`;
--> statement-breakpoint
DROP TABLE `review_attempts`;--> statement-breakpoint
DROP TABLE `fsrs_cards`;--> statement-breakpoint
DROP TABLE `problem_practice`;--> statement-breakpoint
DROP TABLE `problem_topics`;--> statement-breakpoint
DROP TABLE `problem_companies`;--> statement-breakpoint
DROP TABLE `track_group_problems`;--> statement-breakpoint
DROP TABLE `problems`;--> statement-breakpoint
ALTER TABLE `__new_problems` RENAME TO `problems`;--> statement-breakpoint
ALTER TABLE `__new_problem_topics` RENAME TO `problem_topics`;--> statement-breakpoint
ALTER TABLE `__new_problem_companies` RENAME TO `problem_companies`;--> statement-breakpoint
ALTER TABLE `__new_problem_practice` RENAME TO `problem_practice`;--> statement-breakpoint
ALTER TABLE `__new_fsrs_cards` RENAME TO `fsrs_cards`;--> statement-breakpoint
ALTER TABLE `__new_review_attempts` RENAME TO `review_attempts`;--> statement-breakpoint
ALTER TABLE `__new_track_group_problems` RENAME TO `track_group_problems`;--> statement-breakpoint
DROP TABLE `__fsrs_card_id_map`;--> statement-breakpoint
DROP TABLE `__problem_id_map`;--> statement-breakpoint
CREATE INDEX `problem_topics_topic_idx` ON `problem_topics` (`topic_id`);--> statement-breakpoint
CREATE INDEX `problem_companies_company_idx` ON `problem_companies` (`company_id`);--> statement-breakpoint
CREATE INDEX `problem_practice_status_idx` ON `problem_practice` (`status`);--> statement-breakpoint
CREATE INDEX `problem_practice_last_reviewed_idx` ON `problem_practice` (`last_reviewed_at`);--> statement-breakpoint
CREATE INDEX `problem_practice_suspended_idx` ON `problem_practice` (`is_suspended`);--> statement-breakpoint
CREATE INDEX `fsrs_cards_due_idx` ON `fsrs_cards` (`due_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `fsrs_cards_problem_slug_kind_unique` ON `fsrs_cards` (`problem_slug`,`card_kind`);--> statement-breakpoint
CREATE INDEX `review_attempts_problem_slug_idx` ON `review_attempts` (`problem_slug`);--> statement-breakpoint
CREATE INDEX `review_attempts_card_idx` ON `review_attempts` (`card_id`);--> statement-breakpoint
CREATE INDEX `review_attempts_reviewed_at_idx` ON `review_attempts` (`reviewed_at`);--> statement-breakpoint
CREATE INDEX `track_group_problems_problem_slug_idx` ON `track_group_problems` (`problem_slug`);--> statement-breakpoint
PRAGMA foreign_keys=ON;
