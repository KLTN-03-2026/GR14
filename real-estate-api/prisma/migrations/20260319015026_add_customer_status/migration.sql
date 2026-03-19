-- AlterTable
ALTER TABLE `customers` ADD COLUMN `status` INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE `employees` ADD COLUMN `status` INTEGER NOT NULL DEFAULT 1;
