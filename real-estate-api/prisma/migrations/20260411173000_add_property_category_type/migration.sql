-- Add category_type to property categories
ALTER TABLE `property_categories`
ADD COLUMN `category_type` ENUM('HOUSE', 'LAND') NULL;

-- Backfill from existing category codes
UPDATE `property_categories`
SET `category_type` = 'HOUSE'
WHERE `category_code` IN ('HOUSE', 'VILLA', 'APARTMENT', 'TOWNHOUSE');

UPDATE `property_categories`
SET `category_type` = 'LAND'
WHERE `category_code` IN ('RESLAND', 'COMLAND', 'AGRLAND', 'INDLAND');

-- Ensure no null values remain
UPDATE `property_categories`
SET `category_type` = 'HOUSE'
WHERE `category_type` IS NULL;

ALTER TABLE `property_categories`
MODIFY COLUMN `category_type` ENUM('HOUSE', 'LAND') NOT NULL;
