CREATE TABLE `thread_turns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`threadId` varchar(64) NOT NULL,
	`seq` int NOT NULL,
	`role` enum('user','assistant') NOT NULL,
	`agentId` varchar(32),
	`content` text NOT NULL,
	`runId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `thread_turns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `threads` (
	`id` varchar(64) NOT NULL,
	`kind` varchar(32) NOT NULL,
	`subject` varchar(128),
	`summary` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`expiresAt` timestamp,
	CONSTRAINT `threads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `thread_turns_thread_seq` ON `thread_turns` (`threadId`,`seq`);