/*
  Warnings:

  - A unique constraint covering the columns `[deposit_id]` on the table `payments` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `houses` ADD COLUMN `deposit_status` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `lands` ADD COLUMN `deposit_status` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `payments` ADD COLUMN `deposit_id` INTEGER NULL,
    MODIFY `subscription_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `posts` ALTER COLUMN `post_type` DROP DEFAULT;

-- CreateTable
CREATE TABLE `property_deposits` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `appointment_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `refund_amount` DECIMAL(15, 2) NULL,
    `refund_account_info` TEXT NULL,
    `deposit_type` VARCHAR(50) NOT NULL DEFAULT 'BEFORE_VIEWING',
    `status` INTEGER NOT NULL DEFAULT 0,
    `expires_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `property_deposits_appointment_id_key`(`appointment_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `payments_deposit_id_key` ON `payments`(`deposit_id`);

-- AddForeignKey
ALTER TABLE `property_deposits` ADD CONSTRAINT `property_deposits_appointment_id_fkey` FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_deposits` ADD CONSTRAINT `property_deposits_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_deposit_id_fkey` FOREIGN KEY (`deposit_id`) REFERENCES `property_deposits`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
