PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_topic_relations` (
	`source_topic_id` text NOT NULL,
	`target_topic_id` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`kind`, `source_topic_id`, `target_topic_id`),
	FOREIGN KEY (`source_topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "topic_relations_no_self_check" CHECK("__new_topic_relations"."source_topic_id" <> "__new_topic_relations"."target_topic_id"),
	CONSTRAINT "topic_relations_kind_check" CHECK("__new_topic_relations"."kind" IN ('broader', 'applies-to'))
);
--> statement-breakpoint
INSERT INTO `__new_topic_relations`("source_topic_id", "target_topic_id", "kind", "created_at", "updated_at") SELECT "child_topic_id", "parent_topic_id", 'broader', "created_at", "updated_at" FROM `topic_relations`;--> statement-breakpoint
DROP TABLE `topic_relations`;--> statement-breakpoint
ALTER TABLE `__new_topic_relations` RENAME TO `topic_relations`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `topic_relations_source_idx` ON `topic_relations` (`source_topic_id`);--> statement-breakpoint
CREATE INDEX `topic_relations_target_idx` ON `topic_relations` (`target_topic_id`);
