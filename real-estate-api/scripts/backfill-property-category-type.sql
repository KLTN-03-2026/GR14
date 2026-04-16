-- Add category_type for property categories and backfill existing rows.
-- Run this after deploying schema update if old data exists.

ALTER TABLE property_categories
ADD COLUMN category_type ENUM('HOUSE','LAND') NULL AFTER name;

UPDATE property_categories
SET category_type = 'HOUSE'
WHERE category_code IN ('HOUSE', 'VILLA', 'APARTMENT', 'TOWNHOUSE');

UPDATE property_categories
SET category_type = 'LAND'
WHERE category_code IN ('RESLAND', 'COMLAND', 'AGRLAND', 'INDLAND');

UPDATE property_categories
SET category_type = 'HOUSE'
WHERE category_type IS NULL;

ALTER TABLE property_categories
MODIFY category_type ENUM('HOUSE','LAND') NOT NULL;
