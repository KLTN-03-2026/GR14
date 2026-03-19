-- Manual pre-migration script (optional).
-- Use this if you want to clean data before running Prisma migrate in production.

UPDATE `users`
SET `phone` = CONCAT('U', LPAD(`id`, 14, '0'))
WHERE `phone` IS NULL OR TRIM(`phone`) = '';

UPDATE `users`
SET `email` = CONCAT('missing-', `id`, '@local.invalid')
WHERE `email` IS NULL OR TRIM(`email`) = '';

-- Quick verification queries
SELECT COUNT(*) AS null_or_blank_phone
FROM `users`
WHERE `phone` IS NULL OR TRIM(`phone`) = '';

SELECT COUNT(*) AS null_or_blank_email
FROM `users`
WHERE `email` IS NULL OR TRIM(`email`) = '';
