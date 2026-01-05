-- Fix phone field length issue
-- Increase phone field from varchar(50) to varchar(500) to handle multiple phone numbers
ALTER TABLE `hubspot_contacts` MODIFY COLUMN `phone` VARCHAR(500) NULL;



