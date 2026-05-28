PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_sequences` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sequence_date` integer NOT NULL,
	`sequence` integer DEFAULT 1 NOT NULL,
	`locked_by` text,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
INSERT INTO `__new_sequences`("id", "sequence_date", "sequence", "locked_by", "created_at", "updated_at") SELECT "id", "sequence_date", "sequence", "locked_by", "created_at", "updated_at" FROM `sequences`;--> statement-breakpoint
DROP TABLE `sequences`;--> statement-breakpoint
ALTER TABLE `__new_sequences` RENAME TO `sequences`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `sequences_sequence_date_unique` ON `sequences` (`sequence_date`);