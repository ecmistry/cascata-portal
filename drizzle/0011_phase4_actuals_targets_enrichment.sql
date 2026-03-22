-- Phase 4: Enrich actuals with revenue split, extend targets with full model fields

ALTER TABLE `actuals` ADD COLUMN `actualRevenueNew` int NOT NULL DEFAULT 0;
ALTER TABLE `actuals` ADD COLUMN `actualRevenueUpsell` int NOT NULL DEFAULT 0;

ALTER TABLE `revenueTargets` ADD COLUMN `targetSqls` int NOT NULL DEFAULT 0;
ALTER TABLE `revenueTargets` ADD COLUMN `targetOpps` int NOT NULL DEFAULT 0;
ALTER TABLE `revenueTargets` ADD COLUMN `targetWins` int NOT NULL DEFAULT 0;
