PRAGMA foreign_keys=OFF;--> statement-breakpoint
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
	CONSTRAINT "track_problem_progress_completion_pair_check" CHECK((("__new_track_problem_progress"."completed_at" is null and "__new_track_problem_progress"."completed_rating" is null) or ("__new_track_problem_progress"."completed_at" is not null and "__new_track_problem_progress"."completed_rating" is not null and "__new_track_problem_progress"."completed_rating" in ('hard', 'good', 'easy'))))
);
--> statement-breakpoint
INSERT INTO `__new_track_problem_progress`("track_id", "problem_slug", "review_attempt_id", "completed_at", "completed_rating", "created_at", "updated_at") SELECT "track_id", "problem_slug", "review_attempt_id", "completed_at", "completed_rating", "created_at", "updated_at" FROM `track_problem_progress`;--> statement-breakpoint
DROP TABLE `track_problem_progress`;--> statement-breakpoint
ALTER TABLE `__new_track_problem_progress` RENAME TO `track_problem_progress`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `track_problem_progress_review_attempt_idx` ON `track_problem_progress` (`review_attempt_id`);--> statement-breakpoint
CREATE INDEX `track_problem_progress_problem_slug_idx` ON `track_problem_progress` (`problem_slug`);