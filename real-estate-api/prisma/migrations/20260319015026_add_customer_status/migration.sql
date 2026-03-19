SET @customers_status_sql = (
	SELECT IF(
		EXISTS (
			SELECT 1
			FROM INFORMATION_SCHEMA.COLUMNS
			WHERE TABLE_SCHEMA = DATABASE()
				AND TABLE_NAME = 'customers'
				AND COLUMN_NAME = 'status'
		),
		'SELECT 1',
		'ALTER TABLE `customers` ADD COLUMN `status` INTEGER NOT NULL DEFAULT 1'
	)
);
PREPARE customers_status_stmt FROM @customers_status_sql;
EXECUTE customers_status_stmt;
DEALLOCATE PREPARE customers_status_stmt;

SET @employees_status_sql = (
	SELECT IF(
		EXISTS (
			SELECT 1
			FROM INFORMATION_SCHEMA.COLUMNS
			WHERE TABLE_SCHEMA = DATABASE()
				AND TABLE_NAME = 'employees'
				AND COLUMN_NAME = 'status'
		),
		'SELECT 1',
		'ALTER TABLE `employees` ADD COLUMN `status` INTEGER NOT NULL DEFAULT 1'
	)
);
PREPARE employees_status_stmt FROM @employees_status_sql;
EXECUTE employees_status_stmt;
DEALLOCATE PREPARE employees_status_stmt;
