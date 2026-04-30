-- AlterTable
ALTER TABLE `property_deposits` ADD COLUMN `admin_note` TEXT NULL,
    ADD COLUMN `refunded_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `users` MODIFY `phone` VARCHAR(15) NULL;
