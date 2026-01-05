-- Remove BigQuery columns from companies table
ALTER TABLE `companies` DROP COLUMN IF EXISTS `bigqueryEnabled`;
ALTER TABLE `companies` DROP COLUMN IF EXISTS `bigqueryProjectId`;
ALTER TABLE `companies` DROP COLUMN IF EXISTS `bigqueryDatasetId`;
ALTER TABLE `companies` DROP COLUMN IF EXISTS `bigqueryCredentials`;
ALTER TABLE `companies` DROP COLUMN IF EXISTS `bigquerySqlHistoryTable`;
ALTER TABLE `companies` DROP COLUMN IF EXISTS `bigqueryConversionRatesTable`;
ALTER TABLE `companies` DROP COLUMN IF EXISTS `bigqueryActualsTable`;
ALTER TABLE `companies` DROP COLUMN IF EXISTS `bigqueryLastSync`;



