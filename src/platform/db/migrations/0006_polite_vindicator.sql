CREATE TABLE `topic_aliases` (
	`alias_key` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`topic_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `topic_aliases_topic_idx` ON `topic_aliases` (`topic_id`);--> statement-breakpoint
CREATE TABLE `topic_relations` (
	`parent_topic_id` text NOT NULL,
	`child_topic_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`parent_topic_id`, `child_topic_id`),
	FOREIGN KEY (`parent_topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`child_topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "topic_relations_no_self_check" CHECK("topic_relations"."parent_topic_id" <> "topic_relations"."child_topic_id")
);
--> statement-breakpoint
CREATE INDEX `topic_relations_parent_idx` ON `topic_relations` (`parent_topic_id`);--> statement-breakpoint
CREATE INDEX `topic_relations_child_idx` ON `topic_relations` (`child_topic_id`);--> statement-breakpoint
ALTER TABLE `topics` ADD `created_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `topics` ADD `updated_at` integer DEFAULT 0 NOT NULL;