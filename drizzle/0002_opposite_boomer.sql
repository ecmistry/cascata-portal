ALTER TABLE `companies` ADD `bigqueryEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `companies` ADD `bigqueryProjectId` varchar(255);--> statement-breakpoint
ALTER TABLE `companies` ADD `bigqueryDatasetId` varchar(255);--> statement-breakpoint
ALTER TABLE `companies` ADD `bigqueryCredentials` text;--> statement-breakpoint
ALTER TABLE `companies` ADD `bigquerySqlHistoryTable` varchar(255);--> statement-breakpoint
ALTER TABLE `companies` ADD `bigqueryConversionRatesTable` varchar(255);--> statement-breakpoint
ALTER TABLE `companies` ADD `bigqueryActualsTable` varchar(255);--> statement-breakpoint
ALTER TABLE `companies` ADD `bigqueryLastSync` timestamp;