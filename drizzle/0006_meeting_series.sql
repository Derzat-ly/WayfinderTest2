CREATE TABLE `meeting_series` (
	`id` text PRIMARY KEY NOT NULL,
	`organiser_id` text NOT NULL,
	`title` text NOT NULL,
	`duration_minutes` integer,
	`location` text,
	`notes` text,
	`private_notes` text,
	`anchor_start_at` integer NOT NULL,
	`timezone` text NOT NULL,
	`interval_unit` text NOT NULL,
	`interval_count` integer NOT NULL,
	`next_occurrence_index` integer DEFAULT 0 NOT NULL,
	`ended_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`organiser_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "meeting_series_interval_count_check" CHECK("meeting_series"."interval_count" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `meeting_series_organiser_id_id_unique` ON `meeting_series` (`organiser_id`,`id`);--> statement-breakpoint
CREATE TABLE `series_linked_group` (
	`organiser_id` text NOT NULL,
	`series_id` text NOT NULL,
	`group_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`series_id`, `group_id`),
	FOREIGN KEY (`organiser_id`,`series_id`) REFERENCES `meeting_series`(`organiser_id`,`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organiser_id`,`group_id`) REFERENCES `member_group`(`organiser_id`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `series_linked_group_group_id_idx` ON `series_linked_group` (`group_id`);--> statement-breakpoint
CREATE TABLE `series_member` (
	`organiser_id` text NOT NULL,
	`series_id` text NOT NULL,
	`member_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`series_id`, `member_id`),
	FOREIGN KEY (`organiser_id`,`series_id`) REFERENCES `meeting_series`(`organiser_id`,`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organiser_id`,`member_id`) REFERENCES `member`(`organiser_id`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `series_member_member_id_idx` ON `series_member` (`member_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_meeting` (
	`id` text PRIMARY KEY NOT NULL,
	`organiser_id` text NOT NULL,
	`series_id` text,
	`occurrence_index` integer,
	`title` text NOT NULL,
	`start_at` integer NOT NULL,
	`timezone` text NOT NULL,
	`duration_minutes` integer,
	`location` text,
	`notes` text,
	`private_notes` text,
	`finalised_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`organiser_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organiser_id`,`series_id`) REFERENCES `meeting_series`(`organiser_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_meeting`("id", "organiser_id", "series_id", "occurrence_index", "title", "start_at", "timezone", "duration_minutes", "location", "notes", "private_notes", "finalised_at", "created_at", "updated_at") SELECT "id", "organiser_id", "series_id", "occurrence_index", "title", "start_at", "timezone", "duration_minutes", "location", "notes", "private_notes", "finalised_at", "created_at", "updated_at" FROM `meeting`;--> statement-breakpoint
DROP TABLE `meeting`;--> statement-breakpoint
ALTER TABLE `__new_meeting` RENAME TO `meeting`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `meeting_organiser_id_start_at_idx` ON `meeting` (`organiser_id`,`start_at`);--> statement-breakpoint
CREATE INDEX `meeting_organiser_id_finalised_at_start_at_idx` ON `meeting` (`organiser_id`,`finalised_at`,`start_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `meeting_organiser_id_id_unique` ON `meeting` (`organiser_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `meeting_series_id_occurrence_index_unique` ON `meeting` (`series_id`,`occurrence_index`);