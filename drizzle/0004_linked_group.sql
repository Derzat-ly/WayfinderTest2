CREATE TABLE `meeting_linked_group` (
	`id` text PRIMARY KEY NOT NULL,
	`organiser_id` text NOT NULL,
	`meeting_id` text NOT NULL,
	`group_id` text,
	`group_name` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `member_group`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`organiser_id`,`meeting_id`) REFERENCES `meeting`(`organiser_id`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `meeting_linked_group_group_id_idx` ON `meeting_linked_group` (`group_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `meeting_linked_group_meeting_id_group_id_unique` ON `meeting_linked_group` (`meeting_id`,`group_id`);