-- Backfill existing null/blank phone and email with deterministic unique placeholders.
-- This step ensures ALTER COLUMN NOT NULL will not fail on existing data.
UPDATE `users`
SET `phone` = CONCAT('U', LPAD(`id`, 14, '0'))
WHERE `phone` IS NULL OR TRIM(`phone`) = '';

UPDATE `users`
SET `email` = CONCAT('missing-', `id`, '@local.invalid')
WHERE `email` IS NULL OR TRIM(`email`) = '';

-- Enforce NOT NULL at DB level.
ALTER TABLE `users`
  MODIFY `phone` VARCHAR(15) NOT NULL,
  MODIFY `email` VARCHAR(255) NOT NULL;
