ALTER TABLE `problem_practice` ADD `last_rating` text;--> statement-breakpoint
ALTER TABLE `problem_practice` ADD `last_elapsed_seconds` integer;--> statement-breakpoint
ALTER TABLE `problem_practice` ADD `best_elapsed_seconds` integer;--> statement-breakpoint
ALTER TABLE `problem_practice` ADD `interview_pattern` text;--> statement-breakpoint
ALTER TABLE `problem_practice` ADD `time_complexity` text;--> statement-breakpoint
ALTER TABLE `problem_practice` ADD `space_complexity` text;--> statement-breakpoint
ALTER TABLE `problem_practice` ADD `languages` text;--> statement-breakpoint
ALTER TABLE `problem_practice` ADD `notes` text;--> statement-breakpoint
ALTER TABLE `review_attempts` ADD `interview_pattern` text;--> statement-breakpoint
ALTER TABLE `review_attempts` ADD `time_complexity` text;--> statement-breakpoint
ALTER TABLE `review_attempts` ADD `space_complexity` text;--> statement-breakpoint
ALTER TABLE `review_attempts` ADD `languages` text;--> statement-breakpoint
ALTER TABLE `review_attempts` ADD `fsrs_review_log` text;--> statement-breakpoint
ALTER TABLE `review_attempts` ADD `updated_at` integer DEFAULT 0 NOT NULL;
