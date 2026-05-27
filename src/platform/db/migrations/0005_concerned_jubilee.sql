DROP TABLE IF EXISTS `__track_group_problem_unique_preflight`;--> statement-breakpoint
CREATE TEMP TABLE `__track_group_problem_unique_preflight` (
	`track_id` text NOT NULL,
	`problem_slug` text NOT NULL,
	UNIQUE(`track_id`, `problem_slug`)
);--> statement-breakpoint
INSERT INTO `__track_group_problem_unique_preflight`("track_id", "problem_slug")
SELECT
	`track_groups`.`track_id`,
	`track_group_problems`.`problem_slug`
FROM `track_group_problems`
INNER JOIN `track_groups` ON `track_groups`.`id` = `track_group_problems`.`track_group_id`;--> statement-breakpoint
DROP TABLE `__track_group_problem_unique_preflight`;--> statement-breakpoint
CREATE UNIQUE INDEX `track_groups_id_track_unique` ON `track_groups` (`id`,`track_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_track_group_problems` (
	`track_group_id` text NOT NULL,
	`track_id` text NOT NULL,
	`problem_slug` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`track_group_id`, `problem_slug`),
	FOREIGN KEY (`track_id`) REFERENCES `tracks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`problem_slug`) REFERENCES `problems`(`slug`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`track_group_id`,`track_id`) REFERENCES `track_groups`(`id`,`track_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_track_group_problems`("track_group_id", "track_id", "problem_slug", "position")
SELECT
	`track_group_problems`.`track_group_id`,
	`track_groups`.`track_id`,
	`track_group_problems`.`problem_slug`,
	`track_group_problems`.`position`
FROM `track_group_problems`
INNER JOIN `track_groups` ON `track_groups`.`id` = `track_group_problems`.`track_group_id`;--> statement-breakpoint
DROP TABLE `track_group_problems`;--> statement-breakpoint
ALTER TABLE `__new_track_group_problems` RENAME TO `track_group_problems`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `track_group_problems_track_problem_unique` ON `track_group_problems` (`track_id`,`problem_slug`);--> statement-breakpoint
CREATE INDEX `track_group_problems_track_idx` ON `track_group_problems` (`track_id`);--> statement-breakpoint
CREATE INDEX `track_group_problems_problem_slug_idx` ON `track_group_problems` (`problem_slug`);--> statement-breakpoint
CREATE TABLE `__new_track_problem_progress` (
	`track_id` text NOT NULL,
	`problem_slug` text NOT NULL,
	`review_attempt_id` text,
	`completed_at` integer,
	`completed_rating` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`track_id`, `problem_slug`),
	FOREIGN KEY (`review_attempt_id`) REFERENCES `review_attempts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`track_id`,`problem_slug`) REFERENCES `track_group_problems`(`track_id`,`problem_slug`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "track_problem_progress_completion_pair_check" CHECK((("__new_track_problem_progress"."completed_at" is null and "__new_track_problem_progress"."completed_rating" is null) or ("__new_track_problem_progress"."completed_at" is not null and "__new_track_problem_progress"."completed_rating" is not null and "__new_track_problem_progress"."completed_rating" in ('good', 'easy'))))
);
--> statement-breakpoint
INSERT INTO `__new_track_problem_progress`("track_id", "problem_slug", "review_attempt_id", "completed_at", "completed_rating", "created_at", "updated_at")
SELECT
	`track_groups`.`track_id`,
	`track_problem_progress`.`problem_slug`,
	NULL,
	`track_problem_progress`.`completed_at`,
	`track_problem_progress`.`completed_rating`,
	`track_problem_progress`.`created_at`,
	`track_problem_progress`.`updated_at`
FROM `track_problem_progress`
INNER JOIN `track_groups` ON `track_groups`.`id` = `track_problem_progress`.`track_group_id`;--> statement-breakpoint
DROP TABLE `track_problem_progress`;--> statement-breakpoint
ALTER TABLE `__new_track_problem_progress` RENAME TO `track_problem_progress`;--> statement-breakpoint
CREATE INDEX `track_problem_progress_review_attempt_idx` ON `track_problem_progress` (`review_attempt_id`);--> statement-breakpoint
CREATE INDEX `track_problem_progress_problem_slug_idx` ON `track_problem_progress` (`problem_slug`);
