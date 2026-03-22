-- Phase 3 schema: revenue targets, churn/adjustments, headcount

CREATE TABLE IF NOT EXISTS `revenueTargets` (
  `id` int AUTO_INCREMENT NOT NULL,
  `companyId` int NOT NULL,
  `regionId` int NOT NULL,
  `year` int NOT NULL,
  `quarter` int NOT NULL,
  `targetNewBiz` int NOT NULL DEFAULT 0,
  `targetUpsell` int NOT NULL DEFAULT 0,
  `targetTotal` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `revenueTargets_id` PRIMARY KEY(`id`),
  CONSTRAINT `rt_co_reg_yr_q_unique` UNIQUE(`companyId`,`regionId`,`year`,`quarter`)
);

CREATE TABLE IF NOT EXISTS `churnData` (
  `id` int AUTO_INCREMENT NOT NULL,
  `companyId` int NOT NULL,
  `regionId` int NOT NULL,
  `year` int NOT NULL,
  `quarter` int NOT NULL,
  `churnAmount` int NOT NULL DEFAULT 0,
  `maaArr` int NOT NULL DEFAULT 0,
  `adjustment` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `churnData_id` PRIMARY KEY(`id`),
  CONSTRAINT `ch_co_reg_yr_q_unique` UNIQUE(`companyId`,`regionId`,`year`,`quarter`)
);

CREATE TABLE IF NOT EXISTS `headcount` (
  `id` int AUTO_INCREMENT NOT NULL,
  `companyId` int NOT NULL,
  `regionId` int NOT NULL,
  `year` int NOT NULL,
  `quarter` int NOT NULL,
  `amCount` int NOT NULL DEFAULT 0,
  `aeCount` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `headcount_id` PRIMARY KEY(`id`),
  CONSTRAINT `hc_co_reg_yr_q_unique` UNIQUE(`companyId`,`regionId`,`year`,`quarter`)
);
