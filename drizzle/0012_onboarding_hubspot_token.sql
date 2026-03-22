-- Add per-company HubSpot token
ALTER TABLE `companies` ADD COLUMN `hubspotToken` VARCHAR(512) DEFAULT NULL;
