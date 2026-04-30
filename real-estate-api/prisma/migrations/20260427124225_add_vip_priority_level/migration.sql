-- AlterTable
ALTER TABLE `users` ADD COLUMN `vip_priority_level` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `vip_packages` ADD COLUMN `package_type` VARCHAR(50) NOT NULL DEFAULT 'POST_VIP';
