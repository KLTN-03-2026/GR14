-- Align `posts` table with current Prisma schema.
-- Older migrations created `posts` without `post_type` and several newer fields.

ALTER TABLE `posts`
  -- Core post type
  ADD COLUMN `post_type` VARCHAR(50) NOT NULL DEFAULT 'SELL_HOUSE' AFTER `id`,

  -- Contact fields
  ADD COLUMN `contact_phone` VARCHAR(30) NULL AFTER `address`,
  ADD COLUMN `contact_link` VARCHAR(500) NULL AFTER `contact_phone`,

  -- House fields
  ADD COLUMN `bedrooms` INTEGER NULL DEFAULT 0 AFTER `direction`,
  ADD COLUMN `bathrooms` INTEGER NULL DEFAULT 0 AFTER `bedrooms`,
  ADD COLUMN `floors` INTEGER NULL DEFAULT 1 AFTER `bathrooms`,

  -- Land fields
  ADD COLUMN `front_width` DOUBLE NULL AFTER `floors`,
  ADD COLUMN `land_length` DOUBLE NULL AFTER `front_width`,
  ADD COLUMN `land_type` VARCHAR(100) NULL AFTER `land_length`,
  ADD COLUMN `legal_status` VARCHAR(100) NULL AFTER `land_type`,

  -- NEED_BUY / NEED_RENT fields
  ADD COLUMN `min_price` DECIMAL(15, 2) NULL AFTER `legal_status`,
  ADD COLUMN `max_price` DECIMAL(15, 2) NULL AFTER `min_price`,
  ADD COLUMN `min_area` DOUBLE NULL AFTER `max_price`,
  ADD COLUMN `max_area` DOUBLE NULL AFTER `min_area`,

  -- NEWS / PROMOTION fields
  ADD COLUMN `start_date` DATETIME(3) NULL AFTER `max_area`,
  ADD COLUMN `end_date` DATETIME(3) NULL AFTER `start_date`,
  ADD COLUMN `discount_code` VARCHAR(50) NULL AFTER `end_date`,

  -- VIP priority (0..3)
  ADD COLUMN `vip_priority_level` INTEGER NOT NULL DEFAULT 0 AFTER `vip_expiry`;

-- Make address/price/area align with Prisma nullability
ALTER TABLE `posts`
  MODIFY `city` VARCHAR(100) NULL,
  MODIFY `district` VARCHAR(100) NULL,
  MODIFY `ward` VARCHAR(100) NULL,
  MODIFY `address` VARCHAR(255) NULL,
  MODIFY `price` DECIMAL(15, 2) NULL,
  MODIFY `area` DECIMAL(10, 2) NULL;

