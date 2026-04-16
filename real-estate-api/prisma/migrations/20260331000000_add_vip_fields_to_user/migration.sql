-- AlterTable
ALTER TABLE `users` 
  ADD COLUMN `is_vip` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `vip_expiry` DATETIME(3) NULL;
