CREATE TABLE `assets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`filename` varchar(500) NOT NULL,
	`mimeType` varchar(100) NOT NULL,
	`size` int NOT NULL,
	`storageKey` varchar(500) NOT NULL,
	`status` enum('pending_upload','uploaded','verified','failed') NOT NULL DEFAULT 'pending_upload',
	`uploadedBy` int,
	`deletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `content_asset_relations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contentType` enum('work','post') NOT NULL,
	`contentId` int NOT NULL,
	`assetId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `content_asset_relations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tags_id` PRIMARY KEY(`id`),
	CONSTRAINT `tags_name_unique` UNIQUE(`name`),
	CONSTRAINT `tags_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `works` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`description` text,
	`content` text NOT NULL,
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`publishedAt` timestamp,
	`deletedAt` timestamp,
	`snapshotVersion` int NOT NULL DEFAULT 0,
	`renderedSnapshot` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `works_id` PRIMARY KEY(`id`),
	CONSTRAINT `works_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `blog_posts` ADD `status` enum('draft','published','archived') DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE `blog_posts` ADD `publishedAt` timestamp;--> statement-breakpoint
ALTER TABLE `blog_posts` ADD `deletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `blog_posts` ADD `snapshotVersion` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `blog_posts` ADD `renderedSnapshot` text;--> statement-breakpoint
CREATE INDEX `blog_posts_status_idx` ON `blog_posts` (`status`);--> statement-breakpoint
CREATE INDEX `blog_posts_publishedAt_idx` ON `blog_posts` (`publishedAt`);--> statement-breakpoint
CREATE INDEX `works_status_idx` ON `works` (`status`);--> statement-breakpoint
CREATE INDEX `works_publishedAt_idx` ON `works` (`publishedAt`);--> statement-breakpoint
ALTER TABLE `assets` ADD CONSTRAINT `assets_uploadedBy_users_id_fk` FOREIGN KEY (`uploadedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `content_asset_relations` ADD CONSTRAINT `content_asset_relations_assetId_assets_id_fk` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE no action ON UPDATE no action;