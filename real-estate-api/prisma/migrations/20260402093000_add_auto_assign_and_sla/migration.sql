-- Employee assignment metadata
ALTER TABLE `employees`
  ADD COLUMN `city` VARCHAR(100) NULL,
  ADD COLUMN `district` VARCHAR(100) NULL,
  ADD COLUMN `max_appointments_per_day` INTEGER NOT NULL DEFAULT 8,
  ADD COLUMN `is_active` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `last_assigned_at` DATETIME(3) NULL;

-- Employee availability windows
CREATE TABLE `employee_availabilities` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `employee_id` INTEGER NOT NULL,
  `start_at` DATETIME(3) NOT NULL,
  `end_at` DATETIME(3) NOT NULL,
  `type` VARCHAR(20) NOT NULL DEFAULT 'available',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  INDEX `employee_availabilities_employee_id_start_at_end_at_idx`(`employee_id`, `start_at`, `end_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `employee_availabilities`
  ADD CONSTRAINT `employee_availabilities_employee_id_fkey`
  FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Appointment SLA and assignment tracking
ALTER TABLE `appointments`
  ADD COLUMN `duration_minutes` INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN `assigned_at` DATETIME(3) NULL,
  ADD COLUMN `first_contact_at` DATETIME(3) NULL,
  ADD COLUMN `sla_assign_deadline_at` DATETIME(3) NULL,
  ADD COLUMN `sla_first_contact_deadline_at` DATETIME(3) NULL,
  ADD COLUMN `sla_status` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `auto_assign_reason` VARCHAR(255) NULL;
