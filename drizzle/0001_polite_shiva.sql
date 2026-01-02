CREATE TABLE `actuals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`regionId` int NOT NULL,
	`sqlTypeId` int NOT NULL,
	`year` int NOT NULL,
	`quarter` int NOT NULL,
	`actualSqls` int NOT NULL DEFAULT 0,
	`actualOpps` int NOT NULL DEFAULT 0,
	`actualRevenue` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `actuals_id` PRIMARY KEY(`id`),
	CONSTRAINT `actuals_companyId_regionId_sqlTypeId_year_quarter_unique` UNIQUE(`companyId`,`regionId`,`sqlTypeId`,`year`,`quarter`)
);
--> statement-breakpoint
CREATE TABLE `companies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `companies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `conversionRates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`regionId` int NOT NULL,
	`sqlTypeId` int NOT NULL,
	`oppCoverageRatio` int NOT NULL DEFAULT 500,
	`winRateNew` int NOT NULL DEFAULT 2500,
	`winRateUpsell` int NOT NULL DEFAULT 3000,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `conversionRates_id` PRIMARY KEY(`id`),
	CONSTRAINT `conversionRates_companyId_regionId_sqlTypeId_unique` UNIQUE(`companyId`,`regionId`,`sqlTypeId`)
);
--> statement-breakpoint
CREATE TABLE `dealEconomics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`regionId` int NOT NULL,
	`acvNew` int NOT NULL DEFAULT 100000,
	`acvUpsell` int NOT NULL DEFAULT 50000,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dealEconomics_id` PRIMARY KEY(`id`),
	CONSTRAINT `dealEconomics_companyId_regionId_unique` UNIQUE(`companyId`,`regionId`)
);
--> statement-breakpoint
CREATE TABLE `forecasts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`regionId` int NOT NULL,
	`sqlTypeId` int NOT NULL,
	`year` int NOT NULL,
	`quarter` int NOT NULL,
	`predictedSqls` int NOT NULL DEFAULT 0,
	`predictedOpps` int NOT NULL DEFAULT 0,
	`predictedRevenueNew` int NOT NULL DEFAULT 0,
	`predictedRevenueUpsell` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `forecasts_id` PRIMARY KEY(`id`),
	CONSTRAINT `forecasts_companyId_regionId_sqlTypeId_year_quarter_unique` UNIQUE(`companyId`,`regionId`,`sqlTypeId`,`year`,`quarter`)
);
--> statement-breakpoint
CREATE TABLE `regions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`displayName` varchar(100) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `regions_id` PRIMARY KEY(`id`),
	CONSTRAINT `regions_companyId_name_unique` UNIQUE(`companyId`,`name`)
);
--> statement-breakpoint
CREATE TABLE `sqlHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`regionId` int NOT NULL,
	`sqlTypeId` int NOT NULL,
	`year` int NOT NULL,
	`quarter` int NOT NULL,
	`volume` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sqlHistory_id` PRIMARY KEY(`id`),
	CONSTRAINT `sqlHistory_companyId_regionId_sqlTypeId_year_quarter_unique` UNIQUE(`companyId`,`regionId`,`sqlTypeId`,`year`,`quarter`)
);
--> statement-breakpoint
CREATE TABLE `sqlTypes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`displayName` varchar(100) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sqlTypes_id` PRIMARY KEY(`id`),
	CONSTRAINT `sqlTypes_companyId_name_unique` UNIQUE(`companyId`,`name`)
);
--> statement-breakpoint
CREATE TABLE `timeDistributions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`sqlTypeId` int NOT NULL,
	`sameQuarterPct` int NOT NULL DEFAULT 8900,
	`nextQuarterPct` int NOT NULL DEFAULT 1000,
	`twoQuarterPct` int NOT NULL DEFAULT 100,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `timeDistributions_id` PRIMARY KEY(`id`),
	CONSTRAINT `timeDistributions_companyId_sqlTypeId_unique` UNIQUE(`companyId`,`sqlTypeId`)
);
