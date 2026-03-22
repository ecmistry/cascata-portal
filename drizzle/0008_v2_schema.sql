-- v2.0 schema changes: actualWins, quarterlyMetrics, rScoreHistory

ALTER TABLE `actuals` ADD COLUMN `actualWins` int NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS `quarterlyMetrics` (
  `id` int AUTO_INCREMENT NOT NULL,
  `companyId` int NOT NULL,
  `regionId` int NOT NULL,
  `sqlTypeId` int NOT NULL,
  `year` int NOT NULL,
  `quarter` int NOT NULL,
  `pipelineCoverRatio` int NOT NULL DEFAULT 0,
  `avgAcvNew` int NOT NULL DEFAULT 0,
  `avgAcvUpsell` int NOT NULL DEFAULT 0,
  `totalClosedWon` int NOT NULL DEFAULT 0,
  `totalClosedLost` int NOT NULL DEFAULT 0,
  `customerCount` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `quarterlyMetrics_id` PRIMARY KEY(`id`),
  CONSTRAINT `qm_co_reg_sql_yr_q_unique`
    UNIQUE(`companyId`,`regionId`,`sqlTypeId`,`year`,`quarter`)
);

CREATE TABLE IF NOT EXISTS `rScoreHistory` (
  `id` int AUTO_INCREMENT NOT NULL,
  `companyId` int NOT NULL,
  `metricType` enum('ocr','owr','overall') NOT NULL,
  `regionId` int,
  `year` int NOT NULL,
  `quarter` int NOT NULL,
  `rScore` decimal(6,4) NOT NULL,
  `sampleSize` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `rScoreHistory_id` PRIMARY KEY(`id`)
);
