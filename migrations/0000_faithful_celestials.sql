CREATE TABLE `ads` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`creative_concept` text DEFAULT '' NOT NULL,
	`primary_text` text DEFAULT '' NOT NULL,
	`headline` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`cta` text NOT NULL,
	`image_url` text,
	`edited` integer DEFAULT false NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`status` text NOT NULL,
	`render_mode` text NOT NULL,
	`language` text DEFAULT 'auto' NOT NULL,
	`degradation_reasons` text DEFAULT '[]' NOT NULL,
	`brief` text,
	`colors` text DEFAULT '[]' NOT NULL,
	`images` text DEFAULT '[]' NOT NULL,
	`cost_usd` real DEFAULT 0 NOT NULL,
	`tokens_in` integer DEFAULT 0 NOT NULL,
	`tokens_out` integer DEFAULT 0 NOT NULL,
	`duration_ms` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
