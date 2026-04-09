-- AlterTable
ALTER TABLE `payments` ADD COLUMN `payment_type` VARCHAR(50) NOT NULL DEFAULT 'POST_VIP';

-- AlterTable
ALTER TABLE `vip_subscriptions` MODIFY `post_id` INTEGER NULL;
