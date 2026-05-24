CREATE TABLE `track_problem_progress` (
	`track_group_id` text NOT NULL,
	`problem_slug` text NOT NULL,
	`completed_at` integer NOT NULL,
	`completed_rating` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`track_group_id`, `problem_slug`),
	FOREIGN KEY (`track_group_id`,`problem_slug`) REFERENCES `track_group_problems`(`track_group_id`,`problem_slug`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "track_problem_progress_completed_rating_check" CHECK("track_problem_progress"."completed_rating" in ('good', 'easy'))
);
--> statement-breakpoint
CREATE INDEX `track_problem_progress_problem_slug_idx` ON `track_problem_progress` (`problem_slug`);--> statement-breakpoint
DROP INDEX `tracks_active_idx`;--> statement-breakpoint
ALTER TABLE `tracks` DROP COLUMN `is_active`;