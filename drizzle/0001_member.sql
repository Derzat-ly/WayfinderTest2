CREATE TABLE `member` (
	`id` text PRIMARY KEY NOT NULL,
	`organiser_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_key` text NOT NULL,
	`phone` text,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`organiser_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `member_organiser_id_name_idx` ON `member` (`organiser_id`,`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `member_organiser_id_id_unique` ON `member` (`organiser_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `member_organiser_id_email_key_unique` ON `member` (`organiser_id`,`email_key`);