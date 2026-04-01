-- CreateTable
CREATE TABLE `user_behaviors` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `house_id` INTEGER NULL,
    `land_id` INTEGER NULL,
    `action` VARCHAR(20) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `user_behaviors_user_id_action_idx`(`user_id`, `action`),
    INDEX `user_behaviors_house_id_idx`(`house_id`),
    INDEX `user_behaviors_land_id_idx`(`land_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_behaviors` ADD CONSTRAINT `user_behaviors_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_behaviors` ADD CONSTRAINT `user_behaviors_house_id_fkey` FOREIGN KEY (`house_id`) REFERENCES `houses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_behaviors` ADD CONSTRAINT `user_behaviors_land_id_fkey` FOREIGN KEY (`land_id`) REFERENCES `lands`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
