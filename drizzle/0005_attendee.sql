CREATE TABLE `attendee` (
	`id` text PRIMARY KEY NOT NULL,
	`organiser_id` text NOT NULL,
	`meeting_id` text NOT NULL,
	`member_id` text,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`added_via` text NOT NULL,
	`via_link_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `member`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`via_link_id`) REFERENCES `meeting_linked_group`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`organiser_id`,`meeting_id`) REFERENCES `meeting`(`organiser_id`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `attendee_member_id_idx` ON `attendee` (`member_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `attendee_meeting_id_member_id_unique` ON `attendee` (`meeting_id`,`member_id`);