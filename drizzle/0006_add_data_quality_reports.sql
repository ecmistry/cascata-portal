CREATE TABLE `dataQualityReports` (
  `id` int AUTO_INCREMENT NOT NULL,
  `companyId` int NOT NULL,
  `syncTimestamp` timestamp NOT NULL DEFAULT (now()),
  `reportJson` text NOT NULL,
  `contactsFetched` int NOT NULL DEFAULT 0,
  `contactsUsed` int NOT NULL DEFAULT 0,
  `contactsSkipped` int NOT NULL DEFAULT 0,
  `coveragePct` int NOT NULL DEFAULT 0,
  `dealsFetched` int NOT NULL DEFAULT 0,
  `dealsUsed` int NOT NULL DEFAULT 0,
  `dealsSkipped` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `dataQualityReports_id` PRIMARY KEY(`id`)
);
