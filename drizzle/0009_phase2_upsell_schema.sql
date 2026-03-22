-- Phase 2 schema changes: upsell tracking columns

ALTER TABLE `actuals` ADD COLUMN `actualUpsellWins` int NOT NULL DEFAULT 0;

ALTER TABLE `quarterlyMetrics` ADD COLUMN `totalUpsellWon` int NOT NULL DEFAULT 0;
ALTER TABLE `quarterlyMetrics` ADD COLUMN `upsellAttachRate` int NOT NULL DEFAULT 0;
