CREATE TABLE `meeting` (
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
	FOREIGN KEY (`organiser_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `meeting_organiser_id_start_at_idx` ON `meeting` (`organiser_id`,`start_at`);--> statement-breakpoint
CREATE INDEX `meeting_organiser_id_finalised_at_start_at_idx` ON `meeting` (`organiser_id`,`finalised_at`,`start_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `meeting_organiser_id_id_unique` ON `meeting` (`organiser_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `meeting_series_id_occurrence_index_unique` ON `meeting` (`series_id`,`occurrence_index`);--> statement-breakpoint
CREATE TABLE `meeting_member` (
	`organiser_id` text NOT NULL,
	`meeting_id` text NOT NULL,
	`member_id` text NOT NULL,
	`copied_from_group_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`meeting_id`, `member_id`),
	FOREIGN KEY (`copied_from_group_id`) REFERENCES `member_group`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`organiser_id`,`meeting_id`) REFERENCES `meeting`(`organiser_id`,`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organiser_id`,`member_id`) REFERENCES `member`(`organiser_id`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `meeting_member_member_id_idx` ON `meeting_member` (`member_id`);