CREATE TABLE `group_membership` (
	`organiser_id` text NOT NULL,
	`group_id` text NOT NULL,
	`member_id` text NOT NULL,
	PRIMARY KEY(`group_id`, `member_id`),
	FOREIGN KEY (`organiser_id`,`group_id`) REFERENCES `member_group`(`organiser_id`,`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organiser_id`,`member_id`) REFERENCES `member`(`organiser_id`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `group_membership_member_id_idx` ON `group_membership` (`member_id`);--> statement-breakpoint
CREATE TABLE `member_group` (
	`id` text PRIMARY KEY NOT NULL,
	`organiser_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`organiser_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `member_group_organiser_id_id_unique` ON `member_group` (`organiser_id`,`id`);